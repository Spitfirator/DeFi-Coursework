import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import PokemonCardABI from '../contracts/PokemonCard.json';
import PokemonTradingABI from '../contracts/PokemonTrading.json';
import DayCareABI from '../contracts/DayCare.json';
import EvolutionManagerABI from '../contracts/EvolutionManager.json';
import HatcheryABI from '../contracts/Hatchery.json';

const Web3Context = createContext();

const POKEMON_CARD_ADDRESS = process.env.REACT_APP_POKEMON_CARD_ADDRESS || '';
const TRADING_ADDRESS = process.env.REACT_APP_TRADING_ADDRESS || '';
const DAYCARE_ADDRESS = process.env.REACT_APP_DAYCARE_ADDRESS || '';
const EVOLUTION_ADDRESS = process.env.REACT_APP_EVOLUTION_ADDRESS || '';
const HATCHERY_ADDRESS = process.env.REACT_APP_HATCHERY_ADDRESS || '';
const EXPECTED_CHAIN_ID = 31337; // Hardhat local network
const RPC_URL = 'http://127.0.0.1:8545';

// Singleton direct provider — fallback for when MetaMask has stale block cache
const directProvider = new ethers.JsonRpcProvider(RPC_URL);

// Check if MetaMask's cached block number is ahead of the actual chain (stale after node restart)
async function isMetaMaskBlockCacheStale(browserProvider) {
  try {
    const mmBlock = await browserProvider.send('eth_blockNumber', []);
    const realBlock = await directProvider.send('eth_blockNumber', []);
    return parseInt(mmBlock, 16) > parseInt(realBlock, 16);
  } catch {
    return true;
  }
}

// Only patch reads to bypass MetaMask if its cache is stale
function patchProviderReads(browserProvider, useDirectReads) {
  if (!useDirectReads) return browserProvider;
  browserProvider.call = directProvider.call.bind(directProvider);
  browserProvider.getBlock = directProvider.getBlock.bind(directProvider);
  browserProvider.getBlockNumber = directProvider.getBlockNumber.bind(directProvider);
  browserProvider.getLogs = directProvider.getLogs.bind(directProvider);
  return browserProvider;
}

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [pokemonContract, setPokemonContract] = useState(null);
  const [tradingContract, setTradingContract] = useState(null);
  const [dayCareContract, setDayCareContract] = useState(null);
  const [evolutionContract, setEvolutionContract] = useState(null);
  const [hatcheryContract, setHatcheryContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [blockTime, setBlockTime] = useState(Math.floor(Date.now() / 1000));
  const providerRef = useRef(null);

  // Keep ref in sync with state so event handlers can access the current provider
  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  // Call this after any transaction to trigger UI refresh across all pages
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Sync with blockchain clock to avoid timestamp mismatch with Hardhat node
  useEffect(() => {
    if (!provider) return;
    provider.getBlock('latest').then(block => {
      const systemNow = Math.floor(Date.now() / 1000);
      setClockOffset(block.timestamp - systemNow);
    });
  }, [provider, refreshTrigger]);

  // Tick every second using blockchain-synced time
  useEffect(() => {
    const timer = setInterval(() => {
      setBlockTime(Math.floor(Date.now() / 1000) + clockOffset);
    }, 1000);
    return () => clearInterval(timer);
  }, [clockOffset]);

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

      if (DAYCARE_ADDRESS) {
        const dayCare = new ethers.Contract(DAYCARE_ADDRESS, DayCareABI.abi, signerInstance);
        setDayCareContract(dayCare);
      }
      if (EVOLUTION_ADDRESS) {
        const evolution = new ethers.Contract(EVOLUTION_ADDRESS, EvolutionManagerABI.abi, signerInstance);
        setEvolutionContract(evolution);
      }
      if (HATCHERY_ADDRESS) {
        const hatchery = new ethers.Contract(HATCHERY_ADDRESS, HatcheryABI.abi, signerInstance);
        setHatcheryContract(hatchery);
      }
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
      // Destroy old provider to clear stale block cache
      if (providerRef.current) {
        providerRef.current.destroy();
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);

      // Check staleness AFTER MetaMask connection is established
      const stale = await isMetaMaskBlockCacheStale(browserProvider);
      patchProviderReads(browserProvider, stale);

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
    if (providerRef.current) {
      providerRef.current.destroy();
    }
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setPokemonContract(null);
    setTradingContract(null);
    setDayCareContract(null);
    setEvolutionContract(null);
    setHatcheryContract(null);
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
      window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length > 0) {
          // Reinitialize everything when account changes
          try {
            // Destroy old provider to clear stale block cache
            if (providerRef.current) {
              providerRef.current.destroy();
            }

            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const network = await browserProvider.getNetwork();

            // Check staleness AFTER MetaMask connection is established
            const stale = await isMetaMaskBlockCacheStale(browserProvider);
            patchProviderReads(browserProvider, stale);

            const signerInstance = await browserProvider.getSigner();

            setProvider(browserProvider);
            setSigner(signerInstance);
            setAccount(accounts[0]);
            setChainId(Number(network.chainId));
            setIsCorrectNetwork(Number(network.chainId) === EXPECTED_CHAIN_ID);

            await initializeContracts(signerInstance);

            toast.success('Account changed');
          } catch (error) {
            console.error('Failed to switch account:', error);
            toast.error('Failed to switch account');
          }
        } else {
          disconnectWallet();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      // Auto-reconnect if wallet was previously connected
      const checkConnection = async () => {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            // Wallet is already connected, silently reconnect
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const network = await browserProvider.getNetwork();
            const stale = await isMetaMaskBlockCacheStale(browserProvider);
            patchProviderReads(browserProvider, stale);
            const signerInstance = await browserProvider.getSigner();

            setProvider(browserProvider);
            setSigner(signerInstance);
            setAccount(accounts[0]);
            setChainId(Number(network.chainId));
            setIsCorrectNetwork(Number(network.chainId) === EXPECTED_CHAIN_ID);

            await initializeContracts(signerInstance);
          }
        } catch (error) {
          console.error('Auto-reconnect failed:', error);
        }
      };

      checkConnection();
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [initializeContracts]);

  const value = {
    account,
    provider,
    signer,
    pokemonContract,
    tradingContract,
    dayCareContract,
    evolutionContract,
    hatcheryContract,
    isConnecting,
    chainId,
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    triggerRefresh,
    refreshTrigger,
    POKEMON_CARD_ADDRESS,
    TRADING_ADDRESS,
    DAYCARE_ADDRESS,
    EVOLUTION_ADDRESS,
    HATCHERY_ADDRESS,
    blockTime
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
