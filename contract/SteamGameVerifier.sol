// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SteamOwnershipVerifier} from "./SteamOwnershipVerifier.sol";

interface ISteamGameEscrow {
    function submitProofResult(uint256 listingId, bool buyerOwnsGame) external;
}

/// @title SteamGameVerifier
/// @notice Verifies zkTLS proofs of Steam game ownership and resolves escrow listings
/// @dev Anyone can submit a valid proof to resolve a listing - the contract verifies on-chain
contract SteamGameVerifier {
    SteamOwnershipVerifier public immutable ownershipVerifier;
    ISteamGameEscrow public immutable escrow;

    /// @notice Maximum age of a proof (prevents stale proofs from being used)
    uint64 public constant MAX_PROOF_AGE = 1 hours;

    event ListingResolved(
        uint256 indexed listingId,
        bool buyerOwnsGame,
        uint64 proofTimestamp,
        bytes32 transcriptHash
    );

    error ProofTooOld(uint64 proofTimestamp, uint256 currentTimestamp);
    error ProofInFuture(uint64 proofTimestamp, uint256 currentTimestamp);

    constructor(address _ownershipVerifier, address _escrow) {
        require(_ownershipVerifier != address(0), "Invalid verifier");
        require(_escrow != address(0), "Invalid escrow");
        ownershipVerifier = SteamOwnershipVerifier(_ownershipVerifier);
        escrow = ISteamGameEscrow(_escrow);
    }

    /// @notice Verify a zkTLS proof and resolve the escrow listing
    /// @param listingId The listing to resolve
    /// @param messageHash SHA256 hash of the BCS-serialized attestation header
    /// @param v Signature recovery parameter (27 or 28)
    /// @param r Signature r value
    /// @param s Signature s value
    /// @param serverName Server name from the TLS connection
    /// @param timestamp Unix timestamp of the TLS connection
    /// @param ownsGame Whether the proof shows game ownership
    /// @param transcriptHash SHA256 hash of the revealed transcript data
    function verifyAndResolve(
        uint256 listingId,
        bytes32 messageHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        string calldata serverName,
        uint64 timestamp,
        bool ownsGame,
        bytes32 transcriptHash
    ) external {
        // Verify the proof on-chain via SteamOwnershipVerifier
        SteamOwnershipVerifier.VerificationResult memory result = ownershipVerifier.verifyOwnership(
            messageHash, v, r, s, serverName, timestamp, ownsGame, transcriptHash
        );

        // Validate proof freshness against block.timestamp
        _validateTimestamp(result.timestamp);

        // Submit result to escrow
        escrow.submitProofResult(listingId, result.ownsGame);

        emit ListingResolved(listingId, result.ownsGame, result.timestamp, result.transcriptHash);
    }

    /// @notice Verify a zkTLS proof (packed) and resolve the escrow listing
    /// @param listingId The listing to resolve
    /// @param proof ABI-encoded proof data
    function verifyAndResolvePacked(uint256 listingId, bytes calldata proof) external {
        // Verify the proof on-chain via SteamOwnershipVerifier
        SteamOwnershipVerifier.VerificationResult memory result = ownershipVerifier.verifyOwnershipPacked(proof);

        // Validate proof freshness against block.timestamp
        _validateTimestamp(result.timestamp);

        // Submit result to escrow
        escrow.submitProofResult(listingId, result.ownsGame);

        emit ListingResolved(listingId, result.ownsGame, result.timestamp, result.transcriptHash);
    }

    /// @dev Ensure the proof timestamp is recent and not in the future
    function _validateTimestamp(uint64 proofTimestamp) internal view {
        if (proofTimestamp > block.timestamp) {
            revert ProofInFuture(proofTimestamp, block.timestamp);
        }
        if (block.timestamp - proofTimestamp > MAX_PROOF_AGE) {
            revert ProofTooOld(proofTimestamp, block.timestamp);
        }
    }
}
