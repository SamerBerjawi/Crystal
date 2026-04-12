import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// FIX: Explicitly add body and headers to solve potential type conflicts with a global Request type.
// We extend ExpressRequest specifically to ensure we get params, query, etc.
export interface AuthRequest extends ExpressRequest {
    user?: { id: number; email: string };
    body: any;
// FIX: The 'Request' type from express can conflict with the global DOM 'Request' type.
// The headers property is explicitly defined to avoid ambiguity and ensure compatibility with express.
    headers: {
        authorization?: string;
        [key: string]: string | string[] | undefined;
    };
}

export const authenticateToken = (req: AuthRequest, res: ExpressResponse, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // FIX: Replaced direct property access (`.statusCode`, `.end()`) with `res.status().end()` to correctly use the Express Response object's methods and fix type errors.
        return res.status(401).end();
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            // FIX: Replaced direct property access (`.statusCode`, `.end()`) with `res.status().end()` to correctly use the Express Response object's methods and fix type errors.
            return res.status(403).end();
        }
        req.user = user as { id: number; email: string };
        next();
    });
};
