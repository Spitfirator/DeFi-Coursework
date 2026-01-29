'use client';

import { useEffect, useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { formatEther, EventLog } from 'ethers';

interface ActivityEvent {
    type: 'minted' | 'listed' | 'bid' | 'sold' | 'transferred' | 'cancelled';
    timestamp: number;
    from?: string;
    to?: string;
    price?: bigint;
    txHash: string;
    blockNumber: number;
}

interface ActivityTimelineProps {
    nftAddress: string;
    tokenId: string;
}

export function ActivityTimeline({ nftAddress, tokenId }: ActivityTimelineProps) {
    const { marketplaceContract, nftContract } = useWeb3();
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            if (!marketplaceContract || !nftContract) return;

            try {
                setIsLoading(true);
                const allEvents: ActivityEvent[] = [];

                // Fetch ItemListed events
                const listedFilter = marketplaceContract.filters.ItemListed(nftAddress, BigInt(tokenId));
                const listedEvents = await marketplaceContract.queryFilter(listedFilter);

                for (const event of listedEvents) {
                    if (event instanceof EventLog) {
                        const block = await event.getBlock();
                        allEvents.push({
                            type: 'listed',
                            timestamp: block.timestamp,
                            from: event.args[0], // seller
                            price: event.args[3], // price is 4th arg (index 3)
                            txHash: event.transactionHash,
                            blockNumber: event.blockNumber
                        });
                    }
                }

                // Fetch ItemSold events
                const soldFilter = marketplaceContract.filters.ItemSold(nftAddress, BigInt(tokenId));
                const soldEvents = await marketplaceContract.queryFilter(soldFilter);

                for (const event of soldEvents) {
                    if (event instanceof EventLog) {
                        const block = await event.getBlock();
                        allEvents.push({
                            type: 'sold',
                            timestamp: block.timestamp,
                            from: event.args[0], // seller
                            to: event.args[1],   // buyer
                            price: event.args[4], // price
                            txHash: event.transactionHash,
                            blockNumber: event.blockNumber
                        });
                    }
                }

                // Fetch BidPlaced events (actually NewBid)
                const bidFilter = marketplaceContract.filters.NewBid(nftAddress, BigInt(tokenId));
                const bidEvents = await marketplaceContract.queryFilter(bidFilter);

                for (const event of bidEvents) {
                    if (event instanceof EventLog) {
                        const block = await event.getBlock();
                        allEvents.push({
                            type: 'bid',
                            timestamp: block.timestamp,
                            from: event.args[2], // bidder (index 2)
                            price: event.args[3], // amount (index 3)
                            txHash: event.transactionHash,
                            blockNumber: event.blockNumber
                        });
                    }
                }

                // Fetch Transfer events from NFT contract
                const transferFilter = nftContract.filters.Transfer(null, null, BigInt(tokenId));
                const transferEvents = await nftContract.queryFilter(transferFilter);

                for (const event of transferEvents) {
                    if (event instanceof EventLog) {
                        const block = await event.getBlock();
                        const from = event.args[0];
                        const to = event.args[1];

                        // First transfer is minting
                        if (from === '0x0000000000000000000000000000000000000000') {
                            allEvents.push({
                                type: 'minted',
                                timestamp: block.timestamp,
                                to: to,
                                txHash: event.transactionHash,
                                blockNumber: event.blockNumber
                            });
                        } else {
                            allEvents.push({
                                type: 'transferred',
                                timestamp: block.timestamp,
                                from: from,
                                to: to,
                                txHash: event.transactionHash,
                                blockNumber: event.blockNumber
                            });
                        }
                    }
                }

                // Sort by timestamp (newest first)
                allEvents.sort((a, b) => b.timestamp - a.timestamp);
                setEvents(allEvents);
            } catch (error) {
                console.error('Error fetching activity:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvents();
    }, [marketplaceContract, nftContract, nftAddress, tokenId]);

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'minted': return '🎨';
            case 'listed': return '📝';
            case 'bid': return '💰';
            case 'sold': return '✅';
            case 'transferred': return '🔄';
            case 'cancelled': return '❌';
            default: return '•';
        }
    };

    const getEventColor = (type: string) => {
        switch (type) {
            case 'minted': return 'text-green-600 dark:text-green-400';
            case 'listed': return 'text-blue-600 dark:text-blue-400';
            case 'bid': return 'text-yellow-600 dark:text-yellow-400';
            case 'sold': return 'text-purple-600 dark:text-purple-400';
            case 'transferred': return 'text-gray-600 dark:text-gray-400';
            case 'cancelled': return 'text-red-600 dark:text-red-400';
            default: return 'text-gray-600 dark:text-gray-400';
        }
    };

    const formatAddress = (address: string | any) => {
        if (!address || typeof address !== 'string') return '0x...';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    if (isLoading) {
        return (
            <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm">Loading activity...</p>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p>No activity yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {events.map((event, index) => (
                <div key={`${event.txHash}-${index}`} className="flex gap-4 items-start">
                    <div className={`text-2xl ${getEventColor(event.type)}`}>
                        {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold ${getEventColor(event.type)} capitalize`}>
                                {event.type}
                            </span>
                            {event.price && (
                                <span className="text-sm font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                    {formatEther(event.price)} ETH
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {event.from && (
                                <span>from <span className="font-mono">{formatAddress(event.from)}</span></span>
                            )}
                            {event.to && (
                                <span> to <span className="font-mono">{formatAddress(event.to)}</span></span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {formatTimestamp(event.timestamp)}
                        </div>
                    </div>
                    <a
                        href={`https://etherscan.io/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
            ))}
        </div>
    );
}
