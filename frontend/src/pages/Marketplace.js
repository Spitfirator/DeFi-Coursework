import { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import PokemonCard from '../components/PokemonCard';
import FilterSidebar from '../components/FilterSidebar';
import { ethers } from 'ethers';
import { Search, Loader, AlertCircle, ArrowUpDown, Sparkles, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { isStaleBlockError, STALE_BLOCK_MESSAGE } from '../utils/errors';

function Marketplace() {
  const { pokemonContract, tradingContract, account, refreshTrigger } = useWeb3();
  const [listings, setListings] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [dutchAuctions, setDutchAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [filters, setFilters] = useState({
    status: 'all',
    priceMin: '',
    priceMax: '',
    rarity: 'all',
    type: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('price_asc');

  const loadMarketData = useCallback(async () => {
    if (!pokemonContract || !tradingContract) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const total = Number(await pokemonContract.totalSupply());
      const listingsData = [];
      const auctionsData = [];
      const dutchAuctionsData = [];

      for (let i = 0; i < total; i++) {
        try {
          const tokenId = Number(await pokemonContract.tokenByIndex(i));
          const stats = await pokemonContract.getPokemonStats(tokenId);
          const listing = await tradingContract.getListing(tokenId);
          const auction = await tradingContract.getAuction(tokenId);
          const dutchAuction = await tradingContract.dutchAuctions(tokenId);

          const pokemonData = {
            tokenId,
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
            const timeRemaining = await tradingContract.getAuctionTimeRemaining(tokenId);
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

          if (dutchAuction.isActive && !dutchAuction.sold) {
            const now = Math.floor(Date.now() / 1000);
            const endTime = Number(dutchAuction.startTime) + Number(dutchAuction.duration);

            // Only show active, unexpired auctions
            if (now < endTime) {
              dutchAuctionsData.push({
                ...pokemonData,
                dutchAuction: {
                  seller: dutchAuction.seller,
                  startingPrice: ethers.formatEther(dutchAuction.startingPrice),
                  reservePrice: ethers.formatEther(dutchAuction.reservePrice),
                  startTime: Number(dutchAuction.startTime),
                  duration: Number(dutchAuction.duration),
                  isActive: dutchAuction.isActive,
                  sold: dutchAuction.sold
                }
              });
            }
          }
        } catch (err) {
          console.error(`Error loading token:`, err);
        }
      }

      setListings(listingsData);
      setAuctions(auctionsData);
      setDutchAuctions(dutchAuctionsData);
    } catch (error) {
      console.error('Failed to load market data:', error);
      toast.error(isStaleBlockError(error) ? STALE_BLOCK_MESSAGE : 'Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  }, [pokemonContract, tradingContract]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData, refreshTrigger]);

  useEffect(() => {
    if (!tradingContract) return;

    const handleUpdate = () => loadMarketData();

    tradingContract.on('Listed', handleUpdate);
    tradingContract.on('ListingCancelled', handleUpdate);
    tradingContract.on('Sale', handleUpdate);
    tradingContract.on('AuctionCreated', handleUpdate);
    tradingContract.on('AuctionCancelled', handleUpdate);
    tradingContract.on('BidPlaced', handleUpdate);
    tradingContract.on('AuctionFinalized', handleUpdate);

    return () => {
      tradingContract.removeAllListeners();
    };
  }, [tradingContract, loadMarketData]);

  const filterItem = (item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRarity = filters.rarity === 'all' || item.rarity === filters.rarity;
    const matchesType = filters.type === 'all' || item.pokemonType.includes(filters.type);

    let matchesStatus = false;
    if (filters.status === 'all') matchesStatus = true;
    else if (filters.status === 'listings' && item.listing?.isActive) matchesStatus = true;
    else if (filters.status === 'auctions' && item.auction?.isActive) matchesStatus = true;
    else if (filters.status === 'dutch' && item.dutchAuction?.isActive) matchesStatus = true;

    let price = null;
    if (item.listing?.isActive) price = parseFloat(item.listing.price);
    else if (item.auction?.isActive) price = parseFloat(item.auction.highestBid > 0 ? item.auction.highestBid : item.auction.startingPrice);
    else if (item.dutchAuction?.isActive) price = parseFloat(item.dutchAuction.startingPrice);

    const matchesMinPrice = filters.priceMin === '' || (price !== null && price >= parseFloat(filters.priceMin));
    const matchesMaxPrice = filters.priceMax === '' || (price !== null && price <= parseFloat(filters.priceMax));

    return matchesSearch && matchesRarity && matchesType && matchesStatus && matchesMinPrice && matchesMaxPrice;
  };

  const allItems = [...listings, ...auctions, ...dutchAuctions];

  const filteredItems = allItems.filter(filterItem).sort((a, b) => {
    const getPrice = (item) => {
      if (item.listing) return parseFloat(item.listing.price);
      if (item.auction) return parseFloat(item.auction.highestBid > 0 ? item.auction.highestBid : item.auction.startingPrice);
      if (item.dutchAuction) return parseFloat(item.dutchAuction.startingPrice);
      return 0;
    };

    const priceA = getPrice(a);
    const priceB = getPrice(b);

    if (sortOrder === 'price_asc') return priceA - priceB;
    if (sortOrder === 'price_desc') return priceB - priceA;
    if (sortOrder === 'id_asc') return a.tokenId - b.tokenId;
    if (sortOrder === 'id_desc') return b.tokenId - a.tokenId;
    return 0;
  });

  const hasActiveFilters = filters.status !== 'all' || filters.rarity !== 'all' || filters.type !== 'all' || filters.priceMin !== '' || filters.priceMax !== '';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 pt-2">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Marketplace</h1>
        <p className="text-gray-400">Buy and sell Pokemon cards</p>
      </div>

      {/* Search & Controls Bar */}
      <div className="sticky top-20 z-20 bg-gray-950/80 backdrop-blur-xl border border-gray-800/50 rounded-xl mb-6 px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3 w-full md:w-auto flex-1 max-w-2xl">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-2.5 rounded-lg border transition-colors flex-shrink-0 ${isFilterOpen || hasActiveFilters
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
            >
              <Filter size={20} />
            </button>

            <div className="relative w-full group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-lg opacity-20 group-focus-within:opacity-75 transition duration-500 blur"></div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-white transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 text-gray-100 rounded-lg focus:outline-none focus:bg-gray-800 transition-all placeholder-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg border border-gray-800">
              <Sparkles size={14} className="text-primary" />
              <span className="text-gray-300 text-sm font-medium whitespace-nowrap">
                {filteredItems.length} Items
              </span>
            </div>

            <div className="relative flex-1 md:flex-none">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full md:w-48 appearance-none pl-4 pr-10 py-2.5 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-primary cursor-pointer text-sm font-medium text-gray-200 hover:border-gray-700 transition-colors"
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="id_asc">ID: Low to High</option>
                <option value="id_desc">ID: High to Low</option>
              </select>
              <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Inline Filter Panel */}
      <FilterSidebar
        filters={filters}
        setFilters={setFilters}
        isMarketplace={true}
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      />

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20 animate-fadeIn">
          {filteredItems.map((item) => (
            <PokemonCard
              key={`${item.tokenId}-${item.listing ? 'l' : item.auction ? 'a' : 'd'}`}
              pokemon={item}
              listing={item.listing}
              auction={item.auction}
              dutchAuction={item.dutchAuction}
              showActions={true}
              showBuyOnly={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-32 opacity-50">
          <Search size={64} className="mx-auto text-gray-600 mb-6" />
          <h2 className="text-2xl font-bold mb-2 text-gray-400">No Items Found</h2>
          <p className="text-gray-500">Try adjusting your filters or search terms</p>
        </div>
      )}
    </div>
  );
}

export default Marketplace;
