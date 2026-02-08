import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { Loader, AlertCircle, Search, ArrowUpDown, Sparkles, Filter } from 'lucide-react';
import PokemonCard from '../components/PokemonCard';
import FilterSidebar from '../components/FilterSidebar';
import { ethers } from 'ethers';

function Collection() {
    const { pokemonContract, tradingContract, account } = useWeb3();
    const [allNFTs, setAllNFTs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // New Filter State
    const [filters, setFilters] = useState({
        status: 'all',
        priceMin: '',
        priceMax: '',
        rarity: 'all',
        type: 'all'
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('id_asc');

    useEffect(() => {
        if (pokemonContract && tradingContract) {
            loadAllNFTs();
        }
    }, [pokemonContract, tradingContract]);

    const loadAllNFTs = async () => {
        try {
            setLoading(true);
            const totalSupply = await pokemonContract.totalMinted();
            const nfts = [];

            for (let i = 0; i < totalSupply; i++) {
                try {
                    const stats = await pokemonContract.getPokemonStats(i);
                    const owner = await pokemonContract.ownerOf(i);

                    // Get listing/auction data
                    const listingData = await tradingContract.getListing(i);
                    const auctionData = await tradingContract.getAuction(i);
                    const dutchAuctionData = await tradingContract.dutchAuctions(i);

                    const nft = {
                        tokenId: i,
                        name: stats.name,
                        pokemonType: stats.pokemonType,
                        rarity: stats.rarity,
                        hp: Number(stats.hp),
                        attack: Number(stats.attack),
                        defense: Number(stats.defense),
                        speed: Number(stats.speed),
                        generation: Number(stats.generation),
                        owner: owner
                    };

                    // Add listing data if active
                    if (listingData.isActive) {
                        nft.listing = {
                            seller: listingData.seller,
                            price: ethers.formatEther(listingData.price),
                            isActive: true
                        };
                    }

                    // Add auction data if active
                    if (auctionData.isActive) {
                        nft.auction = {
                            seller: auctionData.seller,
                            startingPrice: ethers.formatEther(auctionData.startingPrice),
                            highestBid: ethers.formatEther(auctionData.highestBid),
                            reservePrice: ethers.formatEther(auctionData.reservePrice),
                            endTime: Number(auctionData.endTime),
                            isActive: true
                        };
                    }

                    // Add dutch auction data if active
                    if (dutchAuctionData.isActive) {
                        nft.dutchAuction = {
                            seller: dutchAuctionData.seller,
                            startingPrice: ethers.formatEther(dutchAuctionData.startingPrice),
                            reservePrice: ethers.formatEther(dutchAuctionData.reservePrice),
                            startTime: Number(dutchAuctionData.startTime),
                            duration: Number(dutchAuctionData.duration),
                            isActive: true
                        };
                    }

                    nfts.push(nft);
                } catch (error) {
                    console.error(`Error loading NFT ${i}:`, error);
                }
            }

            setAllNFTs(nfts);
        } catch (error) {
            console.error('Error loading collection:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterItem = (item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRarity = filters.rarity === 'all' || item.rarity === filters.rarity;
        const matchesType = filters.type === 'all' || item.pokemonType === filters.type;

        // Status Filter
        let matchesStatus = false;
        if (filters.status === 'all') matchesStatus = true;
        else if (filters.status === 'listings' && item.listing?.isActive) matchesStatus = true;
        else if (filters.status === 'auctions' && item.auction?.isActive) matchesStatus = true;
        else if (filters.status === 'dutch' && item.dutchAuction?.isActive) matchesStatus = true;

        // Price Filter
        let price = null;
        if (item.listing?.isActive) price = parseFloat(item.listing.price);
        else if (item.auction?.isActive) price = parseFloat(item.auction.highestBid > 0 ? item.auction.highestBid : item.auction.startingPrice);
        else if (item.dutchAuction?.isActive) price = parseFloat(item.dutchAuction.startingPrice);

        const matchesMinPrice = filters.priceMin === '' || (price !== null && price >= parseFloat(filters.priceMin));
        const matchesMaxPrice = filters.priceMax === '' || (price !== null && price <= parseFloat(filters.priceMax));

        return matchesSearch && matchesRarity && matchesType && matchesStatus && matchesMinPrice && matchesMaxPrice;
    };

    const filteredNFTs = allNFTs.filter(filterItem).sort((a, b) => {
        let priceA = 0, priceB = 0;

        const getPrice = (item) => {
            if (item.listing) return parseFloat(item.listing.price);
            if (item.auction) return parseFloat(item.auction.highestBid > 0 ? item.auction.highestBid : item.auction.startingPrice);
            if (item.dutchAuction) return parseFloat(item.dutchAuction.startingPrice);
            return 0;
        };

        priceA = getPrice(a);
        priceB = getPrice(b);

        if (sortOrder === 'price_asc') {
            if (priceA === 0 && priceB !== 0) return 1;
            if (priceA !== 0 && priceB === 0) return -1;
            return priceA - priceB;
        }
        if (sortOrder === 'price_desc') return priceB - priceA;
        if (sortOrder === 'id_asc') return a.tokenId - b.tokenId;
        if (sortOrder === 'id_desc') return b.tokenId - a.tokenId;
        return 0;
    });

    if (!account) {
        return (
            <div className="text-center py-20">
                <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                <p className="text-gray-400">Please connect your wallet to browse the collection</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="flex flex-col lg:flex-row">

                {/* Sidebar Filter */}
                <FilterSidebar
                    filters={filters}
                    setFilters={setFilters}
                    isMarketplace={true}
                    isOpen={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                />

                {/* Main Content */}
                <div className="flex-1 min-h-screen px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300">
                    <div className="mb-8 pt-6">
                        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Full Collection</h1>
                        <p className="text-gray-400">Browse all {allNFTs.length} Pokemon cards - listed and unlisted</p>
                    </div>

                    {/* Sticky Top Bar */}
                    <div className="sticky top-20 z-20 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50 mb-6 transition-all duration-300 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                            {/* Search & Mobile Filter Toggle */}
                            <div className="flex gap-4 w-full md:w-auto flex-1 max-w-2xl">
                                <button
                                    onClick={() => setIsFilterOpen(true)}
                                    className="lg:hidden p-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 transition-colors flex-shrink-0"
                                >
                                    <Filter size={20} />
                                </button>

                                {/* Search Input */}
                                <div className="relative w-full group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-lg opacity-20 group-focus-within:opacity-75 transition duration-500 blur"></div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-white transition-colors" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Search Pokemon..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 text-gray-100 rounded-lg focus:outline-none focus:bg-gray-800 transition-all placeholder-gray-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Side */}
                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg border border-gray-800">
                                    <Sparkles size={14} className="text-primary" />
                                    <span className="text-gray-300 text-sm font-medium whitespace-nowrap">
                                        {filteredNFTs.length} Items
                                    </span>
                                </div>

                                <div className="relative flex-1 md:flex-none">
                                    <select
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(e.target.value)}
                                        className="w-full md:w-48 appearance-none pl-4 pr-10 py-2.5 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-primary cursor-pointer text-sm font-medium text-gray-200 hover:border-gray-700 transition-colors"
                                    >
                                        <option value="id_asc">ID: Low to High</option>
                                        <option value="id_desc">ID: High to Low</option>
                                        <option value="price_asc">Price: Low to High</option>
                                        <option value="price_desc">Price: High to Low</option>
                                    </select>
                                    <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader className="animate-spin text-primary" size={48} />
                        </div>
                    ) : filteredNFTs.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20 animate-fadeIn">
                            {filteredNFTs.map((nft) => (
                                <PokemonCard
                                    key={nft.tokenId}
                                    pokemon={nft}
                                    listing={nft.listing}
                                    auction={nft.auction}
                                    dutchAuction={nft.dutchAuction}
                                    showActions={true}
                                    showBuyOnly={true}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-32 opacity-50">
                            <Search size={64} className="mx-auto text-gray-600 mb-6" />
                            <h2 className="text-2xl font-bold mb-2 text-gray-400">No Pokemon Found</h2>
                            <p className="text-gray-500">Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Collection;
