import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from './database';
import { authenticateToken, AuthRequest } from './middleware';
import { clearAuthCookie, PASSWORD_HASH_ROUNDS } from './authConfig';
import { MAX_PIN_FAILURES, PIN_PATTERN, pinTriesLeft } from './lockRules';
import { createRateLimiter } from './rateLimit';

const router = express.Router();

const pinChangeRateLimiter = createRateLimiter({
    namespace: 'pin-change',
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 15 * 60 * 1000,
    message: 'Too many attempts. Please wait 15 minutes and try again.',
    key: req => `${req.ip}:${(req as AuthRequest).user?.id || 'anonymous'}`,
});

const pinUnlockRateLimiter = createRateLimiter({
    namespace: 'pin-unlock',
    windowMs: 15 * 60 * 1000,
    maxAttempts: 15,
    blockMs: 15 * 60 * 1000,
    message: 'Too many unlock attempts. Please wait 15 minutes and try again.',
    key: req => `${req.ip}:${(req as AuthRequest).user?.id || 'anonymous'}`,
});

const passwordMatches = async (userId: number | undefined, password: unknown) => {
    if (typeof password !== 'string' || !password) return false;
    const result = await db.query(`SELECT password FROM users WHERE id = $1`, [userId]);
    return !!result.rows[0] && bcrypt.compare(password, result.rows[0].password);
};

router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const result = await db.query(
            `SELECT u.pin_hash IS NOT NULL AS "hasPin", s.locked_at IS NOT NULL AS "isLocked"
             FROM users u JOIN user_sessions s ON s.user_id = u.id
             WHERE u.id = $1 AND s.id = $2`,
            [req.user?.id, req.user?.sessionId]
        );
        res.json(result.rows[0] ?? { hasPin: false, isLocked: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to read the lock status.' });
    }
});

// Setting a PIN needs the password, so someone at an open screen can't take over the lock.
router.put('/pin', authenticateToken, pinChangeRateLimiter, async (req: AuthRequest, res) => {
    const { password, pin } = req.body;
    if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
        return res.status(400).json({ message: 'A PIN is four digits.' });
    }
    try {
        if (!(await passwordMatches(req.user?.id, password))) {
            return res.status(401).json({ message: 'Your password is wrong.' });
        }
        const pinHash = await bcrypt.hash(pin, PASSWORD_HASH_ROUNDS);
        await db.query(`UPDATE users SET pin_hash = $1 WHERE id = $2`, [pinHash, req.user?.id]);
        res.json({ hasPin: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to save the PIN.' });
    }
});

router.delete('/pin', authenticateToken, pinChangeRateLimiter, async (req: AuthRequest, res) => {
    try {
        if (!(await passwordMatches(req.user?.id, req.body?.password))) {
            return res.status(401).json({ message: 'Your password is wrong.' });
        }
        await db.query(`UPDATE users SET pin_hash = NULL WHERE id = $1`, [req.user?.id]);
        // With no PIN nothing could unlock them, so every session opens.
        await db.query(`UPDATE user_sessions SET locked_at = NULL, pin_failures = 0 WHERE user_id = $1`, [req.user?.id]);
        res.json({ hasPin: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to remove the PIN.' });
    }
});

router.post('/lock', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const result = await db.query(
            `UPDATE user_sessions SET locked_at = NOW(), pin_failures = 0
             WHERE id = $1 AND EXISTS (SELECT 1 FROM users WHERE id = $2 AND pin_hash IS NOT NULL)`,
            [req.user?.sessionId, req.user?.id]
        );
        if (result.rowCount === 0) return res.status(409).json({ message: 'Set a PIN first.' });
        res.json({ isLocked: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to lock.' });
    }
});

router.post('/unlock', authenticateToken, pinUnlockRateLimiter, async (req: AuthRequest, res) => {
    const { pin } = req.body || {};
    try {
        const result = await db.query(
            `SELECT u.pin_hash, s.locked_at
             FROM users u
             LEFT JOIN user_sessions s ON s.user_id = u.id AND s.id = $2
             WHERE u.id = $1`,
            [req.user?.id, req.user?.sessionId]
        );
        const row = result.rows[0];
        const pinHash = row?.pin_hash;
        if (!pinHash || (row && row.locked_at === null)) {
            await db.query(`UPDATE user_sessions SET locked_at = NULL, pin_failures = 0 WHERE id = $1`, [req.user?.sessionId]);
            return res.json({ isLocked: false });
        }
        if (typeof pin === 'string' && PIN_PATTERN.test(pin) && (await bcrypt.compare(pin, pinHash))) {
            await db.query(`UPDATE user_sessions SET locked_at = NULL, pin_failures = 0 WHERE id = $1`, [req.user?.sessionId]);
            return res.json({ isLocked: false });
        }

        // Counted in one statement, so tries sent at the same time can't get past the limit.
        const counted = await db.query(
            `UPDATE user_sessions SET pin_failures = pin_failures + 1 WHERE id = $1 RETURNING pin_failures`,
            [req.user?.sessionId]
        );
        const failures = counted.rows[0]?.pin_failures ?? MAX_PIN_FAILURES;
        if (failures >= MAX_PIN_FAILURES) {
            await db.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`, [req.user?.sessionId]);
            clearAuthCookie(res);
            return res.status(401).json({ message: 'Too many wrong PINs.', triesLeft: 0, isSignedOut: true });
        }
        res.status(401).json({ message: 'Wrong PIN.', triesLeft: pinTriesLeft(failures), isSignedOut: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to unlock.' });
    }
});

export default router;
