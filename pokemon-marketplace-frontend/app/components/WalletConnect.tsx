'use client';

import { ethers } from 'ethers';

interface WalletConnectProps {
  account: string;
  setAccount: (account: string) => void;
  setProvider: (provider: ethers.BrowserProvider | null) => void;
}

export default function WalletConnect({ account, setAccount, setProvider }: WalletConnectProps) {
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        
        if (Number(network.chainId) !== 31337) {
          alert('Please connect to Hardhat Local Network (Chain ID: 31337)');
          return;
        }

        setAccount(accounts[0]);
        setProvider(provider);

        window.ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length === 0) {
            setAccount('');
            setProvider(null);
          } else {
            setAccount(accounts[0]);
          }
        });

        window.ethereum.on('chainChanged', () => {
          window.location.reload();
        });

      } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Failed to connect wallet. Make sure MetaMask is installed.');
      }
    } else {
      alert('Please install MetaMask to use this dApp!');
      window.open('https://metamask.io/download/', '_blank');
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setProvider(null);
  };

  if (account) {
    return (
      <div className="flex items-center gap-3">
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-mono text-sm">
          <span className="font-bold">✓</span> {account.slice(0, 6)}...{account.slice(-4)}
        </div>
        <button
          onClick={disconnectWallet}
          className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-all"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
    >
      🦊 Connect Wallet
    </button>
  );
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
