// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPokemonCard
 * @dev Interface for interacting with the PokemonCard NFT contract
 */
interface IPokemonCardEvolution {
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
    function ownerOf(uint256 tokenId) external view returns (address);
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
 * @title EvolutionManager
 * @dev Manages Pokemon evolution through a burn-and-mint mechanic.
 *
 * The owner registers evolution paths that map a Pokemon name to its evolved form
 * (e.g. "Charmander" -> "Charmeleon"), including the new name, type, rarity,
 * minimum level required, and stat boosts applied on evolution.
 *
 * When a player evolves a Pokemon, the contract verifies ownership and level,
 * then burns the old NFT and mints a new one with the evolved stats.
 * The token ID changes but the owner, level, and generation are preserved.
 */
contract EvolutionManager is Ownable, ReentrancyGuard {
    // ============ State Variables ============
    IPokemonCardEvolution public pokemonCard;
    string public baseTokenURI;

    // ============ Structs ============
    struct EvolutionPath {
        string toName;
        string toType;
        string toRarity;
        uint256 levelThreshold;
        uint256 hpBoost;
        uint256 attackBoost;
        uint256 defenseBoost;
        uint256 speedBoost;
        bool exists;
    }

    // ============ Mappings ============
    mapping(string => EvolutionPath) public evolutionPaths;

    // ============ Events ============
    event EvolutionPathRegistered(string indexed fromName, string toName, uint256 levelThreshold);
    event PokemonEvolved(
        uint256 indexed oldTokenId,
        uint256 indexed newTokenId,
        string fromName,
        string toName,
        address indexed owner
    );
    event BaseTokenURIUpdated(string oldURI, string newURI);

    // ============ Errors ============
    error NotTokenOwner();
    error NoEvolutionPath();
    error LevelTooLow(uint256 currentLevel, uint256 requiredLevel);
    error InvalidEvolutionPath();

    // ============ Constructor ============
    constructor(address _pokemonCard) Ownable(msg.sender) {
        pokemonCard = IPokemonCardEvolution(_pokemonCard);
    }

    // ============ Admin Functions ============

    /**
     * @dev Register or update an evolution path. Only callable by the contract owner.
     * Maps a Pokemon name (fromName) to its evolved form, specifying the target
     * name/type/rarity, the minimum level needed to evolve, and flat stat boosts
     * added to hp/attack/defense/speed on evolution.
     * @param fromName The name of the pre-evolution Pokemon (e.g. "Charmander")
     * @param toName The name of the evolved Pokemon (e.g. "Charmeleon")
     * @param toType The type of the evolved Pokemon (e.g. "Fire")
     * @param toRarity The rarity of the evolved Pokemon (e.g. "Rare")
     * @param levelThreshold Minimum level required to evolve (must be > 0)
     * @param hpBoost Flat HP increase applied on evolution
     * @param attackBoost Flat attack increase applied on evolution
     * @param defenseBoost Flat defense increase applied on evolution
     * @param speedBoost Flat speed increase applied on evolution
     */
    function registerEvolution(
        string memory fromName,
        string memory toName,
        string memory toType,
        string memory toRarity,
        uint256 levelThreshold,
        uint256 hpBoost,
        uint256 attackBoost,
        uint256 defenseBoost,
        uint256 speedBoost
    ) external onlyOwner {
        if (levelThreshold == 0) revert InvalidEvolutionPath();

        evolutionPaths[fromName] = EvolutionPath({
            toName: toName,
            toType: toType,
            toRarity: toRarity,
            levelThreshold: levelThreshold,
            hpBoost: hpBoost,
            attackBoost: attackBoost,
            defenseBoost: defenseBoost,
            speedBoost: speedBoost,
            exists: true
        });

        emit EvolutionPathRegistered(fromName, toName, levelThreshold);
    }

    /**
     * @dev Set the base token URI prefix used when constructing metadata URIs
     * for newly evolved Pokemon. The final URI is baseTokenURI + "evolved.json".
     * @param newURI The new base URI string
     */
    function setBaseTokenURI(string memory newURI) external onlyOwner {
        string memory oldURI = baseTokenURI;
        baseTokenURI = newURI;
        emit BaseTokenURIUpdated(oldURI, newURI);
    }

    // ============ Evolution Functions ============

    /**
     * @dev Evolve a Pokemon into its next form. Caller must own the token.
     * Looks up the evolution path by the Pokemon's current name, checks the
     * level threshold is met, applies stat boosts, then burns the old NFT
     * and mints a new one to the caller with the evolved stats.
     * @param tokenId The token ID of the Pokemon to evolve
     * @return The token ID of the newly minted evolved Pokemon
     */
    function evolve(uint256 tokenId) external nonReentrant returns (uint256) {
        // Verify ownership
        if (pokemonCard.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        // Get current stats and evolution path
        IPokemonCardEvolution.PokemonStats memory stats = pokemonCard.getPokemonStats(tokenId);
        EvolutionPath memory path = evolutionPaths[stats.name];
        if (!path.exists) revert NoEvolutionPath();
        if (stats.level < path.levelThreshold) {
            revert LevelTooLow(stats.level, path.levelThreshold);
        }

        // Apply boosts directly to the stats struct to reduce stack variables
        stats.hp += path.hpBoost;
        stats.attack += path.attackBoost;
        stats.defense += path.defenseBoost;
        stats.speed += path.speedBoost;

        uint256 newTokenId = _executeBurnAndMint(tokenId, stats, path);

        emit PokemonEvolved(tokenId, newTokenId, stats.name, path.toName, msg.sender);

        return newTokenId;
    }

    /**
     * @dev Internal helper that calls PokemonCard.burnAndMint with the evolved
     * stats. Separated from evolve() to avoid stack-too-deep errors due to
     * the large number of parameters passed to burnAndMint.
     */
    function _executeBurnAndMint(
        uint256 oldTokenId,
        IPokemonCardEvolution.PokemonStats memory stats,
        EvolutionPath memory path
    ) internal returns (uint256) {
        string memory newUri = string(abi.encodePacked(baseTokenURI, "evolved.json"));

        return pokemonCard.burnAndMint(
            msg.sender,
            oldTokenId,
            newUri,
            path.toName,
            path.toType,
            path.toRarity,
            stats.hp,
            stats.attack,
            stats.defense,
            stats.speed,
            stats.level,
            stats.generation
        );
    }

    // ============ View Functions ============

    /**
     * @dev Returns the full evolution path for a given Pokemon name, including
     * the target name/type/rarity, level threshold, stat boosts, and whether
     * the path exists. Returns a struct with exists=false if no path is registered.
     * @param fromName The name of the Pokemon to look up (e.g. "Charmander")
     */
    function getEvolutionPath(string memory fromName) external view returns (EvolutionPath memory) {
        return evolutionPaths[fromName];
    }

    /**
     * @dev Check if a specific token can evolve right now. Returns true only if
     * an evolution path exists for the Pokemon's name AND its level meets or
     * exceeds the required threshold.
     * @param tokenId The token ID to check
     */
    function canEvolve(uint256 tokenId) external view returns (bool) {
        IPokemonCardEvolution.PokemonStats memory stats = pokemonCard.getPokemonStats(tokenId);
        EvolutionPath memory path = evolutionPaths[stats.name];
        return path.exists && stats.level >= path.levelThreshold;
    }

    /**
     * @dev Preview what a Pokemon would become after evolution without modifying
     * state. Returns the evolved name/type/rarity, the boosted stats, and the
     * level required. Reverts with NoEvolutionPath if no path is registered.
     * Useful for frontend UIs to show a before/after comparison.
     * @param tokenId The token ID to preview evolution for
     */
    function getEvolutionPreview(uint256 tokenId) external view returns (
        string memory newName,
        string memory newType,
        string memory newRarity,
        uint256 newHp,
        uint256 newAttack,
        uint256 newDefense,
        uint256 newSpeed,
        uint256 levelRequired
    ) {
        IPokemonCardEvolution.PokemonStats memory stats = pokemonCard.getPokemonStats(tokenId);
        EvolutionPath memory path = evolutionPaths[stats.name];

        if (!path.exists) revert NoEvolutionPath();

        return (
            path.toName,
            path.toType,
            path.toRarity,
            stats.hp + path.hpBoost,
            stats.attack + path.attackBoost,
            stats.defense + path.defenseBoost,
            stats.speed + path.speedBoost,
            path.levelThreshold
        );
    }
}
