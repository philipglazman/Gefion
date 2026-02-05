mod types;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use clap::Parser;
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
}

#[tokio::main]
async fn main() -> ExitCode {
    let args = Args::parse();

    match verify(&args).await {
        Ok(true) => {
            println!("yes");
            ExitCode::SUCCESS
        }
        Ok(false) => {
            println!("no");
            ExitCode::from(1)
        }
        Err(e) => {
            if args.verbose {
                eprintln!("error: {}", e);
            }
            println!("no");
            ExitCode::from(1)
        }
    }
}

async fn verify(args: &Args) -> Result<bool> {
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

    // Extract connection time
    let connection_time = DateTime::<Utc>::from_timestamp(connection_info.time as i64, 0)
        .ok_or_else(|| anyhow!("Invalid timestamp"))?;

    let server_name = server_name.ok_or_else(|| anyhow!("No server name in proof"))?;

    // Verify it's from Steam API
    if server_name.as_str() != "api.steampowered.com" {
        if args.verbose {
            eprintln!("Invalid server: {}", server_name.as_str());
        }
        return Ok(false);
    }

    // Get transcript data
    let mut partial_transcript = transcript.ok_or_else(|| anyhow!("No transcript in proof"))?;
    partial_transcript.set_unauthed(b'X');

    let recv = String::from_utf8_lossy(partial_transcript.received_unsafe());

    // Check for game_count in revealed data
    let owns_game = recv.contains("\"game_count\":1");
    let doesnt_own = recv.contains("\"game_count\":0");

    if args.verbose {
        eprintln!("server: {}", server_name.as_str());
        eprintln!("timestamp: {} UTC", connection_time.format("%Y-%m-%d %H:%M:%S"));
        eprintln!("app_id: {}", args.app_id);
        eprintln!("revealed: {}", if owns_game { "game_count:1" } else if doesnt_own { "game_count:0" } else { "unknown" });
    }

    if !owns_game && !doesnt_own {
        if args.verbose {
            eprintln!("No valid game_count found in revealed data");
        }
        return Err(anyhow!("Invalid proof - no game_count revealed"));
    }

    Ok(owns_game)
}
