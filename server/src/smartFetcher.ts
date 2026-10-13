import express from 'express';
import { authenticateToken, AuthRequest } from './middleware';
import { createRateLimiter } from './rateLimit';
import { safeFetchText, UrlBlockedError, FetchTooLargeError, FetchTimeoutError } from './urlGuard';

const smartFetcherRouter = express.Router();

const smartFetchLimiter = createRateLimiter({
    namespace: 'smart-fetch',
    windowMs: 60 * 1000,
    maxAttempts: 30,
    blockMs: 60 * 1000,
    message: 'Too many price lookups. Please wait a minute and try again.',
    key: req => `${(req as AuthRequest).user?.id || req.ip}`,
});

// Fetches a public web page on behalf of a signed-in user so the browser can read a price from it.
smartFetcherRouter.get('/', authenticateToken, smartFetchLimiter, async (req: AuthRequest, res) => {
    const targetUrl = req.query.url;
    const rawCookies = typeof req.query.cookies === 'string' ? req.query.cookies : '';

    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'A URL query param is required.' });
    }
    if (rawCookies.length > 4096 || /[\r\n]/.test(rawCookies)) {
        return res.status(400).json({ error: 'Invalid cookies value.' });
    }

    try {
        const result = await safeFetchText(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                ...(rawCookies ? { Cookie: rawCookies } : {}),
            },
        });

        if (result.status < 200 || result.status >= 300) {
            return res.status(502).json({ error: `Failed to fetch target (${result.status})` });
        }
        res.type('text/html').send(result.body);
    } catch (error) {
        if (error instanceof UrlBlockedError) return res.status(400).json({ error: error.message });
        if (error instanceof FetchTooLargeError) return res.status(413).json({ error: 'The page is too large.' });
        if (error instanceof FetchTimeoutError) return res.status(504).json({ error: 'The page took too long to respond.' });
        console.error('Smart fetch proxy failed', error);
        res.status(502).json({ error: 'Unable to fetch the requested page.' });
    }
});

export default smartFetcherRouter;
