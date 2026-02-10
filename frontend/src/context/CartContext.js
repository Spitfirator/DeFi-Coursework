import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWeb3 } from './Web3Context';

const CartContext = createContext(undefined);

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState([]);
    const { account } = useWeb3();

    // Clear cart when account changes
    useEffect(() => {
        setCartItems([]);
    }, [account]);

    const addToCart = (item) => {
        // Only allow fixed price listings
        if (!item.listing || !item.listing.isActive) return;

        setCartItems(prev => {
            // Prevent duplicates
            if (prev.some(i => i.tokenId === item.tokenId)) {
                return prev;
            }
            return [...prev, item];
        });
    };

    const removeFromCart = (tokenId) => {
        setCartItems(prev => prev.filter(item => item.tokenId !== tokenId));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const isInCart = (tokenId) => {
        return cartItems.some(item => item.tokenId === tokenId);
    };

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, isInCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
