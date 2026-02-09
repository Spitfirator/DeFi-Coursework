import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import PokemonCard from '../components/PokemonCard';
import { ethers } from 'ethers';
import { Search, Filter, Loader, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function Marketplace() {
  const { pokemonContract, tradingContract, account, refreshTrigger } = useWeb3();
  const [listings, setListings] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('listings');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const loadMarketData = useCallback(async () => {
    if (!pokemonContract || !tradingContract) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const totalMinted = await pokemonContract.totalMinted();
      const listingsData = [];
      const auctionsData = [];

      for (let i = 0; i < Number(totalMinted); i++) {
        try {
          const stats = await pokemonContract.getPokemonStats(i);
          const listing = await tradingContract.getListing(i);
          const auction = await tradingContract.getAuction(i);

          const pokemonData = {
            tokenId: i,
            name: stats.name,
            pokemonType: stats.pokemonType,
            rarity: stats.rarity,
            hp: Number(stats.hp),
            attack: Number(stats.attack),
            defense: Number(stats.defense),
            speed: Number(stats.speed),
            generation: Number(stats.generation),
            level: Number(stats.level)
          };

          if (listing.isActive) {
            listingsData.push({
              ...pokemonData,
              listing: {
                seller: listing.seller,
                price: ethers.formatEther(listing.price),
                isActive: listing.isActive
              }
            });
          }

          if (auction.isActive) {
            const timeRemaining = await tradingContract.getAuctionTimeRemaining(i);
            auctionsData.push({
              ...pokemonData,
              auction: {
                seller: auction.seller,
                startingPrice: ethers.formatEther(auction.startingPrice),
                reservePrice: ethers.formatEther(auction.reservePrice),
                highestBid: ethers.formatEther(auction.highestBid),
                highestBidder: auction.highestBidder,
                endTime: Number(auction.endTime),
                timeRemaining: Number(timeRemaining),
                isActive: auction.isActive
              }
            });
          }
        } catch (err) {
          console.error(`Error loading token ${i}:`, err);
        }
      }

      setListings(listingsData);
      setAuctions(auctionsData);
    } catch (error) {
      console.error('Failed to load market data:', error);
      toast.error('Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  }, [pokemonContract, tradingContract]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData, refreshTrigger]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!tradingContract) return;

    const handleListed = () => loadMarketData();
    const handleListingCancelled = () => loadMarketData();
    const handleSale = () => loadMarketData();
    const handleAuctionCreated = () => loadMarketData();
    const handleAuctionCancelled = () => loadMarketData();
    const handleBidPlaced = () => loadMarketData();
    const handleAuctionFinalized = () => loadMarketData();

    tradingContract.on('Listed', handleListed);
    tradingContract.on('ListingCancelled', handleListingCancelled);
    tradingContract.on('Sale', handleSale);
    tradingContract.on('AuctionCreated', handleAuctionCreated);
    tradingContract.on('AuctionCancelled', handleAuctionCancelled);
    tradingContract.on('BidPlaced', handleBidPlaced);
    tradingContract.on('AuctionFinalized', handleAuctionFinalized);

    return () => {
      tradingContract.off('Listed', handleListed);
      tradingContract.off('ListingCancelled', handleListingCancelled);
      tradingContract.off('Sale', handleSale);
      tradingContract.off('AuctionCreated', handleAuctionCreated);
      tradingContract.off('AuctionCancelled', handleAuctionCancelled);
      tradingContract.off('BidPlaced', handleBidPlaced);
      tradingContract.off('AuctionFinalized', handleAuctionFinalized);
    };
  }, [tradingContract, loadMarketData]);

  const filteredListings = listings.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRarity = filterRarity === 'all' || item.rarity === filterRarity;
    const matchesType = filterType === 'all' || item.pokemonType === filterType;
    return matchesSearch && matchesRarity && matchesType;
  });

  const filteredAuctions = auctions.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRarity = filterRarity === 'all' || item.rarity === filterRarity;
    const matchesType = filterType === 'all' || item.pokemonType === filterType;
    return matchesSearch && matchesRarity && matchesType;
  });

  const rarities = ['all', 'Common', 'Uncommon', 'Rare', 'Legendary'];
  const types = ['all', 'Electric', 'Fire', 'Water', 'Grass', 'Psychic', 'Ghost', 'Rock', 'Bug', 'Normal'];

  if (!account) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to view the marketplace</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Marketplace</h1>

      {/* Filters */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search Pokemon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          {/* Rarity Filter */}
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
            >
              {rarities.map(r => (
                <option key={r} value={r}>{r === 'all' ? 'All Rarities' : r}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
          >
            {types.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('listings')}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'listings'
              ? 'bg-primary text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Fixed Price ({filteredListings.length})
        </button>
        <button
          onClick={() => setActiveTab('auctions')}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'auctions'
              ? 'bg-secondary text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Auctions ({filteredAuctions.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      ) : activeTab === 'listings' ? (
        filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((item) => (
              <PokemonCard
                key={item.tokenId}
                pokemon={item}
                listing={item.listing}
                showActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p>No listings found</p>
          </div>
        )
      ) : (
        filteredAuctions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAuctions.map((item) => (
              <PokemonCard
                key={item.tokenId}
                pokemon={item}
                auction={item.auction}
                showActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p>No active auctions</p>
          </div>
        )
      )}
    </div>
  );
}

export default Marketplace;
