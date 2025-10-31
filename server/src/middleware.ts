// FIX: Consolidate express imports into a single statement to resolve type conflicts and errors related to Request and Response objects.
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// FIX: Extended express.Request to ensure correct type properties.
// FIX: Extend the imported Request type.
export interface AuthRequest extends Request {
    user?: any;
}

// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response and AuthRequest types.
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response and AuthRequest types.
export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user.role !== 'Administrator') {
        return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
    next();
};
