import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import PokemonCard from '../components/PokemonCard';
import { Loader, AlertCircle, Heart, Egg, Clock, Sparkles, X, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

function Hatchery() {
  const {
    pokemonContract, hatcheryContract, account,
    refreshTrigger, triggerRefresh, HATCHERY_ADDRESS, blockTime: now
  } = useWeb3();

  const [myCards, setMyCards] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedParent1, setSelectedParent1] = useState(null);
  const [selectedParent2, setSelectedParent2] = useState(null);
  const [showParents, setShowParents] = useState(true);
  const [showBreeding, setShowBreeding] = useState(true);
  const [showIncubating, setShowIncubating] = useState(true);
  const [showHatched, setShowHatched] = useState(true);

  const loadData = useCallback(async () => {
    if (!pokemonContract || !hatcheryContract || !account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load user's available Pokemon (exclude eggs and locked tokens)
      const balance = await pokemonContract.balanceOf(account);
      const cards = [];
      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await pokemonContract.tokenOfOwnerByIndex(account, i);
        const stats = await pokemonContract.getPokemonStats(tokenId);
        const isLocked = await hatcheryContract.isTokenLocked(tokenId);

        if (!stats.isEgg && !isLocked && stats.rarity !== 'Legendary') {
          cards.push({
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
            isEgg: stats.isEgg
          });
        }
      }
      setMyCards(cards);

      // Load user's breeding sessions
      const sessionIds = await hatcheryContract.getUserSessions(account);
      const sessionData = [];
      for (const id of sessionIds) {
        const session = await hatcheryContract.getSession(id);
        const sessionObj = {
          sessionId: Number(id),
          originalOwner: session.originalOwner,
          parent1Id: Number(session.parent1Id),
          parent2Id: Number(session.parent2Id),
          parent1Name: session.parent1.name,
          parent2Name: session.parent2.name,
          parent1Type: session.parent1.pokemonType,
          parent2Type: session.parent2.pokemonType,
          eggTokenId: Number(session.eggTokenId),
          breedReadyTimestamp: Number(session.breedReadyTimestamp),
          hatchReadyTimestamp: Number(session.hatchReadyTimestamp),
          eggMinted: session.eggMinted,
          hatched: session.hatched,
          active: session.active
        };

        // If hatched, load the hatched Pokemon's stats
        if (session.hatched && session.eggMinted) {
          try {
            const hatchedStats = await pokemonContract.getPokemonStats(session.eggTokenId);
            sessionObj.hatchedPokemon = {
              tokenId: Number(session.eggTokenId),
              name: hatchedStats.name,
              pokemonType: hatchedStats.pokemonType,
              rarity: hatchedStats.rarity,
              hp: Number(hatchedStats.hp),
              attack: Number(hatchedStats.attack),
              defense: Number(hatchedStats.defense),
              speed: Number(hatchedStats.speed),
              generation: Number(hatchedStats.generation),
              level: Number(hatchedStats.level)
            };
          } catch {
            // Token may have been transferred/burned
          }
        }

        sessionData.push(sessionObj);
      }
      setSessions(sessionData.reverse()); // Newest first
    } catch (error) {
      console.error('Failed to load hatchery data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [pokemonContract, hatcheryContract, account]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleSelectParent = (card) => {
    if (!selectedParent1) {
      setSelectedParent1(card);
    } else if (selectedParent1.tokenId === card.tokenId) {
      setSelectedParent1(null);
    } else if (!selectedParent2) {
      setSelectedParent2(card);
    } else if (selectedParent2.tokenId === card.tokenId) {
      setSelectedParent2(null);
    } else {
      // Replace parent 2
      setSelectedParent2(card);
    }
  };

  const handleBreed = async () => {
    if (!hatcheryContract || !pokemonContract || !selectedParent1 || !selectedParent2) return;

    try {
      setIsProcessing(true);

      // Check approval
      const isApproved = await pokemonContract.isApprovedForAll(account, HATCHERY_ADDRESS);
      if (!isApproved) {
        toast.loading('Approving Hatchery contract...');
        const approveTx = await pokemonContract.setApprovalForAll(HATCHERY_ADDRESS, true);
        await approveTx.wait();
        toast.dismiss();
      }

      toast.loading('Starting breeding session...');
      const tx = await hatcheryContract.breed(selectedParent1.tokenId, selectedParent2.tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success('Breeding session started! Parents are now in escrow.');
      setSelectedParent1(null);
      setSelectedParent2(null);
      triggerRefresh();
      loadData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to breed:', error);
      toast.error(error.reason || 'Failed to start breeding');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMintEgg = async (sessionId) => {
    if (!hatcheryContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Minting egg and releasing parents...');
      const tx = await hatcheryContract.mintEgg(sessionId);
      await tx.wait();

      toast.dismiss();
      toast.success('Egg minted! Parents have been released. Incubation started.');
      triggerRefresh();
      loadData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to mint egg:', error);
      toast.error(error.reason || 'Failed to mint egg');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHatch = async (sessionId) => {
    if (!hatcheryContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Hatching egg...');
      const tx = await hatcheryContract.hatch(sessionId);
      await tx.wait();

      toast.dismiss();
      toast.success('Your egg has hatched into a new Pokemon!');
      triggerRefresh();
      loadData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to hatch:', error);
      toast.error(error.reason || 'Failed to hatch egg');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCountdown = (hatchReadyTimestamp) => {
    const remaining = Math.max(0, hatchReadyTimestamp - now);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Categorize sessions
  const awaitingEgg = sessions.filter(s => s.active && !s.eggMinted);
  const incubating = sessions.filter(s => s.eggMinted && !s.hatched);
  const hatched = sessions.filter(s => s.hatched);

  if (!account) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to use the Hatchery</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Hatchery</h1>
        <p className="text-gray-400">
          Breed two Pokemon to create a new egg. Parents are locked for 15 seconds during breeding,
          then the egg incubates for another 15 seconds before hatching.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      ) : (
        <>
          {/* Parent Selection Area */}
          <div className="mb-12">
            <button onClick={() => setShowParents(!showParents)} className="flex items-center space-x-2 mb-4 w-full group cursor-pointer">
              <Heart size={24} className="text-pink-400" />
              <h2 className="text-xl font-semibold">Select Two Parents</h2>
              <ChevronDown size={20} className={`text-gray-400 group-hover:text-white transition-transform duration-200 ml-auto ${showParents ? '' : '-rotate-90'}`} />
            </button>

            {showParents && <>{/* Selected Parents Preview */}
            <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Parent 1 */}
                <div className={`rounded-xl p-4 border-2 border-dashed ${selectedParent1 ? 'border-pink-500 bg-pink-500/5' : 'border-gray-700'}`}>
                  {selectedParent1 ? (
                    <div className="relative">
                      <button
                        onClick={() => setSelectedParent1(null)}
                        className="absolute -top-2 -right-2 z-10 bg-red-500 rounded-full p-1 hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                      <PokemonCard pokemon={selectedParent1} />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Heart size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Select Parent 1</p>
                    </div>
                  )}
                </div>

                {/* Heart / Breed Button */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-4xl">+</div>
                  <button
                    onClick={handleBreed}
                    disabled={!selectedParent1 || !selectedParent2 || isProcessing}
                    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Heart size={20} />
                    <span>{isProcessing ? 'Processing...' : 'Breed'}</span>
                  </button>
                </div>

                {/* Parent 2 */}
                <div className={`rounded-xl p-4 border-2 border-dashed ${selectedParent2 ? 'border-pink-500 bg-pink-500/5' : 'border-gray-700'}`}>
                  {selectedParent2 ? (
                    <div className="relative">
                      <button
                        onClick={() => setSelectedParent2(null)}
                        className="absolute -top-2 -right-2 z-10 bg-red-500 rounded-full p-1 hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                      <PokemonCard pokemon={selectedParent2} />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Heart size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Select Parent 2</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Available Pokemon Grid */}
            {myCards.length > 0 ? (
              <>
                <h3 className="text-lg font-semibold mb-3 text-gray-300">
                  Available Pokemon ({myCards.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {myCards.map((card) => {
                    const isSelected = (selectedParent1 && selectedParent1.tokenId === card.tokenId) ||
                                       (selectedParent2 && selectedParent2.tokenId === card.tokenId);
                    return (
                      <div
                        key={card.tokenId}
                        onClick={() => !isSelected && handleSelectParent(card)}
                        className={`relative cursor-pointer transition-all ${
                          isSelected
                            ? 'ring-2 ring-pink-500 rounded-xl opacity-60'
                            : 'hover:ring-2 hover:ring-pink-500/50 rounded-xl'
                        }`}
                      >
                        <PokemonCard pokemon={card} disableNavigation />
                        {isSelected && (
                          <div className="absolute top-2 left-2 z-10 bg-pink-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                            Selected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No available Pokemon for breeding. Your Pokemon may be staked, locked, or eggs.</p>
              </div>
            )}
          </>}
          </div>

          {/* Awaiting Egg Mint Sessions */}
          {awaitingEgg.length > 0 && (
            <div className="mb-12">
              <button onClick={() => setShowBreeding(!showBreeding)} className="flex items-center space-x-2 mb-4 w-full group cursor-pointer">
                <Heart size={24} className="text-red-400 animate-pulse" />
                <h2 className="text-xl font-semibold">Breeding in Progress ({awaitingEgg.length})</h2>
                <ChevronDown size={20} className={`text-gray-400 group-hover:text-white transition-transform duration-200 ml-auto ${showBreeding ? '' : '-rotate-90'}`} />
              </button>
              {showBreeding && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {awaitingEgg.map((session) => {
                  const breedReady = now >= session.breedReadyTimestamp;
                  return (
                    <div key={session.sessionId} className="bg-gray-900 rounded-xl p-6 border border-pink-500/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">Session #{session.sessionId}</h3>
                        <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
                          breedReady
                            ? 'text-green-400 bg-green-500/10'
                            : 'text-pink-400 bg-pink-500/10'
                        }`}>
                          {breedReady ? 'Ready to Mint!' : 'Breeding...'}
                        </span>
                      </div>
                      <div className="flex items-center justify-center space-x-4 mb-4">
                        <div className="text-center">
                          <p className="text-gray-400 text-xs mb-1">Parent 1</p>
                          <p className="font-semibold">{session.parent1Name}</p>
                          <p className="text-gray-500 text-xs">#{session.parent1Id}</p>
                        </div>
                        <Heart size={24} className="text-pink-400 animate-pulse" />
                        <div className="text-center">
                          <p className="text-gray-400 text-xs mb-1">Parent 2</p>
                          <p className="font-semibold">{session.parent2Name}</p>
                          <p className="text-gray-500 text-xs">#{session.parent2Id}</p>
                        </div>
                      </div>
                      {!breedReady && (
                        <div className="flex items-center justify-center space-x-2 mb-4">
                          <Clock size={16} className="text-pink-400" />
                          <span className="text-pink-400 font-mono text-2xl font-bold">
                            {formatCountdown(session.breedReadyTimestamp)}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => handleMintEgg(session.sessionId)}
                        disabled={!breedReady || isProcessing}
                        className={`w-full py-3 rounded-lg font-semibold transition-opacity disabled:opacity-50 ${
                          breedReady
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90'
                            : 'bg-gray-700 cursor-not-allowed'
                        }`}
                      >
                        {isProcessing ? 'Processing...' : breedReady ? 'Mint Egg & Release Parents' : 'Breeding in Progress...'}
                      </button>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Incubating Eggs */}
          {incubating.length > 0 && (
            <div className="mb-12">
              <button onClick={() => setShowIncubating(!showIncubating)} className="flex items-center space-x-2 mb-4 w-full group cursor-pointer">
                <Egg size={24} className="text-yellow-400" />
                <h2 className="text-xl font-semibold">Incubating Eggs ({incubating.length})</h2>
                <ChevronDown size={20} className={`text-gray-400 group-hover:text-white transition-transform duration-200 ml-auto ${showIncubating ? '' : '-rotate-90'}`} />
              </button>
              {showIncubating && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {incubating.map((session) => {
                  const isReady = now >= session.hatchReadyTimestamp;
                  return (
                    <div
                      key={session.sessionId}
                      className={`bg-gray-900 rounded-xl p-6 border ${
                        isReady ? 'border-green-500/50 animate-pulse' : 'border-yellow-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">Egg #{session.eggTokenId}</h3>
                        <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
                          isReady
                            ? 'text-green-400 bg-green-500/10'
                            : 'text-yellow-400 bg-yellow-500/10'
                        }`}>
                          {isReady ? 'Ready!' : 'Incubating...'}
                        </span>
                      </div>

                      {/* Egg Visual */}
                      <div className="flex items-center justify-center py-6">
                        <div className={`w-24 h-28 rounded-full bg-gradient-to-b from-white to-gray-200 flex items-center justify-center ${
                          isReady ? 'animate-bounce' : ''
                        }`}>
                          <Egg size={40} className={isReady ? 'text-green-600' : 'text-yellow-600'} />
                        </div>
                      </div>

                      <div className="text-center mb-4">
                        <p className="text-gray-400 text-sm mb-1">Parents: {session.parent1Name} + {session.parent2Name}</p>
                        {!isReady && (
                          <div className="flex items-center justify-center space-x-2 mt-2">
                            <Clock size={16} className="text-yellow-400" />
                            <span className="text-yellow-400 font-mono text-2xl font-bold">
                              {formatCountdown(session.hatchReadyTimestamp)}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleHatch(session.sessionId)}
                        disabled={!isReady || isProcessing}
                        className={`w-full py-3 rounded-lg font-semibold transition-opacity disabled:opacity-50 ${
                          isReady
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90'
                            : 'bg-gray-700 cursor-not-allowed'
                        }`}
                      >
                        {isProcessing ? 'Processing...' : isReady ? 'HATCH NOW!' : 'Incubating...'}
                      </button>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Hatched Pokemon */}
          {hatched.length > 0 && (
            <div className="mb-12">
              <button onClick={() => setShowHatched(!showHatched)} className="flex items-center space-x-2 mb-4 w-full group cursor-pointer">
                <Sparkles size={24} className="text-green-400" />
                <h2 className="text-xl font-semibold">Hatched Pokemon ({hatched.length})</h2>
                <ChevronDown size={20} className={`text-gray-400 group-hover:text-white transition-transform duration-200 ml-auto ${showHatched ? '' : '-rotate-90'}`} />
              </button>
              {showHatched && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {hatched.map((session) => (
                  <div key={session.sessionId} className="bg-gray-900 rounded-xl overflow-hidden border-2 border-green-500/30">
                    <div className="bg-green-500/10 px-4 py-2 border-b border-green-500/20">
                      <div className="flex items-center space-x-2">
                        <Check size={16} className="text-green-400" />
                        <span className="text-green-400 text-sm font-semibold">
                          Hatched from {session.parent1Name} + {session.parent2Name}
                        </span>
                      </div>
                    </div>
                    {session.hatchedPokemon ? (
                      <PokemonCard pokemon={session.hatchedPokemon} showActions={true} />
                    ) : (
                      <div className="p-6 text-center text-gray-400">
                        <p>Token #{session.eggTokenId}</p>
                        <p className="text-sm">Pokemon may have been transferred</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>}
            </div>
          )}

          {/* Empty State */}
          {sessions.length === 0 && myCards.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Egg size={32} className="text-gray-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Pokemon Available</h2>
              <p className="text-gray-400">You need at least 2 Pokemon to start breeding</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Hatchery;
