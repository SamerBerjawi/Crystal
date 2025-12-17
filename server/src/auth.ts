import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(secret: string) {
    const cleanSecret = secret.replace(/=+$/, '').toUpperCase();
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of cleanSecret) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return Buffer.from(bytes);
}

function generateTotp(secret: string, timeStep: number) {
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(timeStep, 4);

    const hmac = crypto.createHmac('sha1', decodeBase32(secret)).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    return (code % 1_000_000).toString().padStart(6, '0');
}

function verifyTotp(secret: string, token: string) {
    if (!secret || !token) return false;
    const currentStep = Math.floor(Date.now() / 30000);
    const sanitized = token.replace(/\D/g, '');
    for (const drift of [-1, 0, 1]) {
        if (generateTotp(secret, currentStep + drift) === sanitized) {
            return true;
        }
    }
    return false;
}

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
        // FIX: Replaced res.status().json() with res.status() and res.json() to fix type error.
        res.status(201).json(loginData);

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
router.post('/login', async (req, res) => {
    const { email, password, totpCode, rememberDevice, deviceToken } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const userSql = `SELECT id, email, password, is_2fa_enabled, two_fa_secret, two_fa_trust_token, two_fa_trust_expires FROM users WHERE email = $1`;
        const userResult = await db.query(userSql, [email.toLowerCase()]);
        const user = userResult.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        let trustToken: string | undefined;
        const now = new Date();
        const trustValid =
            !!user.two_fa_trust_token &&
            !!user.two_fa_trust_expires &&
            new Date(user.two_fa_trust_expires) > now &&
            deviceToken === user.two_fa_trust_token;

        if (user.is_2fa_enabled) {
            const hasValidTrust = trustValid;
            if (!hasValidTrust) {
                if (!user.two_fa_secret) {
                    return res.status(500).json({ message: 'Two-factor secret is missing for this account.' });
                }

                if (!totpCode) {
                    return res.status(403).json({ requires2FA: true, message: 'Two-factor code required.' });
                }

                if (!verifyTotp(user.two_fa_secret, totpCode)) {
                    return res.status(401).json({ message: 'Invalid or expired two-factor code.' });
                }
            }

            if (rememberDevice && !trustValid) {
                trustToken = crypto.randomBytes(32).toString('hex');
                const trustExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await db.query('UPDATE users SET two_fa_trust_token = $1, two_fa_trust_expires = $2 WHERE id = $3', [
                    trustToken,
                    trustExpires.toISOString(),
                    user.id,
                ]);
            }
        }

        const loginData = await performLogin(user.id, user.email);
        res.json({ ...loginData, trustToken });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login.' });
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