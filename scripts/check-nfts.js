const hre = require("hardhat");

async function main() {
    const [signer] = await hre.ethers.getSigners();

    const POKEMON_CARD_ADDRESS = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

    const PokemonCard = await hre.ethers.getContractAt("PokemonCard", POKEMON_CARD_ADDRESS);

    console.log("Checking NFT ownership for:", signer.address);

    const balance = await PokemonCard.balanceOf(signer.address);
    console.log("NFT Balance:", balance.toString());

    if (balance > 0) {
        console.log("\nYour NFTs:");
        for (let i = 0; i < balance; i++) {
            const tokenId = await PokemonCard.tokenOfOwnerByIndex(signer.address, i);
            const stats = await PokemonCard.getPokemonStats(tokenId);
            console.log(`  #${tokenId}: ${stats.name} (${stats.pokemonType}, ${stats.rarity})`);
        }
    }

    const totalMinted = await PokemonCard.totalMinted();
    console.log("\nTotal NFTs minted:", totalMinted.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
