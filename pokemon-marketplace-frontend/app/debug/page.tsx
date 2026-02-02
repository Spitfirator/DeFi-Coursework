'use client';

import { useWeb3 } from '@/context/Web3Context';
import { useMarketplaceData } from '@/hooks/useMarketplaceData';
import { Navbar } from '@/components/Navbar';

export default function DebugPage() {
    const { account, nftContract, chainId } = useWeb3();
    const { data: items, isLoading, error } = useMarketplaceData();

    const myItems = items?.filter(item =>
        account && item.owner.toLowerCase() === account.toLowerCase()
    );

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Navbar />
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">Debug Info</h1>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg space-y-4">
                    <div>
                        <h2 className="font-bold text-lg mb-2">Connection Status</h2>
                        <p><strong>Connected Account:</strong> {account || 'Not connected'}</p>
                        <p><strong>Chain ID:</strong> {chainId}</p>
                        <p><strong>NFT Contract:</strong> {nftContract?.target as string}</p>
                    </div>

                    <div>
                        <h2 className="font-bold text-lg mb-2">Data Loading</h2>
                        <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
                        <p><strong>Error:</strong> {error ? String(error) : 'None'}</p>
                        <p><strong>Total Items Loaded:</strong> {items?.length || 0}</p>
                        <p><strong>My Items:</strong> {myItems?.length || 0}</p>
                    </div>

                    {myItems && myItems.length > 0 && (
                        <div>
                            <h2 className="font-bold text-lg mb-2">My NFT Token IDs</h2>
                            <p>{myItems.map(item => item.pokemon.tokenId.toString()).join(', ')}</p>
                        </div>
                    )}

                    {items && items.length > 0 && (
                        <div>
                            <h2 className="font-bold text-lg mb-2">Sample Items (first 5)</h2>
                            {items.slice(0, 5).map(item => (
                                <div key={item.pokemon.tokenId.toString()} className="border-t pt-2 mt-2">
                                    <p><strong>Token #{item.pokemon.tokenId.toString()}:</strong> {item.pokemon.name}</p>
                                    <p><strong>Owner:</strong> {item.owner}</p>
                                    <p><strong>Match:</strong> {account && item.owner.toLowerCase() === account.toLowerCase() ? '✅ YES' : '❌ NO'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
