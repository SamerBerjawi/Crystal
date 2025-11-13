import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';

const router = express.Router();

// Update current user's profile
router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { firstName, lastName, profilePictureUrl, phone, address, is2FAEnabled } = req.body;

    const sql = `
        UPDATE users
        SET
            first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            profile_picture_url = COALESCE($3, profile_picture_url),
            phone = COALESCE($4, phone),
            address = COALESCE($5, address),
            is_2fa_enabled = COALESCE($6, is_2fa_enabled)
        WHERE id = $7`;

    try {
        await db.query(sql, [firstName, lastName, profilePictureUrl, phone, address, is2FAEnabled, userId]);
        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 500;
        res.json({ message: 'Failed to update user profile' });
    }
});

// Change password
router.post('/me/change-password', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 400;
        return res.json({ message: 'All fields are required' });
    }

    try {
        const sql = `SELECT password FROM users WHERE id = $1`;
        const result = await db.query(sql, [userId]);
        const user = result.rows[0];

        if (!user) {
            // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
            res.statusCode = 404;
            return res.json({ message: 'User not found' });
        }

        const passwordIsValid = bcrypt.compareSync(currentPassword, user.password);
        if (!passwordIsValid) {
            // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
            res.statusCode = 401;
            return res.json({ message: 'Incorrect current password' });
        }

        const hashedNewPassword = bcrypt.hashSync(newPassword, 8);
        const updateSql = `UPDATE users SET password = $1 WHERE id = $2`;
        await db.query(updateSql, [hashedNewPassword, userId]);

        // FIX: Replaced res.status(200).json() with res.json() as 200 is the default status.
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        // FIX: Replaced res.status().json() with res.statusCode and res.json() to fix type error.
        res.statusCode = 500;
        res.json({ message: 'Failed to update password' });
    }
});


export default router;
