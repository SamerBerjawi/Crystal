import crypto from 'crypto';
import express, { NextFunction, Response } from 'express';
import { z } from 'zod';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';
import { createRateLimiter } from './rateLimit';

/*
 * Scoped API tokens: read-only, revocable, optionally expiring. Only a SHA-256 hash is stored, and the token is
 * shown once when it is made. They work on /api/v1 and nowhere else, and they are never JWTs, so the session
 * middleware refuses them everywhere else.
 */

export const SCOPES = ['summary', 'transactions', 'investments', 'planning'] as const;
export type Scope = typeof SCOPES[number];

export const TOKEN_PREFIX = 'cry_';
const MAX_ACTIVE_TOKENS = 20;

export const generateToken = () => `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** The expiry for a new token, or null for none. */
export const expiryFor = (days: number | null | undefined, now = new Date()): Date | null =>
    days ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null;

/** Why a stored token can't be used, or null when it can. */
export const tokenProblem = (row: { revoked_at: unknown; expires_at: unknown; scopes: unknown }, scope: Scope, now = new Date()): string | null => {
    if (row.revoked_at) return 'This token was revoked.';
    if (row.expires_at && new Date(row.expires_at as string).getTime() <= now.getTime()) return 'This token has expired.';
    if (!Array.isArray(row.scopes) || !row.scopes.includes(scope)) return `This token cannot read ${scope}.`;
    return null;
};

const apiRateLimiter = createRateLimiter({
    namespace: 'api-token',
    windowMs: 60 * 1000,
    maxAttempts: 300,
    blockMs: 30 * 1000,
    message: 'Too many requests. Slow down.',
    key: req => req.ip || 'unknown',
});

/** Lets a request through when it carries a valid API token with the scope. */
export const authenticateApiToken = (scope: Scope) => [apiRateLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token.startsWith(TOKEN_PREFIX)) return res.status(401).json({ message: 'An API token is required.' });
    try {
        const row = (await db.query(
            `SELECT t.id, t.user_id, t.scopes, t.expires_at, t.revoked_at, u.email
             FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1`,
            [hashToken(token)],
        )).rows?.[0];
        if (!row) return res.status(401).json({ message: 'That token is not valid.' });
        const problem = tokenProblem(row, scope);
        if (problem) return res.status(403).json({ message: problem });
        await db.query(`UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 minute')`, [row.id]);
        req.user = { id: row.user_id, email: row.email, sessionId: `token:${row.id}` };
        next();
    } catch (error) {
        console.error('API token check failed', error);
        res.status(500).json({ message: 'Unable to check the token.' });
    }
}];

const router = express.Router();
router.use(authenticateToken);

const createSchema = z.object({
    name: z.string().trim().min(1).max(60),
    scopes: z.array(z.enum(SCOPES)).min(1).max(SCOPES.length),
    expiresInDays: z.number().int().min(1).max(730).nullable().optional(),
});

const view = (row: any) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
});

router.get('/', async (req: AuthRequest, res) => {
    try {
        const rows = (await db.query(`SELECT * FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC`, [req.user!.id])).rows;
        res.json({ tokens: rows.map(view), scopes: SCOPES });
    } catch (error) {
        console.error('Failed to list API tokens', error);
        res.status(500).json({ message: 'Unable to list tokens' });
    }
});

router.post('/', async (req: AuthRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Give the token a name and at least one scope.' });
    try {
        const active = Number((await db.query(
            `SELECT COUNT(*) AS n FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`, [req.user!.id])).rows[0].n);
        if (active >= MAX_ACTIVE_TOKENS) return res.status(400).json({ message: `You can have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.` });
        const token = generateToken();
        const id = crypto.randomUUID();
        const row = (await db.query(
            `INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, scopes, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [id, req.user!.id, parsed.data.name, hashToken(token), token.slice(0, 8), parsed.data.scopes, expiryFor(parsed.data.expiresInDays)],
        )).rows[0];
        // The only time the token is ever sent.
        res.status(201).json({ token, ...view(row) });
    } catch (error) {
        console.error('Failed to create API token', error);
        res.status(500).json({ message: 'Unable to create the token' });
    }
});

router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const result = await db.query(`UPDATE api_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, [req.params.id, req.user!.id]);
        if (!result.rowCount) return res.status(404).json({ message: 'No such token.' });
        res.json({ message: 'Revoked' });
    } catch (error) {
        console.error('Failed to revoke API token', error);
        res.status(500).json({ message: 'Unable to revoke the token' });
    }
});

export default router;
