#!/bin/bash

# Start Anvil with deterministic accounts for local development
# Account 0: Deployer/Verifier
# Account 1-9: Test users

anvil \
  --host 0.0.0.0 \
  --port 8545 \
  --chain-id 31337 \
  --accounts 10 \
  --balance 10000 \
  --mnemonic "test test test test test test test test test test test junk"
