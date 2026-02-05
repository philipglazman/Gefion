import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WalletState, Listing, Game } from '../types';
import { blockchain } from '../services/blockchain';
import api from '../services/api';
import { fetchConfig } from '../config';

interface AppContextType {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
  listings: Listing[];
  refreshListings: () => Promise<void>;
  myListings: { selling: Listing[]; buying: Listing[] };
  refreshMyListings: () => Promise<void>;
  // Contract interactions
  purchase: (listingId: number, steamUsername: string, price: number) => Promise<string>;
  createListing: (price: number, steamAppId: number) => Promise<number>;
  acknowledge: (listingId: number) => Promise<string>;
  claimAfterWindow: (listingId: number) => Promise<string>;
  cancelListing: (listingId: number) => Promise<string>;
  // Legacy support
  games: Game[];
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Game metadata (stored off-chain, keyed by steamAppId)
const GAME_METADATA: Record<number, { title: string; image: string; description: string }> = {
  730: {
    title: 'Counter-Strike 2',
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800',
    description: 'The next evolution of Counter-Strike. Free to play.',
  },
  1245620: {
    title: 'Elden Ring',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    description: 'Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring.',
  },
  620: {
    title: 'Portal 2',
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800',
    description: 'The sequel to the acclaimed Portal. A portal-based puzzle game.',
  },
  570: {
    title: 'Dota 2',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800',
    description: 'Every day, millions of players battle in the ultimate competitive strategy game.',
  },
};

function getGameMetadata(steamAppId: number) {
  return GAME_METADATA[steamAppId] || {
    title: `Steam Game #${steamAppId}`,
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800',
    description: 'A Steam game available for purchase.',
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: '',
    balance: 0,
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<{ selling: Listing[]; buying: Listing[] }>({
    selling: [],
    buying: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config on mount
  useEffect(() => {
    fetchConfig().then(() => setConfigLoaded(true));
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return;
    try {
      const balance = await blockchain.getBalance(wallet.address);
      setWallet(prev => ({ ...prev, balance }));
    } catch (e) {
      console.error('Failed to refresh balance:', e);
    }
  }, [wallet.connected, wallet.address]);

  const refreshListings = useCallback(async () => {
    try {
      const data = await api.getListings();
      // Enrich with metadata
      const enriched = data.map(l => ({
        ...l,
        ...getGameMetadata(l.steamAppId),
      }));
      setListings(enriched);
    } catch (e) {
      console.error('Failed to refresh listings:', e);
    }
  }, []);

  const refreshMyListings = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return;
    try {
      const data = await api.getListingsByAddress(wallet.address);
      setMyListings({
        selling: data.selling.map(l => ({ ...l, ...getGameMetadata(l.steamAppId) })),
        buying: data.buying.map(l => ({ ...l, ...getGameMetadata(l.steamAppId) })),
      });
    } catch (e) {
      console.error('Failed to refresh my listings:', e);
    }
  }, [wallet.connected, wallet.address]);

  // Refresh listings when config loads
  useEffect(() => {
    if (configLoaded) {
      refreshListings();
    }
  }, [configLoaded, refreshListings]);

  // Refresh my listings when wallet connects
  useEffect(() => {
    if (wallet.connected) {
      refreshMyListings();
      refreshBalance();
    }
  }, [wallet.connected, refreshMyListings, refreshBalance]);

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      const address = await blockchain.connect();
      const balance = await blockchain.getBalance(address);
      setWallet({
        connected: true,
        address,
        balance,
      });
    } catch (e) {
      console.error('Failed to connect wallet:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWallet({
      connected: false,
      address: '',
      balance: 0,
    });
    setMyListings({ selling: [], buying: [] });
  };

  const purchase = async (listingId: number, steamUsername: string, price: number) => {
    const txHash = await blockchain.purchase(listingId, steamUsername, price);
    await refreshBalance();
    await refreshListings();
    await refreshMyListings();
    return txHash;
  };

  const createListing = async (price: number, steamAppId: number) => {
    const listingId = await blockchain.createListing(price, steamAppId);
    await refreshListings();
    await refreshMyListings();
    return listingId;
  };

  const acknowledge = async (listingId: number) => {
    const txHash = await blockchain.acknowledge(listingId);
    await refreshMyListings();
    return txHash;
  };

  const claimAfterWindow = async (listingId: number) => {
    const txHash = await blockchain.claimAfterWindow(listingId);
    await refreshBalance();
    await refreshMyListings();
    return txHash;
  };

  const cancelListing = async (listingId: number) => {
    const txHash = await blockchain.cancelListing(listingId);
    await refreshListings();
    await refreshMyListings();
    return txHash;
  };

  // Legacy games array for backward compatibility
  const games: Game[] = listings.map(l => ({
    id: l.id.toString(),
    title: l.title || `Game #${l.steamAppId}`,
    seller: l.seller.slice(0, 8) + '...',
    price: Number(l.price),
    image: l.image || '',
    description: l.description || '',
    sellerAddress: l.seller,
    steamAppId: l.steamAppId,
    listingId: l.id,
  }));

  return (
    <AppContext.Provider
      value={{
        wallet,
        connectWallet,
        disconnectWallet,
        refreshBalance,
        listings,
        refreshListings,
        myListings,
        refreshMyListings,
        purchase,
        createListing,
        acknowledge,
        claimAfterWindow,
        cancelListing,
        games,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
