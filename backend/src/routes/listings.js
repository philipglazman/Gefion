import { Router } from 'express';
import { blockchain } from '../services/blockchain.js';

const router = Router();

// GET /api/listings - Get all open listings
router.get('/', async (req, res) => {
  try {
    const listings = await blockchain.getOpenListings();
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/:id - Get single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await blockchain.getListing(req.params.id);
    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/address/:address - Get listings by address
router.get('/address/:address', async (req, res) => {
  try {
    const listings = await blockchain.getListingsByAddress(req.params.address);
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
