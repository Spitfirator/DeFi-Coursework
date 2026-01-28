import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { Store, Wallet, Shield, Zap } from 'lucide-react';

function Home() {
  const { account, connectWallet, isConnecting } = useWeb3();

  const features = [
    {
      icon: Store,
      title: 'Trade Cards',
      description: 'Buy and sell Pokemon cards with fixed prices or through exciting auctions'
    },
    {
      icon: Shield,
      title: 'Secure Trading',
      description: 'Smart contract escrow ensures safe and trustless transactions'
    },
    {
      icon: Zap,
      title: 'Instant Settlement',
      description: 'Blockchain-powered instant ownership transfer on purchase'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-16">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-primary via-secondary to-pink-500 bg-clip-text text-transparent">
            Pokemon Card Trading
          </span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          Collect, trade, and auction rare Pokemon cards as NFTs on the blockchain. 
          Your favorite cards, truly owned by you.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {account ? (
            <>
              <Link
                to="/marketplace"
                className="px-8 py-3 bg-gradient-to-r from-primary to-secondary rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Explore Marketplace
              </Link>
              <Link
                to="/my-cards"
                className="px-8 py-3 bg-gray-800 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                View My Cards
              </Link>
            </>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-primary to-secondary rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Wallet size={20} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet to Start'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-6 py-12">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
              <feature.icon className="text-primary" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
            <p className="text-gray-400">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8 mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">10,000</div>
            <div className="text-gray-400">Max Supply</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-secondary">151+</div>
            <div className="text-gray-400">Pokemon</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-pink-500">2.5%</div>
            <div className="text-gray-400">Platform Fee</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-500">0.01</div>
            <div className="text-gray-400">ETH Mint Price</div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: 1, title: 'Connect Wallet', desc: 'Link your MetaMask wallet' },
            { step: 2, title: 'Get Cards', desc: 'Mint or buy from marketplace' },
            { step: 3, title: 'Trade', desc: 'List for sale or create auctions' },
            { step: 4, title: 'Collect', desc: 'Build your ultimate collection' }
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                {item.step}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
