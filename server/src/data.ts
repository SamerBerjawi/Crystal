
import express from 'express';
import { db } from './database';
import { validateFinancialDataPayload } from './schemas';
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

// Top-level keys that make a payload "real data" (an empty payload must never wipe an existing account).
const MATERIAL_ARRAY_KEYS = [
    'accounts', 'transactions', 'investmentTransactions', 'recurringTransactions', 'recurringTransactionOverrides',
    'financialGoals', 'budgets', 'tasks', 'warrants', 'memberships', 'importExportHistory', 'billsAndPayments',
    'invoices', 'tags', 'predictions', 'enableBankingConnections', 'incomeCategories', 'expenseCategories',
    'accountOrder', 'taskOrder',
];
const MATERIAL_OBJECT_KEYS = ['loanPaymentOverrides', 'manualWarrantPrices', 'priceHistory', 'userStats'];

const payloadHasMaterialData = (data: Record<string, any>) =>
    MATERIAL_ARRAY_KEYS.some(key => Array.isArray(data[key]) && data[key].length > 0) ||
    MATERIAL_OBJECT_KEYS.some(key => {
        const value = data[key];
        return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    });

// The same check, evaluated inside PostgreSQL so the stored blob never has to be read into Node.
// Keys are the constants above, never user input.
const STORED_HAS_MATERIAL_DATA_SQL = '(' + [
    ...MATERIAL_ARRAY_KEYS.map(k => `(CASE WHEN jsonb_typeof(data->'${k}') = 'array' THEN jsonb_array_length(data->'${k}') > 0 ELSE false END)`),
    ...MATERIAL_OBJECT_KEYS.map(k => `(CASE WHEN jsonb_typeof(data->'${k}') = 'object' THEN data->'${k}' <> '{}'::jsonb ELSE false END)`),
].join(' OR ') + ')';

// Save financial data for a user.
//
// The row is locked with SELECT ... FOR UPDATE for the duration of the transaction, and the write is a single
// atomic jsonb merge (`data || incoming`): top-level keys present in the payload replace the stored ones, all
// other keys are left untouched. The stored blob is never loaded into Node, so a one-task edit no longer
// costs a parse + re-serialisation of the user's whole history.
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const body = req.body || {}; // Data is already a JSON object from body-parser
    const allowEmpty = Boolean(body.allowEmpty);

    let client: any;
    try {
        client = await db.connect();
        await client.query('BEGIN');

        const existing = await client.query(
            `SELECT data->>'lastUpdatedAt' AS updated_at FROM financial_data WHERE user_id = $1 FOR UPDATE`,
            [userId]
        );
        const currentUpdatedAt = (existing.rows?.[0]?.updated_at as string | null) || undefined;

        const isPartial = Boolean(body.partial);
        const incomingData = isPartial ? { ...(body.data || {}) } : { ...body };
        delete incomingData.partial;
        delete incomingData.data;
        delete incomingData.previousUpdatedAt;
        delete incomingData.allowEmpty;

        // Reject malformed payloads (wrong container types, bad dates) before they reach the user's blob.
        const validation = validateFinancialDataPayload(incomingData);
        if (!validation.success) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: validation.error || 'Invalid payload.' });
        }

        const previousUpdatedAt = body.previousUpdatedAt as string | undefined;
        if (previousUpdatedAt && currentUpdatedAt && previousUpdatedAt !== currentUpdatedAt) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Data conflict: your local copy is stale. Please refresh and try again.',
                currentUpdatedAt,
            });
        }

        if (!isPartial && !allowEmpty && !payloadHasMaterialData(incomingData)) {
            const stored = await client.query(
                `SELECT ${STORED_HAS_MATERIAL_DATA_SQL} AS has_material FROM financial_data WHERE user_id = $1`,
                [userId]
            );
            if (stored.rows?.[0]?.has_material) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    message: 'Refusing to overwrite existing data with an empty payload.',
                    currentUpdatedAt,
                });
            }
        }

        const nextUpdatedAt = (body.lastUpdatedAt as string | undefined) || new Date().toISOString();
        incomingData.lastUpdatedAt = nextUpdatedAt;

        await client.query(
            `INSERT INTO financial_data (user_id, data)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (user_id)
             DO UPDATE SET data = COALESCE(financial_data.data, '{}'::jsonb) || EXCLUDED.data`,
            [userId, JSON.stringify(incomingData)]
        );
        await client.query('COMMIT');

        res.json({ message: 'Data saved successfully', lastUpdatedAt: nextUpdatedAt });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ message: 'Failed to save data' });
    } finally {
        client?.release();
    }
});

export default router;
