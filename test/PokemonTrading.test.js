const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PokemonTrading", function () {
  const MAX_SUPPLY = 10000;
  const MINT_PRICE = ethers.parseEther("0.01");
  const PLATFORM_FEE = 250; // 2.5%
  const LISTING_PRICE = ethers.parseEther("1");
  const AUCTION_STARTING_PRICE = ethers.parseEther("0.5");
  const AUCTION_RESERVE_PRICE = ethers.parseEther("1");
  const AUCTION_DURATION = 3600; // 1 hour

  async function deployContractsFixture() {
    const [owner, seller, buyer, bidder1, bidder2] = await ethers.getSigners();

    // Deploy PokemonCard
    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const pokemonCard = await PokemonCard.deploy(MAX_SUPPLY, MINT_PRICE);

    // Deploy PokemonTrading
    const PokemonTrading = await ethers.getContractFactory("PokemonTrading");
    const trading = await PokemonTrading.deploy(await pokemonCard.getAddress(), PLATFORM_FEE);

    return { pokemonCard, trading, owner, seller, buyer, bidder1, bidder2 };
  }

  async function mintAndApproveFixture() {
    const { pokemonCard, trading, owner, seller, buyer, bidder1, bidder2 } = 
      await loadFixture(deployContractsFixture);

    // Mint a Pokemon to seller
    await pokemonCard.connect(owner).adminMint(
      seller.address,
      "ipfs://test",
      "Charizard",
      "Fire",
      "Rare",
      78,
      84,
      78,
      100,
      1
    );

    // Approve trading contract
    await pokemonCard.connect(seller).setApprovalForAll(await trading.getAddress(), true);

    return { pokemonCard, trading, owner, seller, buyer, bidder1, bidder2 };
  }

  describe("Deployment", function () {
    it("Should set the correct Pokemon contract", async function () {
      const { pokemonCard, trading } = await loadFixture(deployContractsFixture);
      expect(await trading.pokemonContract()).to.equal(await pokemonCard.getAddress());
    });

    it("Should set the correct platform fee", async function () {
      const { trading } = await loadFixture(deployContractsFixture);
      expect(await trading.platformFee()).to.equal(PLATFORM_FEE);
    });

    it("Should revert with zero address for Pokemon contract", async function () {
      const PokemonTrading = await ethers.getContractFactory("PokemonTrading");
      await expect(
        PokemonTrading.deploy(ethers.ZeroAddress, PLATFORM_FEE)
      ).to.be.revertedWithCustomError(PokemonTrading, "ZeroAddress");
    });

    it("Should revert with fee too high", async function () {
      const { pokemonCard } = await loadFixture(deployContractsFixture);
      const PokemonTrading = await ethers.getContractFactory("PokemonTrading");
      await expect(
        PokemonTrading.deploy(await pokemonCard.getAddress(), 1001)
      ).to.be.revertedWithCustomError(PokemonTrading, "FeeTooHigh");
    });
  });

  describe("Fixed-Price Listings", function () {
    it("Should list a card for sale", async function () {
      const { pokemonCard, trading, seller } = await loadFixture(mintAndApproveFixture);

      await expect(trading.connect(seller).listCard(0, LISTING_PRICE))
        .to.emit(trading, "Listed")
        .withArgs(0, seller.address, LISTING_PRICE);

      const listing = await trading.getListing(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LISTING_PRICE);
      expect(listing.isActive).to.be.true;
    });

    it("Should transfer NFT to contract on listing", async function () {
      const { pokemonCard, trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);

      expect(await pokemonCard.ownerOf(0)).to.equal(await trading.getAddress());
    });

    it("Should revert listing with zero price", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(seller).listCard(0, 0)
      ).to.be.revertedWithCustomError(trading, "InvalidPrice");
    });

    it("Should revert listing if not owner", async function () {
      const { trading, buyer } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(buyer).listCard(0, LISTING_PRICE)
      ).to.be.revertedWithCustomError(trading, "NotTokenOwner");
    });

    it("Should cancel a listing", async function () {
      const { pokemonCard, trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      
      await expect(trading.connect(seller).cancelListing(0))
        .to.emit(trading, "ListingCancelled")
        .withArgs(0, seller.address);

      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);
    });

    it("Should update listing price", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);
      const newPrice = ethers.parseEther("2");

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      
      await expect(trading.connect(seller).updateListingPrice(0, newPrice))
        .to.emit(trading, "ListingPriceUpdated")
        .withArgs(0, LISTING_PRICE, newPrice);
    });

    it("Should buy a listed card", async function () {
      const { pokemonCard, trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);

      await expect(trading.connect(buyer).buyCard(0, { value: LISTING_PRICE }))
        .to.emit(trading, "Sale")
        .withArgs(0, seller.address, buyer.address, LISTING_PRICE);

      expect(await pokemonCard.ownerOf(0)).to.equal(buyer.address);
    });

    it("Should calculate fees correctly on sale", async function () {
      const { trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE });

      // Fee is 2.5%, so seller gets 97.5%
      const expectedProceeds = LISTING_PRICE - (LISTING_PRICE * BigInt(PLATFORM_FEE) / BigInt(10000));
      expect(await trading.getPendingWithdrawal(seller.address)).to.equal(expectedProceeds);
    });

    it("Should refund excess payment", async function () {
      const { trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      
      const excess = ethers.parseEther("0.5");
      const balanceBefore = await ethers.provider.getBalance(buyer.address);
      
      const tx = await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE + excess });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(buyer.address);
      
      // Should have paid LISTING_PRICE + gas, excess refunded
      expect(balanceBefore - balanceAfter - gasUsed).to.be.closeTo(LISTING_PRICE, ethers.parseEther("0.001"));
    });
  });

  describe("Auctions", function () {
    it("Should create an auction", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(seller).createAuction(
          0,
          AUCTION_STARTING_PRICE,
          AUCTION_RESERVE_PRICE,
          AUCTION_DURATION
        )
      ).to.emit(trading, "AuctionCreated");

      const auction = await trading.getAuction(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.startingPrice).to.equal(AUCTION_STARTING_PRICE);
      expect(auction.isActive).to.be.true;
    });

    it("Should revert auction with invalid duration", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(seller).createAuction(0, AUCTION_STARTING_PRICE, AUCTION_RESERVE_PRICE, 60) // Too short
      ).to.be.revertedWithCustomError(trading, "InvalidDuration");
    });

    it("Should place a bid", async function () {
      const { trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      const bidAmount = AUCTION_STARTING_PRICE;
      await expect(trading.connect(bidder1).placeBid(0, { value: bidAmount }))
        .to.emit(trading, "BidPlaced")
        .withArgs(0, bidder1.address, bidAmount);

      const auction = await trading.getAuction(0);
      expect(auction.highestBid).to.equal(bidAmount);
      expect(auction.highestBidder).to.equal(bidder1.address);
    });

    it("Should require 5% minimum bid increment", async function () {
      const { trading, seller, bidder1, bidder2 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      await trading.connect(bidder1).placeBid(0, { value: AUCTION_STARTING_PRICE });

      // Bid less than 5% increment should fail
      const lowBid = AUCTION_STARTING_PRICE + (AUCTION_STARTING_PRICE / BigInt(100)); // 1% increment
      await expect(
        trading.connect(bidder2).placeBid(0, { value: lowBid })
      ).to.be.revertedWithCustomError(trading, "BidTooLow");
    });

    it("Should refund previous bidder on outbid", async function () {
      const { trading, seller, bidder1, bidder2 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      await trading.connect(bidder1).placeBid(0, { value: AUCTION_STARTING_PRICE });
      
      const higherBid = AUCTION_STARTING_PRICE + (AUCTION_STARTING_PRICE / BigInt(10)); // 10% higher
      await trading.connect(bidder2).placeBid(0, { value: higherBid });

      expect(await trading.getPendingWithdrawal(bidder1.address)).to.equal(AUCTION_STARTING_PRICE);
    });

    it("Should extend auction if bid in last 10 minutes", async function () {
      const { trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      // Fast forward to 5 minutes before end
      await time.increase(AUCTION_DURATION - 300);

      const auctionBefore = await trading.getAuction(0);
      
      await expect(trading.connect(bidder1).placeBid(0, { value: AUCTION_STARTING_PRICE }))
        .to.emit(trading, "AuctionExtended");

      const auctionAfter = await trading.getAuction(0);
      expect(auctionAfter.endTime).to.be.gt(auctionBefore.endTime);
    });

    it("Should prevent seller from bidding", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      await expect(
        trading.connect(seller).placeBid(0, { value: AUCTION_STARTING_PRICE })
      ).to.be.revertedWithCustomError(trading, "CannotBidOnOwnAuction");
    });

    it("Should finalize auction with winner", async function () {
      const { pokemonCard, trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      await trading.connect(bidder1).placeBid(0, { value: AUCTION_RESERVE_PRICE });

      // Fast forward past auction end
      await time.increase(AUCTION_DURATION + 1);

      await expect(trading.finalizeAuction(0))
        .to.emit(trading, "AuctionFinalized")
        .withArgs(0, bidder1.address, AUCTION_RESERVE_PRICE);

      expect(await pokemonCard.ownerOf(0)).to.equal(bidder1.address);
    });

    it("Should return NFT to seller if reserve not met", async function () {
      const { pokemonCard, trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      // Bid below reserve
      await trading.connect(bidder1).placeBid(0, { value: AUCTION_STARTING_PRICE });

      await time.increase(AUCTION_DURATION + 1);

      await trading.finalizeAuction(0);

      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);
      expect(await trading.getPendingWithdrawal(bidder1.address)).to.equal(AUCTION_STARTING_PRICE);
    });

    it("Should cancel auction with no bids", async function () {
      const { pokemonCard, trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      await expect(trading.connect(seller).cancelAuction(0))
        .to.emit(trading, "AuctionCancelled")
        .withArgs(0, seller.address);

      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);
    });

    it("Should prevent cancellation with bids", async function () {
      const { trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      await trading.connect(bidder1).placeBid(0, { value: AUCTION_STARTING_PRICE });

      await expect(
        trading.connect(seller).cancelAuction(0)
      ).to.be.revertedWithCustomError(trading, "AuctionHasBids");
    });
  });

  describe("Commit-Reveal Bidding", function () {
    it("Should commit and reveal bid", async function () {
      const { trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      const bidAmount = AUCTION_STARTING_PRICE;
      const secret = ethers.encodeBytes32String("mysecret");
      
      const commitHash = await trading.generateCommitHash(bidder1.address, bidAmount, secret);

      await expect(trading.connect(bidder1).commitBid(0, commitHash))
        .to.emit(trading, "BidCommitted")
        .withArgs(0, bidder1.address, commitHash);

      await expect(trading.connect(bidder1).revealBid(0, secret, { value: bidAmount }))
        .to.emit(trading, "BidPlaced")
        .withArgs(0, bidder1.address, bidAmount);
    });

    it("Should reject invalid reveal", async function () {
      const { trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      const bidAmount = AUCTION_STARTING_PRICE;
      const secret = ethers.encodeBytes32String("mysecret");
      const wrongSecret = ethers.encodeBytes32String("wrongsecret");
      
      const commitHash = await trading.generateCommitHash(bidder1.address, bidAmount, secret);

      await trading.connect(bidder1).commitBid(0, commitHash);

      await expect(
        trading.connect(bidder1).revealBid(0, wrongSecret, { value: bidAmount })
      ).to.be.revertedWithCustomError(trading, "InvalidReveal");
    });
  });

  describe("Withdrawals (Pull Pattern)", function () {
    it("Should allow withdrawal of pending funds", async function () {
      const { trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE });

      const pending = await trading.getPendingWithdrawal(seller.address);
      const balanceBefore = await ethers.provider.getBalance(seller.address);

      const tx = await trading.connect(seller).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(seller.address);
      
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(pending);
      expect(await trading.getPendingWithdrawal(seller.address)).to.equal(0);
    });

    it("Should revert withdrawal with no pending funds", async function () {
      const { trading, buyer } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(buyer).withdraw()
      ).to.be.revertedWithCustomError(trading, "NoPendingWithdrawal");
    });

    it("Should emit Withdrawal event", async function () {
      const { trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE });

      const pending = await trading.getPendingWithdrawal(seller.address);

      await expect(trading.connect(seller).withdraw())
        .to.emit(trading, "Withdrawal")
        .withArgs(seller.address, pending);
    });
  });

  describe("Emergency Stop (Pausable)", function () {
    it("Should pause and unpause", async function () {
      const { trading, owner } = await loadFixture(mintAndApproveFixture);

      await trading.connect(owner).pause();
      expect(await trading.paused()).to.be.true;

      await trading.connect(owner).unpause();
      expect(await trading.paused()).to.be.false;
    });

    it("Should prevent listing when paused", async function () {
      const { trading, owner, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(owner).pause();

      await expect(
        trading.connect(seller).listCard(0, LISTING_PRICE)
      ).to.be.revertedWithCustomError(trading, "EnforcedPause");
    });

    it("Should prevent buying when paused", async function () {
      const { trading, owner, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      await trading.connect(owner).pause();

      await expect(
        trading.connect(buyer).buyCard(0, { value: LISTING_PRICE })
      ).to.be.revertedWithCustomError(trading, "EnforcedPause");
    });
  });

  describe("Admin Functions", function () {
    it("Should update platform fee", async function () {
      const { trading, owner } = await loadFixture(mintAndApproveFixture);
      const newFee = 500; // 5%

      await expect(trading.connect(owner).setPlatformFee(newFee))
        .to.emit(trading, "PlatformFeeUpdated")
        .withArgs(PLATFORM_FEE, newFee);

      expect(await trading.platformFee()).to.equal(newFee);
    });

    it("Should prevent fee above maximum", async function () {
      const { trading, owner } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(owner).setPlatformFee(1001)
      ).to.be.revertedWithCustomError(trading, "FeeTooHigh");
    });

    it("Should track accumulated fees from sales", async function () {
      const { trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE });

      const expectedFee = LISTING_PRICE * BigInt(PLATFORM_FEE) / BigInt(10000);
      expect(await trading.getAccumulatedFees()).to.equal(expectedFee);
    });

    it("Should track accumulated fees from auctions", async function () {
      const { trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      await trading.connect(bidder1).placeBid(0, { value: AUCTION_RESERVE_PRICE });
      await time.increase(AUCTION_DURATION + 1);
      await trading.finalizeAuction(0);

      const expectedFee = AUCTION_RESERVE_PRICE * BigInt(PLATFORM_FEE) / BigInt(10000);
      expect(await trading.getAccumulatedFees()).to.equal(expectedFee);
    });

    it("Should only withdraw accumulated fees, not user funds", async function () {
      const { trading, owner, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).listCard(0, LISTING_PRICE);
      await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE });

      const expectedFee = LISTING_PRICE * BigInt(PLATFORM_FEE) / BigInt(10000);
      const sellerPending = await trading.getPendingWithdrawal(seller.address);

      // Withdraw fees
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await trading.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      // Admin should only receive the fee, not the seller's funds
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(expectedFee);

      // Seller should still be able to withdraw their funds
      expect(await trading.getPendingWithdrawal(seller.address)).to.equal(sellerPending);

      // Accumulated fees should be zero after withdrawal
      expect(await trading.getAccumulatedFees()).to.equal(0);
    });

    it("Should revert fee withdrawal when no fees", async function () {
      const { trading, owner } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(owner).withdrawFees()
      ).to.be.revertedWithCustomError(trading, "NoFeesToWithdraw");
    });
  });

  describe("View Functions", function () {
    it("Should return auction active status", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      expect(await trading.isAuctionActive(0)).to.be.true;

      await time.increase(AUCTION_DURATION + 1);

      expect(await trading.isAuctionActive(0)).to.be.false;
    });

    it("Should return time remaining", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      const remaining = await trading.getAuctionTimeRemaining(0);
      expect(remaining).to.be.lte(AUCTION_DURATION);
      expect(remaining).to.be.gt(0);
    });
  });

  describe("Full Sale Flow Integration", function () {
    it("Should correctly transfer ownership through full sale flow", async function () {
      const { pokemonCard, trading, seller, buyer } = await loadFixture(mintAndApproveFixture);
      const tradingAddress = await trading.getAddress();

      // Initial state: seller owns the card
      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);
      expect(await pokemonCard.balanceOf(seller.address)).to.equal(1);
      expect(await pokemonCard.balanceOf(buyer.address)).to.equal(0);

      // Step 1: List the card - NFT moves to trading contract
      await trading.connect(seller).listCard(0, LISTING_PRICE);

      // Verify: trading contract now owns the NFT
      expect(await pokemonCard.ownerOf(0)).to.equal(tradingAddress);
      expect(await pokemonCard.balanceOf(seller.address)).to.equal(0);
      expect(await pokemonCard.balanceOf(tradingAddress)).to.equal(1);

      // Step 2: Buy the card - NFT moves to buyer
      await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE });

      // Verify: buyer now owns the NFT
      expect(await pokemonCard.ownerOf(0)).to.equal(buyer.address);
      expect(await pokemonCard.balanceOf(buyer.address)).to.equal(1);
      expect(await pokemonCard.balanceOf(seller.address)).to.equal(0);
      expect(await pokemonCard.balanceOf(tradingAddress)).to.equal(0);

      // Verify: listing is no longer active
      const listing = await trading.getListing(0);
      expect(listing.isActive).to.be.false;

      // Verify: seller cannot list the same card again (they don't own it)
      await expect(
        trading.connect(seller).listCard(0, LISTING_PRICE)
      ).to.be.revertedWithCustomError(trading, "NotTokenOwner");
    });

    it("Should correctly transfer ownership through full auction flow", async function () {
      const { pokemonCard, trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);
      const tradingAddress = await trading.getAddress();

      // Initial state: seller owns the card
      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);

      // Step 1: Create auction - NFT moves to trading contract
      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      // Verify: trading contract now owns the NFT
      expect(await pokemonCard.ownerOf(0)).to.equal(tradingAddress);
      expect(await pokemonCard.balanceOf(seller.address)).to.equal(0);

      // Step 2: Place bid meeting reserve
      await trading.connect(bidder1).placeBid(0, { value: AUCTION_RESERVE_PRICE });

      // Step 3: Fast forward and finalize
      await time.increase(AUCTION_DURATION + 1);
      await trading.finalizeAuction(0);

      // Verify: bidder1 (winner) now owns the NFT
      expect(await pokemonCard.ownerOf(0)).to.equal(bidder1.address);
      expect(await pokemonCard.balanceOf(bidder1.address)).to.equal(1);
      expect(await pokemonCard.balanceOf(seller.address)).to.equal(0);
      expect(await pokemonCard.balanceOf(tradingAddress)).to.equal(0);

      // Verify: auction is finalized
      const auction = await trading.getAuction(0);
      expect(auction.isActive).to.be.false;
      expect(auction.finalized).to.be.true;

      // Verify: seller cannot auction the same card again
      await expect(
        trading.connect(seller).createAuction(0, AUCTION_STARTING_PRICE, AUCTION_RESERVE_PRICE, AUCTION_DURATION)
      ).to.be.revertedWithCustomError(trading, "NotTokenOwner");
    });

    it("Should return NFT to seller when reserve not met", async function () {
      const { pokemonCard, trading, seller, bidder1 } = await loadFixture(mintAndApproveFixture);

      // Create auction
      await trading.connect(seller).createAuction(
        0,
        AUCTION_STARTING_PRICE,
        AUCTION_RESERVE_PRICE,
        AUCTION_DURATION
      );

      // Bid below reserve
      await trading.connect(bidder1).placeBid(0, { value: AUCTION_STARTING_PRICE });

      // Fast forward and finalize
      await time.increase(AUCTION_DURATION + 1);
      await trading.finalizeAuction(0);

      // Verify: seller gets NFT back
      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);
      expect(await pokemonCard.balanceOf(seller.address)).to.equal(1);

      // Verify: bidder gets their bid back in pending withdrawals
      expect(await trading.getPendingWithdrawal(bidder1.address)).to.equal(AUCTION_STARTING_PRICE);
    });

    it("Should allow new owner to list after purchase", async function () {
      const { pokemonCard, trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      // Seller lists and buyer buys
      await trading.connect(seller).listCard(0, LISTING_PRICE);
      await trading.connect(buyer).buyCard(0, { value: LISTING_PRICE });

      // Verify buyer owns the card
      expect(await pokemonCard.ownerOf(0)).to.equal(buyer.address);

      // Buyer approves trading contract
      await pokemonCard.connect(buyer).setApprovalForAll(await trading.getAddress(), true);

      // Buyer can now list the card
      const newPrice = ethers.parseEther("2");
      await expect(trading.connect(buyer).listCard(0, newPrice))
        .to.emit(trading, "Listed")
        .withArgs(0, buyer.address, newPrice);

      // Verify listing
      const listing = await trading.getListing(0);
      expect(listing.seller).to.equal(buyer.address);
      expect(listing.isActive).to.be.true;
    });
  });

  describe("Dutch Auctions", function () {
    const DUTCH_START_PRICE = ethers.parseEther("2");
    const DUTCH_RESERVE_PRICE = ethers.parseEther("1");
    const DUTCH_DURATION = 3600; // 1 hour

    it("Should create a Dutch auction", async function () {
      const { pokemonCard, trading, seller } = await loadFixture(mintAndApproveFixture);

      await expect(trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION))
        .to.emit(trading, "DutchAuctionCreated")
        .withArgs(0, seller.address, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION);

      // NFT should be in escrow
      expect(await pokemonCard.ownerOf(0)).to.equal(await trading.getAddress());
    });

    it("Should reject invalid price range (reserve >= starting)", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await expect(
        trading.connect(seller).createDutchAuction(0, ethers.parseEther("1"), ethers.parseEther("2"), DUTCH_DURATION)
      ).to.be.revertedWithCustomError(trading, "InvalidPrice");
    });

    it("Should reject invalid duration", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      // Too short (< 1 hour)
      await expect(
        trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, 60)
      ).to.be.revertedWithCustomError(trading, "InvalidDuration");
    });

    it("Should decrease price linearly over time", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION);

      // At start, price should be starting price
      const priceAtStart = await trading.getCurrentDutchPrice(0);
      expect(priceAtStart).to.equal(DUTCH_START_PRICE);

      // At halfway, price should be ~1.5 ETH
      await time.increase(DUTCH_DURATION / 2);
      const priceAtHalf = await trading.getCurrentDutchPrice(0);
      const expectedHalf = ethers.parseEther("1.5");
      // Allow small margin for block time
      expect(priceAtHalf).to.be.closeTo(expectedHalf, ethers.parseEther("0.02"));

      // At end, price should be reserve
      await time.increase(DUTCH_DURATION / 2);
      const priceAtEnd = await trading.getCurrentDutchPrice(0);
      expect(priceAtEnd).to.equal(DUTCH_RESERVE_PRICE);
    });

    it("Should allow buying at current price", async function () {
      const { pokemonCard, trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION);

      // Advance halfway
      await time.increase(DUTCH_DURATION / 2);

      const currentPrice = await trading.getCurrentDutchPrice(0);

      await expect(trading.connect(buyer).buyDutchAuction(0, { value: currentPrice + ethers.parseEther("0.1") }))
        .to.emit(trading, "DutchAuctionPurchased");

      // Buyer should own the NFT
      expect(await pokemonCard.ownerOf(0)).to.equal(buyer.address);

      // Seller should have pending withdrawal (minus fee)
      const fee = (currentPrice * BigInt(PLATFORM_FEE)) / 10000n;
      const expectedProceeds = currentPrice - fee;
      expect(await trading.pendingWithdrawals(seller.address)).to.be.closeTo(expectedProceeds, ethers.parseEther("0.02"));
    });

    it("Should reject purchase after expiry", async function () {
      const { trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION);

      // Advance past duration
      await time.increase(DUTCH_DURATION + 1);

      await expect(
        trading.connect(buyer).buyDutchAuction(0, { value: DUTCH_RESERVE_PRICE })
      ).to.be.revertedWithCustomError(trading, "DutchAuctionExpired");
    });

    it("Should cancel Dutch auction and return NFT", async function () {
      const { pokemonCard, trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION);

      await expect(trading.connect(seller).cancelDutchAuction(0))
        .to.emit(trading, "DutchAuctionCancelled");

      // NFT returned to seller
      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);
    });

    it("Should finalize expired Dutch auction", async function () {
      const { pokemonCard, trading, seller, buyer } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION);

      // Advance past duration
      await time.increase(DUTCH_DURATION + 1);

      await expect(trading.connect(buyer).finalizeDutchAuction(0))
        .to.emit(trading, "DutchAuctionFinalized");

      // NFT returned to seller
      expect(await pokemonCard.ownerOf(0)).to.equal(seller.address);
    });

    it("Should prevent seller from buying own Dutch auction", async function () {
      const { trading, seller } = await loadFixture(mintAndApproveFixture);

      await trading.connect(seller).createDutchAuction(0, DUTCH_START_PRICE, DUTCH_RESERVE_PRICE, DUTCH_DURATION);

      await expect(
        trading.connect(seller).buyDutchAuction(0, { value: DUTCH_START_PRICE })
      ).to.be.revertedWithCustomError(trading, "NotBuyer");
    });
  });
});
