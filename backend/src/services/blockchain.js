import { ethers } from 'ethers';
import { config } from '../config/index.js';

// ABIs (minimal for what we need)
const ESCROW_ABI = [
  'function createListing(uint256 price, uint256 steamAppId) external returns (uint256)',
  'function cancelListing(uint256 listingId) external',
  'function purchase(uint256 listingId, string calldata steamUsername) external',
  'function acknowledge(uint256 listingId) external',
  'function claimAfterWindow(uint256 listingId) external',
  'function submitProofResult(uint256 listingId, bool buyerOwnsGame) external',
  'function getListing(uint256 listingId) external view returns (tuple(address seller, uint256 price, uint256 steamAppId, uint8 status, address buyer, string buyerSteamUsername, uint256 acknowledgedAt))',
  'function nextListingId() external view returns (uint256)',
  'event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 price, uint256 steamAppId)',
  'event ListingCancelled(uint256 indexed listingId)',
  'event GamePurchased(uint256 indexed listingId, address indexed buyer, string steamUsername)',
  'event SaleAcknowledged(uint256 indexed listingId)',
  'event FundsReleased(uint256 indexed listingId, address indexed recipient)',
  'event FundsRefunded(uint256 indexed listingId, address indexed recipient)'
];

const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.verifierWallet = new ethers.Wallet(config.verifierPrivateKey, this.provider);

    if (config.contracts.escrow) {
      this.escrow = new ethers.Contract(config.contracts.escrow, ESCROW_ABI, this.verifierWallet);
      this.usdc = new ethers.Contract(config.contracts.usdc, USDC_ABI, this.provider);
    }
  }

  isConfigured() {
    return !!config.contracts.escrow;
  }

  getContractAddresses() {
    return config.contracts;
  }

  async getListing(listingId) {
    const listing = await this.escrow.getListing(listingId);
    return this.formatListing(listingId, listing);
  }

  async getAllListings() {
    const nextId = await this.escrow.nextListingId();
    const listings = [];

    for (let i = 0; i < nextId; i++) {
      try {
        const listing = await this.escrow.getListing(i);
        listings.push(this.formatListing(i, listing));
      } catch (e) {
        // Skip invalid listings
      }
    }

    return listings;
  }

  async getOpenListings() {
    const all = await this.getAllListings();
    return all.filter(l => l.status === 'Open');
  }

  async getListingsByAddress(address) {
    const all = await this.getAllListings();
    return {
      selling: all.filter(l => l.seller.toLowerCase() === address.toLowerCase()),
      buying: all.filter(l => l.buyer.toLowerCase() === address.toLowerCase())
    };
  }

  async getUsdcBalance(address) {
    const balance = await this.usdc.balanceOf(address);
    return ethers.formatUnits(balance, 6);
  }

  // Verifier function - submit proof result
  async submitProofResult(listingId, buyerOwnsGame) {
    const tx = await this.escrow.submitProofResult(listingId, buyerOwnsGame);
    await tx.wait();
    return tx.hash;
  }

  formatListing(id, listing) {
    const statusMap = ['Open', 'Purchased', 'Acknowledged', 'Completed', 'Disputed', 'Refunded', 'Cancelled'];
    return {
      id: Number(id),
      seller: listing.seller,
      price: ethers.formatUnits(listing.price, 6),
      steamAppId: Number(listing.steamAppId),
      status: statusMap[listing.status],
      buyer: listing.buyer === ethers.ZeroAddress ? null : listing.buyer,
      buyerSteamUsername: listing.buyerSteamUsername || null,
      acknowledgedAt: listing.acknowledgedAt > 0 ? Number(listing.acknowledgedAt) : null,
      disputeDeadline: listing.acknowledgedAt > 0 ? Number(listing.acknowledgedAt) + 3600 : null
    };
  }
}

export const blockchain = new BlockchainService();
