
import express from 'express';
import { db } from './database';
import { validateFinancialDataPayload, validateJsonPatchPayload, type JsonPatchOperation } from './schemas';
import { loadCredentials, saveCredentials, scrubStoredKeys, stripKeysFromBlob } from './ebCredentials';
import { AuthRequest } from './middleware';

const router = express.Router();

const applyEntityDelta = (
    stored: unknown,
    delta: { upserts?: Record<string, any>[]; deletedIds?: string[] },
): Record<string, any>[] => {
    const list = Array.isArray(stored) ? stored : [];
    const deletedSet = new Set(Array.isArray(delta.deletedIds) ? delta.deletedIds : []);
    const upserts = Array.isArray(delta.upserts) ? delta.upserts : [];
    const upsertById = new Map<string, Record<string, any>>();
    for (const item of upserts) {
        if (item && typeof item.id === 'string') upsertById.set(item.id, item);
    }

    const appliedIds = new Set<string>();
    const result: Record<string, any>[] = [];
    for (const item of list) {
        if (!item || typeof item.id !== 'string') continue;
        if (deletedSet.has(item.id)) continue;
        const replacement = upsertById.get(item.id);
        if (replacement !== undefined) {
            result.push(replacement);
            appliedIds.add(item.id);
        } else {
            result.push(item);
        }
    }
    for (const item of upserts) {
        if (item && typeof item.id === 'string' && !appliedIds.has(item.id) && !deletedSet.has(item.id)) {
            result.push(item);
            appliedIds.add(item.id);
        }
    }
    return result;
};

const applyJsonPatchOperations = (
    doc: Record<string, any>,
    ops: JsonPatchOperation[],
): Record<string, any> => {
    const next: Record<string, any> = { ...doc };
    for (const op of ops) {
        const segments = op.path.split('/').slice(1).map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
        if (segments.length === 0 || segments.some(s => s === '__proto__' || s === 'constructor' || s === 'prototype')) {
            continue;
        }
        const topKey = segments[0];
        if (segments.length === 1) {
            if (op.op === 'remove') delete next[topKey];
            else if (op.op === 'add' || op.op === 'replace') next[topKey] = op.value;
            continue;
        }
        if (segments.length === 2) {
            const container = next[topKey];
            const second = segments[1];
            if (Array.isArray(container)) {
                const cloned = [...container];
                if (second === '-' && op.op === 'add') {
                    cloned.push(op.value);
                } else {
                    const idx = Number.isInteger(Number(second))
                        ? Number(second)
                        : cloned.findIndex((item: any) => item && typeof item === 'object' && item.id === second);
                    if (idx >= 0 && idx < cloned.length) {
                        if (op.op === 'remove') cloned.splice(idx, 1);
                        else if (op.op === 'replace') cloned[idx] = op.value;
                        else if (op.op === 'add') cloned.splice(idx, 0, op.value);
                    } else if (op.op === 'add' || op.op === 'replace') {
                        cloned.push(op.value);
                    }
                }
                next[topKey] = cloned;
            } else if (container && typeof container === 'object') {
                const cloned = { ...container };
                if (op.op === 'remove') delete cloned[second];
                else if (op.op === 'add' || op.op === 'replace') cloned[second] = op.value;
                next[topKey] = cloned;
            }
        }
    }
    return next;
};

