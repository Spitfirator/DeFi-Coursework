const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Setting up marketplace with sample listings...\n");

    // Get contract addresses from deployment
    const POKEMON_CARD_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const TRADING_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

    // Get contracts
    const pokemonCard = await ethers.getContractAt("PokemonCard", POKEMON_CARD_ADDRESS);
    const trading = await ethers.getContractAt("PokemonTrading", TRADING_ADDRESS);

    // Get signers (10 accounts)
    const signers = await ethers.getSigners();
    const accounts = signers.slice(0, 10);

    console.log("📋 Step 1: Approving trading contract for all accounts...\n");

    // Approve trading contract for all accounts
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const nftContract = pokemonCard.connect(account);
        const tx = await nftContract.setApprovalForAll(TRADING_ADDRESS, true);
        await tx.wait();
        console.log(`  ✅ Account ${i} (${account.address.slice(0, 8)}...) approved`);
    }

    console.log("\n📋 Step 2: Discovering owned tokens and creating listings...\n");

    // Discover which tokens each account owns
    const accountTokens = [];
    for (let i = 0; i < accounts.length; i++) {
        const balance = await pokemonCard.balanceOf(accounts[i].address);
        const tokens = [];
        for (let j = 0; j < Number(balance); j++) {
            const tokenId = await pokemonCard.tokenOfOwnerByIndex(accounts[i].address, j);
            tokens.push(Number(tokenId));
        }
        accountTokens.push(tokens);
        console.log(`  Account ${i}: owns ${tokens.length} tokens`);
    }

    console.log("\n📋 Step 3: Creating fixed-price listings...\n");

    // Create 8 fixed price listings from different accounts
    const prices = ["2.5", "1.8", "1.5", "0.8", "0.5", "1.2", "0.9", "0.6"];
    let listingCount = 0;

    for (let i = 0; i < accounts.length && listingCount < 8; i++) {
        if (accountTokens[i].length > 0) {
            const tokenId = accountTokens[i][0]; // Use first token from this account
            const price = prices[listingCount];
            const account = accounts[i];
            const tradingContract = trading.connect(account);
            const priceWei = ethers.parseEther(price);

            try {
                const tx = await tradingContract.listCard(tokenId, priceWei);
                await tx.wait();
                const stats = await pokemonCard.getPokemonStats(tokenId);
                console.log(`  ✅ Listed #${tokenId}: ${stats.name} for ${price} ETH (Account ${i})`);
                listingCount++;
                accountTokens[i].shift(); // Remove used token
            } catch (err) {
                console.log(`  ⚠️  Failed to list #${tokenId}: ${err.message}`);
            }
        }
    }

    console.log("\n📋 Step 4: Creating auctions with different end times...\n");

    // Create 7 auctions (ending at different times for "ending soon" feature)
    const auctionDurations = [
        { duration: 3600, label: "1h" },      // 1 hour
        { duration: 7200, label: "2h" },      // 2 hours
        { duration: 14400, label: "4h" },     // 4 hours
        { duration: 21600, label: "6h" },     // 6 hours
        { duration: 43200, label: "12h" },    // 12 hours
        { duration: 86400, label: "24h" },    // 24 hours
        { duration: 172800, label: "48h" },   // 48 hours
    ];

    let auctionCount = 0;

    for (let i = 0; i < accounts.length && auctionCount < 7; i++) {
        if (accountTokens[i].length > 0) {
            const tokenId = accountTokens[i][0]; // Use first remaining token
            const { duration, label } = auctionDurations[auctionCount];
            const startPrice = (1.0 + Math.random() * 1.5).toFixed(2); // Random 1.0-2.5 ETH
            const reservePrice = (parseFloat(startPrice) + 0.5).toFixed(2);

            const account = accounts[i];
            const tradingContract = trading.connect(account);
            const startPriceWei = ethers.parseEther(startPrice);
            const reservePriceWei = ethers.parseEther(reservePrice);

            try {
                const tx = await tradingContract.createAuction(
                    tokenId,
                    startPriceWei,
                    reservePriceWei,
                    duration
                );
                await tx.wait();
                const stats = await pokemonCard.getPokemonStats(tokenId);
                console.log(`  ✅ Auction #${tokenId}: ${stats.name} (${startPrice} ETH, ends in ${label})`);
                auctionCount++;
                accountTokens[i].shift(); // Remove used token
            } catch (err) {
                console.log(`  ⚠️  Failed to create auction #${tokenId}: ${err.message}`);
            }
        }
    }


    console.log("\n============================================================");
    console.log("🎉 Marketplace Setup Complete!");
    console.log("============================================================\n");
    console.log("📊 Summary:");
    console.log(`  - ${listingCount} Fixed Price Listings`);
    console.log(`  - ${auctionCount} Auctions (ending at different times)`);
    console.log("\n🔄 Refresh your browser to see the listings!");
    console.log("   Home page 'Trending Now' should now show items.\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
