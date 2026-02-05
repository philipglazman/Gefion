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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                <Gamepad2 className="w-6 h-6 text-blue-600" />
                Gefion
              </Link>
              <div className="flex gap-1">
                <Link
                  to="/"
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isActive('/') && !isActive('/buyer') && !isActive('/seller')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Marketplace
                </Link>
                <Link
                  to="/buyer"
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    isActive('/buyer')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  My Purchases
                </Link>
                <Link
                  to="/seller"
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    isActive('/seller')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  Seller Dashboard
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {wallet.connected ? (
                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-600">
                    <div className="font-medium">{wallet.balance.toFixed(2)} USDC</div>
                    <div className="text-xs text-slate-500">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-blue-400"
                >
                  <Wallet className="w-4 h-4" />
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
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
