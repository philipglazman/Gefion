# Steam zkTLS Ownership Verifier

Prove Steam game ownership (or non-ownership) using zkTLS without revealing anything else.

## Usage

```bash
# Terminal 1: Start notary server
git clone https://github.com/tlsnotary/tlsn.git
cd tlsn/crates/notary/server && cargo run --release
# Wait for "Listening on 0.0.0.0:7047"

# Terminal 2: Generate and verify proof
cd steam-zktls

# Generate proof for a game you own
./target/release/prover -v ohnoitspanda -a 730
./target/release/present -a 730
./target/release/verifier -a 730
# Output: yes

# Generate proof for a game you don't own
./target/release/prover -v ohnoitspanda -a 1245620
./target/release/present -a 1245620
./target/release/verifier -a 1245620
# Output: no
```

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

### verifier

Outputs `yes` or `no`. Exit code: 0 = owns, 1 = doesn't own.

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

1. Prover queries Steam: "Does user X own game Y?"
2. Steam returns `game_count: 1` (yes) or `game_count: 0` (no)
3. Notary signs the TLS session without seeing plaintext
4. Presentation reveals only `game_count` value
5. Verifier outputs `yes` or `no`

## License

MIT

Sources:
- [Steam Web API - appids_filter](https://steamapi.xpaw.me/)
