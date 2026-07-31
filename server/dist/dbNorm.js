"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFinancialDataFromRelational = fetchFinancialDataFromRelational;
exports.syncFinancialDataToRelational = syncFinancialDataToRelational;
exports.getCategoryTotalsSql = getCategoryTotalsSql;
exports.addOrUpdateRelationalItem = addOrUpdateRelationalItem;
exports.removeRelationalItem = removeRelationalItem;
exports.applyJsonPatchToRelational = applyJsonPatchToRelational;
const database_1 = require("./database");
const patch_1 = require("./patch");
/**
 * Fetches all normalized relational financial data for a user and reconstructs the FinancialData payload.
 */
async function fetchFinancialDataFromRelational(userId) {
    const profileRes = await database_1.db.query(`SELECT last_updated_at, data FROM user_financial_profiles WHERE user_id = $1`, [userId]);
    const profileRow = profileRes.rows[0];
    const profileData = profileRow?.data || {};
    const accountsRes = await database_1.db.query(`SELECT * FROM accounts WHERE user_id = $1`, [userId]);
    const accounts = accountsRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        balance: parseFloat(r.balance || '0'),
        currency: r.currency,
        ...(r.data || {}),
    }));
    const txRes = await database_1.db.query(`SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC`, [userId]);
    const transactions = txRes.rows.map(r => ({
        id: r.id,
        accountId: r.account_id,
        amount: parseFloat(r.amount || '0'),
        date: typeof r.date === 'object' && r.date instanceof Date ? r.date.toISOString() : String(r.date || ''),
        description: r.description,
        category: r.category,
        type: r.type,
        currency: r.currency,
        ...(r.data || {}),
    }));
    const budgetRes = await database_1.db.query(`SELECT * FROM budgets WHERE user_id = $1`, [userId]);
    const budgets = budgetRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        amount: parseFloat(r.amount || '0'),
        category: r.category,
        period: r.period,
        ...(r.data || {}),
    }));
    const goalRes = await database_1.db.query(`SELECT * FROM financial_goals WHERE user_id = $1`, [userId]);
    const financialGoals = goalRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        amount: parseFloat(r.target_amount || '0'),
        targetAmount: parseFloat(r.target_amount || '0'),
        currentAmount: parseFloat(r.current_amount || '0'),
        currency: r.currency,
        ...(r.data || {}),
    }));
    const recRes = await database_1.db.query(`SELECT * FROM recurring_transactions WHERE user_id = $1`, [userId]);
    const recurringTransactions = recRes.rows.map(r => ({
        id: r.id,
        accountId: r.account_id,
        amount: parseFloat(r.amount || '0'),
        frequency: r.frequency,
        startDate: typeof r.start_date === 'object' && r.start_date instanceof Date ? r.start_date.toISOString() : String(r.start_date || ''),
        description: r.description,
        ...(r.data || {}),
    }));
    const taskRes = await database_1.db.query(`SELECT * FROM tasks WHERE user_id = $1`, [userId]);
    const tasks = taskRes.rows.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status,
        dueDate: typeof r.due_date === 'object' && r.due_date instanceof Date ? r.due_date.toISOString() : String(r.due_date || ''),
        priority: r.priority,
        ...(r.data || {}),
    }));
    return {
        ...profileData,
        accounts,
        transactions,
        budgets,
        financialGoals,
        recurringTransactions,
        tasks,
        lastUpdatedAt: profileRow?.last_updated_at ? new Date(profileRow.last_updated_at).toISOString() : new Date().toISOString(),
    };
}
/**
 * Saves and synchronizes normalized relational data tables for a user.
 */
