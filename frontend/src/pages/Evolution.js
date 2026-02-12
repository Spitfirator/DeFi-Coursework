import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { Loader, AlertCircle, ArrowRight, ArrowUp, Lock, Clock, ChevronDown, Zap, Flame, Droplet, Leaf, Brain, Ghost, Mountain, Bug, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { isStaleBlockError, STALE_BLOCK_MESSAGE } from '../utils/errors';

const typeColors = {
  Normal:   { from: '#A8A77A', to: '#ACAD99', icon: Star },
  Fire:     { from: '#EE8130', to: '#E87A3D', icon: Flame },
  Water:    { from: '#6390F0', to: '#639CE4', icon: Droplet },
  Electric: { from: '#F7D02C', to: '#E7C536', icon: Zap },
  Grass:    { from: '#7AC74C', to: '#82C95B', icon: Leaf },
  Ice:      { from: '#96D9D6', to: '#81CFD7', icon: Droplet },
  Fighting: { from: '#C22E28', to: '#C45D4C', icon: Zap },
  Poison:   { from: '#A33EA1', to: '#B369AF', icon: Bug },
  Ground:   { from: '#E2BF65', to: '#CEB250', icon: Mountain },
  Flying:   { from: '#A98FF3', to: '#90AAD7', icon: Leaf },
  Psychic:  { from: '#F95587', to: '#E96C95', icon: Brain },
  Bug:      { from: '#A6B91A', to: '#ACC23E', icon: Bug },
  Rock:     { from: '#B6A136', to: '#BAA85E', icon: Mountain },
  Ghost:    { from: '#735797', to: '#816DB6', icon: Ghost },
  Dragon:   { from: '#6F35FC', to: '#8572C8', icon: Flame },
  Dark:     { from: '#705746', to: '#79726B', icon: Ghost },
  Steel:    { from: '#B7B7CE', to: '#9FA9AF', icon: Star },
  Fairy:    { from: '#D685AD', to: '#E8B0EB', icon: Star },
};

const pokemonToPokedexId = {
  // Legendaries
  'Mewtwo': 150, 'Lugia': 249, 'Rayquaza': 384, 'Arceus': 493, 'Giratina': 487,
  // Fully evolved (in collection)
  'Charizard': 6, 'Blastoise': 9, 'Venusaur': 3, 'Gengar': 94, 'Dragonite': 149,
  'Gyarados': 130, 'Alakazam': 65, 'Machamp': 68, 'Snorlax': 143, 'Arcanine': 59,
  'Lapras': 131, 'Tyranitar': 248, 'Metagross': 376, 'Salamence': 373, 'Garchomp': 445,
  // Base forms (in collection)
  'Pikachu': 25, 'Bulbasaur': 1, 'Charmander': 4, 'Squirtle': 7, 'Pidgey': 16,
  'Rattata': 19, 'Zubat': 41, 'Geodude': 74, 'Magikarp': 129, 'Caterpie': 10,
  'Eevee': 133, 'Jigglypuff': 39, 'Psyduck': 54, 'Growlithe': 58, 'Oddish': 43,
  // Evolved forms (from evolution chains)
  'Raichu': 26, 'Jolteon': 135,
  'Ivysaur': 2, 'Charmeleon': 5, 'Wartortle': 8,
  'Metapod': 11, 'Butterfree': 12,
  'Pidgeotto': 17, 'Pidgeot': 18,
  'Raticate': 20, 'Golduck': 55, 'Wigglytuff': 40,
  'Golbat': 42, 'Crobat': 169,
  'Gloom': 44, 'Vileplume': 45,
  'Graveler': 75, 'Golem': 76,
};

const getPokemonImageUrl = (name) => {
  const pokedexId = pokemonToPokedexId[name];
  if (pokedexId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokedexId}.png`;
  }
  return null;
};

function Evolution() {
  const { pokemonContract, evolutionContract, dayCareContract, account, refreshTrigger, triggerRefresh, blockTime: now } = useWeb3();
  const [eligibleCards, setEligibleCards] = useState([]);
  const [ineligibleCards, setIneligibleCards] = useState([]);
  const [stakedCards, setStakedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [evolutionPreview, setEvolutionPreview] = useState(null);
  const [showEligible, setShowEligible] = useState(true);
  const [showStaked, setShowStaked] = useState(true);
  const [showIneligible, setShowIneligible] = useState(true);

  const loadData = useCallback(async () => {
    if (!pokemonContract || !evolutionContract || !account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const balance = await pokemonContract.balanceOf(account);
      const eligible = [];
      const ineligible = [];

      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await pokemonContract.tokenOfOwnerByIndex(account, i);
        const stats = await pokemonContract.getPokemonStats(tokenId);

        const pokemonData = {
          tokenId: Number(tokenId),
          name: stats.name,
          pokemonType: stats.pokemonType,
          rarity: stats.rarity,
          hp: Number(stats.hp),
          attack: Number(stats.attack),
          defense: Number(stats.defense),
          speed: Number(stats.speed),
          generation: Number(stats.generation),
          level: Number(stats.level)
        };

        // Check if this Pokemon has an evolution path
        try {
          const canEvolve = await evolutionContract.canEvolve(tokenId);
          const path = await evolutionContract.getEvolutionPath(stats.name);

          if (path.exists) {
            pokemonData.evolutionPath = {
              toName: path.toName,
              toType: path.toType,
              toRarity: path.toRarity,
              levelThreshold: Number(path.levelThreshold),
              hpBoost: Number(path.hpBoost),
              attackBoost: Number(path.attackBoost),
              defenseBoost: Number(path.defenseBoost),
              speedBoost: Number(path.speedBoost)
            };

            if (canEvolve) {
              eligible.push(pokemonData);
            } else {
              ineligible.push(pokemonData);
            }
          }
        } catch {
          // No evolution path for this Pokemon - skip it
        }
      }

      setEligibleCards(eligible);
      setIneligibleCards(ineligible);

      // Load YOUR staked Pokemon that have evolution paths
      const staked = [];
      if (dayCareContract) {
        const stakedTokenIds = await dayCareContract.getStakedTokens(account);
        for (const tokenId of stakedTokenIds) {
          const stats = await pokemonContract.getPokemonStats(tokenId);
          try {
            const path = await evolutionContract.getEvolutionPath(stats.name);
            if (path.exists) {
              const stakeInfo = await dayCareContract.getStakeInfo(tokenId);
              const levelAtStake = Number(stakeInfo.levelAtStake);
              staked.push({
                tokenId: Number(tokenId),
                name: stats.name,
                pokemonType: stats.pokemonType,
                rarity: stats.rarity,
                hp: Number(stats.hp),
                attack: Number(stats.attack),
                defense: Number(stats.defense),
                speed: Number(stats.speed),
                generation: Number(stats.generation),
                level: Number(stats.level),
                levelAtStake,
                stakeTimestamp: Number(stakeInfo.stakeTimestamp),
                evolutionPath: {
                  toName: path.toName,
                  toType: path.toType,
                  toRarity: path.toRarity,
                  levelThreshold: Number(path.levelThreshold),
                  hpBoost: Number(path.hpBoost),
                  attackBoost: Number(path.attackBoost),
                  defenseBoost: Number(path.defenseBoost),
                  speedBoost: Number(path.speedBoost)
                }
              });
            }
          } catch {
            // No evolution path - skip
          }
        }
      }
      setStakedCards(staked);
    } catch (error) {
      console.error('Failed to load evolution data:', error);
      toast.error(isStaleBlockError(error) ? STALE_BLOCK_MESSAGE : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [pokemonContract, evolutionContract, dayCareContract, account]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const loadPreview = async (card) => {
    if (!evolutionContract) return;

    try {
      const preview = await evolutionContract.getEvolutionPreview(card.tokenId);
      setEvolutionPreview({
        newName: preview.newName,
        newType: preview.newType,
        newRarity: preview.newRarity,
        newHp: Number(preview.newHp),
        newAttack: Number(preview.newAttack),
        newDefense: Number(preview.newDefense),
        newSpeed: Number(preview.newSpeed),
        levelRequired: Number(preview.levelRequired)
      });
      setSelectedCard(card);
    } catch (error) {
      console.error('Failed to load preview:', error);
      toast.error('Failed to load evolution preview');
    }
  };

  const handleEvolve = async () => {
    if (!evolutionContract || !selectedCard) return;

    try {
      setIsProcessing(true);
      toast.loading('Evolving Pokemon...');

      const tx = await evolutionContract.evolve(selectedCard.tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success(`${selectedCard.name} evolved into ${evolutionPreview.newName}!`);
      setSelectedCard(null);
      setEvolutionPreview(null);
      triggerRefresh();
      loadData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to evolve:', error);
      toast.error(error.reason || 'Failed to evolve Pokemon');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!account) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to use Evolution</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Evolution Lab</h1>
        <p className="text-gray-400">
          Evolve your Pokemon into their stronger forms. Level up at the Day Care to meet evolution thresholds!
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      ) : (
        <>
          {/* Evolution Preview Modal */}
          {selectedCard && evolutionPreview && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 rounded-2xl p-6 max-w-4xl w-full">
                <h2 className="text-2xl font-bold text-center mb-6">Evolution Preview</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* Before */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-3 text-gray-400">Before</h3>
                    <div className="bg-gray-800 rounded-xl p-4">
                      <div className="text-2xl font-bold mb-2">{selectedCard.name}</div>
                      <div className="text-sm text-gray-400 mb-3">{selectedCard.pokemonType} - {selectedCard.rarity}</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Level</span>
                          <span className="text-yellow-400 font-bold">{selectedCard.level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">HP</span>
                          <span className="text-red-400">{selectedCard.hp}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">ATK</span>
                          <span className="text-orange-400">{selectedCard.attack}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">DEF</span>
                          <span className="text-blue-400">{selectedCard.defense}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">SPD</span>
                          <span className="text-green-400">{selectedCard.speed}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex flex-col items-center justify-center">
                    <ArrowRight size={48} className="text-purple-400 hidden md:block" />
                    <div className="md:hidden text-center text-purple-400 text-2xl mb-2">&#8595;</div>
                    <div className="text-sm text-purple-400 font-semibold mt-2">EVOLVE</div>
                  </div>

                  {/* After */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-3 text-purple-400">After</h3>
                    <div className="bg-gray-800 rounded-xl p-4 border border-purple-500/30">
                      <div className="text-2xl font-bold mb-2 text-purple-400">{evolutionPreview.newName}</div>
                      <div className="text-sm text-gray-400 mb-3">{evolutionPreview.newType} - {evolutionPreview.newRarity}</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Level</span>
                          <span className="text-yellow-400 font-bold">{selectedCard.level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">HP</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-red-400">{evolutionPreview.newHp}</span>
                            <span className="text-green-400 text-xs">(+{selectedCard.evolutionPath.hpBoost})</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">ATK</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-orange-400">{evolutionPreview.newAttack}</span>
                            <span className="text-green-400 text-xs">(+{selectedCard.evolutionPath.attackBoost})</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">DEF</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-blue-400">{evolutionPreview.newDefense}</span>
                            <span className="text-green-400 text-xs">(+{selectedCard.evolutionPath.defenseBoost})</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">SPD</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-green-400">{evolutionPreview.newSpeed}</span>
                            <span className="text-green-400 text-xs">(+{selectedCard.evolutionPath.speedBoost})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={() => { setSelectedCard(null); setEvolutionPreview(null); }}
                    className="flex-1 py-3 bg-gray-800 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEvolve}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isProcessing ? 'Evolving...' : 'Confirm Evolution'}
                  </button>
                </div>

                <p className="text-center text-gray-500 text-xs mt-3">
                  Warning: This will burn your current NFT and mint a new evolved one. This action is irreversible.
                </p>
              </div>
            </div>
          )}

          {/* Ready to Evolve */}
          {eligibleCards.length > 0 && (
            <div className="mb-12">
              <button onClick={() => setShowEligible(!showEligible)} className="flex items-center space-x-2 mb-4 w-full group cursor-pointer">
                <ArrowUp size={24} className="text-purple-400" />
                <h2 className="text-xl font-semibold">Ready to Evolve ({eligibleCards.length})</h2>
                <ChevronDown size={20} className={`text-gray-400 group-hover:text-white transition-transform duration-200 ml-auto ${showEligible ? '' : '-rotate-90'}`} />
              </button>
              {showEligible && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {eligibleCards.map((card) => {
                  const typeConfig = typeColors[card.pokemonType] || typeColors.Normal;
                  const imageUrl = getPokemonImageUrl(card.name);
                  return (
                    <div key={card.tokenId} className="bg-gray-900 rounded-xl overflow-hidden border-2 border-purple-500/50">
                      <div className="h-32 flex items-center justify-center relative overflow-hidden" style={{ background: `linear-gradient(to bottom, ${typeConfig.from} 0%, ${typeConfig.to} 50%, #111827 100%)` }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={card.name} className="h-28 w-28 object-contain z-10 drop-shadow-lg" />
                        ) : (
                          <typeConfig.icon size={48} className="text-white/30" />
                        )}
                        <div className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold rounded-full bg-black/40 text-yellow-400">
                          Lv.{card.level}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-white">{card.name}</h3>
                          <span className="text-xs text-gray-500">#{card.tokenId}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                          <span className="px-1.5 py-0.5 rounded text-white" style={{ background: `linear-gradient(to right, ${typeConfig.from}, ${typeConfig.to})` }}>{card.pokemonType}</span>
                          <span>{card.rarity}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-400">Level</span>
                          <span className="text-green-400 font-semibold">
                            {card.level} / {card.evolutionPath.levelThreshold}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
                          <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }} />
                        </div>
                        <div className="text-xs text-purple-400 text-center mb-3">
                          Evolves into <span className="font-semibold">{card.evolutionPath.toName}</span>
                        </div>
                        <button
                          onClick={() => loadPreview(card)}
                          disabled={isProcessing}
                          className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                        >
                          Evolve Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Currently Staking at Day Care */}
          {stakedCards.length > 0 && (
            <div className="mb-12">
              <button onClick={() => setShowStaked(!showStaked)} className="flex items-center space-x-2 mb-4 w-full group cursor-pointer">
                <Clock size={24} className="text-cyan-400" />
                <h2 className="text-xl font-semibold">Training at Day Care ({stakedCards.length})</h2>
                <ChevronDown size={20} className={`text-gray-400 group-hover:text-white transition-transform duration-200 ml-auto ${showStaked ? '' : '-rotate-90'}`} />
              </button>
              {showStaked && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {stakedCards.map((card) => {
                  const elapsed = now ? now - card.stakeTimestamp : 0;
                  const liveLevel = Math.min(card.levelAtStake + Math.floor(elapsed / 2), 100);
                  const livePendingLevels = liveLevel - card.levelAtStake;
                  const meetsThreshold = liveLevel >= card.evolutionPath.levelThreshold;
                  const hours = Math.floor(elapsed / 3600);
                  const minutes = Math.floor((elapsed % 3600) / 60);
                  const seconds = elapsed % 60;
                  const typeConfig = typeColors[card.pokemonType] || typeColors.Normal;
                  const imageUrl = getPokemonImageUrl(card.name);
                  const progress = Math.min((liveLevel / card.evolutionPath.levelThreshold) * 100, 100);
                  return (
                    <div key={card.tokenId} className="bg-gray-900 rounded-xl overflow-hidden border-2 border-cyan-500/30">
                      <div className="h-32 flex items-center justify-center relative overflow-hidden opacity-90" style={{ background: `linear-gradient(to bottom, ${typeConfig.from} 0%, ${typeConfig.to} 50%, #111827 100%)` }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={card.name} className="h-28 w-28 object-contain z-10 drop-shadow-lg" />
                        ) : (
                          <typeConfig.icon size={48} className="text-white/30" />
                        )}
                        <div className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold rounded-full bg-black/40 text-cyan-400">
                          Lv.{liveLevel}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-white">{card.name}</h3>
                          <span className="text-xs text-gray-500">#{card.tokenId}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                          <span className="px-1.5 py-0.5 rounded text-white" style={{ background: `linear-gradient(to right, ${typeConfig.from}, ${typeConfig.to})` }}>{card.pokemonType}</span>
                          <span>{card.rarity}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-400">Level</span>
                          <span className={`font-semibold ${meetsThreshold ? 'text-green-400' : 'text-yellow-400'}`}>
                            {liveLevel} / {card.evolutionPath.levelThreshold}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
                          <div
                            className={`h-1.5 rounded-full ${meetsThreshold ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-cyan-400 to-cyan-600'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-center mb-2">
                          <span className="text-gray-400">Evolves into </span>
                          <span className="text-purple-400 font-semibold">{card.evolutionPath.toName}</span>
                        </div>
                        {livePendingLevels > 0 && (
                          <div className="text-xs text-cyan-400 text-center mb-1">
                            +{livePendingLevels} levels gained ({hours > 0 ? `${hours}h ` : ''}{minutes}m {seconds}s staked)
                          </div>
                        )}
                        <div className="text-xs text-center font-medium mt-2">
                          {meetsThreshold
                            ? <span className="text-green-400">Unstake to evolve!</span>
                            : <span className="text-gray-500">Still training...</span>
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Not Yet Eligible */}
          {ineligibleCards.length > 0 && (
            <div>
              <button onClick={() => setShowIneligible(!showIneligible)} className="flex items-center space-x-2 mb-4 w-full group cursor-pointer">
                <Lock size={24} className="text-gray-500" />
                <h2 className="text-xl font-semibold">Needs More Training ({ineligibleCards.length})</h2>
                <ChevronDown size={20} className={`text-gray-400 group-hover:text-white transition-transform duration-200 ml-auto ${showIneligible ? '' : '-rotate-90'}`} />
              </button>
              {showIneligible && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {ineligibleCards.map((card) => {
                  const typeConfig = typeColors[card.pokemonType] || typeColors.Normal;
                  const imageUrl = getPokemonImageUrl(card.name);
                  const progress = Math.min((card.level / card.evolutionPath.levelThreshold) * 100, 100);
                  const levelsNeeded = card.evolutionPath.levelThreshold - card.level;
                  return (
                    <div key={card.tokenId} className="bg-gray-900 rounded-xl overflow-hidden border-2 border-gray-700">
                      <div className="h-32 flex items-center justify-center relative overflow-hidden opacity-75" style={{ background: `linear-gradient(to bottom, ${typeConfig.from} 0%, ${typeConfig.to} 50%, #111827 100%)` }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={card.name} className="h-28 w-28 object-contain z-10 drop-shadow-lg" />
                        ) : (
                          <typeConfig.icon size={48} className="text-white/30" />
                        )}
                        <div className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold rounded-full bg-black/40 text-yellow-400">
                          Lv.{card.level}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-white">{card.name}</h3>
                          <span className="text-xs text-gray-500">#{card.tokenId}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                          <span className="px-1.5 py-0.5 rounded text-white" style={{ background: `linear-gradient(to right, ${typeConfig.from}, ${typeConfig.to})` }}>{card.pokemonType}</span>
                          <span>{card.rarity}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-400">Level</span>
                          <span className="text-yellow-400 font-semibold">
                            {card.level} / {card.evolutionPath.levelThreshold}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
                          <div
                            className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-1.5 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-center">
                          <span className="text-gray-400">Evolves into </span>
                          <span className="text-purple-400 font-semibold">{card.evolutionPath.toName}</span>
                        </div>
                        <div className="text-xs text-gray-500 text-center mt-1">
                          Needs {levelsNeeded} more level{levelsNeeded !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* No Evolvable Pokemon */}
          {eligibleCards.length === 0 && ineligibleCards.length === 0 && stakedCards.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowUp size={32} className="text-gray-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Evolvable Pokemon</h2>
              <p className="text-gray-400">
                None of your Pokemon have registered evolution paths. Try getting Bulbasaur, Charmander, Squirtle, or Magikarp!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Evolution;
