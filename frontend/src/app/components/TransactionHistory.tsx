import { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, Package, ShoppingCart, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { TransactionEvent } from '../types';
import api from '../services/api';

interface TransactionHistoryProps {
  tradeId: number;
  title: string;
  onClose: () => void;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  TradeCreated: { label: 'Trade Created', icon: ShoppingCart, color: 'text-purple-600 bg-purple-100' },
  TradeCancelled: { label: 'Trade Cancelled', icon: XCircle, color: 'text-slate-600 bg-slate-100' },
  TradeAcknowledged: { label: 'Trade Acknowledged', icon: Clock, color: 'text-amber-600 bg-amber-100' },
  FundsReleased: { label: 'Funds Released', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  FundsRefunded: { label: 'Funds Refunded', icon: AlertCircle, color: 'text-red-600 bg-red-100' },
};

export function TransactionHistory({ tradeId, title, onClose }: TransactionHistoryProps) {
  const [events, setEvents] = useState<TransactionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const history = await api.getTradeHistory(tradeId);
        setEvents(history);
      } catch (e) {
        console.error('Failed to fetch history:', e);
        setError('Failed to load transaction history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [tradeId]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTxHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderEventDetails = (event: TransactionEvent) => {
    const args = event.args;
    switch (event.event) {
      case 'TradeCreated':
        return (
          <div className="text-sm text-slate-600">
            <div>Buyer: {formatAddress(args.buyer as string)}</div>
            <div>Seller: {formatAddress(args.seller as string)}</div>
            <div>Price: {args.price as string} USDC</div>
            <div>Steam App ID: {args.steamAppId as number}</div>
          </div>
        );
      case 'TradeAcknowledged':
        return (
          <div className="text-sm text-slate-600">
            <div>Seller acknowledged the trade</div>
          </div>
        );
      case 'TradeCancelled':
        return (
          <div className="text-sm text-slate-600">
            <div>Trade was cancelled by buyer</div>
          </div>
        );
      case 'FundsReleased':
      case 'FundsRefunded':
        return (
          <div className="text-sm text-slate-600">
            <div>Recipient: {formatAddress(args.recipient as string)}</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Transaction History</h2>
            <p className="text-sm text-slate-500">{title} (Trade #{tradeId})</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-slate-600">Loading history...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No transaction history found
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="space-y-4">
              {events.map((event, index) => {
                const config = EVENT_CONFIG[event.event] || {
                  label: event.event,
                  icon: Clock,
                  color: 'text-slate-600 bg-slate-100'
                };
                const Icon = config.icon;

                return (
                  <div
                    key={`${event.txHash}-${index}`}
                    className="border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-900">{config.label}</span>
                          <span className="text-xs text-slate-500">
                            Block #{event.blockNumber}
                          </span>
                        </div>

                        <div className="text-sm text-slate-500 mb-2">
                          {formatTimestamp(event.timestamp)}
                        </div>

                        {renderEventDetails(event)}

                        <div className="mt-3 flex items-center gap-4 text-xs">
                          <div className="text-slate-500">
                            From: <span className="font-mono">{formatAddress(event.from)}</span>
                          </div>
                          <a
                            href={`#tx/${event.txHash}`}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          >
                            <span className="font-mono">{formatTxHash(event.txHash)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div className="text-xs text-slate-500 text-center">
            Showing {events.length} on-chain event{events.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
