"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("./database");
const middleware_1 = require("./middleware");
const authConfig_1 = require("./authConfig");
const rateLimit_1 = require("./rateLimit");
const router = express_1.default.Router();
const loginRateLimiter = (0, rateLimit_1.createRateLimiter)({
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
const dbNorm_1 = require("./dbNorm");
async function performLogin(userId, email) {
    const financialData = await (0, dbNorm_1.fetchFinancialDataFromRelational)(userId);
    const lastLogin = new Date().toISOString();
    const userUpdateRes = await database_1.db.query(`UPDATE users SET last_login = $1 WHERE id = $2 RETURNING *`, [lastLogin, userId]);
    const user = userUpdateRes.rows[0];
    const sessionId = (0, authConfig_1.issueSessionId)();
    const sessionExpiresAt = (0, authConfig_1.buildSessionExpiry)();
    await database_1.db.query(`INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`, [sessionId, user.id, sessionExpiresAt.toISOString()]);
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, sid: sessionId }, authConfig_1.JWT_SECRET, {
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
    return { token, sessionExpiresAt, user: mappedUser, financialData };
}
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    const client = await database_1.db.connect();
    try {
        await client.query('BEGIN');
        const userExistsResult = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userExistsResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Email already in use.' });
        }
        const hashedPassword = bcryptjs_1.default.hashSync(password, authConfig_1.PASSWORD_HASH_ROUNDS);
        const profilePic = `https://i.pravatar.cc/150?u=${email}`;
        const userSql = `INSERT INTO users (first_name, last_name, email, password, profile_picture_url, last_login) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, email`;
        const userResult = await client.query(userSql, [firstName, lastName, email.toLowerCase(), hashedPassword, profilePic]);
        const newUser = userResult.rows[0];
        await client.query('COMMIT');
        await (0, dbNorm_1.syncFinancialDataToRelational)(newUser.id, {});
        const loginData = await performLogin(newUser.id, newUser.email);
        (0, authConfig_1.setAuthCookie)(res, loginData.token, loginData.sessionExpiresAt);
        res.status(201).json({ user: loginData.user, financialData: loginData.financialData });
    }
    catch (err) {
        try {
            await client.query('ROLLBACK');
        }
        catch (rollbackErr) {
            console.error('Error during rollback:', rollbackErr);
        }
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Failed to register user.' });
    }
    finally {
        client.release();
    }
});
router.post('/login', loginRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
        const userSql = `SELECT id, email, password FROM users WHERE email = $1`;
        const userResult = await database_1.db.query(userSql, [email.toLowerCase()]);
        const user = userResult.rows[0];
        if (!user || !bcryptjs_1.default.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const loginData = await performLogin(user.id, user.email);
        (0, authConfig_1.setAuthCookie)(res, loginData.token, loginData.sessionExpiresAt);
        res.json({ user: loginData.user, financialData: loginData.financialData });
    }
    catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const cookieHeader = req.headers.cookie || '';
        const cookieParts = cookieHeader.split(';').reduce((acc, part) => {
            const [name, ...val] = part.trim().split('=');
            if (name)
                acc[name] = decodeURIComponent(val.join('=') || '');
            return acc;
        }, {});
        const sessionCookie = cookieParts[authConfig_1.AUTH_COOKIE_NAME];
        if (sessionCookie) {
            const payload = jsonwebtoken_1.default.verify(sessionCookie, authConfig_1.JWT_SECRET);
            if (payload?.sid) {
                await database_1.db.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`, [payload.sid]);
            }
        }
    }
    catch (err) {
        console.error('Error during logout:', err);
    }
    finally {
        (0, authConfig_1.clearAuthCookie)(res);
        res.json({ message: 'Signed out successfully.' });
    }
});
router.get('/me', middleware_1.authenticateToken, async (req, res) => {
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
        const result = await database_1.db.query(sql, [userId]);
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch user profile.' });
    }
});
exports.default = router;
