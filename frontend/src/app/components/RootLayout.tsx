import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { Wallet, ShoppingBag, Store, Gamepad2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

export function RootLayout() {
  const { wallet, connectWallet, disconnectWallet, isLoading } = useApp();
  const location = useLocation();
  const [isConnecting, setIsConnecting] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWallet();
      toast.success('Wallet connected!');
    } catch (e) {
      console.error('Failed to connect:', e);
      toast.error('Failed to connect wallet. Make sure MetaMask is installed.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212]">
      <nav className="bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-1.5 text-base font-bold text-white">
                <Gamepad2 className="w-5 h-5 text-[#0074e4]" />
                Gefion
              </Link>
              <div className="flex gap-0.5">
                <Link
                  to="/"
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                    isActive('/') && !isActive('/buyer') && !isActive('/seller')
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Store
                </Link>
                <Link
                  to="/buyer"
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    isActive('/buyer')
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Library
                </Link>
                <Link
                  to="/seller"
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    isActive('/seller')
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Sell
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {wallet.connected ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-medium text-white">${wallet.balance.toFixed(2)}</div>
                    <div className="text-[10px] text-gray-500">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded hover:bg-white/20 transition-all duration-200"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || isLoading}
                  className="px-4 py-1.5 bg-[#0074e4] text-white text-xs font-medium rounded hover:bg-[#0066cc] transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  {isConnecting ? 'Signing in...' : 'Sign In'}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
