import express from 'express';

const smartFetcherRouter = express.Router();

smartFetcherRouter.get('/', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'A URL query param is required.' });
    }

    try {
        const url = new URL(targetUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: 'Only http and https URLs are allowed.' });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch target (${response.status})` });
        }

        const html = await response.text();
        res.type('text/html').send(html);
    } catch (error) {
        console.error('Smart fetch proxy failed', error);
        res.status(500).json({ error: 'Unable to fetch the requested page.' });
    }
});

export default smartFetcherRouter;
