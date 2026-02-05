// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SteamOwnershipVerifier} from "./SteamOwnershipVerifier.sol";

/// @title SteamGameGate
/// @notice Example contract demonstrating how to gate access based on Steam game ownership
/// @dev Uses SteamOwnershipVerifier to verify TLSNotary proofs
contract SteamGameGate {
    SteamOwnershipVerifier public immutable verifier;

    /// @notice Mapping of addresses that have claimed rewards
    mapping(address => bool) public hasClaimed;

    /// @notice Mapping of addresses to their verification timestamp
    mapping(address => uint64) public verificationTimestamp;

    /// @notice Total number of verified game owners
    uint256 public verifiedOwnerCount;

    /// @notice Emitted when a user successfully claims a reward
    event RewardClaimed(address indexed user, uint64 proofTimestamp, bool ownsGame);

    error AlreadyClaimed();
    error ProofVerificationFailed();

    constructor(address _verifier) {
        verifier = SteamOwnershipVerifier(_verifier);
    }

    /// @notice Claim a reward by proving Steam game ownership
    /// @param messageHash SHA256 hash of the attestation header
    /// @param v Signature recovery parameter
    /// @param r Signature r value
    /// @param s Signature s value
    /// @param serverName Server name from proof
    /// @param timestamp Proof timestamp
    /// @param ownsGame Whether user owns the game (from Steam API response)
    /// @param transcriptHash Hash of revealed transcript
    /// @return result The verification result with ownership status and timestamp
    function claimReward(
        bytes32 messageHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        string calldata serverName,
        uint64 timestamp,
        bool ownsGame,
        bytes32 transcriptHash
    ) external returns (SteamOwnershipVerifier.VerificationResult memory result) {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        result = verifier.verifyOwnership(
            messageHash,
            v,
            r,
            s,
            serverName,
            timestamp,
            ownsGame,
            transcriptHash
        );

        if (!result.ownsGame) revert ProofVerificationFailed();

        hasClaimed[msg.sender] = true;
        verificationTimestamp[msg.sender] = result.timestamp;
        verifiedOwnerCount++;

        emit RewardClaimed(msg.sender, result.timestamp, result.ownsGame);
        return result;
    }

    /// @notice Verify ownership using packed proof data
    /// @param proof ABI-encoded proof data
    /// @return result The verification result with ownership status and timestamp
    function claimRewardPacked(bytes calldata proof) external returns (SteamOwnershipVerifier.VerificationResult memory result) {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        result = verifier.verifyOwnershipPacked(proof);

        if (!result.ownsGame) revert ProofVerificationFailed();

        hasClaimed[msg.sender] = true;
        verificationTimestamp[msg.sender] = result.timestamp;
        verifiedOwnerCount++;

        emit RewardClaimed(msg.sender, result.timestamp, result.ownsGame);
        return result;
    }

    /// @notice Check if an address has claimed
    function hasAddressClaimed(address user) external view returns (bool) {
        return hasClaimed[user];
    }
}
