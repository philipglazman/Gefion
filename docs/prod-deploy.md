# Production Deployment Guide

This guide walks through deploying Gefion with your own notary signing key, from key generation through contract deployment and backend configuration.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)
- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) (v18+)
- OpenSSL
- A [Steam Web API key](https://steamcommunity.com/dev/apikey)

## 1. Clone the TLSNotary server

The notary server is not bundled in this repo. Clone it at the version matching our prover dependencies:

```bash
git clone --depth 1 --branch v0.1.0-alpha.7 https://github.com/tlsnotary/tlsn.git tlsn
cd tlsn/crates/notary/server && cargo build --release
cd -
```

## 2. Generate a notary signing key

```bash
./scripts/generate-notary-key.sh
```

This creates four files in `keys/notary/`:

| File | Description |
|------|-------------|
| `notary.key` | PKCS#8 PEM private key (gitignored, `chmod 600`) |
| `notary.pub` | PEM public key |
| `notary.address` | Ethereum address derived from the key (e.g. `0xABC...`) |
| `notary-config.yaml` | Notary server config pointing to the key |

The script requires `openssl` and `cast` (Foundry). It will prompt before overwriting existing keys.

## 3. Start the notary server

```bash
cd tlsn/crates/notary/server
cargo run --release -- --config-file ../../keys/notary/notary-config.yaml
```

Verify it's running:

```bash
curl http://127.0.0.1:7047/healthcheck
# => Ok
```

### Notary server configuration

The generated `notary-config.yaml` uses these defaults:

```yaml
server:
  host: "0.0.0.0"
  port: 7047

notarization:
  max-sent-data: 4096
  max-recv-data: 16384

notary-key:
  private-key-pem-path: "/absolute/path/to/keys/notary/notary.key"
  public-key-pem-path: "/absolute/path/to/keys/notary/notary.pub"
```

Edit the config file to change the listen address, port, or data limits. The full schema is documented in the [TLSNotary server README](https://github.com/tlsnotary/tlsn/tree/v0.1.0-alpha.7/crates/notary/server).

> **Note:** The notary server at v0.1.0-alpha.7 requires kebab-case YAML keys, PKCS#8 PEM keys (not SEC1), and all config sections to be present including `html-info` under `server`. The generate script handles all of this.

## 4. Deploy contracts

### Local (Anvil)

```bash
# Start a local chain
anvil &

# Deploy — picks up the notary address automatically from keys/notary/notary.address
./scripts/deploy.sh
```

### Custom network

```bash
NOTARY_ADDRESS=0xYourAddress \
  forge script script/Deploy.s.sol:DeployScript \
    --rpc-url https://your-rpc-url \
    --broadcast \
    --private-key 0xYourDeployerKey
```

The deploy script (`contract/script/Deploy.s.sol`) reads the notary address from the `NOTARY_ADDRESS` environment variable. If unset, it falls back to the test fixture key address (`0x8d2742...`).

## 5. Configure the Steam API key

The prover needs a Steam Web API key to query game ownership.

```bash
# Option A: .env file (recommended for development)
echo 'STEAM_API_KEY=YOUR_KEY_HERE' > steam-zktls/.env

# Option B: environment variable
export STEAM_API_KEY=YOUR_KEY_HERE
```

Get a key at https://steamcommunity.com/dev/apikey.

## 6. Configure the backend

The backend (`backend/`) reads its configuration from environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend HTTP port |
| `RPC_URL` | `http://localhost:8545` | Ethereum RPC endpoint |
| `VERIFIER_PRIVATE_KEY` | Anvil account 0 | Private key for submitting proofs on-chain |

Contract addresses are read from `backend/src/config/contracts.json` (created by the deploy step).

## Environment Variables Reference

### Prover (`steam-zktls/target/release/prover`)

| Variable | Default | Description |
|----------|---------|-------------|
| `STEAM_API_KEY` | _(required)_ | Steam Web API key |
| `NOTARY_HOST` | `127.0.0.1` | Notary server hostname |
| `NOTARY_PORT` | `7047` | Notary server port |

Example with a remote notary server:

```bash
NOTARY_HOST=notary.example.com NOTARY_PORT=443 \
  ./target/release/prover -v ohnoitspanda -a 739630
```

### Contract deploy (`forge script` / `scripts/deploy.sh`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTARY_ADDRESS` | `0x8d2742...` (test fixture) | Ethereum address of the notary signing key |

`deploy.sh` auto-reads `keys/notary/notary.address` if the file exists, so you don't need to set this manually after running `generate-notary-key.sh`.

### Backend (`backend/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend listen port |
| `RPC_URL` | `http://localhost:8545` | Ethereum JSON-RPC URL |
| `VERIFIER_PRIVATE_KEY` | Anvil account 0 | Key for submitting proof transactions |

## Quick Start (all-in-one)

For a complete local deployment with your own key:

```bash
# 1. Generate key (one-time)
./scripts/generate-notary-key.sh

# 2. Start everything
./scripts/start-all.sh
```

`start-all.sh` automatically:
- Starts Anvil
- Deploys contracts (with the generated notary address)
- Starts the notary server (with the generated key config)
- Builds the steam-zktls tools
- Starts the backend and frontend

## Generating a proof manually

After the server is running:

```bash
cd steam-zktls

# Step 1: Prove game ownership via zkTLS
./target/release/prover -v <steam_vanity_url> -a <app_id>

# Step 2: Create selective disclosure presentation
./target/release/present -a <app_id>

# Step 3: Export Solidity-compatible proof JSON
./target/release/export

# Step 4: Verify locally (optional)
./target/release/verifier -a <app_id> --verbose --json
```

The `export` step produces a `.proof.json` file containing the signature, notary address, and ownership data ready for on-chain submission.

## Security Notes

- `keys/notary/notary.key` is gitignored. Never commit private keys.
- The test fixture key (`0x8d2742...`) is public and should only be used for local development.
- For production, always generate a fresh key and restrict access to the notary server.
- The prover sends the Steam API key over a TLS connection to Steam; it is never revealed in the proof (the `present` step redacts it).
