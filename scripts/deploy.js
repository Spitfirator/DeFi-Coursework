const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log();

  // Deploy PokemonCard NFT Contract
  console.log("Deploying PokemonCard...");
  const maxSupply = 10000;
  const mintPrice = hre.ethers.parseEther("0.01"); // 0.01 ETH

  const PokemonCard = await hre.ethers.getContractFactory("PokemonCard");
  const pokemonCard = await PokemonCard.deploy(maxSupply, mintPrice);
  await pokemonCard.waitForDeployment();

  const pokemonCardAddress = await pokemonCard.getAddress();
  console.log("PokemonCard deployed to:", pokemonCardAddress);
  console.log("  - Max Supply:", maxSupply);
  console.log("  - Mint Price:", hre.ethers.formatEther(mintPrice), "ETH");
  console.log();

  // Deploy PokemonTrading Contract
  console.log("Deploying PokemonTrading...");
  const platformFee = 250; // 2.5%

  const PokemonTrading = await hre.ethers.getContractFactory("PokemonTrading");
  const trading = await PokemonTrading.deploy(pokemonCardAddress, platformFee);
  await trading.waitForDeployment();

  const tradingAddress = await trading.getAddress();
  console.log("PokemonTrading deployed to:", tradingAddress);
  console.log("  - Platform Fee:", platformFee / 100, "%");
  console.log();

  // Mint some initial Pokemon cards for testing
  console.log("Minting initial Pokemon cards...");
  
  const starterPokemon = [
    {
      name: "Pikachu",
      type: "Electric",
      rarity: "Rare",
      hp: 35,
      attack: 55,
      defense: 40,
      speed: 90,
      generation: 1
    },
    {
      name: "Charizard",
      type: "Fire",
      rarity: "Legendary",
      hp: 78,
      attack: 84,
      defense: 78,
      speed: 100,
      generation: 1
    },
    {
      name: "Blastoise",
      type: "Water",
      rarity: "Rare",
      hp: 79,
      attack: 83,
      defense: 100,
      speed: 78,
      generation: 1
    },
    {
      name: "Venusaur",
      type: "Grass",
      rarity: "Rare",
      hp: 80,
      attack: 82,
      defense: 83,
      speed: 80,
      generation: 1
    },
    {
      name: "Mewtwo",
      type: "Psychic",
      rarity: "Legendary",
      hp: 106,
      attack: 110,
      defense: 90,
      speed: 130,
      generation: 1
    }
  ];

  for (let i = 0; i < starterPokemon.length; i++) {
    const pokemon = starterPokemon[i];
    const uri = `ipfs://pokemon-metadata/${pokemon.name.toLowerCase()}`;
    
    const tx = await pokemonCard.adminMint(
      deployer.address,
      uri,
      pokemon.name,
      pokemon.type,
      pokemon.rarity,
      pokemon.hp,
      pokemon.attack,
      pokemon.defense,
      pokemon.speed,
      pokemon.generation
    );
    await tx.wait();
    console.log(`  Minted #${i}: ${pokemon.name} (${pokemon.rarity})`);
  }

  console.log();
  console.log("=".repeat(50));
  console.log("Deployment Complete!");
  console.log("=".repeat(50));
  console.log();
  console.log("Contract Addresses:");
  console.log("  PokemonCard:", pokemonCardAddress);
  console.log("  PokemonTrading:", tradingAddress);
  console.log();
  console.log("Save these addresses in your frontend .env file:");
  console.log(`  REACT_APP_POKEMON_CARD_ADDRESS=${pokemonCardAddress}`);
  console.log(`  REACT_APP_TRADING_ADDRESS=${tradingAddress}`);

  // Save deployment info to file
  const fs = require("fs");
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
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log();
  console.log("Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
