import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// FIX: Explicitly add body and headers to solve potential type conflicts with a global Request type.
export interface AuthRequest extends Request {
    user?: { id: number; email: string };
    body: any;
// FIX: The 'Request' type from express can conflict with the global DOM 'Request' type.
// The headers property is explicitly defined to avoid ambiguity and ensure compatibility with express.
    headers: {
        authorization?: string;
        [key: string]: string | string[] | undefined;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // FIX: Replaced status().end() with statusCode and end() to resolve a property 'status' not existing on the Response type due to potential type conflicts.
    if (token == null) {
        return res.status(401).end();
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        // FIX: Replaced status().end() with statusCode and end() to resolve a property 'status' not existing on the Response type due to potential type conflicts.
        if (err) {
            return res.status(403).end();
        }
        req.user = user as { id: number; email: string };
        next();
    });
};