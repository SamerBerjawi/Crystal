
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
    const body = req.body || {}; // Data is already a JSON object from body-parser
    const allowEmpty = Boolean(body.allowEmpty);
    
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Use SELECT ... FOR UPDATE to lock the row and avoid concurrency races
        const selectSql = `SELECT data FROM financial_data WHERE user_id = $1 FOR UPDATE`;
        const existing = await client.query(selectSql, [userId]);
        const currentData = existing.rows?.[0]?.data || {};
        const isPartial = Boolean(body.partial);
        const incomingData = isPartial ? (body.data || {}) : { ...body };
        delete incomingData.partial;
        delete incomingData.data;
        delete incomingData.previousUpdatedAt;
        delete incomingData.allowEmpty;

        const previousUpdatedAt = body.previousUpdatedAt as string | undefined;
        const currentUpdatedAt = currentData.lastUpdatedAt as string | undefined;
        if (previousUpdatedAt && currentUpdatedAt && previousUpdatedAt !== currentUpdatedAt) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Data conflict: your local copy is stale. Please refresh and try again.',
                currentUpdatedAt,
            });
        }

        const hasMaterialData = (data: Record<string, any>) => {
            const arrayKeys = [
                'accounts',
                'transactions',
                'investmentTransactions',
                'recurringTransactions',
                'recurringTransactionOverrides',
                'financialGoals',
                'budgets',
                'tasks',
                'warrants',
                'memberships',
                'importExportHistory',
                'billsAndPayments',
                'invoices',
                'tags',
                'predictions',
                'enableBankingConnections',
                'incomeCategories',
                'expenseCategories',
                'accountOrder',
                'taskOrder',
            ];

            const objectKeys = ['loanPaymentOverrides', 'manualWarrantPrices', 'priceHistory', 'userStats'];

            if (arrayKeys.some(key => Array.isArray(data[key]) && data[key].length > 0)) {
                return true;
            }

            return objectKeys.some(key => {
                const value = data[key];
                return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
            });
        };

        if (!isPartial && !allowEmpty && hasMaterialData(currentData) && !hasMaterialData(incomingData)) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Refusing to overwrite existing data with an empty payload.',
                currentUpdatedAt,
            });
        }

        const nextUpdatedAt = (body.lastUpdatedAt as string | undefined) || new Date().toISOString();
        const mergedData = { ...currentData, ...incomingData, lastUpdatedAt: nextUpdatedAt };
        
        const upsertSql = `
            INSERT INTO financial_data (user_id, data) 
            VALUES ($1, $2)
            ON CONFLICT (user_id) 
            DO UPDATE SET data = EXCLUDED.data;
        `;
        await client.query(upsertSql, [userId, mergedData]);
        await client.query('COMMIT');
        
        res.json({ message: 'Data saved successfully', lastUpdatedAt: nextUpdatedAt });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ message: 'Failed to save data' });
    } finally {
        client.release();
    }
});

export default router;
