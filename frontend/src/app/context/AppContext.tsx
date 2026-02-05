import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletState, Purchase, Game } from '../types';

interface AppContextType {
  wallet: WalletState;
  connectWallet: () => void;
  disconnectWallet: () => void;
  purchases: Purchase[];
  addPurchase: (purchase: Purchase) => void;
  updatePurchase: (id: string, updates: Partial<Purchase>) => void;
  games: Game[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const MOCK_GAMES: Game[] = [
  {
    id: '1',
    title: 'Battlefield 6',
    seller: 'GameVault',
    price: 45.99,
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800',
    description: 'Experience the next generation of all-out warfare. Battlefield 6 delivers intense multiplayer battles across stunning maps.',
    sellerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
  },
  {
    id: '2',
    title: 'Red Dead Redemption 2',
    seller: 'SteamDeals',
    price: 39.99,
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800',
    description: 'Winner of over 175 Game of the Year Awards. A tale of life in America\'s unforgiving heartland.',
    sellerAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
  },
  {
    id: '3',
    title: 'Cyberpunk 2077',
    seller: 'DigitalGames',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    description: 'An open-world, action-adventure story set in Night City. Become a cyberpunk, an urban mercenary equipped with cybernetic enhancements.',
    sellerAddress: '0x9Fc3a4D9D8c3F5C91a2D5b8C7E6D9F2A1B4C6E8D',
  },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: '',
    balance: 0,
  });
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [games] = useState<Game[]>(MOCK_GAMES);

  const connectWallet = () => {
    // Mock wallet connection
    const mockAddress = '0x' + Math.random().toString(16).substring(2, 42);
    setWallet({
      connected: true,
      address: mockAddress,
      balance: 1000, // Mock 1000 USDC
    });
  };

  const disconnectWallet = () => {
    setWallet({
      connected: false,
      address: '',
      balance: 0,
    });
  };

  const addPurchase = (purchase: Purchase) => {
    setPurchases(prev => [...prev, purchase]);
  };

  const updatePurchase = (id: string, updates: Partial<Purchase>) => {
    setPurchases(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  return (
    <AppContext.Provider
      value={{
        wallet,
        connectWallet,
        disconnectWallet,
        purchases,
        addPurchase,
        updatePurchase,
        games,
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
