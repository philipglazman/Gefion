// Chain configurations
const CHAIN_CONFIGS: Record<number, { name: string; rpcUrl: string; explorerUrl: string }> = {
  31337: {
    name: 'Anvil Local',
    rpcUrl: 'http://localhost:8545',
    explorerUrl: '', // No explorer for local
  },
  10143: {
    name: 'Monad Testnet',
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    explorerUrl: 'https://testnet.monadexplorer.com',
  },
};

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  escrowAddress: import.meta.env.VITE_ESCROW_ADDRESS || '',
  usdcAddress: import.meta.env.VITE_USDC_ADDRESS || '',
  chainId: Number(import.meta.env.VITE_CHAIN_ID) || 31337,
  rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
  explorerUrl: import.meta.env.VITE_EXPLORER_URL || '',
};

// Get explorer URL for a transaction
export function getTxExplorerUrl(txHash: string): string | null {
  if (!config.explorerUrl) return null;
  return `${config.explorerUrl}/tx/${txHash}`;
}

// Get explorer URL for an address
export function getAddressExplorerUrl(address: string): string | null {
  if (!config.explorerUrl) return null;
  return `${config.explorerUrl}/address/${address}`;
}

// Fetch config from backend if not set in env
export async function fetchConfig(): Promise<typeof config> {
  if (config.escrowAddress && config.usdcAddress) {
    return config;
  }

  try {
    const res = await fetch(`${config.apiUrl}/api/config`);
    const data = await res.json();

    config.escrowAddress = data.contracts.escrow || config.escrowAddress;
    config.usdcAddress = data.contracts.usdc || config.usdcAddress;
    config.chainId = data.chainId || config.chainId;

    // Use explorer URL from backend if provided, otherwise use chain config
    if (data.explorerUrl) {
      config.explorerUrl = data.explorerUrl;
    } else {
      const chainConfig = CHAIN_CONFIGS[config.chainId];
      if (chainConfig) {
        config.explorerUrl = chainConfig.explorerUrl;
      }
    }

    // Set RPC URL from chain config
    const chainConfig = CHAIN_CONFIGS[config.chainId];
    if (chainConfig) {
      config.rpcUrl = chainConfig.rpcUrl;
    }

    return config;
  } catch (e) {
    console.warn('Failed to fetch config from backend:', e);
    return config;
  }
}
