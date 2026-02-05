import { BrowserProvider, Contract, formatUnits, parseUnits, Eip1193Provider } from 'ethers';
import { config } from '../config';

const ESCROW_ABI = [
  'function createListing(uint256 price, uint256 steamAppId) external returns (uint256)',
  'function cancelListing(uint256 listingId) external',
  'function purchase(uint256 listingId, string calldata steamUsername) external',
  'function acknowledge(uint256 listingId) external',
  'function claimAfterWindow(uint256 listingId) external',
  'function getListing(uint256 listingId) external view returns (tuple(address seller, uint256 price, uint256 steamAppId, uint8 status, address buyer, string buyerSteamUsername, uint256 acknowledgedAt))',
  'function nextListingId() external view returns (uint256)',
  'event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 price, uint256 steamAppId)',
];

const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export class BlockchainService {
  private provider: BrowserProvider | null = null;
  private escrow: Contract | null = null;
  private usdc: Contract | null = null;

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    this.provider = new BrowserProvider(window.ethereum);

    // Request account access
    const accounts = await this.provider.send('eth_requestAccounts', []);
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    // Check/switch chain
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== config.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${config.chainId.toString(16)}` }],
        });
      } catch (e: unknown) {
        // Chain not added, try to add it
        if ((e as { code?: number }).code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${config.chainId.toString(16)}`,
              chainName: 'Anvil Local',
              rpcUrls: [config.rpcUrl],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            }],
          });
        } else {
          throw e;
        }
      }
      // Refresh provider after chain switch
      this.provider = new BrowserProvider(window.ethereum);
    }

    const signer = await this.provider.getSigner();

    // Initialize contracts
    this.escrow = new Contract(config.escrowAddress, ESCROW_ABI, signer);
    this.usdc = new Contract(config.usdcAddress, USDC_ABI, signer);

    return accounts[0];
  }

  async getBalance(address: string): Promise<number> {
    if (!this.usdc) throw new Error('Not connected');
    const balance = await this.usdc.balanceOf(address);
    return Number(formatUnits(balance, 6));
  }

  async purchase(listingId: number, steamUsername: string, price: number): Promise<string> {
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

    // Purchase
    const tx = await this.escrow.purchase(listingId, steamUsername);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async createListing(price: number, steamAppId: number): Promise<number> {
    if (!this.escrow) throw new Error('Not connected');

    const priceInUnits = parseUnits(price.toString(), 6);
    const tx = await this.escrow.createListing(priceInUnits, steamAppId);
    const receipt = await tx.wait();

    // Parse listing ID from event
    const event = receipt.logs.find((log: { fragment?: { name: string } }) =>
      log.fragment?.name === 'ListingCreated'
    );
    return event ? Number(event.args[0]) : 0;
  }

  async acknowledge(listingId: number): Promise<string> {
    if (!this.escrow) throw new Error('Not connected');
    const tx = await this.escrow.acknowledge(listingId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async claimAfterWindow(listingId: number): Promise<string> {
    if (!this.escrow) throw new Error('Not connected');
    const tx = await this.escrow.claimAfterWindow(listingId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async cancelListing(listingId: number): Promise<string> {
    if (!this.escrow) throw new Error('Not connected');
    const tx = await this.escrow.cancelListing(listingId);
    const receipt = await tx.wait();
    return receipt.hash;
  }
}

export const blockchain = new BlockchainService();
