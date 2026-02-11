// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPokemonCard
 * @dev Interface for interacting with the PokemonCard NFT contract
 */
interface IPokemonCard is IERC721 {
    struct PokemonStats {
        string name;
        string pokemonType;
        string rarity;
        uint256 hp;
        uint256 attack;
        uint256 defense;
        uint256 speed;
        uint256 generation;
        uint256 level;
        bool exists;
    }

    function getPokemonStats(uint256 tokenId) external view returns (PokemonStats memory);
    function updateStats(uint256 tokenId, uint256 newLevel, uint256 newHp, uint256 newAttack, uint256 newDefense) external;
    function burnAndMint(
        address to,
        uint256 oldTokenId,
        string memory uri,
        string memory name,
        string memory pokemonType,
        string memory rarity,
        uint256 hp,
        uint256 attack,
        uint256 defense,
        uint256 speed,
        uint256 level,
        uint256 generation
    ) external returns (uint256);
}

/**
 * @title DayCare
 * @dev Staking contract for Pokemon NFTs that rewards time-based levelling.
 *
 * Players deposit (stake) a Pokemon NFT into this contract. While staked,
 * the Pokemon earns 1 level per `levelInterval` seconds (default 60s).
 * On unstaking the contract calculates levels gained, applies flat stat
 * boosts (+5 HP/ATK/DEF per level), updates the NFT on-chain via
 * PokemonCard.updateStats(), and returns the NFT to the player.
 *
 * Staked NFTs are held by this contract (ERC721Holder), which naturally
 * prevents them from being listed on the marketplace while staked.
 * Levels are capped at MAX_LEVEL (100).
 */
