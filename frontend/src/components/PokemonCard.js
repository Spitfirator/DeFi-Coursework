import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Flame, Droplet, Leaf, Brain, Ghost, Mountain, Bug, Star, Egg, ShoppingCart, Zap as Lightning } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const typeColors = {
  Electric: { bg: 'from-yellow-400 to-yellow-600', icon: Zap },
  Fire: { bg: 'from-orange-500 to-red-600', icon: Flame },
  Water: { bg: 'from-blue-400 to-blue-600', icon: Droplet },
  Grass: { bg: 'from-green-400 to-green-600', icon: Leaf },
  Psychic: { bg: 'from-pink-400 to-purple-600', icon: Brain },
  Ghost: { bg: 'from-purple-500 to-purple-800', icon: Ghost },
  Rock: { bg: 'from-yellow-700 to-yellow-900', icon: Mountain },
  Bug: { bg: 'from-lime-400 to-green-600', icon: Bug },
  Normal: { bg: 'from-gray-400 to-gray-600', icon: Star },
};

// Pokemon name to Pokedex ID mapping for PokeAPI sprites
const pokemonToPokedexId = {
  'Mewtwo': 150, 'Lugia': 249, 'Rayquaza': 384, 'Arceus': 493, 'Giratina': 487,
  'Charizard': 6, 'Blastoise': 9, 'Venusaur': 3, 'Gengar': 94, 'Dragonite': 149,
  'Gyarados': 130, 'Alakazam': 65, 'Machamp': 68, 'Snorlax': 143, 'Arcanine': 59,
  'Lapras': 131, 'Tyranitar': 248, 'Metagross': 376, 'Salamence': 373, 'Garchomp': 445,
  'Pikachu': 25, 'Bulbasaur': 1, 'Charmander': 4, 'Squirtle': 7, 'Pidgey': 16,
  'Rattata': 19, 'Zubat': 41, 'Geodude': 74, 'Magikarp': 129, 'Caterpie': 10,
  'Eevee': 133, 'Jigglypuff': 39, 'Psyduck': 54, 'Growlithe': 58, 'Oddish': 43,
  'Raichu': 26, 'Jolteon': 135
};

