#!/bin/bash

set -e

cd "$(dirname "$0")/../contract"

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
