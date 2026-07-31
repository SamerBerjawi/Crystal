"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("./database");
const middleware_1 = require("./middleware");
const authConfig_1 = require("./authConfig");
const rateLimit_1 = require("./rateLimit");
const router = express_1.default.Router();
const passwordChangeRateLimiter = (0, rateLimit_1.createRateLimiter)({
    namespace: 'change-password',
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 15 * 60 * 1000,
    message: 'Too many password change attempts. Please wait 15 minutes and try again.',
    key: req => `${req.ip}:${req.user?.id || 'anonymous'}`,
});
// Update current user's profile
router.put('/me', middleware_1.authenticateToken, async (req, res) => {
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
        await database_1.db.query(sql, [firstName, lastName, profilePictureUrl, phone, address, userId]);
        res.json({ message: 'Profile updated successfully' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update user profile' });
    }
});
// Change password
router.post('/me/change-password', middleware_1.authenticateToken, passwordChangeRateLimiter, async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    try {
        const sql = `SELECT password FROM users WHERE id = $1`;
        const result = await database_1.db.query(sql, [userId]);
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const passwordIsValid = bcryptjs_1.default.compareSync(currentPassword, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }
        const hashedNewPassword = bcryptjs_1.default.hashSync(newPassword, authConfig_1.PASSWORD_HASH_ROUNDS);
        const updateSql = `UPDATE users SET password = $1 WHERE id = $2`;
        await database_1.db.query(updateSql, [hashedNewPassword, userId]);
        await database_1.db.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
        (0, authConfig_1.clearAuthCookie)(res);
        res.json({ message: 'Password updated successfully. Please sign in again.' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update password' });
    }
});
exports.default = router;
