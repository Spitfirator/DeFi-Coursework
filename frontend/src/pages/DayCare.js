import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import PokemonCard from '../components/PokemonCard';

import { useNavigate } from 'react-router-dom';
import { Loader, AlertCircle, Clock, ArrowRight, ArrowUp, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

function DayCare() {
  const navigate = useNavigate();
  const { pokemonContract, dayCareContract, account, refreshTrigger, triggerRefresh, DAYCARE_ADDRESS, blockTime: now } = useWeb3();
  const [myCards, setMyCards] = useState([]);
  const [stakedCards, setStakedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = useCallback(async () => {
    if (!pokemonContract || !dayCareContract || !account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load unstaked cards owned by user
      const balance = await pokemonContract.balanceOf(account);
      const cards = [];
      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await pokemonContract.tokenOfOwnerByIndex(account, i);
        const stats = await pokemonContract.getPokemonStats(tokenId);
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
          level: Number(stats.level)
        });
      }
      setMyCards(cards);

      // Load staked cards
      const stakedTokenIds = await dayCareContract.getStakedTokens(account);
      const staked = [];
      for (const tokenId of stakedTokenIds) {
        const stats = await pokemonContract.getPokemonStats(tokenId);
        const stakeInfo = await dayCareContract.getStakeInfo(tokenId);
        const pendingLevels = await dayCareContract.getPendingLevels(tokenId);

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
          stakeTimestamp: Number(stakeInfo.stakeTimestamp),
          pendingLevels: Number(pendingLevels)
        });
      }
      setStakedCards(staked);
    } catch (error) {
      console.error('Failed to load day care data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [pokemonContract, dayCareContract, account]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleStake = async (tokenId) => {
    if (!dayCareContract || !pokemonContract) return;

    try {
      setIsProcessing(true);

      // Check approval
      const isApproved = await pokemonContract.isApprovedForAll(account, DAYCARE_ADDRESS);
      if (!isApproved) {
        toast.loading('Approving Day Care contract...');
        const approveTx = await pokemonContract.setApprovalForAll(DAYCARE_ADDRESS, true);
        await approveTx.wait();
        toast.dismiss();
      }

      toast.loading('Staking Pokemon...');
      const tx = await dayCareContract.stake(tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success('Pokemon staked in Day Care!');
      triggerRefresh();
      loadData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to stake:', error);
      toast.error(error.reason || 'Failed to stake Pokemon');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnstake = async (tokenId) => {
    if (!dayCareContract) return;

    try {
      setIsProcessing(true);
      toast.loading('Unstaking and applying level gains...');
      const tx = await dayCareContract.unstake(tokenId);
      await tx.wait();

      toast.dismiss();
      toast.success('Pokemon returned with level boosts!');
      triggerRefresh();
      loadData();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to unstake:', error);
      toast.error(error.reason || 'Failed to unstake Pokemon');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatElapsed = (stakeTimestamp) => {
    const elapsed = Math.max(0, now - stakeTimestamp);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const estimateLevels = (stakeTimestamp) => {
    const elapsed = Math.max(0, now - stakeTimestamp);
    return Math.floor(elapsed / 2); // 2 seconds per level (must match contract's levelInterval)
  };

  if (!account) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to use the Day Care</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Day Care Center</h1>
          <p className="text-gray-400">
            Stake your Pokemon to gain levels over time. Every 2 seconds earns 1 level (+5 HP, +5 ATK, +5 DEF per level).
          </p>
        </div>
        <button
          onClick={() => navigate('/hatchery')}
          className="flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg font-semibold hover:opacity-90 transition-opacity shrink-0"
        >
          <Heart size={20} />
          <span>Breed Pokemon</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      ) : (
        <>
          {/* Staked Pokemon Section */}
          {stakedCards.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <Clock size={24} className="text-yellow-400" />
                <span>Staked Pokemon ({stakedCards.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {stakedCards.map((card) => {
                  const pendingLvls = estimateLevels(card.stakeTimestamp);
                  const effectiveLevel = Math.min(card.level + pendingLvls, 100);
                  const actualGain = effectiveLevel - card.level;

                  return (
                    <div key={card.tokenId} className="bg-gray-900 rounded-xl overflow-hidden border-2 border-yellow-500/50">
                      {/* Staking Status Header */}
                      <div className="bg-yellow-500/10 px-4 py-3 border-b border-yellow-500/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Clock size={16} className="text-yellow-400 animate-pulse" />
                            <span className="text-yellow-400 text-sm font-semibold">Training...</span>
                          </div>
                          <span className="text-yellow-400 text-sm font-mono">
                            {formatElapsed(card.stakeTimestamp)}
                          </span>
                        </div>
                      </div>

                      <PokemonCard pokemon={card} />

                      {/* Level Gain Preview */}
                      <div className="px-4 pb-4">
                        <div className="bg-gray-800 rounded-lg p-3 mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">Level Progress</span>
                            <div className="flex items-center space-x-1">
                              <span className="text-yellow-400 font-bold">{card.level}</span>
                              {actualGain > 0 && (
                                <>
                                  <ArrowRight size={14} className="text-green-400" />
                                  <span className="text-green-400 font-bold">{effectiveLevel}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {actualGain > 0 && (
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="flex items-center space-x-1 text-green-400">
                                <ArrowUp size={12} />
                                <span>HP +{actualGain * 5}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-green-400">
                                <ArrowUp size={12} />
                                <span>ATK +{actualGain * 5}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-green-400">
                                <ArrowUp size={12} />
                                <span>DEF +{actualGain * 5}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnstake(card.tokenId)}
                          disabled={isProcessing}
                          className="w-full py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                        >
                          {isProcessing ? 'Processing...' : 'Unstake & Collect'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Pokemon Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Your Pokemon ({myCards.length})
            </h2>
            {myCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {myCards.map((card) => (
                  <div key={card.tokenId} className="relative group">
                    <PokemonCard pokemon={card} />
                    {/* Stake Overlay */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <button
                        onClick={() => handleStake(card.tokenId)}
                        disabled={isProcessing || card.level >= 100}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <Clock size={16} />
                        <span>{card.level >= 100 ? 'Max Level' : 'Stake in Day Care'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : stakedCards.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} className="text-gray-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No Pokemon Available</h2>
                <p className="text-gray-400">You need Pokemon cards to use the Day Care</p>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">All your Pokemon are currently in the Day Care!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DayCare;
