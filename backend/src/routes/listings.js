import { Router } from 'express';
import { blockchain } from '../services/blockchain.js';
import { listingsService } from '../services/listings.js';

const router = Router();

// ============ OFF-CHAIN LISTINGS (Seller creates) ============

// GET /api/listings - Get all active off-chain listings
router.get('/', async (req, res) => {
  try {
    const listings = listingsService.getActive();
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/listings - Create a new off-chain listing (seller)
router.post('/', async (req, res) => {
  try {
    const { seller, steamAppId, price, description } = req.body;

    if (!seller || !steamAppId || !price) {
      return res.status(400).json({ error: 'Missing required fields: seller, steamAppId, price' });
    }

    const listing = listingsService.create(seller, steamAppId, parseFloat(price), description || '');
    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/seller/:address - Get listings by seller
router.get('/seller/:address', async (req, res) => {
  try {
    const listings = listingsService.getBySeller(req.params.address);
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/listings/:id - Cancel a listing
router.delete('/:id', async (req, res) => {
  try {
    const { seller } = req.body;
    if (!seller) {
      return res.status(400).json({ error: 'Missing seller address' });
    }

    const success = listingsService.cancel(parseInt(req.params.id), seller);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Listing not found or not authorized' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ON-CHAIN TRADES (Buyer initiates) ============

// GET /api/listings/trades - Get all on-chain trades
router.get('/trades', async (req, res) => {
  try {
    const trades = await blockchain.getAllTrades();
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/trades/:id - Get single on-chain trade
router.get('/trades/:id', async (req, res) => {
  try {
    const trade = await blockchain.getTrade(req.params.id);
    res.json(trade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/trades/:id/history - Get trade transaction history
router.get('/trades/:id/history', async (req, res) => {
  try {
    const history = await blockchain.getTradeHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/address/:address - Get trades by address
router.get('/address/:address', async (req, res) => {
  try {
    const trades = await blockchain.getTradesByAddress(req.params.address);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/listings/:id/initiate - Mark listing as sold when escrow initiated
router.post('/:id/initiate', async (req, res) => {
  try {
    const success = listingsService.markSold(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Listing not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
