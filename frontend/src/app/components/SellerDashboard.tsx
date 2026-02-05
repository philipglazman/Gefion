import { useApp } from '../context/AppContext';
import { Package, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function SellerDashboard() {
  const { purchases, wallet, updatePurchase } = useApp();

  const sellerPurchases = purchases.filter(
    (p) => p.sellerAddress.toLowerCase() === wallet.address.toLowerCase()
  );

  const handleAcknowledge = (purchaseId: string) => {
    updatePurchase(purchaseId, {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
    });
    toast.success('Sale acknowledged! Buyer can now confirm delivery.');
  };

  const handleProveOwnership = async (purchaseId: string) => {
    // Mock API call to prove ownership
    toast.info('Calling proof of ownership API...');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    updatePurchase(purchaseId, {
      status: 'completed',
    });
    toast.success('Ownership verified! Funds released from escrow.');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Seller Dashboard</h1>
        <p className="text-slate-600">Manage your pending sales and acknowledge purchases</p>
      </div>

      {sellerPurchases.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No sales yet</h3>
          <p className="text-slate-600">Your pending sales will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sellerPurchases.map((purchase) => (
            <div
              key={purchase.id}
              className="bg-white rounded-lg border border-slate-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {purchase.gameTitle}
                    </h3>
                    <StatusBadge status={purchase.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500 mb-1">Buyer</div>
                      <div className="font-medium text-slate-900">
                        {purchase.buyerAddress.slice(0, 10)}...{purchase.buyerAddress.slice(-8)}
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
                </div>
                <div className="ml-6 flex flex-col gap-2">
                  {purchase.status === 'pending' && (
                    <button
                      onClick={() => handleAcknowledge(purchase.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Acknowledge Sale
                    </button>
                  )}
                  {(purchase.status === 'acknowledged' || purchase.status === 'disputed') && (
                    <button
                      onClick={() => handleProveOwnership(purchase.id)}
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
