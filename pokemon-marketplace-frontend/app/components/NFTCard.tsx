'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { POKEMON_NFT_ADDRESS, MARKETPLACE_ADDRESS } from '../../contracts/addresses';
import PokemonNFTABI from '../../contracts/PokemonNFT.json';
import MarketplaceABI from '../../contracts/PokemonMarketplace.json';

interface NFT {
  tokenId: number;
  name: string;
  type: string;
  rarity: number;
  level: number;
  owner: string;
  image: string;
  isListed: boolean;
  price?: string;
}

interface NFTCardProps {
  nft: NFT;
  account: string;
  provider: ethers.BrowserProvider | null;
  onUpdate: () => void;
}

export default function NFTCard({ nft, account, provider, onUpdate }: NFTCardProps) {
  const [loading, setLoading] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [status, setStatus] = useState('');

  const isOwner = nft.owner.toLowerCase() === account.toLowerCase();

  const getRarityColor = (rarity: number) => {
    if (rarity === 5) return 'bg-gradient-to-r from-purple-500 to-pink-500';
    if (rarity === 4) return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    return 'bg-gradient-to-r from-gray-400 to-gray-500';
  };

  const getRarityName = (rarity: number) => {
    if (rarity === 5) return '⭐ Legendary';
    if (rarity === 4) return '💎 Rare';
    return '🌟 Common';
  };

  const handleList = async () => {
    if (!provider || !listPrice) return;
    
    setLoading(true);
    setStatus('Listing NFT...');
    
    try {
      const signer = await provider.getSigner();
      const nftContract = new ethers.Contract(POKEMON_NFT_ADDRESS, PokemonNFTABI.abi, signer);
      const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);

      if (nft.rarity === 5) {
        setStatus('Legendary Pokemon can only be auctioned!');
        setTimeout(() => {
          setStatus('');
          setShowListModal(false);
        }, 3000);
        setLoading(false);
        return;
      }

      setStatus('Approving marketplace...');
      const approveTx = await nftContract.approve(MARKETPLACE_ADDRESS, nft.tokenId);
      await approveTx.wait();

      setStatus('Creating listing...');
      const price = ethers.parseEther(listPrice);
      const listTx = await marketplaceContract.listFixedPrice(POKEMON_NFT_ADDRESS, nft.tokenId, price);
      await listTx.wait();

      setStatus('✅ Listed successfully!');
      setTimeout(() => {
        setShowListModal(false);
        setStatus('');
        onUpdate();
      }, 2000);
    } catch (error: any) {
      console.error('Error listing NFT:', error);
      setStatus(`❌ Error: ${error.message.split('(')[0]}`);
    }
    setLoading(false);
  };

  const handleBuy = async () => {
    if (!provider || !nft.price) return;
    
    setLoading(true);
    setStatus('Buying NFT...');
    
    try {
      const signer = await provider.getSigner();
      const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);

      const price = ethers.parseEther(nft.price);
      const buyTx = await marketplaceContract.buyFixedPrice(POKEMON_NFT_ADDRESS, nft.tokenId, {
        value: price
      });
      await buyTx.wait();

      setStatus('✅ Purchase successful!');
      setTimeout(() => {
        setStatus('');
        onUpdate();
      }, 2000);
    } catch (error: any) {
      console.error('Error buying NFT:', error);
      setStatus(`❌ Error: ${error.message.split('(')[0]}`);
    }
    setLoading(false);
  };

  const handleCancelListing = async () => {
    if (!provider) return;
    
    setLoading(true);
    setStatus('Canceling listing...');
    
    try {
      const signer = await provider.getSigner();
      const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);

      const cancelTx = await marketplaceContract.cancelListing(POKEMON_NFT_ADDRESS, nft.tokenId);
      await cancelTx.wait();

      setStatus('✅ Listing canceled!');
      setTimeout(() => {
        setStatus('');
        onUpdate();
      }, 2000);
    } catch (error: any) {
      console.error('Error canceling listing:', error);
      setStatus(`❌ Error: ${error.message.split('(')[0]}`);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1">
        <div className={`${getRarityColor(nft.rarity)} text-white text-center py-2 font-bold text-sm`}>
          {getRarityName(nft.rarity)}
        </div>

        <div className="relative h-64 bg-gradient-to-br from-gray-100 to-gray-200">
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-contain p-4"
          />
          {nft.isListed && (
            <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              🏷️ Listed
            </div>
          )}
        </div>

        <div className="p-4">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{nft.name}</h3>
          <div className="space-y-1 text-sm mb-4">
            <p className="text-gray-600">
              <span className="font-semibold">Type:</span> {nft.type}
            </p>
            <p className="text-gray-600">
              <span className="font-semibold">Level:</span> {nft.level}
            </p>
            <p className="text-gray-600">
              <span className="font-semibold">Token ID:</span> #{nft.tokenId}
            </p>
          </div>

          {nft.isListed && nft.price && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg mb-4">
              <p className="text-2xl font-bold text-green-600">
                {nft.price} ETH
              </p>
            </div>
          )}

          {status && (
            <div className={`mb-3 p-2 rounded text-sm text-center ${
              status.includes('✅') ? 'bg-green-100 text-green-700' : 
              status.includes('❌') ? 'bg-red-100 text-red-700' : 
              'bg-blue-100 text-blue-700'
            }`}>
              {status}
            </div>
          )}

          <div className="space-y-2">
            {isOwner && !nft.isListed && (
              <button
                onClick={() => setShowListModal(true)}
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                🏷️ List for Sale
              </button>
            )}

            {isOwner && nft.isListed && (
              <button
                onClick={handleCancelListing}
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                ❌ Cancel Listing
              </button>
            )}

            {!isOwner && nft.isListed && (
              <button
                onClick={handleBuy}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50"
              >
                💰 Buy Now
              </button>
            )}

            {!isOwner && !nft.isListed && (
              <div className="text-center text-gray-500 py-3 text-sm">
                Not for sale
              </div>
            )}
          </div>
        </div>
      </div>

      {showListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">List {nft.name} for Sale</h3>
            
            {nft.rarity === 5 && (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
                <p className="text-yellow-700 font-semibold">⚠️ Legendary Pokemon can only be sold via auction!</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Price (ETH)
              </label>
              <input
                type="number"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0.1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {status && (
              <div className={`mb-4 p-3 rounded text-center ${
                status.includes('✅') ? 'bg-green-100 text-green-700' : 
                status.includes('❌') ? 'bg-red-100 text-red-700' : 
                'bg-blue-100 text-blue-700'
              }`}>
                {status}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowListModal(false);
                  setStatus('');
                  setListPrice('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleList}
                disabled={loading || !listPrice}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'List NFT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
