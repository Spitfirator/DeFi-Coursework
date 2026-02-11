import React, { useState, useEffect } from 'react';
import { X, TrendingDown, Clock, DollarSign } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

function DutchAuctionModal({ isOpen, onClose, nft, tradingContract, pokemonContract, onSuccess }) {
    const [startingPrice, setStartingPrice] = useState('');
    const [reservePrice, setReservePrice] = useState('');
    const [duration, setDuration] = useState('24'); // hours
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (!startingPrice || !reservePrice || !duration) {
            toast.error('Please fill in all fields');
            return;
        }

        const startPriceNum = parseFloat(startingPrice);
        const reservePriceNum = parseFloat(reservePrice);

        if (reservePriceNum >= startPriceNum) {
            toast.error('Reserve price must be less than starting price');
            return;
        }

        try {
            setIsProcessing(true);
            const startPriceWei = ethers.parseEther(startingPrice);
            const reservePriceWei = ethers.parseEther(reservePrice);
            const durationSeconds = parseInt(duration) * 3600; // Convert hours to seconds

            console.log('Creating Dutch Auction with params:', {
                tokenId: nft.tokenId,
                startPrice: startPriceWei.toString(),
                reservePrice: reservePriceWei.toString(),
                duration: durationSeconds
            });
            console.log('Contract address:', tradingContract.target);

            console.log('Contract address:', tradingContract.target);

            // Check for expired Dutch Auction (Auto-Reclaim Logic)
            if (nft.dutchAuction && nft.dutchAuction.isExpired) {
                console.log('Finalizing expired Dutch auction...');
                toast.loading('Claiming back NFT from expired auction...');
                try {
                    const reclaimTx = await tradingContract.finalizeDutchAuction(nft.tokenId);
                    await reclaimTx.wait();
                    toast.dismiss();
                    toast.success('NFT claimed successfully! Proceeding to create new auction...');
                } catch (err) {
                    console.error('Failed to reclaim:', err);
                    toast.dismiss();
                    toast.error('Failed to claim NFT. Please try again.');
                    setIsProcessing(false);
                    return;
                }
            }

            // Check for approval
            const approvedAddress = await pokemonContract.getApproved(nft.tokenId);
            const ownerAddress = await pokemonContract.ownerOf(nft.tokenId);
            const isApprovedForAll = await pokemonContract.isApprovedForAll(ownerAddress, tradingContract.target);

            console.log('Approval Status:', {
                approvedAddress,
                tradingContractAddress: tradingContract.target,
                isApprovedForAll
            });

            if (approvedAddress.toLowerCase() !== tradingContract.target.toLowerCase() && !isApprovedForAll) {
                console.log('Approving...');
                toast.loading('Approving contract to transfer NFT...');
                const approveTx = await pokemonContract.approve(tradingContract.target, nft.tokenId);
                await approveTx.wait();
                console.log('Approved!');
                toast.dismiss();
                toast.success('Approval successful!');
            }

            console.log('Sending transaction...');
            toast.loading('Creating Dutch auction...');
            const tx = await tradingContract.createDutchAuction(
                nft.tokenId,
                startPriceWei,
                reservePriceWei,
                durationSeconds
            );
            console.log('Transaction sent:', tx.hash);
            await tx.wait();
            console.log('Transaction confirmed');

            toast.dismiss();
            toast.success('Dutch auction created successfully!');
            onClose();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.dismiss();
            console.error('Failed to create Dutch auction:', error);
            // Log full error details
            if (error.transaction) console.error('Transaction:', error.transaction);
            if (error.data) console.error('Revert data:', error.data);
            if (error.reason) console.error('Revert reason:', error.reason);

            toast.error(error.reason || 'Failed to create Dutch auction. Check console for details.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-purple-500/20 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <TrendingDown className="w-6 h-6 text-purple-400" />
                        <h2 className="text-2xl font-bold text-white">Dutch Auction</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {nft && (
                    <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-purple-500/20">
                        <p className="text-sm text-gray-400 mb-1">Creating auction for:</p>
                        <p className="text-lg font-bold text-white">{nft.name}</p>
                        <p className="text-sm text-gray-400">#{nft.tokenId}</p>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            <DollarSign className="w-4 h-4 inline mr-1" />
                            Starting Price (ETH)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={startingPrice}
                            onChange={(e) => setStartingPrice(e.target.value)}
                            placeholder="e.g., 5.0"
                            className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <p className="text-xs text-gray-400 mt-1">Initial high price</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            <DollarSign className="w-4 h-4 inline mr-1" />
                            Reserve Price (ETH)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={reservePrice}
                            onChange={(e) => setReservePrice(e.target.value)}
                            placeholder="e.g., 1.0"
                            className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <p className="text-xs text-gray-400 mt-1">Minimum acceptable price</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Duration (hours)
                        </label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        >
                            <option value="1">1 hour</option>
                            <option value="6">6 hours</option>
                            <option value="12">12 hours</option>
                            <option value="24">24 hours</option>
                            <option value="48">48 hours</option>
                            <option value="72">72 hours</option>
                            <option value="168">7 days</option>
                        </select>
                    </div>

                    {startingPrice && reservePrice && (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                            <p className="text-sm text-gray-300 mb-2">
                                <TrendingDown className="w-4 h-4 inline mr-1 text-purple-400" />
                                Price will decrease from
                            </p>
                            <p className="text-lg font-bold text-purple-400">
                                {startingPrice} ETH → {reservePrice} ETH
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                over {duration} hour{duration !== '1' ? 's' : ''}
                            </p>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleCreate}
                    disabled={isProcessing || !startingPrice || !reservePrice}
                    className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-purple-500/50"
                >
                    {isProcessing ? 'Creating...' : 'Create Dutch Auction'}
                </button>
            </div>
        </div>
    );
}

export default DutchAuctionModal;
