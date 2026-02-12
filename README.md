# Pokemon NFT Marketplace - DeFi Coursework

A decentralized NFT marketplace for trading Pokemon NFTs with multiple sale mechanisms, breeding, evolution, and front-running protection.

## Tech Stack

- **Smart Contracts**: Solidity 0.8.20, OpenZeppelin Contracts v5 (ERC721, AccessControl, Pausable, ReentrancyGuard)
- **Development**: Hardhat, ethers.js v6, Hardhat Toolbox, solidity-coverage, hardhat-gas-reporter
- **Frontend**: React 18, React Router v6, Tailwind CSS, ethers.js v6
- **Storage**: IPFS (NFT metadata), on-chain (Pokemon stats)
- **Wallet**: MetaMask (via BrowserProvider)

## Architecture Overview

For detailed architecture diagrams, see the PDF report.

The application follows a three-layer architecture: smart contracts on a local Hardhat blockchain, a React frontend, and MetaMask as the wallet bridge.

**Smart Contract Layer** — Five Solidity contracts deployed to Hardhat's local network. `PokemonCard` is the central ERC721 NFT contract that all other contracts interact with via the `IPokemonCardStats` interface. `PokemonTrading` handles marketplace operations (listings, auctions, swaps). Three auxiliary contracts — `DayCare`, `EvolutionManager`, and `Hatchery` — provide staking, evolution, and breeding mechanics respectively. Inter-contract access is governed by role-based permissions: `MINTER_ROLE` (granted to Hatchery for egg minting), `TRAINER_ROLE` (granted to DayCare, EvolutionManager, and Hatchery for stat updates), and `PAUSER_ROLE` (granted to admin for emergency stops).

**Frontend Layer** — A React 18 single-page application using `Web3Context` for wallet and contract state management and `CartContext` for shopping cart state. Nine pages cover the full feature set: Home (landing + trending), Marketplace (buy/sell), Collection (browse all NFTs), My Cards (personal portfolio), Card Detail, DayCare, Evolution, and Hatchery. Reusable components include modals for listing, auctioning, and swapping, a filter sidebar with search, and a cart overlay with batch checkout.

**Wallet Integration** — MetaMask's `BrowserProvider` handles both reads and transaction signing. When Hardhat node restarts, MetaMask can retain stale block numbers causing "invalid block tag" errors. The frontend detects these errors and displays a user-facing message prompting the user to force-quit their browser and reopen it for easiest fix. The frontend also listens for account and chain changes, auto-reconnects on page load, and prompts network switching to the Hardhat local network (chain ID 31337). 

## Deployed Contracts (Local Testnet)

All contracts are deployed via `scripts/deploy.js` to the Hardhat local network (localhost:8545):

- **PokemonCard** - ERC721 NFT contract
- **PokemonTrading** - Marketplace with fixed-price, English auction, Dutch auction, and swap
- **DayCare** - Staking contract for time-based levelling
- **EvolutionManager** - Burn-and-mint evolution system
- **Hatchery** - 3-stage breeding lifecycle

### IPFS Metadata Storage

- **CID:** `bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4`
- **Base URI:** `https://ipfs.io/ipfs/bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4/`
- **Total NFTs:** 100
- **Status:** All metadata accessible

## Features

### Core Functionality
- **ERC721 NFT Contract** with Pokemon metadata (name, type, rarity, stats, level, generation)
- **Fixed-Price Listings** with configurable marketplace fee (default 2.5%)
- **English Auctions** with competitive bidding, reserve prices, and bid extensions
- **Dutch Auctions** with declining prices over time
- **NFT Swaps** for direct peer-to-peer token exchanges
- **Pull Payment Pattern** for secure fund withdrawals

### DayCare (Staking)
- Stake Pokemon NFTs to earn time-based level-ups
- Configurable levelling interval (seconds per level)
- Stat boosts on unstake (+5 HP/ATK/DEF per level gained)
- Level cap at 100
- Staked NFTs are held in escrow (cannot be traded while staked)

