import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Package, CheckCircle, AlertCircle, Clock, Shield, History, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
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
  // Added from Steam API
  title?: string;
  image?: string;
}

export function SellerDashboard() {
  const { myListings, wallet, acknowledge, claimAfterWindow, refreshMyListings } = useApp();
  const [provingId, setProvingId] = useState<number | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Listing | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newSteamAppId, setNewSteamAppId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [offChainListings, setOffChainListings] = useState<OffChainListing[]>([]);

  // Fetch seller's off-chain listings
  const fetchOffChainListings = async () => {
    if (!wallet.connected || !wallet.address) return;
    try {
      const listings = await api.getSellerListings(wallet.address);
      // Enrich with Steam data
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
  }, [wallet.connected, wallet.address]);

  const handleAcknowledge = async (tradeId: number) => {
    try {
      await acknowledge(tradeId);
      toast.success('Trade acknowledged! Dispute window started.');
    } catch (e) {
      console.error('Acknowledge failed:', e);
      toast.error('Failed to acknowledge trade');
    }
  };

  const handleClaimFunds = async (tradeId: number) => {
    try {
      await claimAfterWindow(tradeId);
      toast.success('Funds claimed successfully!');
    } catch (e) {
      console.error('Claim failed:', e);
      toast.error('Failed to claim funds. Dispute window may not have passed.');
    }
  };

  const handleProveOwnership = async (tradeId: number) => {
    setProvingId(tradeId);
    try {
      toast.info('Running zkTLS verification...');
      const result = await api.requestVerification(tradeId);
      if (result.ownsGame) {
        toast.success('Buyer ownership verified! Funds released.');
      } else {
        toast.info('Buyer does not own the game - funds refunded to buyer.');
      }
      await refreshMyListings();
    } catch (e) {
      console.error('Prove ownership failed:', e);
      toast.error(`Verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setProvingId(null);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newPrice);
    const steamAppId = parseInt(newSteamAppId);

    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    if (isNaN(steamAppId) || steamAppId <= 0) {
      toast.error('Please enter a valid Steam App ID');
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.createListing(wallet.address, steamAppId, price);
      toast.success(`Listing created! ID: ${result.id}`);
      setShowCreateForm(false);
      setNewPrice('');
      setNewSteamAppId('');
      await fetchOffChainListings();
    } catch (e) {
      console.error('Create listing failed:', e);
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
      toast.error('Failed to cancel listing');
    }
  };

  if (!wallet.connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Wallet Not Connected
          </h2>
          <p className="text-slate-600">
            Please connect your wallet to view your seller dashboard
          </p>
        </div>
      </div>
    );
  }

  const sellerTrades = myListings.selling;
  const activeListings = offChainListings.filter(l => l.status === 'active');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {selectedTrade && (
        <TransactionHistory
          tradeId={selectedTrade.id}
          title={selectedTrade.title || `Game #${selectedTrade.steamAppId}`}
          onClose={() => setSelectedTrade(null)}
        />
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Seller Dashboard</h1>
          <p className="text-slate-600">Create listings and manage escrow trades</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showCreateForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showCreateForm ? 'Cancel' : 'Create Listing'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Listing</h3>
          <form onSubmit={handleCreateListing} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Price (USDC)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="e.g. 29.99"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Steam App ID
                </label>
                <input
                  type="number"
                  value={newSteamAppId}
                  onChange={(e) => setNewSteamAppId(e.target.value)}
                  placeholder="e.g. 730 (CS2)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Common App IDs: Counter-Strike 2 (730), Elden Ring (1245620), Portal 2 (620), Euro Truck Simulator 2 (227300)
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-300"
              >
                {isCreating ? 'Creating...' : 'Create Listing'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Listings Section */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Your Listings</h2>
        {activeListings.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No active listings</h3>
            <p className="text-slate-600">Create a listing to start selling games</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeListings.map((listing) => (
              <div key={listing.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                {listing.image && (
                  <img src={listing.image} alt={listing.title} className="w-full h-32 object-cover" />
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {listing.title || `Game #${listing.steamAppId}`}
                  </h3>
                  <div className="text-lg font-bold text-blue-600 mb-3">${listing.price} USDC</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">ID: {listing.steamAppId}</span>
                    <button
                      onClick={() => handleCancelListing(listing.id)}
                      className="text-sm text-red-600 hover:text-red-700"
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

      {/* Incoming Trades Section */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Incoming Trades</h2>
        {sellerTrades.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No incoming trades</h3>
            <p className="text-slate-600">When buyers initiate escrow with you, trades appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sellerTrades.map((trade) => (
              <div
                key={trade.id}
                className="bg-white rounded-lg border border-slate-200 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-slate-900">
                        {trade.title || `Game #${trade.steamAppId}`}
                      </h3>
                      <StatusBadge status={trade.status} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-slate-500 mb-1">Price</div>
                        <div className="font-medium text-blue-600">{trade.price} USDC</div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Steam App ID</div>
                        <div className="font-medium text-slate-900">{trade.steamAppId}</div>
                      </div>
                      {trade.buyer && (
                        <>
                          <div>
                            <div className="text-slate-500 mb-1">Buyer</div>
                            <div className="font-medium text-slate-900">
                              {trade.buyer.slice(0, 10)}...{trade.buyer.slice(-8)}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Steam Username</div>
                            <div className="font-medium text-slate-900">
                              {trade.buyerSteamUsername}
                            </div>
                          </div>
                        </>
                      )}
                      {trade.disputeDeadline && trade.status === 'Acknowledged' && (
                        <div>
                          <div className="text-slate-500 mb-1">Dispute Deadline</div>
                          <div className="font-medium text-slate-900">
                            {new Date(trade.disputeDeadline * 1000).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-6 flex flex-col gap-2">
                    <button
                      onClick={() => setSelectedTrade(trade)}
                      className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-2"
                    >
                      <History className="w-4 h-4" />
                      View History
                    </button>
                    {trade.status === 'Pending' && (
                      <button
                        onClick={() => handleAcknowledge(trade.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Acknowledge Trade
                      </button>
                    )}
                    {trade.status === 'Acknowledged' && (
                      <>
                        <button
                          onClick={() => handleProveOwnership(trade.id)}
                          disabled={provingId === trade.id}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap disabled:bg-blue-400 flex items-center gap-2"
                        >
                          <Shield className="w-4 h-4" />
                          {provingId === trade.id ? 'Proving...' : 'Prove Ownership'}
                        </button>
                        <button
                          onClick={() => handleClaimFunds(trade.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                        >
                          Claim Funds
                        </button>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          Claim after window or prove now
                        </div>
                      </>
                    )}
                    {trade.status === 'Completed' && (
                      <div className="flex items-center gap-2 text-green-600 px-4 py-2 bg-green-50 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Completed</span>
                      </div>
                    )}
                    {trade.status === 'Refunded' && (
                      <div className="flex items-center gap-2 text-slate-600 px-4 py-2 bg-slate-100 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Refunded</span>
                      </div>
                    )}
                    {trade.status === 'Cancelled' && (
                      <div className="flex items-center gap-2 text-slate-600 px-4 py-2 bg-slate-100 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Cancelled</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Acknowledged: 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Refunded: 'bg-slate-100 text-slate-800',
    Cancelled: 'bg-slate-100 text-slate-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
}
