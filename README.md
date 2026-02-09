# Pokemon Card Trading dApp

A decentralized application (dApp) for trading Pokemon cards as NFTs on the Ethereum blockchain. Built with Solidity, Hardhat, React, and ethers.js.

## 🎮 Features

### Smart Contracts
- **ERC721 NFT Contract**: Pokemon cards with comprehensive metadata (name, type, rarity, stats)
- **Trading Contract**: Fixed-price sales and English auctions
- **Security Features**: Reentrancy guards, access control, emergency stop, secure withdrawal patterns

### Frontend
- Modern React UI with Tailwind CSS
- MetaMask wallet integration
- Real-time marketplace updates via event listeners
- Card browsing, listing, buying, and auction functionality

## 📁 Project Structure

```
├── contracts/              # Solidity smart contracts
│   ├── PokemonCard.sol    # ERC721 NFT contractgit pull origin Jacob --allow-unrelated-histories
│   └── PokemonTrading.sol # Trading marketplace contract
├── test/                   # Contract test suite
│   ├── PokemonCard.test.js
│   └── PokemonTrading.test.js
├── scripts/                # Deployment scripts
│   └── deploy.js
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context (Web3)
│   │   └── contracts/     # Contract ABIs
│   └── public/
├── hardhat.config.js       # Hardhat configuration
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn
- MetaMask browser extension

### Installation

1. **Install dependencies**
```bash
npm install
cd frontend && npm install && cd ..
```

2. **Start local blockchain** (Terminal 1)
```bash
npm run node
```

3. **Deploy contracts** (Terminal 2)
```bash
npm run deploy:local
```
This deploys contracts and automatically updates `frontend/.env` with addresses.

4. **Start frontend** (Terminal 3)
```bash
cd frontend
npm start
```
Opens at http://localhost:3000

5. **Configure MetaMask**
   - Add Hardhat network: RPC URL `http://127.0.0.1:8545`, Chain ID `31337`
   - Import test accounts using private keys from Hardhat node output

### Test Account Private Keys (Hardhat Default)
```
Account 0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Account 1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Account 2: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

### Testing the App

1. **View your cards**: Go to "My Cards" - each test account has 10 Pokemon cards
2. **List a card for sale**: Hover over a card → Click "List" → Set price → Confirm in MetaMask
3. **Buy a card**: Switch MetaMask to a different account → Go to "Marketplace" → Click a card → "Buy Now"
4. **Create an auction**: "My Cards" → Hover card → "Auction" → Set starting/reserve price and duration
5. **Place a bid**: Switch account → "Marketplace" → "Auctions" tab → Select auction → Place bid
6. **Finalize auction**: After auction ends, click "Finalize Auction" to transfer NFT to winner
7. **Withdraw funds**: After selling, click "Withdraw" button to collect your ETH

### Stopping the App
```bash
# Kill frontend (port 3000)
lsof -ti:3000 | xargs kill -9

# Kill Hardhat node (port 8545)
lsof -ti:8545 | xargs kill -9
```

### Troubleshooting
- **"Failed to load cards"**: Redeploy contracts with `npm run deploy:local`
- **Transaction stuck/failing**: In MetaMask → Settings → Advanced → Clear activity tab data
- **After restarting Hardhat node**: Must redeploy contracts AND clear MetaMask activity

## 🏗️ Architecture

### Smart Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PokemonCard.sol                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │   ERC721    │  │ ERC721       │  │   AccessControl   │   │
│  │ Enumerable  │  │ URIStorage   │  │   (Roles)         │   │
│  └─────────────┘  └──────────────┘  └───────────────────┘   │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │  Pausable   │  │ Reentrancy   │                          │
│  │ (Emergency) │  │   Guard      │                          │
│  └─────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PokemonTrading.sol                        │
│  ┌──────────────────┐  ┌────────────────────────────────┐   │
│  │  Fixed-Price     │  │        Auctions                │   │
│  │   Listings       │  │  - English auction             │   │
│  │  - List/Cancel   │  │  - Reserve price               │   │
│  │  - Buy           │  │  - Bid extension               │   │
│  │  - Update price  │  │  - Commit-reveal (optional)    │   │
│  └──────────────────┘  └────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Security Features                        │   │
│  │  - Pull payment pattern (pendingWithdrawals)         │   │
│  │  - Reentrancy guards                                 │   │
│  │  - Access control                                    │   │
│  │  - Emergency pause                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Web3Context                          │  │
│  │  - Wallet connection                                  │  │
│  │  - Contract instances                                 │  │
│  │  - Network management                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌─────────────┬─────────────┼─────────────┬────────────┐   │
│  │   Home      │ Marketplace │  MyCards    │ CardDetail │   │
│  │   Page      │    Page     │    Page     │    Page    │   │
│  └─────────────┴─────────────┴─────────────┴────────────┘   │
│                              │                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Shared Components                        │  │
│  │  - Navbar, PokemonCard, Modals                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## � IPFS Integration

NFT metadata is stored on IPFS for decentralized, permanent storage following the OpenSea metadata standard.

### IPFS Configuration
- **IPFS CID**: `bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4`
- **Gateway URL**: `https://ipfs.io/ipfs/bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4/`
- **Pinning Service**: Pinata

