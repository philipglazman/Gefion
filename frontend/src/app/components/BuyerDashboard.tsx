import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Listing } from '../types';
import { ShoppingBag, AlertCircle, Clock, CheckCircle, Shield, History } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { TransactionHistory } from './TransactionHistory';

export function BuyerDashboard() {
  const { myListings, wallet, refreshMyListings } = useApp();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const handleConfirmReceipt = async (tradeId: number) => {
    setConfirmingId(tradeId);
    try {
      toast.info('Running zkTLS verification to confirm receipt...');
      // Run zkTLS proof to verify buyer owns the game - releases funds to seller
      const result = await api.requestVerification(tradeId);
      if (result.ownsGame) {
        toast.success('Receipt confirmed! Funds released to seller.');
      } else {
        toast.error('Verification shows you do not own the game');
      }
      await refreshMyListings();
    } catch (e) {
      console.error('Confirm receipt failed:', e);
      toast.error(`Failed to confirm receipt: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRequestVerification = async (tradeId: number) => {
    toast.info('Running zkTLS verification for dispute...');
    try {
      const result = await api.requestVerification(tradeId);
      if (!result.ownsGame) {
        toast.success('Dispute successful! Funds refunded.');
      } else {
        toast.info('Verification shows you own the game - funds released to seller.');
      }
      await refreshMyListings();
    } catch (e) {
      console.error('Verification request failed:', e);
      toast.error(`Verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
            Please connect your wallet to view your purchases
          </p>
        </div>
      </div>
    );
  }

  const buyerListings = myListings.buying;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {selectedListing && (
        <TransactionHistory
          tradeId={selectedListing.id}
          title={selectedListing.title || `Game #${selectedListing.steamAppId}`}
          onClose={() => setSelectedListing(null)}
        />
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">My Purchases</h1>
        <p className="text-slate-600">Track your game purchases and manage disputes</p>
      </div>

      {buyerListings.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No purchases yet</h3>
          <p className="text-slate-600">Your purchases will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {buyerListings.map((listing) => (
            <PurchaseCard
              key={listing.id}
              listing={listing}
              onRequestVerification={handleRequestVerification}
              onConfirmReceipt={handleConfirmReceipt}
              onViewHistory={() => setSelectedListing(listing)}
              isConfirming={confirmingId === listing.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PurchaseCard({
  listing,
  onRequestVerification,
  onConfirmReceipt,
  onViewHistory,
  isConfirming,
}: {
  listing: Listing;
  onRequestVerification: (id: number) => void;
  onConfirmReceipt: (id: number) => void;
  onViewHistory: () => void;
  isConfirming: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!listing.disputeDeadline) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const deadline = listing.disputeDeadline! * 1000; // Convert seconds to ms
      const difference = deadline - now;

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft('Expired');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [listing.disputeDeadline]);

  const canDispute = listing.status === 'Acknowledged' && timeLeft !== 'Expired';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-semibold text-slate-900">
              {listing.title || `Game #${listing.steamAppId}`}
            </h3>
            <StatusBadge status={listing.status} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <div className="text-slate-500 mb-1">Seller</div>
              <div className="font-medium text-slate-900">
                {listing.seller.slice(0, 10)}...{listing.seller.slice(-8)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Steam Username</div>
              <div className="font-medium text-slate-900">
                {listing.buyerSteamUsername}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Amount</div>
              <div className="font-medium text-blue-600">{listing.price} USDC</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Steam App ID</div>
              <div className="font-medium text-slate-900">{listing.steamAppId}</div>
            </div>
          </div>

          {canDispute && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-3 rounded-lg">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Dispute window closes in: {timeLeft}</span>
            </div>
          )}
        </div>

        <div className="ml-6 flex flex-col gap-2">
          <button
            onClick={onViewHistory}
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            View History
          </button>
          {listing.status === 'Pending' && (
            <div className="text-sm text-slate-600 text-right px-4 py-2 bg-yellow-50 rounded-lg">
              Waiting for seller to acknowledge
            </div>
          )}

          {listing.status === 'Acknowledged' && (
            <>
              <button
                onClick={() => onConfirmReceipt(listing.id)}
                disabled={isConfirming}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap disabled:bg-green-400 flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                {isConfirming ? 'Confirming...' : 'Confirm Receipt'}
              </button>
              {canDispute && (
                <button
                  onClick={() => onRequestVerification(listing.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  Dispute (Prove Non-Ownership)
                </button>
              )}
              <div className="text-xs text-slate-500 text-center">
                Confirm when you receive the game
              </div>
            </>
          )}

          {listing.status === 'Completed' && (
            <div className="flex items-center gap-2 text-green-600 px-4 py-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Completed</span>
            </div>
          )}

          {listing.status === 'Refunded' && (
            <div className="flex items-center gap-2 text-slate-600 px-4 py-2 bg-slate-100 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Refunded</span>
            </div>
          )}
        </div>
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
