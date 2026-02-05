import { Router } from 'express';
import { blockchain } from '../services/blockchain.js';

const router = Router();

// POST /api/verifier/submit-proof - Submit proof result for a listing
// This endpoint will be called after running the zkTLS verifier
router.post('/submit-proof', async (req, res) => {
  try {
    const { listingId, buyerOwnsGame } = req.body;

    if (listingId === undefined || buyerOwnsGame === undefined) {
      return res.status(400).json({ error: 'Missing listingId or buyerOwnsGame' });
    }

    const txHash = await blockchain.submitProofResult(listingId, buyerOwnsGame);
    res.json({ success: true, txHash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/verifier/verify - Run verification for a listing
// TODO: Integrate with steam-zktls prover/verifier
router.post('/verify', async (req, res) => {
  try {
    const { listingId } = req.body;

    // Get the listing to find steamAppId and buyer username
    const listing = await blockchain.getListing(listingId);

    if (listing.status !== 'Acknowledged') {
      return res.status(400).json({ error: 'Listing must be acknowledged to verify' });
    }

    // TODO: Implement zkTLS verification
    // 1. Run prover with listing.buyerSteamUsername and listing.steamAppId
    // 2. Run present to create selective disclosure
    // 3. Run verifier to get result
    // 4. Call submitProofResult with the result

    res.status(501).json({
      error: 'Not implemented',
      todo: 'Integrate with steam-zktls verifier',
      listing: {
        steamAppId: listing.steamAppId,
        buyerSteamUsername: listing.buyerSteamUsername
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
