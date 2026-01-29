import fs from 'fs';
import path from 'path';

// Define source and destination paths
const SOURCE_DIR = path.join(__dirname, '../typechain-types');
const DEST_DIR = path.join(__dirname, '../pokemon-marketplace-frontend/types/typechain-types');

// Function to copy a directory recursively
function copyRecursiveSync(src: string, dest: string) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = stats && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(
                path.join(src, childItemName),
                path.join(dest, childItemName)
            );
        });
    } else {
        if (!fs.existsSync(path.dirname(dest))) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
        }
        fs.copyFileSync(src, dest);
    }
}

async function main() {
    console.log(`Copying types from ${SOURCE_DIR} to ${DEST_DIR}...`);

    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`Source directory ${SOURCE_DIR} does not exist. Run 'npx hardhat typechain' first.`);
        process.exit(1);
    }

    // clean destination first if needed, or just overwrite
    if (fs.existsSync(DEST_DIR)) {
        fs.rmSync(DEST_DIR, { recursive: true, force: true });
    }

    copyRecursiveSync(SOURCE_DIR, DEST_DIR);

    console.log('TypeChain types copied successfully!');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
