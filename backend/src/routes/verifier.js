import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { blockchain } from '../services/blockchain.js';

const execAsync = promisify(exec);
const router = Router();

// Path to steam-zktls binaries
const STEAM_ZKTLS_PATH = path.resolve(process.cwd(), '../steam-zktls');
const BINARIES_PATH = path.join(STEAM_ZKTLS_PATH, 'target/release');

// POST /api/verifier/submit-proof - Submit proof directly to verifier contract
// For use with pre-generated proofs
router.post('/submit-proof', async (req, res) => {
  try {
    const { tradeId, proof } = req.body;

    if (tradeId === undefined) {
      return res.status(400).json({ error: 'Missing tradeId' });
    }

    if (!proof) {
      return res.status(400).json({ error: 'Missing proof data' });
    }

    // Submit proof to the SteamGameVerifier contract
    const txHash = await blockchain.submitProofToVerifier(tradeId, proof);
    res.json({ success: true, txHash });
  } catch (error) {
    console.error('Submit proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/verifier/verify - Run full zkTLS verification flow
router.post('/verify', async (req, res) => {
  try {
    const { tradeId } = req.body;

    if (tradeId === undefined) {
      return res.status(400).json({ error: 'Missing tradeId' });
    }

    // Get the trade details
    const trade = await blockchain.getTrade(tradeId);

    if (trade.status !== 'Acknowledged') {
      return res.status(400).json({ error: 'Trade must be acknowledged to verify' });
    }

    const steamUsername = trade.buyerSteamUsername;
    const steamAppId = trade.steamAppId;

    console.log(`Starting zkTLS verification for trade ${tradeId}:`);
    console.log(`  Steam Username: ${steamUsername}`);
    console.log(`  Steam App ID: ${steamAppId}`);

    // Step 1: Run prover to generate attestation
    console.log('Step 1: Running prover...');
    try {
      await execAsync(
        `${BINARIES_PATH}/prover -v "${steamUsername}" -a ${steamAppId}`,
        { cwd: STEAM_ZKTLS_PATH, timeout: 60000 }
      );
    } catch (e) {
      console.error('Prover failed:', e);
      return res.status(500).json({
        error: 'Prover failed',
        details: e.message,
        hint: 'Make sure the TLSNotary notary server is running (cd tlsn/crates/notary/server && cargo run --release)'
      });
    }

    // Step 2: Run present to create selective disclosure
    console.log('Step 2: Running present...');
    try {
      await execAsync(
        `${BINARIES_PATH}/present -a ${steamAppId}`,
        { cwd: STEAM_ZKTLS_PATH, timeout: 30000 }
      );
    } catch (e) {
      console.error('Present failed:', e);
      return res.status(500).json({ error: 'Present failed', details: e.message });
    }

    // Step 3: Run export to create Solidity-compatible proof
    console.log('Step 3: Running export...');
    const proofFile = path.join(STEAM_ZKTLS_PATH, `proof_${tradeId}.json`);
    try {
      await execAsync(
        `${BINARIES_PATH}/export -o "${proofFile}"`,
        { cwd: STEAM_ZKTLS_PATH, timeout: 30000 }
      );
    } catch (e) {
      console.error('Export failed:', e);
      return res.status(500).json({ error: 'Export failed', details: e.message });
    }

    // Step 4: Read proof and submit to contract
    console.log('Step 4: Reading proof and submitting to contract...');
    const proofJson = await readFile(proofFile, 'utf-8');
    const proofData = JSON.parse(proofJson);

    // Format proof for contract call
    const proof = {
      messageHash: proofData.messageHash,
      v: proofData.signatureV,
      r: proofData.signatureR,
      s: proofData.signatureS,
      serverName: proofData.serverName,
      timestamp: proofData.timestamp,
      ownsGame: proofData.ownsGame,
      transcriptHash: proofData.transcriptHash
    };

    // Submit to verifier contract
    const txHash = await blockchain.submitProofToVerifier(tradeId, proof);

    // Clean up proof file
    await unlink(proofFile).catch(() => {});

    console.log(`Verification complete! TX: ${txHash}`);
    res.json({
      success: true,
      txHash,
      ownsGame: proofData.ownsGame,
      timestamp: proofData.timestamp
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/verifier/status - Check if notary server is running
router.get('/status', async (req, res) => {
  try {
    // Try to connect to notary server
    const response = await fetch('http://localhost:7047/healthcheck').catch(() => null);
    const notaryRunning = response?.ok || false;

    res.json({
      notaryRunning,
      binariesPath: BINARIES_PATH,
      hint: notaryRunning ? 'Ready to verify' : 'Start notary: cd tlsn/crates/notary/server && cargo run --release'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
