# Steam zkTLS Ownership Verifier

Prove Steam game ownership using zkTLS (TLSNotary) without revealing your full game library.

## Usage

```bash
# Terminal 1: Start notary server
git clone https://github.com/tlsnotary/tlsn.git
cd tlsn/crates/notary/server && cargo run --release
# Wait for "Listening on 0.0.0.0:7047"

# Terminal 2: Generate and verify proof
cd steam-zktls

# Step 1: Generate attestation
./target/release/prover -v ohnoitspanda -a 730

# Step 2: Create selective disclosure (reveals only appid)
./target/release/present -a 730

# Step 3: Verify
./target/release/verifier -a 730
```

Output:
```
========================================
  PROOF VERIFIED SUCCESSFULLY
========================================
Server: api.steampowered.com
Connection time: 2024-01-15 12:34:56 UTC
========================================

Revealed data from response:
----------------------------------------
"appid":730
----------------------------------------

VERIFIED: User owns app_id 730 as of 2024-01-15 12:34:56
```

## What This Does

Generate cryptographic proofs that a Steam user owns a specific game at a specific timestamp. The proof:
- **Reveals**: Only `"appid":730` (the minimal proof of ownership)
- **Hides**: Your API key, Steam ID, playtime, and all other games

## Setup

### 1. Prerequisites

- **Rust** 1.70+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Steam API Key** from https://steamcommunity.com/dev/apikey

### 2. Configure

```bash
cp .env.example .env
# Edit .env and add your Steam API key
```

### 3. Build

```bash
cargo build --release
```

## CLI Reference

### prover

```bash
./target/release/prover --vanity-url <USERNAME> --app-id <APP_ID>
```

| Option | Description |
|--------|-------------|
| `-v, --vanity-url` | Steam username (from profile URL) |
| `-a, --app-id` | Game's Steam app ID |
| `-s, --steam-key` | API key (optional if in .env) |
| `-o, --output` | Output file prefix (default: `steam_ownership`) |

### present

```bash
./target/release/present --app-id <APP_ID>
```

Creates selective disclosure presentation revealing only the appid.

### verifier

```bash
./target/release/verifier --app-id <APP_ID>
```

Verifies the presentation and displays the proof.

## Common App IDs

| Game | App ID |
|------|--------|
| Counter-Strike 2 | 730 |
| Portal 2 | 620 |
| Terraria | 105600 |
| Among Us | 945360 |
| Factorio | 427520 |
| DOTA 2 | 570 |

Find more at https://steamdb.info/

## Privacy Guarantees

| Data | In Proof? |
|------|-----------|
| Steam API key | **NO** |
| Steam ID | **NO** |
| Playtime | **NO** |
| Game name | **NO** |
| Other owned games | **NO** |
| Target app_id only | YES |
| Server (api.steampowered.com) | YES |
| Timestamp | YES |

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

1. **Prover** connects to Steam API using MPC-TLS
2. **Notary** collaboratively executes TLS without seeing plaintext
3. **Notary** signs commitments to the encrypted transcript
4. **Prover** creates selective disclosure, revealing only the appid
5. **Verifier** confirms data came from Steam at that timestamp

## License

MIT
