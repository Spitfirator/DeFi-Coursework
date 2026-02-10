import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import PokemonCard from '../components/PokemonCard';
import { Loader, AlertCircle, ArrowRight, ArrowUp, Lock, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

function Evolution() {
  const { pokemonContract, evolutionContract, dayCareContract, account, refreshTrigger, triggerRefresh, blockTime: now } = useWeb3();
  const [eligibleCards, setEligibleCards] = useState([]);
  const [ineligibleCards, setIneligibleCards] = useState([]);
  const [stakedCards, setStakedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [evolutionPreview, setEvolutionPreview] = useState(null);

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
              const pendingLevels = await dayCareContract.getPendingLevels(tokenId);
              const effectiveLevel = Math.min(Number(stats.level) + Number(pendingLevels), 100);
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
                pendingLevels: Number(pendingLevels),
                effectiveLevel,
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
      toast.error('Failed to load data');
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
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <ArrowUp size={24} className="text-purple-400" />
                <span>Ready to Evolve ({eligibleCards.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {eligibleCards.map((card) => (
                  <div key={card.tokenId} className="bg-gray-900 rounded-xl overflow-hidden border-2 border-purple-500/50">
                    {/* Evolution Ready Header */}
                    <div className="bg-purple-500/10 px-4 py-3 border-b border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-purple-400 text-sm font-semibold">Ready to Evolve!</span>
                        <span className="text-purple-400 text-xs">
                          {card.name} → {card.evolutionPath.toName}
                        </span>
                      </div>
                    </div>

                    <PokemonCard pokemon={card} />

                    <div className="px-4 pb-4">
                      <button
                        onClick={() => loadPreview(card)}
                        disabled={isProcessing}
                        className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                      >
                        Evolve to {card.evolutionPath.toName}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Currently Staking at Day Care */}
          {stakedCards.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <Clock size={24} className="text-cyan-400" />
                <span>Training at Day Care ({stakedCards.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {stakedCards.map((card) => {
                  const meetsThreshold = card.effectiveLevel >= card.evolutionPath.levelThreshold;
                  const elapsed = now ? now - card.stakeTimestamp : 0;
                  const hours = Math.floor(elapsed / 3600);
                  const minutes = Math.floor((elapsed % 3600) / 60);
                  const seconds = elapsed % 60;
                  return (
                    <div key={card.tokenId} className="relative">
                      <div className="opacity-85">
                        <PokemonCard pokemon={{ ...card, level: card.effectiveLevel }} />
                      </div>
                      {/* Staking Info Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 px-4 py-3 rounded-b-xl">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-400">
                            {card.name} → {card.evolutionPath.toName}
                          </span>
                          <span className={meetsThreshold ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                            Lv.{card.effectiveLevel}/{card.evolutionPath.levelThreshold}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                          <div
                            className={`h-1.5 rounded-full ${meetsThreshold ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-yellow-400 to-yellow-600'}`}
                            style={{ width: `${Math.min((card.effectiveLevel / card.evolutionPath.levelThreshold) * 100, 100)}%` }}
                          ></div>
                        </div>
                        {card.pendingLevels > 0 && (
                          <div className="text-xs text-cyan-400 mb-1">
                            +{card.pendingLevels} levels gained ({hours > 0 ? `${hours}h ` : ''}{minutes}m {seconds}s staked)
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {meetsThreshold ? 'Unstake to evolve!' : 'Still training...'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Not Yet Eligible */}
          {ineligibleCards.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <Lock size={24} className="text-gray-500" />
                <span>Needs More Training ({ineligibleCards.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {ineligibleCards.map((card) => (
                  <div key={card.tokenId} className="relative">
                    <div className="opacity-75">
                      <PokemonCard pokemon={card} />
                    </div>
                    {/* Level Requirement Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 px-4 py-3 rounded-b-xl">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">
                          {card.name} → {card.evolutionPath.toName}
                        </span>
                        <span className="text-yellow-400 font-semibold">
                          Lv.{card.level}/{card.evolutionPath.levelThreshold}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min((card.level / card.evolutionPath.levelThreshold) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
