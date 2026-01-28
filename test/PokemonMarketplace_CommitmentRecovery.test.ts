import { expect } from "chai";
import { ethers } from "hardhat";
import { PokemonNFT, PokemonMarketplace } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Pokemon Marketplace - Commitment Recovery", function () {
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

        await pokemonNFT.mintPokemon(seller.address, "Pikachu", "Electric", 1, 25);
        await pokemonNFT.connect(seller).approve(await marketplace.getAddress(), 0);
    });

    describe("Cancel Commitment", function () {
        it("Should allow canceling commitment and recover funds", async function () {
            const price = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), 0, price, nonce]
                )
            );

            // Commit
            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price });

            // Cancel commitment
            await expect(
                marketplace.connect(buyer).cancelCommitment(commitHash)
            ).to.emit(marketplace, "CommitmentCanceled")
                .withArgs(buyer.address, commitHash, price);

            // Funds should be in pending withdrawals
            expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(price);

            // Commitment should be deleted
            const commitment = await marketplace.commitments(buyer.address, commitHash);
            expect(commitment.amount).to.equal(0);
        });

        it("Should fail to cancel non-existent commitment", async function () {
            const fakeHash = ethers.randomBytes(32);

            await expect(
                marketplace.connect(buyer).cancelCommitment(fakeHash)
            ).to.be.revertedWithCustomError(marketplace, "NoCommitment");
        });

        it("Should allow canceling after commitment expires", async function () {
            const price = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), 0, price, nonce]
                )
            );

            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price });

            // Mine 256 blocks (exceeds MAX_COMMIT_AGE)
            for (let i = 0; i < 256; i++) {
                await ethers.provider.send("evm_mine", []);
            }

            // Should still be able to cancel and recover funds
            await marketplace.connect(buyer).cancelCommitment(commitHash);
            expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(price);
        });

        it("Should allow canceling if listing disappeared", async function () {
            const tokenId = 0;
            const price = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            // List NFT
            await marketplace.connect(seller).listFixedPrice(await pokemonNFT.getAddress(), tokenId, price);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), tokenId, price, nonce]
                )
            );

            // Commit
            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price });

            // Seller cancels listing
            await marketplace.connect(seller).cancelListing(await pokemonNFT.getAddress(), tokenId);

            // Buyer can recover funds
            await marketplace.connect(buyer).cancelCommitment(commitHash);
            expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(price);
        });
    });

    describe("Commitment Overwrite Protection", function () {
        it("Should refund previous commitment when overwriting", async function () {
            const price1 = ethers.parseEther("1.0");
            const price2 = ethers.parseEther("2.0");
            const nonce = ethers.randomBytes(32);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), 0, price1, nonce]
                )
            );

            // First commit
            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price1 });

            // Second commit with same hash (overwrite)
            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price2 });

            // First commitment should be refunded to pending withdrawals
            expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(price1);

            // New commitment should have the new amount
            const commitment = await marketplace.commitments(buyer.address, commitHash);
            expect(commitment.amount).to.equal(price2);
        });

        it("Should handle multiple overwrites correctly", async function () {
            const amounts = [
                ethers.parseEther("1.0"),
                ethers.parseEther("2.0"),
                ethers.parseEther("3.0")
            ];
            const nonce = ethers.randomBytes(32);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), 0, amounts[0], nonce]
                )
            );

            // First commit
            await marketplace.connect(buyer).commitToBuy(commitHash, { value: amounts[0] });

            // Second commit (refunds first)
            await marketplace.connect(buyer).commitToBuy(commitHash, { value: amounts[1] });
            expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(amounts[0]);

            // Third commit (refunds second)
            await marketplace.connect(buyer).commitToBuy(commitHash, { value: amounts[2] });
            expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(amounts[0] + amounts[1]);

            // Final commitment has third amount
            const commitment = await marketplace.commitments(buyer.address, commitHash);
            expect(commitment.amount).to.equal(amounts[2]);
        });
    });

    describe("Withdraw After Cancel", function () {
        it("Should allow withdrawing canceled commitment funds", async function () {
            const price = ethers.parseEther("1.0");
            const nonce = ethers.randomBytes(32);

            const commitHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "uint256", "bytes32"],
                    [await pokemonNFT.getAddress(), 0, price, nonce]
                )
            );

            await marketplace.connect(buyer).commitToBuy(commitHash, { value: price });
            await marketplace.connect(buyer).cancelCommitment(commitHash);

            const balanceBefore = await ethers.provider.getBalance(buyer.address);

            // Withdraw
            const tx = await marketplace.connect(buyer).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(buyer.address);

            // Should receive the committed amount minus gas
            expect(balanceAfter).to.equal(balanceBefore + price - gasUsed);
        });
    });
});
