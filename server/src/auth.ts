import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

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

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

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
    return { token, user: mappedUser, financialData };
}


// Register
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 400;
        return res.json({ message: 'All fields are required' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const userExistsResult = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userExistsResult.rows.length > 0) {
            await client.query('ROLLBACK');
            // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
            res.statusCode = 409;
            return res.json({ message: 'Email already in use.' });
        }
        
        const hashedPassword = bcrypt.hashSync(password, 8);
        const profilePic = `https://i.pravatar.cc/150?u=${email}`;
        
        const userSql = `INSERT INTO users (first_name, last_name, email, password, profile_picture_url, last_login) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, email`;
        const userResult = await client.query(userSql, [firstName, lastName, email.toLowerCase(), hashedPassword, profilePic]);
        const newUser = userResult.rows[0];
        
        const dataSql = `INSERT INTO financial_data (user_id, data) VALUES ($1, $2)`;
        await client.query(dataSql, [newUser.id, '{}']);

        await client.query('COMMIT');
        
        // After successful registration, perform login to get consistent data
        const loginData = await performLogin(newUser.id, newUser.email);
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 201;
        res.json(loginData);

    } catch (err) {
        // Make sure to rollback before logging the error
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('Error during rollback:', rollbackErr);
        }
        console.error('Error during registration:', err);
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 500;
        res.json({ message: 'Failed to register user.' });
    } finally {
        client.release();
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 400;
        return res.json({ message: 'Email and password are required' });
    }

    try {
        const userSql = `SELECT id, email, password FROM users WHERE email = $1`;
        const userResult = await db.query(userSql, [email.toLowerCase()]);
        const user = userResult.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
            res.statusCode = 401;
            return res.json({ message: 'Invalid credentials' });
        }
        
        const loginData = await performLogin(user.id, user.email);
        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json(loginData);

    } catch (err) {
        console.error('Error during login:', err);
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 500;
        res.json({ message: 'Server error during login.' });
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
            // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
            res.statusCode = 404;
            return res.json({ message: 'User not found' });
        }
        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json(user);
    } catch (err) {
        console.error(err);
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 500;
        res.json({ message: 'Failed to fetch user profile.' });
    }
});

export default router;
