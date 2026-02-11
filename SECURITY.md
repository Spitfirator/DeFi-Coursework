# Pokemon NFT Marketplace - Security Documentation

## Front-Running Mitigation (Coursework Requirement)

### Problem Statement
The coursework explicitly requires front-running mitigation for sensitive operations. In our marketplace, the following functions are vulnerable to front-running attacks:

1. **`buyCard()`** - A malicious actor can observe a pending buy transaction and front-run it with a higher gas price
2. **`buyDutchAuction()`** - Snipers can copy buy transactions at optimal prices
3. **`placeBid()`** - Bidding strategies can be observed and copied

### Solution: Commit-Reveal Scheme

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

### Usage Example

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

### Direct Bid Path

A direct `placeBid()` function is also available as a simpler alternative for cases where commit-reveal overhead is not desired.

```typescript
// Direct bid without commit-reveal
await trading.placeBid(tokenId, { value: bidAmount });
```

**When to use each**:
- **`commitBid` + `revealBid`**: For high-value auctions where front-running protection is important
- **`placeBid`**: For lower-value auctions or when simplicity is preferred

## Additional Security Features

### 1. Pull Payment Pattern
All fund distributions use the pull pattern via `pendingWithdrawals`:
- Seller proceeds from sales are credited to `pendingWithdrawals`
- Outbid bidders' funds are credited to `pendingWithdrawals`
- Users call `withdraw()` to claim their funds
- Prevents gas griefing and reentrancy attacks

### 2. Dutch Auction Refunds
Excess ETH from Dutch auction purchases is refunded directly via `.call{value:}`:
```solidity
if (msg.value > currentPrice) {
    (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - currentPrice}("");
    if (!refundSuccess) revert TransferFailed();
}
```

### 3. Seller Cancel Functions
Functions allow sellers to cancel listings/auctions:

- `cancelListing()`: Cancel fixed-price listing anytime
- `cancelAuction()`: Cancel auction only if no bids exist
- `cancelDutchAuction()`: Cancel Dutch auction anytime before purchase

This improves UX and prevents sellers from being locked into sales.

### 4. Egg Trading Prevention
The marketplace checks `isEgg` via the `IPokemonCardStats` interface and reverts with `CannotTradeEgg()` if someone tries to list or auction an egg NFT. This prevents unhatched eggs from being traded on the marketplace.

### 5. Platform Fee Separation
Platform fees are tracked separately via `accumulatedFees` and can only be withdrawn by the admin via `withdrawFees()`. This keeps user funds and platform revenue cleanly separated.

## Trade-offs

### UX vs Security
**Cost**: Commit-reveal requires two transactions instead of one
**Benefit**: Protection against front-running attacks on auction bids
**Justification**: For high-value NFT auctions, the security benefit outweighs the UX cost

### Gas Costs
- Commit-reveal path uses more gas than direct bidding due to the two-transaction flow
- The overhead is justified for high-value auctions where front-running is a real risk

### Time Delay
- The commit-reveal process requires a window between commit and reveal
- `COMMIT_REVEAL_PERIOD = 5 minutes`

## Testing

Comprehensive test suite covering commit-reveal security:

- `test/PokemonMarketplace_CommitReveal.test.ts` - 11 tests covering commit-reveal flows
- `test/PokemonMarketplace_CommitmentRecovery.test.ts` - 7 tests covering commitment edge cases
- `test/PokemonMarketplace_FeePause.test.ts` - 4 tests covering fees and emergency controls

Additional test coverage across all contracts:
- `test/PokemonCard.test.js` - 28 tests for NFT minting and access control
- `test/PokemonTrading.test.js` - 44 tests for marketplace operations
- `test/DayCare.test.js` - 22 tests for staking and levelling
- `test/EvolutionManager.test.js` - 15 tests for evolution mechanics

**141 total tests** across 10 test files.

## Design Decisions

### Why Commit-Reveal on Auction Bids?

**Commit-reveal is applied to English auction bids.** Fixed-price purchases (`buyCard`) and Dutch auction purchases (`buyDutchAuction`) are direct single-transaction operations.

**Rationale**:
1. **Auction Bids**: Bidding strategies can be observed in the mempool and front-run by competitors. Commit-reveal hides the bid amount until reveal.
2. **Fixed-Price Listings**: The price is already public on-chain. A buyer either pays the listed price or doesn't. Front-running a fixed-price purchase has limited strategic advantage since the price doesn't change.
3. **Dutch Auctions**: The price is deterministic based on time. While sniping is possible, the declining price mechanism naturally handles this - waiting longer means a lower price but risks someone else buying first.

A direct `placeBid()` function is also available as an alternative to commit-reveal for auctions where the overhead is not desired.

### PokemonCard Interface Design

The marketplace interacts with `PokemonCard.sol` via an interface:
```solidity
interface IPokemonCardStats {
    struct PokemonStats { ... }
    function getPokemonStats(uint256 tokenId) external view returns (PokemonStats memory);
}
```

**Rationale**:
- Enables egg-trading prevention (marketplace checks `isEgg` before listing/auctioning)
- Loose coupling via interface rather than direct import
- Only reads data, never modifies NFT state

## Conclusion

This implementation addresses the coursework requirement for front-running mitigation while maintaining usability and adding additional security improvements. The commit-reveal scheme is a well-established cryptographic pattern used in production DeFi protocols like ENS (Ethereum Name Service) for the same purpose.
