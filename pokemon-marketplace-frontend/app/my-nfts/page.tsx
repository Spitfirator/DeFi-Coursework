'use client';

import { Navbar } from '@/components/Navbar';
import { ListingGrid } from '@/components/ListingGrid';
import { useWeb3 } from '@/context/Web3Context';
import { MarketplaceItem } from '@/types/app-types';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function MyNFTsPage() {
    const { account } = useWeb3();

    const myFilter = (item: MarketplaceItem) => {
        if (!account) return false;
        const user = account.toLowerCase();

        // DEBUG: Log filtering
        console.log(`Filtering token #${item.pokemon.tokenId}:`, {
            owner: item.owner,
            user: user,
            match: item.owner.toLowerCase() === user
        });

        // 1. Direct Ownership
        if (item.owner.toLowerCase() === user) return true;

        // 2. Seller in Auction (Escrowed)
        if (item.saleType === 'auction' && item.auction?.seller.toLowerCase() === user) return true;

        // 3. Seller in Dutch Auction (Escrowed)
        if (item.saleType === 'dutch' && item.dutchAuction?.seller.toLowerCase() === user) return true;

        return false;
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Navbar />

            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">My Collection</h1>
                    <Link href="/create">
                        <Button>Create Listing</Button>
                    </Link>
                </div>

                {!account ? (
                    <div className="text-center py-20">
                        <p className="text-lg text-gray-500">Please connect your wallet to view your collection.</p>
                    </div>
                ) : (
                    <ListingGrid filter={myFilter} />
                )}
            </div>
        </main>
    );
}