async function syncFinancialDataToRelational(userId, incomingData, isPartial = false) {
    const currentData = await fetchFinancialDataFromRelational(userId);
    const nextData = isPartial ? { ...currentData, ...incomingData } : { ...incomingData };
    const client = await database_1.db.connect();
    try {
        await client.query('BEGIN');
        // Accounts
        if (Array.isArray(nextData.accounts)) {
            await client.query(`DELETE FROM accounts WHERE user_id = $1`, [userId]);
            for (const acc of nextData.accounts) {
                if (!acc.id)
                    continue;
                const { id, name, type, balance, currency, ...rest } = acc;
                await client.query(`INSERT INTO accounts (id, user_id, name, type, balance, currency, data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, userId, name || 'Account', type || 'Checking', balance || 0, currency || 'EUR', JSON.stringify(rest)]);
            }
        }
        // Transactions
        if (Array.isArray(nextData.transactions)) {
            await client.query(`DELETE FROM transactions WHERE user_id = $1`, [userId]);
            for (const tx of nextData.transactions) {
                if (!tx.id)
                    continue;
                const { id, accountId, amount, date, description, category, type, currency, ...rest } = tx;
                await client.query(`INSERT INTO transactions (id, user_id, account_id, amount, date, description, category, type, currency, data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
                    id,
                    userId,
                    accountId || null,
                    amount || 0,
                    date || new Date().toISOString(),
                    description || '',
                    category || 'Uncategorized',
                    type || 'expense',
                    currency || 'EUR',
                    JSON.stringify(rest),
                ]);
            }
        }
        // Budgets
        if (Array.isArray(nextData.budgets)) {
            await client.query(`DELETE FROM budgets WHERE user_id = $1`, [userId]);
            for (const b of nextData.budgets) {
                if (!b.id)
                    continue;
                const { id, name, amount, category, period, ...rest } = b;
                await client.query(`INSERT INTO budgets (id, user_id, name, amount, category, period, data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, userId, name || 'Budget', amount || 0, category || 'All', period || 'Monthly', JSON.stringify(rest)]);
            }
        }
        // Financial Goals
        if (Array.isArray(nextData.financialGoals)) {
            await client.query(`DELETE FROM financial_goals WHERE user_id = $1`, [userId]);
            for (const g of nextData.financialGoals) {
                if (!g.id)
                    continue;
                const { id, name, targetAmount, currentAmount, currency, amount, ...rest } = g;
                const target = targetAmount ?? amount ?? 0;
                await client.query(`INSERT INTO financial_goals (id, user_id, name, target_amount, current_amount, currency, data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, userId, name || 'Goal', target, currentAmount || 0, currency || 'EUR', JSON.stringify(rest)]);
            }
        }
        // Recurring Transactions
        if (Array.isArray(nextData.recurringTransactions)) {
            await client.query(`DELETE FROM recurring_transactions WHERE user_id = $1`, [userId]);
            for (const r of nextData.recurringTransactions) {
                if (!r.id)
                    continue;
                const { id, accountId, amount, frequency, startDate, description, ...rest } = r;
                await client.query(`INSERT INTO recurring_transactions (id, user_id, account_id, amount, frequency, start_date, description, data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                    id,
                    userId,
                    accountId || null,
                    amount || 0,
                    frequency || 'Monthly',
                    startDate || new Date().toISOString(),
                    description || '',
                    JSON.stringify(rest),
                ]);
            }
        }
        // Tasks
        if (Array.isArray(nextData.tasks)) {
            await client.query(`DELETE FROM tasks WHERE user_id = $1`, [userId]);
            for (const t of nextData.tasks) {
                if (!t.id)
                    continue;
                const { id, title, status, dueDate, priority, ...rest } = t;
                await client.query(`INSERT INTO tasks (id, user_id, title, status, due_date, priority, data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, userId, title || 'Task', status || 'pending', dueDate || null, priority || 'medium', JSON.stringify(rest)]);
            }
        }
        // Save auxiliary profile fields into user_financial_profiles
        const nextUpdatedAt = new Date().toISOString();
        const profilePayload = { ...nextData };
        delete profilePayload.accounts;
        delete profilePayload.transactions;
        delete profilePayload.budgets;
        delete profilePayload.financialGoals;
        delete profilePayload.recurringTransactions;
        delete profilePayload.tasks;
        delete profilePayload.lastUpdatedAt;
        await client.query(`INSERT INTO user_financial_profiles (user_id, last_updated_at, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id)
             DO UPDATE SET last_updated_at = EXCLUDED.last_updated_at, data = EXCLUDED.data`, [userId, nextUpdatedAt, JSON.stringify(profilePayload)]);
        await client.query('COMMIT');
        return fetchFinancialDataFromRelational(userId);
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
/**
 * Native PostgreSQL database-level aggregation: computes category totals directly in SQL.
 */
async function getCategoryTotalsSql(userId, options) {
    let sql = `
        SELECT category, SUM(amount)::FLOAT as total, COUNT(*)::INT as count
        FROM transactions
        WHERE user_id = $1
    `;
    const params = [userId];
    if (options?.startDate) {
        params.push(options.startDate);
        sql += ` AND date >= $${params.length}`;
    }
    if (options?.endDate) {
        params.push(options.endDate);
        sql += ` AND date <= $${params.length}`;
    }
    sql += ` GROUP BY category ORDER BY total DESC`;
    const res = await database_1.db.query(sql, params);
    return res.rows.map(r => ({
        category: r.category || 'Uncategorized',
        total: parseFloat(r.total || '0'),
        count: parseInt(r.count || '0', 10),
    }));
}
/**
 * Fine-grained collection item creation / upsert directly in relational table.
 */
async function addOrUpdateRelationalItem(userId, collection, item) {
    const currentData = await fetchFinancialDataFromRelational(userId);
    let items = Array.isArray(currentData[collection]) ? [...currentData[collection]] : [];
    const itemId = item.id;
    if (!itemId) {
        items.push(item);
    }
    else {
        const idx = items.findIndex((i) => i.id === itemId);
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...item };
        }
        else {
            items.push(item);
        }
    }
    return syncFinancialDataToRelational(userId, { [collection]: items }, true);
}
/**
 * Fine-grained collection item deletion directly from relational table.
 */
async function removeRelationalItem(userId, collection, itemId) {
    const currentData = await fetchFinancialDataFromRelational(userId);
    let items = Array.isArray(currentData[collection]) ? [...currentData[collection]] : [];
    items = items.filter((i) => i && i.id !== itemId);
    return syncFinancialDataToRelational(userId, { [collection]: items }, true);
}
/**
 * Applies an RFC 6902 JSON Patch to relational database state.
 */
async function applyJsonPatchToRelational(userId, patchOps) {
    const currentData = await fetchFinancialDataFromRelational(userId);
    const patchRes = (0, patch_1.applyJsonPatch)(currentData, patchOps);
    if (!patchRes.success || !patchRes.doc) {
        return { success: false, error: patchRes.error || 'Failed to apply JSON patch.' };
    }
    const updated = await syncFinancialDataToRelational(userId, patchRes.doc, false);
    return { success: true, doc: updated };
}
