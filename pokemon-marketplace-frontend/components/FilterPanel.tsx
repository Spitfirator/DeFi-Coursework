'use client';

import { useState } from 'react';
import { SaleType } from '../types/app-types';

export interface FilterOptions {
    rarity: number[];
    types: string[];
    saleTypes: SaleType[];
    priceRange: { min: number; max: number };
}

interface FilterPanelProps {
    onFilterChange: (filters: FilterOptions) => void;
    availableTypes: string[];
}

export function FilterPanel({ onFilterChange, availableTypes }: FilterPanelProps) {
    const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedSaleTypes, setSelectedSaleTypes] = useState<SaleType[]>([]);
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const handleRarityToggle = (rarity: number) => {
        const newRarities = selectedRarities.includes(rarity)
            ? selectedRarities.filter(r => r !== rarity)
            : [...selectedRarities, rarity];
        setSelectedRarities(newRarities);
        updateFilters({ rarity: newRarities });
    };

    const handleTypeToggle = (type: string) => {
        const newTypes = selectedTypes.includes(type)
            ? selectedTypes.filter(t => t !== type)
            : [...selectedTypes, type];
        setSelectedTypes(newTypes);
        updateFilters({ types: newTypes });
    };

    const handleSaleTypeToggle = (saleType: SaleType) => {
        const newSaleTypes = selectedSaleTypes.includes(saleType)
            ? selectedSaleTypes.filter(st => st !== saleType)
            : [...selectedSaleTypes, saleType];
        setSelectedSaleTypes(newSaleTypes);
        updateFilters({ saleTypes: newSaleTypes });
    };

    const handlePriceChange = () => {
        updateFilters({
            priceRange: {
                min: priceMin ? parseFloat(priceMin) : 0,
                max: priceMax ? parseFloat(priceMax) : Infinity
            }
        });
    };

    const updateFilters = (updates: Partial<FilterOptions>) => {
        onFilterChange({
            rarity: selectedRarities,
            types: selectedTypes,
            saleTypes: selectedSaleTypes,
            priceRange: { min: 0, max: Infinity },
            ...updates
        });
    };

    const clearFilters = () => {
        setSelectedRarities([]);
        setSelectedTypes([]);
        setSelectedSaleTypes([]);
        setPriceMin('');
        setPriceMax('');
        onFilterChange({
            rarity: [],
            types: [],
            saleTypes: [],
            priceRange: { min: 0, max: Infinity }
        });
    };

    const hasActiveFilters = selectedRarities.length > 0 || selectedTypes.length > 0 || selectedSaleTypes.length > 0 || priceMin || priceMax;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filters
                    {hasActiveFilters && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                            Active
                        </span>
                    )}
                </h3>
                <div className="flex gap-2">
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            Clear All
                        </button>
                    )}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="lg:hidden text-gray-600 dark:text-gray-400"
                    >
                        {isExpanded ? 'Hide' : 'Show'}
                    </button>
                </div>
            </div>

            <div className={`space-y-6 ${isExpanded ? 'block' : 'hidden lg:block'}`}>
                {/* Rarity Filter */}
                <div>
                    <h4 className="font-medium mb-2 text-sm">Rarity</h4>
                    <div className="space-y-2">
                        {[
                            { value: 5, label: 'Legendary', color: 'text-yellow-500' },
                            { value: 4, label: 'Rare', color: 'text-purple-500' },
                            { value: 1, label: 'Common', color: 'text-gray-500' } // Changed from 0 to 1
                        ].map(({ value, label, color }) => (
                            <label key={value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedRarities.includes(value)}
                                    onChange={() => handleRarityToggle(value)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`${color} font-medium`}>{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Type Filter */}
                <div>
                    <h4 className="font-medium mb-2 text-sm">Type</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {availableTypes.map(type => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedTypes.includes(type)}
                                    onChange={() => handleTypeToggle(type)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Sale Type Filter */}
                <div>
                    <h4 className="font-medium mb-2 text-sm">Sale Type</h4>
                    <div className="space-y-2">
                        {[
                            { value: 'fixed' as SaleType, label: 'Fixed Price' },
                            { value: 'auction' as SaleType, label: 'English Auction' },
                            { value: 'dutch' as SaleType, label: 'Dutch Auction' },
                            { value: 'none' as SaleType, label: 'Not Listed' }
                        ].map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedSaleTypes.includes(value)}
                                    onChange={() => handleSaleTypeToggle(value)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Price Range Filter */}
                <div>
                    <h4 className="font-medium mb-2 text-sm">Price Range (ETH)</h4>
                    <div className="space-y-2">
                        <input
                            type="number"
                            placeholder="Min"
                            value={priceMin}
                            onChange={(e) => setPriceMin(e.target.value)}
                            onBlur={handlePriceChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-slate-900 text-sm"
                            step="0.01"
                            min="0"
                        />
                        <input
                            type="number"
                            placeholder="Max"
                            value={priceMax}
                            onChange={(e) => setPriceMax(e.target.value)}
                            onBlur={handlePriceChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-slate-900 text-sm"
                            step="0.01"
                            min="0"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
