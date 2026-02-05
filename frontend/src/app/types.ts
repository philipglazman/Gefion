export interface Game {
  id: string;
  title: string;
  seller: string;
  price: number; // in USDC
  image: string;
  description: string;
  sellerAddress: string;
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
}

export interface WalletState {
  connected: boolean;
  address: string;
  balance: number; // USDC balance
}
