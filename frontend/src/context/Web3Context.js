import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import PokemonCardABI from '../contracts/PokemonCard.json';
import PokemonTradingABI from '../contracts/PokemonTrading.json';

const Web3Context = createContext();

const POKEMON_CARD_ADDRESS = process.env.REACT_APP_POKEMON_CARD_ADDRESS || '';
const TRADING_ADDRESS = process.env.REACT_APP_TRADING_ADDRESS || '';
const EXPECTED_CHAIN_ID = 31337; // Hardhat local network

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [pokemonContract, setPokemonContract] = useState(null);
  const [tradingContract, setTradingContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Call this after any transaction to trigger UI refresh across all pages
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const initializeContracts = useCallback(async (signerInstance) => {
    if (!POKEMON_CARD_ADDRESS || !TRADING_ADDRESS) {
      console.warn('Contract addresses not configured');
      return;
    }

    try {
      const pokemonCard = new ethers.Contract(
        POKEMON_CARD_ADDRESS,
        PokemonCardABI.abi,
        signerInstance
      );
      const trading = new ethers.Contract(
        TRADING_ADDRESS,
        PokemonTradingABI.abi,
        signerInstance
      );

      setPokemonContract(pokemonCard);
      setTradingContract(trading);
    } catch (error) {
      console.error('Failed to initialize contracts:', error);
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('Please install MetaMask to use this dApp');
      return;
    }

    setIsConnecting(true);

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const network = await browserProvider.getNetwork();
      const signerInstance = await browserProvider.getSigner();

      setProvider(browserProvider);
      setSigner(signerInstance);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setIsCorrectNetwork(Number(network.chainId) === EXPECTED_CHAIN_ID);

      await initializeContracts(signerInstance);

      if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
        toast.error('Please switch to Hardhat local network (Chain ID: 31337)');
      } else {
        toast.success('Wallet connected!');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setPokemonContract(null);
    setTradingContract(null);
    toast.success('Wallet disconnected');
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7A69' }] // 31337 in hex
      });
    } catch (error) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x7A69',
              chainName: 'Hardhat Local',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['http://127.0.0.1:8545']
            }]
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      }
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          toast.success('Account changed');
        } else {
          disconnectWallet();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  const value = {
    account,
    provider,
    signer,
    pokemonContract,
    tradingContract,
    isConnecting,
    chainId,
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    triggerRefresh,
    refreshTrigger,
    POKEMON_CARD_ADDRESS,
    TRADING_ADDRESS
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}
