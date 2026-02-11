import { Router } from 'express';
import { blockchain } from '../services/blockchain.js';
import { config } from '../config/index.js';

const router = Router();

// GET /api/config - Get contract addresses and config for frontend
router.get('/', async (req, res) => {
  try {
    res.json({
      contracts: blockchain.getContractAddresses(),
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      explorerUrl: config.explorerUrl,
      sellerStakePercent: config.sellerStakePercent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config/balance/:address - Get USDC balance for address
router.get('/balance/:address', async (req, res) => {
  try {
    const balance = await blockchain.getUsdcBalance(req.params.address);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
