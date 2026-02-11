// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PokemonCard.sol";

/**
 * @title Hatchery
 * @dev 3-stage breeding lifecycle for Pokemon NFTs.
 *
 * Stage 1 - breed(): The player selects two parent Pokemon they own.
 *   Both are transferred into this contract as escrow, and their stats are
 *   snapshotted so genetics can be derived later. Legendary Pokemon and
 *   eggs cannot be used as parents. Parents are locked for breedDuration
 *   seconds (default 15s).
 *
 * Stage 2 - mintEgg(): After the breeding timer expires, mints an egg NFT
 *   (with placeholder stats) to the player and releases the parent Pokemon
 *   back. An incubation timer starts (hatchDuration seconds from now).
 *   The egg is a tradeable ERC721 token.
 *
 * Stage 3 - hatch(): Once the incubation timer expires, anyone holding
 *   the egg can hatch it. The egg's stats are overwritten in-place (same
 *   tokenId) with genetics derived from the two parents: species is 50/50
 *   from either parent, stats are the average of both parents +/- random
 *   variance, and generation is max(parent1, parent2) + 1.
 */
contract Hatchery is AccessControl, Pausable, ReentrancyGuard {

    // ============ Roles ============
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ State Variables ============
    PokemonCard public pokemonCard;
    uint256 public breedDuration;
    uint256 public hatchDuration;
    uint256 public sessionCounter;
    string public eggTokenURI;

    // ============ Structs ============
    struct ParentSnapshot {
        string name;
        string pokemonType;
        string rarity;
        uint256 hp;
        uint256 attack;
        uint256 defense;
        uint256 speed;
        uint256 generation;
    }

    struct BreedingSession {
        address originalOwner;
        uint256 parent1Id;
        uint256 parent2Id;
        ParentSnapshot parent1;
        ParentSnapshot parent2;
        uint256 eggTokenId;
        uint256 breedReadyTimestamp;
        uint256 hatchReadyTimestamp;
        bool eggMinted;
        bool hatched;
        bool active;
    }

    // ============ Mappings ============
    mapping(uint256 => BreedingSession) public sessions;
    mapping(uint256 => bool) public lockedTokens;
    mapping(address => uint256[]) private _userSessions;

    // ============ Events ============
    event BreedingStarted(
        uint256 indexed sessionId,
        address indexed owner,
        uint256 parent1Id,
        uint256 parent2Id
    );
    event EggMinted(
        uint256 indexed sessionId,
        uint256 indexed eggTokenId,
        uint256 hatchReadyTimestamp
    );
    event PokemonHatched(
        uint256 indexed sessionId,
        uint256 indexed eggTokenId,
        string name
    );
    event EmergencyStop(address indexed by);
    event EmergencyResume(address indexed by);

    // ============ Errors ============
    error NotTokenOwner();
    error TokenIsEgg();
    error TokenLocked();
    error SameParent();
    error SessionNotFound();
    error NotSessionOwner();
    error EggAlreadyMinted();
    error EggNotMinted();
    error AlreadyHatched();
    error NotReadyToMintEgg();
    error NotReadyToHatch();
    error CannotBreedLegendary();

    // ============ Constructor ============
    constructor(
        address _pokemonCard,
        uint256 _breedDuration,
        uint256 _hatchDuration,
        string memory _eggTokenURI
    ) {
        pokemonCard = PokemonCard(_pokemonCard);
        breedDuration = _breedDuration;
        hatchDuration = _hatchDuration;
        eggTokenURI = _eggTokenURI;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ Breeding Functions ============

    /**
     * @dev Stage 1: Lock both parents in escrow and start a breeding session.
     * The caller must own both parent tokens and have approved this contract.
     * Validates that neither parent is already locked, an egg, or Legendary.
     * Transfers both NFTs into this contract, snapshots their stats for later
     * genetics calculation, and creates a new BreedingSession.
     * @param parent1Id Token ID of the first parent
     * @param parent2Id Token ID of the second parent (must differ from parent1Id)
     * @return The session ID for this breeding pair
     */
    function breed(
        uint256 parent1Id,
        uint256 parent2Id
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (parent1Id == parent2Id) revert SameParent();

        // Verify caller owns both
        if (pokemonCard.ownerOf(parent1Id) != msg.sender) revert NotTokenOwner();
        if (pokemonCard.ownerOf(parent2Id) != msg.sender) revert NotTokenOwner();

        // Verify neither is locked or an egg
        if (lockedTokens[parent1Id]) revert TokenLocked();
        if (lockedTokens[parent2Id]) revert TokenLocked();

        PokemonCard.PokemonStats memory stats1 = pokemonCard.getPokemonStats(parent1Id);
        PokemonCard.PokemonStats memory stats2 = pokemonCard.getPokemonStats(parent2Id);

        if (stats1.isEgg) revert TokenIsEgg();
        if (stats2.isEgg) revert TokenIsEgg();

        if (_isLegendary(stats1.rarity)) revert CannotBreedLegendary();
        if (_isLegendary(stats2.rarity)) revert CannotBreedLegendary();

        // Transfer both to this contract (escrow)
        pokemonCard.transferFrom(msg.sender, address(this), parent1Id);
        pokemonCard.transferFrom(msg.sender, address(this), parent2Id);

        // Mark as locked
        lockedTokens[parent1Id] = true;
        lockedTokens[parent2Id] = true;

        // Snapshot parent stats
        uint256 sessionId = sessionCounter++;

        sessions[sessionId] = BreedingSession({
            originalOwner: msg.sender,
            parent1Id: parent1Id,
            parent2Id: parent2Id,
            parent1: ParentSnapshot({
                name: stats1.name,
                pokemonType: stats1.pokemonType,
                rarity: stats1.rarity,
                hp: stats1.hp,
                attack: stats1.attack,
                defense: stats1.defense,
                speed: stats1.speed,
                generation: stats1.generation
            }),
            parent2: ParentSnapshot({
                name: stats2.name,
                pokemonType: stats2.pokemonType,
                rarity: stats2.rarity,
                hp: stats2.hp,
                attack: stats2.attack,
                defense: stats2.defense,
                speed: stats2.speed,
                generation: stats2.generation
            }),
            eggTokenId: 0,
            breedReadyTimestamp: block.timestamp + breedDuration,
            hatchReadyTimestamp: 0,
            eggMinted: false,
            hatched: false,
            active: true
        });

        _userSessions[msg.sender].push(sessionId);

        emit BreedingStarted(sessionId, msg.sender, parent1Id, parent2Id);

        return sessionId;
    }

    /**
     * @dev Stage 2: Mint an egg NFT and release parents back to the owner.
     * Only the original breeder can call this, and only once per session.
     * Can only be called after the breeding timer (breedDuration) expires.
     * Mints a new egg token (with placeholder stats and isEgg=true) to the
     * caller, starts the incubation countdown timer (block.timestamp +
     * hatchDuration), then transfers both parent NFTs back and unlocks them.
     * @param sessionId The breeding session to mint an egg for
     */
    function mintEgg(uint256 sessionId) external nonReentrant whenNotPaused {
        BreedingSession storage session = sessions[sessionId];
        if (!session.active) revert SessionNotFound();
        if (session.originalOwner != msg.sender) revert NotSessionOwner();
        if (session.eggMinted) revert EggAlreadyMinted();
        if (block.timestamp < session.breedReadyTimestamp) revert NotReadyToMintEgg();

        // Mint egg NFT to the owner
        uint256 eggTokenId = pokemonCard.mintEgg(msg.sender, eggTokenURI);
        session.eggTokenId = eggTokenId;
        session.eggMinted = true;
        session.hatchReadyTimestamp = block.timestamp + hatchDuration;

        // Release parents back to owner
        pokemonCard.transferFrom(address(this), msg.sender, session.parent1Id);
        pokemonCard.transferFrom(address(this), msg.sender, session.parent2Id);
        lockedTokens[session.parent1Id] = false;
        lockedTokens[session.parent2Id] = false;

        emit EggMinted(sessionId, eggTokenId, session.hatchReadyTimestamp);
    }

    /**
     * @dev Stage 3: Hatch the egg into a real Pokemon with inherited genetics.
     * Can be called by whoever currently owns the egg, once the hatch timer
     * has expired. Generates a pseudo-random seed from block data and session
     * info, then determines the offspring:
     *   - Species (name/type/rarity): randomly chosen from one of the two parents (50/50)
     *   - Stats (HP/ATK/DEF/SPD): average of both parents +/- random variance (-5 to +5)
     *   - Generation: max(parent1, parent2) + 1
     *   - Level: starts at 1 (set by PokemonCard.hatchEgg)
     * Overwrites the egg's placeholder stats in-place (same tokenId) and
     * marks the session as hatched and inactive.
     * @param sessionId The breeding session to hatch
     */
    function hatch(uint256 sessionId) external nonReentrant whenNotPaused {
        BreedingSession storage session = sessions[sessionId];
        if (!session.active) revert SessionNotFound();
        if (!session.eggMinted) revert EggNotMinted();
        if (session.hatched) revert AlreadyHatched();
        if (block.timestamp < session.hatchReadyTimestamp) revert NotReadyToHatch();
        if (pokemonCard.ownerOf(session.eggTokenId) != msg.sender) revert NotTokenOwner();

        // Calculate genetics
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            block.timestamp, block.prevrandao, msg.sender, sessionId, session.eggTokenId
        )));

        // Species: 50/50 from either parent
        bool useParent1 = (randomSeed % 2 == 0);
        ParentSnapshot memory chosen = useParent1 ? session.parent1 : session.parent2;

        // Stats: average of parents + random variance (-5 to +5)
        uint256 newHp = _calcStat(session.parent1.hp, session.parent2.hp, randomSeed, 1);
        uint256 newAttack = _calcStat(session.parent1.attack, session.parent2.attack, randomSeed, 2);
        uint256 newDefense = _calcStat(session.parent1.defense, session.parent2.defense, randomSeed, 3);
        uint256 newSpeed = _calcStat(session.parent1.speed, session.parent2.speed, randomSeed, 4);

        // Generation: max of parents + 1
        uint256 newGeneration = session.parent1.generation >= session.parent2.generation
            ? session.parent1.generation + 1
            : session.parent2.generation + 1;

        // Hatch the egg via PokemonCard
        pokemonCard.hatchEgg(
            session.eggTokenId,
            chosen.name,
            chosen.pokemonType,
            chosen.rarity,
            newHp,
            newAttack,
            newDefense,
            newSpeed,
            newGeneration,
            eggTokenURI // URI will be updated; could use species-specific URI
        );

        session.hatched = true;
        session.active = false;

        emit PokemonHatched(sessionId, session.eggTokenId, chosen.name);
    }

    // ============ View Functions ============

    /**
     * @dev Returns the full BreedingSession struct for a given session ID,
     * including both parent snapshots, egg token ID, hatch timer, and status
     * flags (eggMinted, hatched, active). Returns zero/default values if
     * the session ID has never been used.
     */
    function getSession(uint256 sessionId) external view returns (BreedingSession memory) {
        return sessions[sessionId];
    }

    /**
     * @dev Returns an array of all breeding session IDs that a user has created.
     * Useful for frontends to list a player's breeding history.
     */
    function getUserSessions(address user) external view returns (uint256[] memory) {
        return _userSessions[user];
    }

    /**
     * @dev Returns true if a token is currently locked in escrow as a breeding
     * parent (between breed() and mintEgg() calls).
     */
    function isTokenLocked(uint256 tokenId) external view returns (bool) {
        return lockedTokens[tokenId];
    }

    /**
     * @dev Returns true if a session's breeding timer has expired and an egg
     * can be minted (parents released). Requires active session, no egg yet.
     */
    function canMintEgg(uint256 sessionId) external view returns (bool) {
        BreedingSession memory session = sessions[sessionId];
        return session.active && !session.eggMinted && block.timestamp >= session.breedReadyTimestamp;
    }

    /**
     * @dev Returns true if a session's egg is ready to hatch — meaning the egg
     * has been minted, hasn't been hatched yet, and the incubation timer has expired.
     */
    function canHatch(uint256 sessionId) external view returns (bool) {
        BreedingSession memory session = sessions[sessionId];
        return session.eggMinted && !session.hatched && block.timestamp >= session.hatchReadyTimestamp;
    }

    // ============ Admin Functions ============

    /**
     * @dev Update the breeding timer duration (in seconds) for future sessions.
     * Only callable by DEFAULT_ADMIN_ROLE. Does not affect active sessions.
     */
    function setBreedDuration(uint256 _breedDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        breedDuration = _breedDuration;
    }

    /**
     * @dev Update the incubation timer duration (in seconds) for future
     * sessions. Only callable by DEFAULT_ADMIN_ROLE. Does not affect
     * sessions that have already started incubation.
     */
    function setHatchDuration(uint256 _hatchDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        hatchDuration = _hatchDuration;
    }

    /**
     * @dev Update the metadata URI used when minting new egg tokens.
     * Only callable by DEFAULT_ADMIN_ROLE.
     */
    function setEggTokenURI(string memory _eggTokenURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        eggTokenURI = _eggTokenURI;
    }

    // ============ Emergency Stop ============

    /**
     * @dev Emergency pause - stops all breeding operations
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyStop(msg.sender);
    }

    /**
     * @dev Resume from emergency pause
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit EmergencyResume(msg.sender);
    }

    // ============ Internal Functions ============

    /**
     * @dev Returns true if the rarity string equals "Legendary". Used to block
     * Legendary Pokemon from being used as breeding parents.
     */
    function _isLegendary(string memory rarity) internal pure returns (bool) {
        return keccak256(bytes(rarity)) == keccak256(bytes("Legendary"));
    }

    /**
     * @dev Calculate a child's stat from two parent stats. Takes the average
     * of both parents, then applies a pseudo-random variance of -5 to +5.
     * The variance is derived by hashing the seed with a salt (unique per stat)
     * to produce a value 0-10, then mapping it to the range -5..+5.
     * Result is floored at 1 to prevent zero stats.
     * @param stat1 Parent 1's stat value
     * @param stat2 Parent 2's stat value
     * @param seed The random seed generated in hatch()
     * @param salt A unique offset per stat (1=HP, 2=ATK, 3=DEF, 4=SPD)
     */
    function _calcStat(
        uint256 stat1,
        uint256 stat2,
        uint256 seed,
        uint256 salt
    ) internal pure returns (uint256) {
        uint256 avg = (stat1 + stat2) / 2;
        uint256 variance = uint256(keccak256(abi.encodePacked(seed, salt))) % 11; // 0-10
        // Map 0-10 to -5..+5: if variance < 5 subtract, else add
        if (variance < 5) {
            uint256 reduction = 5 - variance;
            return avg > reduction ? avg - reduction : 1; // Floor at 1
        } else {
            return avg + (variance - 5);
        }
    }

    // ============ Required Overrides ============

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
