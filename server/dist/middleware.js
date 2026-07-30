"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("./database");
const authConfig_1 = require("./authConfig");
const parseCookies = (cookieHeader) => {
    const values = {};
    if (!cookieHeader)
        return values;
    cookieHeader.split(';').forEach(part => {
        const [rawName, ...rawValue] = part.trim().split('=');
        if (!rawName)
            return;
        values[rawName] = decodeURIComponent(rawValue.join('=') || '');
    });
    return values;
};
const extractToken = (req) => {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }
    const cookies = parseCookies(req.headers.cookie);
    return cookies[authConfig_1.AUTH_COOKIE_NAME];
};
const authenticateToken = async (req, res, next) => {
    const token = extractToken(req);
    if (token == null) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, authConfig_1.JWT_SECRET);
        if (!payload?.sid || !payload?.id || !payload?.email) {
            return res.status(403).json({ message: 'Invalid session token.' });
        }
        const sessionResult = await database_1.db.query(`SELECT id
             FROM user_sessions
             WHERE id = $1
               AND user_id = $2
               AND revoked_at IS NULL
               AND expires_at > NOW()`, [payload.sid, payload.id]);
        if (sessionResult.rows.length === 0) {
            return res.status(403).json({ message: 'Session expired or revoked.' });
        }
        await database_1.db.query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = $1`, [payload.sid]);
        req.user = { id: payload.id, email: payload.email, sessionId: payload.sid };
        next();
    }
    catch (err) {
        return res.status(403).json({ message: 'Invalid session token.' });
    }
};
exports.authenticateToken = authenticateToken;
