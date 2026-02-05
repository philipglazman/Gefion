import { config } from '../config';
import { Listing, TransactionEvent, SteamGame } from '../types';

const api = {
  async getListings(): Promise<Listing[]> {
    const res = await fetch(`${config.apiUrl}/api/listings`);
    if (!res.ok) throw new Error('Failed to fetch listings');
    return res.json();
  },

  async getListing(id: number): Promise<Listing> {
    const res = await fetch(`${config.apiUrl}/api/listings/${id}`);
    if (!res.ok) throw new Error('Failed to fetch listing');
    return res.json();
  },

  async getListingsByAddress(address: string): Promise<{ selling: Listing[]; buying: Listing[] }> {
    const res = await fetch(`${config.apiUrl}/api/listings/address/${address}`);
    if (!res.ok) throw new Error('Failed to fetch listings');
    return res.json();
  },

  async getBalance(address: string): Promise<string> {
    const res = await fetch(`${config.apiUrl}/api/config/balance/${address}`);
    if (!res.ok) throw new Error('Failed to fetch balance');
    const data = await res.json();
    return data.balance;
  },

  // Run full zkTLS verification for a trade
  async requestVerification(tradeId: number): Promise<{ txHash: string; ownsGame: boolean }> {
    const res = await fetch(`${config.apiUrl}/api/verifier/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Verification failed');
    }
    return res.json();
  },

  // Check if notary server is running
  async getVerifierStatus(): Promise<{ notaryRunning: boolean; hint: string }> {
    const res = await fetch(`${config.apiUrl}/api/verifier/status`);
    if (!res.ok) throw new Error('Failed to check verifier status');
    return res.json();
  },

  // Get transaction history for a trade
  async getTradeHistory(tradeId: number): Promise<TransactionEvent[]> {
    const res = await fetch(`${config.apiUrl}/api/listings/trades/${tradeId}/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  // Record a trade event (called after transaction is confirmed)
  async recordTradeEvent(
    tradeId: number,
    eventName: string,
    txHash: string,
    blockNumber: number,
    timestamp: number,
    from: string,
    args: Record<string, unknown> = {}
  ): Promise<TransactionEvent> {
    const res = await fetch(`${config.apiUrl}/api/listings/trades/${tradeId}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, txHash, blockNumber, timestamp, from, args }),
    });
    if (!res.ok) throw new Error('Failed to record trade event');
    return res.json();
  },

  // Sync trade history from blockchain
  async syncTradeHistory(tradeId: number): Promise<{ synced: number }> {
    const res = await fetch(`${config.apiUrl}/api/listings/trades/${tradeId}/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to sync trade history');
    return res.json();
  },

  // Create an off-chain listing (seller)
  async createListing(seller: string, steamAppId: number, price: number): Promise<{ id: number }> {
    const res = await fetch(`${config.apiUrl}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller, steamAppId, price }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create listing');
    }
    return res.json();
  },

  // Cancel an off-chain listing (seller)
  async cancelListing(listingId: number, seller: string): Promise<void> {
    const res = await fetch(`${config.apiUrl}/api/listings/${listingId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to cancel listing');
    }
  },

  // Get seller's off-chain listings
  async getSellerListings(seller: string): Promise<Listing[]> {
    const res = await fetch(`${config.apiUrl}/api/listings/seller/${seller}`);
    if (!res.ok) throw new Error('Failed to fetch seller listings');
    return res.json();
  },

  // Get Steam game details
  async getSteamGame(appId: number): Promise<SteamGame> {
    const res = await fetch(`${config.apiUrl}/api/steam/game/${appId}`);
    if (!res.ok) throw new Error('Failed to fetch game details');
    return res.json();
  },

  // Get multiple Steam game details
  async getSteamGames(appIds: number[]): Promise<Record<number, SteamGame>> {
    const res = await fetch(`${config.apiUrl}/api/steam/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appIds }),
    });
    if (!res.ok) throw new Error('Failed to fetch game details');
    return res.json();
  },

  // Mark off-chain listing as sold when trade initiated
  async markListingSold(listingId: number): Promise<void> {
    const res = await fetch(`${config.apiUrl}/api/listings/${listingId}/initiate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to mark listing as sold');
  },
};

export default api;
