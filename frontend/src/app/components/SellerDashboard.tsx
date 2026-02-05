import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Package, CheckCircle, AlertCircle, Plus, Clock, Shield, History } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { TransactionHistory } from './TransactionHistory';
import { Listing } from '../types';

export function SellerDashboard() {
  const { myListings, wallet, acknowledge, claimAfterWindow, createListing, cancelListing, refreshMyListings } = useApp();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newSteamAppId, setNewSteamAppId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [provingId, setProvingId] = useState<number | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const handleAcknowledge = async (listingId: number) => {
    try {
      await acknowledge(listingId);
      toast.success('Sale acknowledged! Dispute window started.');
    } catch (e) {
      console.error('Acknowledge failed:', e);
      toast.error('Failed to acknowledge sale');
    }
  };

  const handleClaimFunds = async (listingId: number) => {
    try {
      await claimAfterWindow(listingId);
      toast.success('Funds claimed successfully!');
    } catch (e) {
      console.error('Claim failed:', e);
      toast.error('Failed to claim funds. Dispute window may not have passed.');
    }
  };

  const handleProveOwnership = async (listingId: number) => {
    setProvingId(listingId);
    try {
      // TODO: In production, this would trigger the zkTLS prover
      // For now, submit proof directly showing buyer owns the game
      toast.info('Submitting ownership proof...');
      await api.submitProofResult(listingId, true);
      toast.success('Ownership verified! Funds released.');
      await refreshMyListings();
    } catch (e) {
      console.error('Prove ownership failed:', e);
      toast.error('Failed to prove ownership');
    } finally {
      setProvingId(null);
    }
  };

  const handleCancel = async (listingId: number) => {
    try {
      await cancelListing(listingId);
      toast.success('Listing cancelled');
    } catch (e) {
      console.error('Cancel failed:', e);
      toast.error('Failed to cancel listing');
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
      const listingId = await createListing(price, steamAppId);
      toast.success(`Listing created! ID: ${listingId}`);
      setShowCreateForm(false);
      setNewPrice('');
      setNewSteamAppId('');
    } catch (e) {
      console.error('Create listing failed:', e);
      toast.error('Failed to create listing');
    } finally {
      setIsCreating(false);
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

  const sellerListings = myListings.selling;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {selectedListing && (
        <TransactionHistory
          listingId={selectedListing.id}
          title={selectedListing.title || `Game #${selectedListing.steamAppId}`}
          onClose={() => setSelectedListing(null)}
        />
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Seller Dashboard</h1>
          <p className="text-slate-600">Manage your listings and sales</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Listing
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
              Common App IDs: Counter-Strike 2 (730), Elden Ring (1245620), Portal 2 (620), Dota 2 (570)
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

      {sellerListings.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No listings yet</h3>
          <p className="text-slate-600">Create a listing to start selling games</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sellerListings.map((listing) => (
            <div
              key={listing.id}
              className="bg-white rounded-lg border border-slate-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {listing.title || `Game #${listing.steamAppId}`}
                    </h3>
                    <StatusBadge status={listing.status} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500 mb-1">Price</div>
                      <div className="font-medium text-blue-600">{listing.price} USDC</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Steam App ID</div>
                      <div className="font-medium text-slate-900">{listing.steamAppId}</div>
                    </div>
                    {listing.buyer && (
                      <>
                        <div>
                          <div className="text-slate-500 mb-1">Buyer</div>
                          <div className="font-medium text-slate-900">
                            {listing.buyer.slice(0, 10)}...{listing.buyer.slice(-8)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 mb-1">Steam Username</div>
                          <div className="font-medium text-slate-900">
                            {listing.buyerSteamUsername}
                          </div>
                        </div>
                      </>
                    )}
                    {listing.disputeDeadline && listing.status === 'Acknowledged' && (
                      <div>
                        <div className="text-slate-500 mb-1">Dispute Deadline</div>
                        <div className="font-medium text-slate-900">
                          {new Date(listing.disputeDeadline * 1000).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-6 flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedListing(listing)}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-2"
                  >
                    <History className="w-4 h-4" />
                    View History
                  </button>
                  {listing.status === 'Open' && (
                    <button
                      onClick={() => handleCancel(listing.id)}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                    >
                      Cancel Listing
                    </button>
                  )}
                  {listing.status === 'Purchased' && (
                    <button
                      onClick={() => handleAcknowledge(listing.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Acknowledge Sale
                    </button>
                  )}
                  {listing.status === 'Acknowledged' && (
                    <>
                      <button
                        onClick={() => handleProveOwnership(listing.id)}
                        disabled={provingId === listing.id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap disabled:bg-blue-400 flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        {provingId === listing.id ? 'Proving...' : 'Prove Ownership'}
                      </button>
                      <button
                        onClick={() => handleClaimFunds(listing.id)}
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
                  {listing.status === 'Completed' && (
                    <div className="flex items-center gap-2 text-green-600 px-4 py-2 bg-green-50 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Completed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: 'bg-green-100 text-green-800',
    Purchased: 'bg-yellow-100 text-yellow-800',
    Acknowledged: 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Disputed: 'bg-red-100 text-red-800',
    Refunded: 'bg-slate-100 text-slate-800',
    Cancelled: 'bg-slate-100 text-slate-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
}
