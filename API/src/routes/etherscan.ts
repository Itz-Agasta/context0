import express from 'express';
import { verifyTransaction } from '../utils/etherscan.js';

export const etherScanRouter = express.Router();

etherScanRouter.get('/verify/:txHash', async (req, res) => {
    const { txHash } = req.params;
    try {
        const result = await verifyTransaction(txHash);
        res.json(result);
    } catch (error) {
        console.error('Error verifying transaction:', error);
        res.status(500).json({ error: 'Failed to verify transaction' });
    }
})