// Get Pokemon image URL from PokeAPI sprites
const getPokemonImageUrl = (name) => {
  const pokedexId = pokemonToPokedexId[name];
  if (pokedexId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokedexId}.png`;
  }
  return null;
};

const rarityStyles = {
  Common: 'border-gray-500',
  Uncommon: 'border-green-500',
  Rare: 'border-blue-500',
  Legendary: 'border-yellow-500 shadow-yellow-500/20 shadow-lg',
};

function PokemonCard({ pokemon, listing, auction, dutchAuction, showActions = false, isHot = false, compactCart = false, showBuyOnly = false }) {
  const { tokenId, name, pokemonType, rarity, hp, attack, defense, speed, level, isEgg } = pokemon;
  const typeConfig = typeColors[pokemonType] || typeColors.Normal;
  const TypeIcon = typeConfig.icon;
  const [imageError, setImageError] = useState(false);
  const { addToCart, isInCart } = useCart();
  const { account, tradingContract, triggerRefresh } = useWeb3();
  const navigate = useNavigate();
  const isOwner = listing?.seller?.toLowerCase() === account?.toLowerCase();
  const [isProcessing, setIsProcessing] = useState(false);

  // Get Pokemon image from PokeAPI sprites (IPFS metadata points to these)
  const imageUrl = getPokemonImageUrl(name);

  // Egg display
  if (isEgg) {
    return (
      <div className="relative bg-gray-900 rounded-xl overflow-hidden border-2 border-yellow-500/50 hover:scale-105 transition-transform duration-300">
        <div className="absolute top-2 right-2 z-10">
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-400">
            Egg
          </span>
        </div>
        <div className="h-48 bg-gradient-to-br from-yellow-200 to-yellow-400 flex items-center justify-center relative overflow-hidden">
          <Egg size={64} className="text-white/80 drop-shadow-lg" />
          <div className="absolute inset-0 bg-yellow-300/10 animate-pulse" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Egg</h3>
            <span className="text-sm text-gray-400">#{tokenId}</span>
          </div>
          <p className="text-gray-400 text-sm">Incubating... This egg hasn't hatched yet.</p>
        </div>
      </div>
    );
  }

  const handleCardClick = (e) => {
    // Only navigate if checking details or clicking card body
    // Prevent if clicking specific buttons that handle their own logic
    navigate(`/card/${tokenId}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative bg-gray-900 rounded-xl overflow-hidden border-2 ${rarityStyles[rarity] || 'border-gray-700'} hover:scale-105 transition-transform duration-300 cursor-pointer group`}
    >
      {/* Popular Badge */}
      {isHot && (
        <div className="absolute top-2 left-2 z-10">
          <span className="px-3 py-1.5 text-sm font-bold rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center gap-1 shadow-lg animate-pulse">
            🔥 Popular
          </span>
        </div>
      )}

      {/* Rarity Badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${rarity === 'Legendary' ? 'bg-yellow-500/20 text-yellow-400' :
          rarity === 'Rare' ? 'bg-blue-500/20 text-blue-400' :
            rarity === 'Uncommon' ? 'bg-green-500/20 text-green-400' :
              'bg-gray-500/20 text-gray-400'
          }`}>
          {rarity}
        </span>
      </div>

      {/* Card Image - Uses PokeAPI official artwork (same as IPFS metadata) */}
      <div className={`h-48 bg-gradient-to-br ${typeConfig.bg} flex items-center justify-center relative overflow-hidden`}>
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-40 w-40 object-contain z-10 drop-shadow-lg group-hover:scale-110 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <>
            <TypeIcon size={64} className="text-white/30" />
            <span className="absolute text-6xl font-bold text-white/20">{name.charAt(0)}</span>
          </>
        )}
        {/* Background glow effect for legendary/rare */}
        {(rarity === 'Legendary' || rarity === 'Rare') && (
          <div className={`absolute inset-0 ${rarity === 'Legendary' ? 'bg-yellow-400/10' : 'bg-blue-400/10'} animate-pulse`} />
        )}
      </div>

      {/* Card Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold">{name}</h3>
          <span className="text-sm text-gray-400">#{tokenId}</span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className={`px-2 py-1 text-xs rounded bg-gradient-to-r ${typeConfig.bg}`}>
            {pokemonType}
          </span>
          {level !== undefined && (
            <span className="text-xs font-bold text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
              Lv.{level}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between bg-gray-800 px-2 py-1 rounded">
            <span className="text-gray-400">HP</span>
            <span className="text-red-400 font-semibold">{hp}</span>
          </div>
          <div className="flex justify-between bg-gray-800 px-2 py-1 rounded">
            <span className="text-gray-400">ATK</span>
            <span className="text-orange-400 font-semibold">{attack}</span>
          </div>
          <div className="flex justify-between bg-gray-800 px-2 py-1 rounded">
            <span className="text-gray-400">DEF</span>
            <span className="text-blue-400 font-semibold">{defense}</span>
          </div>
          <div className="flex justify-between bg-gray-800 px-2 py-1 rounded">
            <span className="text-gray-400">SPD</span>
            <span className="text-green-400 font-semibold">{speed}</span>
          </div>
        </div>

        {/* Price/Auction Info */}
        {listing && listing.isActive && (
          <div className="mt-3 pt-3 border-t border-green-500/30 bg-green-500/10 -mx-4 px-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Listed
              </span>
              <span className="text-lg font-bold text-green-400">{listing.price} ETH</span>
            </div>
          </div>
        )}


        {auction && auction.isActive && (
          <div className="mt-3 pt-3 border-t border-orange-500/30 bg-orange-500/10 -mx-4 px-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-orange-400 text-sm font-semibold flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Auction
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-xs">Current Bid</span>
              <span className="text-base font-bold text-orange-400">
                {auction.highestBid > 0 ? `${auction.highestBid} ETH` : 'No bids'}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Reserve: {auction.reservePrice} ETH
            </div>
          </div>
        )}

        {dutchAuction && dutchAuction.isActive && (
          <div className="mt-3 pt-3 border-t border-purple-500/30 bg-purple-500/5 -mx-4 px-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-purple-400 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="width" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                Dutch Auction
              </span>
            </div>
            <div className="text-xs text-gray-400 mb-1">
              {dutchAuction.startingPrice} ETH → {dutchAuction.reservePrice} ETH
            </div>
            <div className="text-xs text-purple-400">
              Price decreasing...
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className="mt-3 space-y-2 relative z-20">
            {/* Buy Now and Add to Cart Buttons (only for fixed-price listings and NOT owner) */}
            {listing && listing.isActive && !isOwner && (
              showBuyOnly ? (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!tradingContract) return;

                    try {
                      setIsProcessing(true);
                      toast.loading('Processing purchase...');
                      const priceWei = ethers.parseEther(listing.price);
                      const tx = await tradingContract.buyCard(tokenId, { value: priceWei });
                      await tx.wait();
                      toast.dismiss();
                      toast.success('Purchase successful!');
                      triggerRefresh();
                    } catch (error) {
                      toast.dismiss();
                      console.error('Failed to buy:', error);
                      toast.error(error.reason || 'Failed to complete purchase');
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white disabled:opacity-50"
                >
                  <Lightning size={18} />
                  {isProcessing ? 'Buying...' : 'Buy Now'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!tradingContract) return;

                      try {
                        setIsProcessing(true);
                        toast.loading('Processing purchase...');
                        const priceWei = ethers.parseEther(listing.price);
                        const tx = await tradingContract.buyCard(tokenId, { value: priceWei });
                        await tx.wait();
                        toast.dismiss();
                        toast.success('Purchase successful!');
                        triggerRefresh();
                      } catch (error) {
                        toast.dismiss();
                        console.error('Failed to buy:', error);
                        toast.error(error.reason || 'Failed to complete purchase');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isProcessing}
                    className="flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white disabled:opacity-50"
                  >
                    <Lightning size={18} />
                    {isProcessing ? 'Buying...' : 'Buy Now'}
                  </button>
                  {compactCart ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToCart({ pokemon, listing, tokenId, name, pokemonType, rarity, hp, attack, defense, speed });
                      }}
                      disabled={isInCart(tokenId)}
                      className={`p-2 rounded-lg transition-all flex items-center justify-center ${isInCart(tokenId)
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      title={isInCart(tokenId) ? 'In Cart' : 'Add to Cart'}
                    >
                      <ShoppingCart size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToCart({ pokemon, listing, tokenId, name, pokemonType, rarity, hp, attack, defense, speed });
                      }}
                      disabled={isInCart(tokenId)}
                      className={`flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${isInCart(tokenId)
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                    >
                      <ShoppingCart size={18} />
                      {isInCart(tokenId) ? 'In Cart' : 'Add to Cart'}
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PokemonCard;
