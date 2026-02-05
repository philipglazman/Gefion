import { config } from '../config';
import { Listing } from '../types';

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
};

export default api;
