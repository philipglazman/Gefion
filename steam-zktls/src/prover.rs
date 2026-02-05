mod types;

use anyhow::{anyhow, Result};
use clap::Parser;
use http_body_util::{BodyExt, Empty};
use hyper::{body::Bytes, Request, StatusCode};
use hyper_util::rt::TokioIo;
use notary_client::{Accepted, NotarizationRequest, NotaryClient};
use tlsn_common::config::ProtocolConfig;
use tlsn_core::{request::RequestConfig, transcript::TranscriptCommitConfig};
use tlsn_formats::http::{DefaultHttpCommitter, HttpCommit, HttpTranscript};
use tlsn_prover::{Prover, ProverConfig};
use tokio::net::TcpStream;
use tokio_util::compat::{FuturesAsyncReadCompatExt, TokioAsyncReadCompatExt};
use tracing::info;

use types::{OwnedGamesResponse, SteamOwnershipClaim, VanityUrlResponse};

const STEAM_API_HOST: &str = "api.steampowered.com";
const DEFAULT_NOTARY_HOST: &str = "127.0.0.1";
const DEFAULT_NOTARY_PORT: u16 = 7047;

#[derive(Parser, Debug)]
#[command(author, version, about = "Generate zkTLS proof of Steam game ownership")]
struct Args {
    /// Steam vanity URL (username)
    #[arg(short, long)]
    vanity_url: String,

    /// Steam app ID to verify ownership of
    #[arg(short, long)]
    app_id: u32,

    /// Steam API key (or set STEAM_API_KEY env var)
    #[arg(short, long, env = "STEAM_API_KEY")]
    steam_key: String,

    /// Output prefix for attestation and secrets files
    #[arg(short, long, default_value = "steam_ownership")]
    output: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file if present
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt::init();
    let args = Args::parse();

    info!(
        "Generating ownership proof for vanity_url={}, app_id={}",
        args.vanity_url, args.app_id
    );

    // Step 1: Resolve vanity URL to Steam ID (non-zkTLS, public info)
    let steam_id = resolve_vanity_url(&args.steam_key, &args.vanity_url).await?;
    info!("Resolved Steam ID: {}", steam_id);

    // Resolve notary host/port from env vars (or defaults)
    let notary_host = std::env::var("NOTARY_HOST").unwrap_or_else(|_| DEFAULT_NOTARY_HOST.to_string());
    let notary_port: u16 = std::env::var("NOTARY_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_NOTARY_PORT);

    // Step 2: Generate zkTLS attestation for owned games API call
    generate_attestation(
        &args.steam_key,
        &args.vanity_url,
        &steam_id,
        args.app_id,
        &args.output,
        &notary_host,
        notary_port,
    )
    .await?;

    info!("Attestation generated successfully!");
    info!("Files created:");
    info!("  - {}.attestation.tlsn", args.output);
    info!("  - {}.secrets.tlsn", args.output);
    info!("  - {}.claim.json", args.output);
    info!("\nRun `present` to create a selective disclosure presentation.");

    Ok(())
}

/// Resolve Steam vanity URL to Steam ID using regular HTTPS
async fn resolve_vanity_url(api_key: &str, vanity_url: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://{}/ISteamUser/ResolveVanityURL/v1/?key={}&vanityurl={}",
        STEAM_API_HOST, api_key, vanity_url
    );

    let response: VanityUrlResponse = client.get(&url).send().await?.json().await?;

    if response.response.success != 1 {
        return Err(anyhow!("Failed to resolve vanity URL"));
    }

    response
        .response
        .steamid
        .ok_or_else(|| anyhow!("No Steam ID in response"))
}

