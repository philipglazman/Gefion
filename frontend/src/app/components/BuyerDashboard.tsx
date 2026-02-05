import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function BuyerDashboard() {
  const { purchases, wallet, updatePurchase } = useApp();

  const buyerPurchases = purchases.filter(
    (p) => p.buyerAddress.toLowerCase() === wallet.address.toLowerCase()
  );

  const handleDispute = async (purchaseId: string) => {
    // Mock API call to prove non-ownership
    toast.info('Calling proof of non-ownership API...');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    updatePurchase(purchaseId, {
      status: 'refunded',
    });
    toast.success('Ownership not proven. Funds refunded from escrow.');
  };

  const handleProveOwnership = async (purchaseId: string) => {
    // Mock API call to prove ownership
    toast.info('Calling proof of ownership API...');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    updatePurchase(purchaseId, {
      status: 'completed',
    });
    toast.success('Ownership verified! Transaction completed.');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">My Purchases</h1>
        <p className="text-slate-600">Track your game purchases and manage disputes</p>
      </div>

      {buyerPurchases.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No purchases yet</h3>
          <p className="text-slate-600">Your purchases will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {buyerPurchases.map((purchase) => (
            <PurchaseCard
              key={purchase.id}
              purchase={purchase}
              onDispute={handleDispute}
              onProveOwnership={handleProveOwnership}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PurchaseCard({
  purchase,
  onDispute,
  onProveOwnership,
}: {
  purchase: any;
  onDispute: (id: string) => void;
  onProveOwnership: (id: string) => void;
}) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const deadline = new Date(purchase.disputeDeadline).getTime();
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
  }, [purchase.disputeDeadline]);

  const canDispute = purchase.status !== 'completed' && purchase.status !== 'refunded' && timeLeft !== 'Expired';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-semibold text-slate-900">
              {purchase.gameTitle}
            </h3>
            <StatusBadge status={purchase.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="text-slate-500 mb-1">Seller</div>
              <div className="font-medium text-slate-900">
                {purchase.sellerAddress.slice(0, 10)}...{purchase.sellerAddress.slice(-8)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Steam Username</div>
              <div className="font-medium text-slate-900">
                {purchase.buyerSteamUsername}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Amount</div>
              <div className="font-medium text-blue-600">{purchase.price} USDC</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Purchase Time</div>
              <div className="font-medium text-slate-900">
                {purchase.createdAt.toLocaleString()}
              </div>
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
          {purchase.status === 'pending' && (
            <div className="text-sm text-slate-600 text-right px-4 py-2 bg-yellow-50 rounded-lg">
              Waiting for seller to acknowledge
            </div>
          )}

          {purchase.status === 'acknowledged' && canDispute && (
            <>
              <button
                onClick={() => onProveOwnership(purchase.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                Prove Ownership
              </button>
              <button
                onClick={() => onDispute(purchase.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                Dispute
              </button>
            </>
          )}

          {purchase.status === 'disputed' && (
            <button
              onClick={() => onProveOwnership(purchase.id)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
            >
              Prove Ownership
            </button>
          )}

          {purchase.status === 'completed' && (
            <div className="flex items-center gap-2 text-green-600 px-4 py-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Completed</span>
            </div>
          )}

          {purchase.status === 'refunded' && (
            <div className="text-sm text-slate-600 px-4 py-2 bg-slate-100 rounded-lg">
              Refunded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    acknowledged: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    disputed: 'bg-red-100 text-red-800',
    refunded: 'bg-slate-100 text-slate-800',
  };

  const labels = {
    pending: 'Pending',
    acknowledged: 'Acknowledged',
    completed: 'Completed',
    disputed: 'Disputed',
    refunded: 'Refunded',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
      {labels[status as keyof typeof labels]}
    </span>
  );
}
