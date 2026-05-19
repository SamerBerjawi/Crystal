import { randomUUID } from 'crypto';
import { Response } from 'express';

const configuredSecret = process.env.JWT_SECRET?.trim() || 'development-secret-key-12345';

export const JWT_SECRET = configuredSecret;
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'crystal_session';
export const SESSION_DURATION_MS = Number(process.env.SESSION_DURATION_MS || 1000 * 60 * 60 * 12);
export const PASSWORD_HASH_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

const secureCookies = true; // Enforce Secure cookies
const cookieSameSite = 'strict'; // Enforce SameSite=Strict

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
