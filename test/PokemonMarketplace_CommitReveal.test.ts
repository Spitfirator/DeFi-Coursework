import { expect } from "chai";
import { ethers } from "hardhat";
import { PokemonNFT, PokemonMarketplace } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Pokemon Marketplace - Commit-Reveal Security", function () {
    let pokemonNFT: PokemonNFT;
    let marketplace: PokemonMarketplace;
    let owner: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    beforeEach(async function () {
        [owner, seller, buyer] = await ethers.getSigners();

        const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
        pokemonNFT = await PokemonNFT.deploy("https://example.com/");
        await pokemonNFT.waitForDeployment();

        const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
        marketplace = await PokemonMarketplace.deploy();
        await marketplace.waitForDeployment();

        // Mint a Common NFT for testing
        await pokemonNFT.mintPokemon(seller.address, "Pikachu", "Electric", 1, 25);
        const tokenId = 0;
        await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);
    });

    describe("Commit-Reveal for Fixed Price", function () {
        it("Should commit and reveal buy successfully", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            const maxPrice = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            // List NFT
            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            // Generate commitment hash
            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), tokenId, maxPrice, nonce]
                )
            );

            // Phase 1: Commit
            await expect(
                marketplace.connect(buyer).commitToBuy(commitHash, { value: price })
            ).to.emit(marketplace, "BuyCommitted")
                .withArgs(buyer.address, commitHash, price);

            // Mine a block to satisfy MIN_COMMIT_AGE
            await ethers.provider.send("evm_mine", []);

            // Phase 2: Reveal
            await expect(
                marketplace.connect(buyer).revealAndBuyFixedPrice(
                    await pokemonNFT.getAddress(),
                    tokenId,
                    maxPrice,
                    nonce
                )
            ).to.emit(marketplace, "BuyRevealed")
                .and.to.emit(marketplace, "ItemSold");

            // Verify NFT transferred
            expect(await pokemonNFT.ownerOf(tokenId)).to.equal(buyer.address);
        });

        it("Should fail if commitment doesn't exist", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            await expect(
                marketplace.connect(buyer).revealAndBuyFixedPrice(
                    await pokemonNFT.getAddress(),
                    tokenId,
                    price,
                    nonce
                )
            ).to.be.revertedWithCustomError(marketplace, "NoCommitment");
        });

        it("Should fail if commitment expired", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), tokenId, price, nonce]
                )
            );

            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price });

            // Mine 256 blocks (exceeds MAX_COMMIT_AGE)
            for (let i = 0; i < 256; i++) {
                await ethers.provider.send("evm_mine", []);
            }

            await expect(
                marketplace.connect(buyer).revealAndBuyFixedPrice(
                    await pokemonNFT.getAddress(),
                    tokenId,
                    price,
                    nonce
                )
            ).to.be.revertedWithCustomError(marketplace, "CommitmentExpired");
        });

        it("Should refund excess ETH using pull pattern", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            const maxPrice = ethers.parseEther("1.0");
            const overpayment = ethers.parseEther("1.5");
            const nonce = ethers.randomBytes(32);

            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), tokenId, maxPrice, nonce]
                )
            );

            await marketplace.connect(buyer).commitToBuy(commitHash, { value: overpayment });
            await ethers.provider.send("evm_mine", []);

            await marketplace.connect(buyer).revealAndBuyFixedPrice(
                await pokemonNFT.getAddress(),
                tokenId,
                maxPrice,
                nonce
            );

            // Check buyer has refund in pending withdrawals
            const refund = overpayment - price;
            expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(refund);
        });

        it("Should detect stale listings", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), tokenId, price, nonce]
                )
            );

            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price });
            await ethers.provider.send("evm_mine", []);

            // Seller transfers NFT away (making listing stale)
            await pokemonNFT.connect(seller).transferFrom(seller.address, owner.address, tokenId);

            await expect(
                marketplace.connect(buyer).revealAndBuyFixedPrice(
                    await pokemonNFT.getAddress(),
                    tokenId,
                    price,
                    nonce
                )
            ).to.be.revertedWithCustomError(marketplace, "StaleListing");
        });
    });

    describe("Commit-Reveal for Dutch Auction", function () {
        it("Should commit and reveal Dutch auction buy successfully", async function () {
            const tokenId = 0;
            const startPrice = ethers.parseEther("2.0");
            const endPrice = ethers.parseEther("1.0");
            const duration = 100;
            const maxPrice = ethers.parseEther("2.0");
            const nonce = ethers.randomBytes(32);

            // Mint a Rare NFT for Dutch auction
            await pokemonNFT.mintPokemon(seller.address, "Charizard", "Fire", 4, 50);
            const rareTokenId = 1;
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), rareTokenId);

            await marketplace.connect(seller).createDutchAuction(
                await pokemonNFT.getAddress(),
                rareTokenId,
                startPrice,
                endPrice,
                duration
            );

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), rareTokenId, maxPrice, nonce]
                )
            );

            await marketplace.connect(buyer).commitToBuy(commitHash, { value: maxPrice });
            await ethers.provider.send("evm_mine", []);

            await expect(
                marketplace.connect(buyer).revealAndBuyDutchAuction(
                    await pokemonNFT.getAddress(),
                    rareTokenId,
                    maxPrice,
                    nonce
                )
            ).to.emit(marketplace, "DutchAuctionBought");

            expect(await pokemonNFT.ownerOf(rareTokenId)).to.equal(buyer.address);
        });
    });

    describe("Cancel Functions", function () {
        it("Should allow seller to cancel listing", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");

            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            await expect(
                marketplace.connect(seller).cancelListing(await pokemonNFT.getAddress(), tokenId)
            ).to.emit(marketplace, "ItemCanceled");

            const listing = await marketplace.listings(await pokemonNFT.getAddress(), tokenId);
            expect(listing.price).to.equal(0);
        });

        it("Should allow seller to cancel auction with no bids", async function () {
            // Mint Legendary for auction
            await pokemonNFT.mintPokemon(seller.address, "Mewtwo", "Psychic", 5, 85);
            const tokenId = 1;
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

            const startingPrice = ethers.parseEther("1.0");
            const duration = 3600;

            await marketplace.connect(seller).startAuction(
                await pokemonNFT.getAddress(),
                tokenId,
                startingPrice,
                duration
            );

            await expect(
                marketplace.connect(seller).cancelAuction(await pokemonNFT.getAddress(), tokenId)
            ).to.emit(marketplace, "AuctionCanceled");
        });

        it("Should NOT allow canceling auction with active bids", async function () {
            await pokemonNFT.mintPokemon(seller.address, "Mewtwo", "Psychic", 5, 85);
            const tokenId = 1;
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

            await marketplace.connect(seller).startAuction(
                await pokemonNFT.getAddress(),
                tokenId,
                ethers.parseEther("1.0"),
                3600
            );

            await marketplace.connect(buyer).bid(await pokemonNFT.getAddress(), tokenId, {
                value: ethers.parseEther("1.5")
            });

            await expect(
                marketplace.connect(seller).cancelAuction(await pokemonNFT.getAddress(), tokenId)
            ).to.be.revertedWithCustomError(marketplace, "HasActiveBids");
        });

        it("Should allow seller to cancel Dutch auction", async function () {
            await pokemonNFT.mintPokemon(seller.address, "Charizard", "Fire", 4, 50);
            const tokenId = 1;
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

            await marketplace.connect(seller).createDutchAuction(
                await pokemonNFT.getAddress(),
                tokenId,
                ethers.parseEther("2.0"),
                ethers.parseEther("1.0"),
                100
            );

            await expect(
                marketplace.connect(seller).cancelDutchAuction(await pokemonNFT.getAddress(), tokenId)
            ).to.emit(marketplace, "DutchAuctionCanceled");
        });
    });

    describe("Dutch Auction Refund Fix", function () {
        it("Should refund excess using pull pattern (not transfer)", async function () {
            await pokemonNFT.mintPokemon(seller.address, "Charizard", "Fire", 4, 50);
            const tokenId = 1;
            await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);

            const startPrice = ethers.parseEther("2.0");
            const endPrice = ethers.parseEther("1.0");

            await marketplace.connect(seller).createDutchAuction(
                await pokemonNFT.getAddress(),
                tokenId,
                startPrice,
                endPrice,
                100
            );

            // Buy with overpayment
            await marketplace.connect(buyer).buyDutchAuction(
                await pokemonNFT.getAddress(),
                tokenId,
                { value: ethers.parseEther("2.5") }
            );

            // Excess should be in pending withdrawals
            const excess = await marketplace.pendingWithdrawals(buyer.address);
            expect(excess).to.be.gt(0);
        });
    });
});
