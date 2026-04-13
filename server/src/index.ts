import express from 'express';
import cors from 'cors';
import authRouter from './auth';
import dataRouter from './data';
import usersRouter from './users';
import enableBankingRouter from './enableBanking';
import smartFetcherRouter from './smartFetcher';
import { initializeDatabase } from './database';
import { exit } from 'process';

const startServer = async () => {
    try {
        await initializeDatabase();

        const app = express();
        const port = 3001;

        app.set('trust proxy', true);

        const defaultOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];
        const configuredOrigins = (process.env.CORS_ORIGIN || '')
            .split(',')
            .map(origin => origin.trim())
            .filter(Boolean);
        const allowedOrigins = new Set(configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins);

        app.use(cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.has(origin)) {
                    return callback(null, true);
                }
                return callback(new Error('Origin not allowed by CORS policy.'));
            },
            credentials: true,
        }));
        const bodyLimit = process.env.API_BODY_LIMIT || '50mb';
        app.use(express.json({ limit: bodyLimit }));
        app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

        app.get('/api', (req, res) => {
            res.send('Crystal API is running.');
        });

        app.use('/api/auth', authRouter);
        app.use('/api/data', dataRouter);
        app.use('/api/enable-banking', enableBankingRouter);
        app.use('/api/users', usersRouter);
        app.use('/api/smart-fetch', smartFetcherRouter);

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        exit(1);
    }
};

startServer();
