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

    // FIX: Replaced status().end() with sendStatus() to resolve 'status' property not existing on Response type.
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
        // FIX: Replaced status().end() with sendStatus() to resolve 'status' property not existing on Response type.
        if (err) return res.sendStatus(403);
        req.user = user as { id: number; email: string };
        next();
    });
};
