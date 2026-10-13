import express from 'express';
import cors from 'cors';
import authRouter from './auth';
import dataRouter from './data';
import usersRouter from './users';
import enableBankingRouter from './enableBanking';
import smartFetcherRouter from './smartFetcher';
import { initializeDatabase, db, purgeStaleSessions } from './database';
import { authenticateToken } from './middleware';
import { exit } from 'process';

const startServer = async () => {
    try {
        await initializeDatabase();

        const app = express();
        const port = Number(process.env.PORT || 3001);

        // Number of reverse proxies in front of the API (the bundled nginx is one). `true` would trust a
        // client-supplied X-Forwarded-For and let anyone choose the address the rate limiter sees.
        const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
        app.set('trust proxy', Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

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
        // Cross-site request forgery: the session cookie is SameSite=lax, and on top of that a state-changing request
        // that the browser marks as cross-site / same-site-but-different-origin is refused unless its Origin is allowed.
        app.use((req, res, next) => {
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
            const site = req.headers['sec-fetch-site'];
            const origin = req.headers.origin;
            if ((site === 'cross-site' || site === 'same-site') && origin) {
                let originHost = '';
                try { originHost = new URL(origin).host; } catch { /* malformed Origin is treated as foreign */ }
                const sameHost = originHost !== '' && originHost === (req.headers['x-forwarded-host'] || req.headers.host);
                if (!sameHost && !allowedOrigins.has(origin)) {
                    return res.status(403).json({ message: 'Cross-site request blocked.' });
                }
            }
            next();
        });

        // The API speaks JSON only: other body types are rejected instead of being parsed (no form posts).
        app.use((req, res, next) => {
            const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
            if (['POST', 'PUT', 'PATCH'].includes(req.method) && hasBody && !req.is('application/json')) {
                return res.status(415).json({ message: 'Content-Type must be application/json.' });
            }
            next();
        });

        // Small body limit everywhere; the data blob endpoint gets the large limit, and only after authentication so
        // an anonymous client cannot make the server buffer and parse tens of megabytes.
        const smallJson = express.json({ limit: process.env.API_SMALL_BODY_LIMIT || '100kb' });
        const bigJson = express.json({ limit: process.env.API_BODY_LIMIT || '50mb' });
        app.use((req, res, next) => (req.path.startsWith('/api/data') ? next() : smallJson(req, res, next)));
        app.use('/api/data', authenticateToken, bigJson);

        app.get('/api', (req, res) => {
            res.send('Crystal API is running.');
        });

        app.get(['/health', '/api/health'], async (req, res) => {
            try {
                await db.query('SELECT 1');
                res.status(200).json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
            } catch (err: any) {
                console.error('Health check failed:', err?.message || err);
                res.status(503).json({ status: 'unhealthy' });
            }
        });

        app.use('/api/auth', authRouter);
        app.use('/api/data', dataRouter);
        app.use('/api/enable-banking', enableBankingRouter);
        app.use('/api/users', usersRouter);
        app.use('/api/smart-fetch', smartFetcherRouter);

        // Last line of defence: anything that escapes a route becomes a JSON 500, never a crash or an HTML page.
        app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (res.headersSent) return next(err);
            if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large.' });
            if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON.' });
            console.error('Unhandled request error:', err?.message || err);
            res.status(500).json({ message: 'Internal server error.' });
        });

        void purgeStaleSessions();
        setInterval(() => void purgeStaleSessions(), 6 * 60 * 60 * 1000).unref();

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

        process.on('unhandledRejection', reason => console.error('Unhandled promise rejection:', reason));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));
    } catch (error) {
        console.error('Failed to start server:', error);
        exit(1);
    }
};

startServer();
