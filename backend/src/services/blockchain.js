import { ethers } from 'ethers';
import { config } from '../config/index.js';

// ABIs for the new buyer-initiated escrow contract
const ESCROW_ABI = [
  'function createTrade(uint256 steamAppId, address seller, string calldata steamUsername) external returns (uint256)',
  'function cancelTrade(uint256 tradeId) external',
  'function reclaimIfNotAcknowledged(uint256 tradeId) external',
  'function acknowledge(uint256 tradeId) external',
  'function claimAfterWindow(uint256 tradeId) external',
  'function submitProofResult(uint256 tradeId, bool buyerOwnsGame) external',
  'function getTrade(uint256 tradeId) external view returns (tuple(address buyer, address seller, uint256 steamAppId, uint256 price, string buyerSteamUsername, uint8 status, uint256 createdAt, uint256 acknowledgedAt))',
  'function nextTradeId() external view returns (uint256)',
  'function getAcknowledgedAt(uint256 tradeId) external view returns (uint256)',
  'event TradeCreated(uint256 indexed tradeId, address indexed buyer, address indexed seller, uint256 price, uint256 steamAppId, string steamUsername)',
  'event TradeCancelled(uint256 indexed tradeId)',
  'event TradeAcknowledged(uint256 indexed tradeId)',
  'event FundsReleased(uint256 indexed tradeId, address indexed recipient)',
  'event FundsRefunded(uint256 indexed tradeId, address indexed recipient)'
];

const EVENT_NAMES = [
  'TradeCreated',
  'TradeCancelled',
  'TradeAcknowledged',
  'FundsReleased',
  'FundsRefunded'
];

const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

// SteamGameVerifier ABI - the contract that validates zkTLS proofs and calls escrow
const VERIFIER_ABI = [
  'function verifyAndResolve(uint256 tradeId, bytes32 messageHash, uint8 v, bytes32 r, bytes32 s, string calldata serverName, uint64 timestamp, bool ownsGame, bytes32 transcriptHash) external',
  'function verifyAndResolvePacked(uint256 tradeId, bytes calldata proof) external',
  'event TradeResolved(uint256 indexed tradeId, bool buyerOwnsGame, uint64 proofTimestamp, bytes32 transcriptHash)'
];

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.verifierPrivateKey, this.provider);

    if (config.contracts.escrow) {
      this.escrow = new ethers.Contract(config.contracts.escrow, ESCROW_ABI, this.wallet);
      this.usdc = new ethers.Contract(config.contracts.usdc, USDC_ABI, this.provider);
      this.verifier = new ethers.Contract(config.contracts.verifier, VERIFIER_ABI, this.wallet);
    }
  }

  isConfigured() {
    return !!config.contracts.escrow;
  }

  getContractAddresses() {
    return config.contracts;
  }

  async getTrade(tradeId) {
    const trade = await this.escrow.getTrade(tradeId);
    return this.formatTrade(tradeId, trade);
  }

  async getAllTrades() {
    const nextId = await this.escrow.nextTradeId();
    const trades = [];

    for (let i = 0; i < nextId; i++) {
      try {
        const trade = await this.escrow.getTrade(i);
        trades.push(this.formatTrade(i, trade));
      } catch (e) {
        // Skip invalid trades
      }
    }

    return trades;
  }

  async getPendingTrades() {
    const all = await this.getAllTrades();
    return all.filter(t => t.status === 'Pending');
  }

  async getTradesByAddress(address) {
    const all = await this.getAllTrades();
    return {
      selling: all.filter(t => t.seller.toLowerCase() === address.toLowerCase()),
      buying: all.filter(t => t.buyer && t.buyer.toLowerCase() === address.toLowerCase())
    };
  }

  async getUsdcBalance(address) {
    const balance = await this.usdc.balanceOf(address);
    return ethers.formatUnits(balance, 6);
  }

  // Submit zkTLS proof to the SteamGameVerifier contract
  // proof should contain: messageHash, v, r, s, serverName, timestamp, ownsGame, transcriptHash
  async submitProofToVerifier(tradeId, proof) {
    const tx = await this.verifier.verifyAndResolve(
      tradeId,
      proof.messageHash,
      proof.v,
      proof.r,
      proof.s,
      proof.serverName,
      proof.timestamp,
      proof.ownsGame,
      proof.transcriptHash
    );
    await tx.wait();
    return tx.hash;
  }

  // Submit packed proof to the SteamGameVerifier contract
  async submitPackedProofToVerifier(tradeId, packedProof) {
    const tx = await this.verifier.verifyAndResolvePacked(tradeId, packedProof);
    await tx.wait();
    return tx.hash;
  }

  formatTrade(id, trade) {
    const statusMap = ['Pending', 'Acknowledged', 'Completed', 'Refunded', 'Cancelled'];
    return {
      id: Number(id),
      buyer: trade.buyer === ethers.ZeroAddress ? null : trade.buyer,
      seller: trade.seller,
      steamAppId: Number(trade.steamAppId),
      price: ethers.formatUnits(trade.price, 6),
      buyerSteamUsername: trade.buyerSteamUsername || null,
      status: statusMap[trade.status],
      createdAt: trade.createdAt > 0 ? Number(trade.createdAt) : null,
      acknowledgedAt: trade.acknowledgedAt > 0 ? Number(trade.acknowledgedAt) : null,
      disputeDeadline: trade.acknowledgedAt > 0 ? Number(trade.acknowledgedAt) + 3600 : null
    };
  }

  async getTradeHistory(tradeId) {
    const events = [];

    // Query all event types for this trade
    for (const eventName of EVENT_NAMES) {
      try {
        const filter = this.escrow.filters[eventName](tradeId);
        const logs = await this.escrow.queryFilter(filter, 0, 'latest');

        for (const log of logs) {
          const block = await log.getBlock();
          const tx = await log.getTransaction();

          events.push({
            event: eventName,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: block.timestamp,
            from: tx.from,
            args: this.formatEventArgs(eventName, log.args)
          });
        }
      } catch (e) {
        console.error(`Error fetching ${eventName} events:`, e);
      }
    }

    // Sort by block number (chronological order)
    events.sort((a, b) => a.blockNumber - b.blockNumber);

    return events;
  }

  formatEventArgs(eventName, args) {
    switch (eventName) {
      case 'TradeCreated':
        return {
          tradeId: Number(args.tradeId),
          buyer: args.buyer,
          seller: args.seller,
          price: ethers.formatUnits(args.price, 6),
          steamAppId: Number(args.steamAppId),
          steamUsername: args.steamUsername
        };
      case 'TradeCancelled':
        return { tradeId: Number(args.tradeId) };
      case 'TradeAcknowledged':
        return { tradeId: Number(args.tradeId) };
      case 'FundsReleased':
        return {
          tradeId: Number(args.tradeId),
          recipient: args.recipient
        };
      case 'FundsRefunded':
        return {
          tradeId: Number(args.tradeId),
          recipient: args.recipient
        };
      default:
        return {};
    }
  }
}

export const blockchain = new BlockchainService();
