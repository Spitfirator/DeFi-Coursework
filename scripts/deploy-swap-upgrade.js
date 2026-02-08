const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// EXISTING PokemonCard contract address (from .env.local)
const EXISTING_POKEMON_CARD_ADDRESS = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

async function main() {
    console.log("🔄 Upgrading PokemonTrading Contract with Swap Feature...\\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
    console.log();

    console.log("📦 Deploying NEW PokemonTrading with Swap support...");
    console.log("  Using existing PokemonCard at:", EXISTING_POKEMON_CARD_ADDRESS);
    console.log();

    const platformFee = 250; // 2.5%

    const PokemonTrading = await hre.ethers.getContractFactory("PokemonTrading");
    const trading = await PokemonTrading.deploy(EXISTING_POKEMON_CARD_ADDRESS, platformFee);
    await trading.waitForDeployment();

    const tradingAddress = await trading.getAddress();

    console.log("=".repeat(60));
    console.log("🎉 Deployment Complete!");
    console.log("=".repeat(60));
    console.log();
    console.log("📋 Contract Addresses:");
    console.log("  PokemonCard (UNCHANGED):", EXISTING_POKEMON_CARD_ADDRESS);
    console.log("  PokemonTrading (NEW):", tradingAddress);
    console.log();
    console.log("✅ Swap Feature Enabled!");
    console.log("  - createSwapRequest()");
    console.log("  - executeSwap()");
    console.log("  - cancelSwapRequest()");
    console.log("  - getSwapRequests()");
    console.log();
    console.log("⚠️  IMPORTANT NEXT STEPS:");
    console.log("  1. Update frontend .env with new trading address");
    console.log("  2. Users must APPROVE the new trading contract for their NFTs");
    console.log("  3. Re-list any items from the old marketplace");
    console.log();

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        pokemonCard: {
            address: EXISTING_POKEMON_CARD_ADDRESS,
            status: "UNCHANGED (existing NFTs preserved)"
        },
        trading: {
            address: tradingAddress,
            platformFee: platformFee,
            newFeatures: ["Swap Requests", "NFT-for-NFT Trading"]
        },
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        "deployment-upgrade.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("💾 Deployment info saved to deployment-upgrade.json");

    // Update frontend .env
    const envPath = path.join(__dirname, "../frontend/.env");
    const envContent = `REACT_APP_POKEMON_CARD_ADDRESS=${EXISTING_POKEMON_CARD_ADDRESS}
REACT_APP_TRADING_ADDRESS=${tradingAddress}
`;

    fs.writeFileSync(envPath, envContent);
    console.log("✅ Frontend .env automatically updated!");
    console.log();
    console.log("📝 Manual Update Required:");
    console.log(`  Update pokemon-marketplace-frontend/.env.local:`);
    console.log(`  NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${tradingAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
