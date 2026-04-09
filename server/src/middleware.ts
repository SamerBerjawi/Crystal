import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './database';
import { AUTH_COOKIE_NAME, JWT_SECRET } from './authConfig';

// FIX: Explicitly add body and headers to solve potential type conflicts with a global Request type.
// We extend ExpressRequest specifically to ensure we get params, query, etc.
export interface AuthRequest extends ExpressRequest {
    user?: { id: number; email: string; sessionId: string };
    body: any;
// FIX: The 'Request' type from express can conflict with the global DOM 'Request' type.
// The headers property is explicitly defined to avoid ambiguity and ensure compatibility with express.
    headers: {
        authorization?: string;
        cookie?: string;
        [key: string]: string | string[] | undefined;
    };
}

type SessionTokenPayload = {
    id: number;
    email: string;
    sid: string;
    exp?: number;
};

const parseCookies = (cookieHeader?: string) => {
    const values: Record<string, string> = {};
    if (!cookieHeader) return values;

    cookieHeader.split(';').forEach(part => {
        const [rawName, ...rawValue] = part.trim().split('=');
        if (!rawName) return;
        values[rawName] = decodeURIComponent(rawValue.join('=') || '');
    });

    return values;
};

const extractToken = (req: AuthRequest) => {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    const cookies = parseCookies(req.headers.cookie);
    return cookies[AUTH_COOKIE_NAME];
};

export const authenticateToken = async (req: AuthRequest, res: ExpressResponse, next: NextFunction) => {
    const token = extractToken(req);

    if (token == null) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET) as SessionTokenPayload;
        if (!payload?.sid || !payload?.id || !payload?.email) {
            return res.status(403).json({ message: 'Invalid session token.' });
        }

        const sessionResult = await db.query(
            `SELECT id
             FROM user_sessions
             WHERE id = $1
               AND user_id = $2
               AND revoked_at IS NULL
               AND expires_at > NOW()`,
            [payload.sid, payload.id]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(403).json({ message: 'Session expired or revoked.' });
        }

        await db.query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = $1`, [payload.sid]);

        req.user = { id: payload.id, email: payload.email, sessionId: payload.sid };
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid session token.' });
    }
};
