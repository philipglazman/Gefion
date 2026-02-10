import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { WalletState, Listing, Game, SteamGame } from '../types';
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
  purchase: (steamAppId: number, seller: string, steamUsername: string, price: number, listingId?: number) => Promise<string>;
  acknowledge: (tradeId: number) => Promise<string>;
  claimAfterWindow: (tradeId: number) => Promise<string>;
  cancelTrade: (tradeId: number) => Promise<string>;
  // Legacy support
  games: Game[];
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to enrich listings with Steam game data
async function enrichListingsWithSteamData(listings: Listing[]): Promise<Listing[]> {
  if (listings.length === 0) return listings;

  // Get unique app IDs
  const appIds = [...new Set(listings.map(l => l.steamAppId))];

  try {
    // Fetch all game details in one request
    const gameMap = await api.getSteamGames(appIds);

    // Enrich listings with Steam data
    return listings.map(listing => {
      const game = gameMap[listing.steamAppId];
      if (game) {
        return {
          ...listing,
          title: game.name,
          image: game.headerImage,
          description: game.shortDescription,
        };
      }
      return {
        ...listing,
        title: `Steam Game #${listing.steamAppId}`,
        image: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${listing.steamAppId}/header.jpg`,
        description: 'A Steam game available for purchase.',
      };
    });
  } catch (e) {
    console.error('Failed to fetch Steam game data:', e);
    // Return listings with fallback metadata
    return listings.map(listing => ({
      ...listing,
      title: `Steam Game #${listing.steamAppId}`,
      image: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${listing.steamAppId}/header.jpg`,
      description: 'A Steam game available for purchase.',
    }));
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();

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

  // Bridge Privy wallet to BlockchainService when wallet connects and config is loaded
  useEffect(() => {
    async function initWallet() {
      if (!ready || !authenticated || wallets.length === 0 || !configLoaded) return;

      const privyWallet = wallets[0];
      try {
        const ethProvider = await privyWallet.getEthereumProvider();
        const address = await blockchain.connectWithProvider(ethProvider);
        let balance = 0;
        try {
          balance = await blockchain.getBalance(address);
        } catch (e) {
          console.warn('Could not fetch balance (contract may not be deployed on this chain):', e);
        }
        setWallet({ connected: true, address, balance });
      } catch (e) {
        console.error('Failed to initialize wallet from Privy:', e);
      }
    }

    initWallet();
  }, [ready, authenticated, wallets, configLoaded]);

  // Clear state when Privy logs out
  useEffect(() => {
    if (ready && !authenticated) {
      blockchain.disconnect();
      setWallet({ connected: false, address: '', balance: 0 });
      setMyListings({ selling: [], buying: [] });
    }
  }, [ready, authenticated]);

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
      // Enrich with Steam game data
      const enriched = await enrichListingsWithSteamData(data);
      setListings(enriched);
    } catch (e) {
      console.error('Failed to refresh listings:', e);
    }
  }, []);

  const refreshMyListings = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return;
    try {
      const data = await api.getListingsByAddress(wallet.address);
      // Enrich both selling and buying with Steam data
      const allListings = [...data.selling, ...data.buying];
      const enrichedAll = await enrichListingsWithSteamData(allListings);

      // Split back into selling and buying
      const enrichedMap = new Map(enrichedAll.map(l => [l.id, l]));
      setMyListings({
        selling: data.selling.map(l => enrichedMap.get(l.id) || l),
        buying: data.buying.map(l => enrichedMap.get(l.id) || l),
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
    if (authenticated) return;
    setIsLoading(true);
    try {
      login();
    } catch (e) {
      console.error('Failed to connect wallet:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    logout();
  };

  const purchase = async (steamAppId: number, seller: string, steamUsername: string, price: number, listingId?: number) => {
    const { hash: txHash } = await blockchain.createTrade(steamAppId, seller, steamUsername, price);
    // Mark off-chain listing as sold if listingId provided
    if (listingId) {
      try {
        await api.markListingSold(listingId);
      } catch (e) {
        console.error('Failed to mark listing as sold:', e);
      }
    }
    await refreshBalance();
    await refreshListings();
    await refreshMyListings();
    return txHash;
  };

  const acknowledge = async (tradeId: number) => {
    const txHash = await blockchain.acknowledge(tradeId);
    await refreshMyListings();
    return txHash;
  };

  const claimAfterWindow = async (tradeId: number) => {
    const txHash = await blockchain.claimAfterWindow(tradeId);
    await refreshBalance();
    await refreshMyListings();
    return txHash;
  };

  const cancelTrade = async (tradeId: number) => {
    const txHash = await blockchain.cancelTrade(tradeId);
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
        acknowledge,
        claimAfterWindow,
        cancelTrade,
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
