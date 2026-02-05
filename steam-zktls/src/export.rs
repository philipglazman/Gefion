mod types;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use clap::Parser;
use k256::ecdsa::{RecoveryId, Signature as K256Signature, VerifyingKey as K256VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tlsn_core::{
    presentation::{Presentation, PresentationOutput},
    CryptoProvider,
};
use tracing::info;

#[derive(Parser, Debug)]
#[command(author, version, about = "Export TLSNotary presentation for Solidity verification")]
struct Args {
    /// Input presentation file
    #[arg(short, long, default_value = "steam_ownership.presentation.tlsn")]
    input: String,

    /// Output JSON file
    #[arg(short, long, default_value = "steam_ownership.proof.json")]
    output: String,

    /// Show verbose output
    #[arg(short, long, default_value = "false")]
    verbose: bool,
}

/// Solidity-compatible proof structure
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SolidityProof {
    /// Notary's Ethereum address (derived from secp256k1 public key)
    notary_address: String,
    /// Signature r value (32 bytes)
    signature_r: String,
    /// Signature s value (32 bytes)
    signature_s: String,
    /// Signature v value (27 or 28)
    signature_v: u8,
    /// Message hash that was signed (keccak256)
    message_hash: String,
    /// Server name from the proof
    server_name: String,
    /// Unix timestamp of the TLS connection
    timestamp: u64,
    /// Whether user owns the game (game_count >= 1 from Steam API)
    owns_game: bool,
    /// Hash of the revealed transcript data
    transcript_hash: String,
}

/// Compute Ethereum address from secp256k1 public key
fn pubkey_to_address(pubkey_bytes: &[u8]) -> Result<[u8; 20]> {
    // Parse the public key (could be compressed 33 bytes or uncompressed 65 bytes)
    let verifying_key = K256VerifyingKey::from_sec1_bytes(pubkey_bytes)
        .map_err(|e| anyhow!("Invalid public key: {}", e))?;

    // Get uncompressed public key (65 bytes: 0x04 || x || y)
    let uncompressed = verifying_key.to_encoded_point(false);
    let pubkey_bytes = uncompressed.as_bytes();

    // Ethereum address = last 20 bytes of keccak256(pubkey[1..65])
    // Skip the 0x04 prefix
    use tiny_keccak::{Hasher, Keccak};
    let mut hasher = Keccak::v256();
    hasher.update(&pubkey_bytes[1..]); // Skip 0x04 prefix
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);

    let mut address = [0u8; 20];
    address.copy_from_slice(&hash[12..]);
    Ok(address)
}

