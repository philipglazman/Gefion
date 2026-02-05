export interface Listing {
  id: number;
  seller: string;
  price: string; // in USDC (formatted)
  steamAppId: number;
  status: 'Open' | 'Purchased' | 'Acknowledged' | 'Completed' | 'Disputed' | 'Refunded' | 'Cancelled';
  buyer: string | null;
  buyerSteamUsername: string | null;
  acknowledgedAt: number | null;
  disputeDeadline: number | null;
  // UI-only fields (not from contract)
  title?: string;
  image?: string;
  description?: string;
}

// Legacy type for backward compatibility
export interface Game {
  id: string;
  title: string;
  seller: string;
  price: number;
  image: string;
  description: string;
  sellerAddress: string;
  steamAppId?: number;
  listingId?: number;
}

export interface Purchase {
  id: string;
  gameId: string;
  gameTitle: string;
  buyerAddress: string;
  buyerSteamUsername: string;
  sellerAddress: string;
  price: number;
  status: 'pending' | 'acknowledged' | 'completed' | 'disputed' | 'refunded';
  createdAt: Date;
  acknowledgedAt?: Date;
  disputeDeadline: Date;
  listingId?: number;
}

export interface WalletState {
  connected: boolean;
  address: string;
  balance: number; // USDC balance
}

export interface TransactionEvent {
  event: 'ListingCreated' | 'ListingCancelled' | 'GamePurchased' | 'SaleAcknowledged' | 'FundsReleased' | 'FundsRefunded';
  txHash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  args: Record<string, unknown>;
}

export interface SteamGame {
  name: string;
  headerImage: string;
  shortDescription: string;
  appId: number;
}

// Map contract status to frontend status
export function mapListingStatus(status: Listing['status']): Purchase['status'] {
  const map: Record<Listing['status'], Purchase['status']> = {
    'Open': 'pending',
    'Purchased': 'pending',
    'Acknowledged': 'acknowledged',
    'Completed': 'completed',
    'Disputed': 'disputed',
    'Refunded': 'refunded',
    'Cancelled': 'refunded',
  };
  return map[status];
}
