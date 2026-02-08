// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    // Dutch Auction - price decreases over time
    struct DutchAuction {
        address seller;
        uint256 startingPrice;
        uint256 reservePrice;
        uint256 startTime;
        uint256 duration;
        bool isActive;
        bool sold;
    }

    struct SwapRequest {
        address requester;
        uint256 desiredTokenId; // The token they want
        uint256 offeredTokenId; // The token they offer
        bool isActive;
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
    mapping(uint256 => DutchAuction) public dutchAuctions;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(uint256 => mapping(address => BidCommitment)) public bidCommitments;
    mapping(uint256 => mapping(address => uint256)) public auctionBids;
    mapping(uint256 => SwapRequest[]) public swapRequests; // desiredTokenId => list of requests

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
    
    event DutchAuctionCreated(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration
    );
    event DutchAuctionPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event DutchAuctionCancelled(uint256 indexed tokenId, address indexed seller);
    
    event SwapRequestCreated(uint256 indexed desiredTokenId, address indexed requester, uint256 offeredTokenId);
    event SwapExecuted(uint256 indexed desiredTokenId, uint256 indexed offeredTokenId, address indexed requester, address accepter);
    event SwapCancelled(uint256 indexed desiredTokenId, address indexed requester);

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
    error DutchAuctionNotActive();
    error DutchAuctionExpired();
    error TokenInDutchAuction();

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
        if (dutchAuctions[tokenId].isActive) revert TokenInDutchAuction();

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
        if (dutchAuctions[tokenId].isActive) revert TokenInDutchAuction();

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

    // ============ Dutch Auction Functions ============

    /**
     * @dev Create a Dutch auction where price decreases over time
     * @param tokenId Token ID to auction
     * @param startingPrice Initial high price
     * @param reservePrice Minimum acceptable price
     * @param duration Auction duration in seconds
     */
    function createDutchAuction(
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration
    ) external whenNotPaused nonReentrant {
        if (startingPrice == 0) revert InvalidPrice();
        if (reservePrice >= startingPrice) revert InvalidPrice(); // Reserve must be LESS than starting
        if (duration < MIN_AUCTION_DURATION || duration > MAX_AUCTION_DURATION) {
            revert InvalidDuration();
        }
        if (pokemonContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (listings[tokenId].isActive) revert TokenAlreadyListed();
        if (auctions[tokenId].isActive) revert TokenInAuction();
        if (dutchAuctions[tokenId].isActive) revert TokenInDutchAuction();

        // Transfer NFT to contract for escrow
        pokemonContract.transferFrom(msg.sender, address(this), tokenId);

        dutchAuctions[tokenId] = DutchAuction({
            seller: msg.sender,
            startingPrice: startingPrice,
            reservePrice: reservePrice,
            startTime: block.timestamp,
            duration: duration,
            isActive: true,
            sold: false
        });

        emit DutchAuctionCreated(tokenId, msg.sender, startingPrice, reservePrice, duration);
    }

    /**
     * @dev Buy NFT from Dutch auction at current price
     * @param tokenId Token ID to purchase
     */
    function buyDutchAuction(uint256 tokenId) external payable whenNotPaused nonReentrant {
        DutchAuction storage auction = dutchAuctions[tokenId];
        
        if (!auction.isActive) revert DutchAuctionNotActive();
        if (auction.sold) revert DutchAuctionNotActive();
        
        uint256 currentPrice = getCurrentDutchPrice(tokenId);
        if (msg.value < currentPrice) revert InsufficientPayment();

        // Mark as sold and inactive
        auction.isActive = false;
        auction.sold = true;

        // Transfer NFT to buyer
        pokemonContract.transferFrom(address(this), msg.sender, tokenId);

        // Calculate platform fee
        uint256 fee = (currentPrice * platformFee) / 10000;
        uint256 sellerProceeds = currentPrice - fee;

        // Add to pending withdrawals
        pendingWithdrawals[auction.seller] += sellerProceeds;
        accumulatedFees += fee;

        // Refund excess payment
        if (msg.value > currentPrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - currentPrice}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit DutchAuctionPurchased(tokenId, msg.sender, currentPrice);
    }

    /**
     * @dev Cancel Dutch auction and return NFT to seller
     * @param tokenId Token ID to cancel auction for
     */
    function cancelDutchAuction(uint256 tokenId) external nonReentrant {
        DutchAuction storage auction = dutchAuctions[tokenId];
        
        if (!auction.isActive) revert DutchAuctionNotActive();
        if (auction.seller != msg.sender) revert NotSeller();
        if (auction.sold) revert DutchAuctionNotActive();

        auction.isActive = false;

        // Return NFT to seller
        pokemonContract.transferFrom(address(this), auction.seller, tokenId);

        emit DutchAuctionCancelled(tokenId, msg.sender);
    }

    /**
     * @dev Calculate current price of Dutch auction
     * @param tokenId Token ID to get price for
     * @return Current price based on time elapsed
     */
    function getCurrentDutchPrice(uint256 tokenId) public view returns (uint256) {
        DutchAuction storage auction = dutchAuctions[tokenId];
        
        if (!auction.isActive) revert DutchAuctionNotActive();
        
        uint256 timeElapsed = block.timestamp - auction.startTime;
        
        // If auction duration has passed, return reserve price
        if (timeElapsed >= auction.duration) {
            return auction.reservePrice;
        }
        
        // Calculate price decrease
        uint256 priceRange = auction.startingPrice - auction.reservePrice;
        uint256 priceDecrease = (priceRange * timeElapsed) / auction.duration;
        
        return auction.startingPrice - priceDecrease;
    }

    /**
     * @dev Get time remaining in Dutch auction
     */
    function getDutchAuctionTimeRemaining(uint256 tokenId) external view returns (uint256) {
        DutchAuction storage auction = dutchAuctions[tokenId];
        if (!auction.isActive || block.timestamp >= auction.startTime + auction.duration) {
            return 0;
        }
        return (auction.startTime + auction.duration) - block.timestamp;
    }

    // ============ Swap Functions ============

    /**
     * @dev Create a request to swap a token for another
     * @param desiredTokenId The token the requester wants
     * @param offeredTokenId The token the requester offers
     */
    function createSwapRequest(uint256 desiredTokenId, uint256 offeredTokenId) external nonReentrant whenNotPaused {
        require(pokemonContract.ownerOf(desiredTokenId) != msg.sender, "Cannot swap for a card you already own");
        require(pokemonContract.ownerOf(offeredTokenId) == msg.sender, "You must own the card you're offering");
        
        // Check if marketplace is approved to transfer the offered token
        require(
            pokemonContract.getApproved(offeredTokenId) == address(this) || pokemonContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved for your NFT"
        );

        // Check for duplicate requests
        SwapRequest[] storage requests = swapRequests[desiredTokenId];
        for (uint256 i = 0; i < requests.length; i++) {
            if (requests[i].isActive && 
                requests[i].requester == msg.sender && 
                requests[i].offeredTokenId == offeredTokenId) {
                revert("You already have an active swap request for this card");
            }
        }

        swapRequests[desiredTokenId].push(SwapRequest({
            requester: msg.sender,
            desiredTokenId: desiredTokenId,
            offeredTokenId: offeredTokenId,
            isActive: true
        }));

        emit SwapRequestCreated(desiredTokenId, msg.sender, offeredTokenId);
    }

    /**
     * @dev Execute a swap request
     * @param desiredTokenId The token being requested
     * @param requestIndex The index of the request to accept
     */
    function executeSwap(uint256 desiredTokenId, uint256 requestIndex) external nonReentrant whenNotPaused {
        // Only owner of desiredTokenId can execute swap
        if (pokemonContract.ownerOf(desiredTokenId) != msg.sender) revert NotTokenOwner();

        SwapRequest storage request = swapRequests[desiredTokenId][requestIndex];
        if (!request.isActive) revert("Request not active");

        // Verify ownership of offered token still holds
        if (pokemonContract.ownerOf(request.offeredTokenId) != request.requester) {
            request.isActive = false;
            revert("Requester no longer owns token");
        }

        // Execute Swap
        // Transfer desiredTokenId (msg.sender -> requester)
        pokemonContract.safeTransferFrom(msg.sender, request.requester, desiredTokenId);
        
        // Transfer offeredTokenId (requester -> msg.sender)
        pokemonContract.safeTransferFrom(request.requester, msg.sender, request.offeredTokenId);

        // Mark request as inactive
        request.isActive = false;

        // Clean up listings if any
        if (listings[desiredTokenId].isActive) delete listings[desiredTokenId];
        if (listings[request.offeredTokenId].isActive) delete listings[request.offeredTokenId];

        emit SwapExecuted(desiredTokenId, request.offeredTokenId, request.requester, msg.sender);
    }

    /**
     * @dev Cancel a swap request
     */
    function cancelSwapRequest(uint256 desiredTokenId, uint256 requestIndex) external nonReentrant {
        SwapRequest storage request = swapRequests[desiredTokenId][requestIndex];
        if (request.requester != msg.sender) revert NotTokenOwner();
        
        request.isActive = false;
        emit SwapCancelled(desiredTokenId, msg.sender);
    }

    /**
     * @dev Get all swap requests for a token
     */
    function getSwapRequests(uint256 tokenId) external view returns (SwapRequest[] memory) {
        return swapRequests[tokenId];
    }

    // ============ Receive Function ============
    receive() external payable {}
}
