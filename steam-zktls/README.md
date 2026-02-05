# Steam zkTLS Ownership Verifier

Prove Steam game ownership (or non-ownership) using zkTLS without revealing anything else.

## Usage

```bash
# Terminal 1: Start notary server
git clone https://github.com/tlsnotary/tlsn.git
cd tlsn/crates/notary/server && cargo run --release
# Wait for "Listening on 0.0.0.0:7047"

# Terminal 2: Generate proof and export for on-chain verification
cd steam-zktls

# Generate proof for a game you own
./target/release/prover -v ohnoitspanda -a 730
./target/release/present -a 730
./target/release/export     # outputs steam_ownership.proof.json

# Generate proof for a game you don't own
./target/release/prover -v ohnoitspanda -a 1245620
./target/release/present -a 1245620
./target/release/export -i steam_ownership.presentation.tlsn -o steam_notown.proof.json
```

The production pipeline is **prover -> present -> export**. The exported JSON contains all fields needed for on-chain verification via `SteamGameVerifier.verifyAndResolve()`.

## What It Proves

The proof reveals **only** `"game_count":1` or `"game_count":0` from Steam's API response.

| Data | Revealed? |
|------|-----------|
| Owns game (yes/no) | YES |
| Server (api.steampowered.com) | YES |
| Timestamp | YES |
| Steam API key | **NO** |
| Steam ID | **NO** |
| Playtime | **NO** |
| Other games | **NO** |

## Setup

### Prerequisites

- **Rust** 1.70+
- **Steam API Key** from https://steamcommunity.com/dev/apikey

### Configure

```bash
cp .env.example .env
# Edit .env and add your Steam API key
```

### Build

```bash
cargo build --release
```

## CLI Reference

### prover

Queries Steam API via zkTLS and generates attestation.

```bash
./target/release/prover -v <USERNAME> -a <APP_ID>
```

### present

Creates selective disclosure (reveals only `game_count`).

```bash
./target/release/present -a <APP_ID>
```

### export

Extracts the notary signature, timestamp, ownership result, and transcript hash from a presentation file into a JSON format ready for Solidity's `ecrecover`. This is the final step before submitting a proof on-chain.

```bash
./target/release/export                          # default: steam_ownership.presentation.tlsn -> steam_ownership.proof.json
./target/release/export -i <INPUT> -o <OUTPUT>   # custom paths
./target/release/export -v                       # verbose (shows key/signature details)
```

Output JSON fields map directly to `SteamGameVerifier.verifyAndResolve()` parameters:
- `messageHash` - SHA256 hash of the BCS-serialized attestation header
- `signatureV`, `signatureR`, `signatureS` - notary ECDSA signature
- `serverName` - must be `api.steampowered.com`
- `timestamp` - unix timestamp of the TLS connection
- `ownsGame` - `true` if `game_count >= 1`
- `transcriptHash` - SHA256 hash of the revealed transcript

### verifier

Local off-chain verification for conformance testing. Outputs `yes` or `no`. Use this to sanity-check proofs before submitting on-chain. In production, verification happens on-chain via `SteamOwnershipVerifier` + `SteamGameVerifier`.

```bash
./target/release/verifier -a <APP_ID>
./target/release/verifier -a <APP_ID> --verbose  # detailed output
```

## Common App IDs

| Game | App ID |
|------|--------|
| Counter-Strike 2 | 730 |
| Elden Ring | 1245620 |
| Portal 2 | 620 |
| Terraria | 105600 |
| DOTA 2 | 570 |

## How It Works

```
┌─────────┐         ┌──────────┐         ┌─────────────┐
│ Prover  │◄───MPC──►│ Notary   │         │ Steam API   │
│         │         │ Server   │         │             │
└────┬────┘         └──────────┘         └──────┬──────┘
     │                                          │
     │              TLS (encrypted)             │
     └──────────────────────────────────────────┘
```

1. **prover** queries Steam: "Does user X own game Y?"
2. Steam returns `game_count: 1` (yes) or `game_count: 0` (no)
3. Notary signs the TLS session without seeing plaintext
4. **present** creates selective disclosure revealing only `game_count`
5. **export** extracts signature + metadata into Solidity-compatible JSON
6. JSON is submitted to `SteamGameVerifier.verifyAndResolve()` for on-chain verification

The **verifier** CLI is for local conformance testing only. Production verification is on-chain via `SteamOwnershipVerifier` (signature check) and `SteamGameVerifier` (timestamp binding + escrow resolution).

## License

MIT

Sources:
- [Steam Web API - appids_filter](https://steamapi.xpaw.me/)
