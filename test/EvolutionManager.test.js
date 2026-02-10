const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("EvolutionManager", function () {
  const MINT_PRICE = ethers.parseEther("0.01");

  async function deployEvolutionFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const pokemonCard = await PokemonCard.deploy(10000, MINT_PRICE);

    const EvolutionManager = await ethers.getContractFactory("EvolutionManager");
    const evolution = await EvolutionManager.deploy(await pokemonCard.getAddress());

    // Grant TRAINER_ROLE to EvolutionManager and owner (for test setup)
    const TRAINER_ROLE = await pokemonCard.TRAINER_ROLE();
    await pokemonCard.grantRole(TRAINER_ROLE, await evolution.getAddress());
    await pokemonCard.grantRole(TRAINER_ROLE, owner.address);

    // Register evolution paths
    await evolution.registerEvolution(
      "Bulbasaur", "Venusaur", "Grass", "Rare",
      32, 30, 20, 20, 10
    );
    await evolution.registerEvolution(
      "Charmander", "Charizard", "Fire", "Rare",
      36, 28, 29, 18, 20
    );
    await evolution.registerEvolution(
      "Magikarp", "Gyarados", "Water", "Rare",
      20, 50, 45, 30, 25
    );

    // Set base token URI
    await evolution.setBaseTokenURI("https://ipfs.io/ipfs/test/");

    // Mint a Bulbasaur to user1 (tokenId 0)
    await pokemonCard.adminMint(
      user1.address, "ipfs://bulbasaur", "Bulbasaur", "Grass", "Common",
      45, 49, 49, 45, 1
    );

    return { pokemonCard, evolution, owner, user1, user2 };
  }

  describe("Evolution Path Registration", function () {
    it("Should register and retrieve an evolution path", async function () {
      const { evolution } = await loadFixture(deployEvolutionFixture);

      const path = await evolution.getEvolutionPath("Bulbasaur");
      expect(path.toName).to.equal("Venusaur");
      expect(path.toType).to.equal("Grass");
      expect(path.toRarity).to.equal("Rare");
      expect(path.levelThreshold).to.equal(32);
      expect(path.hpBoost).to.equal(30);
      expect(path.attackBoost).to.equal(20);
      expect(path.defenseBoost).to.equal(20);
      expect(path.speedBoost).to.equal(10);
      expect(path.exists).to.be.true;
    });

    it("Should reject registration by non-owner", async function () {
      const { evolution, user1 } = await loadFixture(deployEvolutionFixture);

      await expect(
        evolution.connect(user1).registerEvolution(
          "Pikachu", "Raichu", "Electric", "Uncommon",
          25, 20, 20, 15, 20
        )
      ).to.be.revertedWithCustomError(evolution, "OwnableUnauthorizedAccount");
    });

    it("Should reject registration with zero level threshold", async function () {
      const { evolution, owner } = await loadFixture(deployEvolutionFixture);

      await expect(
        evolution.connect(owner).registerEvolution(
          "Test", "Test2", "Fire", "Common",
          0, 10, 10, 10, 10
        )
      ).to.be.revertedWithCustomError(evolution, "InvalidEvolutionPath");
    });

    it("Should allow updating an existing path", async function () {
      const { evolution, owner } = await loadFixture(deployEvolutionFixture);

      // Update Bulbasaur path with new threshold
      await evolution.connect(owner).registerEvolution(
        "Bulbasaur", "Venusaur", "Grass", "Rare",
        16, 35, 25, 25, 15 // Lower threshold, higher boosts
      );

      const path = await evolution.getEvolutionPath("Bulbasaur");
      expect(path.levelThreshold).to.equal(16);
      expect(path.hpBoost).to.equal(35);
    });

    it("Should emit EvolutionPathRegistered event", async function () {
      const { evolution, owner } = await loadFixture(deployEvolutionFixture);

      await expect(
        evolution.connect(owner).registerEvolution(
          "Pikachu", "Raichu", "Electric", "Uncommon",
          25, 20, 20, 15, 20
        )
      ).to.emit(evolution, "EvolutionPathRegistered");
    });
  });

  describe("Successful Evolution", function () {
    it("Should evolve a Pokemon when level requirement is met", async function () {
      const { pokemonCard, evolution, owner, user1 } = await loadFixture(deployEvolutionFixture);

      // Level up the Bulbasaur to level 32
      await pokemonCard.connect(owner).updateStats(0, 32, 45, 49, 49);

      // Evolve
      const tx = await evolution.connect(user1).evolve(0);
      const receipt = await tx.wait();

      // Old token should be burned
      await expect(pokemonCard.ownerOf(0)).to.be.reverted;

      // New token (tokenId 1) should exist and belong to user1
      expect(await pokemonCard.ownerOf(1)).to.equal(user1.address);

      // Check evolved stats
      const stats = await pokemonCard.getPokemonStats(1);
      expect(stats.name).to.equal("Venusaur");
      expect(stats.pokemonType).to.equal("Grass");
      expect(stats.rarity).to.equal("Rare");
      expect(stats.level).to.equal(32); // Level preserved
      expect(stats.hp).to.equal(75); // 45 + 30
      expect(stats.attack).to.equal(69); // 49 + 20
      expect(stats.defense).to.equal(69); // 49 + 20
      expect(stats.speed).to.equal(55); // 45 + 10
    });

    it("Should emit PokemonEvolved event", async function () {
      const { pokemonCard, evolution, owner, user1 } = await loadFixture(deployEvolutionFixture);

      await pokemonCard.connect(owner).updateStats(0, 32, 45, 49, 49);

      await expect(evolution.connect(user1).evolve(0))
        .to.emit(evolution, "PokemonEvolved")
        .withArgs(0, 1, "Bulbasaur", "Venusaur", user1.address);
    });

    it("Should preserve generation through evolution", async function () {
      const { pokemonCard, evolution, owner, user1 } = await loadFixture(deployEvolutionFixture);

      await pokemonCard.connect(owner).updateStats(0, 32, 45, 49, 49);
      await evolution.connect(user1).evolve(0);

      const stats = await pokemonCard.getPokemonStats(1);
      expect(stats.generation).to.equal(1);
    });
  });

  describe("Evolution Rejection", function () {
    it("Should reject evolution when level is too low", async function () {
      const { evolution, user1 } = await loadFixture(deployEvolutionFixture);

      // Bulbasaur is level 1, needs 32
      await expect(
        evolution.connect(user1).evolve(0)
      ).to.be.revertedWithCustomError(evolution, "LevelTooLow")
        .withArgs(1, 32);
    });

    it("Should reject evolution for Pokemon with no path", async function () {
      const { pokemonCard, evolution, owner, user1 } = await loadFixture(deployEvolutionFixture);

      // Mint a Mewtwo (no evolution path)
      await pokemonCard.adminMint(
        user1.address, "ipfs://mewtwo", "Mewtwo", "Psychic", "Legendary",
        106, 110, 90, 130, 1
      );

      // Try to evolve Mewtwo (tokenId 1)
      await expect(
        evolution.connect(user1).evolve(1)
      ).to.be.revertedWithCustomError(evolution, "NoEvolutionPath");
    });

    it("Should reject evolution by non-owner", async function () {
      const { pokemonCard, evolution, owner, user2 } = await loadFixture(deployEvolutionFixture);

      // Level up Bulbasaur
      await pokemonCard.connect(owner).updateStats(0, 32, 45, 49, 49);

      // user2 tries to evolve user1's Pokemon
      await expect(
        evolution.connect(user2).evolve(0)
      ).to.be.revertedWithCustomError(evolution, "NotTokenOwner");
    });
  });

  describe("Stat Persistence", function () {
    it("Should carry over boosted stats from DayCare training", async function () {
      const { pokemonCard, evolution, owner, user1 } = await loadFixture(deployEvolutionFixture);

      // Simulate DayCare training: level 40, boosted stats
      await pokemonCard.connect(owner).updateStats(0, 40, 100, 80, 60);

      // Evolve
      await evolution.connect(user1).evolve(0);

      const stats = await pokemonCard.getPokemonStats(1);
      expect(stats.name).to.equal("Venusaur");
      expect(stats.level).to.equal(40); // Level preserved
      expect(stats.hp).to.equal(130); // 100 + 30
      expect(stats.attack).to.equal(100); // 80 + 20
      expect(stats.defense).to.equal(80); // 60 + 20
    });
  });

  describe("View Functions", function () {
    it("Should correctly check canEvolve", async function () {
      const { pokemonCard, evolution, owner, user1 } = await loadFixture(deployEvolutionFixture);

      // Level 1 - can't evolve
      expect(await evolution.canEvolve(0)).to.be.false;

      // Level up to 32
      await pokemonCard.connect(owner).updateStats(0, 32, 45, 49, 49);
      expect(await evolution.canEvolve(0)).to.be.true;
    });

    it("Should return correct evolution preview", async function () {
      const { pokemonCard, evolution, owner } = await loadFixture(deployEvolutionFixture);

      await pokemonCard.connect(owner).updateStats(0, 32, 45, 49, 49);

      const preview = await evolution.getEvolutionPreview(0);
      expect(preview.newName).to.equal("Venusaur");
      expect(preview.newType).to.equal("Grass");
      expect(preview.newRarity).to.equal("Rare");
      expect(preview.newHp).to.equal(75); // 45 + 30
      expect(preview.newAttack).to.equal(69); // 49 + 20
      expect(preview.newDefense).to.equal(69); // 49 + 20
      expect(preview.newSpeed).to.equal(55); // 45 + 10
      expect(preview.levelRequired).to.equal(32);
    });

    it("Should revert preview for Pokemon with no path", async function () {
      const { pokemonCard, evolution, owner, user1 } = await loadFixture(deployEvolutionFixture);

      await pokemonCard.adminMint(
        user1.address, "ipfs://mewtwo", "Mewtwo", "Psychic", "Legendary",
        106, 110, 90, 130, 1
      );

      await expect(
        evolution.getEvolutionPreview(1)
      ).to.be.revertedWithCustomError(evolution, "NoEvolutionPath");
    });
  });
});
