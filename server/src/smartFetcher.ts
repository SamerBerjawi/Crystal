import express from 'express';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { authenticateToken } from './middleware';

const smartFetcherRouter = express.Router();

const BLOCKED_HOSTNAMES = new Set(['localhost']);
const ALLOWED_HOSTS = (process.env.SMART_FETCH_ALLOWED_HOSTS || '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

const isAllowedHost = (hostname: string) => {
    if (!ALLOWED_HOSTS.length) return true;
    return ALLOWED_HOSTS.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`));
};

const ipv4ToInt = (ip: string) =>
    ip
        .split('.')
        .map(octet => parseInt(octet, 10))
        .reduce((acc, octet) => ((acc << 8) | octet) >>> 0, 0);

const isPrivateIpv4 = (ip: string) => {
    const value = ipv4ToInt(ip);
    const inRange = (start: string, end: string) => {
        const startValue = ipv4ToInt(start);
        const endValue = ipv4ToInt(end);
        return value >= startValue && value <= endValue;
    };

    return (
        inRange('0.0.0.0', '0.255.255.255') ||
        inRange('10.0.0.0', '10.255.255.255') ||
        inRange('100.64.0.0', '100.127.255.255') ||
        inRange('127.0.0.0', '127.255.255.255') ||
        inRange('169.254.0.0', '169.254.255.255') ||
        inRange('172.16.0.0', '172.31.255.255') ||
        inRange('192.168.0.0', '192.168.255.255')
    );
};

const isPrivateIpv6 = (ip: string) => {
    const normalized = ip.toLowerCase();
    return (
        normalized === '::1' ||
        normalized === '::' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80')
    );
};

const isPrivateAddress = (ip: string) => {
    const ipVersion = net.isIP(ip);
    if (ipVersion === 4) return isPrivateIpv4(ip);
    if (ipVersion === 6) return isPrivateIpv6(ip);
    return true;
};

const resolveAndValidateHost = async (hostname: string) => {
    if (BLOCKED_HOSTNAMES.has(hostname)) {
        throw new Error('Blocked hostname');
    }
    if (!isAllowedHost(hostname)) {
        throw new Error('Host not allowed');
    }

    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length) {
        throw new Error('Unable to resolve host');
    }
    for (const address of addresses) {
        if (isPrivateAddress(address.address)) {
            throw new Error('Blocked private address');
        }
    }
};

smartFetcherRouter.get('/', authenticateToken, async (req, res) => {
    const targetUrl = req.query.url;
    const cookies = typeof req.query.cookies === 'string' ? req.query.cookies : '';

    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'A URL query param is required.' });
    }

    try {
        const url = new URL(targetUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: 'Only http and https URLs are allowed.' });
        }
        if (!url.hostname) {
            return res.status(400).json({ error: 'A valid hostname is required.' });
        }

        await resolveAndValidateHost(url.hostname.toLowerCase());

        const response = await fetch(url, {
            redirect: 'manual',
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
        console.error('Smart fetch proxy failed', error);
        res.status(500).json({ error: 'Unable to fetch the requested page.' });
    }
});

export default smartFetcherRouter;
