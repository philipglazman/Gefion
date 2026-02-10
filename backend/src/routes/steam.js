import { Router } from 'express';
import { getGameDetails, getMultipleGameDetails, checkProfileVisibility } from '../services/steam.js';

const router = Router();

// GET /api/steam/game/:appId - Get single game details
router.get('/game/:appId', async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    if (isNaN(appId)) {
      return res.status(400).json({ error: 'Invalid app ID' });
    }
    const game = await getGameDetails(appId);
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/steam/games - Get multiple game details
router.post('/games', async (req, res) => {
  try {
    const { appIds } = req.body;
    if (!Array.isArray(appIds)) {
      return res.status(400).json({ error: 'appIds must be an array' });
    }
    const games = await getMultipleGameDetails(appIds);
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/steam/profile/:username/visibility - Check if a Steam profile is public
router.get('/profile/:username/visibility', async (req, res) => {
  try {
    const { username } = req.params;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const result = await checkProfileVisibility(username.trim());
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
