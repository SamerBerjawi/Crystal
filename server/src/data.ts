// FIX: Consolidate express imports into a single statement to resolve type conflicts and errors related to Request and Response objects.
import express, { Response } from 'express';
import { pool } from './database';
import { authMiddleware, AuthRequest } from './middleware';

// FIX: Create router from express instance.
export const dataRouter = express.Router();

// FIX: Correctly typed middleware and route handlers to resolve overload errors.
dataRouter.use(authMiddleware);

// Get all financial data for the logged-in user
// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response type.
dataRouter.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT data FROM financial_data WHERE user_email = $1', [req.user.email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No financial data found for this user.' });
        }
        res.json(result.rows[0].data);
    } catch (err) {
        console.error('Error fetching financial data:', err);
        res.status(500).json({ message: 'Failed to fetch data.' });
    }
});

// Save/Update all financial data for the logged-in user
// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response type.
dataRouter.post('/', async (req: AuthRequest, res: Response) => {
    const data = req.body;
    if (!data) {
        return res.status(400).json({ message: 'No data provided.' });
    }
    
    try {
        // Use an UPSERT operation
        await pool.query(
            `INSERT INTO financial_data (user_email, data)
             VALUES ($1, $2)
             ON CONFLICT (user_email)
             DO UPDATE SET data = $2`,
            [req.user.email, JSON.stringify(data)]
        );
        res.status(200).json({ message: 'Data saved successfully.' });
    } catch (err) {
        console.error('Error saving financial data:', err);
        res.status(500).json({ message: 'Failed to save data.' });
    }
});
