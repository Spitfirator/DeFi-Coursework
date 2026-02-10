import { ethers } from "hardhat";

async function main() {
    const NFT_ADDRESS = "0x09635F643e140090A9A8Dcd712eD6285858ceBef";
    const MARKETPLACE_ADDRESS = "0xc5a5C42992dECbae36851359345FE25997F5C42d";

    console.log("Checking deployment status...\n");

    try {
        const nft = await ethers.getContractAt("PokemonNFT", NFT_ADDRESS);
        const marketplace = await ethers.getContractAt("PokemonMarketplace", MARKETPLACE_ADDRESS);

        const totalSupply = await nft.totalSupply();
        console.log(`✅ NFT Contract: ${NFT_ADDRESS}`);
        console.log(`   Total Supply: ${totalSupply}`);

        if (totalSupply > 0n) {
            console.log(`\n✅ ${totalSupply} NFTs have been minted!`);

            // Check first NFT
            const owner = await nft.ownerOf(0);
            const pokemonData = await nft.pokemonData(0);
            const tokenURI = await nft.tokenURI(0);

            console.log(`\nFirst NFT (Token ID 0):`);
            console.log(`   Name: ${pokemonData.name}`);
            console.log(`   Type: ${pokemonData.ptype}`);
            console.log(`   Rarity: ${pokemonData.rarity}`);
            console.log(`   Level: ${pokemonData.level}`);
            console.log(`   Owner: ${owner}`);
            console.log(`   Token URI: ${tokenURI}`);
        } else {
            console.log(`\n❌ No NFTs have been minted yet!`);
            console.log(`\nTo mint NFTs, run:`);
            console.log(`   npx hardhat run scripts/deploy_and_mint_all.ts --network localhost`);
        }

        console.log(`\n✅ Marketplace Contract: ${MARKETPLACE_ADDRESS}`);

    } catch (error: any) {
        console.error(`\n❌ Error checking contracts:`, error.message);
        console.log(`\nMake sure:`);
        console.log(`   1. Hardhat node is running (npx hardhat node)`);
        console.log(`   2. Contracts are deployed to these addresses`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
