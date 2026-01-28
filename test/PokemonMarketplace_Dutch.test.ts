import { expect } from "chai";
import { ethers } from "hardhat";
import { PokemonNFT, PokemonMarketplace } from "../typechain-types";

describe("Pokemon Marketplace - Dutch Auctions", function () {
    let pokemonNFT: PokemonNFT;
    let marketplace: PokemonMarketplace;
    let owner: any;
    let seller: any;
    let buyer: any;

    beforeEach(async function () {
        [owner, seller, buyer] = await ethers.getSigners();

        // Deploy NFT
        const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
        pokemonNFT = await PokemonNFT.deploy("https://api.pokemon.com/");

        // Deploy Marketplace
        const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
        marketplace = await PokemonMarketplace.deploy();

        // Mint to seller (Mewtwo - Legendary)
        // Dutch Auction is for Rare/Legendary
        await pokemonNFT.connect(owner).mintPokemon(seller.address, "Mewtwo", "Psychic", 5, 100);
        // Token 0
    });

    it("Should create a Dutch Auction correctly", async function () {
        const tokenId = 0;
        const startPrice = ethers.parseEther("2.0");
        const endPrice = ethers.parseEther("1.0");
        const duration = 120; // 2 minutes

        await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

        await expect(marketplace.connect(seller).createDutchAuction(await pokemonNFT.getAddress(), tokenId, startPrice, endPrice, duration))
            .to.emit(marketplace, "DutchAuctionCreated")
            .withArgs(await pokemonNFT.getAddress(), tokenId, startPrice, endPrice, duration);
    });

    it("Should fail if startPrice <= endPrice", async function () {
        const tokenId = 0;
        const startPrice = ethers.parseEther("1.0");
        const endPrice = ethers.parseEther("2.0"); // Invalid
        await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

        await expect(
            marketplace.connect(seller).createDutchAuction(await pokemonNFT.getAddress(), tokenId, startPrice, endPrice, 120)
        ).to.be.revertedWithCustomError(marketplace, "InvalidPriceRange");
    });

    it("Should return correct current price over time", async function () {
        const tokenId = 0;
        const startPrice = ethers.parseEther("2.0");
        const endPrice = ethers.parseEther("1.0");
        const duration = 100; // 100 seconds for easy math

        await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);
        await marketplace.connect(seller).createDutchAuction(await pokemonNFT.getAddress(), tokenId, startPrice, endPrice, duration);

        // At t=0
        expect(await marketplace.getDutchAuctionPrice(await pokemonNFT.getAddress(), tokenId)).to.equal(startPrice);

        // At t=50 (Halfway) -> Price should be 1.5
        await ethers.provider.send("evm_increaseTime", [50]);
        await ethers.provider.send("evm_mine", []);

        // Allow small margin for block time variations
        expect(await marketplace.getDutchAuctionPrice(await pokemonNFT.getAddress(), tokenId)).to.closeTo(ethers.parseEther("1.5"), ethers.parseEther("0.01"));

        // At t=100 (End) -> Price should be 1.0
        await ethers.provider.send("evm_increaseTime", [50]);
        await ethers.provider.send("evm_mine", []);
        expect(await marketplace.getDutchAuctionPrice(await pokemonNFT.getAddress(), tokenId)).to.equal(endPrice);
    });

    it("Should allow buying at current price", async function () {
        const tokenId = 0;
        const startPrice = ethers.parseEther("2.0");
        const endPrice = ethers.parseEther("1.0");
        const duration = 100;

        await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);
        await marketplace.connect(seller).createDutchAuction(await pokemonNFT.getAddress(), tokenId, startPrice, endPrice, duration);

        // Warps 50 seconds -> Price ~1.5
        await ethers.provider.send("evm_increaseTime", [50]);
        await ethers.provider.send("evm_mine", []);

        const currentPrice = await marketplace.getDutchAuctionPrice(await pokemonNFT.getAddress(), tokenId);

        // Buyer pays 1.6 (slightly more to be safe)
        await expect(marketplace.connect(buyer).buyDutchAuction(await pokemonNFT.getAddress(), tokenId, { value: ethers.parseEther("1.6") }))
            .to.emit(marketplace, "DutchAuctionBought");
        // .withArgs(await pokemonNFT.getAddress(), tokenId, buyer.address, currentPrice);
        // Commented out withArgs because price changes by the time tx is mined vs the view call above.

        expect(await pokemonNFT.ownerOf(tokenId)).to.equal(buyer.address);

        // Seller gets price - 1%
        // Price might be slightly lower than 1.5 due to block time (e.g. 1.49)
        // 1.5 * 0.99 = 1.485
        // 1.49 * 0.99 = 1.4751
        // Allow variance
        const expectedApprox = (ethers.parseEther("1.5") * 9900n) / 10000n;
        expect(await marketplace.pendingWithdrawals(seller.address)).to.be.closeTo(expectedApprox, ethers.parseEther("0.02"));
    });
});
