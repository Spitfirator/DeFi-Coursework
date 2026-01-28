// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PokemonNFT
 * @notice Enhanced ERC721A contract for Pokemon cards with comprehensive security features
 * @dev Implements reentrancy protection, pausable functionality, batch minting, and comprehensive metadata
 */
contract PokemonNFT is ERC721A, Ownable, ReentrancyGuard, Pausable {
    // Custom errors for gas efficiency
    error InvalidRecipient();
    error InvalidRarity();
    error InvalidLevel();
    error EmptyMetadata();


    struct Pokemon {
        string name;
        string ptype;
        uint8 rarity;
        uint32 level;
    }

    // Base URI for token metadata
    string private _baseTokenURI;
    
    // Mapping from token ID to Pokemon data
    mapping(uint256 => Pokemon) public pokemonData;

    // Events
    event PokemonMinted(
        uint256 indexed tokenId,
        address indexed to,
        string name,
        string ptype,
        uint8 rarity,
        uint32 level
    );
    
    event BatchMinted(
        address indexed to,
        uint256 startTokenId,
        uint256 quantity
    );
    
    event BaseURIUpdated(string newBaseURI);


    // Supply Constraints
    uint256 public constant MAX_SUPPLY = 100;
    uint256 public constant MAX_LEGENDARY = 5;
    uint256 public constant MAX_RARE = 25;

    uint256 public legendaryCount;
    uint256 public rareCount;

    error MaxSupplyExceeded();
    error MaxLegendarySupplyExceeded();
    error MaxRareSupplyExceeded();

    // ... (existing events)

    /**
     * @notice Constructor initializes the contract
     * @param baseURI_ Base URI for token metadata
     */
    constructor(string memory baseURI_) 
        ERC721A("Pokemon Cards", "PKMN")
        Ownable(msg.sender)
    {
        _baseTokenURI = baseURI_;
    }

    /**
     * @notice Mint a single Pokemon NFT
     * ...
     */
    function mintPokemon(
        address to,
        string calldata name,
        string calldata ptype,
        uint8 rarity,
        uint32 level
    ) 
        external 
        onlyOwner 
        whenNotPaused 
        nonReentrant 
        returns (uint256 tokenId) 
    {
        // Input validation
        if (to == address(0)) revert InvalidRecipient();
        if (bytes(name).length == 0 || bytes(ptype).length == 0) revert EmptyMetadata();
        if (rarity < 1 || rarity > 5) revert InvalidRarity();
        if (level < 1 || level > 100) revert InvalidLevel();

        // Check Total Supply
        if (_totalSupply() + 1 > MAX_SUPPLY) revert MaxSupplyExceeded();

        // Check Rarity & Level Constraints
        if (rarity == 5) {
            // Legendary
            if (legendaryCount + 1 > MAX_LEGENDARY) revert MaxLegendarySupplyExceeded();
            if (level < 80 || level > 100) revert InvalidLevel();
            legendaryCount++;
        } else if (rarity == 4) {
            // Rare
            if (rareCount + 1 > MAX_RARE) revert MaxRareSupplyExceeded();
            if (level < 40 || level > 79) revert InvalidLevel();
            rareCount++;
        } else {
            // Common (Rarity 1-3)
            if (level > 39) revert InvalidLevel();
            // Implicit common count tracking by total supply - legendary - rare
        }

        // Get next token ID before minting
        tokenId = _nextTokenId();
        
        // Mint the token
        _safeMint(to, 1);

        // Store Pokemon metadata
        pokemonData[tokenId] = Pokemon(name, ptype, rarity, level);
        
        // Emit comprehensive event
        emit PokemonMinted(tokenId, to, name, ptype, rarity, level);
    }

    /**
     * @notice Batch mint multiple Pokemon NFTs (ERC721A optimization)
     * ...
     */
    function batchMintPokemon(
        address to,
        Pokemon[] calldata pokemons
    ) 
        external 
        onlyOwner 
        whenNotPaused 
        nonReentrant 
        returns (uint256 startTokenId) 
    {
        if (to == address(0)) revert InvalidRecipient();
        uint256 quantity = pokemons.length;
        if (quantity == 0) revert EmptyMetadata();
        if (_totalSupply() + quantity > MAX_SUPPLY) revert MaxSupplyExceeded();

        // Validate all Pokemon data before minting
        uint256 newLegendaries = 0;
        uint256 newRares = 0;

        for (uint256 i = 0; i < quantity; i++) {
            if (bytes(pokemons[i].name).length == 0 || bytes(pokemons[i].ptype).length == 0) {
                revert EmptyMetadata();
            }
            if (pokemons[i].rarity < 1 || pokemons[i].rarity > 5) revert InvalidRarity();
            if (pokemons[i].level < 1 || pokemons[i].level > 100) revert InvalidLevel();

            if (pokemons[i].rarity == 5) {
                if (pokemons[i].level < 80 || pokemons[i].level > 100) revert InvalidLevel();
                newLegendaries++;
            } else if (pokemons[i].rarity == 4) {
                if (pokemons[i].level < 40 || pokemons[i].level > 79) revert InvalidLevel();
                newRares++;
            } else {
                if (pokemons[i].level > 39) revert InvalidLevel();
            }
        }

        if (newLegendaries > 0) {
            if (legendaryCount + newLegendaries > MAX_LEGENDARY) revert MaxLegendarySupplyExceeded();
            legendaryCount += newLegendaries;
        }
        if (newRares > 0) {
            if (rareCount + newRares > MAX_RARE) revert MaxRareSupplyExceeded();
            rareCount += newRares;
        }

        // Get starting token ID
        startTokenId = _nextTokenId();
        
        // Batch mint (ERC721A is optimized for this)
        _safeMint(to, quantity);

        // Store all Pokemon metadata
        for (uint256 i = 0; i < quantity; i++) {
            pokemonData[startTokenId + i] = pokemons[i];
            emit PokemonMinted(
                startTokenId + i,
                to,
                pokemons[i].name,
                pokemons[i].ptype,
                pokemons[i].rarity,
                pokemons[i].level
            );
        }

        emit BatchMinted(to, startTokenId, quantity);
    }
    
    // Internal helper for ERC721A total supply compatibility 
    // ERC721A already has totalSupply(), but we used _totalSupply() in our checks above for clarity or if customization needed.
    // Actually ERC721A 'totalSupply()' is public view. internal '_totalMinted()' is what we usually track for total usage, 
    // but checks against MAX_SUPPLY usually mean CURRENT supply. 
    // Since burn isn't implemented extensively, totalSupply() == minted.
    function _totalSupply() internal view returns (uint256) {
        return totalSupply();
    }

    /**
     * @notice Returns the token URI for a given token ID
     * @param tokenId The token ID to query
     * @return The token URI string
     */
    function tokenURI(uint256 tokenId) 
        public 
        view 
        virtual 
        override 
        returns (string memory) 
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 
            ? string(abi.encodePacked(baseURI, _toString(tokenId), ".json"))
            : "";
    }

    /**
     * @notice Returns the base URI for token metadata
     * @return The base URI string
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Set the base URI for token metadata (only owner)
     * @param baseURI_ New base URI
     */
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    /**
     * @notice Pause the contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Hook override to prevent token transfers while paused.
     * ERC721A provides _beforeTokenTransfers for transfer hooks.
     */
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }
}