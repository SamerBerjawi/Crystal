import express from 'express';
import { authenticateToken, AuthRequest } from './middleware';
import { lookup } from 'dns/promises';
import net from 'net';

const smartFetcherRouter = express.Router();
const COOKIE_MAX_LENGTH = 4096;

const allowedHosts = (process.env.SMART_FETCH_ALLOWED_HOSTS || '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

const isPrivateIp = (ip: string) => {
    const normalized = ip.toLowerCase();
    if (normalized === '0.0.0.0' || normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('127.')) return true;
    if (normalized.startsWith('10.')) return true;
    if (normalized.startsWith('192.168.')) return true;
    if (normalized.startsWith('169.254.')) return true;
    if (normalized.startsWith('172.')) {
        const octet = Number.parseInt(normalized.split('.')[1] || '', 10);
        if (octet >= 16 && octet <= 31) return true;
    }
    return normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
};

const isAllowedHostname = (hostname: string) => {
    if (!allowedHosts.length) return false;
    return allowedHosts.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`));
};

const validateTarget = async (targetUrl: string) => {
    const url = new URL(targetUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only http and https URLs are allowed.');
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('Localhost access is not allowed.');
    }

    if (!isAllowedHostname(hostname)) {
        throw new Error('Target host is not in the allow-list.');
    }

    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
            throw new Error('Target host resolves to a private network.');
        }
        return url;
    }

    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length) {
        throw new Error('Unable to resolve target host.');
    }

    if (resolved.some(record => isPrivateIp(record.address))) {
        throw new Error('Target host resolves to a private network.');
    }

    return url;
};

smartFetcherRouter.post('/', authenticateToken, async (req: AuthRequest, res) => {
    const targetUrl = req.body?.url;
    const cookies = typeof req.body?.cookies === 'string' ? req.body.cookies : '';

    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'A URL body field is required.' });
    }

    if (cookies && cookies.length > COOKIE_MAX_LENGTH) {
        return res.status(400).json({ error: 'Cookies are too long.' });
    }

    try {
        const url = await validateTarget(targetUrl);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                ...(cookies ? { Cookie: cookies } : {}),
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch target (${response.status})` });
        }

        const html = await response.text();
        res.type('text/html').send(html);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to fetch the requested page.';
        console.error('Smart fetch proxy failed', error);
        res.status(400).json({ error: message });
    }
});

export default smartFetcherRouter;
