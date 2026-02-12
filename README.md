# Pokemon NFT Marketplace - DeFi Coursework

A decentralized NFT marketplace for trading Pokemon NFTs with multiple sale mechanisms, breeding, evolution, and front-running protection.

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
Role-based access control using OpenZeppelin `AccessControl` and `Ownable`:
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
cd frontend && npm start                               # Terminal 3
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
