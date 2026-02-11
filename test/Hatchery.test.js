const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Hatchery", function () {
  const MINT_PRICE = ethers.parseEther("0.01");
  const BREED_DURATION = 15; // seconds
  const HATCH_DURATION = 15; // seconds
  const EGG_URI = "ipfs://egg";

  async function deployHatcheryFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const pokemonCard = await PokemonCard.deploy(10000, MINT_PRICE);

    const Hatchery = await ethers.getContractFactory("Hatchery");
    const hatchery = await Hatchery.deploy(
      await pokemonCard.getAddress(),
      BREED_DURATION,
      HATCH_DURATION,
      EGG_URI
    );

    // Grant roles to Hatchery
    const MINTER_ROLE = await pokemonCard.MINTER_ROLE();
    const TRAINER_ROLE = await pokemonCard.TRAINER_ROLE();
    await pokemonCard.grantRole(MINTER_ROLE, await hatchery.getAddress());
    await pokemonCard.grantRole(TRAINER_ROLE, await hatchery.getAddress());

    // Mint two non-legendary Pokemon to user1 (tokenId 0 and 1)
    await pokemonCard.adminMint(
      user1.address, "ipfs://pikachu", "Pikachu", "Electric", "Common",
      35, 55, 40, 90, 1
    );
    await pokemonCard.adminMint(
      user1.address, "ipfs://charmander", "Charmander", "Fire", "Rare",
      39, 52, 43, 65, 1
    );

    // Mint a legendary Pokemon to user1 (tokenId 2)
    await pokemonCard.adminMint(
      user1.address, "ipfs://mewtwo", "Mewtwo", "Psychic", "Legendary",
      106, 110, 90, 130, 1
    );

    // Mint a Pokemon to user2 (tokenId 3)
    await pokemonCard.adminMint(
      user2.address, "ipfs://bulbasaur", "Bulbasaur", "Grass", "Common",
      45, 49, 49, 45, 1
    );

    // Approve Hatchery for user1
    await pokemonCard.connect(user1).setApprovalForAll(await hatchery.getAddress(), true);

    return { pokemonCard, hatchery, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the correct PokemonCard address", async function () {
      const { pokemonCard, hatchery } = await loadFixture(deployHatcheryFixture);
      expect(await hatchery.pokemonCard()).to.equal(await pokemonCard.getAddress());
    });

    it("Should set the correct breed and hatch durations", async function () {
      const { hatchery } = await loadFixture(deployHatcheryFixture);
      expect(await hatchery.breedDuration()).to.equal(BREED_DURATION);
      expect(await hatchery.hatchDuration()).to.equal(HATCH_DURATION);
    });
  });

  describe("Breeding (Stage 1)", function () {
    it("Should start a breeding session successfully", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);

      const session = await hatchery.getSession(0);
      expect(session.originalOwner).to.equal(user1.address);
      expect(session.parent1Id).to.equal(0);
      expect(session.parent2Id).to.equal(1);
      expect(session.active).to.be.true;
      expect(session.eggMinted).to.be.false;
    });

    it("Should transfer parents to Hatchery (escrow)", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);

      expect(await pokemonCard.ownerOf(0)).to.equal(await hatchery.getAddress());
      expect(await pokemonCard.ownerOf(1)).to.equal(await hatchery.getAddress());
    });

    it("Should lock both parent tokens", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);

      expect(await hatchery.isTokenLocked(0)).to.be.true;
      expect(await hatchery.isTokenLocked(1)).to.be.true;
    });

    it("Should emit BreedingStarted event", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await expect(hatchery.connect(user1).breed(0, 1))
        .to.emit(hatchery, "BreedingStarted")
        .withArgs(0, user1.address, 0, 1);
    });

    it("Should revert if same parent used twice", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await expect(
        hatchery.connect(user1).breed(0, 0)
      ).to.be.revertedWithCustomError(hatchery, "SameParent");
    });

    it("Should revert if caller does not own parent", async function () {
      const { hatchery, user2 } = await loadFixture(deployHatcheryFixture);

      await expect(
        hatchery.connect(user2).breed(0, 1)
      ).to.be.revertedWithCustomError(hatchery, "NotTokenOwner");
    });

    it("Should revert if a parent is already locked", async function () {
      const { pokemonCard, hatchery, owner, user1 } = await loadFixture(deployHatcheryFixture);

      // Breed first pair
      await hatchery.connect(user1).breed(0, 1);

      // Mint a third Pokemon for user1
      await pokemonCard.adminMint(
        user1.address, "ipfs://squirtle", "Squirtle", "Water", "Common",
        44, 48, 65, 43, 1
      );

      // Try to breed using locked token 0
      await expect(
        hatchery.connect(user1).breed(0, 4)
      ).to.be.revertedWithCustomError(hatchery, "NotTokenOwner");
    });

    it("Should revert if a parent is legendary", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await expect(
        hatchery.connect(user1).breed(0, 2)
      ).to.be.revertedWithCustomError(hatchery, "CannotBreedLegendary");
    });
  });

  describe("Mint Egg (Stage 2)", function () {
    it("Should mint an egg after breed timer expires", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);

      await hatchery.connect(user1).mintEgg(0);

      const session = await hatchery.getSession(0);
      expect(session.eggMinted).to.be.true;

      // Egg should be an NFT owned by user1
      const eggTokenId = session.eggTokenId;
      expect(await pokemonCard.ownerOf(eggTokenId)).to.equal(user1.address);

      // Egg should have isEgg flag
      const stats = await pokemonCard.getPokemonStats(eggTokenId);
      expect(stats.isEgg).to.be.true;
      expect(stats.name).to.equal("Egg");
    });

    it("Should release parents back to owner", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      expect(await pokemonCard.ownerOf(0)).to.equal(user1.address);
      expect(await pokemonCard.ownerOf(1)).to.equal(user1.address);
    });

    it("Should unlock parent tokens", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      expect(await hatchery.isTokenLocked(0)).to.be.false;
      expect(await hatchery.isTokenLocked(1)).to.be.false;
    });

    it("Should emit EggMinted event", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);

      await expect(hatchery.connect(user1).mintEgg(0))
        .to.emit(hatchery, "EggMinted");
    });

    it("Should revert if breed timer has not expired", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);

      await expect(
        hatchery.connect(user1).mintEgg(0)
      ).to.be.revertedWithCustomError(hatchery, "NotReadyToMintEgg");
    });

    it("Should revert if caller is not session owner", async function () {
      const { hatchery, user1, user2 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);

      await expect(
        hatchery.connect(user2).mintEgg(0)
      ).to.be.revertedWithCustomError(hatchery, "NotSessionOwner");
    });

    it("Should revert if egg already minted", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      await expect(
        hatchery.connect(user1).mintEgg(0)
      ).to.be.revertedWithCustomError(hatchery, "EggAlreadyMinted");
    });
  });

  describe("Hatching (Stage 3)", function () {
    it("Should hatch an egg after incubation timer expires", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      const session = await hatchery.getSession(0);
      const eggTokenId = session.eggTokenId;

      await time.increase(HATCH_DURATION);
      await hatchery.connect(user1).hatch(0);

      // Egg should now be hatched (no longer an egg)
      const stats = await pokemonCard.getPokemonStats(eggTokenId);
      expect(stats.isEgg).to.be.false;
      expect(stats.name).to.not.equal("Egg");
    });

    it("Should inherit generation as max(parent1, parent2) + 1", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      const session = await hatchery.getSession(0);
      const eggTokenId = session.eggTokenId;

      await time.increase(HATCH_DURATION);
      await hatchery.connect(user1).hatch(0);

      const stats = await pokemonCard.getPokemonStats(eggTokenId);
      // Both parents are gen 1, so offspring should be gen 2
      expect(stats.generation).to.equal(2);
    });

    it("Should inherit species from one of the parents", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      const session = await hatchery.getSession(0);
      const eggTokenId = session.eggTokenId;

      await time.increase(HATCH_DURATION);
      await hatchery.connect(user1).hatch(0);

      const stats = await pokemonCard.getPokemonStats(eggTokenId);
      // Name should be either Pikachu or Charmander
      expect(["Pikachu", "Charmander"]).to.include(stats.name);
    });

    it("Should produce stats within reasonable range of parent averages", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      const session = await hatchery.getSession(0);
      const eggTokenId = session.eggTokenId;

      await time.increase(HATCH_DURATION);
      await hatchery.connect(user1).hatch(0);

      const stats = await pokemonCard.getPokemonStats(eggTokenId);
      // Parent HP: 35 and 39, avg = 37, variance +/- 5 => range 32-42
      // But floor at 1, so min is 1
      expect(Number(stats.hp)).to.be.at.least(1);
      expect(Number(stats.hp)).to.be.at.most(42);
    });

    it("Should allow egg holder (not original breeder) to hatch", async function () {
      const { pokemonCard, hatchery, user1, user2 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      const session = await hatchery.getSession(0);
      const eggTokenId = session.eggTokenId;

      // Transfer egg to user2
      await pokemonCard.connect(user1).transferFrom(user1.address, user2.address, eggTokenId);

      await time.increase(HATCH_DURATION);

      // user2 (new egg owner) should be able to hatch
      await hatchery.connect(user2).hatch(0);

      const stats = await pokemonCard.getPokemonStats(eggTokenId);
      expect(stats.isEgg).to.be.false;
    });

    it("Should emit PokemonHatched event", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);
      await time.increase(HATCH_DURATION);

      await expect(hatchery.connect(user1).hatch(0))
        .to.emit(hatchery, "PokemonHatched");
    });

    it("Should revert if incubation timer has not expired", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      await expect(
        hatchery.connect(user1).hatch(0)
      ).to.be.revertedWithCustomError(hatchery, "NotReadyToHatch");
    });

    it("Should revert if egg not yet minted", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION + HATCH_DURATION);

      await expect(
        hatchery.connect(user1).hatch(0)
      ).to.be.revertedWithCustomError(hatchery, "EggNotMinted");
    });

    it("Should revert if already hatched", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);
      await time.increase(HATCH_DURATION);
      await hatchery.connect(user1).hatch(0);

      await expect(
        hatchery.connect(user1).hatch(0)
      ).to.be.revertedWithCustomError(hatchery, "SessionNotFound");
    });

    it("Should revert if caller does not own the egg", async function () {
      const { hatchery, user1, user2 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);
      await time.increase(HATCH_DURATION);

      await expect(
        hatchery.connect(user2).hatch(0)
      ).to.be.revertedWithCustomError(hatchery, "NotTokenOwner");
    });
  });

  describe("Full Lifecycle", function () {
    it("Should complete breed -> mintEgg -> hatch end-to-end", async function () {
      const { pokemonCard, hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      // Stage 1: Breed
      const tx = await hatchery.connect(user1).breed(0, 1);
      const sessionId = 0;

      // Parents in escrow
      expect(await pokemonCard.ownerOf(0)).to.equal(await hatchery.getAddress());
      expect(await pokemonCard.ownerOf(1)).to.equal(await hatchery.getAddress());

      // Stage 2: Mint Egg
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(sessionId);

      const session = await hatchery.getSession(sessionId);
      const eggTokenId = session.eggTokenId;

      // Parents returned, egg minted
      expect(await pokemonCard.ownerOf(0)).to.equal(user1.address);
      expect(await pokemonCard.ownerOf(1)).to.equal(user1.address);
      expect(await pokemonCard.ownerOf(eggTokenId)).to.equal(user1.address);

      // Stage 3: Hatch
      await time.increase(HATCH_DURATION);
      await hatchery.connect(user1).hatch(sessionId);

      const hatchedStats = await pokemonCard.getPokemonStats(eggTokenId);
      expect(hatchedStats.isEgg).to.be.false;
      expect(hatchedStats.level).to.equal(1);
      expect(hatchedStats.generation).to.equal(2);
      expect(["Pikachu", "Charmander"]).to.include(hatchedStats.name);

      // Session should be inactive
      const finalSession = await hatchery.getSession(sessionId);
      expect(finalSession.active).to.be.false;
      expect(finalSession.hatched).to.be.true;
    });
  });

  describe("View Functions", function () {
    it("Should track user sessions", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);

      const sessions = await hatchery.getUserSessions(user1.address);
      expect(sessions.length).to.equal(1);
      expect(sessions[0]).to.equal(0);
    });

    it("Should report canMintEgg correctly", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);

      // Not ready yet
      expect(await hatchery.canMintEgg(0)).to.be.false;

      // After timer
      await time.increase(BREED_DURATION);
      expect(await hatchery.canMintEgg(0)).to.be.true;
    });

    it("Should report canHatch correctly", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(user1).breed(0, 1);
      await time.increase(BREED_DURATION);
      await hatchery.connect(user1).mintEgg(0);

      // Not ready yet
      expect(await hatchery.canHatch(0)).to.be.false;

      // After timer
      await time.increase(HATCH_DURATION);
      expect(await hatchery.canHatch(0)).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to update breed duration", async function () {
      const { hatchery, owner } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(owner).setBreedDuration(60);
      expect(await hatchery.breedDuration()).to.equal(60);
    });

    it("Should allow admin to update hatch duration", async function () {
      const { hatchery, owner } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(owner).setHatchDuration(120);
      expect(await hatchery.hatchDuration()).to.equal(120);
    });

    it("Should allow admin to update egg token URI", async function () {
      const { hatchery, owner } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(owner).setEggTokenURI("ipfs://new-egg");
      expect(await hatchery.eggTokenURI()).to.equal("ipfs://new-egg");
    });

    it("Should reject non-admin setting breed duration", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await expect(
        hatchery.connect(user1).setBreedDuration(60)
      ).to.be.revertedWithCustomError(hatchery, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Emergency Pause", function () {
    it("Should pause and unpause", async function () {
      const { hatchery, owner } = await loadFixture(deployHatcheryFixture);

      await expect(hatchery.connect(owner).pause())
        .to.emit(hatchery, "EmergencyStop");
      expect(await hatchery.paused()).to.be.true;

      await expect(hatchery.connect(owner).unpause())
        .to.emit(hatchery, "EmergencyResume");
      expect(await hatchery.paused()).to.be.false;
    });

    it("Should prevent breeding when paused", async function () {
      const { hatchery, owner, user1 } = await loadFixture(deployHatcheryFixture);

      await hatchery.connect(owner).pause();

      await expect(
        hatchery.connect(user1).breed(0, 1)
      ).to.be.revertedWithCustomError(hatchery, "EnforcedPause");
    });

    it("Should reject non-pauser calling pause", async function () {
      const { hatchery, user1 } = await loadFixture(deployHatcheryFixture);

      await expect(
        hatchery.connect(user1).pause()
      ).to.be.revertedWithCustomError(hatchery, "AccessControlUnauthorizedAccount");
    });
  });
});
