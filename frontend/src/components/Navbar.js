import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { useCart } from '../context/CartContext';
import { Wallet, Store, Grid, AlertTriangle, ShoppingCart } from 'lucide-react';
import CartModal from './CartModal';

function Navbar() {
  const { account, isConnecting, isCorrectNetwork, connectWallet, disconnectWallet, switchNetwork } = useWeb3();
  const { cartItems } = useCart();
  const [showCart, setShowCart] = useState(false);
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'Home', icon: Grid },
    { path: '/marketplace', label: 'Marketplace', icon: Store },
    { path: '/collection', label: 'Collection', icon: Grid },
    { path: '/my-cards', label: 'My Cards', icon: Wallet },
  ];

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <nav className="bg-darker/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold">P</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              PokéTrade
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${location.pathname === path
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-3">
            {/* Cart Button */}
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
              title="Shopping Cart"
            >
              <ShoppingCart size={22} />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </button>

            {account && !isCorrectNetwork && (
              <button
                onClick={switchNetwork}
                className="flex items-center space-x-2 px-3 py-2 bg-yellow-500/20 text-yellow-500 rounded-lg text-sm"
              >
                <AlertTriangle size={16} />
                <span>Wrong Network</span>
              </button>
            )}

            {account ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-mono">{formatAddress(account)}</span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-primary to-secondary rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Wallet size={18} />
                <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cart Modal */}
      <CartModal isOpen={showCart} onClose={() => setShowCart(false)} />
    </nav>
  );
}

export default Navbar;
