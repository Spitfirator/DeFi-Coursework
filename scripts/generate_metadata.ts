const fs = require('fs');
const path = require('path');

async function main() {
    const outputDir = path.join(__dirname, '../metadata');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const TOTAL_SUPPLY = 100;
    const MAX_LEGENDARY = 5;
    const MAX_RARE = 25;
    // Common is remainder (70)

    let legendaryCount = 0;
    let rareCount = 0;
    let commonCount = 0;

    const pokemons = {
        legendary: [
            { name: "Mewtwo", type: "Psychic", image: "ipfs://QmlegendaryMewtwoHash" },
            { name: "Lugia", type: "Psychic/Flying", image: "ipfs://QmlegendaryLugiaHash" },
            { name: "Rayquaza", type: "Dragon/Flying", image: "ipfs://QmlegendaryRayquazaHash" },
            { name: "Arceus", type: "Normal", image: "ipfs://QmlegendaryArceusHash" },
            { name: "Giratina", type: "Ghost/Dragon", image: "ipfs://QmlegendaryGiratinaHash" }
        ],
        rare: [
            { name: "Charizard", type: "Fire/Flying", image: "ipfs://QmrareCharizardHash" },
            { name: "Blastoise", type: "Water", image: "ipfs://QmrareBlastoiseHash" },
            { name: "Venusaur", type: "Grass/Poison", image: "ipfs://QmrareVenusaurHash" },
            { name: "Gengar", type: "Ghost/Poison", image: "ipfs://QmrareGengarHash" },
            { name: "Dragonite", type: "Dragon/Flying", image: "ipfs://QmrareDragoniteHash" },
            { name: "Gyarados", type: "Water/Flying", image: "ipfs://QmrareGyaradosHash" },
            { name: "Alakazam", type: "Psychic", image: "ipfs://QmrareAlakazamHash" },
            { name: "Machamp", type: "Fighting", image: "ipfs://QmrareMachampHash" },
            { name: "Snorlax", type: "Normal", image: "ipfs://QmrareSnorlaxHash" },
            { name: "Arcanine", type: "Fire", image: "ipfs://QmrareArcanineHash" }
        ],
        common: [
            { name: "Pikachu", type: "Electric", image: "ipfs://QmcommonPikachuHash" },
            { name: "Bulbasaur", type: "Grass/Poison", image: "ipfs://QmcommonBulbasaurHash" },
            { name: "Charmander", type: "Fire", image: "ipfs://QmcommonCharmanderHash" },
            { name: "Squirtle", type: "Water", image: "ipfs://QmcommonSquirtleHash" },
            { name: "Pidgey", type: "Normal/Flying", image: "ipfs://QmcommonPidgeyHash" },
            { name: "Rattata", type: "Normal", image: "ipfs://QmcommonRattataHash" },
            { name: "Zubat", type: "Poison/Flying", image: "ipfs://QmcommonZubatHash" },
            { name: "Geodude", type: "Rock/Ground", image: "ipfs://QmcommonGeodudeHash" },
            { name: "Magikarp", type: "Water", image: "ipfs://QmcommonMagikarpHash" },
            { name: "Caterpie", type: "Bug", image: "ipfs://QmcommonCaterpieHash" }
        ]
    };

    console.log("Generating 100 metadata files...");

    // We do a first pass to assign rarities to ensure we hit exact counts?
    // Or just fill as we go? 
    // To ensure randomization but exact counts, create an array of 100 rarities and shuffle it.

    let rarities = [];
    for (let i = 0; i < MAX_LEGENDARY; i++) rarities.push(5);
    for (let i = 0; i < MAX_RARE; i++) rarities.push(4);
    for (let i = 0; i < (TOTAL_SUPPLY - MAX_LEGENDARY - MAX_RARE); i++) rarities.push(1); // 1,2,3 are common, simplified to 1

    // Shuffle array (Fisher-Yates)
    for (let i = rarities.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rarities[i], rarities[j]] = [rarities[j], rarities[i]];
    }

    for (let i = 0; i < TOTAL_SUPPLY; i++) {
        const rarity = rarities[i];
        let pData;
        let level;

        if (rarity === 5) {
            // Legendary (80-100)
            pData = pokemons.legendary[Math.floor(Math.random() * pokemons.legendary.length)];
            level = Math.floor(Math.random() * (100 - 80 + 1)) + 80;
            legendaryCount++;
        } else if (rarity === 4) {
            // Rare (40-79)
            pData = pokemons.rare[Math.floor(Math.random() * pokemons.rare.length)];
            level = Math.floor(Math.random() * (79 - 40 + 1)) + 40;
            rareCount++;
        } else {
            // Common (1-39)
            pData = pokemons.common[Math.floor(Math.random() * pokemons.common.length)];
            level = Math.floor(Math.random() * (39 - 1 + 1)) + 1;
            // Determine sub-rarity 1-3 randomly for flavor
            // rarity = Math.floor(Math.random() * 3) + 1; 
            // For logic simplicity, we kept array at 1, but let's just save valid int
            commonCount++;
        }

        const metadata = {
            name: `${pData.name} #${i}`,
            description: `A ${rarity === 5 ? 'Legendary' : rarity === 4 ? 'Rare' : 'Common'} Pokemon NFT.`,
            image: pData.image, // Placeholder or local asset path
            attributes: [
                { trait_type: "Rarity", value: rarity === 5 ? "Legendary" : rarity === 4 ? "Rare" : "Common" },
                { trait_type: "Rarity Level", value: rarity }, // Numeric
                { trait_type: "Type", value: pData.type },
                { trait_type: "Level", value: level }
            ]
        };

        fs.writeFileSync(path.join(outputDir, `${i}.json`), JSON.stringify(metadata, null, 2));
    }

    console.log(`Generated 100 files.`);
    console.log(`Legendary: ${legendaryCount}`);
    console.log(`Rare: ${rareCount}`);
    console.log(`Common: ${commonCount}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
