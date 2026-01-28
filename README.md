# Pokemon NFT Marketplace - DeFi Coursework

A decentralized NFT marketplace for trading Pokemon NFTs with multiple sale mechanisms and front-running protection.

## 🚀 Deployed Contracts (Local Testnet)

- **PokemonNFT:** `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **PokemonMarketplace:** `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853`
- **Network:** Hardhat Local (localhost:8545)

### IPFS Metadata Storage

- **CID:** `bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4`
- **Base URI:** `https://ipfs.io/ipfs/bafybeiely5mtvdm3yq3js7lwk7m4sbeialgwapibe7jpv3qpomxmfi5ly4/`
- **Total NFTs:** 100
- **Status:** ✅ All metadata accessible

## Features

### Core Functionality
- ✅ **ERC721A NFT Contract** with Pokemon metadata (name, type, rarity, level)
- ✅ **Fixed-Price Listings** with 1% marketplace fee
- ✅ **English Auctions** with competitive bidding
- ✅ **Dutch Auctions** with declining prices over time
- ✅ **Batch Minting** for gas-efficient collection deployment
- ✅ **Pull Payment Pattern** for secure fund withdrawals

### Security Features (Coursework Requirement)
- ✅ **Commit-Reveal Scheme** for front-running protection on purchases
- ✅ **Stale Listing Protection** verifies NFT ownership before transfer
- ✅ **Reentrancy Guards** on all state-changing functions
- ✅ **Pausable** emergency stop mechanism
- ✅ **Access Control** with Ownable pattern

### Business Logic
- Legendary Pokemon (rarity 5) can only be sold via auction
- Dutch auctions require rarity 4+ and specific price ranges
- Rarity-based restrictions with graceful fallback for generic ERC721

## Smart Contracts

### PokemonNFT.sol
ERC721A-based NFT contract with Pokemon-specific metadata:
- Gas-efficient batch minting (~60% gas savings vs standard ERC721)
- On-chain metadata storage (name, type, rarity, level)
- Owner-controlled minting with rarity/level validation
- Supply constraints (5 Legendary, 25 Rare, 70 Common)
- IPFS-compatible tokenURI system

### PokemonMarketplace.sol
Multi-mechanism trading platform:
- Fixed-price sales with instant purchase
- English auctions with time-based bidding
- Dutch auctions with linear price decay
- Commit-reveal for front-running protection
- Seller cancel functions for all sale types
- 1% marketplace fee with pull payment pattern

## Front-Running Mitigation

### Why Commit-Reveal?

The coursework requires front-running prevention for sensitive operations. We implemented a two-phase commit-reveal scheme:

**Phase 1 - Commit**: User hides their intent by submitting a hash
```javascript
const commitHash = keccak256(nftContract, tokenId, maxPrice, nonce);
await marketplace.commitToBuy(commitHash, { value: maxPrice });
```

**Phase 2 - Reveal**: After 1+ blocks, user reveals and executes
```javascript
await marketplace.revealAndBuyFixedPrice(nftContract, tokenId, maxPrice, nonce);
```

### Scope: Buys Only, Not Bids

**Commit-reveal is applied to fixed-price and Dutch auction purchases only.**

**Why not auctions?**
- **Fixed-price**: Direct front-running risk (attacker copies transaction)
- **Dutch auctions**: Sniping risk (optimal prices can be front-run)
- **Auctions**: Self-correcting - if front-run, simply bid higher. The auction format inherently mitigates front-running through competitive bidding.

Adding commit-reveal to auctions would increase UX complexity without meaningful security benefit.

## Design Decisions

### PokemonNFT Import
The marketplace imports `PokemonNFT.sol` directly to read metadata for sale restrictions:

```solidity
import "./PokemonNFT.sol";
```

**Rationale**:
- Enables rarity-based business logic (Legendary = auction only)
- Uses `try/catch` for compatibility with generic ERC721
- Only reads data, never modifies NFT state
- Falls back gracefully for non-Pokemon NFTs

This design allows Pokemon-specific rules while maintaining ERC721 compatibility.

## Testing

### Test Results
```
✅ 30 tests passing
✅ 0 failing
✅ All security features verified
✅ Gas optimization confirmed
```

