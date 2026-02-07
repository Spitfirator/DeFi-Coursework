'use client';

import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useMarketplaceData } from '@/hooks/useMarketplaceData';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/Button';
import { useState, useEffect } from 'react';
import { formatEther } from 'ethers';
import Link from 'next/link';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { BidModal } from '@/components/modals/BidModal';
import { BuyModal } from '@/components/modals/BuyModal';
import { useQueryClient } from '@tanstack/react-query';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { POKEMON_NFT_ADDRESS } from '@/contracts/addresses';
import { CreateListingModal } from '@/components/modals/CreateListingModal';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, Check } from 'lucide-react';

export default function NFTDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tokenId = params.id as string;
    const { data: items, isLoading } = useMarketplaceData();
    const { account, nftContract } = useWeb3();
    const { addToCart, removeFromCart, isInCart } = useCart();

    const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
    const [isBidModalOpen, setIsBidModalOpen] = useState(false);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [isListModalOpen, setIsListModalOpen] = useState(false);
    const [currentPrice, setCurrentPrice] = useState(0n);
    const queryClient = useQueryClient();
    const { cancelListing, cancelAuction, cancelDutchAuction, endAuction, isPending: isCancelling } = useMarketplaceActions();

    // Calculate Dutch Auction Price
    useEffect(() => {
        const item = items?.find(i => i.pokemon.tokenId.toString() === tokenId);
        if (!item || item.saleType !== 'dutch' || !item.dutchAuction) return;

        const updatePrice = () => {
            const startPrice = item.dutchAuction!.startPrice;
            const endPrice = item.dutchAuction!.endPrice;
            const startTime = item.dutchAuction!.startTime;
            const duration = item.dutchAuction!.duration;
            const now = BigInt(Math.floor(Date.now() / 1000));

            const elapsed = now - startTime;
            if (elapsed < 0n) {
                setCurrentPrice(startPrice);
                return;
            }
            if (elapsed >= duration) {
                setCurrentPrice(endPrice);
                return;
            }

            const priceDiff = startPrice - endPrice;
            const drop = (priceDiff * elapsed) / duration;
            setCurrentPrice(startPrice - drop);
        };

        updatePrice();
        const interval = setInterval(updatePrice, 1000);
        return () => clearInterval(interval);
    }, [items, tokenId]);

    const handleCancelListing = async () => {
        if (!nftContract || !nft) return;

        let success = false;
        const address = nftContract.target.toString();
        const tokenIDBigInt = BigInt(tokenId);

        if (nft.saleType === 'fixed') {
            success = await cancelListing(address, tokenIDBigInt);
        } else if (nft.saleType === 'auction') {
            if (nft.auction && nft.auction.highestBid > 0n) {
                const isEnded = nft.auction.endTime <= BigInt(Math.floor(Date.now() / 1000));
                if (isEnded) {
                    success = await endAuction(address, tokenIDBigInt);
                } else {
                    alert('Cannot cancel auction with active bids!');
                    return;
                }
            } else {
                success = await cancelAuction(address, tokenIDBigInt);
            }
        } else if (nft.saleType === 'dutch') {
            success = await cancelDutchAuction(address, tokenIDBigInt);
        }

        if (success) {
            queryClient.invalidateQueries({ queryKey: ['marketplace'] });
            alert('Transaction Successful');
            router.refresh();
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
                <Navbar />
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center py-20">Loading...</div>
                </div>
            </main>
        );
    }

    const nft = items?.find(item => item.pokemon.tokenId.toString() === tokenId);

    if (!nft) {
        return (
            <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
                <Navbar />
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold mb-4">NFT Not Found</h2>
                        <Link href="/marketplace">
                            <Button>Back to Marketplace</Button>
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const getRarityLabel = (rarity: number) => {
        switch (rarity) {
            case 5: return 'Legendary';
            case 4: return 'Rare';
            default: return 'Common';
        }
    };

    const getRarityColor = (rarity: number) => {
        switch (rarity) {
            case 5: return 'text-yellow-500';
            case 4: return 'text-purple-500';
            default: return 'text-gray-500';
        }
    };

    // Calculate floor price
    const floorPrice = items
        ?.filter(i => i.saleType === 'fixed')
        .reduce((min, item) => {
            const price = Number(formatEther(item.listing?.price || 0n));
            return price > 0 && price < min ? price : min;
        }, Infinity) ?? Infinity;

    const isOwner = account?.toLowerCase() === nft.owner.toLowerCase();

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Navbar />

            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Image */}
                    <div className="space-y-4">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-8">
                            <img
                                src={nft.imageUri}
                                alt={nft.pokemon.name}
                                className="w-full h-full object-contain"
                            />
                        </div>

                        {/* Contract Details */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 space-y-3">
                            <h3 className="font-semibold text-lg mb-4">Contract Details</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Contract Address</span>
                                    <a
                                        href={`https://etherscan.io/address/${process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '0x00...00'}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-blue-600 hover:underline"
                                    >
                                        {(process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '0x00...00').slice(0, 6)}...{(process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '0x00...00').slice(-4)}
                                    </a>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Token ID</span>
                                    <span className="font-mono">#{tokenId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Token Standard</span>
                                    <span>ERC721A</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Blockchain</span>
                                    <span>{process.env.NEXT_PUBLIC_NETWORK_NAME || 'Hardhat Local'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Details */}
                    <div className="space-y-6">
                        {/* Header */}
                        <div>
                            <h1 className="text-4xl font-bold mb-2">{nft.pokemon.name}</h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Owned by <span className="font-mono">{nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}</span>
                            </p>
                            <div className="flex gap-2 mt-3 text-sm">
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                    ERC721A
                                </span>
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded">
                                    TOKEN #{tokenId}
                                </span>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-xs text-gray-500 mb-1">FLOOR PRICE</div>
                                <div className="text-lg font-bold truncate" title={floorPrice !== Infinity ? `${floorPrice} ETH` : 'N/A'}>
                                    {floorPrice !== Infinity ? `${floorPrice.toFixed(3)} ETH` : 'N/A'}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-xs text-gray-500 mb-1">RARITY</div>
                                <div className={`text-lg font-bold ${getRarityColor(nft.pokemon.rarity)}`}>
                                    {getRarityLabel(nft.pokemon.rarity)}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-xs text-gray-500 mb-1">LEVEL</div>
                                <div className="text-lg font-bold">{nft.pokemon.level}</div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-xs text-gray-500 mb-1">TYPE</div>
                                <div className="text-base font-bold break-words leading-tight">{nft.pokemon.ptype}</div>
                            </div>
                        </div>

                        {/* Action Panel */}
                        {(nft.saleType === 'fixed' || nft.saleType === 'auction' || nft.saleType === 'dutch') && (
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-6">
                                <div className="mb-4">
                                    <div className="text-sm text-gray-500 mb-1">
                                        {nft.saleType === 'fixed'
                                            ? 'BUY FOR'
                                            : nft.saleType === 'dutch'
                                                ? 'CURRENT PRICE (Dropping)'
                                                : (nft.saleType === 'auction' && BigInt(nft.auction?.highestBid || 0) > 0n)
                                                    ? 'CURRENT BID'
                                                    : 'STARTING PRICE'}
                                    </div>
                                    <div className="text-3xl font-bold">
                                        {nft.saleType === 'fixed' && nft.listing
                                            ? `${formatEther(nft.listing.price)} ETH`
                                            : nft.saleType === 'dutch' && nft.dutchAuction
                                                ? `${formatEther(currentPrice)} ETH`
                                                : nft.saleType === 'auction' && nft.auction
                                                    ? `${formatEther(nft.auction.highestBid || nft.auction.startingPrice)} ETH`
                                                    : 'N/A'}
                                    </div>
                                    {/* Timer for Auction / Dutch */}
                                    {(nft.saleType === 'auction' && nft.auction) && (
                                        <div className="mt-2">
                                            <div className="text-xs text-gray-500 mb-1">TIME LEFT</div>
                                            <CountdownTimer targetDate={Number(nft.auction.endTime) * 1000} />
                                        </div>
                                    )}
                                    {(nft.saleType === 'dutch' && nft.dutchAuction) && (
                                        <div className="mt-2">
                                            <div className="text-xs text-gray-500 mb-1">TIME LEFT</div>
                                            <CountdownTimer targetDate={Number(nft.dutchAuction.startTime + nft.dutchAuction.duration) * 1000} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    {!isOwner && (
                                        <>
                                            {nft.saleType === 'fixed' && (
                                                <div className="flex gap-2 flex-1">
                                                    <Button
                                                        className="flex-1"
                                                        size="lg"
                                                        onClick={() => setIsBuyModalOpen(true)}
                                                    >
                                                        Buy Now
                                                    </Button>
                                                    <Button
                                                        variant={isInCart(tokenId) ? "secondary" : "outline"}
                                                        size="icon"
                                                        className="h-12 w-12"
                                                        onClick={() => isInCart(tokenId) ? removeFromCart(tokenId) : addToCart(nft)}
                                                        title={isInCart(tokenId) ? "Remove from Cart" : "Add to Cart"}
                                                    >
                                                        {isInCart(tokenId) ? <Check className="h-6 w-6 text-green-500" /> : <ShoppingCart className="h-6 w-6" />}
                                                    </Button>
                                                </div>
                                            )}
                                            {nft.saleType === 'dutch' && (
                                                <Button
                                                    className="flex-1"
                                                    size="lg"
                                                    onClick={() => setIsBuyModalOpen(true)}
                                                >
                                                    Buy Now
                                                </Button>
                                            )}
                                            {nft.saleType === 'auction' && (
                                                <Button
                                                    className="flex-1"
                                                    size="lg"
                                                    onClick={() => setIsBidModalOpen(true)}
                                                >
                                                    Place Bid
                                                </Button>
                                            )}
                                        </>
                                    )}
                                    {isOwner && (nft.saleType === 'fixed' || nft.saleType === 'auction' || nft.saleType === 'dutch') && (
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            size="lg"
                                            onClick={handleCancelListing}
                                            disabled={isCancelling || (nft.saleType === 'auction' && nft.auction?.active && nft.auction.highestBid > 0n && BigInt(Math.floor(Date.now() / 1000)) < nft.auction.endTime)}
                                        >
                                            {isCancelling ? 'Processing...' :
                                                nft.saleType === 'auction' && nft.auction?.endTime && BigInt(Math.floor(Date.now() / 1000)) >= nft.auction.endTime
                                                    ? 'End Auction'
                                                    : nft.saleType === 'auction' && nft.auction?.active && nft.auction.highestBid > 0n
                                                        ? 'Auction Active (Cannot Cancel)'
                                                        : 'Cancel Listing'
                                            }
                                        </Button>
                                    )}
                                </div>
                            </div>

                        )}

                        {/* Owner List Button if Not Listed */}
                        {isOwner && (!nft.saleType || nft.saleType === 'none') && (
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-6">
                                <div className="text-sm text-gray-500 mb-4">You own this Pokemon</div>
                                <Button className="w-full" size="lg" onClick={() => setIsListModalOpen(true)}>
                                    List for Sale
                                </Button>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden">
                            <div className="flex border-b border-gray-200 dark:border-gray-700">
                                <button
                                    className={`flex-1 px-6 py-4 font-medium ${activeTab === 'details'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-500'
                                        }`}
                                    onClick={() => setActiveTab('details')}
                                >
                                    Details
                                </button>
                                <button
                                    className={`flex-1 px-6 py-4 font-medium ${activeTab === 'activity'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-500'
                                        }`}
                                    onClick={() => setActiveTab('activity')}
                                >
                                    Activity
                                </button>
                            </div>

                            <div className="p-6">
                                {activeTab === 'details' && (
                                    <div className="space-y-6">
                                        {/* Traits */}
                                        <div>
                                            <h3 className="font-semibold mb-3">Traits</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-500 mb-1">TYPE</div>
                                                    <div className="font-semibold">{nft.pokemon.ptype}</div>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-500 mb-1">RARITY</div>
                                                    <div className={`font-semibold ${getRarityColor(nft.pokemon.rarity)}`}>
                                                        {getRarityLabel(nft.pokemon.rarity)}
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-500 mb-1">LEVEL</div>
                                                    <div className="font-semibold">{nft.pokemon.level}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'activity' && (
                                    <ActivityTimeline
                                        nftAddress={process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || ''}
                                        tokenId={tokenId}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <BidModal
                item={nft}
                isOpen={isBidModalOpen}
                onClose={() => {
                    setIsBidModalOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['marketplace'] });
                }}
            />

            <BuyModal
                item={nft}
                isOpen={isBuyModalOpen}
                currentPrice={currentPrice}
                onClose={() => {
                    setIsBuyModalOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['marketplace'] });
                }}
            />
            <CreateListingModal
                item={nft}
                isOpen={isListModalOpen}
                onClose={() => setIsListModalOpen(false)}
            />
        </main >
    );
}
