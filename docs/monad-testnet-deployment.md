# Monad Testnet Deployment

**Network:** Monad Testnet (Chain ID: 10143)
**RPC:** https://testnet-rpc.monad.xyz
**Explorer:** https://testnet.monadexplorer.com
**Deployed:** 2026-02-05

## Contract Addresses

| Contract | Address |
|----------|---------|
| MockUSDC | `0xA1F17b1D2aDcf998396DeB3c08471A713b8d162e` |
| SteamOwnershipVerifier | `0x85BA61eEF5aC51B75DBAB957Dd4B712f2d67aB6d` |
| SteamGameEscrow | `0xAA08159DEdd7ccfC92A4b318ae8AF01FCF11434b` |
| SteamGameVerifier | `0xFc42664ac53c90cB109502F27055297920b0e2CA` |

## Key Addresses

| Role | Address |
|------|---------|
| Notary (TLSNotary signer) | `0x12aA5C03E61beDcfd08a3d7Edafa3012EFa6F9B7` |
| Deployer | `0x3a648B3Fd7ae1E88F97585263D69981D3Eb42957` |

## Notary Key Files

Located in `keys/notary/` (gitignored):
- `notary.key` — PKCS#8 PEM private key
- `notary.pub` — PEM public key
- `notary.address` — Ethereum address
- `notary-config.yaml` — TLSNotary server config
