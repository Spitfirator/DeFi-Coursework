const hre = require("hardhat");

async function main() {
    const pokemonCardAddress = process.env.REACT_APP_POKEMON_CARD_ADDRESS;

    if (!pokemonCardAddress) {
        console.error("PokemonCard contract address not found");
        return;
    }

    const pokemonCard = await hre.ethers.getContractAt("PokemonCard", pokemonCardAddress);

    try {
        const isPaused = await pokemonCard.paused();
        console.log("PokemonCard contract paused status:", isPaused);

        if (isPaused) {
            console.log("\n⚠️  POKEMONCARD CONTRACT IS PAUSED! This is why listings are failing.");
            console.log("NFTs cannot be transferred when the contract is paused.");
            console.log("\nTo unpause, run:");
            console.log("npx hardhat run scripts/unpause-pokemon-card.js --network localhost");
        } else {
            console.log("\n✅ PokemonCard contract is not paused.");
        }
    } catch (error) {
        console.error("Error checking pause status:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
