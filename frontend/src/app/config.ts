export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  escrowAddress: import.meta.env.VITE_ESCROW_ADDRESS || '',
  usdcAddress: import.meta.env.VITE_USDC_ADDRESS || '',
  chainId: Number(import.meta.env.VITE_CHAIN_ID) || 31337,
  rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
};

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

    return config;
  } catch (e) {
    console.warn('Failed to fetch config from backend:', e);
    return config;
  }
}
