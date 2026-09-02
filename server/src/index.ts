import express from 'express';
import cors from 'cors';
import authRouter from './auth';
import dataRouter from './data';
import usersRouter from './users';
import enableBankingRouter from './enableBanking';
import smartFetcherRouter from './smartFetcher';
import { initializeDatabase, db } from './database';
import { exit } from 'process';

const startServer = async () => {
    try {
        await initializeDatabase();

        const app = express();
        const port = 3001;

        app.set('trust proxy', true);

        const isProduction = process.env.NODE_ENV === 'production';
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

        if (isProduction && configuredOrigins.length === 0) {
            console.warn(
                '⚠️  [CORS WARNING] Running in production with no CORS_ORIGIN specified. ' +
                'Defaulting to restricted local origins. Set CORS_ORIGIN to your production frontend domain.'
            );
        }

        const allowedOrigins = new Set(
            configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins
        );

        app.use(cors({
            origin: (origin, callback) => {
                // In dev mode without configured origins, allow all for dev convenience
                if (!isProduction && configuredOrigins.length === 0) {
                    return callback(null, true);
                }
                // Allow server-to-server / same-origin requests (no Origin header) or matched origins
                if (!origin || allowedOrigins.has(origin)) {
                    return callback(null, true);
                }
                return callback(new Error(`Origin "${origin}" not allowed by CORS policy.`));
            },
            credentials: true,
        }));
        const bodyLimit = process.env.API_BODY_LIMIT || '50mb';
        app.use(express.json({ limit: bodyLimit }));
        app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

        app.get('/api', (req, res) => {
            res.send('Crystal API is running.');
        });

        app.get(['/health', '/api/health'], async (req, res) => {
            try {
                await db.query('SELECT 1');
                res.status(200).json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
            } catch (err: any) {
                res.status(503).json({ status: 'unhealthy', error: 'Database connection failed', message: err?.message });
            }
        });

        app.use('/api/auth', authRouter);
        app.use('/api/data', dataRouter);
        app.use('/api/enable-banking', enableBankingRouter);
        app.use('/api/users', usersRouter);
        app.use('/api/smart-fetch', smartFetcherRouter);

        const server = app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

        let isShuttingDown = false;
        const handleShutdown = async (signal: string) => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            console.log(`Received ${signal}. Draining connections and shutting down gracefully...`);
            server.close(async () => {
                console.log('HTTP server closed.');
                try {
                    await db.end();
                    console.log('Database pool drained and closed.');
                    process.exit(0);
                } catch (err) {
                    console.error('Error closing database pool:', err);
                    process.exit(1);
                }
            });

            setTimeout(() => {
                console.error('Graceful shutdown timed out (10s), forcing exit.');
                process.exit(1);
            }, 10000).unref();
        };

        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));
    } catch (error) {
        console.error('Failed to start server:', error);
        exit(1);
    }
};

startServer();
