const hre = require("hardhat");

async function main() {
    const tradingAddress = process.env.REACT_APP_TRADING_ADDRESS;

    if (!tradingAddress) {
        console.error("Trading contract address not found in .env");
        return;
    }

    const trading = await hre.ethers.getContractAt("PokemonTrading", tradingAddress);

    try {
        const isPaused = await trading.paused();
        console.log("Trading contract paused status:", isPaused);

        if (isPaused) {
            console.log("\n⚠️  CONTRACT IS PAUSED! This is why listings are failing.");
            console.log("To unpause, run: npx hardhat run scripts/unpause-contract.js --network localhost");
        } else {
            console.log("\n✅ Contract is not paused.");
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
