// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISteamGameEscrow {
    function submitProofResult(uint256 listingId, bool buyerOwnsGame) external;
}

/// @title SteamGameVerifier
/// @notice Verifies zkTLS proofs of Steam game ownership
/// @dev Calls escrow contract to resolve disputes based on proof results
contract SteamGameVerifier {
    ISteamGameEscrow public immutable escrow;
    address public owner;

    constructor(address _escrow) {
        require(_escrow != address(0), "Invalid escrow");
        escrow = ISteamGameEscrow(_escrow);
        owner = msg.sender;
    }

    /// @notice Verify proof and resolve listing
    /// @param listingId The listing to resolve
    /// @param proof The zkTLS proof data
    function verifyAndResolve(uint256 listingId, bytes calldata proof) external {
        // TODO: Implement zkTLS proof verification
        // 1. Parse the TLSNotary presentation from `proof`
        // 2. Verify the notary signature
        // 3. Extract the revealed `game_count` value (0 or 1)
        // 4. Call escrow.submitProofResult(listingId, gameCount > 0)

        revert("Not implemented");
    }
}
