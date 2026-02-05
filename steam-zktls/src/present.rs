mod types;

use anyhow::{anyhow, Result};
use clap::Parser;
use tlsn_core::{attestation::Attestation, presentation::Presentation, CryptoProvider, Secrets};
use tlsn_formats::http::HttpTranscript;
use tracing::info;

use types::SteamOwnershipClaim;

#[derive(Parser, Debug)]
#[command(author, version, about = "Create selective disclosure presentation")]
struct Args {
    /// Input prefix for attestation and secrets files
    #[arg(short, long, default_value = "steam_ownership")]
    input: String,

    /// Output file for the presentation
    #[arg(short, long, default_value = "steam_ownership.presentation.tlsn")]
    output: String,

    /// App ID (must match the attestation)
    #[arg(short, long)]
    app_id: u32,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

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

    let game_count_pattern = if claim.owns_game {
        "\"game_count\":1"
    } else {
        "\"game_count\":0"
    };

    info!("Proof will show: {}", game_count_pattern);

    // Build transcript proof with selective disclosure
    let mut builder = secrets.transcript_proof_builder();

    // Reveal Host header (proves it's from Steam)
    let request = &transcript.requests[0];
    for header in &request.headers {
        if header.name.as_str().eq_ignore_ascii_case("host") {
            builder.reveal_sent(header)?;
        }
    }

    // Reveal the response - it's already filtered to just the one game
    // Response is ~244 bytes, contains only game_count:0 or game_count:1
    let response = &transcript.responses[0];
    builder.reveal_recv(response)?;

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
    info!("\nRevealed: {} (for app_id {})", game_count_pattern, claim.app_id);
    info!("Hidden: API key, Steam ID, playtime, all other data");

    Ok(())
}
