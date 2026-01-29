'use client';

import React, { useState, useEffect } from 'react';
import { MarketplaceItem } from '../../types/app-types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useMarketplaceActions } from '../../hooks/useMarketplaceActions';
import { resolveIPFS } from '../../lib/utils';
import { formatEther, parseEther } from 'ethers';
import { useQueryClient } from '@tanstack/react-query';
import { useWeb3 } from '../../context/Web3Context';

interface BidModalProps {
    item: MarketplaceItem | null;
    isOpen: boolean;
    onClose: () => void;
}

export function BidModal({ item, isOpen, onClose }: BidModalProps) {
    const { placeBid, isPending, error, clearError } = useMarketplaceActions();
    const { nftContract, marketplaceContract } = useWeb3();
    const queryClient = useQueryClient();
    const [bidAmount, setBidAmount] = useState('');
    const [estimatedGas, setEstimatedGas] = useState<string>('');
    const [isEstimating, setIsEstimating] = useState(false);

    // Clear error when modal opens
    useEffect(() => {
        if (isOpen) {
            clearError();
            setBidAmount('');
            setEstimatedGas('');
        }
    }, [isOpen, clearError]);

    // Estimate gas when bid amount changes
    useEffect(() => {
        const estimateGasFee = async () => {
            if (!marketplaceContract || !nftContract || !bidAmount || !item) return;

            try {
                setIsEstimating(true);
                const nftAddress = await nftContract.getAddress();
                const tokenId = BigInt(item.pokemon.tokenId);
                const value = parseEther(bidAmount);

                // Estimate gas for the transaction
                const gasEstimate = await marketplaceContract.bid.estimateGas(
                    nftAddress,
                    tokenId,
                    { value }
                );

                // Get gas price
                const provider = marketplaceContract.runner?.provider;
                if (provider) {
                    const feeData = await provider.getFeeData();
                    const gasPrice = feeData.gasPrice || 0n;
                    const gasCost = gasEstimate * gasPrice;
                    setEstimatedGas(formatEther(gasCost));
                }
            } catch (error) {
                console.error('Gas estimation failed:', error);
                setEstimatedGas('');
            } finally {
                setIsEstimating(false);
            }
        };

        const debounce = setTimeout(estimateGasFee, 500);
        return () => clearTimeout(debounce);
    }, [bidAmount, marketplaceContract, nftContract, item]);

    if (!item || !item.auction) return null;

    const handleBid = async () => {
        if (!nftContract || !bidAmount) return;

        const nftAddress = await nftContract.getAddress();
        const tokenId = BigInt(item.pokemon.tokenId);

        const success = await placeBid(nftAddress, tokenId, bidAmount);
        if (success) {
            // Auto-refresh marketplace data
            queryClient.invalidateQueries({ queryKey: ['marketplace'] });
            setBidAmount('');
            setEstimatedGas('');
            onClose();
        }
    };

    const imageUrl = resolveIPFS(item.imageUri);
    const highestBid = formatEther(item.auction.highestBid);
    const startPrice = formatEther(item.auction.startingPrice);
    const minBid = item.auction.highestBid > 0n ? item.auction.highestBid : item.auction.startingPrice;
    const minBidEth = formatEther(minBid);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Place a Bid">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="relative h-16 w-16 rounded-md overflow-hidden bg-white">
                        <img
                            src={imageUrl}
                            alt={item.pokemon.name}
                            className="object-contain w-full h-full"
                        />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">{item.pokemon.name}</h3>
                        <p className="text-sm text-gray-500">
                            Current Highest Bid: <span className="font-bold text-gray-900 dark:text-gray-100">{highestBid} ETH</span>
                        </p>
                        <p className="text-xs text-gray-400">Starting Price: {startPrice} ETH</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Your Bid (ETH)</label>
                    <Input
                        placeholder={`Minimum: ${minBidEth} ETH`}
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        step="0.001"
                        min={minBidEth}
                    />
                    <p className="text-xs text-gray-500">
                        Bid must be higher than {minBidEth} ETH
                    </p>
                </div>

                {/* Gas Fee Estimate */}
                {estimatedGas && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Estimated Gas Fee:</span>
                            <span className="font-mono font-semibold">
                                {isEstimating ? '...' : `~${parseFloat(estimatedGas).toFixed(6)} ETH`}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                {bidAmount && estimatedGas
                                    ? `${(parseFloat(bidAmount) + parseFloat(estimatedGas)).toFixed(6)} ETH`
                                    : '---'}
                            </span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md break-words">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={handleBid}
                        isLoading={isPending}
                        disabled={!bidAmount || parseFloat(bidAmount) <= parseFloat(minBidEth)}
                    >
                        {isPending ? 'Placing Bid...' : 'Place Bid'}
                    </Button>
                </div>

                {isPending && (
                    <p className="text-xs text-center text-gray-500">
                        ⏳ Waiting for MetaMask confirmation... Do not close this window.
                    </p>
                )}
            </div>
        </Modal>
    );
}
