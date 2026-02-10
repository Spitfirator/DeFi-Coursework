import React, { useState } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Star, Zap, Filter, Tag, X } from 'lucide-react';

const FilterSection = ({ title, icon: Icon, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-gray-800 py-4 first:pt-0 last:border-0">
            <button
                className="flex items-center justify-between w-full font-semibold text-gray-200 hover:text-white transition-all mb-3 group py-2"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={18} className="text-primary group-hover:text-white transition-colors" />}
                    <span className="group-hover:text-primary transition-colors text-sm uppercase tracking-wide">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {isOpen && <div className="space-y-2 animate-fadeIn mb-2">{children}</div>}
        </div>
    );
};

const FilterContent = ({ filters, setFilters, isMarketplace, rarities, types }) => {
    const handleStatusChange = (status) => {
        setFilters(prev => ({ ...prev, status }));
    };

    const handleRarityChange = (rarity) => {
        setFilters(prev => ({ ...prev, rarity: prev.rarity === rarity ? 'all' : rarity }));
    };

    const handleTypeChange = (type) => {
        setFilters(prev => ({ ...prev, type: prev.type === type ? 'all' : type }));
    };

    return (
        <div className="flex flex-col gap-2">
            {/* Marketplace Status Filter */}
            {isMarketplace && (
                <FilterSection title="Status" icon={Tag}>
                    <div className="bg-gray-900/50 p-1.5 rounded-xl flex flex-col gap-1 border border-white/5">
                        {[
                            { id: 'all', label: 'All Items' },
                            { id: 'listings', label: 'Buy Now' },
                            { id: 'auctions', label: 'Auctions' },
                            { id: 'dutch', label: 'Dutch Auctions' }
                        ].map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleStatusChange(option.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm font-medium ${filters.status === option.id
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Price Filter */}
            <FilterSection title="Price (ETH)" icon={DollarSign}>
                <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-xl border border-white/5">
                    <input
                        type="number"
                        placeholder="Min"
                        value={filters.priceMin}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 focus:border-primary rounded-lg px-3 py-2 text-sm focus:outline-none transition-all text-white placeholder-gray-600"
                    />
                    <span className="text-gray-600 font-bold">-</span>
                    <input
                        type="number"
                        placeholder="Max"
                        value={filters.priceMax}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 focus:border-primary rounded-lg px-3 py-2 text-sm focus:outline-none transition-all text-white placeholder-gray-600"
                    />
                </div>
            </FilterSection>

            {/* Rarity Filter */}
            <FilterSection title="Rarity" icon={Star}>
                <div className="grid grid-cols-1 gap-1">
                    {rarities.map((rarity) => (
                        <button
                            key={rarity}
                            onClick={() => handleRarityChange(rarity)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm group border ${filters.rarity === rarity
                                    ? 'bg-purple-500/10 text-purple-400 font-semibold border-purple-500/30'
                                    : 'border-transparent text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <span className="group-hover:translate-x-1 transition-transform">{rarity}</span>
                            {filters.rarity === rarity && <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]"></span>}
                        </button>
                    ))}
                </div>
            </FilterSection>

            {/* Type Filter */}
            <FilterSection title="Type" icon={Zap}>
                <div className="grid grid-cols-2 gap-2">
                    {types.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleTypeChange(type)}
                            className={`w-full px-2 py-1.5 rounded-lg transition-all text-xs font-medium border ${filters.type === type
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </FilterSection>
        </div>
    );
};

export default function FilterSidebar({
    filters,
    setFilters,
    isMarketplace = false,
    isOpen,   // Mobile Open State
    onClose   // Mobile Close Handler
}) {
    const rarities = ['Common', 'Rare', 'Legendary'];
    const types = ['Electric', 'Fire', 'Water', 'Grass', 'Psychic', 'Ghost', 'Rock', 'Bug', 'Normal'];

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Mobile Drawer Container */}
            <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-gray-950 border-r border-gray-800 transform transition-transform duration-300 ease-in-out lg:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <span className="font-bold text-lg flex items-center gap-2">
                        <Filter size={20} className="text-primary" /> Filters
                    </span>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Mobile Content */}
                <div className="h-full overflow-y-auto pb-32 custom-scrollbar p-6">
                    <FilterContent
                        filters={filters}
                        setFilters={setFilters}
                        isMarketplace={isMarketplace}
                        rarities={rarities}
                        types={types}
                    />
                </div>
            </div>

            {/* Desktop Sidebar - FLUSH LEFT STYLE */}
            <div className={`
        hidden lg:block 
        w-72 flex-shrink-0 
        sticky top-20 
        h-[calc(100vh-80px)] 
        overflow-y-auto custom-scrollbar 
        bg-gray-950/50 backdrop-blur-xl 
        border-r border-gray-800 
      `}>
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-6 text-gray-400 text-xs font-bold uppercase tracking-widest">
                        <Filter size={14} /> Filters
                    </div>

                    <FilterContent
                        filters={filters}
                        setFilters={setFilters}
                        isMarketplace={isMarketplace}
                        rarities={rarities}
                        types={types}
                    />
                </div>
            </div>
        </>
    );
}
