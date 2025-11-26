import { Pool } from 'pg';

const requiredEnv = ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'] as const;
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
    console.error(`Missing database environment variables: ${missing.join(', ')}`);
}

export const db = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ensureConnection = async () => {
    const maxAttempts = 5;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await db.query('SELECT 1');
            if (attempt > 1) {
                console.log(`Database connection established on attempt ${attempt}.`);
            }
            return;
        } catch (err) {
            lastError = err;
            console.error(`Database connection attempt ${attempt} failed. Retrying...`, err);
            if (attempt < maxAttempts) {
                await sleep(1000 * attempt);
            }
        }
    }

    throw lastError;
};

export const initializeDatabase = async () => {
    try {
        await ensureConnection();

        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name VARCHAR(255) NOT NULL,
                last_name VARCHAR(255) NOT NULL,
                profile_picture_url TEXT,
                phone VARCHAR(50),
                address TEXT,
                role VARCHAR(50) DEFAULT 'Member',
                is_2fa_enabled BOOLEAN DEFAULT FALSE,
                status VARCHAR(50) DEFAULT 'Active',
                last_login TIMESTAMPTZ
            )
        `);

        // Ensure older databases pick up the newer optional columns as well
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT`);

        await db.query(`
            CREATE TABLE IF NOT EXISTS financial_data (
                user_id INTEGER PRIMARY KEY,
                data JSONB,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Database tables are ready.');
    } catch (err) {
        console.error('Error initializing database tables', err);
        throw err;
    }
};
