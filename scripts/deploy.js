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

  // Deploy DayCare (Staking Engine)
  console.log("📦 Deploying DayCare...");
  const DayCare = await hre.ethers.getContractFactory("DayCare");
  const dayCare = await DayCare.deploy(pokemonCardAddress);
  await dayCare.waitForDeployment();

  const dayCareAddress = await dayCare.getAddress();
  console.log("✅ DayCare deployed to:", dayCareAddress);
  console.log("  - Level Interval: 60 seconds");
  console.log();

  // Deploy EvolutionManager
  console.log("📦 Deploying EvolutionManager...");
  const EvolutionManager = await hre.ethers.getContractFactory("EvolutionManager");
  const evolutionManager = await EvolutionManager.deploy(pokemonCardAddress);
  await evolutionManager.waitForDeployment();

  const evolutionAddress = await evolutionManager.getAddress();
  console.log("✅ EvolutionManager deployed to:", evolutionAddress);
  console.log();

  // Grant TRAINER_ROLE to DayCare and EvolutionManager
  console.log("🔑 Granting TRAINER_ROLE...");
  const TRAINER_ROLE = await pokemonCard.TRAINER_ROLE();
  await (await pokemonCard.grantRole(TRAINER_ROLE, dayCareAddress)).wait();
  console.log("  ✅ TRAINER_ROLE granted to DayCare");
  await (await pokemonCard.grantRole(TRAINER_ROLE, evolutionAddress)).wait();
  console.log("  ✅ TRAINER_ROLE granted to EvolutionManager");
  console.log();

  // Deploy Hatchery
  console.log("📦 Deploying Hatchery...");
  const Hatchery = await hre.ethers.getContractFactory("Hatchery");
  const hatchery = await Hatchery.deploy(pokemonCardAddress, 15, 15, "egg.json");
  await hatchery.waitForDeployment();

  const hatcheryAddress = await hatchery.getAddress();
  console.log("✅ Hatchery deployed to:", hatcheryAddress);
  console.log("  - Breed Duration: 15 seconds");
  console.log("  - Incubation Duration: 15 seconds");
  console.log();

  // Grant roles to Hatchery
  console.log("🔑 Granting roles to Hatchery...");
  const MINTER_ROLE = await pokemonCard.MINTER_ROLE();
  await (await pokemonCard.grantRole(TRAINER_ROLE, hatcheryAddress)).wait();
  console.log("  ✅ TRAINER_ROLE granted to Hatchery");
  await (await pokemonCard.grantRole(MINTER_ROLE, hatcheryAddress)).wait();
  console.log("  ✅ MINTER_ROLE granted to Hatchery");
  console.log();

  // Register evolution paths (every 25 levels: stage 1 at Lv 25, stage 2 at Lv 50)
  console.log("🧬 Registering evolution paths...");
  const evolutions = [
    // --- 3-stage chains (Lv 25 → Lv 50) ---
    // [fromName, toName, toType, toRarity, levelThreshold, hpBoost, atkBoost, defBoost, spdBoost]
    ["Bulbasaur",  "Ivysaur",    "Grass",   "Uncommon", 25, 15, 10, 10, 5],
    ["Ivysaur",    "Venusaur",   "Grass",   "Rare",     50, 20, 15, 15, 10],
    ["Charmander", "Charmeleon", "Fire",    "Uncommon", 25, 14, 15, 9, 10],
    ["Charmeleon", "Charizard",  "Fire",    "Rare",     50, 18, 18, 12, 14],
    ["Squirtle",   "Wartortle",  "Water",   "Uncommon", 25, 15, 12, 13, 6],
    ["Wartortle",  "Blastoise",  "Water",   "Rare",     50, 18, 14, 16, 8],
    ["Caterpie",   "Metapod",    "Bug",     "Common",   25, 10, 5, 15, 3],
    ["Metapod",    "Butterfree", "Bug",     "Uncommon", 50, 15, 20, 10, 20],
    ["Pidgey",     "Pidgeotto",  "Flying",  "Common",   25, 13, 12, 10, 12],
    ["Pidgeotto",  "Pidgeot",    "Flying",  "Uncommon", 50, 15, 15, 12, 15],
    ["Zubat",      "Golbat",     "Poison",  "Common",   25, 15, 15, 10, 15],
    ["Golbat",     "Crobat",     "Poison",  "Rare",     50, 15, 15, 15, 20],
    ["Oddish",     "Gloom",      "Grass",   "Common",   25, 12, 12, 10, 5],
    ["Gloom",      "Vileplume",  "Grass",   "Uncommon", 50, 18, 18, 15, 8],
    ["Geodude",    "Graveler",   "Rock",    "Common",   25, 15, 15, 15, 5],
    ["Graveler",   "Golem",      "Rock",    "Rare",     50, 18, 18, 20, 5],

    // --- 2-stage chains (Lv 25) ---
    ["Magikarp",   "Gyarados",   "Water",    "Rare",     25, 50, 45, 30, 25],
    ["Pikachu",    "Raichu",     "Electric", "Uncommon", 25, 20, 20, 15, 20],
    ["Growlithe",  "Arcanine",   "Fire",     "Rare",     25, 30, 25, 20, 20],
    ["Eevee",      "Jolteon",    "Electric", "Uncommon", 25, 15, 25, 15, 30],
    ["Psyduck",    "Golduck",    "Water",    "Uncommon", 25, 20, 20, 15, 20],
    ["Jigglypuff", "Wigglytuff", "Fairy",    "Uncommon", 25, 30, 15, 10, 5],
    ["Rattata",    "Raticate",   "Normal",   "Common",   25, 15, 18, 12, 15],
  ];

  for (const evo of evolutions) {
    await (await evolutionManager.registerEvolution(...evo)).wait();
    console.log(`  ✅ ${evo[0]} → ${evo[1]} (Level ${evo[4]})`);
  }

  // Set base token URI on EvolutionManager
  await (await evolutionManager.setBaseTokenURI(IPFS_BASE_URI)).wait();
  console.log("  ✅ Base token URI set on EvolutionManager");
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
  console.log("  DayCare:", dayCareAddress);
  console.log("  EvolutionManager:", evolutionAddress);
  console.log("  Hatchery:", hatcheryAddress);
  console.log();
  console.log("🔗 IPFS Metadata:");
  console.log("  CID:", IPFS_CID);
  console.log("  Base URI:", IPFS_BASE_URI);
  console.log("  Example Token URI:", `${IPFS_BASE_URI}0.json`);
  console.log();
  console.log("📝 Save these addresses in your frontend .env file:");
  console.log(`  REACT_APP_POKEMON_CARD_ADDRESS=${pokemonCardAddress}`);
  console.log(`  REACT_APP_TRADING_ADDRESS=${tradingAddress}`);
  console.log(`  REACT_APP_DAYCARE_ADDRESS=${dayCareAddress}`);
  console.log(`  REACT_APP_EVOLUTION_ADDRESS=${evolutionAddress}`);
  console.log(`  REACT_APP_HATCHERY_ADDRESS=${hatcheryAddress}`);

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
    dayCare: {
      address: dayCareAddress,
      levelInterval: 60
    },
    evolution: {
      address: evolutionAddress,
      registeredPaths: evolutions.length
    },
    hatchery: {
      address: hatcheryAddress,
      hatchDuration: 15
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

  // Auto-update frontend .env file
  const envPath = path.join(__dirname, "../frontend/.env");
  const envContent = `REACT_APP_POKEMON_CARD_ADDRESS=${pokemonCardAddress}
REACT_APP_TRADING_ADDRESS=${tradingAddress}
REACT_APP_DAYCARE_ADDRESS=${dayCareAddress}
REACT_APP_EVOLUTION_ADDRESS=${evolutionAddress}
REACT_APP_HATCHERY_ADDRESS=${hatcheryAddress}
`;

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Frontend .env automatically updated!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
