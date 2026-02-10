
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { useCart } from '../context/CartContext';
import { ethers } from 'ethers';
import {
  Loader, AlertCircle, ArrowLeft, ArrowRight, ArrowLeftRight, Clock, User, Tag,
  Gavel, ShoppingCart, X, RefreshCw, TrendingDown, DollarSign, Activity, List, StickyNote
} from 'lucide-react';
import toast from 'react-hot-toast';
import DutchAuctionDisplay from '../components/DutchAuctionDisplay';
import ListingModal from '../components/ListingModal';
import AuctionModal from '../components/AuctionModal';
import DutchAuctionModal from '../components/DutchAuctionModal';
import SwapModal from '../components/SwapModal';
import SwapRequestsDisplay from '../components/SwapRequestsDisplay';
import { getPokemonImageUrl } from '../utils/pokemon';

function CardDetail() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const { pokemonContract, tradingContract, account, triggerRefresh } = useWeb3();
  const { addToCart, isInCart } = useCart();

  const [pokemon, setPokemon] = useState(null);
  const [listing, setListing] = useState(null);
  const [auction, setAuction] = useState(null);
  const [dutchAuction, setDutchAuction] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [imageError, setImageError] = useState(false);


  // Modal states
  const [showListModal, setShowListModal] = useState(false);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showDutchAuctionModal, setShowDutchAuctionModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [activity, setActivity] = useState([]);


  const loadCardData = useCallback(async () => {
    if (!pokemonContract || !tradingContract) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const stats = await pokemonContract.getPokemonStats(tokenId);
      const cardOwner = await pokemonContract.ownerOf(tokenId);
      const listingData = await tradingContract.getListing(tokenId);
      const auctionData = await tradingContract.getAuction(tokenId);
      const dutchAuctionData = await tradingContract.dutchAuctions(tokenId);

      setPokemon({
        tokenId: Number(tokenId),
        name: stats.name,
        pokemonType: stats.pokemonType,
        rarity: stats.rarity,
        hp: Number(stats.hp),
        attack: Number(stats.attack),
        defense: Number(stats.defense),
        speed: Number(stats.speed),
        generation: Number(stats.generation),
        level: Number(stats.level)
      });

      setOwner(cardOwner);

      if (listingData.isActive) {
        setListing({
          seller: listingData.seller,
          price: ethers.formatEther(listingData.price),
          isActive: listingData.isActive
        });
      } else {
        setListing(null);
      }

      if (auctionData.isActive) {
        setAuction({
          seller: auctionData.seller,
          startingPrice: ethers.formatEther(auctionData.startingPrice),
          reservePrice: ethers.formatEther(auctionData.reservePrice),
          highestBid: ethers.formatEther(auctionData.highestBid),
          highestBidder: auctionData.highestBidder,
          endTime: Number(auctionData.endTime),
          isActive: auctionData.isActive
        });

        const now = Math.floor(Date.now() / 1000);
        setTimeRemaining(Math.max(0, Number(auctionData.endTime) - now));
      } else {
        setAuction(null);
      }

      if (dutchAuctionData.isActive) {
        setDutchAuction({
          seller: dutchAuctionData.seller,
          startingPrice: ethers.formatEther(dutchAuctionData.startingPrice),
          reservePrice: ethers.formatEther(dutchAuctionData.reservePrice),
          startTime: Number(dutchAuctionData.startTime),
          duration: Number(dutchAuctionData.duration),
          isActive: dutchAuctionData.isActive,
          sold: dutchAuctionData.sold
        });
      } else {
        setDutchAuction(null);
      }

      // Format Transfer events -> { type: 'Transfer', from, to, price, date, txHash }
      const events = [];

      // 1. Transfers
      const transferFilter = pokemonContract.filters.Transfer(null, null, tokenId);
      const transfers = await pokemonContract.queryFilter(transferFilter);

      for (const t of transfers) {
        const block = await t.getBlock();
        events.push({
          type: 'Transfer',
          from: t.args[0],
          to: t.args[1],
          date: new Date(block.timestamp * 1000),
          txHash: t.transactionHash
        });
      }

      // 2. Sales
      const saleFilter = tradingContract.filters.Sale(tokenId);
      const sales = await tradingContract.queryFilter(saleFilter);
      for (const s of sales) {
        const block = await s.getBlock();
        events.push({
          type: 'Sale',
          seller: s.args.seller,
          buyer: s.args.buyer,
          price: ethers.formatEther(s.args.price),
          date: new Date(block.timestamp * 1000),
          txHash: s.transactionHash
        });
      }

      // 3. Auction Finalized
      const auctionFilter = tradingContract.filters.AuctionFinalized(tokenId);
      const auctions = await tradingContract.queryFilter(auctionFilter);
      for (const a of auctions) {
        const block = await a.getBlock();
        events.push({
          type: 'Auction Won',
          winner: a.args.winner,
          price: ethers.formatEther(a.args.amount),
          date: new Date(block.timestamp * 1000),
          txHash: a.transactionHash
        });
      }

      // 4. Dutch Auction Purchased
      const dutchFilter = tradingContract.filters.DutchAuctionPurchased(tokenId);
      const dutchSales = await tradingContract.queryFilter(dutchFilter);
      for (const d of dutchSales) {
        const block = await d.getBlock();
        events.push({
          type: 'Dutch Auction',
          buyer: d.args.buyer,
          price: ethers.formatEther(d.args.price),
          date: new Date(block.timestamp * 1000),
          txHash: d.transactionHash
        });
      }

      // 5. Bids
      const bidFilter = tradingContract.filters.BidPlaced(tokenId);
      const bids = await tradingContract.queryFilter(bidFilter);
      for (const b of bids) {
        const block = await b.getBlock();
        events.push({
          type: 'Bid',
          bidder: b.args.bidder,
          price: ethers.formatEther(b.args.amount),
          date: new Date(block.timestamp * 1000),
          txHash: b.transactionHash
        });
      }

      // Sort by date desc
      events.sort((a, b) => b.date - a.date);
      setActivity(events);

    } catch (error) {
      console.error('Failed to load card:', error);
      toast.error('Failed to load card details');
    } finally {
      setLoading(false);
    }
  }, [pokemonContract, tradingContract, tokenId]);

  useEffect(() => {
    loadCardData();
  }, [loadCardData]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!tradingContract) return;

    // Refresh if any event related to trading happens
    // We could be more specific but global refresh is safer for stats update
    const handleUpdate = () => loadCardData();
    const handleSale = () => loadCardData();
    const handleBidPlaced = () => loadCardData();
    const handleAuctionFinalized = () => loadCardData();
    const handleListingCancelled = () => loadCardData();
    const handleAuctionCancelled = () => loadCardData();
    const handleDutchAuctionPurchased = () => loadCardData();
    const handleDutchAuctionCancelled = () => loadCardData();

    tradingContract.on('Sale', handleSale);
    tradingContract.on('BidPlaced', handleBidPlaced);
    tradingContract.on('AuctionFinalized', handleAuctionFinalized);
    tradingContract.on('ListingCancelled', handleListingCancelled);
    tradingContract.on('AuctionCancelled', handleAuctionCancelled);
    tradingContract.on('DutchAuctionPurchased', handleDutchAuctionPurchased);
    tradingContract.on('DutchAuctionCancelled', handleDutchAuctionCancelled);

    return () => {
      tradingContract.off('Sale', handleSale);
      tradingContract.off('BidPlaced', handleBidPlaced);
      tradingContract.off('AuctionFinalized', handleAuctionFinalized);
      tradingContract.off('ListingCancelled', handleListingCancelled);
      tradingContract.off('AuctionCancelled', handleAuctionCancelled);
      tradingContract.off('DutchAuctionPurchased', handleDutchAuctionPurchased);
      tradingContract.off('DutchAuctionCancelled', handleDutchAuctionCancelled);
    };
  }, [tradingContract, loadCardData]);

  // Countdown timer for auctions
  useEffect(() => {
    if (!auction || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [auction]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s} s`;
  };

  const handleBuy = async () => {
    if (!listing || !tradingContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Processing purchase...');

      const priceWei = ethers.parseEther(listing.price);
      const tx = await tradingContract.buyCard(tokenId, { value: priceWei });
      await tx.wait();

      toast.dismiss();
      toast.success('Purchase successful!');
      triggerRefresh();
      loadCardData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to buy:', error);
      toast.error(error.reason || 'Failed to complete purchase');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!auction || !bidAmount || !tradingContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Placing bid...');

      const bidWei = ethers.parseEther(bidAmount);
      const tx = await tradingContract.placeBid(tokenId, { value: bidWei });
      await tx.wait();

      toast.dismiss();
      toast.success('Bid placed successfully!');
      setBidAmount('');
      triggerRefresh();
      loadCardData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to bid:', error);
      toast.error(error.reason || 'Failed to place bid');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalizeAuction = async () => {
    if (!tradingContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Finalizing auction...');

      const tx = await tradingContract.finalizeAuction(tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success('Auction finalized!');
      triggerRefresh();
      loadCardData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to finalize:', error);
      toast.error(error.reason || 'Failed to finalize auction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelListing = async () => {
    if (!tradingContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Cancelling listing...');

      const tx = await tradingContract.cancelListing(tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success('Listing cancelled! Returning to your cards...');
      setListing(null);
      triggerRefresh();
      setTimeout(() => navigate('/my-cards'), 1500);
    } catch (error) {
      toast.dismiss();
      console.error('Failed to cancel:', error);
      toast.error(error.reason || 'Failed to cancel listing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAuction = async () => {
    if (!tradingContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Cancelling auction...');

      const tx = await tradingContract.cancelAuction(tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success('Auction cancelled! Returning to your cards...');
      setAuction(null);
      triggerRefresh();
      setTimeout(() => navigate('/my-cards'), 1500);
    } catch (error) {
      toast.dismiss();
      console.error('Failed to cancel auction:', error);
      toast.error(error.reason || 'Cannot cancel auction with bids');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelDutchAuction = async () => {
    if (!tradingContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Cancelling Dutch auction...');

      const tx = await tradingContract.cancelDutchAuction(tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success('Dutch auction cancelled! Returning to your cards...');
      setDutchAuction(null);
      triggerRefresh();
      setTimeout(() => navigate('/my-cards'), 1500);
    } catch (error) {
      toast.dismiss();
      console.error('Failed to cancel Dutch auction:', error);
      toast.error(error.reason || 'Failed to cancel Dutch auction');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!account) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to view card details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!pokemon) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Card Not Found</h2>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const isOwner = owner?.toLowerCase() === account?.toLowerCase();
  const isSeller = listing?.seller?.toLowerCase() === account?.toLowerCase() ||
    auction?.seller?.toLowerCase() === account?.toLowerCase() ||
    dutchAuction?.seller?.toLowerCase() === account?.toLowerCase();
  const minBid = auction ?
    (parseFloat(auction.highestBid) > 0
      ? (parseFloat(auction.highestBid) * 1.05).toFixed(4)
      : auction.startingPrice)
    : '0';

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Card Display */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className={`h-80 bg-gradient-to-br ${pokemon.pokemonType === 'Fire' ? 'from-orange-500/20 to-red-600/20 border-orange-500/30' :
            pokemon.pokemonType === 'Water' ? 'from-blue-400/20 to-blue-600/20 border-blue-400/30' :
              pokemon.pokemonType === 'Grass' ? 'from-green-400/20 to-green-600/20 border-green-400/30' :
                pokemon.pokemonType === 'Electric' ? 'from-yellow-400/20 to-yellow-600/20 border-yellow-400/30' :
                  pokemon.pokemonType === 'Psychic' ? 'from-pink-400/20 to-purple-600/20 border-purple-400/30' :
                    'from-gray-400/20 to-gray-600/20 border-gray-400/30'
            } rounded-xl border-2 flex items-center justify-center mb-6 relative overflow-hidden group`}>
            {getPokemonImageUrl(pokemon.name) && !imageError ? (
              <img
                src={getPokemonImageUrl(pokemon.name)}
                alt={pokemon.name}
                className="h-64 w-64 object-contain drop-shadow-2xl z-10 transition-transform duration-500 group-hover:scale-110"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-9xl font-bold text-white/10">{pokemon.name.charAt(0)}</span>
            )}

            {/* Background decorative elements */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          </div>

          {/* Level Display */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Level</div>
              <div className="text-2xl font-bold text-yellow-400">{pokemon.level}</div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(pokemon.level, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="text-red-400/80 text-sm font-medium">HP</div>
              <div className="text-2xl font-bold text-red-500">{pokemon.hp}</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="text-orange-400/80 text-sm font-medium">Attack</div>
              <div className="text-2xl font-bold text-orange-500">{pokemon.attack}</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="text-blue-400/80 text-sm font-medium">Defense</div>
              <div className="text-2xl font-bold text-blue-500">{pokemon.defense}</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="text-green-400/80 text-sm font-medium">Speed</div>
              <div className="text-2xl font-bold text-green-500">{pokemon.speed}</div>
            </div>
          </div>
        </div>

        {/* Details & Actions */}
        <div>
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${pokemon.rarity === 'Legendary' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                pokemon.rarity === 'Rare' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                  pokemon.rarity === 'Uncommon' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                {pokemon.rarity}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${pokemon.pokemonType === 'Fire' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                pokemon.pokemonType === 'Water' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  pokemon.pokemonType === 'Grass' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    pokemon.pokemonType === 'Electric' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                      pokemon.pokemonType === 'Psychic' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                {pokemon.pokemonType}
              </span>
              <span className="text-gray-500 font-mono text-sm">#{pokemon.tokenId}</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">{pokemon.name}</h1>

            <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
              <span className="text-gray-400 text-sm flex items-center gap-2">
                <Tag size={14} />
                Generation {pokemon.generation}
              </span>

              <div className="flex items-center space-x-2 text-gray-300">
                <span className="text-sm text-gray-500">
                  {listing?.isActive || auction?.isActive || dutchAuction?.isActive ? 'Seller' : 'Owner'}
                </span>
                <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                  <User size={14} className="text-primary" />
                  <span className="font-mono text-sm font-medium text-white">
                    {(() => {
                      // If listed/auctioned, show the seller address instead of contract address
                      const displayAddress = listing?.isActive ? listing.seller :
                        auction?.isActive ? auction.seller :
                          dutchAuction?.isActive ? dutchAuction.seller :
                            owner;
                      const isCurrentUser = displayAddress?.toLowerCase() === account?.toLowerCase();
                      return isCurrentUser ? 'You' : `${displayAddress?.slice(0, 6)}...${displayAddress?.slice(-4)} `;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Listing Section */}
          {listing && listing.isActive && (
            <div className="bg-gray-900 rounded-xl p-6 mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <Tag className="text-primary" size={20} />
                <span className="font-semibold">Fixed Price Sale</span>
              </div>

              <div className="text-3xl font-bold text-primary mb-4">{listing.price} ETH</div>

              {!isSeller ? (
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={handleBuy}
                    disabled={isProcessing}
                    className="col-span-3 sm:col-span-2 flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-primary to-secondary rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <ShoppingCart size={20} />
                    <span>{isProcessing ? 'Processing...' : 'Buy Now'}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      addToCart({
                        pokemon,
                        listing,
                        tokenId: Number(tokenId),
                        name: pokemon.name,
                        pokemonType: pokemon.pokemonType,
                        rarity: pokemon.rarity,
                        hp: pokemon.hp,
                        attack: pokemon.attack,
                        defense: pokemon.defense,
                        speed: pokemon.speed
                      });
                    }}
                    disabled={isInCart(Number(tokenId))}
                    className={`col-span-3 sm:col-span-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-semibold transition-all ${isInCart(Number(tokenId))
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                  >
                    <ShoppingCart size={20} />
                    <span>{isInCart(Number(tokenId)) ? 'In Cart' : 'Add to Cart'}</span>
                  </button>
                  <button
                    onClick={() => setShowSwapModal(true)}
                    className="col-span-3 flex items-center justify-center space-x-2 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    <ArrowLeftRight size={20} />
                    <span>Propose Swap</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCancelListing}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-red-500/20 text-red-400 rounded-lg font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                  <span>{isProcessing ? 'Processing...' : 'Cancel Listing'}</span>
                </button>
              )}
            </div>
          )}

          {/* Auction Section */}
          {auction && auction.isActive && (
            <div className="bg-gray-900 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Gavel className="text-secondary" size={20} />
                  <span className="font-semibold">Auction</span>
                </div>
                <div className="flex items-center space-x-2 text-yellow-400">
                  <Clock size={16} />
                  <span>{timeRemaining > 0 ? formatTime(timeRemaining) : 'Ended'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-gray-400 text-sm">Current Bid</div>
                  <div className="text-2xl font-bold text-secondary">
                    {parseFloat(auction.highestBid) > 0 ? `${auction.highestBid} ETH` : 'No bids'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Reserve Price</div>
                  <div className="text-xl font-semibold">{auction.reservePrice} ETH</div>
                </div>
              </div>

              {auction.highestBidder !== ethers.ZeroAddress && (
                <div className="text-sm text-gray-400 mb-4">
                  Highest bidder: {auction.highestBidder.slice(0, 6)}...{auction.highestBidder.slice(-4)}
                </div>
              )}

              {timeRemaining > 0 && !isSeller && (
                <div className="space-y-3">
                  <input
                    type="number"
                    step="0.001"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={`Min bid: ${minBid} ETH`}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-secondary"
                  />
                  <button
                    onClick={handlePlaceBid}
                    disabled={isProcessing || !bidAmount}
                    className="w-full py-3 bg-gradient-to-r from-secondary to-pink-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isProcessing ? 'Processing...' : 'Place Bid'}
                  </button>
                </div>
              )}

              {/* Cancel Auction - only if seller and no bids */}
              {timeRemaining > 0 && isSeller && auction.highestBidder === ethers.ZeroAddress && (
                <button
                  onClick={handleCancelAuction}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-red-500/20 text-red-400 rounded-lg font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                  <span>{isProcessing ? 'Processing...' : 'Cancel Auction'}</span>
                </button>
              )}

              {/* Info message if seller but has bids */}
              {timeRemaining > 0 && isSeller && auction.highestBidder !== ethers.ZeroAddress && (
                <div className="text-center text-gray-400 text-sm py-3">
                  Cannot cancel - auction has bids
                </div>
              )}

              {timeRemaining === 0 && (
                <button
                  onClick={handleFinalizeAuction}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-green-500/20 text-green-400 rounded-lg font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={20} />
                  <span>{isProcessing ? 'Processing...' : 'Finalize Auction'}</span>
                </button>
              )}
            </div>
          )}

          {/* Dutch Auction Section */}
          {dutchAuction && dutchAuction.isActive && (
            <div className="mb-6">
              <DutchAuctionDisplay
                auction={dutchAuction}
                tokenId={tokenId}
                tradingContract={tradingContract}
                onPurchase={() => {
                  triggerRefresh();
                  loadCardData();
                }}
              />

              {isSeller && !dutchAuction.sold && (
                <button
                  onClick={handleCancelDutchAuction}
                  disabled={isProcessing}
                  className="w-full mt-4 flex items-center justify-center space-x-2 py-3 bg-red-500/20 text-red-400 rounded-lg font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                  <span>{isProcessing ? 'Processing...' : 'Cancel Dutch Auction'}</span>
                </button>
              )}
            </div>
          )}

          {/* Not for sale message or Owner Options */}
          {!listing?.isActive && !auction?.isActive && !dutchAuction?.isActive && (
            isOwner ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Tag size={20} className="text-primary" />
                  List for Sale
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => setShowListModal(true)}
                    className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 border border-primary/50 rounded-xl flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-lg text-primary">
                        <Tag size={18} />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">Fixed Price</div>
                        <div className="text-xs text-gray-400">Set a specific price</div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
                  </button>

                  <button
                    onClick={() => setShowAuctionModal(true)}
                    className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 border border-secondary/50 rounded-xl flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/20 rounded-lg text-secondary">
                        <Gavel size={18} />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">English Auction</div>
                        <div className="text-xs text-gray-400">Bids increase until time up</div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
                  </button>

                  <button
                    onClick={() => setShowDutchAuctionModal(true)}
                    className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 border border-purple-500/50 rounded-xl flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <TrendingDown size={18} />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">Dutch Auction</div>
                        <div className="text-xs text-gray-400">Price decreases over time</div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-700/50 mb-4">
                  <Tag size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Not Listed</h3>
                <p className="text-gray-400 max-w-xs mx-auto mb-4">
                  This card is currently not for sale.
                </p>
                <button
                  onClick={() => setShowSwapModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-secondary rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
                >
                  <ArrowLeftRight size={18} />
                  Propose Swap
                </button>
              </div>
            )
          )}

          {/* Swap Requests Display (for owners) */}
          {!listing?.isActive && !auction?.isActive && !dutchAuction?.isActive && isOwner && (
            <div className="mt-6">
              <SwapRequestsDisplay tokenId={tokenId} isOwner={isOwner} onSwapComplete={loadCardData} />
            </div>
          )}
        </div>
      </div>

      {/* Activity Section */}
      <div className="mt-12 bg-gray-900 rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Clock size={24} />
          Item Activity
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500 font-medium">
                <th className="pb-4 pl-4">Event</th>
                <th className="pb-4">Price</th>
                <th className="pb-4">From</th>
                <th className="pb-4">To</th>
                <th className="pb-4 pr-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {activity.length > 0 ? (
                activity.map((event, index) => (
                  <tr key={index} className="group hover:bg-gray-800/30 transition-colors">
                    <td className="py-4 pl-4">
                      <div className="flex items-center gap-2">
                        {event.type === 'Sale' && <ShoppingCart size={16} className="text-primary" />}
                        {event.type === 'Auction Won' && <Gavel size={16} className="text-secondary" />}
                        {event.type === 'Dutch Auction' && <TrendingDown size={16} className="text-purple-400" />}
                        {event.type === 'Bid' && <Tag size={16} className="text-gray-400" />}
                        {event.type === 'Transfer' && <RefreshCw size={16} className="text-blue-400" />}
                        <span className="font-medium">{event.type}</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono font-medium">
                      {event.price ? `${event.price} ETH` : '---'}
                    </td>
                    <td className="py-4 text-sm text-gray-400 max-w-[150px] truncate">
                      {event.from ? (
                        event.from === ethers.ZeroAddress ? 'NullAddress' :
                          `${event.from.slice(0, 6)}...${event.from.slice(-4)} `
                      ) : (event.seller ? `${event.seller.slice(0, 6)}...${event.seller.slice(-4)} ` :
                        (event.bidder ? `${event.bidder.slice(0, 6)}...${event.bidder.slice(-4)} ` : '---'))}
                    </td>
                    <td className="py-4 text-sm text-gray-400 max-w-[150px] truncate">
                      {event.to ? `${event.to.slice(0, 6)}...${event.to.slice(-4)} ` :
                        (event.buyer ? `${event.buyer.slice(0, 6)}...${event.buyer.slice(-4)} ` :
                          (event.winner ? `${event.winner.slice(0, 6)}...${event.winner.slice(-4)} ` : '---'))}
                    </td>
                    <td className="py-4 pr-4 text-right text-sm text-gray-400">
                      {event.date.toLocaleDateString()} {event.date.toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-500">
                    No activity recorded for this item
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ListingModal
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        nft={pokemon}
        tradingContract={tradingContract}
        pokemonContract={pokemonContract}
        onSuccess={loadCardData}
      />

      <AuctionModal
        isOpen={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        nft={pokemon}
        tradingContract={tradingContract}
        pokemonContract={pokemonContract}
        onSuccess={loadCardData}
      />

      <DutchAuctionModal
        isOpen={showDutchAuctionModal}
        onClose={() => setShowDutchAuctionModal(false)}
        nft={pokemon}
        tradingContract={tradingContract}
        pokemonContract={pokemonContract}
        onSuccess={loadCardData}
      />

      <SwapModal
        isOpen={showSwapModal}
        onClose={() => {
          setShowSwapModal(false);
          loadCardData(); // Reload to show any new swap requests
        }}
        desiredCard={pokemon}
      />
    </div>
  );
}

export default CardDetail;