/// Try to recover the v value for ecrecover
fn find_recovery_id(
    pubkey_bytes: &[u8],
    message_hash: &[u8; 32],
    signature: &K256Signature,
) -> Result<RecoveryId> {
    let verifying_key = K256VerifyingKey::from_sec1_bytes(pubkey_bytes)
        .map_err(|e| anyhow!("Invalid public key: {}", e))?;

    // Try both possible recovery IDs
    for v in 0..2u8 {
        let recovery_id = RecoveryId::try_from(v)
            .map_err(|e| anyhow!("Invalid recovery id: {}", e))?;

        if let Ok(recovered) = K256VerifyingKey::recover_from_prehash(
            message_hash,
            signature,
            recovery_id,
        ) {
            if recovered == verifying_key {
                return Ok(recovery_id);
            }
        }
    }

    Err(anyhow!("Could not find recovery id for signature"))
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    info!("Loading presentation from {}", args.input);

    // Load the presentation
    let presentation_bytes = tokio::fs::read(&args.input).await?;
    let presentation: Presentation = bincode::deserialize(&presentation_bytes)?;

    // Get the verifying key before verification consumes presentation
    let verifying_key = presentation.verifying_key().clone();

    if args.verbose {
        eprintln!("Key algorithm: {}", verifying_key.alg);
        eprintln!("Key data ({} bytes): {}", verifying_key.data.len(), hex::encode(&verifying_key.data));
    }

    // Verify and extract data
    let provider = CryptoProvider::default();
    let PresentationOutput {
        server_name,
        connection_info,
        transcript,
        attestation,
        ..
    } = presentation.verify(&provider)?;

    let server_name = server_name.ok_or_else(|| anyhow!("No server name in proof"))?;
    let server_name_str = server_name.as_str().to_string();

    // Extract timestamp
    let timestamp = connection_info.time;
    let connection_time = DateTime::<Utc>::from_timestamp(timestamp as i64, 0)
        .ok_or_else(|| anyhow!("Invalid timestamp"))?;

    // Extract transcript and determine game ownership
    let mut partial_transcript = transcript.ok_or_else(|| anyhow!("No transcript in proof"))?;
    partial_transcript.set_unauthed(b'X');
    let recv = String::from_utf8_lossy(partial_transcript.received_unsafe());

    let owns_game = recv.contains("\"game_count\":1");
    let doesnt_own = recv.contains("\"game_count\":0");

    if !owns_game && !doesnt_own {
        return Err(anyhow!("No valid game_count found in revealed data"));
    }

    // Hash the transcript data
    let mut transcript_hasher = Sha256::new();
    transcript_hasher.update(partial_transcript.received_unsafe());
    let transcript_hash: [u8; 32] = transcript_hasher.finalize().into();

    // Get signature data from attestation
    let signature_alg = &attestation.signature.alg;
    let signature_data = &attestation.signature.data;

    if args.verbose {
        eprintln!("Signature algorithm: {:?}", signature_alg);
        eprintln!("Signature data ({} bytes): {}", signature_data.len(), hex::encode(signature_data));
    }

    // Parse signature (should be 64 bytes: r || s)
    if signature_data.len() != 64 {
        return Err(anyhow!("Expected 64-byte signature, got {} bytes", signature_data.len()));
    }

    let signature = K256Signature::from_slice(signature_data)
        .map_err(|e| anyhow!("Invalid signature: {}", e))?;

    // The message that was signed is the BCS-serialized header
    // We need to hash it the same way TLSNotary does
    let header_bytes = bcs::to_bytes(&attestation.header)?;

    if args.verbose {
        eprintln!("Header bytes ({} bytes): {}", header_bytes.len(), hex::encode(&header_bytes));
    }

    // For ecrecover, we need keccak256 of the message
    use tiny_keccak::{Hasher, Keccak};
    let mut hasher = Keccak::v256();
    hasher.update(&header_bytes);
    let mut message_hash = [0u8; 32];
    hasher.finalize(&mut message_hash);

    // Compute Ethereum address from public key
    let notary_address = pubkey_to_address(&verifying_key.data)?;

    // Find recovery ID for ecrecover
    // Note: TLSNotary uses k256 crate which signs with SHA256 prehash, not keccak256
    // For proper ecrecover we need to use the same hash the signature was created with
    let mut sha256_hasher = Sha256::new();
    sha256_hasher.update(&header_bytes);
    let sha256_hash: [u8; 32] = sha256_hasher.finalize().into();

    // Try to find recovery ID using SHA256 hash (what was actually signed)
    let recovery_id = find_recovery_id(&verifying_key.data, &sha256_hash, &signature)?;

    // Ethereum's v is recovery_id + 27
    let v = recovery_id.to_byte() + 27;

    // For Solidity, we'll pass the SHA256 hash since that's what was signed
    // The contract will need to be aware that TLSNotary uses SHA256, not keccak256

    let proof = SolidityProof {
        notary_address: format!("0x{}", hex::encode(notary_address)),
        signature_r: format!("0x{}", hex::encode(&signature_data[..32])),
        signature_s: format!("0x{}", hex::encode(&signature_data[32..])),
        signature_v: v,
        message_hash: format!("0x{}", hex::encode(&sha256_hash)),
        server_name: server_name_str.clone(),
        timestamp,
        owns_game,
        transcript_hash: format!("0x{}", hex::encode(&transcript_hash)),
    };

    // Write output
    let json = serde_json::to_string_pretty(&proof)?;
    tokio::fs::write(&args.output, &json).await?;

    info!("Proof exported to {}", args.output);

    println!("\n=== Solidity Proof ===");
    println!("Notary Address:   {}", proof.notary_address);
    println!("Server:           {}", proof.server_name);
    println!("Timestamp:        {} ({})", proof.timestamp, connection_time.format("%Y-%m-%d %H:%M:%S UTC"));
    println!("Owns Game:        {}", proof.owns_game);
    println!("Signature V:      {}", proof.signature_v);
    println!("Message Hash:     {}", proof.message_hash);
    println!("Transcript Hash:  {}", proof.transcript_hash);

    Ok(())
}
