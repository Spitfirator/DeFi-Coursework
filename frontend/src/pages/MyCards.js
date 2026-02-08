import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import PokemonCard from '../components/PokemonCard';
import DutchAuctionModal from '../components/DutchAuctionModal';
import { ethers } from 'ethers';
import { Loader, AlertCircle, Plus, Tag, Gavel, X, DollarSign, TrendingDown, ArrowLeftRight, Check, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function MyCards() {
  const { pokemonContract, tradingContract, account, refreshTrigger, triggerRefresh } = useWeb3();
  const [myCards, setMyCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showListModal, setShowListModal] = useState(false);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showDutchAuctionModal, setShowDutchAuctionModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [auctionParams, setAuctionParams] = useState({
    startingPrice: '',
    reservePrice: '',
    duration: '3600' // 1 hour default
  });
  const [pendingWithdrawal, setPendingWithdrawal] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingSwaps, setPendingSwaps] = useState([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);
  const lastLoadTime = useRef(0);

  const loadMyCards = useCallback(async () => {
    const now = Date.now();
    // Prevent double-refresh: if called within 2 seconds of last start, skip
    if (now - lastLoadTime.current < 2000) {
      console.log('Skipping duplicate refresh (debounced)');
      return;
    }

    if (!pokemonContract || !account || !tradingContract) return;

    try {
      lastLoadTime.current = now;
      setLoading(true);
      console.log('Loading cards...');
      const cards = [];
      const processedTokenIds = new Set(); // To avoid duplicates if any overlap

      const fetchCardDetails = async (tokenId) => {
        if (processedTokenIds.has(Number(tokenId))) return null;
        processedTokenIds.add(Number(tokenId));

        try {
          const stats = await pokemonContract.getPokemonStats(tokenId);
          let listing = null;
          let auction = null;
          let dutchAuction = null;

          // Check Listing
          const listingData = await tradingContract.listings(tokenId);
          if (listingData.isActive) {
            listing = {
              seller: listingData.seller,
              price: ethers.formatEther(listingData.price),
              isActive: listingData.isActive
            };
          }

          // Check Auction
          const auctionData = await tradingContract.auctions(tokenId);
          if (auctionData.isActive) {
            auction = {
              seller: auctionData.seller,
              startingPrice: ethers.formatEther(auctionData.startingPrice),
              reservePrice: ethers.formatEther(auctionData.reservePrice),
              highestBid: ethers.formatEther(auctionData.highestBid),
              endTime: Number(auctionData.endTime),
              isActive: auctionData.isActive
            };
          }

          // Check Dutch Auction
          const dutchData = await tradingContract.dutchAuctions(tokenId);
          if (dutchData.isActive && !dutchData.sold) {
            dutchAuction = {
              seller: dutchData.seller,
              startingPrice: ethers.formatEther(dutchData.startingPrice),
              reservePrice: ethers.formatEther(dutchData.reservePrice),
              startTime: Number(dutchData.startTime),
              duration: Number(dutchData.duration),
              isActive: dutchData.isActive
            };
          }

          return {
            tokenId: Number(tokenId),
            name: stats.name,
            pokemonType: stats.pokemonType,
            rarity: stats.rarity,
            hp: Number(stats.hp),
            attack: Number(stats.attack),
            defense: Number(stats.defense),
            speed: Number(stats.speed),
            generation: Number(stats.generation),
            listing,
            auction,
            dutchAuction
          };
        } catch (e) {
          console.warn(`Failed to fetch details for token ${tokenId}`, e);
          return null;
        }
      };

      // 1. Fetch Wallet Cards (Standard Balance Check)
      const balance = await pokemonContract.balanceOf(account);
      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await pokemonContract.tokenOfOwnerByIndex(account, i);
        const card = await fetchCardDetails(tokenId);
        if (card) cards.push(card);
      }

      // 2. Fetch Listed Cards (Iterate Total Minted)
      // This ensures cards listed by the user (now owned by contract) appear in 'My Cards'
      const totalMinted = await pokemonContract.totalMinted();
      for (let i = 0; i < Number(totalMinted); i++) {
        // Optimization: Create simplified checks or just fetch all active listings first?
        // For simplicity in this demo, we check listings directly.
        try {
          const l = await tradingContract.listings(i);
          const a = await tradingContract.auctions(i);
          const d = await tradingContract.dutchAuctions(i);

          const isMyListing = (l.isActive && l.seller.toLowerCase() === account.toLowerCase());
          const isMyAuction = (a.isActive && a.seller.toLowerCase() === account.toLowerCase());
          const isMyDutch = (d.isActive && !d.sold && d.seller.toLowerCase() === account.toLowerCase());

          if (isMyListing || isMyAuction || isMyDutch) {
            const card = await fetchCardDetails(i);
            if (card) cards.push(card);
          }
        } catch (e) {
          // ignore errors for non-existent tokens or cleared structs
        }
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

  const loadPendingSwaps = useCallback(async () => {
    if (!pokemonContract || !tradingContract || !account || myCards.length === 0) {
      setPendingSwaps([]);
      return;
    }

    try {
      setLoadingSwaps(true);
      const allSwaps = [];

      // Check each owned NFT for swap requests
      for (const card of myCards) {
        const swapRequests = await tradingContract.getSwapRequests(card.tokenId);

        for (let i = 0; i < swapRequests.length; i++) {
          const req = swapRequests[i];
          if (req.isActive) {
            try {
              const offeredCard = await pokemonContract.getPokemonStats(req.offeredTokenId);
              allSwaps.push({
                desiredTokenId: card.tokenId,
                desiredCardName: card.name,
                requestIndex: i,
                requester: req.requester,
                offeredTokenId: req.offeredTokenId.toString(),
                offeredCard: {
                  name: offeredCard.name,
                  pokemonType: offeredCard.pokemonType,
                  rarity: offeredCard.rarity,
                  hp: offeredCard.hp.toString(),
                  attack: offeredCard.attack.toString(),
                  defense: offeredCard.defense.toString(),
                  speed: offeredCard.speed.toString()
                }
              });
            } catch (error) {
              console.error('Error loading offered card:', error);
            }
          }
        }
      }

      setPendingSwaps(allSwaps);
    } catch (error) {
      console.error('Failed to load pending swaps:', error);
    } finally {
      setLoadingSwaps(false);
    }
  }, [pokemonContract, tradingContract, account, myCards]);

  useEffect(() => {
    loadMyCards();
  }, [loadMyCards, refreshTrigger]);

  useEffect(() => {
    loadPendingSwaps();
  }, [loadPendingSwaps]);

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
    tradingContract.on('Sale', handleSale);

    return () => {
      pokemonContract.off('Transfer', handleTransfer);
      tradingContract.off('Sale', handleSale);
    };
  }, [tradingContract, pokemonContract, loadMyCards]);

  const handleListCard = async () => {
    if (!selectedCard || !listPrice || !tradingContract) return;

    try {
      setIsProcessing(true);
      const priceWei = ethers.parseEther(listPrice);

      console.log('Listing card:', {
        tokenId: selectedCard.tokenId,
        price: listPrice,
        priceWei: priceWei.toString(),
        account,
        tradingContractAddress: await tradingContract.getAddress()
      });

      // Check if user owns the NFT
      const owner = await pokemonContract.ownerOf(selectedCard.tokenId);
      console.log('NFT owner:', owner, 'Current account:', account);

      if (owner.toLowerCase() !== account.toLowerCase()) {
        toast.error('You do not own this NFT');
        return;
      }

      // Check if already listed
      const listing = await tradingContract.listings(selectedCard.tokenId);
      console.log('Existing listing:', listing);
      if (listing.isActive) {
        toast.error('This NFT is already listed for sale');
        return;
      }

      // Check if in auction
      const auction = await tradingContract.auctions(selectedCard.tokenId);
      console.log('Existing auction:', auction);
      if (auction.isActive) {
        toast.error('This NFT is currently in an auction');
        return;
      }

      // Check approval
      const tradingAddress = await tradingContract.getAddress();
      const isApproved = await pokemonContract.isApprovedForAll(
        account,
        tradingAddress
      );

      console.log('Is approved:', isApproved);

      if (!isApproved) {
        toast.loading('Approving contract...');
        const approveTx = await pokemonContract.setApprovalForAll(
          tradingAddress,
          true
        );
        console.log('Approval tx:', approveTx.hash);
        await approveTx.wait();
        toast.dismiss();
        toast.success('Contract approved!');
      }

      toast.loading('Listing card...');
      const tx = await tradingContract.listCard(selectedCard.tokenId, priceWei);
      console.log('List tx:', tx.hash);
      await tx.wait();

      toast.dismiss();
      toast.success('Card listed successfully!');
      setListPrice('');
      setSelectedCard(null);
      triggerRefresh();
    } catch (error) {
      toast.dismiss();
      console.error('Failed to list card:', error);
      console.error('Error details:', {
        message: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data
      });

      // Better error messages
      let errorMessage = 'Failed to list card';
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas';
      }

      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptSwap = async (swap) => {
    try {
      setIsProcessing(true);

      // Check if marketplace is approved
      const isApproved = await pokemonContract.isApprovedForAll(account, await tradingContract.getAddress());

      if (!isApproved) {
        toast.loading('Please approve marketplace in your wallet...');
        const approveTx = await pokemonContract.setApprovalForAll(await tradingContract.getAddress(), true);
        await approveTx.wait();
        toast.dismiss();
        toast.success('Marketplace approved!');
      }

      toast.loading('Executing swap...');
      const tx = await tradingContract.executeSwap(swap.desiredTokenId, swap.requestIndex);
      await tx.wait();

      toast.dismiss();
      toast.success(`Swap completed! You traded ${swap.desiredCardName} for ${swap.offeredCard.name}! 🎉`);

      // Reload data
      await loadMyCards();
      await loadPendingSwaps();
    } catch (error) {
      console.error('Error accepting swap:', error);
      toast.dismiss();
      toast.error(error.reason || 'Failed to execute swap');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSwap = async (swap) => {
    try {
      setIsProcessing(true);
      toast.loading('Rejecting swap...');

      const tx = await tradingContract.cancelSwapRequest(swap.desiredTokenId, swap.requestIndex);
      await tx.wait();

      toast.dismiss();
      toast.success('Swap request rejected');

      // Reload swaps
      await loadPendingSwaps();
    } catch (error) {
      console.error('Error rejecting swap:', error);
      toast.dismiss();
      toast.error(error.reason || 'Failed to reject swap');
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

      // Validate reserve price
      if (parseFloat(auctionParams.reservePrice || auctionParams.startingPrice) < parseFloat(auctionParams.startingPrice)) {
        toast.error('Reserve price must be greater than or equal to starting price');
        setIsProcessing(false);
        return;
      }

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
      setAuctionParams({ startingPrice: '', reservePrice: '', duration: '3600' });
      setSelectedCard(null);
      triggerRefresh();
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
      toast.success('Withdrawal successful!');
      triggerRefresh();
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
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

      {/* Pending Swap Requests Section */}
      {!loading && pendingSwaps.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <ArrowLeftRight className="text-purple-400" size={24} />
            <h2 className="text-2xl font-bold">Pending Swap Requests</h2>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-semibold">
              {pendingSwaps.length}
            </span>
          </div>
          <p className="text-gray-400 mb-4">People want to trade with you!</p>

          <div className="space-y-4">
            {pendingSwaps.map((swap, index) => (
              <div
                key={`${swap.desiredTokenId}-${swap.requestIndex}`}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-purple-500/50 transition-colors"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {/* Offered Card */}
                  <div className="flex items-center space-x-4">
                    <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-3 border border-yellow-500/30">
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-400">{swap.offeredCard.name}</div>
                        <div className="text-xs text-gray-400">{swap.offeredCard.pokemonType}</div>
                        <div className="text-xs text-gray-500">{swap.offeredCard.rarity}</div>
                      </div>
                    </div>

                    <ArrowLeftRight className="text-purple-400" size={24} />

                    {/* Your Card */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg p-3 border border-blue-500/30">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-400">{swap.desiredCardName}</div>
                        <div className="text-xs text-gray-400">Your Card</div>
                      </div>
                    </div>
                  </div>

                  {/* Requester Info */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm text-gray-400">From:</div>
                    <div className="text-sm font-mono text-gray-300">
                      {swap.requester.slice(0, 6)}...{swap.requester.slice(-4)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleAcceptSwap(swap)}
                      disabled={isProcessing}
                      className="flex items-center space-x-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={18} />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => handleRejectSwap(swap)}
                      disabled={isProcessing}
                      className="flex items-center space-x-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle size={18} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      ) : myCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {myCards.map((card) => (
            <div key={card.tokenId} className="relative group">
              <Link to={`/card/${card.tokenId}`} className="block">
                <PokemonCard
                  pokemon={card}
                  listing={card.listing}
                  auction={card.auction}
                  dutchAuction={card.dutchAuction}
                />
              </Link>

              {/* Action Overlay */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl p-2 h-full pointer-events-none">
                <div className="flex items-center space-x-2 pointer-events-auto">
                  {!card.listing && !card.auction && !card.dutchAuction ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedCard(card);
                          setShowAuctionModal(false);
                          setShowDutchAuctionModal(false);
                          setShowListModal(true);
                        }}
                        className="flex items-center space-x-1 px-3 py-2 bg-primary rounded-lg hover:bg-primary/80 transition-colors text-sm"
                      >
                        <Tag size={16} />
                        <span>List</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedCard(card);
                          setShowListModal(false);
                          setShowDutchAuctionModal(false);
                          setShowAuctionModal(true);
                        }}
                        className="flex items-center space-x-1 px-3 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors text-sm"
                      >
                        <Gavel size={16} />
                        <span>Auction</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedCard(card);
                          setShowListModal(false);
                          setShowAuctionModal(false);
                          setShowDutchAuctionModal(true);
                        }}
                        className="flex items-center space-x-1 px-3 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                      >
                        <TrendingDown size={16} />
                        <span>Dutch</span>
                      </button>
                    </>
                  ) : (
                    <Link
                      to={`/card/${card.tokenId}`}
                      className="flex items-center space-x-1 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-white font-semibold"
                    >
                      <span>View Details</span>
                    </Link>
                  )}
                </div>
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
                  onChange={(e) => setAuctionParams({ ...auctionParams, startingPrice: e.target.value })}
                  placeholder="0.1"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum bid to start the auction</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Reserve Price (ETH)</label>
                <input
                  type="number"
                  step="0.001"
                  value={auctionParams.reservePrice}
                  onChange={(e) => setAuctionParams({ ...auctionParams, reservePrice: e.target.value })}
                  placeholder="0.5"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-gray-500 mt-1">Must be ≥ starting price (minimum acceptable final bid)</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Duration</label>
                <select
                  value={auctionParams.duration}
                  onChange={(e) => setAuctionParams({ ...auctionParams, duration: e.target.value })}
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

      {/* Dutch Auction Modal */}
      <DutchAuctionModal
        isOpen={showDutchAuctionModal}
        onClose={() => {
          setShowDutchAuctionModal(false);
          setSelectedCard(null);
        }}
        nft={selectedCard}
        tradingContract={tradingContract}
        pokemonContract={pokemonContract}
        onSuccess={() => {
          setShowDutchAuctionModal(false);
          setSelectedCard(null);
          triggerRefresh();
        }}
      />
    </div>
  );
}

export default MyCards;
