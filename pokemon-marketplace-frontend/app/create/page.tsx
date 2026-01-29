'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ListingGrid } from '@/components/ListingGrid';
import { useWeb3 } from '@/context/Web3Context';
import { MarketplaceItem } from '@/types/app-types';
import { Button } from '@/components/ui/Button';
import { CreateListingModal } from '@/components/modals/CreateListingModal';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function CreateListingPage() {
    const { account } = useWeb3();
    const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const unlistedFilter = (item: MarketplaceItem) => {
        if (!account) return false;
        // Must be owner and NOT listed
        const user = account.toLowerCase();
        const isOwner = item.owner.toLowerCase() === user;
        const isUnlisted = item.saleType === 'none';

        return isOwner && isUnlisted;
    };

    const handleListClick = (item: MarketplaceItem) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Navbar />

            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col gap-6 mb-8">
                    <Link href="/my-nfts" className="flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Collection
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">Create New Listing</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">Select a Pokemon from your collection to list for sale</p>
                    </div>
                </div>

                {!account ? (
                    <div className="text-center py-20">
                        <p className="text-lg text-gray-500">Please connect your wallet to view your collection.</p>
                    </div>
                ) : (
                    <ListingGrid
                        filter={unlistedFilter}
                        renderAction={(item) => (
                            <Button onClick={() => handleListClick(item)} className="w-full">
                                List Item
                            </Button>
                        )}
                    />
                )}
            </div>

            <CreateListingModal
                item={selectedItem}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </main>
    );
}
