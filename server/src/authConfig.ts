import { randomBytes, randomUUID } from 'crypto';
import { Response } from 'express';

const PLACEHOLDER_SECRETS = new Set([
    'your_jwt_secret_key_here',
    'a-very-secret-and-secure-key-that-you-should-change',
    'crystal_default_jwt_secret_dev_key',
    'changeme',
]);

const resolveJwtSecret = (): string => {
    const configured = process.env.JWT_SECRET?.trim();
    if (process.env.NODE_ENV === 'production') {
        if (!configured || configured.length < 16 || PLACEHOLDER_SECRETS.has(configured)) {
            throw new Error('JWT_SECRET must be set to a unique random value of at least 16 characters in production (e.g. `openssl rand -hex 32`).');
        }
        return configured;
    }
    if (configured) return configured;
    // Development without JWT_SECRET: a random per-process secret (sessions end on restart) rather than a published default.
    console.warn('JWT_SECRET is not set; using a random secret for this process. Sessions will not survive a restart.');
    return randomBytes(32).toString('hex');
};

const configuredSecret = resolveJwtSecret();

export const JWT_SECRET = configuredSecret;
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'crystal_session';
export const SESSION_DURATION_MS = Number(process.env.SESSION_DURATION_MS || 1000 * 60 * 60 * 12);
export const PASSWORD_HASH_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

const secureCookies = process.env.AUTH_COOKIE_SECURE !== undefined
    ? process.env.AUTH_COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
const cookieSameSite = (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase() as 'lax' | 'strict' | 'none';

export const buildSessionExpiry = () => new Date(Date.now() + SESSION_DURATION_MS);

export const issueSessionId = () => randomUUID();

export const setAuthCookie = (res: Response, token: string, expiresAt: Date) => {
    res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: cookieSameSite,
        expires: expiresAt,
        path: '/',
    });
};

export const clearAuthCookie = (res: Response) => {
    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: cookieSameSite,
        path: '/',
    });
};

/** ALLOW_REGISTRATION=false turns self-registration off (default: on). */
export const isRegistrationEnabled = (): boolean =>
    String(process.env.ALLOW_REGISTRATION ?? 'true').trim().toLowerCase() !== 'false';