// Get all financial data for a user
router.get('/', async (req: AuthRequest, res) => {
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
        let data = row.data || {};
        // Blobs written by older versions carry the Enable Banking private key. Move it to the encrypted credential
        // store and scrub it from the blob before it is sent to the browser.
        if (JSON.stringify(data).includes('"clientCertificate"')) {
            const { data: scrubbed, found } = stripKeysFromBlob(data);
            if (found && !(await loadCredentials(userId!))) {
                await saveCredentials(userId!, found.applicationId, found.clientCertificate);
            }
            await scrubStoredKeys(userId!);
            data = scrubbed;
        }
        res.json(data);
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
    'accountOrder', 'taskOrder', 'goalOrder',
];
const MATERIAL_OBJECT_KEYS = ['loanPaymentOverrides', 'manualWarrantPrices', 'priceHistory', 'userStats', 'preferences'];

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
router.post('/', async (req: AuthRequest, res) => {
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
        const incomingDeltas = (body.deltas && typeof body.deltas === 'object' && !Array.isArray(body.deltas))
            ? (body.deltas as Record<string, { upserts?: Record<string, any>[]; deletedIds?: string[] }>)
            : undefined;
        const incomingData = isPartial ? { ...(body.data || {}) } : { ...body };
        delete incomingData.partial;
        delete incomingData.data;
        delete incomingData.deltas;
        delete incomingData.previousUpdatedAt;
        delete incomingData.allowEmpty;

        // The signing key never lives in the blob: move it to the encrypted credential store.
        if (incomingData.enableBankingConnections || incomingData.enableBankingPendingConnections) {
            const { data: scrubbed, found } = stripKeysFromBlob(incomingData);
            Object.assign(incomingData, scrubbed);
            if (found && !(await loadCredentials(userId!))) {
                await saveCredentials(userId!, found.applicationId, found.clientCertificate);
            }
        }

        // Reject malformed payloads (wrong container types, bad dates) before they reach the user's blob.
        const validation = validateFinancialDataPayload(
            incomingDeltas ? { ...incomingData, deltas: incomingDeltas } : incomingData
        );
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

        if (incomingDeltas) {
            const allowedDeltaKeys = new Set(MATERIAL_ARRAY_KEYS);
            for (const [sliceKey, delta] of Object.entries(incomingDeltas)) {
                if (!allowedDeltaKeys.has(sliceKey) || !delta || typeof delta !== 'object') continue;
                const sliceRes = await client.query(
                    `SELECT data->$2 AS slice FROM financial_data WHERE user_id = $1`,
                    [userId, sliceKey]
                );
                const storedSlice = sliceRes.rows?.[0]?.slice;
                incomingData[sliceKey] = applyEntityDelta(storedSlice, delta);
            }
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
        await client?.query('ROLLBACK').catch((rollbackError: unknown) => console.error('Rollback failed:', rollbackError));
        console.error(err);
        res.status(500).json({ message: 'Failed to save data' });
    } finally {
        client?.release();
    }
});

// Apply RFC 6902 JSON Patch operations to the user's financial_data blob.
router.patch('/', async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const validation = validateJsonPatchPayload(req.body);
    if (!validation.success || !validation.patch) {
        return res.status(400).json({ message: validation.error || 'Invalid JSON Patch payload.' });
    }

    let client: any;
    try {
        client = await db.connect();
        await client.query('BEGIN');

        const existing = await client.query(
            `SELECT data FROM financial_data WHERE user_id = $1 FOR UPDATE`,
            [userId]
        );
        const currentData = (existing.rows?.[0]?.data as Record<string, any> | undefined) || {};
        const currentUpdatedAt = (currentData.lastUpdatedAt as string | undefined) || undefined;

        if (validation.previousUpdatedAt && currentUpdatedAt && validation.previousUpdatedAt !== currentUpdatedAt) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Data conflict: your local copy is stale. Please refresh and try again.',
                currentUpdatedAt,
            });
        }

        const patched = applyJsonPatchOperations(currentData, validation.patch);
        const nextUpdatedAt = new Date().toISOString();
        patched.lastUpdatedAt = nextUpdatedAt;

        const postValidation = validateFinancialDataPayload(patched);
        if (!postValidation.success) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: postValidation.error || 'Patched document failed validation.' });
        }

        await client.query(
            `INSERT INTO financial_data (user_id, data)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data`,
            [userId, JSON.stringify(patched)]
        );
        await client.query('COMMIT');

        res.json({ message: 'Patch applied successfully', lastUpdatedAt: nextUpdatedAt });
    } catch (err) {
        await client?.query('ROLLBACK').catch((rollbackError: unknown) => console.error('Rollback failed:', rollbackError));
        console.error(err);
        res.status(500).json({ message: 'Failed to apply patch' });
    } finally {
        client?.release();
    }
});

export default router;
