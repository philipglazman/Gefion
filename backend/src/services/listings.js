// Off-chain listings storage (in-memory for now, could be database)

const listings = new Map();
let nextListingId = 1;

export const listingsService = {
  // Create a new off-chain listing
  create(sellerAddress, steamAppId, price, description = '') {
    const id = nextListingId++;
    const listing = {
      id,
      seller: sellerAddress,
      steamAppId,
      price, // in USDC
      description,
      status: 'active', // active, sold, cancelled
      createdAt: Date.now(),
    };
    listings.set(id, listing);
    return listing;
  },

  // Get all active listings
  getActive() {
    return Array.from(listings.values()).filter(l => l.status === 'active');
  },

  // Get all listings
  getAll() {
    return Array.from(listings.values());
  },

  // Get listing by ID
  getById(id) {
    return listings.get(id);
  },

  // Get listings by seller
  getBySeller(sellerAddress) {
    return Array.from(listings.values()).filter(
      l => l.seller.toLowerCase() === sellerAddress.toLowerCase()
    );
  },

  // Mark listing as sold (when escrow is initiated)
  markSold(id) {
    const listing = listings.get(id);
    if (listing) {
      listing.status = 'sold';
      return true;
    }
    return false;
  },

  // Cancel a listing
  cancel(id, sellerAddress) {
    const listing = listings.get(id);
    if (listing && listing.seller.toLowerCase() === sellerAddress.toLowerCase()) {
      listing.status = 'cancelled';
      return true;
    }
    return false;
  },

  // Update a listing
  update(id, sellerAddress, updates) {
    const listing = listings.get(id);
    if (listing && listing.seller.toLowerCase() === sellerAddress.toLowerCase()) {
      if (updates.price !== undefined) listing.price = updates.price;
      if (updates.description !== undefined) listing.description = updates.description;
      return listing;
    }
    return null;
  }
};
