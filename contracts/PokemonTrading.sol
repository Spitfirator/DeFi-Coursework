// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPokemonCardStats {
    struct PokemonStats {
        string name;
        string pokemonType;
        string rarity;
        uint256 hp;
        uint256 attack;
        uint256 defense;
        uint256 speed;
        uint256 generation;
        uint256 level;
        bool exists;
        bool isEgg;
    }
    function getPokemonStats(uint256 tokenId) external view returns (PokemonStats memory);
}

/**
 * @title PokemonTrading
 * @dev Trading contract for Pokemon NFTs with fixed-price sales and auctions
 * @notice Implements secure withdrawal pattern, reentrancy protection, and commit-reveal for auctions
 */
contract PokemonTrading is AccessControl, Pausable, ReentrancyGuard {
    // ============ Roles ============
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    // ============ Structs ============
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
    }

    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 reservePrice;
        uint256 highestBid;
        address highestBidder;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool finalized;
    }

    // Commit-reveal for front-running prevention
    struct BidCommitment {
        bytes32 commitHash;
        uint256 commitTime;
        bool revealed;
    }

    // ============ State Variables ============
    IERC721 public pokemonContract;
    uint256 public platformFee; // Basis points (100 = 1%)
    uint256 public constant MAX_FEE = 1000; // 10% max fee
    uint256 public constant COMMIT_REVEAL_PERIOD = 5 minutes;
    uint256 public constant MIN_AUCTION_DURATION = 1 hours;
    uint256 public constant MAX_AUCTION_DURATION = 7 days;
    uint256 public constant BID_EXTENSION_TIME = 10 minutes;

    // ============ Mappings ============
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(uint256 => mapping(address => BidCommitment)) public bidCommitments;
    mapping(uint256 => mapping(address => uint256)) public auctionBids;

    // ============ Fee Tracking ============
    uint256 public accumulatedFees;

    // ============ Events ============
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event ListingPriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
    event Sale(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    
    event AuctionCreated(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 endTime
    );
    event AuctionCancelled(uint256 indexed tokenId, address indexed seller);
    event BidCommitted(uint256 indexed tokenId, address indexed bidder, bytes32 commitHash);
    event BidRevealed(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionExtended(uint256 indexed tokenId, uint256 newEndTime);
    event AuctionFinalized(uint256 indexed tokenId, address indexed winner, uint256 amount);
    
    event Withdrawal(address indexed user, uint256 amount);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyStop(address indexed by);
    event EmergencyResume(address indexed by);

    // ============ Errors ============
    error NotTokenOwner();
    error NotSeller();
    error ListingNotActive();
    error AuctionNotActive();
    error AuctionStillActive();
    error AuctionAlreadyFinalized();
    error InsufficientPayment();
    error InvalidPrice();
    error InvalidDuration();
    error BidTooLow();
    error TransferFailed();
    error ZeroAddress();
    error TokenAlreadyListed();
    error TokenInAuction();
    error CommitmentNotFound();
    error CommitmentAlreadyRevealed();
    error RevealPeriodNotStarted();
    error RevealPeriodEnded();
    error InvalidReveal();
    error NoPendingWithdrawal();
    error FeeTooHigh();
    error CannotBidOnOwnAuction();
    error AuctionEnded();
    error ReservePriceNotMet();
    error AuctionHasBids();
    error NoFeesToWithdraw();
    error CannotTradeEgg();

    // ============ Constructor ============
    constructor(address _pokemonContract, uint256 _platformFee) {
        if (_pokemonContract == address(0)) revert ZeroAddress();
        if (_platformFee > MAX_FEE) revert FeeTooHigh();

        pokemonContract = IERC721(_pokemonContract);
        platformFee = _platformFee;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(FEE_MANAGER_ROLE, msg.sender);
    }

    // ============ Fixed-Price Listing Functions ============

    /**
     * @dev List a Pokemon card for fixed-price sale
     * @param tokenId Token ID to list
     * @param price Sale price in wei
     */
    function listCard(uint256 tokenId, uint256 price) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        if (price == 0) revert InvalidPrice();
        if (pokemonContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (listings[tokenId].isActive) revert TokenAlreadyListed();
        if (auctions[tokenId].isActive) revert TokenInAuction();
        if (IPokemonCardStats(address(pokemonContract)).getPokemonStats(tokenId).isEgg) revert CannotTradeEgg();

        // Transfer NFT to contract for escrow
        pokemonContract.transferFrom(msg.sender, address(this), tokenId);

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true
        });

        emit Listed(tokenId, msg.sender, price);
    }

    /**
     * @dev Cancel a listing and return NFT to seller
     * @param tokenId Token ID to cancel
     */
    function cancelListing(uint256 tokenId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Listing storage listing = listings[tokenId];
        if (!listing.isActive) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotSeller();

        listing.isActive = false;

        // Return NFT to seller
        pokemonContract.transferFrom(address(this), msg.sender, tokenId);

        emit ListingCancelled(tokenId, msg.sender);
    }

    /**
     * @dev Update listing price
     * @param tokenId Token ID to update
     * @param newPrice New price in wei
     */
    function updateListingPrice(uint256 tokenId, uint256 newPrice) 
        external 
        whenNotPaused 
    {
        if (newPrice == 0) revert InvalidPrice();
        Listing storage listing = listings[tokenId];
        if (!listing.isActive) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotSeller();

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit ListingPriceUpdated(tokenId, oldPrice, newPrice);
    }

    /**
     * @dev Buy a listed Pokemon card
     * @param tokenId Token ID to buy
     */
    function buyCard(uint256 tokenId) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
    {
        Listing storage listing = listings[tokenId];
        if (!listing.isActive) revert ListingNotActive();
        if (msg.value < listing.price) revert InsufficientPayment();

        listing.isActive = false;
        address seller = listing.seller;
        uint256 price = listing.price;

        // Calculate fees
        uint256 fee = (price * platformFee) / 10000;
        uint256 sellerProceeds = price - fee;

        // Track platform fees separately
        accumulatedFees += fee;

        // Update pending withdrawals (pull pattern)
        pendingWithdrawals[seller] += sellerProceeds;

        // Transfer NFT to buyer
        pokemonContract.transferFrom(address(this), msg.sender, tokenId);

        // Refund excess payment
        if (msg.value > price) {
            uint256 refund = msg.value - price;
            (bool refundSuccess, ) = payable(msg.sender).call{value: refund}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit Sale(tokenId, seller, msg.sender, price);
    }

    // ============ Auction Functions ============

    /**
     * @dev Create an auction for a Pokemon card
     * @param tokenId Token ID to auction
     * @param startingPrice Starting bid price
     * @param reservePrice Minimum price for sale to complete
     * @param duration Auction duration in seconds
     */
    function createAuction(
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration
    ) external whenNotPaused nonReentrant {
        if (startingPrice == 0) revert InvalidPrice();
        if (reservePrice < startingPrice) revert InvalidPrice();
        if (duration < MIN_AUCTION_DURATION || duration > MAX_AUCTION_DURATION) {
            revert InvalidDuration();
        }
        if (pokemonContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (listings[tokenId].isActive) revert TokenAlreadyListed();
        if (auctions[tokenId].isActive) revert TokenInAuction();
        if (IPokemonCardStats(address(pokemonContract)).getPokemonStats(tokenId).isEgg) revert CannotTradeEgg();

        // Transfer NFT to contract for escrow
        pokemonContract.transferFrom(msg.sender, address(this), tokenId);

        uint256 endTime = block.timestamp + duration;

        auctions[tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            reservePrice: reservePrice,
            highestBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            isActive: true,
            finalized: false
        });

        emit AuctionCreated(tokenId, msg.sender, startingPrice, reservePrice, endTime);
    }

    /**
     * @dev Commit a bid hash for front-running prevention
     * @param tokenId Token ID to bid on
     * @param commitHash Hash of (bidder address, bid amount, secret)
     */
    function commitBid(uint256 tokenId, bytes32 commitHash) 
        external 
        whenNotPaused 
    {
        Auction storage auction = auctions[tokenId];
        if (!auction.isActive) revert AuctionNotActive();
        if (block.timestamp >= auction.endTime) revert AuctionEnded();
        if (msg.sender == auction.seller) revert CannotBidOnOwnAuction();

        bidCommitments[tokenId][msg.sender] = BidCommitment({
            commitHash: commitHash,
            commitTime: block.timestamp,
            revealed: false
        });

        emit BidCommitted(tokenId, msg.sender, commitHash);
    }

    /**
     * @dev Reveal a committed bid
     * @param tokenId Token ID
     * @param secret Secret used in commitment
     */
    function revealBid(uint256 tokenId, bytes32 secret) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
    {
        Auction storage auction = auctions[tokenId];
        BidCommitment storage commitment = bidCommitments[tokenId][msg.sender];

        if (!auction.isActive) revert AuctionNotActive();
        if (block.timestamp >= auction.endTime) revert AuctionEnded();
        if (commitment.commitHash == bytes32(0)) revert CommitmentNotFound();
        if (commitment.revealed) revert CommitmentAlreadyRevealed();

        // Verify the commitment
        bytes32 expectedHash = keccak256(abi.encodePacked(msg.sender, msg.value, secret));
        if (expectedHash != commitment.commitHash) revert InvalidReveal();

        commitment.revealed = true;

        _placeBid(tokenId, msg.value);
    }

    /**
     * @dev Place a direct bid (without commit-reveal, for simplicity option)
     * @param tokenId Token ID to bid on
     */
    function placeBid(uint256 tokenId) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
    {
        _placeBid(tokenId, msg.value);
    }

    /**
     * @dev Internal bid placement logic
     */
    function _placeBid(uint256 tokenId, uint256 bidAmount) internal {
        Auction storage auction = auctions[tokenId];
        
        if (!auction.isActive) revert AuctionNotActive();
        if (block.timestamp >= auction.endTime) revert AuctionEnded();
        if (msg.sender == auction.seller) revert CannotBidOnOwnAuction();

        uint256 minBid = auction.highestBid == 0 
            ? auction.startingPrice 
            : auction.highestBid + (auction.highestBid / 20); // 5% minimum increment

        if (bidAmount < minBid) revert BidTooLow();

        // Refund previous highest bidder using pull pattern
        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = bidAmount;
        auction.highestBidder = msg.sender;
        auctionBids[tokenId][msg.sender] = bidAmount;

        // Extend auction if bid placed in last 10 minutes
        if (auction.endTime - block.timestamp < BID_EXTENSION_TIME) {
            auction.endTime = block.timestamp + BID_EXTENSION_TIME;
            emit AuctionExtended(tokenId, auction.endTime);
        }

        emit BidPlaced(tokenId, msg.sender, bidAmount);
    }

    /**
     * @dev Finalize an auction after it ends
     * @param tokenId Token ID to finalize
     */
    function finalizeAuction(uint256 tokenId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Auction storage auction = auctions[tokenId];
        
        if (!auction.isActive) revert AuctionNotActive();
        if (block.timestamp < auction.endTime) revert AuctionStillActive();
        if (auction.finalized) revert AuctionAlreadyFinalized();

        auction.isActive = false;
        auction.finalized = true;

        // Check if reserve price was met
        if (auction.highestBid >= auction.reservePrice && auction.highestBidder != address(0)) {
            // Calculate fees
            uint256 fee = (auction.highestBid * platformFee) / 10000;
            uint256 sellerProceeds = auction.highestBid - fee;

            // Track platform fees separately
            accumulatedFees += fee;

            // Update pending withdrawals
            pendingWithdrawals[auction.seller] += sellerProceeds;

            // Transfer NFT to winner
            pokemonContract.transferFrom(address(this), auction.highestBidder, tokenId);

            emit AuctionFinalized(tokenId, auction.highestBidder, auction.highestBid);
        } else {
            // Reserve not met - return NFT to seller and refund highest bidder
            pokemonContract.transferFrom(address(this), auction.seller, tokenId);
            
            if (auction.highestBidder != address(0)) {
                pendingWithdrawals[auction.highestBidder] += auction.highestBid;
            }

            emit AuctionFinalized(tokenId, address(0), 0);
        }
    }

    /**
     * @dev Cancel an auction (only if no bids)
     * @param tokenId Token ID to cancel
     */
    function cancelAuction(uint256 tokenId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Auction storage auction = auctions[tokenId];
        
        if (!auction.isActive) revert AuctionNotActive();
        if (auction.seller != msg.sender) revert NotSeller();
        if (auction.highestBidder != address(0)) revert AuctionHasBids();

        auction.isActive = false;
        auction.finalized = true;

        // Return NFT to seller
        pokemonContract.transferFrom(address(this), msg.sender, tokenId);

        emit AuctionCancelled(tokenId, msg.sender);
    }

    // ============ Withdrawal Functions (Pull Pattern) ============

    /**
     * @dev Withdraw pending funds
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoPendingWithdrawal();

        // Zero out before transfer to prevent reentrancy
        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            // Restore balance if transfer fails
            pendingWithdrawals[msg.sender] = amount;
            revert TransferFailed();
        }

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @dev Check pending withdrawal amount
     */
    function getPendingWithdrawal(address user) external view returns (uint256) {
        return pendingWithdrawals[user];
    }

    // ============ Admin Functions ============

    /**
     * @dev Update platform fee
     * @param newFee New fee in basis points
     */
    function setPlatformFee(uint256 newFee) external onlyRole(FEE_MANAGER_ROLE) {
        if (newFee > MAX_FEE) revert FeeTooHigh();
        uint256 oldFee = platformFee;
        platformFee = newFee;
        emit PlatformFeeUpdated(oldFee, newFee);
    }

    /**
     * @dev Withdraw platform fees (only accumulated fees, not user funds)
     */
    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 fees = accumulatedFees;
        if (fees == 0) revert NoFeesToWithdraw();

        // Zero out before transfer to prevent reentrancy
        accumulatedFees = 0;

        (bool success, ) = payable(msg.sender).call{value: fees}("");
        if (!success) {
            // Restore fees if transfer fails
            accumulatedFees = fees;
            revert TransferFailed();
        }

        emit Withdrawal(msg.sender, fees);
    }

    /**
     * @dev Get accumulated platform fees
     */
    function getAccumulatedFees() external view returns (uint256) {
        return accumulatedFees;
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyStop(msg.sender);
    }

    /**
     * @dev Resume from pause
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit EmergencyResume(msg.sender);
    }

    // ============ View Functions ============

    /**
     * @dev Get listing details
     */
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    /**
     * @dev Get auction details
     */
    function getAuction(uint256 tokenId) external view returns (Auction memory) {
        return auctions[tokenId];
    }

    /**
     * @dev Check if auction is active and not ended
     */
    function isAuctionActive(uint256 tokenId) external view returns (bool) {
        Auction storage auction = auctions[tokenId];
        return auction.isActive && block.timestamp < auction.endTime;
    }

    /**
     * @dev Get time remaining in auction
     */
    function getAuctionTimeRemaining(uint256 tokenId) external view returns (uint256) {
        Auction storage auction = auctions[tokenId];
        if (!auction.isActive || block.timestamp >= auction.endTime) {
            return 0;
        }
        return auction.endTime - block.timestamp;
    }

    /**
     * @dev Generate commit hash for front-running prevention
     */
    function generateCommitHash(
        address bidder,
        uint256 amount,
        bytes32 secret
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(bidder, amount, secret));
    }

    // ============ Receive Function ============
    receive() external payable {}
}
