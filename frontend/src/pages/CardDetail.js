import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { 
  Loader, AlertCircle, ArrowLeft, Clock, User, Tag, 
  Gavel, ShoppingCart, X, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

function CardDetail() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const { pokemonContract, tradingContract, account, triggerRefresh } = useWeb3();
  
  const [pokemon, setPokemon] = useState(null);
  const [listing, setListing] = useState(null);
  const [auction, setAuction] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

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

      setPokemon({
        tokenId: Number(tokenId),
        name: stats.name,
        pokemonType: stats.pokemonType,
        rarity: stats.rarity,
        hp: Number(stats.hp),
        attack: Number(stats.attack),
        defense: Number(stats.defense),
        speed: Number(stats.speed),
        generation: Number(stats.generation)
      });

      setOwner(cardOwner);

      if (listingData.isActive) {
        setListing({
          seller: listingData.seller,
          price: ethers.formatEther(listingData.price),
          isActive: listingData.isActive
        });
      }

      if (auctionData.isActive) {
        const remaining = await tradingContract.getAuctionTimeRemaining(tokenId);
        setAuction({
          seller: auctionData.seller,
          startingPrice: ethers.formatEther(auctionData.startingPrice),
          reservePrice: ethers.formatEther(auctionData.reservePrice),
          highestBid: ethers.formatEther(auctionData.highestBid),
          highestBidder: auctionData.highestBidder,
          endTime: Number(auctionData.endTime),
          isActive: auctionData.isActive
        });
        setTimeRemaining(Number(remaining));
      }
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

    const handleSale = () => loadCardData();
    const handleBidPlaced = () => loadCardData();
    const handleAuctionFinalized = () => loadCardData();
    const handleListingCancelled = () => loadCardData();
    const handleAuctionCancelled = () => loadCardData();

    tradingContract.on('Sale', handleSale);
    tradingContract.on('BidPlaced', handleBidPlaced);
    tradingContract.on('AuctionFinalized', handleAuctionFinalized);
    tradingContract.on('ListingCancelled', handleListingCancelled);
    tradingContract.on('AuctionCancelled', handleAuctionCancelled);

    return () => {
      tradingContract.off('Sale', handleSale);
      tradingContract.off('BidPlaced', handleBidPlaced);
      tradingContract.off('AuctionFinalized', handleAuctionFinalized);
      tradingContract.off('ListingCancelled', handleListingCancelled);
      tradingContract.off('AuctionCancelled', handleAuctionCancelled);
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
  }, [auction]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
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
                   auction?.seller?.toLowerCase() === account?.toLowerCase();
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
        <div className="bg-gray-900 rounded-2xl p-6">
          <div className={`h-64 bg-gradient-to-br ${
            pokemon.pokemonType === 'Fire' ? 'from-orange-500 to-red-600' :
            pokemon.pokemonType === 'Water' ? 'from-blue-400 to-blue-600' :
            pokemon.pokemonType === 'Grass' ? 'from-green-400 to-green-600' :
            pokemon.pokemonType === 'Electric' ? 'from-yellow-400 to-yellow-600' :
            pokemon.pokemonType === 'Psychic' ? 'from-pink-400 to-purple-600' :
            'from-gray-400 to-gray-600'
          } rounded-xl flex items-center justify-center mb-6`}>
            <span className="text-9xl font-bold text-white/20">{pokemon.name.charAt(0)}</span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">HP</div>
              <div className="text-2xl font-bold text-red-400">{pokemon.hp}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Attack</div>
              <div className="text-2xl font-bold text-orange-400">{pokemon.attack}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Defense</div>
              <div className="text-2xl font-bold text-blue-400">{pokemon.defense}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Speed</div>
              <div className="text-2xl font-bold text-green-400">{pokemon.speed}</div>
            </div>
          </div>
        </div>

        {/* Details & Actions */}
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              pokemon.rarity === 'Legendary' ? 'bg-yellow-500/20 text-yellow-400' :
              pokemon.rarity === 'Rare' ? 'bg-blue-500/20 text-blue-400' :
              pokemon.rarity === 'Uncommon' ? 'bg-green-500/20 text-green-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {pokemon.rarity}
            </span>
            <span className="text-gray-400">#{pokemon.tokenId}</span>
          </div>

          <h1 className="text-4xl font-bold mb-2">{pokemon.name}</h1>
          
          <div className="flex items-center space-x-4 mb-6">
            <span className={`px-3 py-1 rounded-lg text-sm ${
              pokemon.pokemonType === 'Fire' ? 'bg-orange-500/20 text-orange-400' :
              pokemon.pokemonType === 'Water' ? 'bg-blue-500/20 text-blue-400' :
              pokemon.pokemonType === 'Grass' ? 'bg-green-500/20 text-green-400' :
              pokemon.pokemonType === 'Electric' ? 'bg-yellow-500/20 text-yellow-400' :
              pokemon.pokemonType === 'Psychic' ? 'bg-purple-500/20 text-purple-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {pokemon.pokemonType}
            </span>
            <span className="text-gray-400">Generation {pokemon.generation}</span>
          </div>

          {/* Owner Info */}
          <div className="flex items-center space-x-2 mb-6 text-gray-400">
            <User size={16} />
            <span>Owner: </span>
            <span className="font-mono text-sm">
              {isOwner ? 'You' : `${owner?.slice(0, 6)}...${owner?.slice(-4)}`}
            </span>
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
                <button
                  onClick={handleBuy}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-primary to-secondary rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <ShoppingCart size={20} />
                  <span>{isProcessing ? 'Processing...' : 'Buy Now'}</span>
                </button>
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

          {/* Not for sale message */}
          {!listing?.isActive && !auction?.isActive && (
            <div className="bg-gray-900 rounded-xl p-6 text-center text-gray-400">
              This card is not currently for sale
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CardDetail;
