// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./PokemonNFT.sol";

/**
 * @title PokemonMarketplace
 * @notice Marketplace for trading Pokemon NFTs via fixed price or auction
 */
contract PokemonMarketplace is ReentrancyGuard, Ownable, Pausable {
    // Custom Errors
    error PriceMustBeAboveZero();
    error NotOwnerOfToken();
    error NotApprovedForMarketplace();
    error ItemAlreadyListed();
    error ItemNotListed();
    error IncorrectPrice();
    error AuctionAlreadyActive();
    error AuctionNotActive();
    error AuctionHasEnded();
    error AuctionStillActive();
    error BidTooLow();
    error SellerCannotBid();
    error NoFundsToWithdraw();
    error TransferFailed();
    error DurationTooShort();
    error InvalidSaleTypeForRarity();
    error InvalidPriceRange();
    error StaleListing();
    error NoCommitment();
    error CommitmentTooEarly();
    error CommitmentExpired();
    error InvalidCommitment();
    error HasActiveBids();

    uint256 public constant FEE_PERCENT = 100; // 1.00% (Basis points: 100/10000)
    
    // Commit-Reveal Constants
    uint256 public constant MIN_COMMIT_AGE = 1; // 1 block minimum
    uint256 public constant MAX_COMMIT_AGE = 255; // ~1 hour on most chains

    struct Listing {
        address seller;
        uint256 price;
    }

    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 endTime;
        address highestBidder;
        uint256 highestBid;
        bool active;
    }

    struct DutchAuction {
        address seller;
        uint256 startPrice;
        uint256 endPrice;
        uint256 startTime;
        uint256 duration;
        bool active;
    }

    struct Commitment {
        bytes32 commitHash;
        uint256 blockNumber;
        uint256 amount;
    }

    // Mapping: NFT Contract -> Token ID -> Listing
    mapping(address => mapping(uint256 => Listing)) public listings;
    
    // Mapping: NFT Contract -> Token ID -> Auction
    mapping(address => mapping(uint256 => Auction)) public auctions;

    // Mapping: NFT Contract -> Token ID -> DutchAuction
    mapping(address => mapping(uint256 => DutchAuction)) public dutchAuctions;

    // Mapping: Address -> Withdrawable Balance (Pull pattern)
    mapping(address => uint256) public pendingWithdrawals;
    
    // Mapping: User -> Commitment Hash -> Commitment (for commit-reveal)
    mapping(address => mapping(bytes32 => Commitment)) public commitments;

    // Events
    event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price);
    event ItemSold(address indexed nftContract, uint256 indexed tokenId, address indexed seller, address buyer, uint256 price);
    event ItemCanceled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);
    
    event AuctionCreated(address indexed nftContract, uint256 indexed tokenId, uint256 startingPrice, uint256 endTime);
    event NewBid(address indexed nftContract, uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed nftContract, uint256 indexed tokenId, address winner, uint256 amount);
    event AuctionCanceled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);

    event DutchAuctionCreated(address indexed nftContract, uint256 indexed tokenId, uint256 startPrice, uint256 endPrice, uint256 duration);
    event DutchAuctionBought(address indexed nftContract, uint256 indexed tokenId, address buyer, uint256 price);
    event DutchAuctionCanceled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);
    
    event Withdrawal(address indexed user, uint256 amount);
    
    // Commit-Reveal Events
    event BuyCommitted(address indexed buyer, bytes32 indexed commitHash, uint256 amount);
    event BuyRevealed(address indexed buyer, address indexed nftContract, uint256 indexed tokenId, uint256 price);
    event CommitmentCanceled(address indexed buyer, bytes32 indexed commitHash, uint256 amount);

    constructor() Ownable(msg.sender) {}

    // --- Modifiers ---
    modifier isTokenOwner(address nftContract, uint256 tokenId, address spender) {
        IERC721 nft = IERC721(nftContract);
        address owner = nft.ownerOf(tokenId);
        if (owner != spender) revert NotOwnerOfToken();
        if (!nft.isApprovedForAll(owner, address(this)) && nft.getApproved(tokenId) != address(this)) {
            revert NotApprovedForMarketplace();
        }
        _;
    }

    modifier notListed(address nftContract, uint256 tokenId) {
        if (listings[nftContract][tokenId].price > 0) revert ItemAlreadyListed();
        if (auctions[nftContract][tokenId].active) revert AuctionAlreadyActive();
        if (dutchAuctions[nftContract][tokenId].active) revert AuctionAlreadyActive();
        _;
    }

    // --- Admin Functions ---
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Fixed Price Functions ---

    /**
     * @notice List an NFT for fixed price sale
     */
    function listFixedPrice(
        address nftContract, 
        uint256 tokenId, 
        uint256 price
    ) 
        external 
        whenNotPaused
        isTokenOwner(nftContract, tokenId, msg.sender)
        notListed(nftContract, tokenId)
    {
        if (price == 0) revert PriceMustBeAboveZero();

        // Check Rarity Restrictions


        listings[nftContract][tokenId] = Listing(msg.sender, price);
        emit ItemListed(nftContract, tokenId, msg.sender, price);
    }

    /**
     * @notice Buy a fixed price listed item
     */
    function buyFixedPrice(address nftContract, uint256 tokenId) external payable nonReentrant whenNotPaused {
        Listing memory listing = listings[nftContract][tokenId];
        if (listing.price == 0) revert ItemNotListed();
        if (msg.value != listing.price) revert IncorrectPrice();

        // Clear listing FIRST (Checks-Effects-Interactions)
        delete listings[nftContract][tokenId];
        
        // Fee Calculation
        uint256 fee = (msg.value * FEE_PERCENT) / 10000;
        uint256 sellerAmount = msg.value - fee;

        // Add funds to seller's pending withdrawals
        pendingWithdrawals[listing.seller] += sellerAmount;
        // Add fee to owner's pending withdrawals
        pendingWithdrawals[owner()] += fee;

        // Transfer NFT
        IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemSold(nftContract, tokenId, listing.seller, msg.sender, msg.value);
    }

    /**
     * @notice Cancel a fixed price listing
     */
    function cancelListing(address nftContract, uint256 tokenId) external {
        Listing memory listing = listings[nftContract][tokenId];
        if (listing.seller != msg.sender) revert NotOwnerOfToken();
        
        delete listings[nftContract][tokenId];
        emit ItemCanceled(nftContract, tokenId, msg.sender);
    }

    // --- Commit-Reveal Functions (Front-Running Protection) ---

    /**
     * @notice Commit to buying an NFT (Phase 1 of commit-reveal)
     * @param commitHash Hash of (nftContract, tokenId, maxPrice, nonce)
     * @dev Users should generate: keccak256(abi.encodePacked(nftContract, tokenId, maxPrice, nonce))
     */
    function commitToBuy(bytes32 commitHash) external payable whenNotPaused {
        if (commitHash == bytes32(0)) revert InvalidCommitment();
        if (msg.value == 0) revert PriceMustBeAboveZero();

        // Prevent overwrite - refund previous commitment if exists
        Commitment memory existing = commitments[msg.sender][commitHash];
        if (existing.amount > 0) {
            pendingWithdrawals[msg.sender] += existing.amount;
        }

        commitments[msg.sender][commitHash] = Commitment({
            commitHash: commitHash,
            blockNumber: block.number,
            amount: msg.value
        });

        emit BuyCommitted(msg.sender, commitHash, msg.value);
    }

    /**
     * @notice Cancel a commitment and recover funds
     * @param commitHash The commitment hash to cancel
     * @dev Can be called anytime, but typically after MAX_COMMIT_AGE or if listing disappeared
     */
    function cancelCommitment(bytes32 commitHash) external {
        Commitment memory commitment = commitments[msg.sender][commitHash];
        if (commitment.amount == 0) revert NoCommitment();

        // Delete commitment
        delete commitments[msg.sender][commitHash];

        // Refund to pending withdrawals (pull pattern)
        pendingWithdrawals[msg.sender] += commitment.amount;

        emit CommitmentCanceled(msg.sender, commitHash, commitment.amount);
    }

    /**
     * @notice Reveal and execute buy for fixed price listing (Phase 2 of commit-reveal)
     * @param nftContract Address of NFT contract
     * @param tokenId Token ID to buy
     * @param maxPrice Maximum price willing to pay
     * @param nonce Random nonce used in commitment
     */
    function revealAndBuyFixedPrice(
        address nftContract,
        uint256 tokenId,
        uint256 maxPrice,
        bytes32 nonce
    ) external nonReentrant whenNotPaused {
        // Reconstruct commitment hash
        bytes32 commitHash = keccak256(abi.encodePacked(nftContract, tokenId, maxPrice, nonce));
        Commitment memory commitment = commitments[msg.sender][commitHash];

        // Verify commitment exists
        if (commitment.blockNumber == 0) revert NoCommitment();

        // Verify time window
        if (block.number < commitment.blockNumber + MIN_COMMIT_AGE) revert CommitmentTooEarly();
        if (block.number > commitment.blockNumber + MAX_COMMIT_AGE) revert CommitmentExpired();

        // Get listing
        Listing memory listing = listings[nftContract][tokenId];
        if (listing.price == 0) revert ItemNotListed();

        // Verify seller still owns NFT (stale listing protection)
        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != listing.seller) {
            delete listings[nftContract][tokenId];
            revert StaleListing();
        }

        // Verify price constraints
        if (listing.price > maxPrice) revert IncorrectPrice();
        if (commitment.amount < listing.price) revert IncorrectPrice();

        // Clear commitment and listing
        delete commitments[msg.sender][commitHash];
        delete listings[nftContract][tokenId];

        // Calculate fees
        uint256 fee = (listing.price * FEE_PERCENT) / 10000;
        uint256 sellerAmount = listing.price - fee;

        // Add funds to pending withdrawals
        pendingWithdrawals[listing.seller] += sellerAmount;
        pendingWithdrawals[owner()] += fee;

        // Refund excess (use pull pattern)
        if (commitment.amount > listing.price) {
            pendingWithdrawals[msg.sender] += (commitment.amount - listing.price);
        }

        // Transfer NFT
        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit BuyRevealed(msg.sender, nftContract, tokenId, listing.price);
        emit ItemSold(nftContract, tokenId, listing.seller, msg.sender, listing.price);
    }

    /**
     * @notice Reveal and execute buy for Dutch Auction (Phase 2 of commit-reveal)
     */
    function revealAndBuyDutchAuction(
        address nftContract,
        uint256 tokenId,
        uint256 maxPrice,
        bytes32 nonce
    ) external nonReentrant whenNotPaused {
        // Reconstruct commitment hash
        bytes32 commitHash = keccak256(abi.encodePacked(nftContract, tokenId, maxPrice, nonce));
        Commitment memory commitment = commitments[msg.sender][commitHash];

        // Verify commitment
        if (commitment.blockNumber == 0) revert NoCommitment();
        if (block.number < commitment.blockNumber + MIN_COMMIT_AGE) revert CommitmentTooEarly();
        if (block.number > commitment.blockNumber + MAX_COMMIT_AGE) revert CommitmentExpired();

        // Get auction
        DutchAuction storage auction = dutchAuctions[nftContract][tokenId];
        if (!auction.active) revert AuctionNotActive();

        // Calculate current price
        uint256 currentPrice = getDutchAuctionPrice(nftContract, tokenId);

        // Verify seller still owns NFT
        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != auction.seller) {
            auction.active = false;
            revert StaleListing();
        }

        // Verify price constraints
        if (currentPrice > maxPrice) revert IncorrectPrice();
        if (commitment.amount < currentPrice) revert IncorrectPrice();

        // Clear commitment and mark auction inactive
        delete commitments[msg.sender][commitHash];
        auction.active = false;

        // Calculate fees
        uint256 fee = (currentPrice * FEE_PERCENT) / 10000;
        uint256 sellerAmount = currentPrice - fee;

        // Add funds to pending withdrawals
        pendingWithdrawals[auction.seller] += sellerAmount;
        pendingWithdrawals[owner()] += fee;

        // Refund excess (use pull pattern)
        if (commitment.amount > currentPrice) {
            pendingWithdrawals[msg.sender] += (commitment.amount - currentPrice);
        }

        // Transfer NFT
        nft.safeTransferFrom(auction.seller, msg.sender, tokenId);

        emit BuyRevealed(msg.sender, nftContract, tokenId, currentPrice);
        emit DutchAuctionBought(nftContract, tokenId, msg.sender, currentPrice);
    }

    // --- Auction Functions ---


    /**
     * @notice Start an auction for an NFT
     */
    function startAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 duration
    ) 
        external 
        whenNotPaused
        isTokenOwner(nftContract, tokenId, msg.sender)
        notListed(nftContract, tokenId)
    {
        if (startingPrice == 0) revert PriceMustBeAboveZero();
        if (duration < 60) revert DurationTooShort(); // Minimum 1 minute

        auctions[nftContract][tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            endTime: block.timestamp + duration,
            highestBidder: address(0),
            highestBid: 0,
            active: true
        });

        emit AuctionCreated(nftContract, tokenId, startingPrice, block.timestamp + duration);
    }

    /**
     * @notice Bid on an active auction
     */
    function bid(address nftContract, uint256 tokenId) external payable nonReentrant whenNotPaused {
        Auction storage auction = auctions[nftContract][tokenId];
        
        if (!auction.active) revert AuctionNotActive();
        if (block.timestamp >= auction.endTime) revert AuctionHasEnded();
        if (msg.sender == auction.seller) revert SellerCannotBid();

        uint256 minBid = auction.highestBid == 0 ? auction.startingPrice : auction.highestBid;
        if (msg.value <= minBid) revert BidTooLow();

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit NewBid(nftContract, tokenId, msg.sender, msg.value);
    }

    /**
     * @notice End an auction and transfer NFT/Funds
     */
    function endAuction(address nftContract, uint256 tokenId) external nonReentrant whenNotPaused {
        Auction storage auction = auctions[nftContract][tokenId];
        if (!auction.active) revert AuctionNotActive();
        if (block.timestamp < auction.endTime) revert AuctionStillActive();

        auction.active = false;

        if (auction.highestBidder != address(0)) {
            // Winner exists
            uint256 winningBid = auction.highestBid;
            uint256 fee = (winningBid * FEE_PERCENT) / 10000;
            uint256 sellerAmount = winningBid - fee;

            // Seller gets funds minus fee
            pendingWithdrawals[auction.seller] += sellerAmount;
            
            // Owner gets fee
            pendingWithdrawals[owner()] += fee;
            
            // Winner gets NFT
            IERC721(nftContract).safeTransferFrom(auction.seller, auction.highestBidder, tokenId);
            
            emit AuctionEnded(nftContract, tokenId, auction.highestBidder, winningBid);
        } else {
            // No bids, auction just ends, seller keeps NFT
            emit AuctionEnded(nftContract, tokenId, address(0), 0);
        }
    }

    /**
     * @notice Cancel an auction (only if no bids have been placed)
     */
    function cancelAuction(address nftContract, uint256 tokenId) external {
        Auction storage auction = auctions[nftContract][tokenId];
        if (auction.seller != msg.sender) revert NotOwnerOfToken();
        if (!auction.active) revert AuctionNotActive();
        if (auction.highestBidder != address(0)) revert HasActiveBids();

        auction.active = false;
        emit AuctionCanceled(nftContract, tokenId, msg.sender);
    }

    // --- Dutch Auction Functions ---


    /**
     * @notice Create a Dutch Auction (Price decreases over time)
     */
    function createDutchAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 endPrice,
        uint256 duration
    )
        external
        whenNotPaused
        isTokenOwner(nftContract, tokenId, msg.sender)
        notListed(nftContract, tokenId)
    {
        if (startPrice <= endPrice) revert InvalidPriceRange();
        if (duration < 60) revert DurationTooShort(); // Minimum 1 minute

        dutchAuctions[nftContract][tokenId] = DutchAuction({
            seller: msg.sender,
            startPrice: startPrice,
            endPrice: endPrice,
            startTime: block.timestamp,
            duration: duration,
            active: true
        });

        emit DutchAuctionCreated(nftContract, tokenId, startPrice, endPrice, duration);
    }

    /**
     * @notice Get current price of a Dutch Auction
     */
    function getDutchAuctionPrice(address nftContract, uint256 tokenId) public view returns (uint256) {
        DutchAuction memory auction = dutchAuctions[nftContract][tokenId];
        if (!auction.active) return 0;

        if (block.timestamp >= auction.startTime + auction.duration) {
            return auction.endPrice;
        }

        uint256 timeElapsed = block.timestamp - auction.startTime;
        uint256 priceDrop = (auction.startPrice - auction.endPrice) * timeElapsed / auction.duration;
        return auction.startPrice - priceDrop;
    }

    /**
     * @notice Buy from a Dutch Auction
     */
    function buyDutchAuction(address nftContract, uint256 tokenId) external payable nonReentrant whenNotPaused {
        DutchAuction storage auction = dutchAuctions[nftContract][tokenId];
        if (!auction.active) revert AuctionNotActive();

        uint256 currentPrice = getDutchAuctionPrice(nftContract, tokenId);
        if (msg.value < currentPrice) revert BidTooLow();

        auction.active = false;
        
        // Fee Calculation
        uint256 fee = (currentPrice * FEE_PERCENT) / 10000;
        uint256 sellerAmount = currentPrice - fee;

        // Add funds to seller
        pendingWithdrawals[auction.seller] += sellerAmount;
        // Add fee to owner
        pendingWithdrawals[owner()] += fee;

        // Refund excess using pull pattern (FIXED: was using .transfer())
        if (msg.value > currentPrice) {
            pendingWithdrawals[msg.sender] += (msg.value - currentPrice);
        }

        // Transfer NFT
        IERC721(nftContract).safeTransferFrom(auction.seller, msg.sender, tokenId);

        emit DutchAuctionBought(nftContract, tokenId, msg.sender, currentPrice);
    }

    /**
     * @notice Cancel a Dutch Auction (only seller, only if no one has bought)
     */
    function cancelDutchAuction(address nftContract, uint256 tokenId) external {
        DutchAuction storage auction = dutchAuctions[nftContract][tokenId];
        if (auction.seller != msg.sender) revert NotOwnerOfToken();
        if (!auction.active) revert AuctionNotActive();

        auction.active = false;
        emit DutchAuctionCanceled(nftContract, tokenId, msg.sender);
    }


    // --- Withdrawal Functions ---

    /**
     * @notice Withdraw available funds (Pull pattern)
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoFundsToWithdraw();

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }
}
