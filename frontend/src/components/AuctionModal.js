import React, { useState } from 'react';
import { X, Gavel, Loader } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

function AuctionModal({ isOpen, onClose, nft, tradingContract, pokemonContract, onSuccess }) {
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

        if (reservePriceNum < startPriceNum) {
            toast.error('Reserve price must be greater than or equal to starting price');
            return;
        }

        try {
            setIsProcessing(true);
            const startPriceWei = ethers.parseEther(startingPrice);
            const reservePriceWei = ethers.parseEther(reservePrice);
            const durationSeconds = parseInt(duration) * 3600;

            console.log('Creating Auction with params:', {
                tokenId: nft.tokenId,
                startPrice: startPriceWei.toString(),
                reservePrice: reservePriceWei.toString(),
                duration: durationSeconds
            });

            // Check for approval
            const approvedAddress = await pokemonContract.getApproved(nft.tokenId);
            const ownerAddress = await pokemonContract.ownerOf(nft.tokenId);
            const isApprovedForAll = await pokemonContract.isApprovedForAll(ownerAddress, tradingContract.target);

            if (approvedAddress.toLowerCase() !== tradingContract.target.toLowerCase() && !isApprovedForAll) {
                toast.loading('Approving contract...');
                const approveTx = await pokemonContract.approve(tradingContract.target, nft.tokenId);
                await approveTx.wait();
                toast.dismiss();
                toast.success('Approved!');
            }

            toast.loading('Creating auction...');
            // createAuction(uint256 tokenId, uint256 startingPrice, uint256 reservePrice, uint256 duration)
            const tx = await tradingContract.createAuction(
                nft.tokenId,
                startPriceWei,
                reservePriceWei,
                durationSeconds
            );
            await tx.wait();

            toast.dismiss();
            toast.success('Auction created successfully!');
            onClose();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.dismiss();
            console.error('Failed to create auction:', error);
            toast.error(error.reason || 'Failed to create auction');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-secondary/20 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-secondary/20 rounded-xl">
                        <Gavel className="w-6 h-6 text-secondary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Create Auction</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            Starting Price (ETH)
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            value={startingPrice}
                            onChange={(e) => setStartingPrice(e.target.value)}
                            placeholder="0.1"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent outline-none text-white placeholder-gray-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            Reserve Price (ETH)
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            value={reservePrice}
                            onChange={(e) => setReservePrice(e.target.value)}
                            placeholder="0.5"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent outline-none text-white placeholder-gray-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Duration (Hours)</label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-secondary outline-none text-white"
                        >
                            <option value="1">1 Hour</option>
                            <option value="6">6 Hours</option>
                            <option value="12">12 Hours</option>
                            <option value="24">24 Hours</option>
                            <option value="48">48 Hours</option>
                            <option value="168">7 Days</option>
                        </select>
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={isProcessing}
                        className="w-full py-4 bg-secondary hover:bg-secondary/90 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {isProcessing ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Create Auction'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AuctionModal;
