// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SteamOwnershipVerifier} from "./SteamOwnershipVerifier.sol";

interface ISteamGameEscrow {
    function submitProofResult(uint256 tradeId, bool buyerOwnsGame) external;
    function getAcknowledgedAt(uint256 tradeId) external view returns (uint256);
}

/// @title SteamGameVerifier
/// @notice Verifies zkTLS proofs of Steam game ownership and resolves escrow trades
/// @dev Anyone can submit a valid proof to resolve a trade - the contract verifies on-chain
contract SteamGameVerifier {
    SteamOwnershipVerifier public immutable ownershipVerifier;
    ISteamGameEscrow public immutable escrow;

    /// @notice Dispute window duration (must match escrow)
    uint64 public constant DISPUTE_WINDOW = 1 hours;

    event TradeResolved(
        uint256 indexed tradeId,
        bool buyerOwnsGame,
        uint64 proofTimestamp,
        bytes32 transcriptHash
    );

    error ProofBeforeAcknowledge(uint64 proofTimestamp, uint256 acknowledgedAt);
    error ProofAfterWindow(uint64 proofTimestamp, uint256 windowEnd);
    error ProofInFuture(uint64 proofTimestamp, uint256 currentTimestamp);

    constructor(address _ownershipVerifier, address _escrow) {
        require(_ownershipVerifier != address(0), "Invalid verifier");
        require(_escrow != address(0), "Invalid escrow");
        ownershipVerifier = SteamOwnershipVerifier(_ownershipVerifier);
        escrow = ISteamGameEscrow(_escrow);
    }

    /// @notice Verify a zkTLS proof and resolve the escrow trade
    /// @param tradeId The trade to resolve
    /// @param messageHash SHA256 hash of the BCS-serialized attestation header
    /// @param v Signature recovery parameter (27 or 28)
    /// @param r Signature r value
    /// @param s Signature s value
    /// @param serverName Server name from the TLS connection
    /// @param timestamp Unix timestamp of the TLS connection
    /// @param ownsGame Whether the proof shows game ownership
    /// @param transcriptHash SHA256 hash of the revealed transcript data
    function verifyAndResolve(
        uint256 tradeId,
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
        SteamOwnershipVerifier.VerificationResult memory result =
            ownershipVerifier.verifyOwnership(
                messageHash, v, r, s, serverName, timestamp, ownsGame, transcriptHash
            );

        // Validate proof timestamp falls within [acknowledgedAt, acknowledgedAt + DISPUTE_WINDOW]
        uint256 ackAt = escrow.getAcknowledgedAt(tradeId);
        _validateTimestamp(result.timestamp, ackAt);

        // Submit result to escrow
        escrow.submitProofResult(tradeId, result.ownsGame);

        emit TradeResolved(tradeId, result.ownsGame, result.timestamp, result.transcriptHash);
    }

    /// @notice Verify a zkTLS proof (packed) and resolve the escrow trade
    /// @param tradeId The trade to resolve
    /// @param proof ABI-encoded proof data
    function verifyAndResolvePacked(uint256 tradeId, bytes calldata proof) external {
        // Verify the proof on-chain via SteamOwnershipVerifier
        SteamOwnershipVerifier.VerificationResult memory result =
            ownershipVerifier.verifyOwnershipPacked(proof);

        // Validate proof timestamp falls within [acknowledgedAt, acknowledgedAt + DISPUTE_WINDOW]
        uint256 ackAt = escrow.getAcknowledgedAt(tradeId);
        _validateTimestamp(result.timestamp, ackAt);

        // Submit result to escrow
        escrow.submitProofResult(tradeId, result.ownsGame);

        emit TradeResolved(tradeId, result.ownsGame, result.timestamp, result.transcriptHash);
    }

    /// @dev Ensure proof timestamp falls within [acknowledgedAt, acknowledgedAt + DISPUTE_WINDOW]
    ///      and is not in the future
    function _validateTimestamp(uint64 proofTimestamp, uint256 acknowledgedAt) internal view {
        if (proofTimestamp < acknowledgedAt) {
            revert ProofBeforeAcknowledge(proofTimestamp, acknowledgedAt);
        }
        if (proofTimestamp > acknowledgedAt + DISPUTE_WINDOW) {
            revert ProofAfterWindow(proofTimestamp, acknowledgedAt + DISPUTE_WINDOW);
        }
        if (proofTimestamp > block.timestamp) {
            revert ProofInFuture(proofTimestamp, block.timestamp);
        }
    }
}
