#!/bin/bash

# Start services for Monad Testnet
# Usage: ./scripts/start-monad.sh
#
# Prerequisites:
#   - Deploy contracts first: PRIVATE_KEY=0x... ./scripts/deploy-monad.sh
#   - Update backend/src/config/contracts.json with deployed addresses
#   - Set VERIFIER_PRIVATE_KEY environment variable

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Monad Testnet Configuration
export CHAIN_ID=10143
export RPC_URL="https://testnet-rpc.monad.xyz"
export EXPLORER_URL="https://testnet.monadexplorer.com"

echo "=== Forage on Monad Testnet ==="
echo "Chain ID: $CHAIN_ID"
echo "RPC URL: $RPC_URL"
echo "Explorer: $EXPLORER_URL"
echo ""

# Check for verifier private key
if [ -z "$VERIFIER_PRIVATE_KEY" ]; then
  echo "Warning: VERIFIER_PRIVATE_KEY not set"
  echo "zkTLS proof submission will fail without a funded wallet"
  echo ""
fi

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "Error: node not found."; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "Error: cargo not found. Install Rust first."; exit 1; }

# Build and start TLSNotary server
echo "Setting up TLSNotary server..."
cd "$PROJECT_DIR/tlsn/crates/notary/server"
if [ ! -f "target/release/notary-server" ]; then
  echo "Building TLSNotary server (this may take a few minutes on first run)..."
  cargo build --release
fi
echo "Starting TLSNotary notary server..."
cargo run --release > /tmp/notary.log 2>&1 &
NOTARY_PID=$!
sleep 3

if ! kill -0 $NOTARY_PID 2>/dev/null; then
  echo "Warning: TLSNotary server may have failed to start. Check /tmp/notary.log"
else
  echo "TLSNotary server running on http://localhost:7047 (PID: $NOTARY_PID)"
fi

# Build steam-zktls tools
echo ""
echo "Building steam-zktls tools..."
cd "$PROJECT_DIR/steam-zktls"
if [ ! -f ".env" ]; then
  echo "Warning: steam-zktls/.env not found. zkTLS verification will fail."
  echo "Create it with: echo 'STEAM_API_KEY=your_key' > steam-zktls/.env"
fi
cargo build --release --quiet 2>/dev/null || cargo build --release
echo "steam-zktls tools built"

# Install backend dependencies if needed
echo ""
echo "Setting up backend..."
cd "$PROJECT_DIR/backend"
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start backend with Monad config
echo "Starting backend..."
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 2
echo "Backend running on http://localhost:3001 (PID: $BACKEND_PID)"

# Start frontend
echo ""
echo "Setting up frontend..."
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi
echo "Starting frontend..."
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend running on http://localhost:5173 (PID: $FRONTEND_PID)"

echo ""
echo "=== All services started ==="
echo "Network:        Monad Testnet (Chain ID: $CHAIN_ID)"
echo "TLSNotary:      http://localhost:7047"
echo "Backend:        http://localhost:3001"
echo "Frontend:       http://localhost:5173"
echo "Explorer:       $EXPLORER_URL"
echo ""
echo "Logs:"
echo "  Notary:   /tmp/notary.log"
echo "  Backend:  /tmp/backend.log"
echo "  Frontend: /tmp/frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $NOTARY_PID 2>/dev/null || true
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Wait
wait