### Evolution
- Burn-and-mint evolution mechanic
- Admin-registered evolution paths (e.g. Charmander -> Charmeleon -> Charizard)
- Level threshold requirements for evolution
- Stat boosts applied on evolution
- Preserves owner, level, and generation

### Hatchery (Breeding)
- 3-stage breeding lifecycle: breed -> mintEgg -> hatch
- Parents locked in escrow during breeding timer
- Egg NFTs are tradeable ERC721 tokens
- Offspring genetics derived from both parents (50/50 species, averaged stats with variance)
- Generation tracking (max of parents + 1)
- Legendary Pokemon cannot breed

## Smart Contracts

### PokemonCard.sol
ERC721-based NFT contract with Pokemon-specific metadata:
- OpenZeppelin ERC721 + ERC721Enumerable + ERC721URIStorage
- On-chain metadata storage (name, type, rarity, HP, attack, defense, speed, generation, level)
- Role-based access control (admin minting, trainer stat updates)
- Egg minting and hatching support (for Hatchery integration)
- Burn-and-mint support (for Evolution integration)
- IPFS-compatible tokenURI system
- Emergency pause mechanism

### PokemonTrading.sol
Multi-mechanism trading platform:
- Fixed-price sales with instant purchase
- English auctions with reserve prices, 5% minimum bid increments, and anti-sniping extensions
- Dutch auctions with linear price decay
- Commit-reveal for front-running protection on auction bids
- NFT swap requests for peer-to-peer exchanges
- Seller cancel functions for all sale types
- Configurable platform fee (basis points) with pull payment pattern
- Egg trading prevention

### DayCare.sol
Staking contract for Pokemon levelling:
- Time-based level accumulation (configurable interval)
- Flat stat boosts per level gained (HP, attack, defense)
- Level cap enforcement (max 100)
- NFTs held in escrow via ERC721Holder
- Checks-Effects-Interactions pattern throughout
- Emergency pause mechanism

### EvolutionManager.sol
Evolution system using burn-and-mint:
- Admin-registered evolution paths with level thresholds and stat boosts
- Burns old NFT and mints new evolved NFT
- Preserves owner, level, and generation
- Preview function for frontend UI
- 23 evolution paths registered at deploy (including 3-stage chains)
- Emergency pause mechanism

### Hatchery.sol
Breeding contract with 3-stage lifecycle:
- Stage 1 (breed): Lock two parent NFTs in escrow, snapshot stats
- Stage 2 (mintEgg): After breed timer, mint egg NFT and release parents
- Stage 3 (hatch): After incubation timer, hatch egg with inherited genetics
- Legendary breeding restriction
- Pseudo-random genetics with parent stat averaging and variance
- Emergency pause mechanism with PAUSER_ROLE

## Frontend

### Wallet Connection
- MetaMask integration with auto-reconnect on page load
- Automatic network switching to Hardhat local network (chain ID 31337)
- Account and chain change detection with state refresh
- Blockchain clock synchronization to avoid timestamp mismatches
- Stale block cache error detection with user-facing guidance

### Marketplace UI
- Browsable card grid with real-time updates via contract event listeners (`Listed`, `Sale`, `AuctionCreated`, `BidPlaced`, `AuctionFinalized`, etc.)
- Advanced filtering: status (Buy Now, Auctions, Dutch Auctions), price range, rarity, and all 18 Pokemon types
- Search by name with sorting options (price, ID)
- Trending section on the home page based on recent bid and sale activity

### Trading Interfaces
- **Fixed-Price Listing Modal** — set price and list instantly
- **English Auction Modal** — configure reserve price, duration, and starting bid
- **Dutch Auction Modal** — set start price, reserve price, and duration for declining-price sales
- **Swap Modal** — propose direct NFT-for-NFT exchanges with accept/reject flow

### Shopping Cart
- Add fixed-price listings to cart from the marketplace
- Cart modal with item list, total price in ETH, and batch checkout (sequential purchases)
- Per-item success/failure tracking during checkout
- Cart badge in navbar; auto-clears on account switch

