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
│   ├── PokemonCard.sol    # ERC721 NFT contract
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
cd DeFi-Coursework
npm install
```

2. **Start local blockchain**
```bash
npm run node
```

3. **Deploy contracts** (in a new terminal)
```bash
npm run deploy:local
```

4. **Configure frontend**
```bash
cd frontend
cp .env.example .env
# Update .env with deployed contract addresses from step 3
npm install
```

5. **Start frontend**
```bash
npm start
```

6. **Configure MetaMask**
   - Add Hardhat network: RPC URL `http://127.0.0.1:8545`, Chain ID `31337`
   - Import a test account using private key from Hardhat node output

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

## 🔐 Security Features

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
