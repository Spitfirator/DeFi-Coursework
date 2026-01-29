'use client';

import React, { useState, useEffect } from 'react';
import { MarketplaceItem } from '../../types/app-types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useMarketplaceActions } from '../../hooks/useMarketplaceActions';
import { useWeb3 } from '../../context/Web3Context';
import { formatEther, parseEther } from 'ethers';
import { useQueryClient } from '@tanstack/react-query';
import { resolveIPFS } from '../../lib/utils';

interface BuyModalProps {
    item: MarketplaceItem | null;
    isOpen: boolean;
    onClose: () => void;
}

export function BuyModal({ item, isOpen, onClose }: BuyModalProps) {
    const { buyFixedPrice, isPending, error, clearError } = useMarketplaceActions();
    const { nftContract, marketplaceContract } = useWeb3();
    const queryClient = useQueryClient();
    const [estimatedGas, setEstimatedGas] = useState<string>('');
    const [isEstimating, setIsEstimating] = useState(false);

    // Clear error when modal opens
    useEffect(() => {
        if (isOpen) {
            clearError();
            setEstimatedGas('');
        }
    }, [isOpen, clearError]);

    // Estimate gas when modal opens
    useEffect(() => {
        const estimateGasFee = async () => {
            if (!marketplaceContract || !nftContract || !item?.listing) return;

            try {
                setIsEstimating(true);
                const nftAddress = await nftContract.getAddress();
                const tokenId = BigInt(item.pokemon.tokenId);
                const price = item.listing.price;

                // Estimate gas for the transaction
                const gasEstimate = await marketplaceContract.buyFixedPrice.estimateGas(
                    nftAddress,
                    tokenId,
                    { value: price }
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

        if (isOpen && item) {
            estimateGasFee();
        }
    }, [isOpen, marketplaceContract, nftContract, item]);

    if (!item || !item.listing) return null;

    const handleBuy = async () => {
        if (!nftContract) return;

        const nftAddress = await nftContract.getAddress();
        const success = await buyFixedPrice(nftAddress, BigInt(item.pokemon.tokenId), item.listing.price);

        if (success) {
            // Auto-refresh marketplace data
            queryClient.invalidateQueries({ queryKey: ['marketplace'] });
            setEstimatedGas('');
            onClose();
        }
    };

    const priceEth = formatEther(item.listing.price);
    const imageUrl = resolveIPFS(item.imageUri);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm Purchase">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="relative h-20 w-20 rounded-md overflow-hidden bg-white">
                        <img
                            src={imageUrl}
                            alt={item.pokemon.name}
                            className="object-contain w-full h-full"
                        />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">{item.pokemon.name}</h3>
                        <p className="text-sm text-gray-500">ID: #{item.pokemon.tokenId.toString()}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Price</span>
                        <span className="font-bold text-xl">{priceEth} ETH</span>
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
                            <div className="flex justify-between items-center text-sm mt-1 pt-2 border-t border-blue-200 dark:border-blue-800">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Total Cost:</span>
                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                    {estimatedGas
                                        ? `${(parseFloat(priceEth) + parseFloat(estimatedGas)).toFixed(6)} ETH`
                                        : '---'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md break-words">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleBuy} isLoading={isPending}>
                        {isPending ? 'Processing...' : 'Confirm Purchase'}
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
