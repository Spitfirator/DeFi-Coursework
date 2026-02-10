import { ethers } from "hardhat";

async function main() {
    console.log("⚡ Starting Visual Demo for Pokemon NFT Marketplace ⚡\n");

    // 1. Setup Accounts
    const [owner, seller, buyer, bidder1, bidder2] = await ethers.getSigners();
    console.log(`📡 Accounts initialized:`);
    console.log(`   Owner:  ${owner.address}`);
    console.log(`   Seller: ${seller.address}`);
    console.log(`   Buyer:  ${buyer.address}`);
    console.log(`   Bidder1: ${bidder1.address}`);
    console.log(`   Bidder2: ${bidder2.address}\n`);

    // 2. Deploy Contracts
    console.log("🛠  Deploying Contracts...");
    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    const nft = await PokemonNFT.deploy("https://pokemon-api.com/meta/");
    await nft.waitForDeployment();
    console.log(`   ✅ PokemonNFT deployed to: ${await nft.getAddress()}`);

    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const marketplace = await PokemonMarketplace.deploy();
    await marketplace.waitForDeployment();
    console.log(`   ✅ PokemonMarketplace deployed to: ${await marketplace.getAddress()}\n`);

    // 3. Mint NFTs
    console.log("🎨 Minting NFTs...");

    // Mint Pikachu (Common) to Seller
    console.log("   Minting 'Pikachu' (Common) to Seller...");
    await nft.connect(owner).mintPokemon(seller.address, "Pikachu", "Electric", 1, 10);
    console.log("   ✅ Minted Token #0 to Seller");

    // Mint Mewtwo (Legendary) to Seller
    console.log("   Minting 'Mewtwo' (Legendary) to Seller...");
    await nft.connect(owner).mintPokemon(seller.address, "Mewtwo", "Psychic", 5, 99);
    console.log("   ✅ Minted Token #1 to Seller");

    // Mint Charizard (Rare) to Bidder1 (just for fun)
    console.log("   Minting 'Charizard' (Rare) to Bidder1...");
    await nft.connect(owner).mintPokemon(bidder1.address, "Charizard", "Fire", 4, 50);
    console.log("   ✅ Minted Token #2 to Bidder1\n");

    // 4. Fixed Price Flow
    console.log("💰 [SCENARIO 1] Fixed Price Sale (Pikachu)");
    const pikachuId = 0;
    const price = ethers.parseEther("1.0");

    console.log("   Seller approving Marketplace...");
    await nft.connect(seller).approve(await marketplace.getAddress(), pikachuId);

    console.log(`   Seller listing Token #${pikachuId} for 1.0 ETH...`);
    await marketplace.connect(seller).listFixedPrice(await nft.getAddress(), pikachuId, price);
    console.log("   ✅ Listed");

    console.log("   Buyer buying Token #0...");
    await marketplace.connect(buyer).buyFixedPrice(await nft.getAddress(), pikachuId, { value: price });
    console.log("   ✅ Bought!");

    const newOwner = await nft.ownerOf(pikachuId);
    console.log(`   🔍 New Owner of Token #0: ${newOwner} (Expected: ${buyer.address})\n`);

    // 5. Auction Flow
    console.log("🔨 [SCENARIO 2] Auction (Mewtwo)");
    const mewtwoId = 1;
    const startPrice = ethers.parseEther("2.0");
    const duration = 65; // 65 seconds (must be > 60)

    console.log("   Seller approving Marketplace...");
    await nft.connect(seller).approve(await marketplace.getAddress(), mewtwoId);

    console.log(`   Seller starting auction for Token #${mewtwoId} (Start: 2.0 ETH, 65s)...`);
    await marketplace.connect(seller).startAuction(await nft.getAddress(), mewtwoId, startPrice, duration);
    console.log("   ✅ Auction Started");

    console.log("   Bidder1 bids 2.5 ETH...");
    await marketplace.connect(bidder1).bid(await nft.getAddress(), mewtwoId, { value: ethers.parseEther("2.5") });
    console.log("   ✅ Bid Accepted");

    console.log("   Bidder2 bids 3.0 ETH (Outbidding Bidder1)...");
    await marketplace.connect(bidder2).bid(await nft.getAddress(), mewtwoId, { value: ethers.parseEther("3.0") });
    console.log("   ✅ Bid Accepted");

    // Check pending refund
    const pendingRefund = await marketplace.pendingWithdrawals(bidder1.address);
    console.log(`   🔍 Bidder1 Pending Refund: ${ethers.formatEther(pendingRefund)} ETH (Expected: 2.5)`);

    console.log("   ⏳ Warping Time (70s)...");
    // Time Travel
    await ethers.provider.send("evm_increaseTime", [70]);
    await ethers.provider.send("evm_mine", []);

    console.log("   Ending Auction...");
    await marketplace.connect(owner).endAuction(await nft.getAddress(), mewtwoId); // Anyone can call endAuction
    console.log("   ✅ Auction Ended");

    const winner = await nft.ownerOf(mewtwoId);
    console.log(`   🏆 Winner (New Owner): ${winner} (Expected: ${bidder2.address})`);

    const sellerFunds = await marketplace.pendingWithdrawals(seller.address);
    console.log(`   💰 Seller Pending Funds: ${ethers.formatEther(sellerFunds)} ETH (Expected from Pikachu + Mewtwo)\n`);

    console.log("✅ Visual Demo Complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
