// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {SteamOwnershipVerifier} from "../contracts/SteamOwnershipVerifier.sol";
import {SteamGameGate} from "../contracts/SteamGameGate.sol";

contract SteamOwnershipVerifierTest is Test {
    SteamOwnershipVerifier public verifier;
    SteamGameGate public gate;

    // ============ Real Notary Address (same for all proofs) ============
    address constant REAL_NOTARY_ADDRESS = 0x8d2742456c331C5b61997229AAB28F57f7A87227;

    // ============ PROOF 1: CS:GO Owned (Original) ============
    // Timestamp: 2026-02-05 15:54:41 UTC
    bytes32 constant PROOF1_MESSAGE_HASH = 0x33c3131745679ff930c2a197b57e99a6a35f579fe37b52bf0d47412aaef86706;
    bytes32 constant PROOF1_SIGNATURE_R = 0x1da3c878d0330ef60a51a84a2fa2a38ce825009600202edfde87b25518d02994;
    bytes32 constant PROOF1_SIGNATURE_S = 0x54a2669a7e150405f078966ac40e1dcacb1364c4df63e790d68745eb5751b076;
    uint8 constant PROOF1_SIGNATURE_V = 28;
    uint64 constant PROOF1_TIMESTAMP = 1770306881;
    bool constant PROOF1_OWNS_GAME = true;
    bytes32 constant PROOF1_TRANSCRIPT_HASH = 0x4b8668a8eff90b05108c404102a156ff1078b121b6a952245a45296af138703c;

    // ============ PROOF 2: CS:GO Owned (Newer Timestamp) ============
    // Timestamp: 2026-02-05 16:50:25 UTC (generated ~1 hour later)
    bytes32 constant PROOF2_MESSAGE_HASH = 0x29f9eb53187a7a9b81deb84995c2862fbb280395c6d826ead2c07d4f1ba929b6;
    bytes32 constant PROOF2_SIGNATURE_R = 0xc90e181850a9c8d42aa73b48f2bc0acf57e37f4b7d9cbbf3bb930ea2d33a875f;
    bytes32 constant PROOF2_SIGNATURE_S = 0x0c96474495de68430ae5c92a3f00db0822f0ed0c7b41ce50261f0d7798a660bd;
    uint8 constant PROOF2_SIGNATURE_V = 28;
    uint64 constant PROOF2_TIMESTAMP = 1770310225;
    bool constant PROOF2_OWNS_GAME = true;
    bytes32 constant PROOF2_TRANSCRIPT_HASH = 0xd875783b60a42de4638734c4b082d9a5dea8a67a5ec5ac0170c80759c7ca83f9;

    // ============ PROOF 3: Game Not Owned ============
    // Timestamp: 2026-02-05 16:49:17 UTC
    bytes32 constant PROOF3_MESSAGE_HASH = 0xdef647a0f48b3c5296e8353995e582f63d21894d840268c92eebc230f283d43f;
    bytes32 constant PROOF3_SIGNATURE_R = 0x61a02615378b0430b46d71f26ae0ee45413a9bce088a77136381879986ca23fc;
    bytes32 constant PROOF3_SIGNATURE_S = 0x2cc20b359a3c4eca122677fc99614f6edf808089820391e3b55d3b571346305c;
    uint8 constant PROOF3_SIGNATURE_V = 28;
    uint64 constant PROOF3_TIMESTAMP = 1770310157;
    bool constant PROOF3_OWNS_GAME = false;
    bytes32 constant PROOF3_TRANSCRIPT_HASH = 0x63088564a79cd5cde719bdd448680d9c973dca0024293addec71cd84b0b22cbc;

    // ============ Common Values ============
    string constant SERVER_NAME = "api.steampowered.com";

    // ============ Mock Notary for Additional Testing ============
    uint256 constant MOCK_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address mockNotaryAddress;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    function setUp() public {
        mockNotaryAddress = vm.addr(MOCK_PRIVATE_KEY);
        verifier = new SteamOwnershipVerifier(REAL_NOTARY_ADDRESS);
        gate = new SteamGameGate(address(verifier));
    }

    // ==================== CONSTRUCTOR TESTS ====================

    function test_Constructor() public view {
        assertEq(verifier.notaryAddress(), REAL_NOTARY_ADDRESS);
        assertEq(verifier.owner(), address(this));
    }

    function test_Constructor_RevertZeroAddress() public {
        vm.expectRevert(SteamOwnershipVerifier.ZeroAddress.selector);
        new SteamOwnershipVerifier(address(0));
    }

    // ==================== NOTARY MANAGEMENT TESTS ====================

    function test_SetNotary() public {
        address newNotary = makeAddr("newNotary");
        verifier.setNotary(newNotary);
        assertEq(verifier.notaryAddress(), newNotary);
    }

    function test_SetNotary_RevertZeroAddress() public {
        vm.expectRevert(SteamOwnershipVerifier.ZeroAddress.selector);
        verifier.setNotary(address(0));
    }

    function test_SetNotary_RevertNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        verifier.setNotary(makeAddr("newNotary"));
    }

    // ==================== REAL PROOF VERIFICATION TESTS ====================

    function test_RealProof1_OwnsGame() public {
        SteamOwnershipVerifier.VerificationResult memory result = verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
        assertTrue(result.ownsGame, "Proof1: Should return true for game_count=1");
        assertEq(result.timestamp, PROOF1_TIMESTAMP, "Proof1: Timestamp should match");
        assertEq(result.transcriptHash, PROOF1_TRANSCRIPT_HASH, "Proof1: Transcript hash should match");
    }

    function test_RealProof2_OwnsGame_DifferentTimestamp() public {
        SteamOwnershipVerifier.VerificationResult memory result = verifier.verifyOwnership(
            PROOF2_MESSAGE_HASH,
            PROOF2_SIGNATURE_V,
            PROOF2_SIGNATURE_R,
            PROOF2_SIGNATURE_S,
            SERVER_NAME,
            PROOF2_TIMESTAMP,
            PROOF2_OWNS_GAME,
            PROOF2_TRANSCRIPT_HASH
        );
        assertTrue(result.ownsGame, "Proof2: Should return true for game_count=1");
        assertEq(result.timestamp, PROOF2_TIMESTAMP, "Proof2: Timestamp should match");
        assertGt(result.timestamp, PROOF1_TIMESTAMP, "Proof2: Should be newer than Proof1");
    }

    function test_RealProof3_DoesNotOwnGame() public {
        SteamOwnershipVerifier.VerificationResult memory result = verifier.verifyOwnership(
            PROOF3_MESSAGE_HASH,
            PROOF3_SIGNATURE_V,
            PROOF3_SIGNATURE_R,
            PROOF3_SIGNATURE_S,
            SERVER_NAME,
            PROOF3_TIMESTAMP,
            PROOF3_OWNS_GAME,
            PROOF3_TRANSCRIPT_HASH
        );
        assertFalse(result.ownsGame, "Proof3: Should return false for game_count=0");
        assertEq(result.timestamp, PROOF3_TIMESTAMP, "Proof3: Timestamp should match");
    }

    // ==================== TIMESTAMP TESTS ====================

    function test_Timestamps_OldestProof() public view {
        // Proof1 has the oldest timestamp
        assertLt(PROOF1_TIMESTAMP, PROOF2_TIMESTAMP);
        assertLt(PROOF1_TIMESTAMP, PROOF3_TIMESTAMP);
    }

    function test_Timestamps_BothOwnershipProofsWork() public {
        // Both ownership proofs should work regardless of timestamp
        SteamOwnershipVerifier.VerificationResult memory result1 = verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        SteamOwnershipVerifier.VerificationResult memory result2 = verifier.verifyOwnership(
            PROOF2_MESSAGE_HASH,
            PROOF2_SIGNATURE_V,
            PROOF2_SIGNATURE_R,
            PROOF2_SIGNATURE_S,
            SERVER_NAME,
            PROOF2_TIMESTAMP,
            PROOF2_OWNS_GAME,
            PROOF2_TRANSCRIPT_HASH
        );

        assertTrue(result1.ownsGame);
        assertTrue(result2.ownsGame);
        // Proof2 is newer but both are valid
        assertGt(result2.timestamp, result1.timestamp);
    }

    function test_Timestamps_ProofValidityNotTimeDependent() public {
        // Warp to far future - proofs should still verify
        vm.warp(block.timestamp + 365 days);

        SteamOwnershipVerifier.VerificationResult memory result = verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
        assertTrue(result.ownsGame, "Old proof should still verify");
        // Timestamp in result is from the proof, not block.timestamp
        assertEq(result.timestamp, PROOF1_TIMESTAMP);
    }

    // ==================== PACKED PROOF TESTS ====================

    function test_VerifyOwnershipPacked_Proof1() public {
        bytes memory proof = abi.encode(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        SteamOwnershipVerifier.VerificationResult memory result = verifier.verifyOwnershipPacked(proof);
        assertTrue(result.ownsGame);
        assertEq(result.timestamp, PROOF1_TIMESTAMP);
    }

    function test_VerifyOwnershipPacked_Proof3_NoOwnership() public {
        bytes memory proof = abi.encode(
            PROOF3_MESSAGE_HASH,
            PROOF3_SIGNATURE_V,
            PROOF3_SIGNATURE_R,
            PROOF3_SIGNATURE_S,
            SERVER_NAME,
            PROOF3_TIMESTAMP,
            PROOF3_OWNS_GAME,
            PROOF3_TRANSCRIPT_HASH
        );

        SteamOwnershipVerifier.VerificationResult memory result = verifier.verifyOwnershipPacked(proof);
        assertFalse(result.ownsGame);
        assertEq(result.timestamp, PROOF3_TIMESTAMP);
    }

    // ==================== INVALID SIGNATURE TESTS ====================

    function test_InvalidSignature_WrongMessageHash() public {
        bytes32 wrongHash = keccak256("tampered");

        vm.expectRevert(SteamOwnershipVerifier.InvalidNotarySignature.selector);
        verifier.verifyOwnership(
            wrongHash,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidSignature_TamperedR() public {
        bytes32 tamperedR = bytes32(uint256(PROOF1_SIGNATURE_R) + 1);

        vm.expectRevert(SteamOwnershipVerifier.InvalidNotarySignature.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            tamperedR,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidSignature_TamperedS() public {
        bytes32 tamperedS = bytes32(uint256(PROOF1_SIGNATURE_S) + 1);

        vm.expectRevert(SteamOwnershipVerifier.InvalidNotarySignature.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            tamperedS,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidSignature_WrongV() public {
        uint8 wrongV = PROOF1_SIGNATURE_V == 27 ? 28 : 27;

        vm.expectRevert(SteamOwnershipVerifier.InvalidNotarySignature.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            wrongV,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidSignature_WrongNotary() public {
        address wrongNotary = makeAddr("wrongNotary");
        verifier.setNotary(wrongNotary);

        vm.expectRevert(SteamOwnershipVerifier.InvalidNotarySignature.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidSignature_CrossProofMixup() public {
        // Try to use Proof1's signature with Proof2's message hash
        vm.expectRevert(SteamOwnershipVerifier.InvalidNotarySignature.selector);
        verifier.verifyOwnership(
            PROOF2_MESSAGE_HASH, // Wrong hash for this signature
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    // ==================== INVALID SERVER NAME TESTS ====================

    function test_InvalidServerName_WrongServer() public {
        vm.expectRevert(SteamOwnershipVerifier.InvalidServerName.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            "wrong.server.com",
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidServerName_Empty() public {
        vm.expectRevert(SteamOwnershipVerifier.InvalidServerName.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            "",
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidServerName_SubdomainAttack() public {
        vm.expectRevert(SteamOwnershipVerifier.InvalidServerName.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            "api.steampowered.com.evil.com",
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    function test_InvalidServerName_Typosquatting() public {
        vm.expectRevert(SteamOwnershipVerifier.InvalidServerName.selector);
        verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            "api.steampower3d.com", // Typo
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
    }

    // ==================== REPLAY AND REUSE TESTS ====================

    function test_SameProofMultipleTimes() public {
        // Same proof can be verified multiple times (no replay protection)
        for (uint i = 0; i < 3; i++) {
            SteamOwnershipVerifier.VerificationResult memory result = verifier.verifyOwnership(
                PROOF1_MESSAGE_HASH,
                PROOF1_SIGNATURE_V,
                PROOF1_SIGNATURE_R,
                PROOF1_SIGNATURE_S,
                SERVER_NAME,
                PROOF1_TIMESTAMP,
                PROOF1_OWNS_GAME,
                PROOF1_TRANSCRIPT_HASH
            );
            assertTrue(result.ownsGame);
            assertEq(result.timestamp, PROOF1_TIMESTAMP);
        }
    }

    function test_DifferentCallersCanVerifySameProof() public {
        vm.prank(alice);
        SteamOwnershipVerifier.VerificationResult memory aliceResult = verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        vm.prank(bob);
        SteamOwnershipVerifier.VerificationResult memory bobResult = verifier.verifyOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        assertTrue(aliceResult.ownsGame);
        assertTrue(bobResult.ownsGame);
        // Both get same timestamp from proof
        assertEq(aliceResult.timestamp, bobResult.timestamp);
    }

    // ==================== REQUIRE OWNERSHIP TESTS ====================

    function test_RequireOwnership_ValidProof() public {
        verifier.requireOwnership(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );
        // Should not revert
    }

    function test_RequireOwnership_RealNoOwnershipProof() public {
        // Use the real Proof3 which has game_count=0
        vm.expectRevert("Must own game");
        verifier.requireOwnership(
            PROOF3_MESSAGE_HASH,
            PROOF3_SIGNATURE_V,
            PROOF3_SIGNATURE_R,
            PROOF3_SIGNATURE_S,
            SERVER_NAME,
            PROOF3_TIMESTAMP,
            PROOF3_OWNS_GAME,
            PROOF3_TRANSCRIPT_HASH
        );
    }

    // ==================== GATE CONTRACT TESTS ====================

    function test_Gate_ClaimWithOwnership() public {
        vm.prank(alice);
        SteamOwnershipVerifier.VerificationResult memory result = gate.claimReward(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        assertTrue(gate.hasClaimed(alice));
        assertEq(gate.verifiedOwnerCount(), 1);
        // Check returned values
        assertTrue(result.ownsGame);
        assertEq(result.timestamp, PROOF1_TIMESTAMP);
        // Check stored timestamp
        assertEq(gate.verificationTimestamp(alice), PROOF1_TIMESTAMP);
    }

    function test_Gate_CannotClaimTwice() public {
        vm.startPrank(alice);

        gate.claimReward(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        vm.expectRevert(SteamGameGate.AlreadyClaimed.selector);
        gate.claimReward(
            PROOF2_MESSAGE_HASH, // Try with different proof
            PROOF2_SIGNATURE_V,
            PROOF2_SIGNATURE_R,
            PROOF2_SIGNATURE_S,
            SERVER_NAME,
            PROOF2_TIMESTAMP,
            PROOF2_OWNS_GAME,
            PROOF2_TRANSCRIPT_HASH
        );

        vm.stopPrank();
    }

    function test_Gate_CannotClaimWithNoOwnership() public {
        vm.prank(alice);
        vm.expectRevert(SteamGameGate.ProofVerificationFailed.selector);
        gate.claimReward(
            PROOF3_MESSAGE_HASH,
            PROOF3_SIGNATURE_V,
            PROOF3_SIGNATURE_R,
            PROOF3_SIGNATURE_S,
            SERVER_NAME,
            PROOF3_TIMESTAMP,
            PROOF3_OWNS_GAME,
            PROOF3_TRANSCRIPT_HASH
        );
    }

    function test_Gate_MultipleUsersDifferentProofs() public {
        // Alice claims with Proof1
        vm.prank(alice);
        SteamOwnershipVerifier.VerificationResult memory aliceResult = gate.claimReward(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        // Bob claims with Proof2 (different proof, same game ownership)
        vm.prank(bob);
        SteamOwnershipVerifier.VerificationResult memory bobResult = gate.claimReward(
            PROOF2_MESSAGE_HASH,
            PROOF2_SIGNATURE_V,
            PROOF2_SIGNATURE_R,
            PROOF2_SIGNATURE_S,
            SERVER_NAME,
            PROOF2_TIMESTAMP,
            PROOF2_OWNS_GAME,
            PROOF2_TRANSCRIPT_HASH
        );

        assertTrue(gate.hasClaimed(alice));
        assertTrue(gate.hasClaimed(bob));
        assertEq(gate.verifiedOwnerCount(), 2);
        // Check different timestamps for different proofs
        assertEq(gate.verificationTimestamp(alice), PROOF1_TIMESTAMP);
        assertEq(gate.verificationTimestamp(bob), PROOF2_TIMESTAMP);
        assertGt(bobResult.timestamp, aliceResult.timestamp, "Bob's proof is newer");
    }

    function test_Gate_ClaimRewardPacked() public {
        bytes memory proof = abi.encode(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        vm.prank(charlie);
        SteamOwnershipVerifier.VerificationResult memory result = gate.claimRewardPacked(proof);

        assertTrue(gate.hasClaimed(charlie));
        assertEq(result.timestamp, PROOF1_TIMESTAMP);
        assertEq(gate.verificationTimestamp(charlie), PROOF1_TIMESTAMP);
    }

    // ==================== MOCK NOTARY EDGE CASE TESTS ====================

    function test_MockNotary_OwnershipValues() public {
        SteamOwnershipVerifier mockVerifier = new SteamOwnershipVerifier(mockNotaryAddress);

        // Test ownsGame = false (no ownership)
        bytes32 hashFalse = keccak256("owns_game_false");
        (uint8 vFalse, bytes32 rFalse, bytes32 sFalse) = vm.sign(MOCK_PRIVATE_KEY, hashFalse);
        SteamOwnershipVerifier.VerificationResult memory resultFalse = mockVerifier.verifyOwnership(hashFalse, vFalse, rFalse, sFalse, SERVER_NAME, 12345, false, bytes32(0));
        assertFalse(resultFalse.ownsGame, "ownsGame=false should return false");
        assertEq(resultFalse.timestamp, 12345, "timestamp should be returned");

        // Test ownsGame = true (owns)
        bytes32 hashTrue = keccak256("owns_game_true");
        (uint8 vTrue, bytes32 rTrue, bytes32 sTrue) = vm.sign(MOCK_PRIVATE_KEY, hashTrue);
        SteamOwnershipVerifier.VerificationResult memory resultTrue = mockVerifier.verifyOwnership(hashTrue, vTrue, rTrue, sTrue, SERVER_NAME, 12345, true, bytes32(0));
        assertTrue(resultTrue.ownsGame, "ownsGame=true should return true");
    }

    // ==================== VIEW FUNCTION TESTS ====================

    function test_ExpectedServer() public view {
        assertEq(verifier.EXPECTED_SERVER(), "api.steampowered.com");
    }

    function test_NotaryAddressGetter() public view {
        assertEq(verifier.notaryAddress(), REAL_NOTARY_ADDRESS);
    }

    function test_Gate_HasAddressClaimed() public {
        assertFalse(gate.hasAddressClaimed(alice));

        vm.prank(alice);
        gate.claimReward(
            PROOF1_MESSAGE_HASH,
            PROOF1_SIGNATURE_V,
            PROOF1_SIGNATURE_R,
            PROOF1_SIGNATURE_S,
            SERVER_NAME,
            PROOF1_TIMESTAMP,
            PROOF1_OWNS_GAME,
            PROOF1_TRANSCRIPT_HASH
        );

        assertTrue(gate.hasAddressClaimed(alice));
        assertFalse(gate.hasAddressClaimed(bob));
    }
}
