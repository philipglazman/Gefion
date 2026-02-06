#!/bin/bash

# Start all services for local development
# Usage: ./scripts/start-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Gefion Local Development ==="
echo ""

# Check dependencies
command -v anvil >/dev/null 2>&1 || { echo "Error: anvil not found. Install foundry first."; exit 1; }
command -v forge >/dev/null 2>&1 || { echo "Error: forge not found. Install foundry first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found."; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "Error: cargo not found. Install Rust first."; exit 1; }

# Start Anvil in background
echo "Starting Anvil..."
"$SCRIPT_DIR/start-anvil.sh" &
ANVIL_PID=$!
sleep 2

# Check if Anvil started
if ! kill -0 $ANVIL_PID 2>/dev/null; then
  echo "Error: Anvil failed to start"
  exit 1
fi
echo "Anvil running (PID: $ANVIL_PID)"

# Deploy contracts
echo ""
echo "Deploying contracts..."
"$SCRIPT_DIR/deploy.sh"

# Build and start TLSNotary server
echo ""
echo "Setting up TLSNotary server..."
cd "$PROJECT_DIR/tlsn/crates/notary/server"
if [ ! -f "target/release/notary-server" ]; then
  echo "Building TLSNotary server (this may take a few minutes on first run)..."
  cargo build --release
fi
echo "Starting TLSNotary notary server..."
NOTARY_CONFIG="$PROJECT_DIR/keys/notary/notary-config.yaml"
if [ -f "$NOTARY_CONFIG" ]; then
  echo "Using notary config: $NOTARY_CONFIG"
  cargo run --release -- --config-file "$NOTARY_CONFIG" > /tmp/notary.log 2>&1 &
else
  echo "No notary config found — using ephemeral key (run ./scripts/generate-notary-key.sh for persistent keys)"
  cargo run --release > /tmp/notary.log 2>&1 &
fi
NOTARY_PID=$!
sleep 3

# Check if notary started
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

# Start backend in background
echo "Starting backend..."
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 2
echo "Backend running on http://localhost:3001 (PID: $BACKEND_PID)"

# Start frontend if it exists
if [ -d "$PROJECT_DIR/frontend" ]; then
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
fi

echo ""
echo "=== All services started ==="
echo "Anvil:          http://localhost:8545"
echo "TLSNotary:      http://localhost:7047"
echo "Backend:        http://localhost:3001"
echo "Frontend:       http://localhost:5173"
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
  kill $ANVIL_PID 2>/dev/null || true
  kill $NOTARY_PID 2>/dev/null || true
  kill $BACKEND_PID 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Wait
wait
