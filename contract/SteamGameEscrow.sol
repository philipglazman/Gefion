// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SteamGameEscrow
/// @notice Buyer-initiated escrow for trustless Steam game exchanges using USDC
/// @dev Integrates with off-chain zkTLS verifier for game ownership proofs
contract SteamGameEscrow {
    // =============================================================
    //                           STORAGE
    // =============================================================

    IERC20 public immutable usdc;
    address public verifier;

    uint256 public constant DISPUTE_WINDOW = 1 hours;
    uint256 public constant ACKNOWLEDGE_DEADLINE = 24 hours;

    uint256 public nextTradeId;

    enum TradeStatus {
        Pending,
        Acknowledged,
        Completed,
        Refunded,
        Cancelled
    }

    struct Trade {
        address buyer;
        address seller;
        uint256 steamAppId;
        uint256 price;
        string buyerSteamUsername;
        TradeStatus status;
        uint256 createdAt;
        uint256 acknowledgedAt;
    }

    mapping(uint256 => Trade) public trades;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event TradeCreated(
        uint256 indexed tradeId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 steamAppId,
        string steamUsername
    );
    event TradeCancelled(uint256 indexed tradeId);
    event TradeAcknowledged(uint256 indexed tradeId);
    event FundsReleased(uint256 indexed tradeId, address indexed recipient);
    event FundsRefunded(uint256 indexed tradeId, address indexed recipient);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address _usdc, address _verifier) {
        require(_usdc != address(0), "Invalid USDC");
        require(_verifier != address(0), "Invalid verifier");
        usdc = IERC20(_usdc);
        verifier = _verifier;
    }

    // =============================================================
    //                      BUYER FUNCTIONS
    // =============================================================

    /// @notice Create a new trade — buyer initiates, USDC locked in escrow
    /// @param steamAppId Steam application ID for the game
    /// @param seller Address of the seller
    /// @param steamUsername Buyer's Steam username
    /// @return tradeId The ID of the created trade
    function createTrade(
        uint256 steamAppId,
        address seller,
        string calldata steamUsername
    ) external returns (uint256 tradeId) {
        require(seller != address(0), "Invalid seller");
        require(seller != msg.sender, "Cannot trade with self");
        require(bytes(steamUsername).length > 0, "Empty username");

        tradeId = nextTradeId++;
        trades[tradeId] = Trade({
            buyer: msg.sender,
            seller: seller,
            steamAppId: steamAppId,
            price: 0, // set below after transfer
            status: TradeStatus.Pending,
            buyerSteamUsername: steamUsername,
            createdAt: block.timestamp,
            acknowledgedAt: 0
        });

        // Price is determined by allowance — transfer whatever buyer approved
        // Caller must have approved this contract for the USDC amount
        // We read the allowance to determine price
        uint256 amount = usdc.allowance(msg.sender, address(this));
        require(amount > 0, "No USDC approved");

        trades[tradeId].price = amount;
        usdc.transferFrom(msg.sender, address(this), amount);

        emit TradeCreated(tradeId, msg.sender, seller, amount, steamAppId, steamUsername);
    }

    /// @notice Cancel a trade before the seller acknowledges
    /// @param tradeId The trade to cancel
    function cancelTrade(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Pending, "Not pending");
        require(trade.buyer == msg.sender, "Not buyer");

        trade.status = TradeStatus.Cancelled;
        usdc.transfer(trade.buyer, trade.price);

        emit TradeCancelled(tradeId);
    }

    /// @notice Reclaim funds if seller never acknowledged within 24 hours
    /// @param tradeId The trade to reclaim
    function reclaimIfNotAcknowledged(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Pending, "Not pending");
        require(trade.buyer == msg.sender, "Not buyer");
        require(
            block.timestamp >= trade.createdAt + ACKNOWLEDGE_DEADLINE,
            "Deadline not reached"
        );

        trade.status = TradeStatus.Refunded;
        usdc.transfer(trade.buyer, trade.price);

        emit FundsRefunded(tradeId, trade.buyer);
    }

    // =============================================================
    //                      SELLER FUNCTIONS
    // =============================================================

    /// @notice Acknowledge a trade — seller claims game was transferred, starts dispute window
    /// @param tradeId The trade to acknowledge
    function acknowledge(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Pending, "Not pending");
        require(trade.seller == msg.sender, "Not seller");

        trade.status = TradeStatus.Acknowledged;
        trade.acknowledgedAt = block.timestamp;

        emit TradeAcknowledged(tradeId);
    }

    /// @notice Claim funds after dispute window has passed with no proof submitted
    /// @param tradeId The trade to claim funds for
    function claimAfterWindow(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Acknowledged, "Not acknowledged");
        require(trade.seller == msg.sender, "Not seller");
        require(
            block.timestamp >= trade.acknowledgedAt + DISPUTE_WINDOW,
            "Window not passed"
        );

        trade.status = TradeStatus.Completed;
        usdc.transfer(trade.seller, trade.price);

        emit FundsReleased(tradeId, trade.seller);
    }

    // =============================================================
    //                      VERIFIER FUNCTIONS
    // =============================================================

    /// @notice Submit zkTLS proof result for a trade
    /// @param tradeId The trade to resolve
    /// @param buyerOwnsGame True if buyer owns the game, false otherwise
    function submitProofResult(uint256 tradeId, bool buyerOwnsGame) external {
        require(msg.sender == verifier, "Not verifier");

        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Acknowledged, "Not acknowledged");

        if (buyerOwnsGame) {
            // Buyer received the game — release funds to seller
            trade.status = TradeStatus.Completed;
            usdc.transfer(trade.seller, trade.price);
            emit FundsReleased(tradeId, trade.seller);
        } else {
            // Buyer doesn't have game — refund buyer
            trade.status = TradeStatus.Refunded;
            usdc.transfer(trade.buyer, trade.price);
            emit FundsRefunded(tradeId, trade.buyer);
        }
    }

    /// @notice Transfer verifier role to a new address
    /// @param newVerifier The new verifier address
    function setVerifier(address newVerifier) external {
        require(msg.sender == verifier, "Not verifier");
        require(newVerifier != address(0), "Invalid address");

        emit VerifierUpdated(verifier, newVerifier);
        verifier = newVerifier;
    }

    // =============================================================
    //                       VIEW FUNCTIONS
    // =============================================================

    /// @notice Get full trade details
    /// @param tradeId The trade ID
    /// @return The trade struct
    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }

    /// @notice Get the acknowledged timestamp for a trade (used by verifier for timestamp binding)
    /// @param tradeId The trade ID
    /// @return The timestamp when the seller acknowledged the trade
    function getAcknowledgedAt(uint256 tradeId) external view returns (uint256) {
        return trades[tradeId].acknowledgedAt;
    }
}
