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
      toast.info('Running zkTLS verification...');
      const result = await api.requestVerification(tradeId);
      if (result.ownsGame) {
        toast.success('Receipt confirmed! Funds released to seller.');
      } else {
        toast.error('Verification shows you do not own the game');
      }
      await refreshMyListings();
    } catch (e) {
      console.error('Confirm receipt failed:', e);
      toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
        toast.info('Verification shows you own the game - funds released.');
      }
      await refreshMyListings();
    } catch (e) {
      console.error('Verification failed:', e);
      toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="bg-[#1a1a1a] border border-white/10 rounded p-6 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-[#ffaa00] mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">Wallet Not Connected</h2>
          <p className="text-gray-400 text-sm">Connect your wallet to view purchases</p>
        </div>
      </div>
    );
  }

  const buyerListings = myListings.buying;

  return (
    <div className="min-h-screen bg-[#121212]">
      {selectedListing && (
        <TransactionHistory
          tradeId={selectedListing.id}
          title={selectedListing.title || `Game #${selectedListing.steamAppId}`}
          onClose={() => setSelectedListing(null)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Library</h1>
          <p className="text-gray-400 text-sm">Track purchases and manage disputes</p>
        </div>

        {buyerListings.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded border border-white/5 p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">No purchases yet</h3>
            <p className="text-gray-500 text-xs">Your purchased games will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
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
      const deadline = listing.disputeDeadline! * 1000;
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
    <div className="bg-[#1a1a1a] rounded border border-white/5 overflow-hidden">
      <div className="flex">
        {listing.image && (
          <div className="w-32 flex-shrink-0">
            <img src={listing.image} alt={listing.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-white truncate">
                  {listing.title || `Game #${listing.steamAppId}`}
                </h3>
                <StatusBadge status={listing.status} />
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs mb-2">
                <div>
                  <div className="text-gray-500 mb-0.5">Seller</div>
                  <div className="text-white font-mono text-[10px]">
                    {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 mb-0.5">Steam User</div>
                  <div className="text-white truncate">{listing.buyerSteamUsername}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-0.5">Amount</div>
                  <div className="text-[#0074e4] font-bold">{listing.price} USDC</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-0.5">App ID</div>
                  <div className="text-white">{listing.steamAppId}</div>
                </div>
              </div>

              {canDispute && (
                <div className="inline-flex items-center gap-1.5 text-[#ffaa00] bg-[#ffaa00]/10 px-2 py-1 rounded text-xs">
                  <Clock className="w-3 h-3" />
                  <span>Dispute: {timeLeft}</span>
                </div>
              )}
            </div>

            <div className="ml-4 flex flex-col gap-1.5">
              <button
                onClick={onViewHistory}
                className="px-2.5 py-1 border border-white/10 text-gray-400 rounded hover:bg-white/5 hover:text-white transition-all text-xs flex items-center gap-1"
              >
                <History className="w-3 h-3" />
                History
              </button>

              {listing.status === 'Pending' && (
                <div className="text-[10px] text-gray-500 px-2.5 py-1 bg-[#2a2a2a] rounded text-center">
                  Waiting for seller
                </div>
              )}

              {listing.status === 'Acknowledged' && (
                <>
                  <button
                    onClick={() => onConfirmReceipt(listing.id)}
                    disabled={isConfirming}
                    className="px-2.5 py-1 bg-[#00d26a] text-white rounded hover:bg-[#00b85c] transition-all disabled:opacity-50 text-xs flex items-center gap-1"
                  >
                    <Shield className="w-3 h-3" />
                    {isConfirming ? 'Verifying...' : 'Confirm'}
                  </button>
                  {canDispute && (
                    <button
                      onClick={() => onRequestVerification(listing.id)}
                      className="px-2.5 py-1 bg-[#ff4444] text-white rounded hover:bg-[#e63c3c] transition-all text-xs"
                    >
                      Dispute
                    </button>
                  )}
                </>
              )}

              {listing.status === 'Completed' && (
                <div className="flex items-center gap-1 text-[#00d26a] px-2.5 py-1 bg-[#00d26a]/10 rounded text-xs">
                  <CheckCircle className="w-3 h-3" />
                  Completed
                </div>
              )}

              {listing.status === 'Refunded' && (
                <div className="flex items-center gap-1 text-gray-400 px-2.5 py-1 bg-white/5 rounded text-xs">
                  <CheckCircle className="w-3 h-3" />
                  Refunded
                </div>
              )}
            </div>
          </div>
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
