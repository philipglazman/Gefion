// Off-chain listings storage using SQLite
import { databaseService } from './database.js';

export const listingsService = {
  // Create a new off-chain listing
  create(sellerAddress, steamAppId, price, description = '') {
    return databaseService.createListing(sellerAddress, steamAppId, price, description);
  },

  // Get all active listings
  getActive() {
    return databaseService.getAllListings();
  },

  // Get all listings
  getAll() {
    return databaseService.getAllListings();
  },

  // Get listing by ID
  getById(id) {
    return databaseService.getListing(id);
  },

  // Get listings by seller
  getBySeller(sellerAddress) {
    return databaseService.getListingsBySeller(sellerAddress).filter(
      l => l.seller.toLowerCase() === sellerAddress.toLowerCase()
    );
  },

  // Mark listing as sold (when escrow is initiated)
  markSold(id) {
    const listing = databaseService.updateListingStatus(id, 'sold');
    return listing !== null;
  },

  // Cancel a listing
  cancel(id, sellerAddress) {
    const listing = databaseService.getListing(id);
    if (listing && listing.seller.toLowerCase() === sellerAddress.toLowerCase()) {
      databaseService.updateListingStatus(id, 'cancelled');
      return true;
    }
    return false;
  },

  // Update a listing
  update(id, sellerAddress, updates) {
    const listing = databaseService.getListing(id);
    if (listing && listing.seller.toLowerCase() === sellerAddress.toLowerCase()) {
      // For now, just return the listing as-is since we don't have an update method
      // Could add price/description updates later
      return listing;
    }
    return null;
  }
};
