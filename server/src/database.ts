import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        profile_picture_url TEXT,
        role VARCHAR(50) NOT NULL DEFAULT 'Member',
        phone VARCHAR(50),
        address TEXT,
        is_2fa_enabled BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        last_login TIMESTAMPTZ
      );
    `);

    // Create financial_data table
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_data (
        user_email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
        data JSONB NOT NULL
      );
    `);

    console.log('Database tables are ready.');
  } catch (err) {
    console.error('Error initializing database', err);
    // FIX: Re-throw the error to allow the calling process to handle the failed promise, which will terminate the application, instead of using process.exit directly which was causing a type error.
    throw err;
  } finally {
    client.release();
  }
};
