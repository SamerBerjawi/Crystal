// FIX: Consolidate express imports into a single statement to resolve type conflicts and errors related to Request and Response objects.
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './database';
import { authMiddleware, AuthRequest } from './middleware';

// FIX: Create router from express instance.
export const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Sign Up
// FIX: Use express.Request and express.Response for route handlers to resolve type errors.
// FIX: Use directly imported Request and Response types.
authRouter.post('/signup', async (req: Request, res: Response) => {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const newUser = await client.query(
                `INSERT INTO users (first_name, last_name, email, password_hash, last_login, profile_picture_url)
                 VALUES ($1, $2, $3, $4, NOW(), $5)
                 RETURNING email, first_name, last_name, role, status, profile_picture_url, is_2fa_enabled, last_login`,
                [firstName, lastName, email, passwordHash, `https://i.pravatar.cc/150?u=${email}`]
            );

            const initialData = {
              accounts: [], transactions: [], investmentTransactions: [], recurringTransactions: [],
              financialGoals: [], budgets: [], tasks: [], warrants: [], scraperConfigs: [],
              importExportHistory: [], incomeCategories: [], expenseCategories: [],
              preferences: {
                  currency: 'EUR (€)', language: 'English (en)', timezone: '(+01:00) Brussels',
                  dateFormat: 'DD/MM/YYYY', defaultPeriod: 'Current Year', defaultAccountOrder: 'Name (A-Z)', country: 'Belgium',
              },
              enableBankingSettings: { autoSyncEnabled: true, syncFrequency: 'daily' },
              billsAndPayments: [],
            };

            await client.query(
                'INSERT INTO financial_data (user_email, data) VALUES ($1, $2)',
                [email, JSON.stringify(initialData)]
            );

            await client.query('COMMIT');

            const user = newUser.rows[0];
            const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

            res.status(201).json({ token, user, financialData: initialData });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ message: 'Error creating user. The email might already be in use.' });
        } finally {
            client.release();
        }

    } catch (err) {
        res.status(500).json({ message: 'Server error during signup.' });
    }
});

// Sign In
// FIX: Use express.Request and express.Response for route handlers to resolve type errors.
// FIX: Use directly imported Request and Response types.
authRouter.post('/signin', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        if (user.status === 'Inactive') {
            return res.status(403).json({ message: 'Your account is inactive.' });
        }

        const dataResult = await pool.query('SELECT data FROM financial_data WHERE user_email = $1', [email]);
        const financialData = dataResult.rows.length > 0 ? dataResult.rows[0].data : {};
        
        await pool.query('UPDATE users SET last_login = NOW() WHERE email = $1', [email]);

        const { password_hash, ...userProfile } = user;
        const token = jwt.sign({ email: userProfile.email, role: userProfile.role }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ token, user: userProfile, financialData });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during signin.' });
    }
});


// Get current user from token
// FIX: Correctly typed req as AuthRequest and res as express.Response to resolve overload mismatch with authMiddleware.
// FIX: Use express.Response for route handlers to resolve type errors.
// FIX: Use directly imported Response type.
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userResult = await pool.query('SELECT email, first_name, last_name, role, status, profile_picture_url, is_2fa_enabled, last_login FROM users WHERE email = $1', [req.user.email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        const dataResult = await pool.query('SELECT data FROM financial_data WHERE user_email = $1', [req.user.email]);
        const financialData = dataResult.rows.length > 0 ? dataResult.rows[0].data : {};

        res.json({ user: userResult.rows[0], financialData });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
