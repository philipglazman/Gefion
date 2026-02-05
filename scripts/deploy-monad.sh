#!/bin/bash

# Deploy contracts to Monad Testnet
# Usage: ./scripts/deploy-monad.sh
#
# Prerequisites:
#   - Set PRIVATE_KEY environment variable with your deployer wallet private key
#   - Ensure wallet has MON tokens for gas

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Monad Testnet Configuration
CHAIN_ID=10143
RPC_URL="https://testnet-rpc.monad.xyz"
EXPLORER_URL="https://testnet.monadexplorer.com"

echo "=== Deploying to Monad Testnet ==="
echo "Chain ID: $CHAIN_ID"
echo "RPC URL: $RPC_URL"
echo ""

# Check for private key
if [ -z "$PRIVATE_KEY" ]; then
  echo "Error: PRIVATE_KEY environment variable not set"
  echo "Usage: PRIVATE_KEY=0x... ./scripts/deploy-monad.sh"
  exit 1
fi

cd "$PROJECT_DIR/contract"

# Install dependencies if needed
if [ ! -d "lib/openzeppelin-contracts" ]; then
  echo "Installing OpenZeppelin..."
  forge install OpenZeppelin/openzeppelin-contracts --no-commit
fi

if [ ! -d "lib/forge-std" ]; then
  echo "Installing forge-std..."
  forge install foundry-rs/forge-std --no-commit
fi

# Build contracts
echo "Building contracts..."
forge build

# Deploy using forge script
echo ""
echo "Deploying contracts to Monad Testnet..."
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  --verify \
  --verifier blockscout \
  --verifier-url "https://testnet.monadexplorer.com/api" \
  -vvv

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "View contracts on explorer: $EXPLORER_URL"
echo ""
echo "Next steps:"
echo "1. Copy the contract addresses from the output above"
echo "2. Update backend/src/config/contracts.json with the new addresses"
echo "3. Update frontend/src/app/config.ts with Monad testnet settings"
echo "4. Run: npm run dev (in backend and frontend directories)"
