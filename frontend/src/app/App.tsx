import { RouterProvider } from 'react-router';
import { PrivyProvider } from '@privy-io/react-auth';
import { defineChain } from 'viem';
import { router } from './routes';
import { AppProvider } from './context/AppContext';

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadvision.com' },
  },
});

const anvilLocal = defineChain({
  id: 31337,
  name: 'Anvil Local',
  network: 'anvil',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
  },
});

export default function App() {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || 'cmlh4x2tv00cjjp0cfd9fr7ce'}
      config={{
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet, anvilLocal],
        appearance: {
          theme: 'dark',
          accentColor: '#0074e4',
        },
        loginMethods: ['email', 'wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </PrivyProvider>
  );
}
