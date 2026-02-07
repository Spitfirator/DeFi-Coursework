'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { MarketplaceItem } from '../types/app-types';
import { useWeb3 } from './Web3Context';

interface CartContextType {
    cartItems: MarketplaceItem[];
    addToCart: (item: MarketplaceItem) => void;
    removeFromCart: (tokenId: string) => void;
    clearCart: () => void;
    isInCart: (tokenId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [cartItems, setCartItems] = useState<MarketplaceItem[]>([]);
    const { account } = useWeb3();

    // Clear cart when account changes
    useEffect(() => {
        setCartItems([]);
    }, [account]);

    const addToCart = (item: MarketplaceItem) => {
        // Only allow fixed price items
        if (item.saleType !== 'fixed') return;

        setCartItems(prev => {
            // Prevent duplicates
            if (prev.some(i => i.pokemon.tokenId.toString() === item.pokemon.tokenId.toString())) {
                return prev;
            }
            return [...prev, item];
        });
    };

    const removeFromCart = (tokenId: string) => {
        setCartItems(prev => prev.filter(item => item.pokemon.tokenId.toString() !== tokenId));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const isInCart = (tokenId: string) => {
        return cartItems.some(item => item.pokemon.tokenId.toString() === tokenId);
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
