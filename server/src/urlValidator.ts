import { URL } from 'url';

export function isAllowedTargetUrl(targetUrlStr: string): { allowed: boolean; reason?: string } {
    if (!targetUrlStr || typeof targetUrlStr !== 'string') {
        return { allowed: false, reason: 'Target URL must be a non-empty string.' };
    }

    try {
        const url = new URL(targetUrlStr);

        if (!['http:', 'https:'].includes(url.protocol)) {
            return { allowed: false, reason: 'Only http and https protocols are permitted.' };
        }

        const hostname = url.hostname.toLowerCase();

        // SSRF Check: Block loopback, private IP ranges, and AWS/cloud metadata IPs
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            hostname === '::' ||
            hostname.startsWith('169.254.') || // Link-local / Cloud Metadata (169.254.169.254)
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
        ) {
            return { allowed: false, reason: 'Access to internal network addresses is forbidden.' };
        }

        const configuredDomains = (process.env.ALLOWED_PROXY_DOMAINS || '')
            .split(',')
            .map(d => d.trim().toLowerCase())
            .filter(Boolean);

        if (configuredDomains.length > 0 && !configuredDomains.includes('*')) {
            const isAllowedDomain = configuredDomains.some(domain =>
                hostname === domain || hostname.endsWith(`.${domain}`)
            );

            if (!isAllowedDomain) {
                return { allowed: false, reason: `Target domain '${hostname}' is not in the proxy allowlist.` };
            }
        }

        return { allowed: true };
    } catch {
        return { allowed: false, reason: 'Invalid URL format.' };
    }
};

export default isAllowedTargetUrl;

