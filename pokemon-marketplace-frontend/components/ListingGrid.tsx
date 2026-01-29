'use client';

import React from 'react';
import { useMarketplaceData } from '../hooks/useMarketplaceData';
import { PokemonCard } from './PokemonCard';
import { Button } from './ui/Button';
import { Loader2, AlertCircle } from 'lucide-react';
import { formatEther } from 'ethers';
import { BuyModal } from './modals/BuyModal';
import { BidModal } from './modals/BidModal';
import { MarketplaceItem } from '../types/app-types';
import { useWeb3 } from '../context/Web3Context';
import { CreateListingModal } from './modals/CreateListingModal';

interface ListingGridProps {
    filter?: (item: MarketplaceItem) => boolean;
    renderAction?: (item: MarketplaceItem) => React.ReactNode;
    items?: MarketplaceItem[]; // Allow passing filtered items directly
}

export function ListingGrid({ filter, renderAction, items: propItems }: ListingGridProps) {
    const { data: allItems, isLoading, error } = useMarketplaceData();
    const [selectedBuyItem, setSelectedBuyItem] = React.useState<MarketplaceItem | null>(null);
    const [selectedBidItem, setSelectedBidItem] = React.useState<MarketplaceItem | null>(null);
    const [isBuyModalOpen, setIsBuyModalOpen] = React.useState(false);
    const [isBidModalOpen, setIsBidModalOpen] = React.useState(false);
    const [isListModalOpen, setIsListModalOpen] = React.useState(false);
    const [selectedListItem, setSelectedListItem] = React.useState<MarketplaceItem | null>(null);

    // Use prop items if provided, otherwise apply filtering
    const items = React.useMemo(() => {
        if (propItems) return propItems; // Use filtered items from parent
        if (!allItems) return [];
        if (!filter) return allItems.filter(i => i.saleType !== 'none');
        return allItems.filter(filter);
    }, [allItems, filter, propItems]);

    const openBuyModal = (item: MarketplaceItem) => {
        setSelectedBuyItem(item);
        setIsBuyModalOpen(true);
    };

    const openBidModal = (item: MarketplaceItem) => {
        setSelectedBidItem(item);
        setIsBidModalOpen(true);
    };


    const openListModal = (item: MarketplaceItem) => {
        setSelectedListItem(item);
        setIsListModalOpen(true);
    };
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
                <p>Loading marketplace items...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-red-500">
                <AlertCircle className="h-10 w-10 mb-4" />
                <p>Error loading items. Please check if you are connected to the correct network.</p>
                <p className="text-sm mt-2 text-gray-400">{(error as Error).message}</p>
            </div>
        );
    }

    if (!items || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <p className="text-xl font-semibold">No items found</p>
                <p className="mt-2 text-gray-400">Be the first to list a Pokemon!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {items.map((item) => (
                <div key={item.pokemon.tokenId.toString()}>
                    <PokemonCard
                        pokemon={item.pokemon}
                        imageUri={item.imageUri}
                    >
                        <div className="w-full flex-col flex gap-2">
                            {renderAction ? renderAction(item) : (
                                <>
                                    {item.saleType === 'fixed' && (
                                        <Button className="w-full" onClick={() => openBuyModal(item)}>
                                            Buy for {item.listing ? formatEther(item.listing.price) : '0'} ETH
                                        </Button>
                                    )}
                                    {item.saleType === 'auction' && (
                                        <div className="w-full">
                                            <div className="text-xs text-center mb-1 text-gray-500">
                                                Current Bid: {item.auction ? formatEther(item.auction.highestBid) : '0'} ETH
                                            </div>
                                            <Button className="w-full" variant="secondary" onClick={() => openBidModal(item)}>
                                                Place Bid
                                            </Button>
                                        </div>
                                    )}
                                    {item.saleType === 'dutch' && (
                                        <div className="w-full">
                                            <div className="text-xs text-center mb-1 text-gray-500">
                                                Dutch Auction Active
                                            </div>
                                            <Button className="w-full" variant="outline">
                                                View Auction
                                            </Button>
                                        </div>
                                    )}
                                    {item.saleType === 'none' && (
                                        <Button className="w-full" variant="ghost" disabled>
                                            Not Listed
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </PokemonCard>
                </div>
            ))}

            <BuyModal
                item={selectedBuyItem}
                isOpen={isBuyModalOpen}
                onClose={() => setIsBuyModalOpen(false)}
            />

            <BidModal
                item={selectedBidItem}
                isOpen={isBidModalOpen}
                onClose={() => setIsBidModalOpen(false)}
            />

            <CreateListingModal
                item={selectedListItem}
                isOpen={isListModalOpen}
                onClose={() => setIsListModalOpen(false)}
            />
        </div>
    );
}

function GridItem({ item, renderAction, openBuyModal, openBidModal, openListModal }: any) {
    const { account } = useWeb3();
    const isOwner = account && item.owner && account.toLowerCase() === item.owner.toLowerCase();

    return (
        <div>
            <PokemonCard
                pokemon={item.pokemon}
                imageUri={item.imageUri}
            >
                <div className="w-full flex-col flex gap-2">
                    {renderAction ? renderAction(item) : (
                        <>
                            {item.saleType === 'fixed' && (
                                <Button className="w-full" onClick={() => openBuyModal(item)}>
                                    Buy for {item.listing ? formatEther(item.listing.price) : '0'} ETH
                                </Button>
                            )}
                            {item.saleType === 'auction' && (
                                <div className="w-full">
                                    <div className="text-xs text-center mb-1 text-gray-500">
                                        Current Bid: {item.auction ? formatEther(item.auction.highestBid) : '0'} ETH
                                    </div>
                                    <Button className="w-full" variant="secondary" onClick={() => openBidModal(item)}>
                                        Place Bid
                                    </Button>
                                </div>
                            )}
                            {item.saleType === 'dutch' && (
                                <div className="w-full">
                                    <div className="text-xs text-center mb-1 text-gray-500">
                                        Dutch Auction Active
                                    </div>
                                    <Button className="w-full" variant="outline">
                                        View Auction
                                    </Button>
                                </div>
                            )}
                            {item.saleType === 'none' && (
                                isOwner ? (
                                    <Button className="w-full" onClick={() => openListModal(item)}>
                                        List Item
                                    </Button>
                                ) : (
                                    <Button className="w-full" variant="ghost" disabled>
                                        Not Listed
                                    </Button>
                                )
                            )}
                        </>
                    )}
                </div>
            </PokemonCard>
        </div>
    );
}
