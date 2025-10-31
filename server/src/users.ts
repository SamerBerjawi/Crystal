// FIX: Use default import for express to avoid type conflicts.
// FIX: Import Response type directly to resolve type conflicts.
import express, { Response } from 'express';
import { pool } from './database';
import { authMiddleware, adminMiddleware, AuthRequest } from './middleware';
import bcrypt from 'bcryptjs';

// FIX: Create router from express instance.
export const usersRouter = express.Router();

// FIX: Correctly typed middleware and route handlers to resolve overload errors.
usersRouter.use(authMiddleware, adminMiddleware);

// Get all users (admin only)
// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response type.
usersRouter.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT email, first_name, last_name, role, status, last_login, profile_picture_url, is_2fa_enabled FROM users ORDER BY last_name, first_name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
});

// Update a user (admin only)
// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response type.
usersRouter.put('/:email', async (req: AuthRequest, res: Response) => {
    const { email } = req.params;
    const { role, status } = req.body;
    
    if (email === req.user.email) {
        return res.status(403).json({ message: "Administrators cannot change their own role or status." });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status) WHERE email = $3 RETURNING *',
            [role, status, email]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Failed to update user.' });
    }
});

// Delete a user (admin only)
// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response type.
usersRouter.delete('/:email', async (req: AuthRequest, res: Response) => {
    const { email } = req.params;
    
    if (email === req.user.email) {
        return res.status(403).json({ message: "Administrators cannot delete themselves." });
    }
    
    try {
        const result = await pool.query('DELETE FROM users WHERE email = $1', [email]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User and all associated data deleted successfully.' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
});

// Reset a user's password (admin only)
// FIX: Use express.Response for route handler to resolve type errors.
// FIX: Use directly imported Response type.
usersRouter.post('/:email/reset-password', async (req: AuthRequest, res: Response) => {
    const { email } = req.params;
    if (email === req.user.email) {
        return res.status(403).json({ message: "Cannot reset your own password here." });
    }
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    try {
        await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
        res.json({ message: `Password for ${email} has been reset. New temporary password: ${tempPassword}` });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
});
