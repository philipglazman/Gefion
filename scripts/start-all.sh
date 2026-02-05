#!/bin/bash

# Start all services for local development
# Usage: ./scripts/start-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Forage Local Development ==="
echo ""

# Check dependencies
command -v anvil >/dev/null 2>&1 || { echo "Error: anvil not found. Install foundry first."; exit 1; }
command -v forge >/dev/null 2>&1 || { echo "Error: forge not found. Install foundry first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found."; exit 1; }

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

# Install backend dependencies if needed
echo ""
echo "Setting up backend..."
cd "$PROJECT_DIR/backend"
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start backend in background
echo "Starting backend..."
npm run dev &
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
  npm run dev &
  FRONTEND_PID=$!
  echo "Frontend running on http://localhost:5173 (PID: $FRONTEND_PID)"
fi

echo ""
echo "=== All services started ==="
echo "Anvil:    http://localhost:8545"
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $ANVIL_PID 2>/dev/null || true
  kill $BACKEND_PID 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Wait
wait
