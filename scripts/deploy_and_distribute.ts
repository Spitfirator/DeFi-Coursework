import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    console.log("🚀 Starting Deployment with NFT Distribution...\n");

    // Get first 6 Hardhat accounts
    const signers = await ethers.getSigners();
    const accounts = signers.slice(0, 6); // Use first 6 accounts

    console.log("📋 Distributing NFTs across accounts:");
    accounts.forEach((acc, i) => {
        console.log(`   Account #${i}: ${acc.address}`);
    });
    console.log();

    const [deployer] = accounts;
    console.log("📦 Deploying with account:", deployer.address);

    // 1. Deploy PokemonNFT
    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    const baseURI = "https://gateway.pinata.cloud/ipfs/bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4/";
    const pokemonNFT = await PokemonNFT.deploy(baseURI);
    await pokemonNFT.waitForDeployment();
    const nftAddress = await pokemonNFT.getAddress();
    console.log("✅ PokemonNFT deployed to:", nftAddress);

    // 2. Deploy PokemonMarketplace
    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const marketplace = await PokemonMarketplace.deploy();
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    console.log("✅ PokemonMarketplace deployed to:", marketplaceAddress);
    console.log();

    // 3. Read Metadata
    const metadataDir = path.join(__dirname, "../nft_metadata");
    const files = fs.readdirSync(metadataDir).filter(f => f.endsWith(".json"));

    files.sort((a, b) => {
        return parseInt(a.split(".")[0]) - parseInt(b.split(".")[0]);
    });

    console.log(`📄 Found ${files.length} metadata files.\n`);

    if (files.length !== 100) {
        throw new Error(`Expected 100 metadata files, found ${files.length}`);
    }

    const pokemons = [];

    for (const file of files) {
        const filePath = path.join(metadataDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

        const rarityAttr = content.attributes.find((a: any) => a.trait_type === "Rarity Level");
        const rarityStringAttr = content.attributes.find((a: any) => a.trait_type === "Rarity");
        const typeAttr = content.attributes.find((a: any) => a.trait_type === "Type");
        const levelAttr = content.attributes.find((a: any) => a.trait_type === "Level");

        let rarityValue = 1;
        if (rarityAttr) {
            rarityValue = Number(rarityAttr.value);
        } else if (rarityStringAttr) {
            const val = rarityStringAttr.value;
            if (val === "Legendary") rarityValue = 5;
            else if (val === "Rare") rarityValue = 4;
            else rarityValue = 1;
        }

        if (!Number.isFinite(rarityValue) || rarityValue < 1 || rarityValue > 5) {
            throw new Error(`Bad rarity in ${file}: ${rarityValue}`);
        }

        const levelValue = levelAttr ? Number(levelAttr.value) : 1;
        if (!Number.isFinite(levelValue) || levelValue < 1 || levelValue > 100) {
            throw new Error(`Bad level in ${file}: ${levelValue}`);
        }

        pokemons.push({
            name: content.name.replace(/\s*#\d+$/, ""),
            ptype: typeAttr ? typeAttr.value : "Unknown",
            rarity: rarityValue,
            level: levelValue
        });
    }

    // 4. Distribute NFTs across accounts
    console.log("🎲 Distributing 100 NFTs across 6 accounts...\n");

    // Distribution strategy: ~16-17 NFTs per account
    const nftsPerAccount = Math.floor(100 / accounts.length); // 16
    const remainder = 100 % accounts.length; // 4

    let currentIndex = 0;
    const distribution: { [address: string]: number } = {};

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        // Give extra NFT to first 'remainder' accounts
        const count = nftsPerAccount + (i < remainder ? 1 : 0);

        const batch = pokemons.slice(currentIndex, currentIndex + count);

        console.log(`🔨 Minting ${count} NFTs to Account #${i} (${account.address.slice(0, 6)}...${account.address.slice(-4)})`);

        const tx = await pokemonNFT.batchMintPokemon(account.address, batch);
        await tx.wait();

        distribution[account.address] = count;
        currentIndex += count;
    }

    console.log("\n✨ All 100 NFTs minted and distributed!\n");

    // 5. Display Distribution Summary
    console.log("📊 Distribution Summary:");
    console.log("─".repeat(70));
    for (let i = 0; i < accounts.length; i++) {
        const addr = accounts[i].address;
        const count = distribution[addr];
        const balance = await pokemonNFT.balanceOf(addr);
        console.log(`   Account #${i}: ${addr}`);
        console.log(`   └─ NFTs: ${count} (verified: ${balance.toString()})`);
    }
    console.log("─".repeat(70));

    // 6. Verification
    console.log("\n🔍 Verifying sample tokens...");
    const checkId = 42;
    const data = await pokemonNFT.pokemonData(checkId);
    const owner = await pokemonNFT.ownerOf(checkId);
    console.log(`   Token #${checkId}: ${data.name} (Type: ${data.ptype}, Rarity: ${data.rarity}, Level: ${data.level})`);
    console.log(`   Owner: ${owner}`);

    console.log("\n🔗 Sample TokenURIs:");
    console.log(`   #0:  ${await pokemonNFT.tokenURI(0)}`);
    console.log(`   #42: ${await pokemonNFT.tokenURI(42)}`);
    console.log(`   #99: ${await pokemonNFT.tokenURI(99)}`);

    console.log("\n🎉 Deployment Complete!");
    console.log("\n📝 Update your .env.local with:");
    console.log(`   NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=${nftAddress}`);
    console.log(`   NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
