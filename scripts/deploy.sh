#!/bin/bash

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# If a generated notary address exists, export it for forge
NOTARY_ADDR_FILE="$REPO_ROOT/keys/notary/notary.address"
if [ -z "${NOTARY_ADDRESS:-}" ] && [ -f "$NOTARY_ADDR_FILE" ]; then
  export NOTARY_ADDRESS
  NOTARY_ADDRESS="$(cat "$NOTARY_ADDR_FILE")"
  echo "Using notary address from $NOTARY_ADDR_FILE: $NOTARY_ADDRESS"
fi

cd "$REPO_ROOT/contract"

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
echo "Deploying contracts..."
forge script script/Deploy.s.sol:DeployScript --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

echo "Deployment complete!"
