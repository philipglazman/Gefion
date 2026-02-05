mod types;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use clap::Parser;
use std::time::Duration;
use tlsn_core::{
    presentation::{Presentation, PresentationOutput},
    CryptoProvider,
};
use tracing::info;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to the presentation file
    #[arg(short, long, default_value = "steam_ownership.presentation.tlsn")]
    presentation: String,

    /// Expected app ID (optional, for additional verification)
    #[arg(short, long)]
    app_id: Option<u32>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    info!("Loading presentation from {}", args.presentation);

    // Load the presentation
    let presentation: Presentation =
        bincode::deserialize(&tokio::fs::read(&args.presentation).await?)?;

    let provider = CryptoProvider::default();

    // Get and display the verifying key
    let verifying_key = presentation.verifying_key();
    info!(
        "Verifying presentation with {} key: {}",
        verifying_key.alg,
        hex::encode(&verifying_key.data)
    );
    info!("** Ensure you trust this notary key **\n");

    // Verify the presentation
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
        return Err(anyhow!(
            "Invalid server: expected api.steampowered.com, got {}",
            server_name.as_str()
        ));
    }

    // Get transcript data
    let mut partial_transcript = transcript.ok_or_else(|| anyhow!("No transcript in proof"))?;

    // Mark redacted bytes
    partial_transcript.set_unauthed(b'X');

    let sent = String::from_utf8_lossy(partial_transcript.sent_unsafe());
    let recv = String::from_utf8_lossy(partial_transcript.received_unsafe());

    // If app_id specified, verify it exists in the response
    if let Some(expected_app_id) = args.app_id {
        let app_pattern = format!("\"appid\":{}", expected_app_id);
        if !recv.contains(&app_pattern) {
            return Err(anyhow!(
                "App ID {} not found in verified response",
                expected_app_id
            ));
        }
        info!("App ID {} verified in response", expected_app_id);
    }

    // Display results
    println!("\n========================================");
    println!("  PROOF VERIFIED SUCCESSFULLY");
    println!("========================================");
    println!("Server: {}", server_name.as_str());
    println!("Connection time: {} UTC", connection_time.format("%Y-%m-%d %H:%M:%S"));
    println!("========================================\n");

    println!("Request sent (redacted parts shown as X):");
    println!("----------------------------------------");
    println!("{}", sent);
    println!("----------------------------------------\n");

    // Find and display only the revealed game entry (non-X characters)
    println!("Revealed data from response:");
    println!("----------------------------------------");

    // Extract the revealed portion (everything that's not X)
    let revealed: String = recv
        .split('X')
        .filter(|s| !s.is_empty() && s.len() > 5)
        .collect::<Vec<_>>()
        .join("\n");

    if revealed.is_empty() {
        println!("(No data revealed - check presentation)");
    } else {
        println!("{}", revealed);
    }
    println!("----------------------------------------\n");

    if let Some(app_id) = args.app_id {
        println!("VERIFIED: User owns app_id {} as of {}", app_id, connection_time);
        println!("\nPrivacy preserved - the following were NOT revealed:");
        println!("  - Steam API key");
        println!("  - Steam ID");
        println!("  - Other owned games");
    }

    Ok(())
}
