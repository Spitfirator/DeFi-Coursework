'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Web3Provider } from '../context/Web3Context';

import { CartProvider } from '../context/CartContext';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <Web3Provider>
                <CartProvider>
                    {children}
                </CartProvider>
            </Web3Provider>
        </QueryClientProvider>
    );
}
