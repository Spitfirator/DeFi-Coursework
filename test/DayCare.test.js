const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DayCare", function () {
  const MINT_PRICE = ethers.parseEther("0.01");
  const LEVEL_INTERVAL = 2; // 2 seconds per level

  async function deployDayCareFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const pokemonCard = await PokemonCard.deploy(10000, MINT_PRICE);

    const DayCare = await ethers.getContractFactory("DayCare");
    const dayCare = await DayCare.deploy(await pokemonCard.getAddress());

    // Grant TRAINER_ROLE to DayCare
    const TRAINER_ROLE = await pokemonCard.TRAINER_ROLE();
    await pokemonCard.grantRole(TRAINER_ROLE, await dayCare.getAddress());

    // Mint a Pokemon to user1 (tokenId 0)
    await pokemonCard.adminMint(
      user1.address, "ipfs://pikachu", "Pikachu", "Electric", "Rare",
      35, 55, 40, 90, 1
    );

    return { pokemonCard, dayCare, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the correct PokemonCard address", async function () {
      const { pokemonCard, dayCare } = await loadFixture(deployDayCareFixture);
      expect(await dayCare.pokemonCard()).to.equal(await pokemonCard.getAddress());
    });

    it("Should set the correct level interval", async function () {
      const { dayCare } = await loadFixture(deployDayCareFixture);
      expect(await dayCare.levelInterval()).to.equal(LEVEL_INTERVAL);
    });
  });

  describe("Staking", function () {
    it("Should stake a Pokemon successfully", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      // Approve DayCare
      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);

      // Stake
      await dayCare.connect(user1).stake(0);

      // Token should be owned by DayCare
      expect(await pokemonCard.ownerOf(0)).to.equal(await dayCare.getAddress());

      // Stake info should be recorded
      const info = await dayCare.getStakeInfo(0);
      expect(info.owner).to.equal(user1.address);

      // Should show as staked
      expect(await dayCare.isStaked(0)).to.be.true;
    });

    it("Should reject staking if not token owner", async function () {
      const { pokemonCard, dayCare, user2 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user2).setApprovalForAll(await dayCare.getAddress(), true);

      await expect(
        dayCare.connect(user2).stake(0)
      ).to.be.revertedWithCustomError(dayCare, "NotTokenOwner");
    });

    it("Should reject staking an already staked token", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      await expect(
        dayCare.connect(user1).stake(0)
      ).to.be.revertedWithCustomError(dayCare, "NotTokenOwner");
    });

    it("Should emit PokemonStaked event", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);

      await expect(dayCare.connect(user1).stake(0))
        .to.emit(dayCare, "PokemonStaked")
        .withArgs(0, user1.address, await time.latest() + 1);
    });

    it("Should track staked tokens for an owner", async function () {
      const { pokemonCard, dayCare, owner, user1 } = await loadFixture(deployDayCareFixture);

      // Mint a second Pokemon
      await pokemonCard.adminMint(
        user1.address, "ipfs://charmander", "Charmander", "Fire", "Common",
        39, 52, 43, 65, 1
      );

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);
      await dayCare.connect(user1).stake(1);

      const stakedTokens = await dayCare.getStakedTokens(user1.address);
      expect(stakedTokens.length).to.equal(2);
      expect(stakedTokens[0]).to.equal(0);
      expect(stakedTokens[1]).to.equal(1);
    });
  });

  describe("Unstaking with Level Gains", function () {
    it("Should gain 0 levels if unstaked immediately", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      // Unstake immediately (same block)
      await dayCare.connect(user1).unstake(0);

      const stats = await pokemonCard.getPokemonStats(0);
      expect(stats.level).to.equal(1); // Still level 1
      expect(stats.hp).to.equal(35); // Unchanged
    });

    it("Should gain 1 level after LEVEL_INTERVAL seconds", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      // Advance time by 1 level interval
      await time.increase(LEVEL_INTERVAL);

      await dayCare.connect(user1).unstake(0);

      const stats = await pokemonCard.getPokemonStats(0);
      expect(stats.level).to.equal(2); // 1 + 1
      expect(stats.hp).to.equal(40); // 35 + 5
      expect(stats.attack).to.equal(60); // 55 + 5
      expect(stats.defense).to.equal(45); // 40 + 5
    });

    it("Should gain 5 levels after 5 intervals", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      // Advance time by 5 level intervals
      await time.increase(LEVEL_INTERVAL * 5);

      await dayCare.connect(user1).unstake(0);

      const stats = await pokemonCard.getPokemonStats(0);
      expect(stats.level).to.equal(6); // 1 + 5
      expect(stats.hp).to.equal(60); // 35 + (5 * 5)
      expect(stats.attack).to.equal(80); // 55 + (5 * 5)
      expect(stats.defense).to.equal(65); // 40 + (5 * 5)
    });

    it("Should return token to original owner", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      await dayCare.connect(user1).unstake(0);

      expect(await pokemonCard.ownerOf(0)).to.equal(user1.address);
      expect(await dayCare.isStaked(0)).to.be.false;
    });

    it("Should emit PokemonUnstaked event with correct data", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      await time.increase(LEVEL_INTERVAL * 3);

      await expect(dayCare.connect(user1).unstake(0))
        .to.emit(dayCare, "PokemonUnstaked")
        .withArgs(0, user1.address, 4, 3); // newLevel=4, levelsGained=3
    });
  });

  describe("Max Level Cap", function () {
    it("Should cap level at MAX_LEVEL (100)", async function () {
      const { pokemonCard, dayCare, owner, user1 } = await loadFixture(deployDayCareFixture);

      // First, set the Pokemon to level 95 by granting TRAINER_ROLE to owner
      const TRAINER_ROLE = await pokemonCard.TRAINER_ROLE();
      await pokemonCard.grantRole(TRAINER_ROLE, owner.address);
      await pokemonCard.connect(owner).updateStats(0, 95, 35, 55, 40);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      // Advance time for 10 levels (but should cap at 100, so only 5 gained)
      await time.increase(LEVEL_INTERVAL * 10);

      await dayCare.connect(user1).unstake(0);

      const stats = await pokemonCard.getPokemonStats(0);
      expect(stats.level).to.equal(100); // Capped at 100
      expect(stats.hp).to.equal(60); // 35 + (5 * 5) -- only 5 levels gained, not 10
      expect(stats.attack).to.equal(80); // 55 + (5 * 5)
      expect(stats.defense).to.equal(65); // 40 + (5 * 5)
    });

    it("Should report correct pending levels when near cap", async function () {
      const { pokemonCard, dayCare, owner, user1 } = await loadFixture(deployDayCareFixture);

      const TRAINER_ROLE = await pokemonCard.TRAINER_ROLE();
      await pokemonCard.grantRole(TRAINER_ROLE, owner.address);
      await pokemonCard.connect(owner).updateStats(0, 98, 35, 55, 40);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      // Advance time for 5 levels (but only 2 possible)
      await time.increase(LEVEL_INTERVAL * 5);

      const pending = await dayCare.getPendingLevels(0);
      expect(pending).to.equal(2); // 100 - 98 = 2
    });
  });

  describe("Ownership Checks", function () {
    it("Should reject unstake by non-staker", async function () {
      const { pokemonCard, dayCare, user1, user2 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      await expect(
        dayCare.connect(user2).unstake(0)
      ).to.be.revertedWithCustomError(dayCare, "TokenNotStaked");
    });

    it("Should reject unstake for non-staked token", async function () {
      const { dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await expect(
        dayCare.connect(user1).unstake(0)
      ).to.be.revertedWithCustomError(dayCare, "TokenNotStaked");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update level interval", async function () {
      const { dayCare, owner } = await loadFixture(deployDayCareFixture);

      await expect(dayCare.connect(owner).setLevelInterval(120))
        .to.emit(dayCare, "LevelIntervalUpdated")
        .withArgs(2, 120);

      expect(await dayCare.levelInterval()).to.equal(120);
    });

    it("Should reject zero interval", async function () {
      const { dayCare, owner } = await loadFixture(deployDayCareFixture);

      await expect(
        dayCare.connect(owner).setLevelInterval(0)
      ).to.be.revertedWithCustomError(dayCare, "InvalidInterval");
    });

    it("Should reject non-owner setting interval", async function () {
      const { dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await expect(
        dayCare.connect(user1).setLevelInterval(120)
      ).to.be.revertedWithCustomError(dayCare, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should return 0 pending levels for non-staked token", async function () {
      const { dayCare } = await loadFixture(deployDayCareFixture);
      expect(await dayCare.getPendingLevels(0)).to.equal(0);
    });

    it("Should return empty array for user with no staked tokens", async function () {
      const { dayCare, user2 } = await loadFixture(deployDayCareFixture);
      const tokens = await dayCare.getStakedTokens(user2.address);
      expect(tokens.length).to.equal(0);
    });

    it("Should remove token from staked list after unstake", async function () {
      const { pokemonCard, dayCare, user1 } = await loadFixture(deployDayCareFixture);

      await pokemonCard.connect(user1).setApprovalForAll(await dayCare.getAddress(), true);
      await dayCare.connect(user1).stake(0);

      expect((await dayCare.getStakedTokens(user1.address)).length).to.equal(1);

      await dayCare.connect(user1).unstake(0);

      expect((await dayCare.getStakedTokens(user1.address)).length).to.equal(0);
    });
  });
});
