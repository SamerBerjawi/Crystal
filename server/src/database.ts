import { Pool } from 'pg';

let db: any;
try {
    const poolConfig: any = {
        max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DATABASE_CONN_TIMEOUT_MS || '5000', 10),
        statement_timeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT_MS || '10000', 10),
    };
    if (process.env.DATABASE_URL) {
        poolConfig.connectionString = process.env.DATABASE_URL;
    } else {
        poolConfig.host = process.env.DATABASE_HOST || '127.0.0.1';
        poolConfig.port = parseInt(process.env.DATABASE_PORT || '5432', 10);
        poolConfig.user = process.env.DATABASE_USER;
        poolConfig.password = process.env.DATABASE_PASSWORD;
        poolConfig.database = process.env.DATABASE_NAME;
    }
    db = new Pool(poolConfig);
} catch (err) {
    if (process.env.NODE_ENV === 'production') {
        console.error('Fatal: Failed to construct PostgreSQL Pool in production mode:', err);
        throw err;
    }
    console.warn('DB not connected — mock active');
    db = {
        query: async () => ({ rows: [] }),
        connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
        end: async () => {}
    };
}
// An idle client can fail (DB restart, network blip). Without a listener that 'error' event is fatal.
if (typeof db.on === 'function') {
    db.on('error', (err: Error) => console.error('Unexpected PostgreSQL pool error:', err.message));
}

export { db };

export const initializeDatabase = async () => {
    try {
        if (!process.env.DATABASE_HOST && !process.env.DATABASE_URL) {
            console.warn('No DATABASE_HOST or DATABASE_URL provided — skipping database table initialization.');
            return;
        }
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
                default_city TEXT,
                role VARCHAR(50) DEFAULT 'Member',
                is_2fa_enabled BOOLEAN DEFAULT FALSE,
                status VARCHAR(50) DEFAULT 'Active',
                last_login TIMESTAMPTZ
            )
        `);

        // Ensure older databases pick up the newer optional columns as well
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_city TEXT`);

        await db.query(`
            CREATE TABLE IF NOT EXISTS financial_data (
                user_id INTEGER PRIMARY KEY,
                data JSONB,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Per-user Enable Banking settings. `redirect_url` is the callback URL registered in Enable Banking; the
        // ENABLE_BANKING_REDIRECT_URL environment variable still wins when it is set.
        await db.query(`
            CREATE TABLE IF NOT EXISTS enable_banking_settings (
                user_id INTEGER PRIMARY KEY,
                redirect_url TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Enable Banking signing key, encrypted at rest and never returned to the client (AUD-13).
        await db.query(`
            CREATE TABLE IF NOT EXISTS enable_banking_credentials (
                user_id INTEGER PRIMARY KEY,
                application_id TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
        // Alerts sent from the server (ntfy, Gotify or a webhook). The token is encrypted and never sent to the browser.
        await db.query(`
            CREATE TABLE IF NOT EXISTS alert_settings (
                user_id INTEGER PRIMARY KEY,
                enabled BOOLEAN NOT NULL DEFAULT FALSE,
                kind TEXT,
                url TEXT,
                topic TEXT,
                encrypted_token TEXT,
                rules JSONB NOT NULL DEFAULT '{}',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // How Ask Crystal reaches a language model: the built-in engine, or the user's own server. The key is encrypted.
        await db.query(`
            CREATE TABLE IF NOT EXISTS assistant_settings (
                user_id INTEGER PRIMARY KEY,
                provider TEXT NOT NULL DEFAULT 'builtin',
                base_url TEXT,
                model TEXT,
                encrypted_key TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // Outside MCP servers Ask Crystal may call. The token is encrypted and never returned.
        await db.query(`
            CREATE TABLE IF NOT EXISTS assistant_mcp_servers (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                encrypted_token TEXT,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, name),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // What was already sent, so each event alerts once.
        await db.query(`
            CREATE TABLE IF NOT EXISTS alert_log (
                user_id INTEGER NOT NULL,
                alert_key TEXT NOT NULL,
                sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, alert_key),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // Read-only API tokens. Only the hash is kept.
        await db.query(`
            CREATE TABLE IF NOT EXISTS api_tokens (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                prefix TEXT NOT NULL,
                scopes TEXT[] NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_used_at TIMESTAMPTZ,
                expires_at TIMESTAMPTZ,
                revoked_at TIMESTAMPTZ,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id)`);
        // PIN lock: the hash sits on the user, and locks and failed tries on each session.
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT`);
        await db.query(`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS pin_failures INTEGER NOT NULL DEFAULT 0`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)`);
        console.log('Database tables are ready.');
    } catch (err) {
        if (process.env.NODE_ENV === 'production') {
            console.error('Fatal: Database initialization failed in production mode:', err);
            throw err;
        }
        console.warn('Error connecting to database tables — running with fallback mock:', err);
    }
};

/** Deletes sessions that expired or were revoked more than a week ago so the table does not grow without bound. */
export const purgeStaleSessions = async () => {
    try {
        await db.query(
            `DELETE FROM user_sessions
             WHERE expires_at < NOW() - INTERVAL '7 days' OR revoked_at < NOW() - INTERVAL '7 days'`
        );
    } catch (err) {
        console.warn('Failed to purge stale sessions:', err);
    }
};
