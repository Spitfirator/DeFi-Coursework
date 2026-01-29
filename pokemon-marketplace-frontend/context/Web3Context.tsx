'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BrowserProvider, Signer, ethers, Contract } from 'ethers';

// Import ABIs
import PokemonNFTABI from '../contracts/PokemonNFT.json';
import MarketplaceABI from '../contracts/PokemonMarketplace.json';

// Define context state type
interface Web3ContextState {
    provider: BrowserProvider | null;
    signer: Signer | null;
    account: string | null;
    chainId: number | null;
    nftContract: Contract | null;
    marketplaceContract: Contract | null;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    isValidNetwork: boolean;
    isConnecting: boolean;
    error: string | null;
}

const Web3Context = createContext<Web3ContextState | undefined>(undefined);

export function Web3Provider({ children }: { children: React.ReactNode }) {
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [signer, setSigner] = useState<Signer | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [nftContract, setNftContract] = useState<Contract | null>(null);
    const [marketplaceContract, setMarketplaceContract] = useState<Contract | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const NFT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
    const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS;
    const TARGET_NETWORK_ID = parseInt(process.env.NEXT_PUBLIC_NETWORK_ID || '31337', 10);

    const isValidNetwork = chainId === TARGET_NETWORK_ID;

    const resetState = useCallback(() => {
        setAccount(null);
        setSigner(null);
        setNftContract(null);
        setMarketplaceContract(null);
        setChainId(null);
    }, []);

    const initContracts = useCallback(async (currentSigner: Signer) => {
        if (!NFT_ADDRESS || !MARKETPLACE_ADDRESS) {
            setError('Contract addresses not configured in environment variables');
            return;
        }

        try {
            // Use standard ethers Contract with ABIs
            const nft = new ethers.Contract(NFT_ADDRESS, PokemonNFTABI.abi, currentSigner);
            const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, currentSigner);

            setNftContract(nft);
            setMarketplaceContract(marketplace);

            setNftContract(nft);
            setMarketplaceContract(marketplace);

            console.log('Contracts initialized successfully');
            console.log('Using NFT Address:', NFT_ADDRESS);
            console.log('Using Marketplace Address:', MARKETPLACE_ADDRESS);
        } catch (err: any) {
            console.error('Error initializing contracts:', err);
            setError('Failed to initialize contracts. ' + (err.message || ''));
        }
    }, [NFT_ADDRESS, MARKETPLACE_ADDRESS]);

    const connectWallet = useCallback(async () => {
        setIsConnecting(true);
        setError(null);

        try {
            if (typeof window === 'undefined' || !(window as any).ethereum) {
                throw new Error('MetaMask is not installed. Please install it to use this app.');
            }

            const browserProvider = new BrowserProvider((window as any).ethereum);
            setProvider(browserProvider);

            // Request accounts
            const accounts = await browserProvider.send('eth_requestAccounts', []);
            if (accounts.length === 0) {
                throw new Error('No accounts found. Please unlock your wallet.');
            }
            const currentAccount = accounts[0];
            setAccount(currentAccount);

            // Get network
            const network = await browserProvider.getNetwork();
            const currentChainId = Number(network.chainId);
            setChainId(currentChainId);

            if (currentChainId !== TARGET_NETWORK_ID) {
                console.warn(`Wrong network. Expected ${TARGET_NETWORK_ID}, got ${currentChainId}`);
                // Try to switch
                try {
                    await (window as any).ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x' + TARGET_NETWORK_ID.toString(16) }],
                    });
                } catch (switchError: any) {
                    if (switchError.code === 4902) {
                        setError('Network not added to MetaMask. Please add Hardhat network (Chain ID: 31337)');
                    }
                }
            }

            const currentSigner = await browserProvider.getSigner();
            setSigner(currentSigner);

            await initContracts(currentSigner);

        } catch (err: any) {
            console.error('Error connecting wallet:', err);
            setError(err.message || 'Failed to connect wallet');
            resetState();
        } finally {
            setIsConnecting(false);
        }
    }, [TARGET_NETWORK_ID, initContracts, resetState]);

    const disconnectWallet = useCallback(() => {
        resetState();
    }, [resetState]);

    // Listen for MetaMask events
    useEffect(() => {
        if (typeof window === 'undefined' || !(window as any).ethereum) return;

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else if (accounts[0] !== account) {
                connectWallet();
            }
        };

        const handleChainChanged = (_chainId: string) => {
            window.location.reload();
        };

        (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
        (window as any).ethereum.on('chainChanged', handleChainChanged);

        return () => {
            if ((window as any).ethereum.removeListener) {
                (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
                (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [account, connectWallet, disconnectWallet]);

    return (
        <Web3Context.Provider
            value={{
                provider,
                signer,
                account,
                chainId,
                nftContract,
                marketplaceContract,
                connectWallet,
                disconnectWallet,
                isValidNetwork,
                isConnecting,
                error,
            }}
        >
            {children}
        </Web3Context.Provider>
    );
}

export function useWeb3() {
    const context = useContext(Web3Context);
    if (context === undefined) {
        throw new Error('useWeb3 must be used within a Web3Provider');
    }
    return context;
}
