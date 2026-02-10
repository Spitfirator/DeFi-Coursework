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

      // Iterate tokens for listings/auctions/dutch + floor price
      let minPrice = null;
      let activeCount = 0;
      const listingsData = [];
      const auctionsData = [];
      const dutchAuctionsData = [];

      for (let i = 0; i < total; i++) {
        try {
          const stats = await pokemonContract.getPokemonStats(i);
          const listing = await tradingContract.getListing(i);
          const auction = await tradingContract.getAuction(i);
          const dutchData = await tradingContract.dutchAuctions(i);

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

          if (dutchData.isActive && !dutchData.sold) {
            activeCount++;
            // Calculate current price roughly for floor price
            // Or just use startingPrice/reservePrice as bounds?
            // Use current price from contract for accuracy?
            // Let's call getCurrentDutchPrice if active
            const currentPrice = await tradingContract.getCurrentDutchPrice(i);

            if (minPrice === null || currentPrice < minPrice) {
              minPrice = currentPrice;
            }

            dutchAuctionsData.push({
              ...pokemonData,
              dutchAuction: {
                seller: dutchData.seller,
                startingPrice: ethers.formatEther(dutchData.startingPrice),
                reservePrice: ethers.formatEther(dutchData.reservePrice),
                startTime: Number(dutchData.startTime),
                duration: Number(dutchData.duration),
                isActive: dutchData.isActive,
                currentPrice: ethers.formatEther(currentPrice)
              }
            });
          }
        } catch (err) {
          // skip token errors
        }
      }

      setListedCount(activeCount.toString());
      setFloorPrice(minPrice ? `${ethers.formatEther(minPrice)} ETH` : '---');

      // ACTIVITY-BASED TRENDING ALGORITHM
      // Show NFTs with most bids and most trades in the LAST 48 HOURS

      try {
        const now = Math.floor(Date.now() / 1000);
        const FORTY_EIGHT_HOURS = 48 * 60 * 60; // 48 hours in seconds
        const cutoffTime = now - FORTY_EIGHT_HOURS;

        // Get all BidPlaced events to count bids per token
        const bidFilter = tradingContract.filters.BidPlaced();
        const bidEvents = await tradingContract.queryFilter(bidFilter);

        // Count bids per token (only from last 48 hours)
        const bidCounts = {};
        for (const event of bidEvents) {
          const block = await event.getBlock();
          const eventTime = block.timestamp;

          // Only count if within last 48 hours
          if (eventTime >= cutoffTime) {
            const tokenId = Number(event.args.tokenId);
            bidCounts[tokenId] = (bidCounts[tokenId] || 0) + 1;
          }
        }

        // Get all Sale events to count trades per token
        const saleFilter = tradingContract.filters.Sale();
        const dutchSaleFilter = tradingContract.filters.DutchAuctionPurchased();

        const [saleEvents, dutchSaleEvents] = await Promise.all([
          tradingContract.queryFilter(saleFilter),
          tradingContract.queryFilter(dutchSaleFilter)
        ]);

        // Count sales per token (only from last 48 hours)
        const saleCounts = {};
        const processSaleEvent = async (event) => {
          const block = await event.getBlock();
          const eventTime = block.timestamp;

          // Only count if within last 48 hours
          if (eventTime >= cutoffTime) {
            const tokenId = Number(event.args.tokenId);
            saleCounts[tokenId] = (saleCounts[tokenId] || 0) + 1;
          }
        };

        for (const event of saleEvents) await processSaleEvent(event);
        for (const event of dutchSaleEvents) await processSaleEvent(event);

        // Calculate activity score for ACTIVE items only (Listed/Auction)
        // User Requirement: "trending now should have only the ones which are listed or in bids, not the ones which are unlisted"
        const combined = [...listingsData, ...auctionsData, ...dutchAuctionsData];

        const itemsWithActivity = combined.map(item => {
          const tokenId = item.tokenId;
          const bidCount = bidCounts[tokenId] || 0;
          const saleCount = saleCounts[tokenId] || 0;

          // Strict Activity Score (Bids + Sales in last 48h)
          let activityScore = (bidCount * 3) + (saleCount * 10);

          return {
            ...item,
            activityScore,
            bidCount,
            saleCount,
            // isHot is handled later based on ranking
          };
        });

        // Sort by activity score (highest first), filter strictly for > 0, and take top 8
        const trending = itemsWithActivity
          .filter(item => item.activityScore > 0)
          .sort((a, b) => b.activityScore - a.activityScore)
          .slice(0, 8);

        // Only mark the top 3 items as "Hot/Popular" to make it more exclusive
        const finalTrending = trending.map((item, index) => ({
          ...item,
          isHot: index < 3 // Top 3 get the badge
        }));

        // If list is empty in strict mode, it will correctly show "No trending items"
        setTrendingItems(finalTrending);
      } catch (err) {
        console.error('Failed to calculate trending:', err);
        // Fallback: If calculation fails, strict adherence means we don't guess.
        setTrendingItems([]);
      }

      // Volume from Sale, AuctionFinalized, and DutchAuctionPurchased events
      try {
        const saleFilter = tradingContract.filters.Sale();
        const auctionFinalizedFilter = tradingContract.filters.AuctionFinalized();
        const dutchPurchasedFilter = tradingContract.filters.DutchAuctionPurchased();

        const [saleEvents, auctionEvents, dutchEvents] = await Promise.all([
          tradingContract.queryFilter(saleFilter),
          tradingContract.queryFilter(auctionFinalizedFilter),
          tradingContract.queryFilter(dutchPurchasedFilter)
        ]);

        let totalVolume = BigInt(0); // eslint-disable-line no-undef
        for (const event of saleEvents) {
          totalVolume += event.args.price;
        }
        for (const event of auctionEvents) {
          totalVolume += event.args.amount;
        }
        for (const event of dutchEvents) {
          totalVolume += event.args.price; // DutchAuctionPurchased has price arg
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
      <div className="relative w-full h-auto min-h-[500px] md:h-[500px] overflow-hidden rounded-2xl mb-12">
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
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 py-12 md:py-0">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-4 leading-tight">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                isHot={item.isHot}
                compactCart={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No trending items right now</p>
            <p className="text-sm mt-2">Be the first to bid or trade to start a trend!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
