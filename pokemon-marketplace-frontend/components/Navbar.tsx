'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWeb3 } from '../context/Web3Context';
import { Button } from './ui/Button';
import { cn } from './ui/Button'; // reusing cn util but normally should be in lib/utils
import { Loader2, Wallet } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { connectWallet, disconnectWallet, account, isConnecting, error, chainId } = useWeb3();
    const [searchQuery, setSearchQuery] = useState('');

    const navLinks = [
        { href: '/marketplace', label: 'Marketplace' },
        { href: '/my-nfts', label: 'My NFTs' },
        { href: '/create', label: 'Create Listing' },
    ];

    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/marketplace?search=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-white/70 backdrop-blur-md dark:bg-slate-900/70">
            <div className="container mx-auto flex h-16 items-center px-4 gap-4">
                {/* Logo */}
                <div className="flex items-center space-x-2">
                    <Link href="/" className="flex items-center space-x-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent whitespace-nowrap">
                            DeFi Pokemon
                        </span>
                    </Link>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex-1 max-w-md">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search NFTs by name or ID..."
                            className="w-full px-4 py-2 pl-10 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <svg
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>
                </form>

                {/* Navigation Links */}
                <div className="flex flex-1 items-center space-x-6 text-sm font-medium">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "transition-colors hover:text-blue-600",
                                pathname === link.href ? "text-blue-600 font-bold" : "text-gray-600 dark:text-gray-300"
                            )}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center space-x-4">
                    {error && (
                        <div className="text-xs text-red-500 max-w-[200px] truncate" title={error}>
                            {error}
                        </div>
                    )}

                    {account ? (
                        <div className="flex items-center space-x-2">
                            <div className="px-3 py-1 rounded-full bg-blue-100/50 text-blue-700 text-xs font-mono border border-blue-200">
                                {formatAddress(account)}
                            </div>
                            <Button variant="outline" size="sm" onClick={disconnectWallet}>
                                Disconnect
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={connectWallet}
                            isLoading={isConnecting}
                            disabled={isConnecting}
                            size="sm"
                        >
                            {!isConnecting && <Wallet className="mr-2 h-4 w-4" />}
                            Connect Wallet
                        </Button>
                    )}
                </div>
            </div>
        </nav>
    );
}
