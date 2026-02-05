#!/bin/bash

# Create sample game listings (off-chain) for the marketplace
# Uses test account 1 as the seller

API_URL="http://localhost:3001"
SELLER="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

echo "Creating sample game listings..."

# Euro Truck Simulator 2 - $19.99
echo "Creating listing: Euro Truck Simulator 2 ($19.99)"
curl -s -X POST "$API_URL/api/listings" \
  -H "Content-Type: application/json" \
  -d "{\"seller\":\"$SELLER\",\"steamAppId\":227300,\"price\":19.99}" > /dev/null

# Red Dead Redemption 2 - $39.99
echo "Creating listing: Red Dead Redemption 2 ($39.99)"
curl -s -X POST "$API_URL/api/listings" \
  -H "Content-Type: application/json" \
  -d "{\"seller\":\"$SELLER\",\"steamAppId\":1174180,\"price\":39.99}" > /dev/null

# Counter-Strike 2 - $14.99
echo "Creating listing: Counter-Strike 2 ($14.99)"
curl -s -X POST "$API_URL/api/listings" \
  -H "Content-Type: application/json" \
  -d "{\"seller\":\"$SELLER\",\"steamAppId\":730,\"price\":14.99}" > /dev/null

# Elden Ring - $59.99
echo "Creating listing: Elden Ring ($59.99)"
curl -s -X POST "$API_URL/api/listings" \
  -H "Content-Type: application/json" \
  -d "{\"seller\":\"$SELLER\",\"steamAppId\":1245620,\"price\":59.99}" > /dev/null

# Portal 2 - $9.99
echo "Creating listing: Portal 2 ($9.99)"
curl -s -X POST "$API_URL/api/listings" \
  -H "Content-Type: application/json" \
  -d "{\"seller\":\"$SELLER\",\"steamAppId\":620,\"price\":9.99}" > /dev/null

# Dota 2 - $4.99
echo "Creating listing: Dota 2 ($4.99)"
curl -s -X POST "$API_URL/api/listings" \
  -H "Content-Type: application/json" \
  -d "{\"seller\":\"$SELLER\",\"steamAppId\":570,\"price\":4.99}" > /dev/null

echo ""
echo "Sample listings created successfully!"
echo "View them at http://localhost:5173"
