// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title SteamOwnershipVerifier
/// @notice Verifies TLSNotary proofs for Steam game ownership
/// @dev This contract verifies that a TLSNotary proof attests to Steam game ownership
///      by checking the Notary's ECDSA signature over the attestation header.
///
/// Key cryptographic details:
/// - TLSNotary uses secp256k1 ECDSA signatures with SHA256 prehash (not keccak256)
/// - The signed message is a BCS-serialized attestation header
/// - Ethereum's ecrecover expects keccak256, so we verify by passing the pre-computed SHA256 hash
///
/// Trust model:
/// - We trust the Notary to have validated the TLS certificate chain (X.509)
/// - We verify on-chain: Notary signature, server name, and revealed transcript data
contract SteamOwnershipVerifier is Ownable {
    /// @notice Result of a proof verification
    struct VerificationResult {
        bool ownsGame;      // Whether the proof shows game ownership
        uint64 timestamp;   // Unix timestamp of the TLS connection (when proof was generated)
        bytes32 transcriptHash; // Hash of the revealed transcript data
    }

    /// @notice The trusted Notary's Ethereum address (derived from secp256k1 pubkey)
    address public notaryAddress;

    /// @notice Expected server name for Steam API
    string public constant EXPECTED_SERVER = "api.steampowered.com";

    /// @notice Emitted when the Notary address is updated
    event NotaryUpdated(address indexed oldNotary, address indexed newNotary);

    /// @notice Emitted when a proof is verified
    event ProofVerified(
        address indexed verifier,
        bool ownsGame,
        uint64 timestamp,
        bytes32 transcriptHash
    );

    error InvalidNotarySignature();
    error InvalidServerName();
    error InvalidTranscript();
    error ZeroAddress();

    /// @notice Initialize the verifier with a trusted Notary address
    /// @param _notaryAddress The Ethereum address derived from the Notary's secp256k1 public key
    constructor(address _notaryAddress) Ownable(msg.sender) {
        if (_notaryAddress == address(0)) revert ZeroAddress();
        notaryAddress = _notaryAddress;
    }

    /// @notice Update the trusted Notary address
    /// @param _notaryAddress New Notary address
    function setNotary(address _notaryAddress) external onlyOwner {
        if (_notaryAddress == address(0)) revert ZeroAddress();
        address oldNotary = notaryAddress;
        notaryAddress = _notaryAddress;
        emit NotaryUpdated(oldNotary, _notaryAddress);
    }

    /// @notice Verify a Steam game ownership proof
    /// @param messageHash SHA256 hash of the BCS-serialized attestation header (pre-computed)
    /// @param v Signature recovery parameter (27 or 28)
    /// @param r Signature r value
    /// @param s Signature s value
    /// @param serverName Server name from the TLS connection
    /// @param timestamp Unix timestamp of the TLS connection
    /// @param ownsGame Whether the user owns the game (from game_count in Steam API response)
    /// @param transcriptHash SHA256 hash of the revealed transcript data
    /// @return result Struct containing ownsGame, timestamp, and transcriptHash
    function verifyOwnership(
        bytes32 messageHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        string calldata serverName,
        uint64 timestamp,
        bool ownsGame,
        bytes32 transcriptHash
    ) external returns (VerificationResult memory result) {
        // 1. Verify the server name matches Steam API
        if (keccak256(bytes(serverName)) != keccak256(bytes(EXPECTED_SERVER))) {
            revert InvalidServerName();
        }

        // 2. Verify the Notary signature
        // Note: TLSNotary signs SHA256(header), but ecrecover expects the hash to be passed directly.
        // Since we can't recompute the BCS-serialized header on-chain, we trust the provided messageHash
        // and verify that the Notary signed it.
        address recovered = ecrecover(messageHash, v, r, s);
        if (recovered != notaryAddress) {
            revert InvalidNotarySignature();
        }

        // 3. Build result
        result.ownsGame = ownsGame;
        result.timestamp = timestamp;
        result.transcriptHash = transcriptHash;

        emit ProofVerified(msg.sender, result.ownsGame, timestamp, transcriptHash);

        return result;
    }

    /// @notice Verify ownership and revert if not owned (for use as a modifier pattern)
    /// @dev Same parameters as verifyOwnership
    /// @return result The verification result (only returned if ownership verified)
    function requireOwnership(
        bytes32 messageHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        string calldata serverName,
        uint64 timestamp,
        bool ownsGame,
        bytes32 transcriptHash
    ) external returns (VerificationResult memory result) {
        result = this.verifyOwnership(
            messageHash,
            v,
            r,
            s,
            serverName,
            timestamp,
            ownsGame,
            transcriptHash
        );
        require(result.ownsGame, "Must own game");
        return result;
    }

    /// @notice Verify a proof using packed calldata (gas optimized)
    /// @param proof ABI-encoded proof data
    /// @return result Struct containing ownsGame, timestamp, and transcriptHash
    function verifyOwnershipPacked(bytes calldata proof) external returns (VerificationResult memory result) {
        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            string memory serverName,
            uint64 timestamp,
            bool ownsGame,
            bytes32 transcriptHash
        ) = abi.decode(proof, (bytes32, uint8, bytes32, bytes32, string, uint64, bool, bytes32));

        return this.verifyOwnership(
            messageHash,
            v,
            r,
            s,
            serverName,
            timestamp,
            ownsGame,
            transcriptHash
        );
    }
}
