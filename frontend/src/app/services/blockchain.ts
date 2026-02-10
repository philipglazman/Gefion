import { BrowserProvider, Contract, formatUnits, parseUnits, Eip1193Provider, TransactionReceipt } from 'ethers';
import { config } from '../config';
import api from './api';

export interface TransactionResult {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
}

const ESCROW_ABI = [
  'function createTrade(uint256 steamAppId, address seller, string calldata steamUsername) external returns (uint256)',
  'function cancelTrade(uint256 tradeId) external',
  'function acknowledge(uint256 tradeId) external',
  'function claimAfterWindow(uint256 tradeId) external',
  'function getTrade(uint256 tradeId) external view returns (tuple(address buyer, address seller, uint256 steamAppId, uint256 price, string buyerSteamUsername, uint8 status, uint256 createdAt, uint256 acknowledgedAt))',
  'function nextTradeId() external view returns (uint256)',
  'event TradeCreated(uint256 indexed tradeId, address indexed buyer, address indexed seller, uint256 price, uint256 steamAppId, string steamUsername)',
];

const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

export class BlockchainService {
  private provider: BrowserProvider | null = null;
  private escrow: Contract | null = null;
  private usdc: Contract | null = null;

  async connectWithProvider(eip1193Provider: Eip1193Provider): Promise<string> {
    this.provider = new BrowserProvider(eip1193Provider);
    const signer = await this.provider.getSigner();
    const address = await signer.getAddress();

    // Initialize contracts
    this.escrow = new Contract(config.escrowAddress, ESCROW_ABI, signer);
    this.usdc = new Contract(config.usdcAddress, USDC_ABI, signer);

    return address;
  }

  disconnect() {
    this.provider = null;
    this.escrow = null;
    this.usdc = null;
  }

  async getBalance(address: string): Promise<number> {
    if (!this.usdc) throw new Error('Not connected');
    const balance = await this.usdc.balanceOf(address);
    return Number(formatUnits(balance, 6));
  }

  private async getReceiptDetails(receipt: TransactionReceipt): Promise<TransactionResult> {
    if (!this.provider) throw new Error('Not connected');
    const block = await this.provider.getBlock(receipt.blockNumber);
    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
      from: receipt.from,
    };
  }

  async createTrade(steamAppId: number, seller: string, steamUsername: string, price: number): Promise<{ hash: string; tradeId: number }> {
    if (!this.escrow || !this.usdc || !this.provider) {
      throw new Error('Not connected');
    }

    const signer = await this.provider.getSigner();
    const address = await signer.getAddress();
    const priceInUnits = parseUnits(price.toString(), 6);

    // Check allowance
    const allowance = await this.usdc.allowance(address, config.escrowAddress);
    if (allowance < priceInUnits) {
      // Approve escrow to spend USDC
      const approveTx = await this.usdc.approve(config.escrowAddress, priceInUnits);
      await approveTx.wait();
    }

    // Create trade (buyer-initiated escrow)
    const tx = await this.escrow.createTrade(steamAppId, seller, steamUsername);
    const receipt = await tx.wait();
    const details = await this.getReceiptDetails(receipt);

    // Extract tradeId from TradeCreated event
    let tradeId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = this.escrow.interface.parseLog(log);
        if (parsed?.name === 'TradeCreated') {
          tradeId = Number(parsed.args.tradeId);
          break;
        }
      } catch {
        // Not our event, continue
      }
    }

    // Record the event to backend
    try {
      await api.recordTradeEvent(tradeId, 'TradeCreated', details.hash, details.blockNumber, details.timestamp, details.from, {
        tradeId,
        buyer: address,
        seller,
        price: price.toString(),
        steamAppId,
        steamUsername,
      });
    } catch (e) {
      console.error('Failed to record TradeCreated event:', e);
    }

    return { hash: receipt.hash, tradeId };
  }

  async acknowledge(tradeId: number): Promise<string> {
    if (!this.escrow || !this.provider) throw new Error('Not connected');
    const tx = await this.escrow.acknowledge(tradeId);
    const receipt = await tx.wait();
    const details = await this.getReceiptDetails(receipt);

    // Record the event
    await api.recordTradeEvent(tradeId, 'TradeAcknowledged', details.hash, details.blockNumber, details.timestamp, details.from, {
      tradeId,
    });

    return receipt.hash;
  }

  async claimAfterWindow(tradeId: number): Promise<string> {
    if (!this.escrow || !this.provider) throw new Error('Not connected');
    const signer = await this.provider.getSigner();
    const address = await signer.getAddress();

    const tx = await this.escrow.claimAfterWindow(tradeId);
    const receipt = await tx.wait();
    const details = await this.getReceiptDetails(receipt);

    // Record the event (FundsReleased to seller)
    await api.recordTradeEvent(tradeId, 'FundsReleased', details.hash, details.blockNumber, details.timestamp, details.from, {
      tradeId,
      recipient: address,
    });

    return receipt.hash;
  }

  async cancelTrade(tradeId: number): Promise<string> {
    if (!this.escrow || !this.provider) throw new Error('Not connected');
    const tx = await this.escrow.cancelTrade(tradeId);
    const receipt = await tx.wait();
    const details = await this.getReceiptDetails(receipt);

    // Record the event
    await api.recordTradeEvent(tradeId, 'TradeCancelled', details.hash, details.blockNumber, details.timestamp, details.from, {
      tradeId,
    });

    return receipt.hash;
  }
}

export const blockchain = new BlockchainService();
