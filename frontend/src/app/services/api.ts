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

  async requestVerification(listingId: number): Promise<void> {
    const res = await fetch(`${config.apiUrl}/api/verifier/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Verification failed');
    }
  },

  // Submit proof result directly (for testing or when proof is generated)
  async submitProofResult(listingId: number, buyerOwnsGame: boolean): Promise<{ txHash: string }> {
    const res = await fetch(`${config.apiUrl}/api/verifier/submit-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, buyerOwnsGame }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to submit proof');
    }
    return res.json();
  },

  // Get transaction history for a listing
  async getListingHistory(listingId: number): Promise<TransactionEvent[]> {
    const res = await fetch(`${config.apiUrl}/api/listings/${listingId}/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
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
};

export default api;
