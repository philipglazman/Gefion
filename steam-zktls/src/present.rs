mod types;

use anyhow::{anyhow, Result};
use clap::Parser;
use tlsn_core::{attestation::Attestation, presentation::Presentation, CryptoProvider, Secrets};
use tlsn_formats::http::HttpTranscript;
use tracing::info;

use types::SteamOwnershipClaim;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Input prefix for attestation and secrets files
    #[arg(short, long, default_value = "steam_ownership")]
    input: String,

    /// Output file for the presentation
    #[arg(short, long, default_value = "steam_ownership.presentation.tlsn")]
    output: String,

    /// App ID to prove ownership of (selectively reveals only this game)
    #[arg(short, long)]
    app_id: u32,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    info!("Creating selective disclosure presentation for app_id={}", args.app_id);

    // Load attestation and secrets
    let attestation_path = format!("{}.attestation.tlsn", args.input);
    let secrets_path = format!("{}.secrets.tlsn", args.input);
    let claim_path = format!("{}.claim.json", args.input);

    info!("Loading attestation from {}", attestation_path);
    let attestation: Attestation =
        bincode::deserialize(&tokio::fs::read(&attestation_path).await?)?;

    info!("Loading secrets from {}", secrets_path);
    let secrets: Secrets = bincode::deserialize(&tokio::fs::read(&secrets_path).await?)?;

    // Load claim to verify app_id matches
    let claim: SteamOwnershipClaim =
        serde_json::from_str(&tokio::fs::read_to_string(&claim_path).await?)?;

    if claim.app_id != args.app_id {
        return Err(anyhow!(
            "Requested app_id {} does not match attestation app_id {}",
            args.app_id,
            claim.app_id
        ));
    }

    // Parse HTTP transcript
    let transcript = HttpTranscript::parse(secrets.transcript())?;

    info!("Building selective disclosure proof...");

    // Get the raw received data to find the game entry
    let recv_data = secrets.transcript().received();
    let recv_str = String::from_utf8_lossy(recv_data);

    // Find just the "appid":XXX portion - minimal disclosure
    // We only need to prove the appid exists, not playtime or other data
    let app_id_pattern = format!("\"appid\":{}", args.app_id);

    let start = recv_str.find(&app_id_pattern)
        .ok_or_else(|| anyhow!("Could not find app_id {} in response", args.app_id))?;
    let game_range = start..(start + app_id_pattern.len());

    info!("Found appid at bytes {}..{}", game_range.start, game_range.end);

    // Build transcript proof with selective disclosure
    let mut builder = secrets.transcript_proof_builder();

    // For the request: only reveal Host header (proves it's from Steam)
    // Hide: full URL (contains API key), other headers
    let request = &transcript.requests[0];

    // Reveal only the Host header to prove it's Steam API
    for header in &request.headers {
        let header_name = header.name.as_str().to_lowercase();
        if header_name == "host" {
            builder.reveal_sent(header)?;
        }
    }

    // For the response: only reveal the specific game entry
    // This proves the app_id exists without revealing other games
    builder.reveal_recv(&game_range)?;

    let transcript_proof = builder.build()?;

    // Build the presentation
    let provider = CryptoProvider::default();
    let mut presentation_builder = attestation.presentation_builder(&provider);

    presentation_builder
        .identity_proof(secrets.identity_proof())
        .transcript_proof(transcript_proof);

    let presentation: Presentation = presentation_builder.build()?;

    // Save presentation
    tokio::fs::write(&args.output, bincode::serialize(&presentation)?).await?;

    info!("Presentation saved to {}", args.output);
    info!("\nThis presentation proves:");
    info!("  - Data came from api.steampowered.com");
    info!("  - Response contains \"appid\":{}", claim.app_id);
    info!("  - Connection timestamp is included");
    info!("\nPrivacy preserved:");
    info!("  - API key is NOT revealed");
    info!("  - Other games are NOT revealed");
    info!("  - Steam ID is NOT revealed");
    info!("  - Playtime is NOT revealed");
    info!("\nRun `verifier` to verify this presentation.");

    Ok(())
}
