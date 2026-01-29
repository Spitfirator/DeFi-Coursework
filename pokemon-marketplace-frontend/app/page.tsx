'use client';

import { Navbar } from '@/components/Navbar';
import { ListingGrid } from '@/components/ListingGrid';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useMarketplaceData } from '@/hooks/useMarketplaceData';
import { formatEther } from 'ethers';
import { useMemo, useState, useEffect } from 'react';
import { useWeb3 } from '@/context/Web3Context';

export default function Home() {
  const { data: items } = useMarketplaceData();
  const { marketplaceContract } = useWeb3();
  const [totalVolume, setTotalVolume] = useState('0');

  // Fetch Volume from Events
  useEffect(() => {
    if (!marketplaceContract) return;

    const fetchVolume = async () => {
      try {
        // 1. Fixed Price Sales
        const soldFilter = marketplaceContract.filters.ItemSold();
        const soldEvents = await marketplaceContract.queryFilter(soldFilter);

        // 2. English Auctions Ended
        const auctionFilter = marketplaceContract.filters.AuctionEnded();
        const auctionEvents = await marketplaceContract.queryFilter(auctionFilter);

        // 3. Dutch Auctions Bought
        const dutchFilter = marketplaceContract.filters.DutchAuctionBought();
        const dutchEvents = await marketplaceContract.queryFilter(dutchFilter);

        let volume = 0n;

        // Sum Fixed Price
        soldEvents.forEach(e => {
          if ('args' in e) {
            volume += (e as any).args[4]; // price is 5th arg
          }
        });

        // Sum Auctions (Only if winner exists)
        auctionEvents.forEach(e => {
          if ('args' in e) {
            const amount = (e as any).args[3]; // amount is 4th arg
            if (amount > 0n) volume += amount;
          }
        });

        // Sum Dutch Auctions
        dutchEvents.forEach(e => {
          if ('args' in e) {
            volume += (e as any).args[3]; // price is 4th arg
          }
        });

        setTotalVolume(formatEther(volume));
      } catch (err) {
        console.error("Error fetching volume:", err);
      }
    };

    fetchVolume();
  }, [marketplaceContract]);

  // Calculate collection stats
  const stats = useMemo(() => {
    if (!items || items.length === 0) {
      return { floorPrice: '---', totalItems: 100, totalVolume: '---', listed: 0 };
    }

    // Active Listings (Fixed, Auction, Dutch)
    const listedItems = items.filter(i => i.saleType !== 'none');

    // Floor price calculation
    let floor = 0;
    if (listedItems.length > 0) {
      const prices = listedItems.map(i => {
        if (i.saleType === 'fixed' && i.listing) return parseFloat(formatEther(i.listing.price));
        if (i.saleType === 'auction' && i.auction) return parseFloat(formatEther(i.auction.startingPrice)); // Use starting price as floor
        if (i.saleType === 'dutch' && i.dutchAuction) return parseFloat(formatEther(i.dutchAuction.startPrice)); // Use start price
        return Infinity;
      }).filter(p => p !== Infinity);

      if (prices.length > 0) floor = Math.min(...prices);
    }

    return {
      floorPrice: floor > 0 ? floor.toFixed(2) : '---',
      totalItems: 100,
      totalVolume: parseFloat(totalVolume) > 0 ? parseFloat(totalVolume).toFixed(2) : '0.00',
      listed: listedItems.length
    };
  }, [items, totalVolume]);

  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Hero Section */}
      <div className="relative overflow-hidden h-[600px]">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-transparent to-slate-950 z-10" />

        {/* Animated Hero Banner Image */}
        <div className="absolute inset-0 w-full h-full animate-[kenburns_20s_infinite_alternate]">
          <img
            src="/hero-banner.png"
            alt="Pokemon NFT Collection"
            className="w-full h-full object-cover object-center"
          />
        </div>

        {/* Hero Content Overlay */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-24 text-center">
          <div className="container mx-auto px-4 space-y-6">
            <h1 className="text-6xl md:text-8xl font-black tracking-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] flex gap-4 justify-center flex-wrap">
              <span className="text-[#FFCB05] stroke-black drop-shadow-[4px_4px_0_#2B6CB0] paint-order-stroke stroke-[2px]">Collect.</span>
              <span className="text-[#3B4CCA] stroke-black drop-shadow-[4px_4px_0_#2B6CB0] paint-order-stroke stroke-[2px]">Trade.</span>
              <span className="text-[#CC0000] stroke-black drop-shadow-[4px_4px_0_#2B6CB0] paint-order-stroke stroke-[2px]">Own.</span>
            </h1>

            <p className="text-2xl md:text-3xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] max-w-2xl mx-auto tracking-wide border-text">
              <span className="text-[#4ADE80] drop-shadow-[2px_2px_0_#000]">100 Unique</span> <span className="text-[#F87171] drop-shadow-[2px_2px_0_#000]">Pokemon</span> NFTs
            </p>

            {/* Collection Stats - Simplified */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 mt-8 max-w-3xl mx-auto bg-black/50 backdrop-blur-md p-6 rounded-3xl border-2 border-[#FFCB05]/30 shadow-2xl">
              <div className="text-center group">
                <div className="text-2xl md:text-3xl font-black text-[#FFCB05] drop-shadow-md group-hover:scale-110 transition-transform">
                  {stats.floorPrice} <span className="text-sm text-white">ETH</span>
                </div>
                <div className="text-xs text-blue-200 uppercase font-bold tracking-widest mt-1">Floor</div>
              </div>
              <div className="text-center group">
                <div className="text-2xl md:text-3xl font-black text-[#4ADE80] drop-shadow-md group-hover:scale-110 transition-transform">
                  {stats.totalItems}
                </div>
                <div className="text-xs text-blue-200 uppercase font-bold tracking-widest mt-1">Items</div>
              </div>
              <div className="text-center group">
                <div className="text-2xl md:text-3xl font-black text-[#3B4CCA] drop-shadow-md group-hover:scale-110 transition-transform">
                  {stats.totalVolume} <span className="text-sm text-white">ETH</span>
                </div>
                <div className="text-xs text-blue-200 uppercase font-bold tracking-widest mt-1">Volume</div>
              </div>
              <div className="text-center group">
                <div className="text-2xl md:text-3xl font-black text-[#F87171] drop-shadow-md group-hover:scale-110 transition-transform">
                  {stats.listed}
                </div>
                <div className="text-xs text-blue-200 uppercase font-bold tracking-widest mt-1">Listed</div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-8">
              <Link href="/marketplace">
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg font-bold bg-white text-black hover:bg-gray-200 transition-all rounded-full border-0 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  Explore Collection
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Listings Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Trending Now</h2>
          <Link href="/marketplace">
            <Button variant="outline" className="text-white border-white/20 hover:bg-white/10">
              View All →
            </Button>
          </Link>
        </div>
        <ListingGrid items={items?.filter(i => i.saleType !== 'none').slice(0, 8)} />
      </div>

      {/* CSS for Ken Burns effect */}
      <style jsx global>{`
        @keyframes kenburns {
          0% { transform: scale(1.0); }
          100% { transform: scale(1.1); }
        }
      `}</style>
    </main>
  );
}
