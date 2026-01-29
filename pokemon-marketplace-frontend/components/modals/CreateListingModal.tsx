'use client';

import React, { useState } from 'react';
import { MarketplaceItem } from '../../types/app-types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useMarketplaceActions } from '../../hooks/useMarketplaceActions';
import { useWeb3 } from '../../context/Web3Context';
import { useQueryClient } from '@tanstack/react-query';
import { resolveIPFS } from '../../lib/utils';
import { clsx } from 'clsx';

interface CreateListingModalProps {
    item: MarketplaceItem | null;
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'fixed' | 'auction' | 'dutch';

export function CreateListingModal({ item, isOpen, onClose }: CreateListingModalProps) {
    const { listFixedPrice, createAuction, createDutchAuction, isPending, error: actionError, clearError } = useMarketplaceActions();
    const { nftContract } = useWeb3();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<Tab>('fixed');

    // Clear error when switching tabs
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        clearError();
    };

    // Form State
    const [price, setPrice] = useState('');
    const [startPrice, setStartPrice] = useState('');
    const [endPrice, setEndPrice] = useState('');
    const [durationState, setDurationState] = useState({ days: '1', hours: '0', minutes: '0', seconds: '0' });

    const getTotalSeconds = () => {
        const d = parseInt(durationState.days) || 0;
        const h = parseInt(durationState.hours) || 0;
        const m = parseInt(durationState.minutes) || 0;
        const s = parseInt(durationState.seconds) || 0;
        return (d * 86400) + (h * 3600) + (m * 60) + s;
    };

    if (!item) return null;

    const handleSubmit = async () => {
        if (!nftContract) return;
        const nftAddress = await nftContract.getAddress();
        const tokenId = BigInt(item.pokemon.tokenId);
        let success = false;

        if (activeTab === 'fixed') {
            if (!price) return;
            success = await listFixedPrice(nftAddress, tokenId, price);
        } else if (activeTab === 'auction') {
            const totalSeconds = getTotalSeconds();
            if (totalSeconds < 60) {
                alert("Duration must be at least 1 minute (60 seconds).");
                return;
            }
            if (!startPrice) return;
            success = await createAuction(nftAddress, tokenId, startPrice, totalSeconds);
        } else if (activeTab === 'dutch') {
            const totalSeconds = getTotalSeconds();
            if (totalSeconds < 60) {
                alert("Duration must be at least 1 minute (60 seconds).");
                return;
            }
            if (!startPrice || !endPrice) return;
            if (parseFloat(startPrice) <= parseFloat(endPrice)) {
                alert("For Dutch Auction, Starting Price must be GREATER than Ending Price.");
                return;
            }
            success = await createDutchAuction(nftAddress, tokenId, startPrice, endPrice, totalSeconds);
        }

        if (success) {
            queryClient.invalidateQueries({ queryKey: ['marketplace'] });
            onClose();
        }
    };

    const imageUrl = resolveIPFS(item.imageUri);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`List ${item.pokemon.name} for Sale`}>
            <div className="flex flex-col gap-4">
                {/* Item Header */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="relative h-16 w-16 rounded-md overflow-hidden bg-white">
                        <img
                            src={imageUrl}
                            alt={item.pokemon.name}
                            className="object-contain w-full h-full"
                        />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">{item.pokemon.name} #{item.pokemon.tokenId.toString()}</h3>
                        <p className="text-xs text-gray-500">Lvl {item.pokemon.level} • {item.pokemon.ptype}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    {(['fixed', 'auction', 'dutch'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            className={clsx(
                                "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            )}
                            onClick={() => handleTabChange(tab)}
                        >
                            {tab === 'fixed' ? 'Fixed Price' : tab === 'auction' ? 'English Auction' : 'Dutch Auction'}
                        </button>
                    ))}
                </div>

                {/* Rarity Warning */}
                {item.pokemon.rarity === 5 && activeTab === 'fixed' && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            ⚠️ <strong>Legendary Pokemon</strong> cannot be listed for fixed price. Please use <strong>English Auction</strong> or <strong>Dutch Auction</strong>.
                        </p>
                    </div>
                )}

                {/* Form Content */}
                <div className="space-y-4 py-2">
                    {activeTab === 'fixed' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Price (ETH)</label>
                            <Input
                                placeholder="0.1"
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                        </div>
                    )}

                    {activeTab === 'auction' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Starting Price (ETH)</label>
                                <Input
                                    placeholder="0.05"
                                    type="number"
                                    value={startPrice}
                                    onChange={(e) => setStartPrice(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Duration</label>
                                <div className="grid grid-cols-4 gap-2">
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.days}
                                            onChange={(e) => setDurationState({ ...durationState, days: e.target.value })}
                                            placeholder="1"
                                        />
                                        <span className="text-xs text-gray-500">Days</span>
                                    </div>
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.hours}
                                            onChange={(e) => setDurationState({ ...durationState, hours: e.target.value })}
                                            placeholder="0"
                                        />
                                        <span className="text-xs text-gray-500">Hours</span>
                                    </div>
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.minutes}
                                            onChange={(e) => setDurationState({ ...durationState, minutes: e.target.value })}
                                            placeholder="0"
                                        />
                                        <span className="text-xs text-gray-500">Mins</span>
                                    </div>
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.seconds}
                                            onChange={(e) => setDurationState({ ...durationState, seconds: e.target.value })}
                                            placeholder="0"
                                        />
                                        <span className="text-xs text-gray-500">Secs</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'dutch' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Start Price (ETH)</label>
                                    <Input
                                        placeholder="1.0"
                                        type="number"
                                        value={startPrice}
                                        onChange={(e) => setStartPrice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">End Price (ETH)</label>
                                    <Input
                                        placeholder="0.1"
                                        type="number"
                                        value={endPrice}
                                        onChange={(e) => setEndPrice(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Duration</label>
                                <div className="grid grid-cols-4 gap-2">
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.days}
                                            onChange={(e) => setDurationState({ ...durationState, days: e.target.value })}
                                            placeholder="1"
                                        />
                                        <span className="text-xs text-gray-500">Days</span>
                                    </div>
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.hours}
                                            onChange={(e) => setDurationState({ ...durationState, hours: e.target.value })}
                                            placeholder="0"
                                        />
                                        <span className="text-xs text-gray-500">Hours</span>
                                    </div>
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.minutes}
                                            onChange={(e) => setDurationState({ ...durationState, minutes: e.target.value })}
                                            placeholder="0"
                                        />
                                        <span className="text-xs text-gray-500">Mins</span>
                                    </div>
                                    <div>
                                        <Input
                                            type="number"
                                            value={durationState.seconds}
                                            onChange={(e) => setDurationState({ ...durationState, seconds: e.target.value })}
                                            placeholder="0"
                                        />
                                        <span className="text-xs text-gray-500">Secs</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {actionError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md break-words">
                        <strong>Error:</strong> {actionError}
                        {actionError.includes('InvalidSaleTypeForRarity') && (
                            <p className="mt-2">
                                {activeTab === 'fixed'
                                    ? "Legendary Pokemon (rarity 5) can only be sold via English or Dutch Auction."
                                    : "Common/Uncommon Pokemon (rarity < 4) can only be sold via Fixed Price."}
                            </p>
                        )}
                        {actionError.includes('NotApprovedForMarketplace') && (
                            <p className="mt-2">Please approve the marketplace contract first.</p>
                        )}
                    </div>
                )}

                <div className="flex gap-3 mt-2">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleSubmit} isLoading={isPending}>
                        {isPending ? 'Processing...' : 'Create Listing'}
                    </Button>
                </div>
            </div>
        </Modal >
    );
}
