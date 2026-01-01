import express from 'express';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';

const router = express.Router();

// Get all financial data for a user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const sql = `SELECT data FROM financial_data WHERE user_id = $1`;

    try {
        const result = await db.query(sql, [userId]);
        let row = result.rows[0];

        if (!row) {
            // This might happen if there was an error during registration. Let's create it.
            const insertSql = `INSERT INTO financial_data (user_id, data) VALUES ($1, '{}')`;
            await db.query(insertSql, [userId]);
            // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
            return res.json({});
        }
        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json(row.data || {});
    } catch (err) {
        console.error(err);
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        res.status(500).json({ message: 'Failed to fetch data' });
    }
});

// Save all financial data for a user
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const data = req.body; // Data is already a JSON object from body-parser
    
    // Use INSERT ... ON CONFLICT for an upsert operation in PostgreSQL
    const selectSql = `SELECT data FROM financial_data WHERE user_id = $1`;
    const upsertSql = `
        INSERT INTO financial_data (user_id, data) 
        VALUES ($1, $2)
        ON CONFLICT (user_id) 
        DO UPDATE SET data = EXCLUDED.data;
    `;

    try {
        const existing = await db.query(selectSql, [userId]);
        const currentData = existing.rows?.[0]?.data || {};
        const mergedData = { ...currentData, ...data };
        await db.query(upsertSql, [userId, mergedData]);
        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json({ message: 'Data saved successfully' });
    } catch (err) {
        console.error(err);
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        res.status(500).json({ message: 'Failed to save data' });
    }
});

export default router;
