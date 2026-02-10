import { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, ShoppingCart, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { TransactionEvent } from '../types';
import api from '../services/api';
import { getTxExplorerUrl } from '../config';

interface TransactionHistoryProps {
  tradeId: number;
  title: string;
  onClose: () => void;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  TradeCreated: { label: 'Trade Created', icon: ShoppingCart, color: 'text-purple-400 bg-purple-400/20' },
  TradeCancelled: { label: 'Trade Cancelled', icon: XCircle, color: 'text-gray-400 bg-gray-400/20' },
  TradeAcknowledged: { label: 'Acknowledged', icon: Clock, color: 'text-[#ffaa00] bg-[#ffaa00]/20' },
  FundsReleased: { label: 'Funds Released', icon: CheckCircle, color: 'text-[#00d26a] bg-[#00d26a]/20' },
  FundsRefunded: { label: 'Funds Refunded', icon: AlertCircle, color: 'text-[#ff4444] bg-[#ff4444]/20' },
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
        setError('Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [tradeId]);

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
  const formatTxHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  const formatTimestamp = (timestamp: number) => new Date(timestamp * 1000).toLocaleString();

  const renderEventDetails = (event: TransactionEvent) => {
    const args = event.args;
    switch (event.event) {
      case 'TradeCreated':
        return (
          <div className="text-[10px] text-gray-400 space-y-0.5">
            <div>Buyer: <span className="text-white font-mono">{formatAddress(args.buyer as string)}</span></div>
            <div>Seller: <span className="text-white font-mono">{formatAddress(args.seller as string)}</span></div>
            <div>Price: <span className="text-[#0074e4]">${args.price as string}</span></div>
          </div>
        );
      case 'TradeAcknowledged':
        return <div className="text-[10px] text-gray-400">Seller acknowledged</div>;
      case 'TradeCancelled':
        return <div className="text-[10px] text-gray-400">Cancelled by buyer</div>;
      case 'FundsReleased':
      case 'FundsRefunded':
        return (
          <div className="text-[10px] text-gray-400">
            Recipient: <span className="text-white font-mono">{formatAddress(args.recipient as string)}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg shadow-2xl max-w-lg w-full max-h-[70vh] flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-sm font-semibold text-white">Transaction History</h2>
            <p className="text-[10px] text-gray-500">{title} (Trade #{tradeId})</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-[#0074e4] animate-spin" />
              <span className="ml-2 text-gray-400 text-xs">Loading...</span>
            </div>
          )}

          {error && (
            <div className="bg-[#ff4444]/10 border border-[#ff4444]/20 rounded p-3 text-[#ff4444] text-xs">
              {error}
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-xs">No history found</div>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="space-y-2">
              {events.map((event, index) => {
                const config = EVENT_CONFIG[event.event] || {
                  label: event.event,
                  icon: Clock,
                  color: 'text-gray-400 bg-gray-400/20'
                };
                const Icon = config.icon;

                return (
                  <div key={`${event.txHash}-${index}`} className="bg-[#2a2a2a] border border-white/5 rounded p-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded ${config.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white">{config.label}</span>
                          <span className="text-[10px] text-gray-500">Block #{event.blockNumber}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1">{formatTimestamp(event.timestamp)}</div>
                        {renderEventDetails(event)}
                        <div className="mt-2 flex items-center gap-3 text-[10px]">
                          <span className="text-gray-500">
                            From: <span className="font-mono text-gray-400">{formatAddress(event.from)}</span>
                          </span>
                          {getTxExplorerUrl(event.txHash) ? (
                            <a
                              href={getTxExplorerUrl(event.txHash)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[#0074e4] hover:text-[#0088ff] transition-colors"
                            >
                              <span className="font-mono">{formatTxHash(event.txHash)}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="font-mono text-gray-500">{formatTxHash(event.txHash)}</span>
                          )}
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
        <div className="p-3 border-t border-white/10 bg-[#121212] rounded-b-lg">
          <div className="text-[10px] text-gray-500 text-center">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
