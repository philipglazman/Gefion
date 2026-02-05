mod types;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use clap::Parser;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::process::ExitCode;
use tlsn_core::{
    presentation::{Presentation, PresentationOutput},
    CryptoProvider,
};

#[derive(Parser, Debug)]
#[command(author, version, about = "Verify Steam game ownership proof")]
struct Args {
    /// Path to the presentation file
    #[arg(short, long, default_value = "steam_ownership.presentation.tlsn")]
    presentation: String,

    /// App ID to verify
    #[arg(short, long)]
    app_id: u32,

    /// Show detailed output
    #[arg(short, long, default_value = "false")]
    verbose: bool,

    /// Output as JSON (matches Solidity VerificationResult struct)
    #[arg(short, long, default_value = "false")]
    json: bool,
}

/// Verification result matching Solidity's VerificationResult struct
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerificationResult {
    /// Whether the user owns the game
    owns_game: bool,
    /// Unix timestamp of the TLS connection
    timestamp: u64,
    /// SHA256 hash of the revealed transcript data
    transcript_hash: String,
}

#[tokio::main]
async fn main() -> ExitCode {
    let args = Args::parse();

    match verify(&args).await {
        Ok(result) => {
            if args.json {
                println!("{}", serde_json::to_string_pretty(&result).unwrap());
            } else {
                println!("{}", if result.owns_game { "yes" } else { "no" });
            }
            if result.owns_game {
                ExitCode::SUCCESS
            } else {
                ExitCode::from(1)
            }
        }
        Err(e) => {
            if args.verbose {
                eprintln!("error: {}", e);
            }
            if args.json {
                eprintln!("{{\"error\": \"{}\"}}", e);
            } else {
                println!("no");
            }
            ExitCode::from(1)
        }
    }
}

async fn verify(args: &Args) -> Result<VerificationResult> {
    // Load the presentation
    let presentation: Presentation = bincode::deserialize(
        &tokio::fs::read(&args.presentation).await?
    )?;

    let provider = CryptoProvider::default();

    if args.verbose {
        let verifying_key = presentation.verifying_key();
        eprintln!(
            "Verifying with {} key: {}",
            verifying_key.alg,
            hex::encode(&verifying_key.data)
        );
    }

    // Verify the presentation cryptographically
    let PresentationOutput {
        server_name,
        connection_info,
        transcript,
        ..
    } = presentation.verify(&provider)?;

    // Extract timestamp
    let timestamp = connection_info.time;
    let connection_time = DateTime::<Utc>::from_timestamp(timestamp as i64, 0)
        .ok_or_else(|| anyhow!("Invalid timestamp"))?;

    let server_name = server_name.ok_or_else(|| anyhow!("No server name in proof"))?;

    // Verify it's from Steam API
    if server_name.as_str() != "api.steampowered.com" {
        if args.verbose {
            eprintln!("Invalid server: {}", server_name.as_str());
        }
        return Err(anyhow!("Invalid server: {}", server_name.as_str()));
    }

    // Get transcript data
    let mut partial_transcript = transcript.ok_or_else(|| anyhow!("No transcript in proof"))?;
    partial_transcript.set_unauthed(b'X');

    let transcript_bytes = partial_transcript.received_unsafe();
    let recv = String::from_utf8_lossy(transcript_bytes);

    // Compute transcript hash (matches Solidity)
    let mut hasher = Sha256::new();
    hasher.update(transcript_bytes);
    let transcript_hash: [u8; 32] = hasher.finalize().into();

    // Check for game_count in revealed data
    let owns_game = recv.contains("\"game_count\":1");
    let doesnt_own = recv.contains("\"game_count\":0");

    if args.verbose {
        eprintln!("server: {}", server_name.as_str());
        eprintln!("timestamp: {} ({})", timestamp, connection_time.format("%Y-%m-%d %H:%M:%S UTC"));
        eprintln!("app_id: {}", args.app_id);
        eprintln!("owns_game: {}", owns_game);
        eprintln!("transcript_hash: 0x{}", hex::encode(&transcript_hash));
    }

    if !owns_game && !doesnt_own {
        return Err(anyhow!("Invalid proof - no game_count revealed"));
    }

    Ok(VerificationResult {
        owns_game,
        timestamp,
        transcript_hash: format!("0x{}", hex::encode(&transcript_hash)),
    })
}