### Mobile-Responsive Design
- Tailwind CSS responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`) throughout all pages
- Collapsible hamburger menu on mobile
- Filter sidebar switches between mobile drawer overlay and desktop inline panel
- Responsive grid layouts for card displays

## Design Decisions

### PokemonCard Interface
The trading and auxiliary contracts interact with `PokemonCard.sol` via interfaces to read metadata:

```solidity
interface IPokemonCardStats {
    function getPokemonStats(uint256 tokenId) external view returns (PokemonStats memory);
}
```

**Rationale**:
- Enables egg-trading prevention (marketplace checks `isEgg`)
- DayCare and EvolutionManager update stats via TRAINER_ROLE
- Hatchery mints eggs and hatches them via MINTER_ROLE and TRAINER_ROLE
- Only reads/updates data through defined roles, never bypasses access control

### Why Commit-Reveal on Auction Bids?

**Commit-reveal is applied to English auction bids.** Fixed-price purchases (`buyCard`) and Dutch auction purchases (`buyDutchAuction`) are direct single-transaction operations.

**Rationale**:
1. **Auction Bids**: Bidding strategies can be observed in the mempool and front-run by competitors. Commit-reveal hides the bid amount until reveal.
2. **Fixed-Price Listings**: The price is already public on-chain. A buyer either pays the listed price or doesn't. Front-running a fixed-price purchase has limited strategic advantage since the price doesn't change.
3. **Dutch Auctions**: The price is deterministic based on time. While sniping is possible, the declining price mechanism naturally handles this — waiting longer means a lower price but risks someone else buying first.

A direct `placeBid()` function is also available as an alternative to commit-reveal for auctions where the overhead is not desired.

## Security Considerations

### Reentrancy Protection
OpenZeppelin `ReentrancyGuard` is applied to all state-changing functions across all 5 contracts. The Checks-Effects-Interactions pattern is followed throughout.

### Integer Overflow Protection
Solidity 0.8.20 provides built-in overflow/underflow checks on all arithmetic operations.

### Access Control
Role-based access control using OpenZeppelin `AccessControl` and `Ownable`, enforced via Solidity function modifiers (`onlyRole()`, `onlyOwner`, `whenNotPaused`, `nonReentrant`) applied directly on all state-changing functions:
- **MINTER_ROLE**: Controls NFT minting (granted to deploy script and Hatchery)
- **PAUSER_ROLE**: Controls emergency pause (granted to admin)
- **TRAINER_ROLE**: Controls stat updates (granted to DayCare, EvolutionManager, Hatchery)

### Emergency Pause
All 5 contracts implement OpenZeppelin `Pausable` with `PAUSER_ROLE` access control. When paused, all state-changing operations are blocked.

### Front-Running Mitigation (Commit-Reveal Scheme)

We implemented a two-phase commit-reveal pattern on auction bids that prevents front-running by hiding the bidder's intent until after commitment.

#### Phase 1: Commit
```solidity
function commitBid(uint256 tokenId, bytes32 commitHash) external
```

Bidders generate a commitment hash off-chain:
```javascript
const commitHash = ethers.keccak256(
    ethers.solidityPacked(
        ["address", "uint256", "bytes32"],
        [bidderAddress, bidAmount, secret]
    )
);
```

The hash contains:
- **bidderAddress**: The bidder's address (`msg.sender`)
- **bidAmount**: The bid amount in wei (`msg.value` at reveal time)
- **secret**: Random value for uniqueness

The contract stores the commitment hash and timestamp without revealing the bid details.

#### Phase 2: Reveal
```solidity
function revealBid(uint256 tokenId, bytes32 secret) external payable
```

Bidders reveal their intent by providing the secret and sending ETH. The contract:
1. Reconstructs the hash from `msg.sender`, `msg.value`, and `secret` to verify it matches the commitment
2. Validates the auction is still active and has not ended
3. Places the bid via the internal `_placeBid()` function if verification passes

#### Security Properties

**Front-Running Protection**:
- Attackers cannot see the bidder's intended amount until after commitment
- By the time the reveal happens, the commitment is already on-chain
- The secret prevents replay attacks

**Commit-Reveal Period**:
- `COMMIT_REVEAL_PERIOD = 5 minutes`: Defines the time window for the commit-reveal process

**Auction Safeguards**:
- Bids must meet the 5% minimum increment over the current highest bid
- Anti-sniping: auctions extend by 10 minutes if a bid is placed in the final 10 minutes
- Previous highest bidder's funds are credited to `pendingWithdrawals` (pull pattern)

#### Usage Example

```typescript
// Phase 1: Commit
const secret = ethers.randomBytes(32);
const bidAmount = ethers.parseEther("1.0");
const commitHash = ethers.keccak256(
    ethers.solidityPacked(
        ["address", "uint256", "bytes32"],
        [bidderAddress, bidAmount, secret]
    )
);

