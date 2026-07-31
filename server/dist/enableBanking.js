"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("./middleware");
const crypto_1 = require("./crypto");
const dbNorm_1 = require("./dbNorm");
const ENABLE_BANKING_API = process.env.ENABLE_BANKING_API || 'https://api.enablebanking.com';
const DEFAULT_REDIRECT = process.env.ENABLE_BANKING_REDIRECT_URL || 'http://localhost:5173/enable-banking/callback';
function getEnableBankingCredentials(body = {}) {
    let envAppId = process.env.ENABLE_BANKING_APPLICATION_ID?.trim();
    let envCert = (process.env.ENABLE_BANKING_CLIENT_CERTIFICATE || process.env.ENABLE_BANKING_PRIVATE_KEY)?.trim();
    let applicationId = envAppId || body?.applicationId?.trim();
    let certCandidate = body?.clientCertificate?.trim();
    if (!certCandidate || certCandidate === '[SERVER_CONFIGURED_ENCRYPTED]') {
        certCandidate = body?.encryptedClientCertificate?.trim();
    }
    let clientCertificate = envCert || certCandidate;
    if (applicationId && ((applicationId.startsWith('"') && applicationId.endsWith('"')) || (applicationId.startsWith("'") && applicationId.endsWith("'")))) {
        applicationId = applicationId.slice(1, -1).trim();
    }
    if (clientCertificate && ((clientCertificate.startsWith('"') && clientCertificate.endsWith('"')) || (clientCertificate.startsWith("'") && clientCertificate.endsWith("'")))) {
        clientCertificate = clientCertificate.slice(1, -1).trim();
    }
    if (clientCertificate && clientCertificate.includes(':') && !clientCertificate.includes('BEGIN')) {
        clientCertificate = (0, crypto_1.decryptSecret)(clientCertificate);
    }
    if (!applicationId || !clientCertificate || clientCertificate === '[SERVER_CONFIGURED_ENCRYPTED]') {
        throw new Error('Missing Enable Banking application credentials. Please configure Application ID and Client Certificate in Credentials Setup or on the server.');
    }
    return { applicationId, clientCertificate };
}
class EnableBankingClient {
    constructor(applicationId, clientCertificate) {
        this.applicationId = applicationId;
        this.clientCertificate = clientCertificate;
    }
    getFormattedKey() {
        let key = this.clientCertificate.trim();
        if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
            key = key.slice(1, -1).trim();
        }
        key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (!key.includes('\n')) {
            const match = key.match(/(-----BEGIN [A-Z0-9\s_-]+-----)(.*?)(-----END [A-Z0-9\s_-]+-----)/i);
            if (match) {
                const header = match[1].trim();
                const body = match[2].replace(/\s+/g, '');
                const footer = match[3].trim();
                const lines = body.match(/.{1,64}/g) || [];
                key = [header, ...lines, footer].join('\n');
            }
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
        const { countryCode } = req.body;
        if (!countryCode) {
            return res.status(400).json({ message: 'countryCode is required' });
        }
        const { applicationId, clientCertificate } = getEnableBankingCredentials(req.body);
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
        const { sessionId } = req.body;
        const { accountId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }
        const { applicationId, clientCertificate } = getEnableBankingCredentials(req.body);
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
        const { countryCode, aspspName, aspspId, state } = req.body;
        if (!countryCode || (!aspspName && !aspspId)) {
            return res.status(400).json({ message: 'countryCode and aspspId/aspspName are required' });
        }
        const { applicationId, clientCertificate } = getEnableBankingCredentials(req.body);
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
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ message: 'code is required' });
        }
        const { applicationId, clientCertificate } = getEnableBankingCredentials(req.body);
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
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }
        const { applicationId, clientCertificate } = getEnableBankingCredentials(req.body);
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
        const { sessionId } = req.body;
        const { accountId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }
        const { applicationId, clientCertificate } = getEnableBankingCredentials(req.body);
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
        const { dateFrom, continuationKey, sessionId } = req.body;
        const { accountId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }
        const { applicationId, clientCertificate } = getEnableBankingCredentials(req.body);
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
        const sanitizedConn = (0, crypto_1.sanitizeConnection)(connection);
        const currentData = await (0, dbNorm_1.fetchFinancialDataFromRelational)(userId);
        const pendingConnections = {
            ...(currentData.enableBankingPendingConnections || {}),
            [connection.id]: sanitizedConn,
        };
        await (0, dbNorm_1.syncFinancialDataToRelational)(userId, { enableBankingPendingConnections: pendingConnections }, true);
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
        const currentData = await (0, dbNorm_1.fetchFinancialDataFromRelational)(userId);
        const pendingConnections = currentData.enableBankingPendingConnections || {};
        const connection = pendingConnections[connectionId];
        if (!connection) {
            return res.status(404).json({ message: 'Pending connection not found' });
        }
        res.json({ connection: (0, crypto_1.sanitizeConnection)(connection) });
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
        const currentData = await (0, dbNorm_1.fetchFinancialDataFromRelational)(userId);
        const pendingConnections = { ...(currentData.enableBankingPendingConnections || {}) };
        if (pendingConnections[connectionId]) {
            delete pendingConnections[connectionId];
            await (0, dbNorm_1.syncFinancialDataToRelational)(userId, { enableBankingPendingConnections: pendingConnections }, true);
        }
        res.json({ message: 'Pending connection removed' });
    }
    catch (error) {
        console.error('Failed to remove pending Enable Banking connection', error);
        res.status(500).json({ message: error?.message || 'Unable to remove pending connection' });
    }
});
exports.default = router;
