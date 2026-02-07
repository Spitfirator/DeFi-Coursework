import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import PokemonCard from '../components/PokemonCard';
import { Loader } from 'lucide-react';

function Home() {
  const { pokemonContract, tradingContract, provider } = useWeb3();
  const [floorPrice, setFloorPrice] = useState('---');
  const [totalItems, setTotalItems] = useState('---');
  const [volume, setVolume] = useState('---');
  const [listedCount, setListedCount] = useState('---');
  const [trendingItems, setTrendingItems] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  const loadStats = useCallback(async () => {
    if (!pokemonContract || !tradingContract || !provider) return;

    try {
      // Total items
      const totalMinted = await pokemonContract.totalMinted();
      const total = Number(totalMinted);
      setTotalItems(total.toString());

      // Iterate tokens for listings/auctions + floor price
      let minPrice = null;
      let activeCount = 0;
      const listingsData = [];
      const auctionsData = [];

      for (let i = 0; i < total; i++) {
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
            generation: Number(stats.generation)
          };

          if (listing.isActive) {
            activeCount++;
            const priceWei = listing.price;
            if (minPrice === null || priceWei < minPrice) {
              minPrice = priceWei;
            }
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
            activeCount++;
            const startPriceWei = auction.startingPrice;
            if (minPrice === null || startPriceWei < minPrice) {
              minPrice = startPriceWei;
            }
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
          // skip token errors
        }
      }

      setListedCount(activeCount.toString());
      setFloorPrice(minPrice ? `${ethers.formatEther(minPrice)} ETH` : '---');

      // Trending: combine listings + auctions, take up to 8
      const combined = [...listingsData, ...auctionsData].slice(0, 8);
      setTrendingItems(combined);

      // Volume from Sale and AuctionFinalized events
      try {
        const saleFilter = tradingContract.filters.Sale();
        const auctionFinalizedFilter = tradingContract.filters.AuctionFinalized();
        const [saleEvents, auctionEvents] = await Promise.all([
          tradingContract.queryFilter(saleFilter),
          tradingContract.queryFilter(auctionFinalizedFilter)
        ]);

        let totalVolume = BigInt(0); // eslint-disable-line no-undef
        for (const event of saleEvents) {
          totalVolume += event.args.price;
        }
        for (const event of auctionEvents) {
          totalVolume += event.args.amount;
        }
        setVolume(`${ethers.formatEther(totalVolume)} ETH`);
      } catch (err) {
        setVolume('0 ETH');
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingTrending(false);
    }
  }, [pokemonContract, tradingContract, provider]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const stats = [
    { label: 'Floor Price', value: floorPrice },
    { label: 'Total Items', value: totalItems },
    { label: 'Volume', value: volume },
    { label: 'Listed', value: listedCount }
  ];

  return (
    <div>
      {/* Hero Section */}
      <div className="relative w-full h-[500px] overflow-hidden rounded-2xl mb-12">
        {/* Background image with ken burns */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/hero-banner.png)',
            animation: 'kenburns 20s ease-in-out infinite'
          }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="text-5xl md:text-7xl font-black mb-4 leading-tight">
            <span className="text-yellow-400" style={{ WebkitTextStroke: '2px #ca8a04' }}>Collect.</span>{' '}
            <span className="text-blue-400" style={{ WebkitTextStroke: '2px #2563eb' }}>Trade.</span>{' '}
            <span className="text-red-500" style={{ WebkitTextStroke: '2px #dc2626' }}>Own.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8">
            100 Unique Pokemon NFTs
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 w-full max-w-2xl">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-black/50 backdrop-blur-md rounded-xl p-4 border border-white/10"
              >
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            to="/marketplace"
            className="px-8 py-3 bg-gradient-to-r from-primary to-secondary rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Explore Collection
          </Link>
        </div>
      </div>

      {/* Trending Now Section */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Trending Now</h2>
          <Link
            to="/marketplace"
            className="text-primary hover:text-secondary transition-colors font-semibold"
          >
            View All &rarr;
          </Link>
        </div>

        {loadingTrending ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-primary" size={48} />
          </div>
        ) : trendingItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {trendingItems.map((item) => (
              <PokemonCard
                key={`${item.tokenId}-${item.listing ? 'l' : 'a'}`}
                pokemon={item}
                listing={item.listing}
                auction={item.auction}
                showActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No active listings yet</p>
            <p className="text-sm mt-2">Connect your wallet and list some Pokemon!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
