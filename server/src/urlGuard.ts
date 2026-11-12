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
        let v6 = ip.toLowerCase();
        // Canonicalize expanded/shorthand IPv6 via WHATWG URL parser (e.g. 0:0:0:0:0:0:0:1 -> ::1)
        try {
            const canonical = new URL(`http://[${v6}]/`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
            if (canonical) v6 = canonical;
        } catch { /* keep v6 */ }
        if (v6 === '::' || v6 === '::1') return true;
        const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateIp(mapped[1]);
        const mappedHex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (mappedHex) {
            const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16);
            return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
        }
        // 6to4 (2002::/16) embeds an IPv4 address in the next 32 bits
        const sixToFour = v6.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/);
        if (sixToFour) {
            const hi = parseInt(sixToFour[1], 16), lo = parseInt(sixToFour[2], 16);
            if (isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)) return true;
        }
        // NAT64 (64:ff9b::/96 and 64:ff9b:1::/48), discard (100::/64), documentation (2001:db8::/32)
        if (/^64:ff9b(?::|$)/.test(v6) || /^100::/.test(v6) || /^2001:db8(?::|$)/.test(v6)) return true;
        return /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff');   // ULA, link-local, multicast
    }
    return true; // not an IP at all: treat as unsafe
};

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/** Validates scheme and (if a literal IP or obviously internal name) host; DNS is checked at connect time. */
export const parsePublicHttpUrl = (raw: string, allowPrivate = false): URL => {
    let url: URL;
    try { url = new URL(raw); } catch { throw new UrlBlockedError('Invalid URL.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new UrlBlockedError('Only http and https URLs are allowed.');
    if (url.username || url.password) throw new UrlBlockedError('URLs with credentials are not allowed.');
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!host) throw new UrlBlockedError('That address is not allowed.');
    // The operator can allow LAN targets (a self-hosted ntfy or Gotify). Everything else stays blocked.
    if (allowPrivate) return url;
    if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some(s => host.endsWith(s))) {
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
    method?: 'GET' | 'POST';
    /** Request body for POST. */
    body?: string;
    /** Skip the private-address checks. Only for destinations the server operator has approved. */
    allowPrivate?: boolean;
}

export interface SafeFetchResult { status: number; body: string; finalUrl: string }

const requestOnce = (url: URL, opts: Required<Omit<SafeFetchOptions, 'body'>> & { body?: string }): Promise<{ status: number; location?: string; body: string }> =>
    new Promise((resolve, reject) => {
        const lib = url.protocol === 'https:' ? https : http;
        const headers = opts.body !== undefined ? { ...opts.headers, 'Content-Length': String(Buffer.byteLength(opts.body)) } : opts.headers;
        const req = lib.request(url, { method: opts.method, headers, ...(opts.allowPrivate ? {} : { lookup: guardedLookup as any }), timeout: opts.timeoutMs }, res => {
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
        req.end(opts.body);
    });

/** Fetch a public http(s) URL as text: blocks internal targets (incl. via redirects/DNS), bounds time and size. */
export const safeFetchText = async (rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> => {
    const opts: Required<Omit<SafeFetchOptions, 'body'>> & { body?: string } = {
        headers: options.headers ?? {},
        timeoutMs: options.timeoutMs ?? 10_000,
        maxBytes: options.maxBytes ?? 2 * 1024 * 1024,
        maxRedirects: options.maxRedirects ?? 3,
        method: options.method ?? 'GET',
        body: options.body,
        allowPrivate: options.allowPrivate ?? false,
    };
    let url = parsePublicHttpUrl(rawUrl, opts.allowPrivate);
    for (let hop = 0; hop <= opts.maxRedirects; hop++) {
        const res = await requestOnce(url, opts);
        if (res.location) {
            // A redirect never carries a POST body along, and never leaves a destination the checks have approved.
            url = parsePublicHttpUrl(new URL(res.location, url).toString(), opts.allowPrivate);
            opts.method = 'GET';
            opts.body = undefined;
            continue;
        }
        return { status: res.status, body: res.body, finalUrl: url.toString() };
    }
    throw new UrlBlockedError('Too many redirects.');
};

export interface SafeStreamOptions {
    method?: 'GET' | 'POST' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    /** Longest the connection may sit idle, in milliseconds. A model that is still downloading or thinking keeps it alive. */
    idleTimeoutMs?: number;
    /** Skip the private-address checks. Only for destinations the operator, or the sole user of this server, approved. */
    allowPrivate?: boolean;
}

export interface SafeStreamResult { status: number; headers: http.IncomingHttpHeaders; stream: http.IncomingMessage; abort: () => void }

/**
 * Starts a request and hands back the response as a stream, without reading it. For answers that arrive over time (a
 * model's tokens, a download's progress). Redirects are not followed: a 3xx comes back as it is, so a destination the
 * checks approved cannot send the request somewhere they did not.
 */
export const safeRequestStream = (rawUrl: string, options: SafeStreamOptions = {}): Promise<SafeStreamResult> =>
    new Promise((resolve, reject) => {
        let url: URL;
        try { url = parsePublicHttpUrl(rawUrl, options.allowPrivate ?? false); } catch (error) { return reject(error); }
        const lib = url.protocol === 'https:' ? https : http;
        const headers = options.body !== undefined ? { ...options.headers, 'Content-Length': String(Buffer.byteLength(options.body)) } : options.headers;
        const req = lib.request(url, {
            method: options.method ?? 'GET',
            headers,
            timeout: options.idleTimeoutMs ?? 120_000,
            ...(options.allowPrivate ? {} : { lookup: guardedLookup as any }),
        }, res => resolve({ status: res.statusCode || 0, headers: res.headers, stream: res, abort: () => req.destroy() }));
        req.on('timeout', () => req.destroy(new FetchTimeoutError('The server stopped answering.')));
        req.on('error', reject);
        req.end(options.body);
    });
