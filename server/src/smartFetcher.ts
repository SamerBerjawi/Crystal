import express from 'express';
import { authenticateToken, AuthRequest } from './middleware';
import { isAllowedTargetUrl } from './urlValidator';

const smartFetcherRouter = express.Router();

smartFetcherRouter.use(authenticateToken);

smartFetcherRouter.get('/', async (req: AuthRequest, res) => {
    const targetUrl = req.query.url;
    const cookies = typeof req.query.cookies === 'string' ? req.query.cookies : '';

    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'A URL query param is required.' });
    }

    const validation = isAllowedTargetUrl(targetUrl);
    if (!validation.allowed) {
        return res.status(403).json({ error: validation.reason || 'Forbidden target domain.' });
    }

    try {
        const url = new URL(targetUrl);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,fr;q=0.7',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                ...(cookies ? { Cookie: cookies } : {}),
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            return res.status(502).json({ error: `Target server returned status ${response.status}` });
        }

        const html = await response.text();
        res.type('text/html').send(html);
    } catch (error) {
        console.error('Smart fetch proxy failed', error);
        res.status(500).json({ error: 'Unable to fetch the requested page.' });
    }
});

export default smartFetcherRouter;
