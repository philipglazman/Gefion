import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { blockchain } from './services/blockchain.js';
import listingsRouter from './routes/listings.js';
import verifierRouter from './routes/verifier.js';
import configRouter from './routes/config.js';
import steamRouter from './routes/steam.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: blockchain.isConfigured()
  });
});

// Routes
app.use('/api/listings', listingsRouter);
app.use('/api/verifier', verifierRouter);
app.use('/api/config', configRouter);
app.use('/api/steam', steamRouter);

app.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);

  if (!blockchain.isConfigured()) {
    console.log('Warning: Contract addresses not configured. Run deploy script first.');
  } else {
    console.log('Contract addresses loaded:', blockchain.getContractAddresses());
  }
});
