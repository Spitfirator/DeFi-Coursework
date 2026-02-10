import { expect } from "chai";
import { ethers } from "hardhat";
import { PokemonNFT, PokemonMarketplace } from "../typechain-types";

describe("Pokemon Marketplace - Fees and Pauses", function () {
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

        // Mint to seller (Pikachu - Common)
        await pokemonNFT.connect(owner).mintPokemon(seller.address, "Pikachu", "Electric", 1, 10);
        // Token 0

        // Mint to seller (Mewtwo - Legendary) for Auction tests
        await pokemonNFT.connect(owner).mintPokemon(seller.address, "Mewtwo", "Psychic", 5, 100);
        // Token 1
    });

    describe("Marketplace Fees", function () {
        it("Should deduct 1% fee on Fixed Price Sale", async function () {
            const tokenId = 0; // Pikachu (Common) - Fixed Price OK
            const price = ethers.parseEther("1.0"); // 1 ETH
            const fee = ethers.parseEther("0.01"); // 1% = 0.01 ETH
            const expectedSellerAmount = ethers.parseEther("0.99");

            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);
            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            await marketplace.connect(buyer).buyFixedPrice(await pokemonNFT.getAddress(), tokenId, { value: price });

            // Seller Pending Withdrawal should be 0.99
            expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(expectedSellerAmount);

            // Owner Pending Withdrawal (Fee) should be 0.01
            expect(await marketplace.pendingWithdrawals(owner.address)).to.equal(fee);
        });

        it("Should deduct 1% fee on Auction", async function () {
            const tokenId = 1; // Mewtwo (Legendary) - Auction OK
            const startPrice = ethers.parseEther("0.5");
            const bidAmount = ethers.parseEther("2.0");
            const fee = ethers.parseEther("0.02"); // 1% of 2.0 = 0.02

            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);
            await marketplace.connect(seller).startAuction(await pokemonNFT.getAddress(), tokenId, startPrice, 60);

            await marketplace.connect(buyer).bid(await pokemonNFT.getAddress(), tokenId, { value: bidAmount });

            // Time travel
            await ethers.provider.send("evm_increaseTime", [61]);
            await ethers.provider.send("evm_mine", []);

            await marketplace.connect(owner).endAuction(await pokemonNFT.getAddress(), tokenId);

            expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(ethers.parseEther("1.98")); // 2.0 - 0.02
            expect(await marketplace.pendingWithdrawals(owner.address)).to.equal(fee);
        });
    });

    describe("Emergency Pause", function () {
        it("Should allow owner to pause and unpause", async function () {
            await marketplace.connect(owner).pause();
            expect(await marketplace.paused()).to.be.true;

            await marketplace.connect(owner).unpause();
            expect(await marketplace.paused()).to.be.false;
        });

        it("Should revert actions when paused", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

            await marketplace.connect(owner).pause();

            // Try List
            await expect(
                marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price)
            ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");

            // Try Buy (Even if allowed to list before pause)
            // Note: We need to list first to test buy.
            await marketplace.connect(owner).unpause();
            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);
            await marketplace.connect(owner).pause();

            await expect(
                marketplace.connect(buyer).buyFixedPrice(await pokemonNFT.getAddress(), tokenId, { value: price })
            ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
        });
    });
});
