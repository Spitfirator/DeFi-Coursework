// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PokemonNFT is ERC721A, Ownable {
    struct Pokemon {
        string name;
        string ptype;
        uint8 rarity;
        uint32 level;
    }

    mapping(uint256 => Pokemon) public pokemonData;

    event PokemonMinted(uint256 indexed tokenId, address indexed to);

    constructor() ERC721A("Pokemon Cards", "PKMN") Ownable(msg.sender) {}

    function mintPokemon(
        address to,
        string calldata name,
        string calldata ptype,
        uint8 rarity,
        uint32 level
    ) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "Invalid recipient");
        require(rarity >= 1 && rarity <= 5, "Rarity 1..5");
        require(level >= 1 && level <= 100, "Level 1..100");

        tokenId = _nextTokenId();
        _safeMint(to, 1);

        pokemonData[tokenId] = Pokemon(name, ptype, rarity, level);
        emit PokemonMinted(tokenId, to);
    }
}
