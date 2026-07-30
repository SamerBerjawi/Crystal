import { Pool } from 'pg';

export const db = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
});

export const initializeDatabase = async () => {
    try {
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

        // Legacy table maintained for migration / fallback
        await db.query(`
            CREATE TABLE IF NOT EXISTS financial_data (
                user_id INTEGER PRIMARY KEY,
                data JSONB,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                revoked_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Normalized Relational Tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id VARCHAR(255) NOT NULL,
                user_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(100) NOT NULL,
                balance NUMERIC(15, 2) DEFAULT 0,
                currency VARCHAR(20) DEFAULT 'EUR',
                data JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id VARCHAR(255) NOT NULL,
                user_id INTEGER NOT NULL,
                account_id VARCHAR(255),
                amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
                date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                description TEXT,
                category VARCHAR(100),
                type VARCHAR(50),
                currency VARCHAR(20),
                data JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS budgets (
                id VARCHAR(255) NOT NULL,
                user_id INTEGER NOT NULL,
                name VARCHAR(255),
                amount NUMERIC(15, 2) DEFAULT 0,
                category VARCHAR(100),
                period VARCHAR(50),
                data JSONB DEFAULT '{}',
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS financial_goals (
                id VARCHAR(255) NOT NULL,
                user_id INTEGER NOT NULL,
                name VARCHAR(255),
                target_amount NUMERIC(15, 2) DEFAULT 0,
                current_amount NUMERIC(15, 2) DEFAULT 0,
                currency VARCHAR(20),
                data JSONB DEFAULT '{}',
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS recurring_transactions (
                id VARCHAR(255) NOT NULL,
                user_id INTEGER NOT NULL,
                account_id VARCHAR(255),
                amount NUMERIC(15, 2) DEFAULT 0,
                frequency VARCHAR(50),
                start_date TIMESTAMPTZ,
                description TEXT,
                data JSONB DEFAULT '{}',
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id VARCHAR(255) NOT NULL,
                user_id INTEGER NOT NULL,
                title VARCHAR(255),
                status VARCHAR(50),
                due_date TIMESTAMPTZ,
                priority VARCHAR(50),
                data JSONB DEFAULT '{}',
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS user_financial_profiles (
                user_id INTEGER PRIMARY KEY,
                last_updated_at TIMESTAMPTZ DEFAULT NOW(),
                data JSONB DEFAULT '{}',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // B-Tree Indexes for Relational Queries & Aggregations
        await db.query(`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON financial_goals(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_transactions(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);

        console.log('Normalized relational database tables and indexes are ready.');
    } catch (err) {
        console.error('Error initializing database tables', err);
        throw err;
    }
};
