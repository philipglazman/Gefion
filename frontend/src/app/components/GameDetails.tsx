import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useApp } from '../context/AppContext';
import { ArrowLeft, User, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function GameDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, wallet, purchase, connectWallet } = useApp();
  const [steamUsername, setSteamUsername] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const game = games.find((g) => g.id === id);

  if (!game) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-center text-slate-600">Game not found</p>
      </div>
    );
  }

  const handlePurchase = async () => {
    if (!wallet.connected) {
      try {
        await connectWallet();
      } catch {
        toast.error('Failed to connect wallet');
        return;
      }
    }

    if (!steamUsername.trim()) {
      toast.error('Please enter your Steam username');
      return;
    }

    if (wallet.balance < game.price) {
      toast.error('Insufficient USDC balance');
      return;
    }

    if (game.listingId === undefined) {
      toast.error('Invalid listing');
      return;
    }

    setIsProcessing(true);

    try {
      await purchase(game.listingId, steamUsername, game.price);
      toast.success('Purchase initiated! Funds deposited to escrow.');
      navigate('/buyer');
    } catch (e) {
      console.error('Purchase failed:', e);
      toast.error('Purchase failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid md:grid-cols-2 gap-8 p-8">
          <div>
            <div className="aspect-video overflow-hidden rounded-lg bg-slate-100 mb-4">
              <img
                src={game.image}
                alt={game.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>Seller: {game.seller}</span>
              </div>
              <div className="text-xs text-slate-500">
                Seller Address: {game.sellerAddress.slice(0, 10)}...{game.sellerAddress.slice(-8)}
              </div>
              {game.steamAppId && (
                <div className="text-xs text-slate-500">
                  Steam App ID: {game.steamAppId}
                </div>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">{game.title}</h1>
            <p className="text-slate-600 mb-6">{game.description}</p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="text-sm text-slate-600 mb-1">Price</div>
              <div className="text-3xl font-bold text-blue-600">{game.price} USDC</div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="steam-username" className="block text-sm font-medium text-slate-700 mb-2">
                  Steam Username
                </label>
                <input
                  type="text"
                  id="steam-username"
                  value={steamUsername}
                  onChange={(e) => setSteamUsername(e.target.value)}
                  placeholder="Enter your Steam username"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
              >
                {isProcessing ? 'Processing...' : wallet.connected ? 'Buy Now & Deposit to Escrow' : 'Connect Wallet & Buy'}
              </button>

              {wallet.connected && (
                <p className="text-sm text-center text-slate-500">
                  Balance: {wallet.balance.toFixed(2)} USDC
                </p>
              )}
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Escrow Protection</div>
                  <div>Your funds are held in escrow until the seller delivers the game</div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">1 Hour Dispute Window</div>
                  <div>You have 1 hour to dispute if you don't receive the game</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
