import { useState } from 'react';
import { DollarSign, Star, Zap, Filter, Tag, X } from 'lucide-react';

const pillBase = "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer";
const pillActive = "bg-primary/15 text-primary border-primary/40";
const pillInactive = "bg-gray-800/60 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-white";

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

            <FilterSection title="Rarity" icon={Star}>
                <div className="flex flex-wrap gap-1.5">
                    {rarities.map((rarity) => (
                        <button
                            key={rarity}
                            onClick={() => handleRarityChange(rarity)}
                            className={`${pillBase} ${filters.rarity === rarity ? pillActive : pillInactive}`}
                        >
                            {rarity}
                        </button>
                    ))}
                </div>
            </FilterSection>

            <FilterSection title="Type" icon={Zap}>
                <div className="flex flex-wrap gap-1.5">
                    {types.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleTypeChange(type)}
                            className={`${pillBase} ${filters.type === type ? pillActive : pillInactive}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </FilterSection>
        </div>
    );
};

const InlineFilterContent = ({ filters, setFilters, isMarketplace, rarities, types }) => {
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
        <div className="space-y-4">
            {isMarketplace && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-14 flex-shrink-0">Status</span>
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'listings', label: 'Buy Now' },
                        { id: 'auctions', label: 'Auctions' },
                        { id: 'dutch', label: 'Dutch' }
                    ].map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleStatusChange(option.id)}
                            className={`${pillBase} ${filters.status === option.id ? pillActive : pillInactive}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-14 flex-shrink-0">Price</span>
                <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                    className="w-24 bg-gray-800 border border-gray-700 focus:border-primary rounded-lg px-3 py-1.5 text-xs focus:outline-none transition-all text-white placeholder-gray-600"
                />
                <span className="text-gray-600 text-xs">to</span>
                <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                    className="w-24 bg-gray-800 border border-gray-700 focus:border-primary rounded-lg px-3 py-1.5 text-xs focus:outline-none transition-all text-white placeholder-gray-600"
                />
                <span className="text-xs text-gray-600">ETH</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-14 flex-shrink-0">Rarity</span>
                {rarities.map((rarity) => (
                    <button
                        key={rarity}
                        onClick={() => handleRarityChange(rarity)}
                        className={`${pillBase} ${filters.rarity === rarity ? pillActive : pillInactive}`}
                    >
                        {rarity}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-14 flex-shrink-0">Type</span>
                {types.map((type) => (
                    <button
                        key={type}
                        onClick={() => handleTypeChange(type)}
                        className={`${pillBase} ${filters.type === type ? pillActive : pillInactive}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default function FilterSidebar({
    filters,
    setFilters,
    isMarketplace = false,
    isOpen,
    onClose
}) {
    const rarities = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    const types = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ghost', 'Rock', 'Bug', 'Dragon', 'Fighting', 'Poison', 'Flying', 'Ground', 'Dark', 'Steel', 'Ice', 'Fairy'];

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Mobile Drawer */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-80 bg-gray-950 border-r border-gray-800 transform transition-transform duration-300 ease-in-out lg:hidden
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <span className="font-bold text-lg flex items-center gap-2">
                        <Filter size={20} className="text-primary" /> Filters
                    </span>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

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

            {/* Desktop Inline Filter Panel */}
            {isOpen && (
                <div className="hidden lg:block bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-5 mb-6">
                    <InlineFilterContent
                        filters={filters}
                        setFilters={setFilters}
                        isMarketplace={isMarketplace}
                        rarities={rarities}
                        types={types}
                    />
                </div>
            )}
        </>
    );
}
