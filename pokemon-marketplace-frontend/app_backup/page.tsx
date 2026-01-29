'use client';

import { Navbar } from '@/components/Navbar';
import { ListingGrid } from '@/components/ListingGrid';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <Navbar />

      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center mb-16 space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            DeFi Pokemon Marketplace
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl">
            Collect, trade, and battle with your favorite Pokemon NFTs on the blockchain.
            Secure, decentralized, and built for trainers.
          </p>
          <div className="flex gap-4 mt-8">
            <Button size="lg" variant="primary">Explore Market</Button>
            <Button size="lg" variant="secondary">My Collection</Button>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Recent Listings</h2>
          <ListingGrid />
        </div>
      </div>
    </main>
  );
}
