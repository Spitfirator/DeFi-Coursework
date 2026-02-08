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
        bool exists;
    }

    // ============ Mappings ============
    mapping(uint256 => PokemonStats) public pokemonStats;
    mapping(address => uint256) public pendingWithdrawals;

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
     * @dev Mint a new Pokemon card NFT
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
        if (to == address(0)) revert ZeroAddress();
        if (_nextTokenId >= maxSupply) revert MaxSupplyReached();
        if (msg.value < mintPrice && !hasRole(MINTER_ROLE, msg.sender)) {
            revert InsufficientPayment();
        }
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
            exists: true
        });

        emit PokemonMinted(tokenId, to, name, rarity);

        return tokenId;
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
            exists: true
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
