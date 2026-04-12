import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';
import { AUTH_COOKIE_NAME, clearAuthCookie, buildSessionExpiry, issueSessionId, JWT_SECRET, PASSWORD_HASH_ROUNDS, setAuthCookie } from './authConfig';
import { createRateLimiter } from './rateLimit';

const router = express.Router();

const loginRateLimiter = createRateLimiter({
    namespace: 'login',
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 15 * 60 * 1000,
    message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
    key: req => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown';
        return `${req.ip}:${email}`;
    },
});

/**
 * Performs a login for a given user ID. Fetches user data, financial data,
 * updates last_login, and returns a complete authentication payload.
 * @param userId The ID of the user to log in.
 * @param email The email of the user.
 * @returns A promise that resolves to the authentication payload.
 */
async function performLogin(userId: number, email: string) {
    const dataSql = `SELECT data FROM financial_data WHERE user_id = $1`;
    const dataResult = await db.query(dataSql, [userId]);

    const lastLogin = new Date().toISOString();
    const userUpdateRes = await db.query(`UPDATE users SET last_login = $1 WHERE id = $2 RETURNING *`, [lastLogin, userId]);
    const user = userUpdateRes.rows[0];
    const sessionId = issueSessionId();
    const sessionExpiresAt = buildSessionExpiry();
    await db.query(
        `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [sessionId, user.id, sessionExpiresAt.toISOString()]
    );

    const token = jwt.sign({ id: user.id, email: user.email, sid: sessionId }, JWT_SECRET, {
        expiresIn: Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000),
    });

    const mappedUser = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        profilePictureUrl: user.profile_picture_url,
        phone: user.phone,
        address: user.address,
        role: user.role,
        is2FAEnabled: user.is_2fa_enabled,
        status: user.status,
        lastLogin: lastLogin
    };

    const financialData = dataResult.rows[0] ? dataResult.rows[0].data : {};
    return { token, sessionExpiresAt, user: mappedUser, financialData };
}


// Register
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        return res.status(400).json({ message: 'All fields are required' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const userExistsResult = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userExistsResult.rows.length > 0) {
            await client.query('ROLLBACK');
            // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
            return res.status(409).json({ message: 'Email already in use.' });
        }
        
        const hashedPassword = bcrypt.hashSync(password, PASSWORD_HASH_ROUNDS);
        const profilePic = `https://i.pravatar.cc/150?u=${email}`;
        
        const userSql = `INSERT INTO users (first_name, last_name, email, password, profile_picture_url, last_login) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, email`;
        const userResult = await client.query(userSql, [firstName, lastName, email.toLowerCase(), hashedPassword, profilePic]);
        const newUser = userResult.rows[0];
        
        const dataSql = `INSERT INTO financial_data (user_id, data) VALUES ($1, $2)`;
        await client.query(dataSql, [newUser.id, '{}']);

        await client.query('COMMIT');
        
        // After successful registration, perform login to get consistent data
        const loginData = await performLogin(newUser.id, newUser.email);
        setAuthCookie(res, loginData.token, loginData.sessionExpiresAt);
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        res.status(201).json({ user: loginData.user, financialData: loginData.financialData });

    } catch (err) {
        // Make sure to rollback before logging the error
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('Error during rollback:', rollbackErr);
        }
        console.error('Error during registration:', err);
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        res.status(500).json({ message: 'Failed to register user.' });
    } finally {
        client.release();
    }
});

// Login
router.post('/login', loginRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const userSql = `SELECT id, email, password FROM users WHERE email = $1`;
        const userResult = await db.query(userSql, [email.toLowerCase()]);
        const user = userResult.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const loginData = await performLogin(user.id, user.email);
        setAuthCookie(res, loginData.token, loginData.sessionExpiresAt);
        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json({ user: loginData.user, financialData: loginData.financialData });

    } catch (err) {
        console.error('Error during login:', err);
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        res.status(500).json({ message: 'Server error during login.' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const rawCookie = req.headers.cookie || '';
        const sessionCookie = rawCookie
            .split(';')
            .map(part => part.trim())
            .find(part => part.startsWith(`${AUTH_COOKIE_NAME}=`))
            ?.split('=')
            .slice(1)
            .join('=');

        if (sessionCookie) {
            const payload = jwt.verify(decodeURIComponent(sessionCookie), JWT_SECRET) as { sid?: string };
            if (payload?.sid) {
                await db.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`, [payload.sid]);
            }
        }
    } catch (err) {
        console.error('Error during logout:', err);
    } finally {
        clearAuthCookie(res);
        res.json({ message: 'Signed out successfully.' });
    }
});


// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const sql = `SELECT id,
                        email,
                        first_name as "firstName",
                        last_name as "lastName",
                        profile_picture_url as "profilePictureUrl",
                        phone,
                        address,
                        role,
                        is_2fa_enabled as "is2FAEnabled",
                        status,
                        last_login as "lastLogin"
                 FROM users WHERE id = $1`;
    
    try {
        const result = await db.query(sql, [userId]);
        const user = result.rows[0];
        if (!user) {
            // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
            return res.status(404).json({ message: 'User not found' });
        }
        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json(user);
    } catch (err) {
        console.error(err);
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        res.status(500).json({ message: 'Failed to fetch user profile.' });
    }
});

export default router;
