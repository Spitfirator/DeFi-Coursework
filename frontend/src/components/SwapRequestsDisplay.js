import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, X, Check, Loader } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import toast from 'react-hot-toast';

const SwapRequestsDisplay = ({ tokenId, isOwner, onSwapComplete }) => {
    const { account, pokemonContract, tradingContract } = useWeb3();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingIndex, setProcessingIndex] = useState(null);

    useEffect(() => {
        if (tokenId && tradingContract) {
            loadSwapRequests();
        }
    }, [tokenId, tradingContract]);

    const loadSwapRequests = async () => {
        try {
            setLoading(true);
            const swapRequests = await tradingContract.getSwapRequests(tokenId);

            // Filter active requests and load card details
            const activeRequests = [];
            for (let i = 0; i < swapRequests.length; i++) {
                const req = swapRequests[i];
                if (req.isActive) {
                    try {
                        const offeredCard = await pokemonContract.getPokemonStats(req.offeredTokenId);
                        activeRequests.push({
                            index: i,
                            requester: req.requester,
                            offeredTokenId: req.offeredTokenId.toString(),
                            offeredCard: {
                                name: offeredCard.name,
                                pokemonType: offeredCard.pokemonType,
                                rarity: offeredCard.rarity,
                                hp: offeredCard.hp.toString(),
                                attack: offeredCard.attack.toString(),
                                defense: offeredCard.defense.toString(),
                                speed: offeredCard.speed.toString()
                            }
                        });
                    } catch (error) {
                        console.error('Error loading offered card:', error);
                    }
                }
            }

            setRequests(activeRequests);
        } catch (error) {
            console.error('Error loading swap requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptSwap = async (requestIndex) => {
        try {
            setProcessingIndex(requestIndex);

            // Check if marketplace is approved
            const isApproved = await pokemonContract.isApprovedForAll(account, await tradingContract.getAddress());

            if (!isApproved) {
                toast.loading('Please approve marketplace in your wallet...');
                const approveTx = await pokemonContract.setApprovalForAll(await tradingContract.getAddress(), true);
                await approveTx.wait();
                toast.dismiss();
                toast.success('Marketplace approved!');
            }

            toast.loading('Executing swap...');
            const tx = await tradingContract.executeSwap(tokenId, requestIndex);
            await tx.wait();

            toast.dismiss();
            toast.success('Swap completed successfully! 🎉');

            // Reload requests and parent component data
            await loadSwapRequests();
            if (onSwapComplete) {
                await onSwapComplete();
            }
        } catch (error) {
            console.error('Error accepting swap:', error);
            toast.dismiss();
            toast.error(error.reason || 'Failed to execute swap');
        } finally {
            setProcessingIndex(null);
        }
    };

    const handleRejectSwap = async (requestIndex) => {
        try {
            setProcessingIndex(requestIndex);

            toast.loading('Rejecting swap...');
            const tx = await tradingContract.cancelSwapRequest(tokenId, requestIndex);
            await tx.wait();

            toast.dismiss();
            toast.success('Swap request rejected');

            // Reload requests
            await loadSwapRequests();
        } catch (error) {
            console.error('Error rejecting swap:', error);
            toast.dismiss();
            toast.error(error.reason || 'Failed to reject swap');
        } finally {
            setProcessingIndex(null);
        }
    };

    const getTypeColor = (type) => {
        const colors = {
            Fire: 'from-red-500 to-orange-500',
            Water: 'from-blue-500 to-cyan-500',
            Grass: 'from-green-500 to-emerald-500',
            Electric: 'from-yellow-400 to-yellow-600',
            Psychic: 'from-purple-500 to-pink-500',
            Ghost: 'from-purple-700 to-indigo-900',
            Rock: 'from-gray-600 to-stone-700',
            Bug: 'from-lime-500 to-green-600',
            Normal: 'from-gray-400 to-gray-600'
        };
        return colors[type] || 'from-gray-500 to-gray-700';
    };

    if (!isOwner || loading) return null;
    if (requests.length === 0) return null;

    return (
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
                <ArrowLeftRight className="text-primary" size={24} />
                <div>
                    <h3 className="text-xl font-bold">Incoming Swap Requests</h3>
                    <p className="text-gray-400 text-sm">{requests.length} {requests.length === 1 ? 'person wants' : 'people want'} to trade with you</p>
                </div>
            </div>

            <div className="space-y-4">
                {requests.map((request) => (
                    <div key={request.index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between gap-4">
                            {/* Offered Card */}
                            <div className="flex-1">
                                <div className="text-xs text-gray-400 mb-2">They offer:</div>
                                <div className={`bg-gradient-to-br ${getTypeColor(request.offeredCard.pokemonType)} p-3 rounded-lg`}>
                                    <div className="text-white font-bold">{request.offeredCard.name}</div>
                                    <div className="text-white/80 text-sm">{request.offeredCard.pokemonType}</div>
                                    <div className="text-white/60 text-xs mt-1">{request.offeredCard.rarity}</div>
                                    <div className="grid grid-cols-4 gap-2 mt-2 text-white/70 text-xs">
                                        <div>HP: {request.offeredCard.hp}</div>
                                        <div>ATK: {request.offeredCard.attack}</div>
                                        <div>DEF: {request.offeredCard.defense}</div>
                                        <div>SPD: {request.offeredCard.speed}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    From: {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleAcceptSwap(request.index)}
                                    disabled={processingIndex === request.index}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {processingIndex === request.index ? (
                                        <Loader className="animate-spin" size={16} />
                                    ) : (
                                        <Check size={16} />
                                    )}
                                    Accept
                                </button>
                                <button
                                    onClick={() => handleRejectSwap(request.index)}
                                    disabled={processingIndex === request.index}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <X size={16} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SwapRequestsDisplay;
