# Pokemon NFT Marketplace - DeFi Coursework

A decentralized NFT marketplace for trading Pokemon NFTs with multiple sale mechanisms and front-running protection.

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
- Gas-efficient batch minting
- On-chain metadata storage (name, type, rarity, level)
- Owner-controlled minting with rarity/level validation
- IPFS-compatible tokenURI system

### PokemonMarketplace.sol
Multi-mechanism trading platform:
- Fixed-price sales with instant purchase
- English auctions with time-based bidding
- Dutch auctions with linear price decay
- Commit-reveal for front-running protection
- Seller cancel functions for all sale types

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

### Test Coverage
- **30 total tests** across 3 test files
- **100% passing** on all core functionality

#### Test Files
1. `test/PokemonMarketplace.test.ts` - Core marketplace (fixed-price, auctions)
2. `test/PokemonMarketplace_Dutch.test.ts` - Dutch auction mechanics
3. `test/PokemonMarketplace_CommitReveal.test.ts` - Security features (13 tests)

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

### Local Development
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy locally
npx hardhat node
npx hardhat run scripts/deploy_and_mint_all.ts --network localhost
```

### Scripts
- `scripts/generate_metadata.ts` - Generate 100 Pokemon metadata JSONs
- `scripts/deploy_and_mint_all.ts` - Deploy contracts and mint full collection
- `scripts/visual_demo.ts` - Interactive demo of marketplace features

## NFT Collection

### Metadata Generation
100 Pokemon NFTs with controlled rarity distribution:
- **5 Legendary** (rarity 5): Mewtwo, Lugia, Rayquaza, Arceus, Giratina
- **15 Rare** (rarity 4): Charizard, Dragonite, Tyranitar, etc.
- **80 Common** (rarity 1-3): Pikachu, Bulbasaur, Squirtle, etc.

### Rarity Rules
- Level increases with rarity (Legendary: 70-100, Common: 1-50)
- Each Pokemon has unique attributes (name, type, level)
- Metadata stored in `nft_metadata/` as JSON files

## Gas Optimization

- **ERC721A** for batch minting (~60% gas savings vs ERC721)
- **Pull payment pattern** prevents gas griefing
- **Batch operations** for collection deployment
- **Storage packing** in structs

## Security Considerations

### Implemented Protections
✅ Reentrancy guards (OpenZeppelin)  
✅ Integer overflow protection (Solidity 0.8+)  
✅ Pull over push payments  
✅ Checks-Effects-Interactions pattern  
✅ Front-running mitigation (commit-reveal)  
✅ Stale listing protection  
✅ Emergency pause mechanism  

### Known Trade-offs
- Commit-reveal adds ~85% gas overhead vs direct buy
- Requires 2 transactions (commit + reveal)
- 1-255 block time window for reveals
- **Justified**: Security benefit outweighs UX cost for high-value NFTs

## Documentation

- [SECURITY.md](./SECURITY.md) - Detailed security documentation
- [walkthrough.md](../brain/.../walkthrough.md) - Implementation walkthrough
- Contract NatSpec comments for all public functions

## Coursework Compliance

✅ **ERC721 Implementation** (ERC721A variant)  
✅ **Trading Contract** with multiple mechanisms  
✅ **Front-Running Mitigation** (commit-reveal)  
✅ **Secure Minting** with access control  
✅ **Comprehensive Testing** (30 tests)  
✅ **Gas Optimization** (ERC721A, batch operations)  
✅ **Documentation** (README, SECURITY.md, NatSpec)  

## License

MIT

## Author

Rajat - UCL DeFi Coursework 2026
