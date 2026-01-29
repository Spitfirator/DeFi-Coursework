const { keccak256, toUtf8Bytes } = require('ethers');

const errors = [
    "PriceMustBeAboveZero()",
    "NotOwnerOfToken()",
    "NotApprovedForMarketplace()",
    "ItemAlreadyListed()",
    "ItemNotListed()",
    "IncorrectPrice()",
    "AuctionAlreadyActive()",
    "AuctionNotActive()",
    "AuctionHasEnded()",
    "AuctionStillActive()",
    "BidTooLow()",
    "SellerCannotBid()",
    "NoFundsToWithdraw()",
    "TransferFailed()",
    "DurationTooShort()",
    "InvalidSaleTypeForRarity()",
    "InvalidPriceRange()",
    "StaleListing()",
    "NoCommitment()",
    "CommitmentTooEarly()",
    "CommitmentExpired()",
    "InvalidCommitment()",
    "HasActiveBids()"
];

console.log("Searching for selector 0x4c084f14...");

errors.forEach(err => {
    const hash = keccak256(toUtf8Bytes(err));
    const selector = hash.slice(0, 10);
    console.log(`${selector} : ${err}`);
    if (selector === "0x4c084f14") {
        console.log(">>> MATCH FOUND: " + err);
    }
});
