'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ListingGrid } from '@/components/ListingGrid';
import { SearchBar } from '@/components/SearchBar';
import { FilterPanel, FilterOptions } from '@/components/FilterPanel';
import { useMarketplaceData } from '@/hooks/useMarketplaceData';
import { formatEther } from 'ethers';

export default function MarketplacePage() {
    const { data: items, isLoading } = useMarketplaceData();
    const searchParams = useSearchParams();
    const urlSearch = searchParams.get('search') || '';

    const [searchQuery, setSearchQuery] = useState(urlSearch);
    const [filters, setFilters] = useState<FilterOptions>({
        rarity: [],
        types: [],
        saleTypes: [],
        priceRange: { min: 0, max: Infinity }
    });

    // Sync search query with URL params
    useEffect(() => {
        if (urlSearch) {
            setSearchQuery(urlSearch);
        }
    }, [urlSearch]);

    // Get unique types for filter
    const availableTypes = useMemo(() => {
        if (!items) return [];
        const types = new Set(items.map(item => item.pokemon.ptype));
        return Array.from(types).sort();
    }, [items]);

    // Filter and search logic
    const filteredItems = useMemo(() => {
        if (!items) return [];

        return items.filter(item => {
            // ONLY show listed NFTs in marketplace (exclude unlisted items)
            if (item.saleType === 'none') return false;

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = item.pokemon.name.toLowerCase().includes(query);
                const matchesId = item.pokemon.tokenId.toString().includes(query);
                if (!matchesName && !matchesId) return false;
            }

            // Rarity filter
            if (filters.rarity.length > 0) {
                const matchesRarity = filters.rarity.some(r => {
                    if (r === 0) return item.pokemon.rarity >= 1 && item.pokemon.rarity <= 3; // Common
                    return item.pokemon.rarity === r;
                });
                if (!matchesRarity) return false;
            }

            // Type filter
            if (filters.types.length > 0 && !filters.types.includes(item.pokemon.ptype)) {
                return false;
            }

            // Sale type filter
            if (filters.saleTypes.length > 0 && !filters.saleTypes.includes(item.saleType)) {
                return false;
            }

            // Price range filter
            if (item.saleType === 'fixed' && item.listing) {
                const price = Number(formatEther(item.listing.price));
                if (price < filters.priceRange.min || price > filters.priceRange.max) {
                    return false;
                }
            }

            return true;
        });
    }, [items, searchQuery, filters]);

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Navbar />

            <div className="container mx-auto px-4 py-8">
                {/* Header with Search */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">Explore Marketplace</h1>
                    <SearchBar onSearch={setSearchQuery} />
                    <p className="text-gray-600 dark:text-gray-400 mt-4">
                        {filteredItems.length} NFT{filteredItems.length !== 1 ? 's' : ''} found
                    </p>
                </div>

                {/* Main Content: Filters + Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Filters Sidebar */}
                    <div className="lg:col-span-1">
                        <FilterPanel
                            onFilterChange={setFilters}
                            availableTypes={availableTypes}
                        />
                    </div>

                    {/* NFT Grid */}
                    <div className="lg:col-span-3">
                        {isLoading ? (
                            <div className="text-center py-20">Loading...</div>
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center py-20">
                                <p className="text-gray-500 dark:text-gray-400 text-lg">No NFTs found</p>
                                <p className="text-sm text-gray-400 mt-2">Try adjusting your filters</p>
                            </div>
                        ) : (
                            <ListingGrid items={filteredItems} />
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