### Metadata Structure
Each token's metadata follows the OpenSea/ERC721 metadata standard:
```json
{
  "name": "Mewtwo #0",
  "description": "A legendary Psychic-type Pokemon NFT",
  "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
  "external_url": "https://pokeapi.co/api/v2/pokemon/150",
  "attributes": [
    { "trait_type": "Pokemon", "value": "Mewtwo" },
    { "trait_type": "Rarity", "value": "Legendary" },
    { "trait_type": "Type", "value": "Psychic" },
    { "trait_type": "Level", "value": 80 }
  ]
}
```

### Collection Distribution
- **100 Total Pokemon NFTs**
- **5 Legendary** (Tokens 0-4): Mewtwo, Lugia, Rayquaza, Arceus, Giratina
- **25 Rare** (Tokens 5-29): Charizard, Blastoise, Venusaur, Gengar, Dragonite, etc.
- **70 Common** (Tokens 30-99): Pikachu, Bulbasaur, Charmander, Squirtle, etc.

### Uploading Your Own Metadata
1. Modify files in `nft_metadata/` folder
2. Upload to [Pinata](https://pinata.cloud) (free account)
3. Update `IPFS_CID` in `scripts/deploy.js`
4. Run deployment script

## �🔐 Security Features

### 1. Reentrancy Protection
All external calls use OpenZeppelin's `ReentrancyGuard`:
```solidity
function buyCard(uint256 tokenId) external payable nonReentrant { ... }
```

### 2. Access Control
Role-based permissions using OpenZeppelin's `AccessControl`:
- `DEFAULT_ADMIN_ROLE`: Contract owner, can manage roles and withdraw fees
- `MINTER_ROLE`: Can mint new Pokemon cards without payment
- `PAUSER_ROLE`: Can pause/unpause contract in emergencies
- `FEE_MANAGER_ROLE`: Can update platform fee

### 3. Pull Payment Pattern
Funds are not sent directly; instead, they accumulate in `pendingWithdrawals`:
```solidity
// Seller receives funds after sale
pendingWithdrawals[seller] += sellerProceeds;

// Seller withdraws when ready
function withdraw() external nonReentrant {
    uint256 amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success);
}
```

### 4. Emergency Stop (Pausable)
Admin can pause all operations in case of emergency:
```solidity
function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
    emit EmergencyStop(msg.sender);
}
```

### 5. Front-Running Prevention
Optional commit-reveal scheme for auctions:
```solidity
// Step 1: Commit bid hash
function commitBid(uint256 tokenId, bytes32 commitHash) external;

// Step 2: Reveal actual bid
function revealBid(uint256 tokenId, bytes32 secret) external payable;
```

### 6. Integer Overflow Protection
Solidity 0.8+ provides built-in overflow checks. Custom errors are used for gas efficiency:
```solidity
error InsufficientPayment();
error BidTooLow();
```

### 7. Event Emission
Comprehensive events for all state changes:
```solidity
event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
event Sale(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
```

## 📊 Contract Functions

### PokemonCard.sol

| Function | Description |
|----------|-------------|
| `mintPokemon()` | Public minting with payment |
| `adminMint()` | Admin minting (MINTER_ROLE) |
| `getPokemonStats()` | Get Pokemon metadata |
| `setMintPrice()` | Update mint price (ADMIN) |
| `pause()/unpause()` | Emergency controls (PAUSER) |

### PokemonTrading.sol

| Function | Description |
|----------|-------------|
| `listCard()` | List card for fixed-price sale |
| `cancelListing()` | Cancel active listing |
| `buyCard()` | Purchase listed card |
| `createAuction()` | Start an auction |
| `placeBid()` | Place auction bid |
| `finalizeAuction()` | Complete auction after end |
| `withdraw()` | Withdraw pending funds |

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

### Test Coverage
- PokemonCard: Minting, access control, pausable, enumerable
- PokemonTrading: Listings, auctions, bidding, withdrawals, edge cases

## 📝 Technical Decisions

### Why ERC721Enumerable?
Enables efficient iteration over user's tokens without off-chain indexing, crucial for the "My Cards" feature.

### Why Pull Payment Pattern?
Prevents reentrancy attacks and DoS attacks where a malicious contract rejects payments.

### Why Commit-Reveal for Auctions?
Prevents front-running where miners or MEV bots can see pending bids and outbid them.

### Why Hardhat?
- Excellent TypeScript support
- Built-in local network
- Great debugging with console.log
- Comprehensive plugin ecosystem

## 🛠️ Development Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Start local node
npm run node

# Deploy to local network
npm run deploy:local

# Lint Solidity
npm run lint

# Clean artifacts
npm run clean
```

---

**UCL DeFi Coursework 1** - Pokemon Card Trading dApp
