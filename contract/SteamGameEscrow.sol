// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SteamGameEscrow
/// @notice Escrow contract for trustless Steam game exchanges using USDC
/// @dev Integrates with off-chain zkTLS verifier for game ownership proofs
contract SteamGameEscrow {
    // =============================================================
    //                           STORAGE
    // =============================================================

    IERC20 public immutable usdc;
    address public verifier;

    uint256 public constant DISPUTE_WINDOW = 1 hours;

    uint256 public nextListingId;

    enum ListingStatus {
        Open,
        Purchased,
        Acknowledged,
        Completed,
        Disputed,
        Refunded,
        Cancelled
    }

    struct Listing {
        address seller;
        uint256 price;
        uint256 steamAppId;
        ListingStatus status;
        address buyer;
        string buyerSteamUsername;
        uint256 acknowledgedAt;
    }

    mapping(uint256 => Listing) public listings;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 price,
        uint256 steamAppId
    );
    event ListingCancelled(uint256 indexed listingId);
    event GamePurchased(
        uint256 indexed listingId,
        address indexed buyer,
        string steamUsername
    );
    event SaleAcknowledged(uint256 indexed listingId);
    event FundsReleased(uint256 indexed listingId, address indexed recipient);
    event FundsRefunded(uint256 indexed listingId, address indexed recipient);
    event VerifierUpdated(
        address indexed oldVerifier,
        address indexed newVerifier
    );

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
    //                      SELLER FUNCTIONS
    // =============================================================

    /// @notice Create a new game listing
    /// @param price Price in USDC (6 decimals)
    /// @param steamAppId Steam application ID for the game
    /// @return listingId The ID of the created listing
    function createListing(
        uint256 price,
        uint256 steamAppId
    ) external returns (uint256 listingId) {
        require(price > 0, "Price must be > 0");

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            price: price,
            steamAppId: steamAppId,
            status: ListingStatus.Open,
            buyer: address(0),
            buyerSteamUsername: "",
            acknowledgedAt: 0
        });

        emit ListingCreated(listingId, msg.sender, price, steamAppId);
    }

    /// @notice Cancel an unsold listing
    /// @param listingId The listing to cancel
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Open, "Cannot cancel");
        require(listing.seller == msg.sender, "Not seller");

        listing.status = ListingStatus.Cancelled;

        emit ListingCancelled(listingId);
    }

    /// @notice Acknowledge a purchase and start the dispute window
    /// @param listingId The listing to acknowledge
    function acknowledge(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Purchased, "Not purchased");
        require(listing.seller == msg.sender, "Not seller");

        listing.status = ListingStatus.Acknowledged;
        listing.acknowledgedAt = block.timestamp;

        emit SaleAcknowledged(listingId);
    }

    /// @notice Claim funds after dispute window has passed
    /// @param listingId The listing to claim funds for
    function claimAfterWindow(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Acknowledged, "Not acknowledged");
        require(listing.seller == msg.sender, "Not seller");
        require(
            block.timestamp >= listing.acknowledgedAt + DISPUTE_WINDOW,
            "Window not passed"
        );

        listing.status = ListingStatus.Completed;
        usdc.transfer(listing.seller, listing.price);

        emit FundsReleased(listingId, listing.seller);
    }

    // =============================================================
    //                       BUYER FUNCTIONS
    // =============================================================

    /// @notice Purchase a game listing
    /// @param listingId The listing to purchase
    /// @param steamUsername Buyer's Steam username
    function purchase(
        uint256 listingId,
        string calldata steamUsername
    ) external {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Open, "Not available");
        require(listing.seller != msg.sender, "Cannot buy own listing");

        listing.status = ListingStatus.Purchased;
        listing.buyer = msg.sender;
        listing.buyerSteamUsername = steamUsername;

        usdc.transferFrom(msg.sender, address(this), listing.price);

        emit GamePurchased(listingId, msg.sender, steamUsername);
    }

    // =============================================================
    //                      VERIFIER FUNCTIONS
    // =============================================================

    /// @notice Submit zkTLS proof result for a listing
    /// @param listingId The listing to resolve
    /// @param buyerOwnsGame True if buyer owns the game, false otherwise
    function submitProofResult(uint256 listingId, bool buyerOwnsGame) external {
        require(msg.sender == verifier, "Not verifier");

        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Acknowledged, "Not acknowledged");

        if (buyerOwnsGame) {
            // Buyer received the game - release funds to seller
            listing.status = ListingStatus.Completed;
            usdc.transfer(listing.seller, listing.price);
            emit FundsReleased(listingId, listing.seller);
        } else {
            // Buyer doesn't have game - refund buyer
            listing.status = ListingStatus.Refunded;
            usdc.transfer(listing.buyer, listing.price);
            emit FundsRefunded(listingId, listing.buyer);
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

    /// @notice Get full listing details
    /// @param listingId The listing ID
    /// @return The listing struct
    function getListing(
        uint256 listingId
    ) external view returns (Listing memory) {
        return listings[listingId];
    }
}
