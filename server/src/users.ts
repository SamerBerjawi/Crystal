import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';
import { clearAuthCookie, PASSWORD_HASH_ROUNDS } from './authConfig';
import { createRateLimiter } from './rateLimit';

const router = express.Router();

const passwordChangeRateLimiter = createRateLimiter({
    namespace: 'change-password',
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 15 * 60 * 1000,
    message: 'Too many password change attempts. Please wait 15 minutes and try again.',
    key: req => `${req.ip}:${(req as AuthRequest).user?.id || 'anonymous'}`,
});

// Update current user's profile
router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { firstName, lastName, profilePictureUrl, phone, address } = req.body;

    const sql = `
        UPDATE users
        SET
            first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            profile_picture_url = COALESCE($3, profile_picture_url),
            phone = COALESCE($4, phone),
            address = COALESCE($5, address)
        WHERE id = $6`;

    try {
        await db.query(sql, [firstName, lastName, profilePictureUrl, phone, address, userId]);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update user profile' });
    }
});

// Change password
router.post('/me/change-password', authenticateToken, passwordChangeRateLimiter, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const sql = `SELECT password FROM users WHERE id = $1`;
        const result = await db.query(sql, [userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const passwordIsValid = bcrypt.compareSync(currentPassword, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        const hashedNewPassword = bcrypt.hashSync(newPassword, PASSWORD_HASH_ROUNDS);
        const updateSql = `UPDATE users SET password = $1 WHERE id = $2`;
        await db.query(updateSql, [hashedNewPassword, userId]);
        await db.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
        clearAuthCookie(res);

        res.json({ message: 'Password updated successfully. Please sign in again.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update password' });
    }
});

export default router;
