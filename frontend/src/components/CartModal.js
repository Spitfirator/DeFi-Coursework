import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { X, Trash2, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

function CartModal({ isOpen, onClose }) {
    const { cartItems, removeFromCart, clearCart } = useCart();
    const { tradingContract, pokemonContract, account } = useWeb3();
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const navigate = useNavigate();

    if (!isOpen) return null;

    const totalPrice = cartItems.reduce((total, item) => {
        const price = ethers.parseEther(item.listing.price);
        return total + price;
    }, 0n);

    const handleCheckout = async () => {
        if (!tradingContract || !account || cartItems.length === 0) return;

        setIsCheckingOut(true);
        try {
            toast.loading(`Purchasing ${cartItems.length} NFTs...`);

            let successCount = 0;
            let failedItems = [];

            // Purchase each item sequentially
            for (const item of cartItems) {
                try {
                    const price = ethers.parseEther(item.listing.price);
                    const tx = await tradingContract.buyCard(item.tokenId, {
                        value: price
                    });
                    await tx.wait();
                    successCount++;
                } catch (error) {
                    console.error(`Failed to buy #${item.tokenId}:`, error);
                    failedItems.push(item.name);
                }
            }

            toast.dismiss();

            if (successCount === cartItems.length) {
                toast.success(`Successfully purchased all ${successCount} NFTs!`);
            } else if (successCount > 0) {
                toast.success(`Purchased ${successCount} of ${cartItems.length} NFTs`);
                if (failedItems.length > 0) {
                    toast.error(`Failed: ${failedItems.join(', ')}`);
                }
            } else {
                toast.error('All purchases failed');
            }

            console.log('Clearing cart and closing modal...');
            clearCart();
            onClose();

            // Refresh page to update listings (only if at least one purchase succeeded)
            if (successCount > 0) {
                console.log(`Successfully purchased ${successCount} items. Reloading page...`);
                // Wait a bit for blockchain to update, then reload
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            toast.dismiss();
            console.error('Checkout failed:', error);
            toast.error(error.reason || 'Failed to complete purchase');
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 py-8 px-4">
            <div className="bg-gray-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700 flex flex-col my-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <ShoppingCart className="text-primary" size={24} />
                        <h2 className="text-2xl font-bold">My Cart ({cartItems.length})</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {cartItems.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingCart size={64} className="mx-auto text-gray-600 mb-4" />
                            <p className="text-gray-400 text-lg">Your cart is empty</p>
                            <p className="text-gray-500 text-sm mt-2">
                                Add fixed-price items to buy them in bulk!
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Cart Items */}
                            <div className="max-h-[500px] overflow-y-auto space-y-3 mb-6">
                                {cartItems.map((item) => (
                                    <div
                                        key={item.tokenId}
                                        className="flex items-center gap-4 bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                                    >
                                        {/* Pokemon Image */}
                                        <div className="h-16 w-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-2xl font-bold text-white/50">
                                                {item.name.charAt(0)}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-lg truncate">{item.name}</h3>
                                            <p className="text-sm text-gray-400">#{item.tokenId}</p>
                                        </div>

                                        {/* Price */}
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-primary">
                                                {item.listing.price} ETH
                                            </p>
                                        </div>

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => removeFromCart(item.tokenId)}
                                            className="text-red-400 hover:text-red-300 transition-colors p-2"
                                            title="Remove from cart"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Total & Actions */}
                            <div className="border-t border-gray-700 pt-6 space-y-4">
                                <div className="flex justify-between items-center text-xl font-bold">
                                    <span>Total Price:</span>
                                    <span className="text-primary">{ethers.formatEther(totalPrice)} ETH</span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={clearCart}
                                        disabled={isCheckingOut}
                                        className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Clear Cart
                                    </button>
                                    <button
                                        onClick={handleCheckout}
                                        disabled={isCheckingOut}
                                        className="flex-[2] px-6 py-3 bg-gradient-to-r from-primary to-secondary hover:opacity-90 rounded-lg font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCheckingOut ? 'Processing...' : `Checkout (${cartItems.length} items)`}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CartModal;
