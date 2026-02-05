#!/bin/bash

# Seed games to the Gefion marketplace
# Usage: ./seed-games.sh [API_URL] [SELLER_ADDRESS]

API_URL="${1:-https://lvr.0x00.sh}"
SELLER="${2:-0xDE2d89d198a9F88c7dddE0CBB9828C2fF968e855}"

# Games to seed: [steamAppId, price]
declare -a GAMES=(
  "1808500:25.00"   # Vampire Survivors
  "1174180:60.00"   # Red Dead Redemption 2
  "784150:15.00"    # Death's Door
  "105600:20.00"    # Terraria
)

echo "Seeding games to $API_URL"
echo "Seller: $SELLER"
echo ""

for game in "${GAMES[@]}"; do
  APP_ID="${game%%:*}"
  PRICE="${game##*:}"

  echo "Creating listing for Steam App ID: $APP_ID (Price: \$$PRICE)"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/listings" \
    -H "Content-Type: application/json" \
    -d "{\"seller\": \"$SELLER\", \"steamAppId\": \"$APP_ID\", \"price\": \"$PRICE\"}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ Success: $BODY"
  else
    echo "  ✗ Failed (HTTP $HTTP_CODE): $BODY"
  fi
  echo ""
done

echo "Done!"
