"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("./middleware");
const database_1 = require("./database");
const ENABLE_BANKING_API = process.env.ENABLE_BANKING_API || 'https://api.enablebanking.com';
const DEFAULT_REDIRECT = process.env.ENABLE_BANKING_REDIRECT_URL || 'http://localhost:5173/enable-banking/callback';
class EnableBankingClient {
    constructor(applicationId, clientCertificate) {
        this.applicationId = applicationId;
        this.clientCertificate = clientCertificate;
    }
    getFormattedKey() {
        let key = this.clientCertificate.trim();
        // Simple heuristic to fix common copy-paste issues where newlines are lost or escaped
        if (!key.includes('\n') && key.includes('BEGIN PRIVATE KEY')) {
            // If it looks like a one-liner but has headers, try to split it
            // This handles the case where \n literals might be present or just spaces
            key = key.replace(/\\n/g, '\n')
                .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
        }
        return key;
    }
    generateJwt() {
        const now = Math.floor(Date.now() / 1000);
        const key = this.getFormattedKey();
        return jsonwebtoken_1.default.sign({
            iss: 'enablebanking.com',
            aud: 'api.enablebanking.com',
            iat: now,
            exp: now + 3600,
        }, key, {
            algorithm: 'RS256',
            keyid: this.applicationId,
        });
    }
    async request(path, init = {}) {
        const token = this.generateJwt();
        const url = `${ENABLE_BANKING_API}${path}`;
        const response = await fetch(url, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...(init.sessionId ? { 'Session-ID': init.sessionId } : {}),
                ...(init.headers || {}),
            },
        });
        if (!response.ok) {
            const text = await response.text();
            // Throw with status code info if possible to help upstream handling
            throw new Error(`Enable Banking request failed (${response.status}): ${text || response.statusText}`);
        }
        return (await response.json());
    }
    getAspsps(countryCode) {
        const params = new URLSearchParams();
        params.set('country', countryCode);
        return this.request(`/aspsps?${params.toString()}`);
    }
    startAuthorization({ aspspId, aspspName, countryCode, redirectUrl, state, }) {
        if (!aspspId && !aspspName) {
            throw new Error('aspspId or aspspName is required');
        }
        return this.request(`/auth`, {
            method: 'POST',
            body: JSON.stringify({
                aspsp: {
                    country: countryCode,
                    ...(aspspId ? { id: aspspId } : {}),
                    ...(aspspName ? { name: aspspName } : {}),
                },
                redirect_url: redirectUrl,
                access: { valid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString() },
                state,
            }),
        });
    }
    createSession(code) {
        return this.request(`/sessions`, {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    }
    getSession(sessionId) {
        return this.request(`/sessions/${encodeURIComponent(sessionId)}`);
    }
    getAccountBalances(accountId, sessionId) {
        return this.request(`/accounts/${encodeURIComponent(accountId)}/balances`, { sessionId });
    }
    getAccountDetails(accountId, sessionId) {
        return this.request(`/accounts/${encodeURIComponent(accountId)}/details`, { sessionId });
    }
    getAccountTransactions({ accountId, dateFrom, continuationKey, sessionId, }) {
        const params = new URLSearchParams();
        params.set('transaction_status', 'BOOK');
        if (dateFrom)
            params.set('date_from', dateFrom);
        if (continuationKey)
            params.set('continuation_key', continuationKey);
        return this.request(`/accounts/${encodeURIComponent(accountId)}/transactions?${params.toString()}`, { sessionId });
    }
}
const router = express_1.default.Router();
router.post('/aspsps', middleware_1.authenticateToken, async (req, res) => {
    try {
        const { applicationId, clientCertificate, countryCode } = req.body;
        if (!applicationId || !clientCertificate || !countryCode) {
            return res.status(400).json({ message: 'applicationId, clientCertificate and countryCode are required' });
        }
        const client = new EnableBankingClient(applicationId, clientCertificate);
        const data = await client.getAspsps(countryCode);
        res.json(data);
    }
    catch (error) {
        console.error('Failed to fetch ASPSPs', error);
        res.status(500).json({ message: error?.message || 'Unable to fetch banks' });
    }
});
router.post('/accounts/:accountId/details', middleware_1.authenticateToken, async (req, res) => {
    try {
        const { applicationId, clientCertificate, sessionId } = req.body;
        const { accountId } = req.params;
        if (!applicationId || !clientCertificate || !sessionId) {
            return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
        }
        const client = new EnableBankingClient(applicationId, clientCertificate);
        const details = await client.getAccountDetails(accountId, sessionId);
        res.json(details);
    }
    catch (error) {
        console.error('Failed to fetch account details', error);
        res.status(500).json({ message: error?.message || 'Unable to fetch account details' });
    }
});
router.post('/authorize', middleware_1.authenticateToken, async (req, res) => {
    try {
        const { applicationId, clientCertificate, countryCode, aspspName, aspspId, state } = req.body;
        if (!applicationId || !clientCertificate || !countryCode || (!aspspName && !aspspId)) {
            return res.status(400).json({ message: 'applicationId, clientCertificate, countryCode and aspspId/aspspName are required' });
        }
        const client = new EnableBankingClient(applicationId, clientCertificate);
        const forwardedProto = (Array.isArray(req.headers['x-forwarded-proto']) ? req.headers['x-forwarded-proto'][0] : req.headers['x-forwarded-proto'])?.split(',')[0]?.trim();
        const protocol = forwardedProto || req.protocol;
        const forwardedHost = (Array.isArray(req.headers['x-forwarded-host']) ? req.headers['x-forwarded-host'][0] : req.headers['x-forwarded-host'])?.split(',')[0]?.trim();
        const host = forwardedHost || req.get('host');
        const redirectUrl = process.env.ENABLE_BANKING_REDIRECT_URL ||
            (host ? `${protocol}://${host.replace(/\s/g, '')}/enable-banking/callback` : DEFAULT_REDIRECT);
        if (!process.env.ENABLE_BANKING_REDIRECT_URL && !host) {
            console.warn('Enable Banking redirect URL falling back to default because host is missing');
        }
        const data = await client.startAuthorization({ aspspId, aspspName, countryCode, redirectUrl, state });
        res.json({ authorizationUrl: data.url, authorizationId: data.authorization_id, redirectUrl });
    }
    catch (error) {
        console.error('Failed to start authorization', error);
        res.status(500).json({ message: error?.message || 'Unable to start authorization' });
    }
});
router.post('/session', middleware_1.authenticateToken, async (req, res) => {
    try {
        const { applicationId, clientCertificate, code } = req.body;
        if (!applicationId || !clientCertificate || !code) {
            return res.status(400).json({ message: 'applicationId, clientCertificate and code are required' });
        }
        const client = new EnableBankingClient(applicationId, clientCertificate);
        const session = await client.createSession(code);
        res.json(session);
    }
    catch (error) {
        console.error('Failed to create session', error);
        res.status(500).json({ message: error?.message || 'Unable to create session' });
    }
});
router.post('/session/fetch', middleware_1.authenticateToken, async (req, res) => {
    try {
        const { applicationId, clientCertificate, sessionId } = req.body;
        if (!applicationId || !clientCertificate || !sessionId) {
            return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
        }
        const client = new EnableBankingClient(applicationId, clientCertificate);
        const session = await client.getSession(sessionId);
        res.json(session);
    }
    catch (error) {
        console.error('Failed to fetch session', error);
        res.status(500).json({ message: error?.message || 'Unable to fetch session' });
    }
});
router.post('/accounts/:accountId/balances', middleware_1.authenticateToken, async (req, res) => {
    try {
        const { applicationId, clientCertificate, sessionId } = req.body;
        const { accountId } = req.params;
        if (!applicationId || !clientCertificate || !sessionId) {
            return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
        }
        const client = new EnableBankingClient(applicationId, clientCertificate);
        const balances = await client.getAccountBalances(accountId, sessionId);
        res.json(balances);
    }
    catch (error) {
        console.error('Failed to fetch balances', error);
        res.status(500).json({ message: error?.message || 'Unable to fetch balances' });
    }
});
router.post('/accounts/:accountId/transactions', middleware_1.authenticateToken, async (req, res) => {
    try {
        const { applicationId, clientCertificate, dateFrom, continuationKey, sessionId } = req.body;
        const { accountId } = req.params;
        if (!applicationId || !clientCertificate || !sessionId) {
            return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
        }
        const client = new EnableBankingClient(applicationId, clientCertificate);
        const transactions = await client.getAccountTransactions({ accountId, dateFrom, continuationKey, sessionId });
        res.json(transactions);
    }
    catch (error) {
        console.error('Failed to fetch transactions', error);
        res.status(500).json({ message: error?.message || 'Unable to fetch transactions' });
    }
});
router.post('/pending', middleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const connection = req.body?.connection;
        if (!userId || !connection?.id) {
            return res.status(400).json({ message: 'connection with id is required' });
        }
        const selectSql = `SELECT data FROM financial_data WHERE user_id = $1`;
        const upsertSql = `
        INSERT INTO financial_data (user_id, data)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET data = EXCLUDED.data;
    `;
        const existing = await database_1.db.query(selectSql, [userId]);
        const currentData = existing.rows?.[0]?.data || {};
        const pendingConnections = {
            ...(currentData.enableBankingPendingConnections || {}),
            [connection.id]: connection,
        };
        const mergedData = { ...currentData, enableBankingPendingConnections: pendingConnections };
        await database_1.db.query(upsertSql, [userId, mergedData]);
        res.json({ message: 'Pending connection stored' });
    }
    catch (error) {
        console.error('Failed to store pending Enable Banking connection', error);
        res.status(500).json({ message: error?.message || 'Unable to store pending connection' });
    }
});
router.get('/pending/:connectionId', middleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { connectionId } = req.params;
        if (!userId || !connectionId) {
            return res.status(400).json({ message: 'connectionId is required' });
        }
        const selectSql = `SELECT data FROM financial_data WHERE user_id = $1`;
        const existing = await database_1.db.query(selectSql, [userId]);
        const currentData = existing.rows?.[0]?.data || {};
        const pendingConnections = currentData.enableBankingPendingConnections || {};
        const connection = pendingConnections[connectionId];
        if (!connection) {
            return res.status(404).json({ message: 'Pending connection not found' });
        }
        res.json({ connection });
    }
    catch (error) {
        console.error('Failed to fetch pending Enable Banking connection', error);
        res.status(500).json({ message: error?.message || 'Unable to fetch pending connection' });
    }
});
router.delete('/pending/:connectionId', middleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { connectionId } = req.params;
        if (!userId || !connectionId) {
            return res.status(400).json({ message: 'connectionId is required' });
        }
        const selectSql = `SELECT data FROM financial_data WHERE user_id = $1`;
        const upsertSql = `
        INSERT INTO financial_data (user_id, data)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET data = EXCLUDED.data;
    `;
        const existing = await database_1.db.query(selectSql, [userId]);
        const currentData = existing.rows?.[0]?.data || {};
        const pendingConnections = { ...(currentData.enableBankingPendingConnections || {}) };
        if (pendingConnections[connectionId]) {
            delete pendingConnections[connectionId];
            const mergedData = { ...currentData, enableBankingPendingConnections: pendingConnections };
            await database_1.db.query(upsertSql, [userId, mergedData]);
        }
        res.json({ message: 'Pending connection removed' });
    }
    catch (error) {
        console.error('Failed to remove pending Enable Banking connection', error);
        res.status(500).json({ message: error?.message || 'Unable to remove pending connection' });
    }
});
exports.default = router;
