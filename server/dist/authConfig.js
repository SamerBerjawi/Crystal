"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAuthCookie = exports.setAuthCookie = exports.issueSessionId = exports.buildSessionExpiry = exports.PASSWORD_HASH_ROUNDS = exports.SESSION_DURATION_MS = exports.AUTH_COOKIE_NAME = exports.JWT_SECRET = void 0;
const crypto_1 = require("crypto");
const configuredSecret = process.env.JWT_SECRET?.trim();
if (!configuredSecret) {
    throw new Error('JWT_SECRET must be set before starting the server.');
}
exports.JWT_SECRET = configuredSecret;
exports.AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'crystal_session';
exports.SESSION_DURATION_MS = Number(process.env.SESSION_DURATION_MS || 1000 * 60 * 60 * 12);
exports.PASSWORD_HASH_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const secureCookies = true;
const cookieSameSite = 'strict';
const buildSessionExpiry = () => new Date(Date.now() + exports.SESSION_DURATION_MS);
exports.buildSessionExpiry = buildSessionExpiry;
const issueSessionId = () => (0, crypto_1.randomUUID)();
exports.issueSessionId = issueSessionId;
const setAuthCookie = (res, token, expiresAt) => {
    res.cookie(exports.AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        expires: expiresAt,
        path: '/',
    });
};
exports.setAuthCookie = setAuthCookie;
const clearAuthCookie = (res) => {
    res.clearCookie(exports.AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
    });
};
exports.clearAuthCookie = clearAuthCookie;