contract DayCare is ERC721Holder, Ownable, Pausable, ReentrancyGuard {
    // ============ State Variables ============
    IPokemonCard public immutable pokemonCard;
    uint256 public levelInterval = 2; // seconds per level
    uint256 public constant MAX_LEVEL = 100;
    uint256 public constant HP_PER_LEVEL = 5;
    uint256 public constant ATTACK_PER_LEVEL = 5;
    uint256 public constant DEFENSE_PER_LEVEL = 5;

    // ============ Structs ============
    struct StakeInfo {
        address owner;
        uint256 stakeTimestamp;
        uint256 levelAtStake;
    }

    // ============ Mappings ============
    mapping(uint256 => StakeInfo) public stakes;
    mapping(address => uint256[]) private _stakedTokensByOwner;

    // ============ Events ============
    event PokemonStaked(uint256 indexed tokenId, address indexed owner, uint256 timestamp);
    event PokemonUnstaked(uint256 indexed tokenId, address indexed owner, uint256 newLevel, uint256 levelsGained);
    event LevelIntervalUpdated(uint256 oldInterval, uint256 newInterval);
    event EmergencyStop(address indexed by);
    event EmergencyResume(address indexed by);

    // ============ Errors ============
    error NotTokenOwner();
    error TokenNotStaked();
    error TokenAlreadyStaked();
    error InvalidInterval();
    error ZeroAddress();

    // ============ Constructor ============
    constructor(address _pokemonCard) Ownable(msg.sender) {
        if (_pokemonCard == address(0)) revert ZeroAddress();
        pokemonCard = IPokemonCard(_pokemonCard);
    }

    // ============ Staking Functions ============

    /**
     * @dev Stake a Pokemon NFT in the Day Care. The caller must own the token
     * and have approved this contract to transfer it (via approve or setApprovalForAll).
     * Transfers the NFT into this contract, records the caller as the staker,
     * saves the current timestamp and level so levelling can be calculated on unstake.
     * @param tokenId The token ID to stake
     */
    function stake(uint256 tokenId) external nonReentrant whenNotPaused {
        // Checks
        if (pokemonCard.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (stakes[tokenId].owner != address(0)) revert TokenAlreadyStaked();

        IPokemonCard.PokemonStats memory stats = pokemonCard.getPokemonStats(tokenId);

        // Effects: record stake info BEFORE the external transfer (CEI pattern)
        stakes[tokenId] = StakeInfo({
            owner: msg.sender,
            stakeTimestamp: block.timestamp,
            levelAtStake: stats.level
        });
        _stakedTokensByOwner[msg.sender].push(tokenId);

        // Interactions: transfer NFT to this contract
        pokemonCard.transferFrom(msg.sender, address(this), tokenId);

        emit PokemonStaked(tokenId, msg.sender, block.timestamp);
    }

    /**
     * @dev Unstake a Pokemon NFT and apply accumulated rewards. Only the
     * original staker can unstake. Calculates levels gained from elapsed time
     * (elapsed seconds / levelInterval), caps at MAX_LEVEL, then boosts
     * HP/ATK/DEF by the per-level constants. Calls PokemonCard.updateStats()
     * to persist the new stats, transfers the NFT back to the caller, and
     * cleans up all staking state.
     * @param tokenId The token ID to unstake
     */
    function unstake(uint256 tokenId) external nonReentrant whenNotPaused {
        StakeInfo memory info = stakes[tokenId];
        if (info.owner != msg.sender) revert TokenNotStaked();

        // Calculate levels gained
        uint256 elapsed = block.timestamp - info.stakeTimestamp;
        uint256 rawLevelsGained = elapsed / levelInterval;

        // Get current stats (view call — no state change)
        IPokemonCard.PokemonStats memory stats = pokemonCard.getPokemonStats(tokenId);

        // Apply level cap
        uint256 newLevel = info.levelAtStake + rawLevelsGained;
        if (newLevel > MAX_LEVEL) {
            newLevel = MAX_LEVEL;
        }
        uint256 actualGain = newLevel - info.levelAtStake;

        // Calculate boosted stats
        uint256 newHp = stats.hp + (actualGain * HP_PER_LEVEL);
        uint256 newAttack = stats.attack + (actualGain * ATTACK_PER_LEVEL);
        uint256 newDefense = stats.defense + (actualGain * DEFENSE_PER_LEVEL);

        // Effects: clean up stake data BEFORE external calls (CEI pattern)
        _removeStakedToken(msg.sender, tokenId);
        delete stakes[tokenId];

        // Interactions: external calls after state is finalised
        pokemonCard.updateStats(tokenId, newLevel, newHp, newAttack, newDefense);
        pokemonCard.transferFrom(address(this), msg.sender, tokenId);

        emit PokemonUnstaked(tokenId, msg.sender, newLevel, actualGain);
    }

    // ============ View Functions ============

    /**
     * @dev Returns the full StakeInfo struct for a token, including the original
     * owner, the timestamp when staking began, and the level at time of staking.
     * Returns zero values if the token is not currently staked.
     * @param tokenId The token ID to look up
     */
    function getStakeInfo(uint256 tokenId) external view returns (StakeInfo memory) {
        return stakes[tokenId];
    }

    /**
     * @dev Calculate how many levels a staked token has earned so far without
     * actually unstaking. Returns 0 if the token is not staked. Accounts for
     * the MAX_LEVEL cap so the result matches what unstake() would apply.
     * Useful for frontends to show real-time level progress.
     * @param tokenId The token ID to check
     */
    function getPendingLevels(uint256 tokenId) external view returns (uint256) {
        StakeInfo memory info = stakes[tokenId];
        if (info.owner == address(0)) return 0;

        uint256 elapsed = block.timestamp - info.stakeTimestamp;
        uint256 rawGain = elapsed / levelInterval;
        uint256 newLevel = info.levelAtStake + rawGain;

        if (newLevel > MAX_LEVEL) {
            return MAX_LEVEL - info.levelAtStake;
        }
        return rawGain;
    }

    /**
     * @dev Returns an array of all token IDs currently staked by a given address.
     * Useful for frontends to display a player's staked Pokemon collection.
     * @param owner The address to query
     */
    function getStakedTokens(address owner) external view returns (uint256[] memory) {
        return _stakedTokensByOwner[owner];
    }

    /**
     * @dev Returns true if the given token is currently staked in the Day Care.
     * Checks whether a staker address is recorded (non-zero means staked).
     * @param tokenId The token ID to check
     */
    function isStaked(uint256 tokenId) external view returns (bool) {
        return stakes[tokenId].owner != address(0);
    }

    // ============ Admin Functions ============

    /**
     * @dev Update how many seconds a Pokemon must be staked to earn one level.
     * Only callable by the contract owner. Cannot be set to 0.
     * Affects all future unstake calculations (does not retroactively change
     * levels for already-staked Pokemon since their elapsed time is unchanged).
     * @param newInterval The new seconds-per-level value
     */
    function setLevelInterval(uint256 newInterval) external onlyOwner {
        if (newInterval == 0) revert InvalidInterval();
        uint256 oldInterval = levelInterval;
        levelInterval = newInterval;
        emit LevelIntervalUpdated(oldInterval, newInterval);
    }

    // ============ Emergency Stop ============

    /**
     * @dev Emergency pause - stops all staking operations
     */
    function pause() external onlyOwner {
        _pause();
        emit EmergencyStop(msg.sender);
    }

    /**
     * @dev Resume from emergency pause
     */
    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyResume(msg.sender);
    }

    // ============ Internal Functions ============

    /**
     * @dev Removes a token ID from the owner's staked-tokens array using the
     * swap-and-pop pattern (O(1) deletion, does not preserve order).
     */
    function _removeStakedToken(address owner, uint256 tokenId) internal {
        uint256[] storage tokens = _stakedTokensByOwner[owner];
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len;) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[len - 1];
                tokens.pop();
                return;
            }
            unchecked { ++i; }
        }
    }
}
