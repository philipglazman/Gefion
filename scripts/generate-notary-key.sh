#!/bin/bash
#
# Generate a secp256k1 key pair for the TLSNotary notary server.
# Derives the Ethereum address for use in smart contract deployment.
#
# Requires: openssl, cast (foundry)
#
# Outputs (in keys/notary/):
#   notary.key     — private key PEM (gitignored)
#   notary.pub     — public key PEM
#   notary.address — plain text Ethereum address
#   notary-config.yaml — notary server config pointing to the key

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="$REPO_ROOT/keys/notary"

# Check dependencies
for cmd in openssl cast; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not found in PATH." >&2
    exit 1
  fi
done

# Guard against accidental overwrite
if [ -f "$KEY_DIR/notary.key" ]; then
  echo "Key already exists at $KEY_DIR/notary.key"
  read -rp "Overwrite? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

mkdir -p "$KEY_DIR"

echo "Generating secp256k1 private key..."
# Generate SEC1 key then convert to PKCS#8 (required by TLSNotary server)
openssl ecparam -name secp256k1 -genkey -noout 2>/dev/null \
  | openssl pkcs8 -topk8 -nocrypt -out "$KEY_DIR/notary.key"

echo "Extracting public key..."
openssl ec -in "$KEY_DIR/notary.key" -pubout -out "$KEY_DIR/notary.pub" 2>/dev/null

# Derive Ethereum address:
# 1. Extract the 32-byte private key scalar from PEM via DER
# 2. Use `cast wallet address` (which accepts a private key)
PRIV_HEX=$(openssl ec -in "$KEY_DIR/notary.key" -outform DER 2>/dev/null \
  | dd bs=1 skip=7 count=32 2>/dev/null \
  | xxd -p -c 32)
ETH_ADDRESS=$(cast wallet address "0x${PRIV_HEX}")

echo "$ETH_ADDRESS" > "$KEY_DIR/notary.address"

# Restrictive permissions on the private key
chmod 600 "$KEY_DIR/notary.key"

# Write notary server config YAML pointing to the generated key
# Format must match tlsn v0.1.0-alpha.7 config schema (kebab-case keys)
cat > "$KEY_DIR/notary-config.yaml" <<EOF
server:
  name: "notary-server"
  host: "0.0.0.0"
  port: 7047
  html-info: "<h1>Notary Server</h1>"

notarization:
  max-sent-data: 4096
  max-recv-data: 16384

tls:
  enabled: false
  private-key-pem-path: "/dev/null"
  certificate-pem-path: "/dev/null"

notary-key:
  private-key-pem-path: "$KEY_DIR/notary.key"
  public-key-pem-path: "$KEY_DIR/notary.pub"

logging:
  level: DEBUG

authorization:
  enabled: false
  whitelist-csv-path: "/dev/null"
EOF

echo ""
echo "=== Notary Key Generated ==="
echo "Private key (PEM):  $KEY_DIR/notary.key"
echo "Public key  (PEM):  $KEY_DIR/notary.pub"
echo "Ethereum address:   $ETH_ADDRESS"
echo "Server config:      $KEY_DIR/notary-config.yaml"
echo ""
echo "=== Next Steps ==="
echo "1. Start notary server with the generated key:"
echo "   cargo run --release -- --config-file $KEY_DIR/notary-config.yaml"
echo "2. Deploy contracts (address is picked up automatically):"
echo "   ./scripts/deploy.sh"
echo "3. Or set manually:"
echo "   NOTARY_ADDRESS=$ETH_ADDRESS ./scripts/deploy.sh"
