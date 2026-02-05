// Steam Store API service with caching

const gameCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getGameDetails(appId) {
  // Check cache first
  const cached = gameCache.get(appId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}`
    );

    if (!response.ok) {
      throw new Error(`Steam API error: ${response.status}`);
    }

    const data = await response.json();
    const appData = data[appId];

    if (!appData || !appData.success) {
      // Game not found or API error
      const fallback = {
        name: `Steam Game #${appId}`,
        headerImage: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
        shortDescription: 'A Steam game.',
        appId
      };
      gameCache.set(appId, { data: fallback, timestamp: Date.now() });
      return fallback;
    }

    const gameData = {
      name: appData.data.name,
      headerImage: appData.data.header_image,
      shortDescription: appData.data.short_description || '',
      appId
    };

    // Cache the result
    gameCache.set(appId, { data: gameData, timestamp: Date.now() });
    return gameData;
  } catch (error) {
    console.error(`Failed to fetch Steam game ${appId}:`, error);
    // Return fallback on error
    return {
      name: `Steam Game #${appId}`,
      headerImage: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
      shortDescription: 'A Steam game.',
      appId
    };
  }
}

export async function getMultipleGameDetails(appIds) {
  const uniqueIds = [...new Set(appIds)];
  const results = await Promise.all(
    uniqueIds.map(id => getGameDetails(id))
  );

  // Return as a map for easy lookup
  const gameMap = {};
  results.forEach(game => {
    gameMap[game.appId] = game;
  });
  return gameMap;
}
