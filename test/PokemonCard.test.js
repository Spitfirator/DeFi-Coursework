const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PokemonCard", function () {
  const MAX_SUPPLY = 10000;
  const MINT_PRICE = ethers.parseEther("0.01");

  async function deployPokemonCardFixture() {
    const [owner, minter, user1, user2] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const pokemonCard = await PokemonCard.deploy(MAX_SUPPLY, MINT_PRICE);

    return { pokemonCard, owner, minter, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { pokemonCard } = await loadFixture(deployPokemonCardFixture);
      expect(await pokemonCard.name()).to.equal("PokemonCard");
      expect(await pokemonCard.symbol()).to.equal("PKMN");
    });

    it("Should set the correct max supply", async function () {
      const { pokemonCard } = await loadFixture(deployPokemonCardFixture);
      expect(await pokemonCard.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("Should set the correct mint price", async function () {
      const { pokemonCard } = await loadFixture(deployPokemonCardFixture);
      expect(await pokemonCard.mintPrice()).to.equal(MINT_PRICE);
    });

    it("Should grant admin roles to deployer", async function () {
      const { pokemonCard, owner } = await loadFixture(deployPokemonCardFixture);
      const DEFAULT_ADMIN_ROLE = await pokemonCard.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await pokemonCard.MINTER_ROLE();
      const PAUSER_ROLE = await pokemonCard.PAUSER_ROLE();

      expect(await pokemonCard.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await pokemonCard.hasRole(MINTER_ROLE, owner.address)).to.be.true;
      expect(await pokemonCard.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    const pokemonData = {
      uri: "ipfs://QmTest123",
      name: "Pikachu",
      pokemonType: "Electric",
      rarity: "Rare",
      hp: 35,
      attack: 55,
      defense: 40,
      speed: 90,
      generation: 1
    };

    it("Should mint a Pokemon card with correct metadata", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);

      await pokemonCard.connect(owner).adminMint(
        user1.address,
        pokemonData.uri,
        pokemonData.name,
        pokemonData.pokemonType,
        pokemonData.rarity,
        pokemonData.hp,
        pokemonData.attack,
        pokemonData.defense,
        pokemonData.speed,
        pokemonData.generation
      );

      expect(await pokemonCard.ownerOf(0)).to.equal(user1.address);
      
      const stats = await pokemonCard.getPokemonStats(0);
      expect(stats.name).to.equal(pokemonData.name);
      expect(stats.pokemonType).to.equal(pokemonData.pokemonType);
      expect(stats.rarity).to.equal(pokemonData.rarity);
      expect(stats.hp).to.equal(pokemonData.hp);
    });

    it("Should allow public minting with payment", async function () {
      const { pokemonCard, user1 } = await loadFixture(deployPokemonCardFixture);

      await pokemonCard.connect(user1).mintPokemon(
        user1.address,
        pokemonData.uri,
        pokemonData.name,
        pokemonData.pokemonType,
        pokemonData.rarity,
        pokemonData.hp,
        pokemonData.attack,
        pokemonData.defense,
        pokemonData.speed,
        pokemonData.generation,
        { value: MINT_PRICE }
      );

      expect(await pokemonCard.ownerOf(0)).to.equal(user1.address);
    });

    it("Should revert minting with insufficient payment", async function () {
      const { pokemonCard, user1 } = await loadFixture(deployPokemonCardFixture);

      await expect(
        pokemonCard.connect(user1).mintPokemon(
          user1.address,
          pokemonData.uri,
          pokemonData.name,
          pokemonData.pokemonType,
          pokemonData.rarity,
          pokemonData.hp,
          pokemonData.attack,
          pokemonData.defense,
          pokemonData.speed,
          pokemonData.generation,
          { value: ethers.parseEther("0.001") }
        )
      ).to.be.revertedWithCustomError(pokemonCard, "InsufficientPayment");
    });

    it("Should revert minting to zero address", async function () {
      const { pokemonCard, owner } = await loadFixture(deployPokemonCardFixture);

      await expect(
        pokemonCard.connect(owner).adminMint(
          ethers.ZeroAddress,
          pokemonData.uri,
          pokemonData.name,
          pokemonData.pokemonType,
          pokemonData.rarity,
          pokemonData.hp,
          pokemonData.attack,
          pokemonData.defense,
          pokemonData.speed,
          pokemonData.generation
        )
      ).to.be.revertedWithCustomError(pokemonCard, "ZeroAddress");
    });

    it("Should revert minting with invalid stats", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);

      await expect(
        pokemonCard.connect(owner).adminMint(
          user1.address,
          pokemonData.uri,
          pokemonData.name,
          pokemonData.pokemonType,
          pokemonData.rarity,
          0, // Invalid HP
          pokemonData.attack,
          pokemonData.defense,
          pokemonData.speed,
          pokemonData.generation
        )
      ).to.be.revertedWithCustomError(pokemonCard, "InvalidStats");
    });

    it("Should emit PokemonMinted event", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);

      await expect(
        pokemonCard.connect(owner).adminMint(
          user1.address,
          pokemonData.uri,
          pokemonData.name,
          pokemonData.pokemonType,
          pokemonData.rarity,
          pokemonData.hp,
          pokemonData.attack,
          pokemonData.defense,
          pokemonData.speed,
          pokemonData.generation
        )
      )
        .to.emit(pokemonCard, "PokemonMinted")
        .withArgs(0, user1.address, pokemonData.name, pokemonData.rarity);
    });

    it("Should track total minted correctly", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);

      expect(await pokemonCard.totalMinted()).to.equal(0);

      await pokemonCard.connect(owner).adminMint(
        user1.address,
        pokemonData.uri,
        pokemonData.name,
        pokemonData.pokemonType,
        pokemonData.rarity,
        pokemonData.hp,
        pokemonData.attack,
        pokemonData.defense,
        pokemonData.speed,
        pokemonData.generation
      );

      expect(await pokemonCard.totalMinted()).to.equal(1);
    });
  });

  describe("Access Control", function () {
    it("Should prevent non-minters from admin minting", async function () {
      const { pokemonCard, user1 } = await loadFixture(deployPokemonCardFixture);

      await expect(
        pokemonCard.connect(user1).adminMint(
          user1.address,
          "uri",
          "Test",
          "Fire",
          "Common",
          100,
          50,
          50,
          50,
          1
        )
      ).to.be.reverted;
    });

    it("Should allow admin to grant minter role", async function () {
      const { pokemonCard, owner, minter } = await loadFixture(deployPokemonCardFixture);
      const MINTER_ROLE = await pokemonCard.MINTER_ROLE();

      await pokemonCard.connect(owner).grantRole(MINTER_ROLE, minter.address);
      expect(await pokemonCard.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });
  });

  describe("Emergency Stop (Pausable)", function () {
    it("Should pause and unpause correctly", async function () {
      const { pokemonCard, owner } = await loadFixture(deployPokemonCardFixture);

      await pokemonCard.connect(owner).pause();
      expect(await pokemonCard.paused()).to.be.true;

      await pokemonCard.connect(owner).unpause();
      expect(await pokemonCard.paused()).to.be.false;
    });

    it("Should prevent minting when paused", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);

      await pokemonCard.connect(owner).pause();

      await expect(
        pokemonCard.connect(user1).mintPokemon(
          user1.address,
          "uri",
          "Test",
          "Fire",
          "Common",
          100,
          50,
          50,
          50,
          1,
          { value: MINT_PRICE }
        )
      ).to.be.revertedWithCustomError(pokemonCard, "EnforcedPause");
    });

    it("Should emit EmergencyStop event", async function () {
      const { pokemonCard, owner } = await loadFixture(deployPokemonCardFixture);

      await expect(pokemonCard.connect(owner).pause())
        .to.emit(pokemonCard, "EmergencyStop")
        .withArgs(owner.address);
    });
  });

  describe("Admin Functions", function () {
    it("Should update mint price", async function () {
      const { pokemonCard, owner } = await loadFixture(deployPokemonCardFixture);
      const newPrice = ethers.parseEther("0.02");

      await expect(pokemonCard.connect(owner).setMintPrice(newPrice))
        .to.emit(pokemonCard, "MintPriceUpdated")
        .withArgs(MINT_PRICE, newPrice);

      expect(await pokemonCard.mintPrice()).to.equal(newPrice);
    });

    it("Should update max supply", async function () {
      const { pokemonCard, owner } = await loadFixture(deployPokemonCardFixture);
      const newSupply = 20000;

      await expect(pokemonCard.connect(owner).setMaxSupply(newSupply))
        .to.emit(pokemonCard, "MaxSupplyUpdated")
        .withArgs(MAX_SUPPLY, newSupply);

      expect(await pokemonCard.maxSupply()).to.equal(newSupply);
    });

    it("Should allow admin to withdraw", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);

      // Mint to add funds to contract
      await pokemonCard.connect(user1).mintPokemon(
        user1.address,
        "uri",
        "Test",
        "Fire",
        "Common",
        100,
        50,
        50,
        50,
        1,
        { value: MINT_PRICE }
      );

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await pokemonCard.connect(owner).withdraw();
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Token URI", function () {
    it("Should return correct token URI", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);
      const uri = "ipfs://QmTestURI";

      await pokemonCard.connect(owner).adminMint(
        user1.address,
        uri,
        "Pikachu",
        "Electric",
        "Rare",
        35,
        55,
        40,
        90,
        1
      );

      expect(await pokemonCard.tokenURI(0)).to.equal(uri);
    });
  });

  describe("Enumerable", function () {
    it("Should enumerate tokens correctly", async function () {
      const { pokemonCard, owner, user1 } = await loadFixture(deployPokemonCardFixture);

      // Mint 3 tokens
      for (let i = 0; i < 3; i++) {
        await pokemonCard.connect(owner).adminMint(
          user1.address,
          `uri${i}`,
          `Pokemon${i}`,
          "Fire",
          "Common",
          100,
          50,
          50,
          50,
          1
        );
      }

      expect(await pokemonCard.balanceOf(user1.address)).to.equal(3);
      expect(await pokemonCard.tokenOfOwnerByIndex(user1.address, 0)).to.equal(0);
      expect(await pokemonCard.tokenOfOwnerByIndex(user1.address, 1)).to.equal(1);
      expect(await pokemonCard.tokenOfOwnerByIndex(user1.address, 2)).to.equal(2);
    });
  });
});
