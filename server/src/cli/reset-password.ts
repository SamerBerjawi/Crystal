/**
 * Administrator password reset (there is no email infrastructure, so this is the recovery path).
 *
 *   docker compose exec backend node dist/cli/reset-password.js user@example.com [new-password]
 *
 * Without a new password a random one is generated and printed. All of the user's sessions are revoked.
 */
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from '../database';
import { PASSWORD_HASH_ROUNDS } from '../authConfig';
import { validatePassword } from '../validation';

const main = async (): Promise<number> => {
    const [emailArg, passwordArg] = process.argv.slice(2);
    if (!emailArg) {
        console.error('Usage: reset-password <email> [new-password]');
        return 2;
    }
    const email = emailArg.trim().toLowerCase();
    const generated = !passwordArg;
    const password = passwordArg || randomBytes(12).toString('base64url');

    const problem = validatePassword(password);
    if (problem) {
        console.error(problem);
        return 2;
    }

    const found = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (found.rows.length === 0) {
        console.error(`No user with email ${email}.`);
        return 1;
    }
    const userId = found.rows[0].id;

    const hashed = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
        await client.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }

    console.log(`Password reset for ${email}. All sessions were signed out.`);
    if (generated) console.log(`New password: ${password}`);
    return 0;
};

main()
    .then(async code => { await db.end(); process.exit(code); })
    .catch(async error => {
        console.error('Password reset failed:', error?.message || error);
        try { await db.end(); } catch { /* ignore */ }
        process.exit(1);
    });
