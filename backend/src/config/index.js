import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load contract addresses from deploy script output
let contracts = {
  usdc: '',
  escrow: '',
  verifier: ''
};

const contractsPath = join(__dirname, 'contracts.json');
if (existsSync(contractsPath)) {
  contracts = JSON.parse(readFileSync(contractsPath, 'utf-8'));
}

export const config = {
  port: process.env.PORT || 3001,
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  // Anvil account 0 private key (deployer/verifier)
  verifierPrivateKey: process.env.VERIFIER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  contracts
};