/// Generate zkTLS attestation of game ownership
async fn generate_attestation(
    api_key: &str,
    vanity_url: &str,
    steam_id: &str,
    app_id: u32,
    output_prefix: &str,
    notary_host: &str,
    notary_port: u16,
) -> Result<()> {
    // Build the request path - query only the specific game using appids_filter
    // This keeps the response small and private (doesn't expose other games)
    let request_path = format!(
        "/IPlayerService/GetOwnedGames/v1/?key={}&steamid={}&appids_filter%5B0%5D={}&format=json",
        api_key, steam_id, app_id
    );

    // Connect to notary server
    info!("Connecting to notary server at {}:{}", notary_host, notary_port);
    let notary_client = NotaryClient::builder()
        .host(notary_host)
        .port(notary_port)
        .enable_tls(false) // No TLS for localhost
        .build()?;

    // Request notarization
    let notarization_request = NotarizationRequest::builder()
        .max_sent_data(1024)
        .max_recv_data(4096) // Filtered response is small
        .build()?;

    let Accepted {
        io: notary_connection,
        id: _session_id,
        ..
    } = notary_client.request_notarization(notarization_request).await?;

    info!("Notarization session established");

    // Configure the prover
    let config = ProverConfig::builder()
        .server_name(STEAM_API_HOST)
        .protocol_config(
            ProtocolConfig::builder()
                .max_sent_data(1024)
                .max_recv_data(4096)
                .build()?,
        )
        .build()?;

    // Create prover and set up with notary connection
    let prover = Prover::new(config)
        .setup(notary_connection.compat())
        .await?;

    // Connect to Steam API
    info!("Connecting to Steam API...");
    let client_socket = TcpStream::connect((STEAM_API_HOST, 443)).await?;

    // Bind prover to server connection
    let (mpc_tls_connection, prover_fut) = prover.connect(client_socket.compat()).await?;
    let mpc_tls_connection = TokioIo::new(mpc_tls_connection.compat());

    // Spawn prover task
    let prover_task = tokio::spawn(prover_fut);

    // Perform HTTP request through MPC-TLS connection
    let (mut request_sender, connection) = hyper::client::conn::http1::handshake(mpc_tls_connection).await?;
    tokio::spawn(connection);

    let request = Request::builder()
        .method("GET")
        .uri(&request_path)
        .header("Host", STEAM_API_HOST)
        .header("Accept", "application/json")
        .header("Connection", "close")
        .body(Empty::<Bytes>::new())?;

    info!("Sending request to Steam API...");
    let response = request_sender.send_request(request).await?;

    if response.status() != StatusCode::OK {
        return Err(anyhow!("Steam API returned status: {}", response.status()));
    }

    // Collect response body
    let body_bytes = response.into_body().collect().await?.to_bytes();
    let body_str = String::from_utf8(body_bytes.to_vec())?;

    info!("Received response from Steam API ({} bytes)", body_str.len());

    // Parse response to check ownership (filtered API returns game_count: 0 or 1)
    let owns_game = body_str.contains("\"game_count\":1");

    if owns_game {
        info!("User OWNS app_id {}", app_id);
    } else {
        info!("User does NOT own app_id {}", app_id);
    }

    // Get the prover back after connection closes
    let prover = prover_task.await??;

    // Start notarization
    let mut prover = prover.start_notarize();

    // Parse HTTP transcript
    let transcript = HttpTranscript::parse(prover.transcript())?;

    // Commit to the transcript
    let mut builder = TranscriptCommitConfig::builder(prover.transcript());

    // Use default HTTP committer to commit to the transcript
    DefaultHttpCommitter::default().commit_transcript(&mut builder, &transcript)?;

    let config = builder.build()?;
    prover.transcript_commit(config);

    // Request configuration - specify what we want attested
    let request_config = RequestConfig::default();

    // Finalize and get attestation
    let (attestation, secrets) = prover.finalize(&request_config).await?;

    info!("Attestation generated");

    // Save attestation and secrets
    let attestation_path = format!("{}.attestation.tlsn", output_prefix);
    let secrets_path = format!("{}.secrets.tlsn", output_prefix);
    let claim_path = format!("{}.claim.json", output_prefix);

    tokio::fs::write(&attestation_path, bincode::serialize(&attestation)?).await?;
    tokio::fs::write(&secrets_path, bincode::serialize(&secrets)?).await?;

    // Save the claim metadata
    let claim = SteamOwnershipClaim {
        vanity_url: vanity_url.to_string(),
        steam_id: steam_id.to_string(),
        app_id,
        owns_game,
    };
    tokio::fs::write(&claim_path, serde_json::to_string_pretty(&claim)?).await?;

    Ok(())
}