### Test Coverage
- **30 total tests** across 6 test files
- **100% passing** on all core functionality

#### Test Files
1. `test/PokemonMarketplace.test.ts` - Core marketplace (fixed-price, auctions)
2. `test/PokemonMarketplace_Dutch.test.ts` - Dutch auction mechanics
3. `test/PokemonMarketplace_CommitReveal.test.ts` - Security features (commit-reveal)
4. `test/PokemonMarketplace_CommitmentRecovery.test.ts` - Commitment cancellation
5. `test/PokemonMarketplace_FeePause.test.ts` - Fees and emergency controls
6. `test/PokemonNFT_Supply.test.ts` - Supply constraints

#### Commit-Reveal Tests
✅ Successful commit-reveal flows (fixed-price & Dutch)  
✅ Commitment expiration handling  
✅ Stale listing detection  
✅ Pull pattern refunds  
✅ Cancel functions (listing, auction, Dutch auction)  
✅ Error cases (no commitment, wrong parameters)

### Run Tests
```bash
npx hardhat test                    # All tests
npx hardhat test --grep "Commit"    # Security tests only
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
npx hardhat node                                              # Terminal 1
npx hardhat run scripts/deploy_and_mint_all.ts --network localhost  # Terminal 2
```

### Scripts
- `scripts/generate_metadata_with_pokeapi.ts` - Generate 100 Pokemon metadata with real PokeAPI images
- `scripts/deploy_and_mint_all.ts` - Deploy contracts and mint full collection
- `scripts/visual_demo.ts` - Interactive demo of marketplace features

## NFT Collection

### Collection Details
100 Pokemon NFTs with official artwork from PokeAPI:
- **5 Legendary** (rarity 5, tokens 0-4): Mewtwo, Lugia, Rayquaza, Arceus, Giratina
- **25 Rare** (rarity 4, tokens 5-29): Charizard, Blastoise, Venusaur, Dragonite, etc.
- **70 Common** (rarity 1-3, tokens 30-99): Pikachu, Bulbasaur, Charmander, Squirtle, etc.

### Rarity Rules
- **Legendary (Level 80-100):** Auction-only restriction
- **Rare (Level 40-79):** Flexible sale options
- **Common (Level 1-39):** Fixed-price preferred
- Each Pokemon has unique attributes (name, type, level, Pokedex number)
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

Both URLs are live and accessible!

## Gas Optimization

- **ERC721A** for batch minting (~60% gas savings vs ERC721)
- **Pull payment pattern** prevents gas griefing
- **Batch operations** for collection deployment
- **Storage packing** in structs
- **Custom errors** instead of require strings

## Security Considerations

### Implemented Protections
✅ Reentrancy guards (OpenZeppelin)  
✅ Integer overflow protection (Solidity 0.8+)  
✅ Pull over push payments  
✅ Checks-Effects-Interactions pattern  
✅ Front-running mitigation (commit-reveal)  
✅ Stale listing protection  
✅ Emergency pause mechanism  
✅ Access control (Ownable pattern)

### Trade-offs
- Commit-reveal adds ~85% gas overhead vs direct buy
- Requires 2 transactions (commit + reveal)
- 1-255 block time window for reveals
- **Justified**: Security benefit outweighs UX cost for high-value NFTs

## Documentation

- **[SECURITY.md](./SECURITY.md)** - Detailed security analysis and front-running mitigation
- **Contract NatSpec** - Comprehensive inline documentation
- **Test suite** - Living documentation of functionality

## Coursework Compliance

✅ **ERC721 Implementation** (ERC721A variant for gas efficiency)  
✅ **Trading Contract** with multiple sale mechanisms  
✅ **Front-Running Mitigation** (commit-reveal scheme)  
✅ **Security Features** (reentrancy, access control, pausable)  
✅ **Comprehensive Testing** (30 tests, 100% passing)  
✅ **Gas Optimization** (ERC721A, pull payments, batch operations)  
✅ **Documentation** (README, SECURITY.md, NatSpec comments)  
✅ **IPFS Integration** (decentralized metadata storage)



**Built with:** Solidity, Hardhat, OpenZeppelin, ERC721A, IPFS, PokeAPI  
**Repository:** https://github.com/Spitfirator/DeFi-Coursework  
**Branch:** rajat