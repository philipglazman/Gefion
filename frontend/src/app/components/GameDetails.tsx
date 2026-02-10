import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Shield, Clock, CheckCircle } from 'lucide-react';
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
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Game not found</p>
          <Link to="/" className="text-[#0074e4] hover:underline mt-3 inline-block text-sm">
            Back to Store
          </Link>
        </div>
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
      toast.error('Insufficient balance');
      return;
    }

    if (!game.steamAppId || !game.sellerAddress) {
      toast.error('Invalid listing');
      return;
    }

    setIsProcessing(true);

    try {
      await purchase(game.steamAppId, game.sellerAddress, steamUsername, game.price, game.listingId);
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
    <div className="min-h-screen bg-[#121212]">
      {/* Hero Background */}
      <div className="relative h-[200px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={game.image}
            alt={game.title}
            className="w-full h-full object-cover blur-sm scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] to-[#121212]/40" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10 pb-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white mb-4 transition-colors text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Store
        </Link>

        <div className="grid lg:grid-cols-[1fr,320px] gap-6">
          {/* Left Column - Game Info */}
          <div>
            <div className="rounded overflow-hidden shadow-2xl mb-4">
              <img
                src={game.image}
                alt={game.title}
                className="w-full aspect-video object-cover"
              />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">{game.title}</h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">{game.description}</p>

            {/* Game Details */}
            <div className="bg-[#1a1a1a] rounded p-4">
              <h3 className="text-white text-sm font-medium mb-3">Game Details</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-500 mb-0.5">Steam App ID</div>
                  <div className="text-white">{game.steamAppId}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-0.5">Seller</div>
                  <div className="text-white">{game.seller}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-0.5">Seller Address</div>
                  <div className="text-white font-mono text-[10px]">
                    {game.sellerAddress}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Purchase Card */}
          <div className="lg:sticky lg:top-16 h-fit">
            <div className="bg-[#1a1a1a] rounded overflow-hidden">
              <div className="p-4">
                <div className="text-gray-400 text-xs mb-1">Price</div>
                <div className="text-2xl font-bold text-white mb-4">${game.price}</div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label htmlFor="steam-username" className="block text-xs text-gray-400 mb-1.5">
                      Your Steam Username
                    </label>
                    <input
                      type="text"
                      id="steam-username"
                      value={steamUsername}
                      onChange={(e) => setSteamUsername(e.target.value)}
                      placeholder="Enter Steam username"
                      className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0074e4] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={handlePurchase}
                  disabled={isProcessing}
                  className="w-full py-2.5 bg-[#0074e4] text-white text-sm font-medium rounded hover:bg-[#0066cc] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing
                    ? 'Processing...'
                    : wallet.connected
                    ? 'Buy Now'
                    : 'Sign In & Buy'}
                </button>

                {wallet.connected && (
                  <p className="text-center text-gray-500 text-xs mt-2">
                    Balance: ${wallet.balance.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Trust Indicators */}
              <div className="border-t border-white/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-[#00d26a] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white text-xs font-medium">Escrow Protection</div>
                    <div className="text-gray-500 text-[10px]">Funds held until delivery</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[#0074e4] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white text-xs font-medium">1 Hour Dispute Window</div>
                    <div className="text-gray-500 text-[10px]">Time to verify and dispute</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#00b4d8] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white text-xs font-medium">zkTLS Verified</div>
                    <div className="text-gray-500 text-[10px]">Cryptographic ownership proof</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
