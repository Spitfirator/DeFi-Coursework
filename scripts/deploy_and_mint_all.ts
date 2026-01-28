import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    console.log("🚀 Starting Deployment and Minting of Full Collection...");

    const [owner] = await ethers.getSigners();
    console.log("📦 Deploying with account:", owner.address);

    // 1. Deploy PokemonNFT
    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    // using a placeholder IPFS hash or local host for baseURI
    // In a real scenario, we'd upload the 100 JSONs to IPFS first and get the CID.
    // For this demo, we'll assume a local server or placeholder.
    const baseURI = "https://ipfs.io/ipfs/QmPlaceholderHash/";
    const pokemonNFT = await PokemonNFT.deploy(baseURI);
    await pokemonNFT.waitForDeployment();
    const nftAddress = await pokemonNFT.getAddress();
    console.log("✅ PokemonNFT deployed to:", nftAddress);

    // 2. Deploy PokemonMarketplace
    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const marketplace = await PokemonMarketplace.deploy();
    await marketplace.waitForDeployment();
    console.log("✅ PokemonMarketplace deployed to:", await marketplace.getAddress());

    // 3. Read Metadata and Prepare batchMint
    const metadataDir = path.join(__dirname, "../nft_metadata");
    const files = fs.readdirSync(metadataDir).filter(f => f.endsWith(".json"));

    // Sort files numerically 0.json, 1.json... because creation order matters for ID alignment!
    files.sort((a, b) => {
        return parseInt(a.split(".")[0]) - parseInt(b.split(".")[0]);
    });

    console.log(`📄 Found ${files.length} metadata files.`);

    if (files.length !== 100) {
        throw new Error(`Expected 100 metadata files, found ${files.length}`);
    }

    const pokemons = [];

    for (const file of files) {
        const filePath = path.join(metadataDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Extract attributes
        const rarityAttr = content.attributes.find((a: any) => a.trait_type === "Rarity Level");
        const rarityStringAttr = content.attributes.find((a: any) => a.trait_type === "Rarity");
        const typeAttr = content.attributes.find((a: any) => a.trait_type === "Type");
        const levelAttr = content.attributes.find((a: any) => a.trait_type === "Level");

        // Robust Rarity Parsing
        let rarityValue = 1;
        if (rarityAttr) {
            rarityValue = Number(rarityAttr.value);
        } else if (rarityStringAttr) {
            // Fallback mapping
            const val = rarityStringAttr.value;
            if (val === "Legendary") rarityValue = 5;
            else if (val === "Rare") rarityValue = 4;
            else rarityValue = 1; // Default Common
        }

        if (!Number.isFinite(rarityValue) || rarityValue < 1 || rarityValue > 5) {
            throw new Error(`Bad rarity in ${file}: ${rarityValue}`);
        }

        // Robust Level Parsing
        const levelValue = levelAttr ? Number(levelAttr.value) : 1;
        if (!Number.isFinite(levelValue) || levelValue < 1 || levelValue > 100) {
            throw new Error(`Bad level in ${file}: ${levelValue}`);
        }

        pokemons.push({
            name: content.name.replace(/\s*#\d+$/, ""), // Robustly remove #ID suffix
            ptype: typeAttr ? typeAttr.value : "Unknown",
            rarity: rarityValue,
            level: levelValue
        });
    }

    // 4. Batch Mint in chunks (to be safe with gas, though 100 might fit in one or two txs on Hardhat)
    const CHUNK_SIZE = 20;
    for (let i = 0; i < pokemons.length; i += CHUNK_SIZE) {
        const chunk = pokemons.slice(i, i + CHUNK_SIZE);
        console.log(`🔨 Minting batch ${i} to ${i + chunk.length - 1}...`);

        const tx = await pokemonNFT.batchMintPokemon(owner.address, chunk);
        await tx.wait();
    }

    console.log("✨ All 100 NFTs minted successfully!");

    // 5. Verification
    console.log("🔍 Verifying random token data...");
    const checkId = 42; // Answer to life
    const data = await pokemonNFT.pokemonData(checkId);
    console.log(`   Token #${checkId}: ${data.name} (Type: ${data.ptype}, Rarity: ${data.rarity}, Level: ${data.level})`);

    // Verify against JSON
    const jsonContent = JSON.parse(fs.readFileSync(path.join(metadataDir, `${checkId}.json`), "utf8"));
    console.log(`   JSON Match: ${jsonContent.name.includes(data.name)}`); // Basic check

    console.log("🔗 TokenURI #0:", await pokemonNFT.tokenURI(0));
    console.log("🔗 TokenURI #42:", await pokemonNFT.tokenURI(42));
    console.log("🔗 TokenURI #99:", await pokemonNFT.tokenURI(99));

    console.log("🎉 Complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
