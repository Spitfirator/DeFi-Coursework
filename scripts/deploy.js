const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// IPFS CID for the nft_metadata folder (already uploaded to IPFS)
const IPFS_CID = "bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4";
const IPFS_BASE_URI = `https://ipfs.io/ipfs/${IPFS_CID}/`;

async function main() {
  console.log("🚀 Starting deployment with IPFS metadata...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log();

  // Deploy PokemonCard NFT Contract
  console.log("📦 Deploying PokemonCard...");
  const maxSupply = 10000;
  const mintPrice = hre.ethers.parseEther("0.01"); // 0.01 ETH

  const PokemonCard = await hre.ethers.getContractFactory("PokemonCard");
  const pokemonCard = await PokemonCard.deploy(maxSupply, mintPrice);
  await pokemonCard.waitForDeployment();

  const pokemonCardAddress = await pokemonCard.getAddress();
  console.log("✅ PokemonCard deployed to:", pokemonCardAddress);
  console.log("  - Max Supply:", maxSupply);
  console.log("  - Mint Price:", hre.ethers.formatEther(mintPrice), "ETH");
  console.log();

  // Set IPFS Base URI
  console.log("🔗 Setting IPFS Base URI...");
  const setBaseURITx = await pokemonCard.setBaseURI(IPFS_BASE_URI);
  await setBaseURITx.wait();
  console.log("✅ Base URI set to:", IPFS_BASE_URI);
  console.log();

  // Deploy PokemonTrading Contract
  console.log("📦 Deploying PokemonTrading...");
  const platformFee = 250; // 2.5%

  const PokemonTrading = await hre.ethers.getContractFactory("PokemonTrading");
  const trading = await PokemonTrading.deploy(pokemonCardAddress, platformFee);
  await trading.waitForDeployment();

  const tradingAddress = await trading.getAddress();
  console.log("✅ PokemonTrading deployed to:", tradingAddress);
  console.log("  - Platform Fee:", platformFee / 100, "%");
  console.log();

  // Read metadata from nft_metadata folder and mint Pokemon
  console.log("🎴 Minting Pokemon cards from IPFS metadata...\n");
  
  const metadataDir = path.join(__dirname, "../nft_metadata");
  const files = fs.readdirSync(metadataDir)
    .filter(f => f.endsWith(".json") && !f.startsWith("_"))
    .sort((a, b) => parseInt(a) - parseInt(b));

  console.log(`📄 Found ${files.length} metadata files.`);

  // Get all signers (Hardhat provides 20 test accounts)
  const signers = await hre.ethers.getSigners();
  const NUM_ACCOUNTS = Math.min(10, signers.length); // Distribute across 10 accounts
  const MINT_COUNT = files.length; // Mint all 100 cards
  
  console.log(`👥 Distributing cards across ${NUM_ACCOUNTS} accounts...\n`);

  for (let i = 0; i < MINT_COUNT; i++) {
    const file = files[i];
    const filePath = path.join(metadataDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    
    // Extract attributes from metadata
    const getAttr = (traitType) => {
      const attr = content.attributes.find(a => a.trait_type === traitType);
      return attr ? attr.value : null;
    };
    
    const pokemonName = getAttr("Pokemon") || content.name.replace(/\s*#\d+$/, "");
    const pokemonType = getAttr("Type") || "Normal";
    const rarity = getAttr("Rarity") || "Common";
    const level = getAttr("Level") || 1;
    const pokedexNum = getAttr("Pokedex Number") || 1;
    
    // Generate stats based on level and rarity
    const baseStats = rarity === "Legendary" ? 100 : rarity === "Rare" ? 70 : 50;
    const hp = Math.floor(baseStats + (level / 2));
    const attack = Math.floor(baseStats + (level / 3));
    const defense = Math.floor(baseStats + (level / 4));
    const speed = Math.floor(baseStats + (level / 3));
    
    // Token URI points to IPFS metadata
    const tokenURI = `${IPFS_BASE_URI}${i}.json`;
    
    // Distribute cards across accounts (round-robin)
    const recipientIndex = i % NUM_ACCOUNTS;
    const recipient = signers[recipientIndex];
    
    const tx = await pokemonCard.adminMint(
      recipient.address,
      tokenURI,
      pokemonName,
      pokemonType,
      rarity,
      hp,
      attack,
      defense,
      speed,
      1 // generation
    );
    await tx.wait();
    
    // Log every 10th card to reduce output noise
    if (i % 10 === 0 || i < 10) {
      console.log(`  ✅ Minted #${i}: ${pokemonName} (${rarity}) → Account ${recipientIndex}`);
    }
  }
  
  // Summary of distribution
  console.log("\n📊 Card Distribution Summary:");
  for (let i = 0; i < NUM_ACCOUNTS; i++) {
    const balance = await pokemonCard.balanceOf(signers[i].address);
    console.log(`  Account ${i} (${signers[i].address.slice(0,10)}...): ${balance} cards`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log();
  console.log("📋 Contract Addresses:");
  console.log("  PokemonCard:", pokemonCardAddress);
  console.log("  PokemonTrading:", tradingAddress);
  console.log();
  console.log("🔗 IPFS Metadata:");
  console.log("  CID:", IPFS_CID);
  console.log("  Base URI:", IPFS_BASE_URI);
  console.log("  Example Token URI:", `${IPFS_BASE_URI}0.json`);
  console.log();
  console.log("📝 Save these addresses in your frontend .env file:");
  console.log(`  REACT_APP_POKEMON_CARD_ADDRESS=${pokemonCardAddress}`);
  console.log(`  REACT_APP_TRADING_ADDRESS=${tradingAddress}`);

  // Save deployment info to file
  const deploymentInfo = {
    network: hre.network.name,
    pokemonCard: {
      address: pokemonCardAddress,
      maxSupply: maxSupply,
      mintPrice: mintPrice.toString()
    },
    trading: {
      address: tradingAddress,
      platformFee: platformFee
    },
    ipfs: {
      cid: IPFS_CID,
      baseURI: IPFS_BASE_URI,
      metadataCount: files.length,
      mintedCount: MINT_COUNT
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log();
  console.log("💾 Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
