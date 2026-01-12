import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
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

    // Full access token
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
        return res.status(400).json({ message: 'All fields are required' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const userExistsResult = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userExistsResult.rows.length > 0) {
            await client.query('ROLLBACK');
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
        
        const loginData = await performLogin(newUser.id, newUser.email);
        res.status(201).json(loginData);

    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('Error during rollback:', rollbackErr);
        }
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Failed to register user.' });
    } finally {
        client.release();
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const userSql = `SELECT id, email, password, is_2fa_enabled FROM users WHERE email = $1`;
        const userResult = await db.query(userSql, [email.toLowerCase()]);
        const user = userResult.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // 2FA Check
        if (user.is_2fa_enabled) {
            // Return a temporary token that only allows hitting the verify endpoint
            const tempToken = jwt.sign(
                { id: user.id, email: user.email, partial: true }, 
                JWT_SECRET, 
                { expiresIn: '10m' }
            );
            return res.json({ require2fa: true, tempToken });
        }
        
        const loginData = await performLogin(user.id, user.email);
        res.json(loginData);

    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// Verify 2FA Login
router.post('/login/2fa', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId || !code) {
        return res.status(400).json({ message: 'Code is required' });
    }

    try {
        const sql = `SELECT two_factor_secret, two_factor_backup_codes, email FROM users WHERE id = $1`;
        const result = await db.query(sql, [userId]);
        const user = result.rows[0];

        if (!user || (!user.two_factor_secret && !user.two_factor_backup_codes)) {
             return res.status(400).json({ message: '2FA is not enabled for this user.' });
        }

        // 1. Try TOTP
        let verified = false;
        if (user.two_factor_secret) {
            verified = speakeasy.totp.verify({
                secret: user.two_factor_secret,
                encoding: 'base32',
                token: code
            });
        }

        // 2. Try Backup Codes if TOTP failed
        if (!verified && user.two_factor_backup_codes && Array.isArray(user.two_factor_backup_codes)) {
            if (user.two_factor_backup_codes.includes(code)) {
                verified = true;
                // Remove used backup code
                const newCodes = user.two_factor_backup_codes.filter((c: string) => c !== code);
                await db.query('UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2', [newCodes, userId]);
            }
        }

        if (!verified) {
             return res.status(401).json({ message: 'Invalid two-factor code.' });
        }

        const loginData = await performLogin(userId, user.email);
        res.json(loginData);

    } catch (err) {
        console.error('Error during 2fa verification:', err);
        res.status(500).json({ message: 'Server error during verification.' });
    }
});

// Setup 2FA - Generate Secret
router.post('/2fa/generate', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    
    try {
        const secret = speakeasy.generateSecret({ length: 20, name: `Crystal (${req.user?.email})` });
        
        // Store secret but do not enable yet
        await db.query(`UPDATE users SET two_factor_secret = $1 WHERE id = $2`, [secret.base32, userId]);
        
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');
        
        res.json({ secret: secret.base32, qrCodeUrl });
    } catch (err) {
        console.error('Error generating 2FA secret:', err);
        res.status(500).json({ message: 'Failed to generate 2FA secret.' });
    }
});

// Setup 2FA - Confirm & Enable
router.post('/2fa/enable', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { code } = req.body;
    
    try {
        const userRes = await db.query(`SELECT two_factor_secret FROM users WHERE id = $1`, [userId]);
        const user = userRes.rows[0];
        
        if (!user.two_factor_secret) {
            return res.status(400).json({ message: 'No 2FA setup in progress.' });
        }
        
        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: code
        });
        
        if (verified) {
            // Generate backup codes
            const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));
            
            await db.query(`UPDATE users SET is_2fa_enabled = TRUE, two_factor_backup_codes = $1 WHERE id = $2`, [backupCodes, userId]);
            
            res.json({ message: '2FA enabled successfully.', backupCodes });
        } else {
            res.status(400).json({ message: 'Invalid code. Please try again.' });
        }
    } catch (err) {
        console.error('Error enabling 2FA:', err);
        res.status(500).json({ message: 'Failed to enable 2FA.' });
    }
});

// Disable 2FA
router.post('/2fa/disable', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    
    try {
        await db.query(`UPDATE users SET is_2fa_enabled = FALSE, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = $1`, [userId]);
        res.json({ message: '2FA disabled successfully.' });
    } catch (err) {
        console.error('Error disabling 2FA:', err);
        res.status(500).json({ message: 'Failed to disable 2FA.' });
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
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch user profile.' });
    }
});

export default router;