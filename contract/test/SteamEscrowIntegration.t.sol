// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {SteamGameEscrow} from "../SteamGameEscrow.sol";
import {SteamGameVerifier, ISteamGameEscrow} from "../SteamGameVerifier.sol";
import {SteamOwnershipVerifier} from "../SteamOwnershipVerifier.sol";
import {MockUSDC} from "../MockUSDC.sol";

contract SteamEscrowIntegrationTest is Test {
    MockUSDC usdc;
    SteamOwnershipVerifier ownershipVerifier;
    SteamGameEscrow escrow;
    SteamGameVerifier gameVerifier;

    // Mock notary key for signing proofs in tests
    uint256 constant MOCK_NOTARY_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address mockNotaryAddress;

    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");
    address anyone = makeAddr("anyone");

    uint256 constant GAME_PRICE = 50 * 1e6; // 50 USDC
    uint256 constant STEAM_APP_ID = 730; // CS:GO
    string constant STEAM_USERNAME = "buyer_steam_user";
    string constant SERVER_NAME = "api.steampowered.com";

    function setUp() public {
        mockNotaryAddress = vm.addr(MOCK_NOTARY_KEY);

        // Deploy contracts
        usdc = new MockUSDC();
        ownershipVerifier = new SteamOwnershipVerifier(mockNotaryAddress);

        // Deploy escrow with this test contract as initial verifier
        escrow = new SteamGameEscrow(address(usdc), address(this));

        // Deploy game verifier wired to ownership verifier + escrow
        gameVerifier = new SteamGameVerifier(address(ownershipVerifier), address(escrow));

        // Transfer verifier role to game verifier
        escrow.setVerifier(address(gameVerifier));

        // Fund buyer and seller with USDC
        usdc.mint(buyer, 10_000 * 1e6);
        usdc.mint(seller, 10_000 * 1e6);

        // Set seller stake to 10%
        escrow.setSellerStakeBps(1000);
    }

    // ==================== HELPERS ====================

    /// @dev Create a trade: buyer approves + calls createTrade
    function _createTrade() internal returns (uint256 tradeId) {
        vm.startPrank(buyer);
        usdc.approve(address(escrow), GAME_PRICE);
        tradeId = escrow.createTrade(STEAM_APP_ID, seller, STEAM_USERNAME);
        vm.stopPrank();
    }

    /// @dev Seller acknowledges a trade (approves stake amount first)
    function _acknowledge(uint256 tradeId) internal {
        vm.startPrank(seller);
        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        if (stakeAmount > 0) {
            usdc.approve(address(escrow), stakeAmount);
        }
        escrow.acknowledge(tradeId);
        vm.stopPrank();
    }

    /// @dev Create a mock notary-signed proof for a given timestamp and ownership
    function _signProof(
        uint64 timestamp,
        bool ownsGame
    )
        internal
        view
        returns (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        )
    {
        transcriptHash = keccak256(abi.encodePacked("transcript", timestamp, ownsGame));
        messageHash = keccak256(
            abi.encodePacked("attestation", SERVER_NAME, timestamp, ownsGame, transcriptHash)
        );
        (v, r, s) = vm.sign(MOCK_NOTARY_KEY, messageHash);
    }

    /// @dev Submit a proof via gameVerifier.verifyAndResolve
    function _submitProof(uint256 tradeId, uint64 timestamp, bool ownsGame) internal {
        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(timestamp, ownsGame);

        gameVerifier.verifyAndResolve(
            tradeId,
            messageHash,
            v,
            r,
            s,
            SERVER_NAME,
            timestamp,
            ownsGame,
            transcriptHash
        );
    }

    // ==================== HAPPY PATH: PROOF OWNS GAME ====================

    function test_HappyPath_ProofOwnsGame_FundsToSeller() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        uint256 sellerBefore = usdc.balanceOf(seller);
        uint64 proofTs = uint64(block.timestamp + 30 minutes);
        vm.warp(block.timestamp + 30 minutes);

        vm.prank(anyone);
        _submitProof(tradeId, proofTs, true);

        assertEq(usdc.balanceOf(seller), sellerBefore + GAME_PRICE + stakeAmount);
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Completed));
    }

    // ==================== REFUND: PROOF DOESN'T OWN GAME ====================

    function test_Refund_ProofDoesntOwnGame_FundsToBuyer() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        uint256 buyerBefore = usdc.balanceOf(buyer);
        uint256 sellerBefore = usdc.balanceOf(seller);
        uint64 proofTs = uint64(block.timestamp + 10 minutes);
        vm.warp(block.timestamp + 10 minutes);

        vm.prank(anyone);
        _submitProof(tradeId, proofTs, false);

        assertEq(usdc.balanceOf(buyer), buyerBefore + GAME_PRICE);
        assertEq(usdc.balanceOf(seller), sellerBefore + stakeAmount);
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Refunded));
    }

    // ==================== TIMEOUT: NO PROOF, SELLER CLAIMS ====================

    function test_Timeout_NoProof_SellerClaims() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        uint256 sellerBefore = usdc.balanceOf(seller);
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(seller);
        escrow.claimAfterWindow(tradeId);

        assertEq(usdc.balanceOf(seller), sellerBefore + GAME_PRICE + stakeAmount);
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Completed));
    }

    function test_Timeout_CannotClaimBeforeWindow() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        vm.warp(block.timestamp + 59 minutes);

        vm.prank(seller);
        vm.expectRevert("Window not passed");
        escrow.claimAfterWindow(tradeId);
    }

    // ==================== BUYER RECLAIM: SELLER NEVER ACKS ====================

    function test_BuyerReclaim_After24Hours() public {
        uint256 tradeId = _createTrade();

        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.warp(block.timestamp + 24 hours);

        vm.prank(buyer);
        escrow.reclaimIfNotAcknowledged(tradeId);

        assertEq(usdc.balanceOf(buyer), buyerBefore + GAME_PRICE);
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Refunded));
    }

    function test_BuyerReclaim_CannotBeforeDeadline() public {
        uint256 tradeId = _createTrade();

        vm.warp(block.timestamp + 23 hours);

        vm.prank(buyer);
        vm.expectRevert("Deadline not reached");
        escrow.reclaimIfNotAcknowledged(tradeId);
    }

    function test_BuyerReclaim_OnlyBuyer() public {
        uint256 tradeId = _createTrade();

        vm.warp(block.timestamp + 24 hours);

        vm.prank(seller);
        vm.expectRevert("Not buyer");
        escrow.reclaimIfNotAcknowledged(tradeId);
    }

    // ==================== BUYER CANCEL: BEFORE ACK ====================

    function test_BuyerCancel_BeforeAck() public {
        uint256 tradeId = _createTrade();

        uint256 buyerBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        escrow.cancelTrade(tradeId);

        assertEq(usdc.balanceOf(buyer), buyerBefore + GAME_PRICE);
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Cancelled));
    }

    function test_BuyerCancel_CannotAfterAck() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        vm.prank(buyer);
        vm.expectRevert("Not pending");
        escrow.cancelTrade(tradeId);
    }

    function test_BuyerCancel_OnlyBuyerOrSeller() public {
        uint256 tradeId = _createTrade();

        vm.prank(anyone);
        vm.expectRevert("Not buyer or seller");
        escrow.cancelTrade(tradeId);
    }

    // ==================== PROOF TIMESTAMP VALIDATION ====================

    function test_RejectProof_BeforeAcknowledge() public {
        uint256 tradeId = _createTrade();

        // Warp forward, then acknowledge
        vm.warp(block.timestamp + 2 hours);
        _acknowledge(tradeId);

        uint256 ackAt = escrow.getAcknowledgedAt(tradeId);
        uint64 proofTs = uint64(ackAt - 1); // proof timestamp before acknowledge

        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(proofTs, true);

        vm.prank(anyone);
        vm.expectRevert(
            abi.encodeWithSelector(
                SteamGameVerifier.ProofBeforeAcknowledge.selector, proofTs, ackAt
            )
        );
        gameVerifier.verifyAndResolve(
            tradeId, messageHash, v, r, s, SERVER_NAME, proofTs, true, transcriptHash
        );
    }

    function test_RejectProof_AfterWindow() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        uint256 ackAt = escrow.getAcknowledgedAt(tradeId);
        uint64 proofTs = uint64(ackAt + 1 hours + 1); // proof timestamp after window

        // Warp past window so proof timestamp is not in the future
        vm.warp(ackAt + 2 hours);

        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(proofTs, true);

        vm.prank(anyone);
        vm.expectRevert(
            abi.encodeWithSelector(
                SteamGameVerifier.ProofAfterWindow.selector, proofTs, ackAt + 1 hours
            )
        );
        gameVerifier.verifyAndResolve(
            tradeId, messageHash, v, r, s, SERVER_NAME, proofTs, true, transcriptHash
        );
    }

    function test_RejectProof_InFuture() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        // Proof timestamp is in the future (within window, but block.timestamp hasn't caught up)
        uint64 proofTs = uint64(block.timestamp + 30 minutes);

        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(proofTs, true);

        // Don't warp — block.timestamp is still at acknowledgedAt
        vm.prank(anyone);
        vm.expectRevert(
            abi.encodeWithSelector(
                SteamGameVerifier.ProofInFuture.selector, proofTs, block.timestamp
            )
        );
        gameVerifier.verifyAndResolve(
            tradeId, messageHash, v, r, s, SERVER_NAME, proofTs, true, transcriptHash
        );
    }

    // ==================== FRONTRUN PROTECTION ====================

    function test_WrongSeller_CannotAcknowledge() public {
        uint256 tradeId = _createTrade();

        vm.prank(anyone);
        vm.expectRevert("Not seller");
        escrow.acknowledge(tradeId);
    }

    // ==================== EDGE CASES ====================

    function test_CannotAcknowledge_AlreadyAcknowledged() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        vm.prank(seller);
        vm.expectRevert("Not pending");
        escrow.acknowledge(tradeId);
    }

    function test_CannotSubmitProof_BeforeAcknowledge() public {
        uint256 tradeId = _createTrade();

        // Try to submit proof before acknowledge — escrow rejects (status is Pending, not Acknowledged)
        // We need to call escrow.submitProofResult directly via the verifier role
        // Since gameVerifier is the verifier, let's try via gameVerifier
        uint64 proofTs = uint64(block.timestamp);
        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(proofTs, true);

        // getAcknowledgedAt returns 0 for unacknowledged trade, so proof timestamp < 0 is impossible
        // but proofTimestamp >= 0 and acknowledgedAt == 0 means it passes the first check
        // then proofTimestamp > acknowledgedAt + DISPUTE_WINDOW (0 + 1hr) could fail or pass
        // depending on the timestamp. Either way, escrow.submitProofResult will revert "Not acknowledged"
        vm.prank(anyone);
        // This will either revert with ProofAfterWindow (if proofTs > 1hr) or succeed on timestamp
        // but then revert on escrow.submitProofResult("Not acknowledged")
        vm.expectRevert();
        gameVerifier.verifyAndResolve(
            tradeId, messageHash, v, r, s, SERVER_NAME, proofTs, true, transcriptHash
        );
    }

    function test_CreateTrade_RequiresApproval() public {
        vm.prank(buyer);
        vm.expectRevert("No USDC approved");
        escrow.createTrade(STEAM_APP_ID, seller, STEAM_USERNAME);
    }

    function test_CreateTrade_CannotTradeWithSelf() public {
        vm.startPrank(buyer);
        usdc.approve(address(escrow), GAME_PRICE);
        vm.expectRevert("Cannot trade with self");
        escrow.createTrade(STEAM_APP_ID, buyer, STEAM_USERNAME);
        vm.stopPrank();
    }

    function test_CreateTrade_EmptyUsername() public {
        vm.startPrank(buyer);
        usdc.approve(address(escrow), GAME_PRICE);
        vm.expectRevert("Empty username");
        escrow.createTrade(STEAM_APP_ID, seller, "");
        vm.stopPrank();
    }

    function test_GetAcknowledgedAt_ReturnsZero_BeforeAck() public {
        uint256 tradeId = _createTrade();
        assertEq(escrow.getAcknowledgedAt(tradeId), 0);
    }

    function test_GetAcknowledgedAt_ReturnsTimestamp_AfterAck() public {
        uint256 tradeId = _createTrade();
        uint256 ackTime = block.timestamp + 5 minutes;
        vm.warp(ackTime);
        _acknowledge(tradeId);
        assertEq(escrow.getAcknowledgedAt(tradeId), ackTime);
    }

    function test_TradeDetails_StoredCorrectly() public {
        uint256 tradeId = _createTrade();
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);

        assertEq(trade.buyer, buyer);
        assertEq(trade.seller, seller);
        assertEq(trade.steamAppId, STEAM_APP_ID);
        assertEq(trade.price, GAME_PRICE);
        assertEq(keccak256(bytes(trade.buyerSteamUsername)), keccak256(bytes(STEAM_USERNAME)));
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Pending));
        assertEq(trade.createdAt, block.timestamp);
        assertEq(trade.acknowledgedAt, 0);
    }

    function test_ProofAtExactAckTimestamp_Succeeds() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        uint256 ackAt = escrow.getAcknowledgedAt(tradeId);
        uint64 proofTs = uint64(ackAt); // exact boundary

        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(proofTs, true);

        vm.prank(anyone);
        gameVerifier.verifyAndResolve(
            tradeId, messageHash, v, r, s, SERVER_NAME, proofTs, true, transcriptHash
        );

        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Completed));
    }

    function test_ProofAtExactWindowEnd_Succeeds() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        uint256 ackAt = escrow.getAcknowledgedAt(tradeId);
        uint64 proofTs = uint64(ackAt + 1 hours); // exact boundary

        vm.warp(ackAt + 1 hours);

        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(proofTs, true);

        vm.prank(anyone);
        gameVerifier.verifyAndResolve(
            tradeId, messageHash, v, r, s, SERVER_NAME, proofTs, true, transcriptHash
        );

        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint8(trade.status), uint8(SteamGameEscrow.TradeStatus.Completed));
    }

    // ==================== SELLER STAKE TESTS ====================

    function test_StakeCollectedOnAcknowledge() public {
        uint256 tradeId = _createTrade();
        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        uint256 sellerBefore = usdc.balanceOf(seller);

        _acknowledge(tradeId);

        assertEq(usdc.balanceOf(seller), sellerBefore - stakeAmount);
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(trade.sellerStake, stakeAmount);
    }

    function test_StakeReturnedOnCompletion() public {
        uint256 tradeId = _createTrade();
        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        _acknowledge(tradeId);

        uint256 sellerBefore = usdc.balanceOf(seller);
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(seller);
        escrow.claimAfterWindow(tradeId);

        assertEq(usdc.balanceOf(seller), sellerBefore + GAME_PRICE + stakeAmount);
    }

    function test_StakeReturnedOnRefund() public {
        uint256 tradeId = _createTrade();
        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        _acknowledge(tradeId);

        uint256 sellerBefore = usdc.balanceOf(seller);
        uint64 proofTs = uint64(block.timestamp + 10 minutes);
        vm.warp(block.timestamp + 10 minutes);
        vm.prank(anyone);
        _submitProof(tradeId, proofTs, false);

        assertEq(usdc.balanceOf(seller), sellerBefore + stakeAmount);
    }

    function test_OnlyOwnerCanSetStakeBps() public {
        vm.prank(anyone);
        vm.expectRevert();
        escrow.setSellerStakeBps(500);
    }

    function test_StakeBpsCappedAt10000() public {
        vm.expectRevert("Exceeds 100%");
        escrow.setSellerStakeBps(10001);
    }

    function test_ZeroBpsNoStake() public {
        escrow.setSellerStakeBps(0);
        uint256 tradeId = _createTrade();
        uint256 sellerBefore = usdc.balanceOf(seller);

        vm.prank(seller);
        escrow.acknowledge(tradeId);

        assertEq(usdc.balanceOf(seller), sellerBefore);
        SteamGameEscrow.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(trade.sellerStake, 0);
    }

    function test_SellerNoApprovalReverts() public {
        uint256 tradeId = _createTrade();
        // Seller does not approve USDC — should revert on transferFrom
        vm.prank(seller);
        vm.expectRevert();
        escrow.acknowledge(tradeId);
    }

    function test_PackedProof_HappyPath() public {
        uint256 tradeId = _createTrade();
        _acknowledge(tradeId);

        uint64 proofTs = uint64(block.timestamp + 15 minutes);
        vm.warp(block.timestamp + 15 minutes);

        (
            bytes32 messageHash,
            uint8 v,
            bytes32 r,
            bytes32 s,
            bytes32 transcriptHash
        ) = _signProof(proofTs, true);

        bytes memory proof = abi.encode(
            messageHash, v, r, s, SERVER_NAME, proofTs, true, transcriptHash
        );

        uint256 stakeAmount = GAME_PRICE * escrow.sellerStakeBps() / 10000;
        uint256 sellerBefore = usdc.balanceOf(seller);
        vm.prank(anyone);
        gameVerifier.verifyAndResolvePacked(tradeId, proof);

        assertEq(usdc.balanceOf(seller), sellerBefore + GAME_PRICE + stakeAmount);
    }
}
