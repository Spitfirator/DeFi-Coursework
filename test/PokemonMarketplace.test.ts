import { expect } from "chai";
import { ethers } from "hardhat";
import { PokemonNFT, PokemonMarketplace } from "../typechain-types";

describe("Pokemon Marketplace", function () {
    let pokemonNFT: PokemonNFT;
    let marketplace: PokemonMarketplace;
    let owner: any;
    let seller: any;
    let buyer: any;
    let bidder1: any;
    let bidder2: any;

    beforeEach(async function () {
        [owner, seller, buyer, bidder1, bidder2] = await ethers.getSigners();

        // Deploy NFT
        const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
        pokemonNFT = await PokemonNFT.deploy("https://api.pokemon.com/metadata/"); // Fixed: Removed .deployed() in Ethers v6

        // Deploy Marketplace
        const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
        marketplace = await PokemonMarketplace.deploy();

        // Mint a Pokemon to seller (Common)
        await pokemonNFT.connect(owner).mintPokemon(
            seller.address,
            "Pikachu",
            "Electric",
            1, // Rarity 1 (Common)
            10
        );
        // Token ID 0

        // Mint a Pokemon to seller (Legendary) for Auctions
        await pokemonNFT.connect(owner).mintPokemon(
            seller.address,
            "Mewtwo",
            "Psychic",
            5, // Rarity 5 (Legendary)
            100
        );
        // Token ID 1
    });

    describe("Fixed Price Listing", function () {
        it("Should allow listing and buying", async function () {
            const tokenId = 0; // Common
            const price = ethers.parseEther("1.0");

            // Approve marketplace
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

            // List
            await expect(marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price))
                .to.emit(marketplace, "ItemListed")
                .withArgs(await pokemonNFT.getAddress(), tokenId, seller.address, price);

            // Buy
            await expect(marketplace.connect(buyer).buyFixedPrice(await pokemonNFT.getAddress(), tokenId, { value: price }))
                .to.emit(marketplace, "ItemSold")
                .withArgs(await pokemonNFT.getAddress(), tokenId, seller.address, buyer.address, price);

            // Verify ownership
            expect(await pokemonNFT.ownerOf(tokenId)).to.equal(buyer.address);

            // Verify funds pending
            // fee = price * 1%
            const fee = (price * 100n) / 10000n;
            expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(price - fee);
        });
    });

    describe("Auctions", function () {
        it("Should handle auctions correctly", async function () {
            const tokenId = 1; // Legendary
            const startPrice = ethers.parseEther("0.1");
            const duration = 120; // 2 minutes

            // Approve marketplace
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

            // Start Auction
            await marketplace.connect(seller).startAuction(await pokemonNFT.getAddress(), tokenId, startPrice, duration);

            // Bidder 1
            const bid1 = ethers.parseEther("0.2");
            await marketplace.connect(bidder1).bid(await pokemonNFT.getAddress(), tokenId, { value: bid1 });

            // Bidder 2
            const bid2 = ethers.parseEther("0.5");
            await marketplace.connect(bidder2).bid(await pokemonNFT.getAddress(), tokenId, { value: bid2 });

            // Verify Bidder 1 refund (pending withdrawal) - REFUNDS are full, no fee
            expect(await marketplace.pendingWithdrawals(bidder1.address)).to.equal(bid1);

            // Time travel
            await ethers.provider.send("evm_increaseTime", [121]);
            await ethers.provider.send("evm_mine", []);

            // End Auction
            const fee = (bid2 * 100n) / 10000n;
            await expect(marketplace.connect(owner).endAuction(await pokemonNFT.getAddress(), tokenId))
                .to.emit(marketplace, "AuctionEnded")
                .withArgs(await pokemonNFT.getAddress(), tokenId, bidder2.address, bid2);

            // Verify Ownership
            expect(await pokemonNFT.ownerOf(tokenId)).to.equal(bidder2.address);

            // Verify Seller funds (bid2 - fee)
            expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(bid2 - fee);
        });
    });

    describe("Withdrawals", function () {
        it("Should allow withdrawal of funds", async function () {
            const amount = ethers.parseEther("1.0");
            // Simulate funds directly (hacky but easier for unit test setup via mapping manipulation?? No, use legitimate flow)

            // Use listing flow to get funds
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);
            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);
            await marketplace.connect(buyer).buyFixedPrice(await pokemonNFT.getAddress(), tokenId, { value: price });

            // Seller withdraws
            const initialBalance = await ethers.provider.getBalance(seller.address);

            const tx = await marketplace.connect(seller).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const finalBalance = await ethers.provider.getBalance(seller.address);

            // Balance should increase by price - gas
            expect(finalBalance).to.closeTo(initialBalance + price - gasUsed, ethers.parseEther("0.01")); // small diff
        });
    });
});
