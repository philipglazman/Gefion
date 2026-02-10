import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Package, CheckCircle, AlertCircle, Clock, Shield, History, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { blockchain } from '../services/blockchain';
import { TransactionHistory } from './TransactionHistory';
import { Listing } from '../types';

interface OffChainListing {
  id: number;
  seller: string;
  steamAppId: number;
  price: number;
  description: string;
  status: string;
  createdAt: number;
  title?: string;
  image?: string;
}

export function SellerDashboard() {
  const { myListings, wallet, acknowledge, claimAfterWindow, cancelTrade, refreshMyListings } = useApp();
  const [provingId, setProvingId] = useState<number | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Listing | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newSteamAppId, setNewSteamAppId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [offChainListings, setOffChainListings] = useState<OffChainListing[]>([]);

  const fetchOffChainListings = async () => {
    if (!wallet.connected || !wallet.address) return;
    try {
      const listings = await api.getSellerListings(wallet.address);
      if (listings.length > 0) {
        const appIds = listings.map(l => l.steamAppId);
        try {
          const steamData = await api.getSteamGames(appIds);
          const enriched = listings.map(l => ({
            ...l,
            title: steamData[l.steamAppId]?.name || `Game #${l.steamAppId}`,
            image: steamData[l.steamAppId]?.headerImage,
          }));
          setOffChainListings(enriched);
        } catch {
          setOffChainListings(listings);
        }
      } else {
        setOffChainListings([]);
      }
    } catch (e) {
      console.error('Failed to fetch listings:', e);
    }
  };

  useEffect(() => {
    fetchOffChainListings();
    refreshMyListings();
  }, [wallet.connected, wallet.address]);

  const handleCancelTrade = async (tradeId: number) => {
    try {
      await cancelTrade(tradeId);
      toast.success('Trade cancelled. Funds returned to buyer.');
      await refreshMyListings();
    } catch (e) {
      console.error('Cancel failed:', e);
      toast.error('Failed to cancel trade');
    }
  };

  const handleAcknowledge = async (tradeId: number) => {
    try {
      await acknowledge(tradeId);
      toast.success('Trade acknowledged!');
    } catch (e) {
      console.error('Acknowledge failed:', e);
      toast.error('Failed to acknowledge');
    }
  };

  const handleClaimFunds = async (tradeId: number) => {
    try {
      await claimAfterWindow(tradeId);
      toast.success('Funds claimed!');
    } catch (e) {
      console.error('Claim failed:', e);
      toast.error('Failed to claim. Window may not have passed.');
    }
  };

  const handleProveOwnership = async (tradeId: number) => {
    setProvingId(tradeId);
    try {
      toast.info('Running zkTLS verification...');
      const result = await api.requestVerification(tradeId);
      if (result.ownsGame) {
        toast.success('Verified! Funds released.');
      } else {
        toast.info('Buyer does not own game - refunded.');
      }
      await refreshMyListings();
    } catch (e) {
      console.error('Prove failed:', e);
      toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setProvingId(null);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newPrice);

    // Parse Steam App ID from raw ID or Steam store URL
    let steamAppId: number;
    const urlMatch = newSteamAppId.match(/(?:store\.steampowered|steamcommunity)\.com\/app\/(\d+)/);
    if (urlMatch) {
      steamAppId = parseInt(urlMatch[1]);
    } else {
      steamAppId = parseInt(newSteamAppId);
    }

    if (isNaN(price) || price <= 0) {
      toast.error('Enter a valid price');
      return;
    }

    if (isNaN(steamAppId) || steamAppId <= 0) {
      toast.error('Enter a valid Steam App ID or URL');
      return;
    }

    setIsCreating(true);
    try {
      const nativeBalance = await blockchain.getNativeBalance(wallet.address);
      if (nativeBalance === 0) {
        toast.error('You need MON on the Monad network to pay for gas fees. Please fund your wallet before creating a listing.');
        setIsCreating(false);
        return;
      }

      const result = await api.createListing(wallet.address, steamAppId, price);
      toast.success(`Listing created! ID: ${result.id}`);
      setShowCreateForm(false);
      setNewPrice('');
      setNewSteamAppId('');
      await fetchOffChainListings();
    } catch (e) {
      console.error('Create failed:', e);
      toast.error('Failed to create listing');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelListing = async (listingId: number) => {
    try {
      await api.cancelListing(listingId, wallet.address);
      toast.success('Listing cancelled');
      await fetchOffChainListings();
    } catch (e) {
      console.error('Cancel failed:', e);
      toast.error('Failed to cancel');
    }
  };

  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="bg-[#1a1a1a] border border-white/10 rounded p-6 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-[#ffaa00] mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">Please Sign In</h2>
          <p className="text-gray-400 text-sm">Sign in to access your dashboard</p>
        </div>
      </div>
    );
  }

  const sellerTrades = myListings.selling;
  const activeListings = offChainListings.filter(l => l.status === 'active');

  return (
    <div className="min-h-screen bg-[#121212]">
      {selectedTrade && (
        <TransactionHistory
          tradeId={selectedTrade.id}
          title={selectedTrade.title || `Game #${selectedTrade.steamAppId}`}
          onClose={() => setSelectedTrade(null)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Seller Dashboard</h1>
            <p className="text-gray-400 text-sm">Create listings and manage trades</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0074e4] text-white text-xs font-medium rounded hover:bg-[#0066cc] transition-all"
          >
            {showCreateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showCreateForm ? 'Cancel' : 'Create Listing'}
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-[#1a1a1a] rounded border border-white/5 p-4 mb-6">
            <h3 className="text-sm font-semibold text-white mb-3">Create New Listing</h3>
            <form onSubmit={handleCreateListing} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="29.99"
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0074e4]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Steam App ID or URL</label>
                  <input
                    type="text"
                    value={newSteamAppId}
                    onChange={(e) => setNewSteamAppId(e.target.value)}
                    placeholder="550 or https://store.steampowered.com/app/550/Left_4_Dead_2"
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0074e4]"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-500">
                Common IDs: CS2 (730), Elden Ring (1245620), Portal 2 (620)
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-3 py-1.5 bg-[#00d26a] text-white text-xs font-medium rounded hover:bg-[#00b85c] transition-all disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 border border-white/10 text-gray-400 rounded hover:bg-white/5 transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active Listings */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">Your Listings</h2>
          {activeListings.length === 0 ? (
            <div className="bg-[#1a1a1a] rounded border border-white/5 p-8 text-center">
              <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <h3 className="text-xs font-medium text-white mb-1">No active listings</h3>
              <p className="text-gray-500 text-[10px]">Create a listing to start selling</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {activeListings.map((listing) => (
                <div key={listing.id} className="group bg-[#1a1a1a] rounded border border-white/5 overflow-hidden hover:border-white/10 transition-all">
                  {listing.image && (
                    <div className="aspect-video overflow-hidden">
                      <img src={listing.image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-white mb-0.5 truncate">
                      {listing.title || `Game #${listing.steamAppId}`}
                    </h3>
                    <div className="text-sm font-bold text-[#0074e4] mb-2">${listing.price}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">#{listing.steamAppId}</span>
                      <button
                        onClick={() => handleCancelListing(listing.id)}
                        className="text-[10px] text-[#ff4444] hover:text-[#ff6666] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Trades */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Incoming Trades</h2>
          {sellerTrades.length === 0 ? (
            <div className="bg-[#1a1a1a] rounded border border-white/5 p-8 text-center">
              <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <h3 className="text-xs font-medium text-white mb-1">No incoming trades</h3>
              <p className="text-gray-500 text-[10px]">Trades from buyers appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sellerTrades.map((trade) => (
                <div key={trade.id} className="bg-[#1a1a1a] rounded border border-white/5 overflow-hidden">
                  <div className="flex">
                    {trade.image && (
                      <div className="w-32 flex-shrink-0">
                        <img src={trade.image} alt={trade.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-white truncate">
                              {trade.title || `Game #${trade.steamAppId}`}
                            </h3>
                            <StatusBadge status={trade.status} />
                          </div>
                          <div className="grid grid-cols-4 gap-3 text-xs">
                            <div>
                              <div className="text-gray-500 mb-0.5">Price</div>
                              <div className="text-[#0074e4] font-bold">${trade.price}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 mb-0.5">App ID</div>
                              <div className="text-white">{trade.steamAppId}</div>
                            </div>
                            {trade.buyer && (
                              <>
                                <div>
                                  <div className="text-gray-500 mb-0.5">Buyer</div>
                                  <div className="text-white font-mono text-[10px]">
                                    {trade.buyer.slice(0, 6)}...{trade.buyer.slice(-4)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 mb-0.5">Steam User</div>
                                  <div className="text-white truncate">{trade.buyerSteamUsername}</div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col gap-1.5">
                          <button
                            onClick={() => setSelectedTrade(trade)}
                            className="px-2.5 py-1 border border-white/10 text-gray-400 rounded hover:bg-white/5 hover:text-white transition-all text-xs flex items-center gap-1"
                          >
                            <History className="w-3 h-3" />
                            History
                          </button>
                          {trade.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleAcknowledge(trade.id)}
                                className="px-2.5 py-1 bg-[#0074e4] text-white rounded hover:bg-[#0066cc] transition-all text-xs"
                              >
                                Acknowledge
                              </button>
                              <button
                                onClick={() => handleCancelTrade(trade.id)}
                                className="px-2.5 py-1 bg-[#ff4444] text-white rounded hover:bg-[#cc3333] transition-all text-xs"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {trade.status === 'Acknowledged' && (
                            <>
                              <button
                                onClick={() => handleProveOwnership(trade.id)}
                                disabled={provingId === trade.id}
                                className="px-2.5 py-1 bg-[#0074e4] text-white rounded hover:bg-[#0066cc] transition-all disabled:opacity-50 text-xs flex items-center gap-1"
                              >
                                <Shield className="w-3 h-3" />
                                {provingId === trade.id ? 'Proving...' : 'Verify'}
                              </button>
                              <button
                                onClick={() => handleClaimFunds(trade.id)}
                                className="px-2.5 py-1 bg-[#00d26a] text-white rounded hover:bg-[#00b85c] transition-all text-xs"
                              >
                                Claim
                              </button>
                              <p className="flex items-center gap-1 text-[10px] text-gray-500">
                                <Clock className="w-2.5 h-2.5" />
                                After window or verify
                              </p>
                            </>
                          )}
                          {trade.status === 'Completed' && (
                            <div className="flex items-center gap-1 text-[#00d26a] px-2.5 py-1 bg-[#00d26a]/10 rounded text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </div>
                          )}
                          {trade.status === 'Refunded' && (
                            <div className="flex items-center gap-1 text-gray-400 px-2.5 py-1 bg-white/5 rounded text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Refunded
                            </div>
                          )}
                          {trade.status === 'Cancelled' && (
                            <div className="flex items-center gap-1 text-gray-400 px-2.5 py-1 bg-white/5 rounded text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Cancelled
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'bg-[#ffaa00]/20 text-[#ffaa00]',
    Acknowledged: 'bg-[#0074e4]/20 text-[#0074e4]',
    Completed: 'bg-[#00d26a]/20 text-[#00d26a]',
    Refunded: 'bg-white/10 text-gray-400',
    Cancelled: 'bg-white/10 text-gray-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[status] || 'bg-white/10 text-gray-400'}`}>
      {status}
    </span>
  );
}
