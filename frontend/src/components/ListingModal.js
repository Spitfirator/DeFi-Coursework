import React, { useState } from 'react';
import { X, Tag, Loader } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

function ListingModal({ isOpen, onClose, nft, tradingContract, pokemonContract, onSuccess }) {
    const [price, setPrice] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (!price) {
            toast.error('Please enter a price');
            return;
        }

        try {
            setIsProcessing(true);
            const priceWei = ethers.parseEther(price);

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

            toast.loading('Creating listing...');
            const tx = await tradingContract.listCard(nft.tokenId, priceWei);
            await tx.wait();

            toast.dismiss();
            toast.success('Listed successfully!');
            onClose();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.dismiss();
            console.error('Failed to list:', error);
            toast.error(error.reason || 'Failed to list item');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <Tag className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">List for Sale</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            Price (ETH)
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0.1"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-white placeholder-gray-500"
                        />
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={isProcessing}
                        className="w-full py-4 bg-primary hover:bg-primary/90 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {isProcessing ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'List Item'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ListingModal;
