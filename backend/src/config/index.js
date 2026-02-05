import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Chain configurations
const CHAIN_CONFIGS = {
  31337: {
    name: 'Anvil Local',
    rpcUrl: 'http://localhost:8545',
    explorerUrl: '',
  },
  10143: {
    name: 'Monad Testnet',
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    explorerUrl: 'https://testnet.monadexplorer.com',
  },
};

// Load contract addresses from deploy script output
let contracts = {
  usdc: '',
  escrow: '',
  verifier: '',
  ownershipVerifier: ''
};

const contractsPath = join(__dirname, 'contracts.json');
if (existsSync(contractsPath)) {
  contracts = JSON.parse(readFileSync(contractsPath, 'utf-8'));
}

// Determine chain ID from environment or default to local
const chainId = Number(process.env.CHAIN_ID) || 31337;
const chainConfig = CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS[31337];

export const config = {
  port: process.env.PORT || 3001,
  chainId,
  rpcUrl: process.env.RPC_URL || chainConfig.rpcUrl,
  explorerUrl: process.env.EXPLORER_URL || chainConfig.explorerUrl,
  // Private key for backend wallet (verifier calls)
  // WARNING: Use environment variable in production, never commit real keys
  verifierPrivateKey: process.env.VERIFIER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  contracts
};
