import React, { useState, useEffect } from 'react';
import { X, ArrowLeftRight, Loader } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const SwapModal = ({ isOpen, onClose, desiredCard }) => {
    const { account, pokemonContract, tradingContract } = useWeb3();
    const [myCards, setMyCards] = useState([]);
    const [selectedCard, setSelectedCard] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingCards, setLoadingCards] = useState(true);

    useEffect(() => {
        if (isOpen && account) {
            loadMyCards();
        }
    }, [isOpen, account]);

    const loadMyCards = async () => {
        try {
            setLoadingCards(true);

            // We need to fetch ALL cards (in wallet + listed/auctioned)
            // Iterate totalMinted like MyCards.js to find everything
            const total = Number(await pokemonContract.totalSupply());
            const cards = [];

            for (let i = 0; i < total; i++) {
                try {
                    const tokenId = Number(await pokemonContract.tokenByIndex(i));
                    // Check ownership or seller status
                    const owner = await pokemonContract.ownerOf(tokenId);
                    const isWalletOwner = owner.toLowerCase() === account.toLowerCase();

                    let isMyListing = false;
                    let isMyAuction = false;
                    let isMyDutch = false;

                    if (!isWalletOwner) {
                        // Check if it's my listing (in escrow)
                        const listing = await tradingContract.listings(tokenId);
                        if (listing.isActive && listing.seller.toLowerCase() === account.toLowerCase()) {
                            isMyListing = true;
                        } else {
                            const auction = await tradingContract.auctions(tokenId);
                            if (auction.isActive && auction.seller.toLowerCase() === account.toLowerCase()) {
                                isMyAuction = true;
                            } else {
                                const dutch = await tradingContract.dutchAuctions(tokenId);
                                if (dutch.isActive && dutch.seller.toLowerCase() === account.toLowerCase()) {
                                    isMyDutch = true;
                                }
                            }
                        }
                    }

                    // If I own it OR I'm the seller (it's in escrow)
                    if (isWalletOwner || isMyListing || isMyAuction || isMyDutch) {
                        // Don't show the card we want to swap for
                        if (tokenId.toString() !== desiredCard.tokenId.toString()) {
                            const cardStats = await pokemonContract.getPokemonStats(tokenId);
                            cards.push({
                                tokenId: tokenId.toString(),
                                name: cardStats.name,
                                pokemonType: cardStats.pokemonType,
                                rarity: cardStats.rarity,
                                hp: cardStats.hp.toString(),
                                attack: cardStats.attack.toString(),
                                defense: cardStats.defense.toString(),
                                speed: cardStats.speed.toString(),
                                status: isWalletOwner ? 'available' : (isMyListing ? 'listed' : 'auction'),
                                statusText: isMyListing ? 'Listed' : (isMyAuction || isMyDutch ? 'In Auction' : '')
                            });
                        }
                    }
                } catch (e) {
                    // Skip if error reading token key
                }
            }

            setMyCards(cards);
        } catch (error) {
            console.error('Error loading cards:', error);
            toast.error('Failed to load your cards');
        } finally {
            setLoadingCards(false);
        }
    };

    const handleProposeSwap = async () => {
        if (!selectedCard) {
            toast.error('Please select a card to offer');
            return;
        }

        try {
            setLoading(true);

            // Check if marketplace is approved
            const isApproved = await pokemonContract.isApprovedForAll(account, await tradingContract.getAddress());

            if (!isApproved) {
                toast.loading('Please approve marketplace in your wallet...');
                const approveTx = await pokemonContract.setApprovalForAll(await tradingContract.getAddress(), true);
                await approveTx.wait();
                toast.dismiss();
                toast.success('Marketplace approved!');
            }

            toast.loading('Creating swap request...');
            const tx = await tradingContract.createSwapRequest(
                desiredCard.tokenId,
                selectedCard.tokenId
            );
            await tx.wait();

            toast.dismiss();
            toast.success(`Swap request sent! You offered ${selectedCard.name} for ${desiredCard.name}`);
            onClose();
        } catch (error) {
            console.error('Error creating swap:', error);
            toast.dismiss();
            toast.error(error.reason || 'Failed to create swap request');
        } finally {
            setLoading(false);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-800">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ArrowLeftRight className="text-primary" size={24} />
                        <div>
                            <h2 className="text-2xl font-bold">Propose Swap</h2>
                            <p className="text-gray-400 text-sm">Offer one of your cards for {desiredCard.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Swap Preview */}
                    <div className="grid grid-cols-3 gap-4 mb-6 items-center">
                        {/* Your Card */}
                        <div className="text-center">
                            {selectedCard ? (
                                <div className={`bg-gradient-to-br ${getTypeColor(selectedCard.pokemonType)} p-4 rounded-xl`}>
                                    <div className="text-white font-bold text-lg">{selectedCard.name}</div>
                                    <div className="text-white/80 text-sm">{selectedCard.pokemonType}</div>
                                    <div className="text-white/60 text-xs mt-2">{selectedCard.rarity}</div>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-gray-500">
                                    Select your card
                                </div>
                            )}
                        </div>

                        {/* Arrow */}
                        <div className="flex justify-center">
                            <ArrowLeftRight className="text-primary" size={48} />
                        </div>

                        {/* Their Card */}
                        <div className="text-center">
                            <div className={`bg-gradient-to-br ${getTypeColor(desiredCard.pokemonType)} p-4 rounded-xl`}>
                                <div className="text-white font-bold text-lg">{desiredCard.name}</div>
                                <div className="text-white/80 text-sm">{desiredCard.pokemonType}</div>
                                <div className="text-white/60 text-xs mt-2">{desiredCard.rarity}</div>
                            </div>
                        </div>
                    </div>

                    {/* Your Cards Grid */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Select a card to offer:</h3>

                        {loadingCards ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader className="animate-spin text-primary" size={32} />
                            </div>
                        ) : myCards.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p>You don't have any other cards to offer</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {myCards.map((card) => (
                                    <button
                                        key={card.tokenId}
                                        onClick={() => card.status === 'available' && setSelectedCard(card)}
                                        disabled={card.status !== 'available'}
                                        className={`relative p-3 rounded-xl transition-all ${selectedCard?.tokenId === card.tokenId
                                            ? 'ring-2 ring-primary bg-primary/10'
                                            : 'bg-gray-800 hover:bg-gray-700'
                                            } ${card.status !== 'available' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className={`bg-gradient-to-br ${getTypeColor(card.pokemonType)} p-3 rounded-lg mb-2`}>
                                            <div className="text-white font-bold text-sm">{card.name}</div>
                                            <div className="text-white/70 text-xs">{card.pokemonType}</div>
                                        </div>
                                        <div className="text-xs text-gray-400">{card.rarity}</div>
                                        <div className="text-xs text-gray-500">#{card.tokenId}</div>

                                        {/* Status Badge */}
                                        {card.status !== 'available' && (
                                            <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white font-bold">
                                                {card.statusText}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleProposeSwap}
                        disabled={!selectedCard || loading}
                        className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader className="animate-spin" size={18} />
                                Proposing...
                            </>
                        ) : (
                            <>
                                <ArrowLeftRight size={18} />
                                Propose Swap
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SwapModal;
