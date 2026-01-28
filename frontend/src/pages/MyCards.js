import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import PokemonCard from '../components/PokemonCard';
import { ethers } from 'ethers';
import { Loader, AlertCircle, Plus, Tag, Gavel, X, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

function MyCards() {
  const { pokemonContract, tradingContract, account, refreshTrigger, triggerRefresh } = useWeb3();
  const [myCards, setMyCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showListModal, setShowListModal] = useState(false);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [auctionParams, setAuctionParams] = useState({
    startingPrice: '',
    reservePrice: '',
    duration: '3600' // 1 hour default
  });
  const [pendingWithdrawal, setPendingWithdrawal] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadMyCards = useCallback(async () => {
    if (!pokemonContract || !account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
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
          generation: Number(stats.generation)
        });
      }

      setMyCards(cards);

      // Load pending withdrawal
      if (tradingContract) {
        const pending = await tradingContract.getPendingWithdrawal(account);
        setPendingWithdrawal(ethers.formatEther(pending));
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
      toast.error('Failed to load your cards');
    } finally {
      setLoading(false);
    }
  }, [pokemonContract, tradingContract, account]);

  useEffect(() => {
    loadMyCards();
  }, [loadMyCards, refreshTrigger]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!tradingContract || !pokemonContract) return;

    const handleTransfer = () => loadMyCards();
    const handleListed = () => loadMyCards();
    const handleListingCancelled = () => loadMyCards();
    const handleSale = () => loadMyCards();
    const handleAuctionCreated = () => loadMyCards();
    const handleAuctionCancelled = () => loadMyCards();
    const handleAuctionFinalized = () => loadMyCards();
    const handleWithdrawal = () => loadMyCards();

    pokemonContract.on('Transfer', handleTransfer);
    tradingContract.on('Listed', handleListed);
    tradingContract.on('ListingCancelled', handleListingCancelled);
    tradingContract.on('Sale', handleSale);
    tradingContract.on('AuctionCreated', handleAuctionCreated);
    tradingContract.on('AuctionCancelled', handleAuctionCancelled);
    tradingContract.on('AuctionFinalized', handleAuctionFinalized);
    tradingContract.on('Withdrawal', handleWithdrawal);

    return () => {
      pokemonContract.off('Transfer', handleTransfer);
      tradingContract.off('Listed', handleListed);
      tradingContract.off('ListingCancelled', handleListingCancelled);
      tradingContract.off('Sale', handleSale);
      tradingContract.off('AuctionCreated', handleAuctionCreated);
      tradingContract.off('AuctionCancelled', handleAuctionCancelled);
      tradingContract.off('AuctionFinalized', handleAuctionFinalized);
      tradingContract.off('Withdrawal', handleWithdrawal);
    };
  }, [tradingContract, pokemonContract, loadMyCards]);

  const handleListCard = async () => {
    if (!selectedCard || !listPrice || !tradingContract) return;

    try {
      setIsProcessing(true);
      const priceWei = ethers.parseEther(listPrice);

      // Check approval
      const isApproved = await pokemonContract.isApprovedForAll(
        account,
        await tradingContract.getAddress()
      );

      if (!isApproved) {
        toast.loading('Approving contract...');
        const approveTx = await pokemonContract.setApprovalForAll(
          await tradingContract.getAddress(),
          true
        );
        await approveTx.wait();
        toast.dismiss();
      }

      toast.loading('Listing card...');
      const tx = await tradingContract.listCard(selectedCard.tokenId, priceWei);
      await tx.wait();

      toast.dismiss();
      toast.success('Card listed successfully!');
      setShowListModal(false);
      setListPrice('');
      setSelectedCard(null);
      triggerRefresh();
      loadMyCards();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to list card:', error);
      toast.error(error.reason || 'Failed to list card');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAuction = async () => {
    if (!selectedCard || !auctionParams.startingPrice || !tradingContract) return;

    try {
      setIsProcessing(true);
      const startingPriceWei = ethers.parseEther(auctionParams.startingPrice);
      const reservePriceWei = ethers.parseEther(auctionParams.reservePrice || auctionParams.startingPrice);

      // Check approval
      const isApproved = await pokemonContract.isApprovedForAll(
        account,
        await tradingContract.getAddress()
      );

      if (!isApproved) {
        toast.loading('Approving contract...');
        const approveTx = await pokemonContract.setApprovalForAll(
          await tradingContract.getAddress(),
          true
        );
        await approveTx.wait();
        toast.dismiss();
      }

      toast.loading('Creating auction...');
      const tx = await tradingContract.createAuction(
        selectedCard.tokenId,
        startingPriceWei,
        reservePriceWei,
        parseInt(auctionParams.duration)
      );
      await tx.wait();

      toast.dismiss();
      toast.success('Auction created successfully!');
      setShowAuctionModal(false);
      setAuctionParams({ startingPrice: '', reservePrice: '', duration: '3600' });
      setSelectedCard(null);
      triggerRefresh();
      loadMyCards();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to create auction:', error);
      toast.error(error.reason || 'Failed to create auction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!tradingContract || pendingWithdrawal === '0') return;

    try {
      setIsProcessing(true);
      toast.loading('Withdrawing funds...');
      const tx = await tradingContract.withdraw();
      await tx.wait();
      toast.dismiss();
      toast.success('Withdrawal successful!');
      triggerRefresh();
      loadMyCards();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to withdraw:', error);
      toast.error(error.reason || 'Failed to withdraw');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!account) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to view your cards</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Cards</h1>
        
        {/* Pending Withdrawal */}
        {parseFloat(pendingWithdrawal) > 0 && (
          <button
            onClick={handleWithdraw}
            disabled={isProcessing}
            className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            <DollarSign size={18} />
            <span>Withdraw {pendingWithdrawal} ETH</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      ) : myCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {myCards.map((card) => (
            <div key={card.tokenId} className="relative group">
              <PokemonCard pokemon={card} />
              
              {/* Action Overlay */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3 rounded-xl">
                <button
                  onClick={() => {
                    setSelectedCard(card);
                    setShowListModal(true);
                  }}
                  className="flex items-center space-x-1 px-3 py-2 bg-primary rounded-lg hover:bg-primary/80 transition-colors"
                >
                  <Tag size={16} />
                  <span>List</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCard(card);
                    setShowAuctionModal(true);
                  }}
                  className="flex items-center space-x-1 px-3 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  <Gavel size={16} />
                  <span>Auction</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus size={32} className="text-gray-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Cards Yet</h2>
          <p className="text-gray-400 mb-4">Start your collection by buying from the marketplace</p>
        </div>
      )}

      {/* List Modal */}
      {showListModal && selectedCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">List {selectedCard.name}</h2>
              <button onClick={() => setShowListModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Price (ETH)</label>
              <input
                type="number"
                step="0.001"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0.1"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={handleListCard}
              disabled={!listPrice || isProcessing}
              className="w-full py-3 bg-gradient-to-r from-primary to-secondary rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'List for Sale'}
            </button>
          </div>
        </div>
      )}

      {/* Auction Modal */}
      {showAuctionModal && selectedCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Auction {selectedCard.name}</h2>
              <button onClick={() => setShowAuctionModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Starting Price (ETH)</label>
                <input
                  type="number"
                  step="0.001"
                  value={auctionParams.startingPrice}
                  onChange={(e) => setAuctionParams({...auctionParams, startingPrice: e.target.value})}
                  placeholder="0.1"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Reserve Price (ETH)</label>
                <input
                  type="number"
                  step="0.001"
                  value={auctionParams.reservePrice}
                  onChange={(e) => setAuctionParams({...auctionParams, reservePrice: e.target.value})}
                  placeholder="0.5"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Duration</label>
                <select
                  value={auctionParams.duration}
                  onChange={(e) => setAuctionParams({...auctionParams, duration: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="3600">1 Hour</option>
                  <option value="21600">6 Hours</option>
                  <option value="43200">12 Hours</option>
                  <option value="86400">1 Day</option>
                  <option value="259200">3 Days</option>
                  <option value="604800">7 Days</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateAuction}
              disabled={!auctionParams.startingPrice || isProcessing}
              className="w-full mt-6 py-3 bg-gradient-to-r from-secondary to-pink-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Create Auction'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyCards;
