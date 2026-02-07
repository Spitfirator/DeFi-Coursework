'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useCart } from '../../context/CartContext';
import { useWeb3 } from '../../context/Web3Context';
import { formatEther } from 'ethers';
import { Trash2 } from 'lucide-react';
import { POKEMON_NFT_ADDRESS } from '../../contracts/addresses';

interface CartModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CartModal({ isOpen, onClose }: CartModalProps) {
    const { cartItems, removeFromCart, clearCart } = useCart();
    const { marketplaceContract, account } = useWeb3();
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const totalPrice = cartItems.reduce((total, item) => {
        return total + (item.listing?.price || 0n);
    }, 0n);

    const handleCheckout = async () => {
        if (!marketplaceContract || !account) return;
        setIsCheckingOut(true);
        try {
            // All items use the same NFT contract in this app
            const nftContracts = cartItems.map(() => POKEMON_NFT_ADDRESS);
            // Ensure tokenId is formatted correctly
            const tokenIds = cartItems.map(item => item.pokemon.tokenId);

            console.log("Checking out with price:", formatEther(totalPrice));

            const tx = await marketplaceContract.batchBuy(nftContracts, tokenIds, {
                value: totalPrice
            });

            console.log("Tx sent:", tx.hash);
            await tx.wait();

            clearCart();
            onClose();
            alert("Batch Purchase Successful!");
            // Optionally refresh page or invalidate queries here
            window.location.reload();
        } catch (error: any) {
            console.error("Checkout failed:", error);
            alert(`Checkout failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`My Cart (${cartItems.length})`}>
            <div className="space-y-4">
                {cartItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        Your cart is empty. Add fixed-price items to buy them in bulk!
                    </div>
                ) : (
                    <>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                            {cartItems.map((item) => (
                                <div key={item.pokemon.tokenId.toString()} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                                    <img
                                        src={item.imageUri}
                                        alt={item.pokemon.name}
                                        className="h-12 w-12 object-contain bg-white rounded-md"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold truncate">{item.pokemon.name}</div>
                                        <div className="text-xs text-gray-500">#{item.pokemon.tokenId.toString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-sm">
                                            {formatEther(item.listing?.price || 0n)} ETH
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-700 h-8 w-8"
                                        onClick={() => removeFromCart(item.pokemon.tokenId.toString())}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>Total Price:</span>
                                <span>{formatEther(totalPrice)} ETH</span>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={clearCart}
                                    disabled={isCheckingOut}
                                >
                                    Clear Cart
                                </Button>
                                <Button
                                    className="flex-[2]"
                                    onClick={handleCheckout}
                                    isLoading={isCheckingOut}
                                >
                                    {isCheckingOut ? 'Purchasing...' : 'Checkout'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
