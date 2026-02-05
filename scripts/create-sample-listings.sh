#!/bin/bash

# Create sample game listings for the marketplace
# Uses Anvil test account 1 as the seller

RPC_URL="http://localhost:8545"
ESCROW_ADDRESS="0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
SELLER_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

echo "Creating sample game listings..."

# Red Dead Redemption 2 - $39.99 (39990000 in USDC 6 decimals)
echo "Creating listing: Red Dead Redemption 2 ($39.99)"
cast send $ESCROW_ADDRESS "createListing(uint256,uint256)" 39990000 1174180 \
  --rpc-url $RPC_URL \
  --private-key $SELLER_PRIVATE_KEY \
  --quiet

# Grand Theft Auto V - $29.99
echo "Creating listing: Grand Theft Auto V ($29.99)"
cast send $ESCROW_ADDRESS "createListing(uint256,uint256)" 29990000 3240220 \
  --rpc-url $RPC_URL \
  --private-key $SELLER_PRIVATE_KEY \
  --quiet

# Fallout 4 - $19.99
echo "Creating listing: Fallout 4 ($19.99)"
cast send $ESCROW_ADDRESS "createListing(uint256,uint256)" 19990000 377160 \
  --rpc-url $RPC_URL \
  --private-key $SELLER_PRIVATE_KEY \
  --quiet

# Counter-Strike 2 - $14.99
echo "Creating listing: Counter-Strike 2 ($14.99)"
cast send $ESCROW_ADDRESS "createListing(uint256,uint256)" 14990000 730 \
  --rpc-url $RPC_URL \
  --private-key $SELLER_PRIVATE_KEY \
  --quiet

# Elden Ring - $59.99
echo "Creating listing: Elden Ring ($59.99)"
cast send $ESCROW_ADDRESS "createListing(uint256,uint256)" 59990000 1245620 \
  --rpc-url $RPC_URL \
  --private-key $SELLER_PRIVATE_KEY \
  --quiet

# Portal 2 - $9.99
echo "Creating listing: Portal 2 ($9.99)"
cast send $ESCROW_ADDRESS "createListing(uint256,uint256)" 9990000 620 \
  --rpc-url $RPC_URL \
  --private-key $SELLER_PRIVATE_KEY \
  --quiet

# Dota 2 - $0.99 (free to play but listing as example)
echo "Creating listing: Dota 2 ($0.99)"
cast send $ESCROW_ADDRESS "createListing(uint256,uint256)" 990000 570 \
  --rpc-url $RPC_URL \
  --private-key $SELLER_PRIVATE_KEY \
  --quiet

echo ""
echo "Sample listings created successfully!"
echo "View them at http://localhost:5173"
