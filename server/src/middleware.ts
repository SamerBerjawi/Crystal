import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

    // FIX: Replaced sendStatus with status().end() to resolve 'sendStatus' not existing on the Response type due to potential type conflicts.
    if (token == null) return res.status(401).end();

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
        // FIX: Replaced sendStatus with status().end() to resolve 'sendStatus' not existing on the Response type due to potential type conflicts.
        if (err) return res.status(403).end();
        req.user = user as { id: number; email: string };
        next();
    });
};
