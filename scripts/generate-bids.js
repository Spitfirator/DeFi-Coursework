const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🎯 Placing test bids to generate trending activity...\n");

    const POKEMON_CARD_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const TRADING_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

    const pokemonCard = await ethers.getContractAt("PokemonCard", POKEMON_CARD_ADDRESS);
    const trading = await ethers.getContractAt("PokemonTrading", TRADING_ADDRESS);

    const signers = await ethers.getSigners();
    const bidders = signers.slice(0, 10);

    // Get all active auctions
    console.log("📋 Finding active auctions...\n");

    const auctionCreatedFilter = trading.filters.AuctionCreated();
    const auctionEvents = await trading.queryFilter(auctionCreatedFilter);

    const activeAuctions = [];
    for (const event of auctionEvents) {
        const tokenId = Number(event.args.tokenId);
        const auction = await trading.getAuction(tokenId);

        if (auction.isActive && auction.endTime > Math.floor(Date.now() / 1000)) {
            activeAuctions.push({
                tokenId,
                startingPrice: auction.startingPrice,
                seller: auction.seller
            });
        }
    }

    console.log(`Found ${activeAuctions.length} active auctions\n`);

    if (activeAuctions.length === 0) {
        console.log("⚠️  No active auctions found. Run setup-marketplace.js first!");
        return;
    }

    console.log("📋 Placing bids to create trending activity...\n");

    // Place multiple bids on different auctions to create varied activity
    const bidPatterns = [
        { auctionIndex: 0, bidCount: 5 },  // 5 bids on first auction
        { auctionIndex: 1, bidCount: 3 },  // 3 bids on second
        { auctionIndex: 2, bidCount: 7 },  // 7 bids on third (most active!)
        { auctionIndex: 3, bidCount: 2 },  // 2 bids on fourth
        { auctionIndex: 4, bidCount: 4 },  // 4 bids on fifth
    ];

    for (const pattern of bidPatterns) {
        if (pattern.auctionIndex >= activeAuctions.length) continue;

        const auction = activeAuctions[pattern.auctionIndex];
        const stats = await pokemonCard.getPokemonStats(auction.tokenId);

        console.log(`  Bidding on #${auction.tokenId} (${stats.name}):`);

        let currentBid = auction.startingPrice;

        for (let i = 0; i < pattern.bidCount; i++) {
            // Use different bidders
            const bidder = bidders[(pattern.auctionIndex + i) % bidders.length];

            // Skip if bidder is the seller
            if (bidder.address.toLowerCase() === auction.seller.toLowerCase()) {
                continue;
            }

            const tradingContract = trading.connect(bidder);

            // Increase bid by 10% each time
            currentBid = currentBid + (currentBid / 10n);

            try {
                const tx = await tradingContract.placeBid(auction.tokenId, {
                    value: currentBid
                });
                await tx.wait();
                console.log(`    ✅ Bid ${i + 1}: ${ethers.formatEther(currentBid)} ETH (${bidder.address.slice(0, 8)}...)`);
            } catch (err) {
                console.log(`    ⚠️  Bid ${i + 1} failed: ${err.message.split('\n')[0]}`);
            }
        }
        console.log();
    }

    console.log("============================================================");
    console.log("🎉 Bid Activity Generated!");
    console.log("============================================================\n");
    console.log("🔄 Refresh your browser to see trending items!");
    console.log("   Items with most bids should appear first in 'Trending Now'.\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