await trading.commitBid(tokenId, commitHash);

// Wait for the appropriate reveal window...

// Phase 2: Reveal and place bid
await trading.revealBid(tokenId, secret, { value: bidAmount });
```

#### Direct Bid Path

A direct `placeBid()` function is also available as a simpler alternative for cases where commit-reveal overhead is not desired.

```typescript
// Direct bid without commit-reveal
await trading.placeBid(tokenId, { value: bidAmount });
```

**When to use each**:
- **`commitBid` + `revealBid`**: For high-value auctions where front-running protection is important
- **`placeBid`**: For lower-value auctions or when simplicity is preferred

### Pull Payment Pattern
All fund distributions use the pull pattern via `pendingWithdrawals`:
- Seller proceeds from sales are credited to `pendingWithdrawals`
- Outbid bidders' funds are credited to `pendingWithdrawals`
- Users call `withdraw()` to claim their funds
- Prevents gas griefing and reentrancy attacks

### Dutch Auction Refunds
Excess ETH from Dutch auction purchases is refunded directly via `.call{value:}`:
```solidity
if (msg.value > currentPrice) {
    (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - currentPrice}("");
    if (!refundSuccess) revert TransferFailed();
}
```

### Seller Cancel Functions
Functions allow sellers to cancel listings/auctions:

- `cancelListing()`: Cancel fixed-price listing anytime
- `cancelAuction()`: Cancel auction only if no bids exist
- `cancelDutchAuction()`: Cancel Dutch auction anytime before purchase

### Egg Trading Prevention
The marketplace checks `isEgg` via the `IPokemonCardStats` interface and reverts with `CannotTradeEgg()` if someone tries to list or auction an egg NFT. This prevents unhatched eggs from being traded on the marketplace.

### Platform Fee Separation
Platform fees are tracked separately via `accumulatedFees` and can only be withdrawn by the admin via `withdrawFees()`. This keeps user funds and platform revenue cleanly separated.

### Event Emission
All contracts emit events for every state-changing operation, enabling the frontend to update in real time. Key events include `Listed`, `Sale`, `AuctionCreated`, `BidPlaced`, `AuctionFinalized`, `ListingCancelled`, `AuctionCancelled`, `PokemonStaked`, `PokemonUnstaked`, `PokemonEvolved`, `BreedingStarted`, `EggMinted`, `PokemonHatched`, and `EmergencyStop`/`EmergencyResume`.

### Custom Errors
Gas-efficient custom errors are used instead of `require` strings throughout all contracts.

### Trade-offs

#### UX vs Security
**Cost**: Commit-reveal requires two transactions instead of one
**Benefit**: Protection against front-running attacks on auction bids
**Justification**: For high-value NFT auctions, the security benefit outweighs the UX cost

#### Gas Costs
- Commit-reveal path uses more gas than direct bidding due to the two-transaction flow
- The overhead is justified for high-value auctions where front-running is a real risk

#### Time Delay
- The commit-reveal process requires a window between commit and reveal
- `COMMIT_REVEAL_PERIOD = 5 minutes`

## Testing

### Test Coverage
- **163 tests** across 5 test files
- Covers all 5 contracts (PokemonCard, PokemonTrading, DayCare, EvolutionManager, Hatchery)

#### Test Files
1. `test/PokemonCard.test.js` - 28 tests covering NFT minting, metadata, access control, egg/hatch mechanics, emergency pause
2. `test/PokemonTrading.test.js` - 53 tests covering fixed-price listings, English/Dutch auctions, commit-reveal security, NFT swaps, withdrawals, emergency pause
3. `test/DayCare.test.js` - 26 tests covering staking, time-based levelling, stat boosts, emergency pause
4. `test/EvolutionManager.test.js` - 18 tests covering evolution paths, burn-and-mint mechanics, stat persistence, emergency pause
5. `test/Hatchery.test.js` - 38 tests covering 3-stage breeding lifecycle, parent locking, egg minting/hatching, genetics inheritance, emergency pause

### Run Tests
```bash
npx hardhat test                    # All tests (163 passing)
npx hardhat test --grep "Commit"    # Security tests only
npx hardhat test --grep "Dutch"     # Dutch auction tests only
npx hardhat test --grep "Pausable"  # Emergency stop tests only
```

## Deployment

### Quick Start
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy locally
npx hardhat node                                       # Terminal 1
npx hardhat run scripts/deploy.js --network localhost  # Terminal 2

# Start frontend
cd frontend && npm install && npm start                # Terminal 3
```

