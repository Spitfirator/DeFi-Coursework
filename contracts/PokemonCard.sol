// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PokemonCard
 * @dev ERC721 NFT contract for Pokemon trading cards with comprehensive metadata
 * @notice Implements secure minting with role-based access control and emergency stop
 */
contract PokemonCard is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    AccessControl, 
    Pausable,
    ReentrancyGuard 
{
    // ============ Roles ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TRAINER_ROLE = keccak256("TRAINER_ROLE");

    // ============ State Variables ============
    uint256 private _nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice;
    string private _baseTokenURI;

    // ============ Pokemon Metadata Structure ============
    struct PokemonStats {
        string name;
        string pokemonType;     // Fire, Water, Grass, etc.
        string rarity;          // Common, Uncommon, Rare, Legendary
        uint256 hp;
        uint256 attack;
        uint256 defense;
        uint256 speed;
        uint256 generation;
        uint256 level;
        bool exists;
        bool isEgg;             // True for unhatched eggs
    }

    // ============ Mappings ============
    mapping(uint256 => PokemonStats) public pokemonStats;

    // ============ Events ============
    event PokemonMinted(
        uint256 indexed tokenId, 
        address indexed owner, 
        string name, 
        string rarity
    );
    event PokemonStatsUpdated(uint256 indexed tokenId, string name);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event MaxSupplyUpdated(uint256 oldSupply, uint256 newSupply);
    event Withdrawal(address indexed to, uint256 amount);
    event EmergencyStop(address indexed by);
    event EmergencyResume(address indexed by);
    event BaseURIUpdated(string oldURI, string newURI);
    event PokemonHatched(uint256 indexed tokenId, string name, address indexed owner);

    // ============ Errors ============
    error MaxSupplyReached();
    error InsufficientPayment();
    error InvalidTokenId();
    error TransferFailed();
    error ZeroAddress();
    error InvalidStats();

    // ============ Constructor ============
    constructor(
        uint256 _maxSupply,
        uint256 _mintPrice
    ) ERC721("PokemonCard", "PKMN") {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ Minting Functions ============

    /**
     * @dev Mint a new Pokemon card NFT (public, requires payment)
     * @param to Address to mint to
     * @param uri Token URI for metadata
     * @param name Pokemon name
     * @param pokemonType Pokemon type (Fire, Water, etc.)
     * @param rarity Card rarity
     * @param hp Hit points
     * @param attack Attack stat
     * @param defense Defense stat
     * @param speed Speed stat
     * @param generation Pokemon generation
     */
    function mintPokemon(
        address to,
        string memory uri,
        string memory name,
        string memory pokemonType,
        string memory rarity,
        uint256 hp,
        uint256 attack,
        uint256 defense,
        uint256 speed,
        uint256 generation
    ) public payable whenNotPaused nonReentrant returns (uint256) {
        if (msg.value < mintPrice) revert InsufficientPayment();
        return _mintInternal(to, uri, name, pokemonType, rarity, hp, attack, defense, speed, generation);
    }

    /**
     * @dev Admin mint function - no payment required
     * @notice Only accounts with MINTER_ROLE can call this
     */
    function adminMint(
        address to,
        string memory uri,
        string memory name,
        string memory pokemonType,
        string memory rarity,
        uint256 hp,
        uint256 attack,
        uint256 defense,
        uint256 speed,
        uint256 generation
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintInternal(to, uri, name, pokemonType, rarity, hp, attack, defense, speed, generation);
    }

    /**
     * @dev Shared minting logic used by both mintPokemon and adminMint.
     * Validates inputs, mints the NFT, stores on-chain metadata, and emits an event.
     */
    function _mintInternal(
        address to,
        string memory uri,
        string memory name,
        string memory pokemonType,
        string memory rarity,
        uint256 hp,
        uint256 attack,
        uint256 defense,
        uint256 speed,
        uint256 generation
    ) internal returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        if (_nextTokenId >= maxSupply) revert MaxSupplyReached();
        if (hp == 0 || attack == 0 || defense == 0) revert InvalidStats();

        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        pokemonStats[tokenId] = PokemonStats({
            name: name,
            pokemonType: pokemonType,
            rarity: rarity,
            hp: hp,
            attack: attack,
            defense: defense,
            speed: speed,
            generation: generation,
            level: 1,
            exists: true,
            isEgg: false
        });

        emit PokemonMinted(tokenId, to, name, rarity);
        return tokenId;
    }



    // ============ View Functions ============

    /**
     * @dev Get full Pokemon stats for a token
     */
    function getPokemonStats(uint256 tokenId) external view returns (PokemonStats memory) {
        if (!pokemonStats[tokenId].exists) revert InvalidTokenId();
        return pokemonStats[tokenId];
    }

    /**
     * @dev Get total minted tokens
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Get remaining mintable supply
     */
    function remainingSupply() external view returns (uint256) {
        return maxSupply - _nextTokenId;
    }

    // ============ Trainer Functions (for DayCare / Evolution) ============

    /**
     * @dev Update a Pokemon's stats (called by DayCare on unstake)
     * @notice Only accounts with TRAINER_ROLE can call this
     */
    function updateStats(
        uint256 tokenId,
        uint256 newLevel,
        uint256 newHp,
        uint256 newAttack,
        uint256 newDefense
    ) external onlyRole(TRAINER_ROLE) {
        if (!pokemonStats[tokenId].exists) revert InvalidTokenId();

        pokemonStats[tokenId].level = newLevel;
        pokemonStats[tokenId].hp = newHp;
        pokemonStats[tokenId].attack = newAttack;
        pokemonStats[tokenId].defense = newDefense;

        emit PokemonStatsUpdated(tokenId, pokemonStats[tokenId].name);
    }

    /**
     * @dev Mint an egg NFT with placeholder stats (called by Hatchery)
     * @notice Only accounts with MINTER_ROLE can call this
     */
    function mintEgg(
        address to,
        string memory uri
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        if (_nextTokenId >= maxSupply) revert MaxSupplyReached();

        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        pokemonStats[tokenId] = PokemonStats({
            name: "Egg",
            pokemonType: "Unknown",
            rarity: "Common",
            hp: 0,
            attack: 0,
            defense: 0,
            speed: 0,
            generation: 0,
            level: 0,
            exists: true,
            isEgg: true
        });

        emit PokemonMinted(tokenId, to, "Egg", "Common");

        return tokenId;
    }

    /**
     * @dev Transform an egg into a hatched Pokemon (called by Hatchery)
     * @notice Only accounts with TRAINER_ROLE can call this
     */
    function hatchEgg(
        uint256 tokenId,
        string memory name,
        string memory pokemonType,
        string memory rarity,
        uint256 hp,
        uint256 attack,
        uint256 defense,
        uint256 speed,
        uint256 generation,
        string memory uri
    ) external onlyRole(TRAINER_ROLE) {
        if (!pokemonStats[tokenId].exists) revert InvalidTokenId();
        require(pokemonStats[tokenId].isEgg, "Not an egg");

        pokemonStats[tokenId].name = name;
        pokemonStats[tokenId].pokemonType = pokemonType;
        pokemonStats[tokenId].rarity = rarity;
        pokemonStats[tokenId].hp = hp;
        pokemonStats[tokenId].attack = attack;
        pokemonStats[tokenId].defense = defense;
        pokemonStats[tokenId].speed = speed;
        pokemonStats[tokenId].generation = generation;
        pokemonStats[tokenId].level = 1;
        pokemonStats[tokenId].isEgg = false;

        _setTokenURI(tokenId, uri);

        emit PokemonHatched(tokenId, name, ownerOf(tokenId));
    }

    /**
     * @dev Burn an existing token and mint a new evolved one (called by EvolutionManager)
     * @notice Only accounts with TRAINER_ROLE can call this
     */
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
    ) external onlyRole(TRAINER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        if (_nextTokenId >= maxSupply) revert MaxSupplyReached();
        if (hp == 0 || attack == 0 || defense == 0) revert InvalidStats();
        if (!pokemonStats[oldTokenId].exists) revert InvalidTokenId();

        // Burn the old token
        _burn(oldTokenId);
        pokemonStats[oldTokenId].exists = false;

        // Mint new evolved token
        uint256 newTokenId = _nextTokenId++;
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, uri);

        pokemonStats[newTokenId] = PokemonStats({
            name: name,
            pokemonType: pokemonType,
            rarity: rarity,
            hp: hp,
            attack: attack,
            defense: defense,
            speed: speed,
            generation: generation,
            level: level,
            exists: true,
            isEgg: false
        });

        emit PokemonMinted(newTokenId, to, name, rarity);

        return newTokenId;
    }

    // ============ Admin Functions ============

    /**
     * @dev Update mint price
     */
    function setMintPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
    }

    /**
     * @dev Update max supply (can only increase)
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxSupply >= _nextTokenId, "Cannot reduce below minted");
        uint256 oldSupply = maxSupply;
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(oldSupply, newMaxSupply);
    }

    /**
     * @dev Set base URI for IPFS metadata
     * @param newBaseURI The IPFS gateway URL (e.g., "https://ipfs.io/ipfs/CID/")
     */
    function setBaseURI(string memory newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory oldURI = _baseTokenURI;
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(oldURI, newBaseURI);
    }

    /**
     * @dev Get the current base URI
     */
    function getBaseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Emergency pause - stops all minting and transfers
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

    /**
     * @dev Withdraw contract balance (pull pattern for security)
     */
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert TransferFailed();
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawal(msg.sender, balance);
    }

    // ============ Required Overrides ============

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        whenNotPaused
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
