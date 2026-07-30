"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedTargetUrl = isAllowedTargetUrl;
const url_1 = require("url");
const DEFAULT_ALLOWED_DOMAINS = [
    'api.twelvedata.com',
    'twelvedata.com',
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
];
function isAllowedTargetUrl(targetUrlStr) {
    if (!targetUrlStr || typeof targetUrlStr !== 'string') {
        return { allowed: false, reason: 'Target URL must be a non-empty string.' };
    }
    try {
        const url = new url_1.URL(targetUrlStr);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return { allowed: false, reason: 'Only http and https protocols are permitted.' };
        }
        const hostname = url.hostname.toLowerCase();
        // SSRF Check: Block loopback, private IP ranges, and AWS/cloud metadata IPs
        if (hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            hostname === '::' ||
            hostname.startsWith('169.254.') || // Link-local / Cloud Metadata (169.254.169.254)
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
            return { allowed: false, reason: 'Access to internal network addresses is forbidden.' };
        }
        const configuredDomains = (process.env.ALLOWED_PROXY_DOMAINS || '')
            .split(',')
            .map(d => d.trim().toLowerCase())
            .filter(Boolean);
        const allowedDomains = configuredDomains.length > 0 ? configuredDomains : DEFAULT_ALLOWED_DOMAINS;
        if (allowedDomains.includes('*')) {
            return { allowed: true };
        }
        const isAllowedDomain = allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
        if (!isAllowedDomain) {
            return { allowed: false, reason: `Target domain '${hostname}' is not in the proxy allowlist.` };
        }
        return { allowed: true };
    }
    catch {
        return { allowed: false, reason: 'Invalid URL format.' };
    }
}
;
exports.default = isAllowedTargetUrl;
