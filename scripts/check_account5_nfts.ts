import { ethers } from "hardhat";

async function main() {
    const nft = await ethers.getContractAt("PokemonNFT", "0x9A676e781A523b5d0C0e43731313A708CB607508");
    const marketplace = await ethers.getContractAt("PokemonMarketplace", "0x0B306BF915C4d645ff596e518fAf3F9669b97016");

    // Check if any of Account #5's NFTs are listed
    const account5 = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
    const tokenIds = [64, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99];

    console.log("Checking listing status for Account #5's NFTs:\n");
    let listedCount = 0;

    for (const id of tokenIds) {
        const listing = await marketplace.listings(nft.target, id);
        const auction = await marketplace.auctions(nft.target, id);
        const dutch = await marketplace.dutchAuctions(nft.target, id);

        if (listing.price > 0n || auction.active || dutch.active) {
            console.log(`❌ Token #${id}: LISTED (price: ${listing.price}, auction: ${auction.active}, dutch: ${dutch.active})`);
            listedCount++;
        }
    }

    if (listedCount === 0) {
        console.log("✅ All 17 NFTs are UNLISTED (as expected)");
    } else {
        console.log(`\n⚠️  Found ${listedCount} listed NFTs (should be 0)`);
    }
}

main().catch(console.error);
