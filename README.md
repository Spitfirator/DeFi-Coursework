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

### Security Features
- **Commit-Reveal Scheme** for front-running protection on auction bids
- **Reentrancy Guards** on all state-changing functions across all 5 contracts
- **Pausable** emergency stop mechanism on all 5 contracts
- **Access Control** with role-based permissions (MINTER_ROLE, PAUSER_ROLE, TRAINER_ROLE)
- **Pull Payment Pattern** prevents gas griefing
- **Egg Trading Restrictions** prevent trading unhatched eggs on the marketplace

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

## Front-Running Mitigation

### Why Commit-Reveal?

The coursework requires front-running prevention for sensitive operations. We implemented a two-phase commit-reveal scheme for auction bids:

**Phase 1 - Commit**: Bidder hides their intent by submitting a hash
```javascript
const commitHash = keccak256(abi.encodePacked(bidder, amount, secret));
await trading.commitBid(tokenId, commitHash);
```

**Phase 2 - Reveal**: Bidder reveals and places their actual bid
```javascript
await trading.revealBid(tokenId, secret, { value: bidAmount });
```

### Scope

**Commit-reveal is applied to English auction bids.** A direct `placeBid()` function is also available as a simpler alternative.

Fixed-price purchases (`buyCard`) and Dutch auction purchases (`buyDutchAuction`) are direct single-transaction operations.

## Design Decisions

### PokemonCard Import
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

## Testing

### Test Coverage
- **125 tests** across 4 test files
- Covers all 5 contracts (PokemonCard, PokemonTrading, DayCare, EvolutionManager, Hatchery)

#### Test Files
1. `test/PokemonCard.test.js` - NFT minting, metadata, access control, egg/hatch mechanics, emergency pause
2. `test/PokemonTrading.test.js` - Fixed-price listings, English/Dutch auctions, commit-reveal security, NFT swaps, withdrawals, emergency pause
3. `test/DayCare.test.js` - Staking, time-based levelling, stat boosts, emergency pause
4. `test/EvolutionManager.test.js` - Evolution paths, burn-and-mint mechanics, stat persistence, emergency pause

### Run Tests
```bash
npx hardhat test                    # All tests (125 passing)
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
- `scripts/visual_demo.ts` - Interactive demo of marketplace features

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

## Security Considerations

### Implemented Protections
- Reentrancy guards (OpenZeppelin ReentrancyGuard on all 5 contracts)
- Integer overflow protection (Solidity 0.8.20)
- Pull over push payments (secure withdrawal pattern)
- Checks-Effects-Interactions pattern
- Front-running mitigation (commit-reveal scheme for auction bids)
- Emergency pause mechanism (Pausable on all 5 contracts: PokemonCard, PokemonTrading, DayCare, EvolutionManager, Hatchery)
- Role-based access control (AccessControl / Ownable)
- Custom errors for gas-efficient reverts

## Documentation

- **[SECURITY.md](./SECURITY.md)** - Detailed security analysis and front-running mitigation
- **Contract NatSpec** - Comprehensive inline documentation
- **Test suite** - Living documentation of functionality

## Contributors

This project was developed as a pair programming effort for the DeFi Coursework assignment.

### Individual Contributions

**Hector**
- Core smart contract architecture (PokemonCard, PokemonTrading) 
- UI/frontend
- Deployment infrastructure and scripts
- Merged and applied IPFS integration for NFT metadata storage to work into main project
- Security documentation
- MetaMask rollback detection fix
- Emergency pause implementation across all contracts
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
- 
- Testing

### AI Tools Used
- **Claude** - AI-assisted development for code generation, debugging, security analysis, and documentation
- **Antigravity** - AI-assisted development

Understanding of all project components and can explain any part of the codebase during evaluation.

## Coursework Compliance

- **ERC721 Implementation** (OpenZeppelin ERC721 + ERC721Enumerable + ERC721URIStorage)
- **Trading Contract** with multiple sale mechanisms (fixed-price, English auction, Dutch auction, swaps)
- **Front-Running Mitigation** (commit-reveal scheme for auction bids)
- **Security Features** (reentrancy guards, access control, emergency pause on all 5 contracts, pull payments)
- **Comprehensive Testing** (125 tests across 4 files covering all contracts)
- **Gas Optimization** (custom errors, pull payments, storage packing)
- **Documentation** (README, SECURITY.md, NatSpec comments, individual contributions)
- **IPFS Integration** (decentralized metadata storage with 100 Pokemon NFTs)
- **Additional Features** (DayCare staking, evolution, breeding/hatching)


**Built with:** Solidity, Hardhat, OpenZeppelin, IPFS, PokeAPI
**Repository:** https://github.com/Spitfirator/DeFi-Coursework