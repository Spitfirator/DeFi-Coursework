import fs from 'fs';
import path from 'path';

/**
 * COMPLETE METADATA GENERATION SCRIPT - USING POKEAPI SPRITES
 * CommonJS Compatible Version
 */

async function main() {
    console.log("🎮 Pokemon NFT Metadata Generator v2.0");
    console.log("📦 Using PokeAPI Official Artwork Sprites");
    console.log("=".repeat(60) + "\n");

    const outputDir = path.join(__dirname, '../nft_metadata');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log("✅ Created output directory: nft_metadata/\n");
    }

    // ======================================
    // POKEMON DATA WITH POKEAPI IDs
    // ======================================

    const POKEMON_DATA = {
        legendary: [
            { name: "Mewtwo", id: 150, type: "Psychic", description: "A legendary Psychic-type created through genetic manipulation." },
            { name: "Lugia", id: 249, type: "Psychic/Flying", description: "Guardian of the seas with immense psychic power." },
            { name: "Rayquaza", id: 384, type: "Dragon/Flying", description: "Sky High Pokemon that lives in the ozone layer." },
            { name: "Arceus", id: 493, type: "Normal", description: "The Original One, said to have shaped the universe." },
            { name: "Giratina", id: 487, type: "Ghost/Dragon", description: "Renegade Pokemon banished to the Distortion World." }
        ],
        rare: [
            { name: "Charizard", id: 6, type: "Fire/Flying", description: "Powerful Fire-type that can melt anything with its flames." },
            { name: "Blastoise", id: 9, type: "Water", description: "Water-type with powerful hydro cannons on its shell." },
            { name: "Venusaur", id: 3, type: "Grass/Poison", description: "Grass-type with a giant flower that emits a soothing aroma." },
            { name: "Gengar", id: 94, type: "Ghost/Poison", description: "Shadow Pokemon that hides in darkness and drops temperatures." },
            { name: "Dragonite", id: 149, type: "Dragon/Flying", description: "Pseudo-legendary Dragon-type known for its kindness." },
            { name: "Gyarados", id: 130, type: "Water/Flying", description: "Atrocious Pokemon with a violent temper." },
            { name: "Alakazam", id: 65, type: "Psychic", description: "Psi Pokemon with an IQ of 5000." },
            { name: "Machamp", id: 68, type: "Fighting", description: "Superpower Pokemon with four powerful arms." },
            { name: "Snorlax", id: 143, type: "Normal", description: "Sleeping Pokemon that blocks paths while napping." },
            { name: "Arcanine", id: 59, type: "Fire", description: "Legendary Pokemon known for its speed and majesty." },
            { name: "Lapras", id: 131, type: "Water/Ice", description: "Transport Pokemon with gentle nature." },
            { name: "Tyranitar", id: 248, type: "Rock/Dark", description: "Armor Pokemon that can topple mountains." },
            { name: "Metagross", id: 376, type: "Steel/Psychic", description: "Iron Leg Pokemon with four brains." },
            { name: "Salamence", id: 373, type: "Dragon/Flying", description: "Dragon Pokemon with a fierce temper." },
            { name: "Garchomp", id: 445, type: "Dragon/Ground", description: "Mach Pokemon that flies at sonic speed." }
        ],
        common: [
            { name: "Pikachu", id: 25, type: "Electric", description: "Mouse Pokemon that stores electricity in its cheeks." },
            { name: "Bulbasaur", id: 1, type: "Grass/Poison", description: "Seed Pokemon that grows with its plant bulb." },
            { name: "Charmander", id: 4, type: "Fire", description: "Lizard Pokemon whose tail flame indicates its health." },
            { name: "Squirtle", id: 7, type: "Water", description: "Tiny Turtle Pokemon that withdraws into its shell." },
            { name: "Pidgey", id: 16, type: "Normal/Flying", description: "Tiny Bird Pokemon found in grassy areas." },
            { name: "Rattata", id: 19, type: "Normal", description: "Mouse Pokemon that lives anywhere." },
            { name: "Zubat", id: 41, type: "Poison/Flying", description: "Bat Pokemon that lives in caves." },
            { name: "Geodude", id: 74, type: "Rock/Ground", description: "Rock Pokemon with arms that can throw punches." },
            { name: "Magikarp", id: 129, type: "Water", description: "Fish Pokemon known for being weak but can evolve into Gyarados." },
            { name: "Caterpie", id: 10, type: "Bug", description: "Worm Pokemon that loves to eat leaves." },
            { name: "Eevee", id: 133, type: "Normal", description: "Evolution Pokemon with unstable genetic code." },
            { name: "Jigglypuff", id: 39, type: "Normal/Fairy", description: "Balloon Pokemon with a soothing song." },
            { name: "Psyduck", id: 54, type: "Water", description: "Duck Pokemon with constant headaches." },
            { name: "Growlithe", id: 58, type: "Fire", description: "Puppy Pokemon that is brave and loyal." },
            { name: "Oddish", id: 43, type: "Grass/Poison", description: "Weed Pokemon that buries itself during the day." }
        ]
    };

    const TOTAL_SUPPLY = 100;
    const MAX_LEGENDARY = 5;
    const MAX_RARE = 25;
    const COMMON_COUNT = TOTAL_SUPPLY - MAX_LEGENDARY - MAX_RARE;

    // ======================================
    // HELPER FUNCTIONS
    // ======================================

    function getImageUrl(pokemonId: number): string {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
    }

    function getPokeAPIUrl(pokemonId: number): string {
        return `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
    }

    // ======================================
    // GENERATE TOKEN ASSIGNMENTS
    // ======================================

    console.log("🎨 Generating token assignments...\n");

    interface TokenAssignment {
        tokenId: number;
        name: string;
        pokemonId: number;
        type: string;
        description: string;
        rarity: number;
        rarityName: string;
        level: number;
        image: string;
    }

    const tokenAssignments: TokenAssignment[] = [];
    let tokenId = 0;

    // LEGENDARY TOKENS (0-4)
    console.log("⭐ Assigning Legendary Pokemon (Tokens 0-4)...");
    for (let i = 0; i < MAX_LEGENDARY; i++) {
        const pokemon = POKEMON_DATA.legendary[i];
        const level = 80 + Math.floor((i / MAX_LEGENDARY) * 20);

        tokenAssignments.push({
            tokenId,
            name: pokemon.name,
            pokemonId: pokemon.id,
            type: pokemon.type,
            description: pokemon.description,
            rarity: 5,
            rarityName: "Legendary",
            level,
            image: getImageUrl(pokemon.id)
        });

        console.log(`   Token #${tokenId}: ${pokemon.name} (Level ${level})`);
        tokenId++;
    }

    // RARE TOKENS (5-29)
    console.log("\n💎 Assigning Rare Pokemon (Tokens 5-29)...");
    for (let i = 0; i < MAX_RARE; i++) {
        const pokemon = POKEMON_DATA.rare[i % POKEMON_DATA.rare.length];
        const level = 40 + Math.floor((i / MAX_RARE) * 39);

        tokenAssignments.push({
            tokenId,
            name: pokemon.name,
            pokemonId: pokemon.id,
            type: pokemon.type,
            description: pokemon.description,
            rarity: 4,
            rarityName: "Rare",
            level,
            image: getImageUrl(pokemon.id)
        });

        if (i < 5 || i >= MAX_RARE - 5) {
            console.log(`   Token #${tokenId}: ${pokemon.name} (Level ${level})`);
        } else if (i === 5) {
            console.log(`   ... (${MAX_RARE - 10} more) ...`);
        }
        tokenId++;
    }

    // COMMON TOKENS (30-99)
    console.log("\n🌟 Assigning Common Pokemon (Tokens 30-99)...");
    for (let i = 0; i < COMMON_COUNT; i++) {
        const pokemon = POKEMON_DATA.common[i % POKEMON_DATA.common.length];
        const rarity = 1 + (i % 3);
        const level = 1 + Math.floor((i / COMMON_COUNT) * 38);

        tokenAssignments.push({
            tokenId,
            name: pokemon.name,
            pokemonId: pokemon.id,
            type: pokemon.type,
            description: pokemon.description,
            rarity,
            rarityName: "Common",
            level,
            image: getImageUrl(pokemon.id)
        });

        if (i < 5 || i >= COMMON_COUNT - 5) {
            console.log(`   Token #${tokenId}: ${pokemon.name} (Level ${level}, Rarity ${rarity})`);
        } else if (i === 5) {
            console.log(`   ... (${COMMON_COUNT - 10} more) ...`);
        }
        tokenId++;
    }

    // ======================================
    // GENERATE METADATA JSON FILES
    // ======================================

    console.log("\n📝 Writing metadata JSON files...\n");

    for (const assignment of tokenAssignments) {
        const metadata = {
            name: `${assignment.name} #${assignment.tokenId}`,
            description: `${assignment.description} This is a ${assignment.rarityName} Pokemon NFT with power level ${assignment.level}.`,
            image: assignment.image,
            external_url: getPokeAPIUrl(assignment.pokemonId),
            attributes: [
                {
                    trait_type: "Pokemon",
                    value: assignment.name
                },
                {
                    trait_type: "Rarity",
                    value: assignment.rarityName
                },
                {
                    trait_type: "Rarity Level",
                    value: assignment.rarity
                },
                {
                    trait_type: "Type",
                    value: assignment.type
                },
                {
                    trait_type: "Level",
                    value: assignment.level
                },
                {
                    trait_type: "Pokedex Number",
                    value: assignment.pokemonId
                }
            ]
        };

        const filename = path.join(outputDir, `${assignment.tokenId}.json`);
        fs.writeFileSync(filename, JSON.stringify(metadata, null, 2));

        if ((assignment.tokenId + 1) % 20 === 0) {
            console.log(`   ✅ Generated ${assignment.tokenId + 1}/${TOTAL_SUPPLY} files`);
        }
    }

    console.log(`   ✅ Generated ${TOTAL_SUPPLY}/${TOTAL_SUPPLY} files\n`);

    // ======================================
    // GENERATE COLLECTION INDEX
    // ======================================

    const collectionIndex = {
        name: "Pokemon NFT Collection",
        description: "A collection of 100 Pokemon NFTs with official artwork from PokeAPI",
        totalSupply: TOTAL_SUPPLY,
        distribution: {
            legendary: MAX_LEGENDARY,
            rare: MAX_RARE,
            common: COMMON_COUNT
        },
        imageSource: "PokeAPI Official Artwork Sprites",
        imageBaseUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/",
        tokens: tokenAssignments,
        generatedAt: new Date().toISOString(),
        version: "2.0"
    };

    const indexPath = path.join(outputDir, '_collection_index.json');
    fs.writeFileSync(indexPath, JSON.stringify(collectionIndex, null, 2));

    console.log("📋 Collection index saved to: _collection_index.json\n");

    // ======================================
    // VALIDATION
    // ======================================

    console.log("🔍 Validating metadata files...\n");

    let validCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < TOTAL_SUPPLY; i++) {
        const filename = path.join(outputDir, `${i}.json`);

        if (!fs.existsSync(filename)) {
            errors.push(`❌ Missing file: ${i}.json`);
            continue;
        }

        try {
            const content = JSON.parse(fs.readFileSync(filename, 'utf8'));

            if (!content.name) errors.push(`❌ Token ${i}: Missing name`);
            if (!content.image) errors.push(`❌ Token ${i}: Missing image`);
            if (!content.description) errors.push(`❌ Token ${i}: Missing description`);
            if (!content.attributes) errors.push(`❌ Token ${i}: Missing attributes`);

            if (content.image && !content.image.startsWith('https://raw.githubusercontent.com/PokeAPI/sprites')) {
                errors.push(`❌ Token ${i}: Invalid image URL`);
            }

            const rarityAttr = content.attributes.find((a: any) => a.trait_type === "Rarity Level");
            if (rarityAttr) {
                const rarity = rarityAttr.value;
                if (rarity < 1 || rarity > 5) {
                    errors.push(`❌ Token ${i}: Invalid rarity ${rarity}`);
                }
            } else {
                errors.push(`❌ Token ${i}: Missing rarity attribute`);
            }

            if (errors.length === 0) {
                validCount++;
            }
        } catch (e: any) {
            errors.push(`❌ Token ${i}: Parse error - ${e.message}`);
        }
    }

    if (errors.length > 0) {
        console.log("⚠️  Validation Issues:\n");
        errors.forEach(err => console.log(`   ${err}`));
        console.log("");
    } else {
        console.log("✅ All files validated successfully!\n");
    }

    // ======================================
    // SUMMARY
    // ======================================

    console.log("=".repeat(60));
    console.log("📊 GENERATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total NFTs:           ${TOTAL_SUPPLY}`);
    console.log(`Legendary (Rarity 5): ${MAX_LEGENDARY} tokens  (IDs: 0-4)`);
    console.log(`Rare (Rarity 4):      ${MAX_RARE} tokens  (IDs: 5-29)`);
    console.log(`Common (Rarity 1-3):  ${COMMON_COUNT} tokens  (IDs: 30-99)`);
    console.log(`Valid Files:          ${validCount}/${TOTAL_SUPPLY}`);
    console.log("=".repeat(60) + "\n");

    // ======================================
    // SAMPLE METADATA
    // ======================================

    console.log("📄 Sample Metadata (Token #0):\n");
    const sample = JSON.parse(fs.readFileSync(path.join(outputDir, '0.json'), 'utf8'));
    console.log(JSON.stringify(sample, null, 2));
    console.log("\n");

    // ======================================
    // NEXT STEPS
    // ======================================

    console.log("=".repeat(60));
    console.log("🚀 NEXT STEPS");
    console.log("=".repeat(60));
    console.log("\n1️⃣  Upload metadata folder to IPFS:");
    console.log("   • Go to https://pinata.cloud (free account)");
    console.log("   • Click 'Upload' → 'Folder'");
    console.log("   • Select the 'nft_metadata' folder");
    console.log("   • Copy the CID (e.g., QmXyz123...)\n");

    console.log("2️⃣  Update deployment script:");
    console.log("   • Open scripts/deploy_and_mint_all.ts");
    console.log("   • Update baseURI:");
    console.log("     const baseURI = 'https://ipfs.io/ipfs/YOUR_CID_HERE/';\n");

    console.log("3️⃣  Deploy contracts:");
    console.log("   • npx hardhat node");
    console.log("   • npx hardhat run scripts/deploy_and_mint_all.ts --network localhost\n");

    console.log("4️⃣  Test everything:");
    console.log("   • npx hardhat test\n");

    console.log("=".repeat(60));
    console.log("✨ METADATA GENERATION COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n🎮 All images hosted on GitHub via PokeAPI");
    console.log("📦 Ready to deploy your NFT marketplace!\n");
}

main().catch((error) => {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
    process.exitCode = 1;
});