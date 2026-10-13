import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

/** Raised when a URL targets something the server must never fetch on a user's behalf. */
export class UrlBlockedError extends Error {}
export class FetchTooLargeError extends Error {}
export class FetchTimeoutError extends Error {}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and unspecified addresses. */
export const isPrivateIp = (ip: string): boolean => {
    if (net.isIPv4(ip)) {
        const [a, b, c] = ip.split('.').map(Number);
        return (
            a === 0 || a === 10 || a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||        // CGNAT 100.64.0.0/10
            (a === 169 && b === 254) ||                  // link-local + cloud metadata
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 192 && b === 0 && c === 0) ||         // IETF protocol assignments
            (a === 198 && (b === 18 || b === 19)) ||     // benchmarking
            a >= 224                                     // multicast + reserved + broadcast
        );
    }
    if (net.isIPv6(ip)) {
        const v6 = ip.toLowerCase();
        if (v6 === '::' || v6 === '::1') return true;
        const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateIp(mapped[1]);
        const mappedHex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (mappedHex) {
            const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16);
            return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
        }
        return /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff');   // ULA, link-local, multicast
    }
    return true; // not an IP at all: treat as unsafe
};

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/** Validates scheme and (if a literal IP or obviously internal name) host; DNS is checked at connect time. */
export const parsePublicHttpUrl = (raw: string): URL => {
    let url: URL;
    try { url = new URL(raw); } catch { throw new UrlBlockedError('Invalid URL.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new UrlBlockedError('Only http and https URLs are allowed.');
    if (url.username || url.password) throw new UrlBlockedError('URLs with credentials are not allowed.');
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!host || host === 'localhost' || BLOCKED_HOST_SUFFIXES.some(s => host.endsWith(s))) {
        throw new UrlBlockedError('That address is not allowed.');
    }
    if (net.isIP(host) && isPrivateIp(host)) throw new UrlBlockedError('That address is not allowed.');
    return url;
};

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: any, family?: number) => void;

/** DNS lookup that refuses private results. Used as the socket's resolver, so the checked IP is the connected IP. */
const guardedLookup = (hostname: string, options: any, callback: LookupCallback) => {
    dns.promises.lookup(hostname, { all: true }).then(
        addresses => {
            if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) {
                return callback(new UrlBlockedError('That address is not allowed.') as NodeJS.ErrnoException);
            }
            if (options && options.all) return callback(null, addresses);
            callback(null, addresses[0].address, addresses[0].family);
        },
        err => callback(err),
    );
};

export interface SafeFetchOptions {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
}

export interface SafeFetchResult { status: number; body: string; finalUrl: string }

const requestOnce = (url: URL, opts: Required<SafeFetchOptions>): Promise<{ status: number; location?: string; body: string }> =>
    new Promise((resolve, reject) => {
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.request(url, { method: 'GET', headers: opts.headers, lookup: guardedLookup as any, timeout: opts.timeoutMs }, res => {
            const status = res.statusCode || 0;
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                return resolve({ status, location: String(res.headers.location), body: '' });
            }
            const chunks: Buffer[] = [];
            let size = 0;
            res.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > opts.maxBytes) { req.destroy(new FetchTooLargeError('Response too large.')); return; }
                chunks.push(chunk);
            });
            res.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new FetchTimeoutError('Request timed out.')));
        req.on('error', reject);
        req.end();
    });

/** GET a public http(s) URL as text: blocks internal targets (incl. via redirects/DNS), bounds time and size. */
export const safeFetchText = async (rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> => {
    const opts: Required<SafeFetchOptions> = {
        headers: options.headers ?? {},
        timeoutMs: options.timeoutMs ?? 10_000,
        maxBytes: options.maxBytes ?? 2 * 1024 * 1024,
        maxRedirects: options.maxRedirects ?? 3,
    };
    let url = parsePublicHttpUrl(rawUrl);
    for (let hop = 0; hop <= opts.maxRedirects; hop++) {
        const res = await requestOnce(url, opts);
        if (res.location) {
            url = parsePublicHttpUrl(new URL(res.location, url).toString());
            continue;
        }
        return { status: res.status, body: res.body, finalUrl: url.toString() };
    }
    throw new UrlBlockedError('Too many redirects.');
};