### Scripts
- `scripts/deploy.js` - Deploy all contracts, register evolution paths, and mint full collection
- `scripts/generate_metadata_with_pokeapi.ts` - Generate 100 Pokemon metadata with real PokeAPI images

## NFT Collection

### Collection Details
100 Pokemon NFTs with official artwork from PokeAPI, distributed across 10 Hardhat test accounts:
- **Legendary**: Mewtwo, Lugia, Rayquaza, Arceus, Giratina
- **Rare**: Charizard, Blastoise, Venusaur, Dragonite, etc.
- **Common**: Pikachu, Bulbasaur, Charmander, Squirtle, etc.

### Rarity System
- Each Pokemon has string-based rarity: Common, Uncommon, Rare, Legendary
- Unique attributes per Pokemon (name, type, HP, attack, defense, speed, generation)
- Metadata stored on IPFS for decentralized access

### Live Examples
**Metadata (Mewtwo #0):**
```
https://ipfs.io/ipfs/bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4/0.json
```

**Pokemon Image:**
```
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png
```

## Optional Enhancements

The following optional features have been implemented:

- **Dutch Auctions** — Declining-price auction mechanism in `PokemonTrading.sol` with linear price decay
- **IPFS Integration** — All 100 NFT metadata files stored on IPFS with on-chain `tokenURI` resolution
- **Batch Trades** — Shopping cart with batch checkout for purchasing multiple fixed-price listings in one session
- **Mobile-Responsive Design** — Full Tailwind CSS responsive layout across all pages
- **Advanced Search and Filtering** — Filter by status, price range, rarity, and Pokemon type; sort by price or ID; search by name

## Individual Contributions

**Hector Gittos**
- Core smart contract architecture (PokemonCard, PokemonTrading)
- UI/frontend core
- Deployment infrastructure and scripts
- Merged and applied IPFS integration for NFT metadata storage to work into main project
- Security documentation
- MetaMask stale block cache error detection with user-facing guidance
- Emergency pause implementation across all contracts
- Code cleanup 
- Testing

**Rajat Durge**
- Dutch auction implementation in PokemonTrading
- ERC721A research
- Landing page designer
- UI/frontend for implemented features
- NFT swap feature (peer-to-peer token exchanges)
- Shopping cart functionality in frontend
- Implemented IPFS integration for NFT metadata storage
- Frontend contributions
- Testing

**Jacob Jewitt**
- Found the PokeAPI sprites GitHub library
- Complete DayCare, EvolutionManager, Hatchery implementation and their UI/UX
- DayCare staking contract
- EvolutionManager contract
- Hatchery breeding contract
- Frontend components for auxiliary features
- Code Cleanup
- Testing

### AI Tools Used
- **Claude** - AI-assisted development for code generation, debugging, security analysis, and documentation
- **Antigravity** - AI-assisted development
