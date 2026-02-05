import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', 'data', 'gefion.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(join(__dirname, '..', '..', 'data'), { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  -- Listings table (off-chain marketplace listings)
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller TEXT NOT NULL,
    steam_app_id TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'sold', 'cancelled')),
    created_at INTEGER NOT NULL
  );

  -- Transaction events table (on-chain trade history)
  CREATE TABLE IF NOT EXISTS trade_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    from_address TEXT NOT NULL,
    args TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  -- Create indexes for faster queries
  CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller);
  CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
  CREATE INDEX IF NOT EXISTS idx_trade_events_trade_id ON trade_events(trade_id);
  CREATE INDEX IF NOT EXISTS idx_trade_events_tx_hash ON trade_events(tx_hash);
`);

// Prepared statements for listings
const insertListing = db.prepare(`
  INSERT INTO listings (seller, steam_app_id, price, description, status, created_at)
  VALUES (?, ?, ?, ?, 'active', ?)
`);

const getListingById = db.prepare('SELECT * FROM listings WHERE id = ?');
const getAllActiveListings = db.prepare("SELECT * FROM listings WHERE status = 'active' ORDER BY created_at DESC");
const getListingsBySeller = db.prepare('SELECT * FROM listings WHERE LOWER(seller) = LOWER(?) ORDER BY created_at DESC');
const updateListingStatus = db.prepare('UPDATE listings SET status = ? WHERE id = ?');

// Prepared statements for trade events
const insertTradeEvent = db.prepare(`
  INSERT INTO trade_events (trade_id, event_name, tx_hash, block_number, timestamp, from_address, args)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const getTradeEvents = db.prepare(`
  SELECT * FROM trade_events WHERE trade_id = ? ORDER BY block_number ASC, id ASC
`);

const getEventByTxHash = db.prepare('SELECT * FROM trade_events WHERE tx_hash = ? AND event_name = ?');

export const databaseService = {
  // Listing methods
  createListing(seller, steamAppId, price, description = '') {
    const result = insertListing.run(seller, steamAppId, price, description, Date.now());
    return this.getListing(result.lastInsertRowid);
  },

  getListing(id) {
    const row = getListingById.get(id);
    return row ? this.formatListing(row) : null;
  },

  getAllListings() {
    return getAllActiveListings.all().map(row => this.formatListing(row));
  },

  getListingsBySeller(seller) {
    return getListingsBySeller.all(seller).map(row => this.formatListing(row));
  },

  updateListingStatus(id, status) {
    updateListingStatus.run(status, id);
    return this.getListing(id);
  },

  formatListing(row) {
    return {
      id: row.id,
      seller: row.seller,
      steamAppId: row.steam_app_id,
      price: row.price,
      description: row.description,
      status: row.status,
      createdAt: row.created_at
    };
  },

  // Trade event methods
  saveTradeEvent(tradeId, eventName, txHash, blockNumber, timestamp, fromAddress, args) {
    // Check if event already exists (idempotent)
    const existing = getEventByTxHash.get(txHash, eventName);
    if (existing) {
      return this.formatTradeEvent(existing);
    }

    const result = insertTradeEvent.run(
      tradeId,
      eventName,
      txHash,
      blockNumber,
      timestamp,
      fromAddress,
      JSON.stringify(args)
    );

    return {
      id: result.lastInsertRowid,
      tradeId,
      event: eventName,
      txHash,
      blockNumber,
      timestamp,
      from: fromAddress,
      args
    };
  },

  getTradeHistory(tradeId) {
    return getTradeEvents.all(tradeId).map(row => this.formatTradeEvent(row));
  },

  formatTradeEvent(row) {
    return {
      event: row.event_name,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      timestamp: row.timestamp,
      from: row.from_address,
      args: JSON.parse(row.args)
    };
  },

  // Utility methods
  close() {
    db.close();
  }
};

export default databaseService;
