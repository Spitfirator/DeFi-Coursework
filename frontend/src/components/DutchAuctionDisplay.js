import React, { useState, useEffect } from 'react';
import { TrendingDown, Clock, DollarSign, ShoppingCart } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

function DutchAuctionDisplay({ auction, tokenId, tradingContract, onPurchase }) {
    const [currentPrice, setCurrentPrice] = useState('0');
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isPurchasing, setIsPurchasing] = useState(false);

    useEffect(() => {
        if (!auction || !auction.isActive || !tradingContract) return;

        const updatePrice = async () => {
            try {
                const price = await tradingContract.getCurrentDutchPrice(tokenId);
                setCurrentPrice(ethers.formatEther(price));

                const remaining = await tradingContract.getDutchAuctionTimeRemaining(tokenId);
                setTimeRemaining(Number(remaining));
            } catch (error) {
                console.error('Error fetching Dutch auction price:', error);
            }
        };

        updatePrice();
        const interval = setInterval(updatePrice, 1000); // Update every second

        return () => clearInterval(interval);
    }, [auction, tokenId, tradingContract]);

    const formatTime = (seconds) => {
        if (seconds <= 0) return 'Ended';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    const handleBuy = async () => {
        try {
            setIsPurchasing(true);
            const price = await tradingContract.getCurrentDutchPrice(tokenId);

            toast.loading('Purchasing NFT...');
            const tx = await tradingContract.buyDutchAuction(tokenId, {
                value: price
            });
            await tx.wait();

            toast.dismiss();
            toast.success('NFT purchased successfully!');
            if (onPurchase) onPurchase();
        } catch (error) {
            toast.dismiss();
            console.error('Failed to purchase:', error);
            toast.error(error.reason || 'Failed to purchase NFT');
        } finally {
            setIsPurchasing(false);
        }
    };

    if (!auction || !auction.isActive) return null;

    const startingPrice = auction.startingPrice;
    const reservePrice = auction.reservePrice;
    const priceRange = parseFloat(startingPrice) - parseFloat(reservePrice);
    const currentPriceNum = parseFloat(currentPrice);
    const progress = ((parseFloat(startingPrice) - currentPriceNum) / priceRange) * 100;

    return (
        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-bold text-white">Dutch Auction</h3>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">{formatTime(timeRemaining)}</span>
                </div>
            </div>

            {/* Current Price - Large and prominent */}
            <div className="text-center py-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <p className="text-sm text-gray-400 mb-1">Current Price</p>
                <p className="text-4xl font-bold text-purple-400">{parseFloat(currentPrice).toFixed(4)} ETH</p>
                <p className="text-xs text-gray-500 mt-1">Updates every second</p>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Starting</span>
                    <span className="text-white font-medium">{parseFloat(startingPrice).toFixed(4)} ETH</span>
                </div>
                <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Reserve</span>
                    <span className="text-white font-medium">{parseFloat(reservePrice).toFixed(4)} ETH</span>
                </div>
            </div>

            {/* Seller Info */}
            <div className="pt-4 border-t border-purple-500/20">
                <p className="text-xs text-gray-400 mb-1">Seller</p>
                <p className="text-sm text-white font-mono">
                    {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                </p>
            </div>

            {/* Buy Button */}
            <button
                onClick={handleBuy}
                disabled={isPurchasing || timeRemaining <= 0}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
            >
                <ShoppingCart className="w-5 h-5" />
                {isPurchasing ? 'Purchasing...' : timeRemaining <= 0 ? 'Auction Ended' : 'Buy Now'}
            </button>

            {timeRemaining <= 0 && (
                <p className="text-center text-sm text-gray-400">
                    This auction has ended at the reserve price
                </p>
            )}
        </div>
    );
}

export default DutchAuctionDisplay;
