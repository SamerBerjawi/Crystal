import express from 'express';
import lockRouter from './lock';
import cors from 'cors';
import compression from 'compression';
import authRouter from './auth';
import dataRouter from './data';
import usersRouter from './users';
import enableBankingRouter from './enableBanking';
import smartFetcherRouter from './smartFetcher';
import alertsRouter, { startAlertScheduler } from './alerts';
import tokensRouter from './apiTokens';
import publicApiRouter from './publicApi';
import mcpRouter from './mcp';
import { initializeDatabase, db, purgeStaleSessions } from './database';
import { authenticateToken } from './middleware';
import { exit } from 'process';

const startServer = async () => {
    try {
        await initializeDatabase();

        const app = express();
        app.disable('x-powered-by');
        // Gzip responses above 1 kB (the data blob is large, repetitive JSON).
        app.use(compression({ threshold: 1024 }));
        app.use((_req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('Referrer-Policy', 'no-referrer');
            res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
            res.setHeader('Cache-Control', 'no-store');
            next();
        });
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
            'http://localhost:7157',
            'http://127.0.0.1:7157',
        ];
        const configuredOrigins = (process.env.CORS_ORIGIN || '')
            .split(',')
            .map(origin => origin.trim())
            .filter(Boolean);

        if (isProduction && configuredOrigins.length === 0) {
            console.warn(
                '⚠️  [CORS WARNING] Running in production with no CORS_ORIGIN specified. ' +
                'Defaulting to same-host and local origins. Set CORS_ORIGIN to allow cross-origin frontend domains.'
            );
        }

        const allowedOrigins = new Set(
            configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins
        );

        const getRequestHost = (req: express.Request): string | undefined => {
            const forwarded = req.headers['x-forwarded-host'];
            if (typeof forwarded === 'string' && forwarded.length > 0) {
                return forwarded.split(',')[0].trim();
            }
            if (Array.isArray(forwarded) && forwarded.length > 0) {
                return forwarded[0].trim();
            }
            return req.headers.host;
        };

        const isSameHostOrigin = (req: express.Request, origin: string | undefined): boolean => {
            if (!origin) return false;
            try {
                const originUrl = new URL(origin);
                const reqHost = getRequestHost(req);
                if (!reqHost) return false;
                // Direct match: host:port === host:port or host === host
                if (originUrl.host === reqHost) return true;
                // Match when standard port was omitted
                const reqHostname = reqHost.split(':')[0];
                if (originUrl.hostname === reqHostname && !originUrl.port) {
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        };

        app.use(cors((req, callback) => {
            const origin = req.headers.origin;
            // In dev mode without configured origins, allow all for dev convenience
            if (!isProduction && configuredOrigins.length === 0) {
                return callback(null, { origin: true, credentials: true });
            }
            // Allow server-to-server, same-host requests (where browser sends Origin on POST/PUT/DELETE), or matched origins
            if (!origin || allowedOrigins.has(origin) || isSameHostOrigin(req, origin)) {
                return callback(null, { origin: true, credentials: true });
            }
            return callback(null, { origin: false });
        }));
        // Cross-site request forgery: the session cookie is SameSite=lax, and on top of that a state-changing request
        // that the browser marks as cross-site / same-site-but-different-origin is refused unless its Origin is allowed.
        app.use((req, res, next) => {
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
            const site = req.headers['sec-fetch-site'];
            const origin = req.headers.origin;
            if (site === 'cross-site' && !origin) {
                return res.status(403).json({ message: 'Cross-site request blocked.' });
            }
            if ((site === 'cross-site' || site === 'same-site') && origin) {
                const sameHost = isSameHostOrigin(req, origin);
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
                res.status(200).json({
                    status: 'healthy',
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString(),
                });
            } catch (err: any) {
                console.error('Health check failed:', err?.message || err);
                res.status(503).json({ status: 'unhealthy' });
            }
        });

        app.use('/api/auth', authRouter);
        app.use('/api/data', dataRouter);
        app.use('/api/enable-banking', enableBankingRouter);
        app.use('/api/users', usersRouter);
        app.use('/api/lock', lockRouter);
        app.use('/api/smart-fetch', smartFetcherRouter);
        app.use('/api/alerts', alertsRouter);
        app.use('/api/tokens', tokensRouter);
        app.use('/api/v1', publicApiRouter);
        app.use('/api/mcp', mcpRouter);

        // Last line of defence: anything that escapes a route becomes a JSON 500, never a crash or an HTML page.
        app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (res.headersSent) return next(err);
            if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large.' });
            if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON.' });
            console.error('Unhandled request error:', err?.message || err);
            res.status(500).json({ message: 'Internal server error.' });
        });

        void purgeStaleSessions();
        startAlertScheduler();
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
