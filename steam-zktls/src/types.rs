use serde::{Deserialize, Serialize};

/// Steam API response for resolving vanity URL
#[derive(Debug, Deserialize)]
pub struct VanityUrlResponse {
    pub response: VanityUrlInner,
}

#[derive(Debug, Deserialize)]
pub struct VanityUrlInner {
    pub steamid: Option<String>,
    pub success: i32,
}

/// Steam API response for owned games
#[derive(Debug, Deserialize)]
pub struct OwnedGamesResponse {
    pub response: OwnedGamesInner,
}

#[derive(Debug, Deserialize)]
pub struct OwnedGamesInner {
    pub game_count: Option<u32>,
    pub games: Option<Vec<Game>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Game {
    pub appid: u32,
    pub name: Option<String>,
    pub playtime_forever: Option<u32>,
}

/// The claim we want to prove: user owns a specific game
#[derive(Debug, Serialize, Deserialize)]
pub struct SteamOwnershipClaim {
    /// The vanity URL (username) being verified
    pub vanity_url: String,
    /// The Steam ID resolved from vanity URL
    pub steam_id: String,
    /// The app ID we're proving ownership of
    pub app_id: u32,
    /// Whether ownership was verified
    pub owns_game: bool,
}

/// Proof output that contains the TLSNotary attestation
#[derive(Debug, Serialize, Deserialize)]
pub struct OwnershipProof {
    /// The claim being proven
    pub claim: SteamOwnershipClaim,
    /// TLSNotary session proof (serialized)
    pub session_proof: Vec<u8>,
    /// Substrings proof showing the app_id in response
    pub substrings_proof: Vec<u8>,
    /// Timestamp of proof generation
    pub timestamp: u64,
}
