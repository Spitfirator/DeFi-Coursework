import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Flame, Droplet, Leaf, Brain, Ghost, Mountain, Bug, Star, Egg } from 'lucide-react';

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

function PokemonCard({ pokemon, listing, auction, showActions = false }) {
  const { tokenId, name, pokemonType, rarity, hp, attack, defense, speed, level, isEgg } = pokemon;
  const typeConfig = typeColors[pokemonType] || typeColors.Normal;
  const TypeIcon = typeConfig.icon;
  const [imageError, setImageError] = useState(false);

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

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden border-2 ${rarityStyles[rarity] || 'border-gray-700'} hover:scale-105 transition-transform duration-300`}>
      {/* Rarity Badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          rarity === 'Legendary' ? 'bg-yellow-500/20 text-yellow-400' :
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
            className="h-40 w-40 object-contain z-10 drop-shadow-lg"
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
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Price</span>
              <span className="text-lg font-bold text-primary">{listing.price} ETH</span>
            </div>
          </div>
        )}

        {auction && auction.isActive && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-sm">Current Bid</span>
              <span className="text-lg font-bold text-secondary">
                {auction.highestBid > 0 ? `${auction.highestBid} ETH` : 'No bids'}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Reserve: {auction.reservePrice} ETH
            </div>
          </div>
        )}

        {/* Action Button */}
        {showActions && (
          <Link
            to={`/card/${tokenId}`}
            className="mt-3 block w-full text-center py-2 bg-gradient-to-r from-primary to-secondary rounded-lg hover:opacity-90 transition-opacity"
          >
            View Details
          </Link>
        )}
      </div>
    </div>
  );
}

export default PokemonCard;
