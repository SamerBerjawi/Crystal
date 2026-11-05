import { RequestHandler } from 'express';

type Entry = {
    count: number;
    resetAt: number;
    blockedUntil?: number;
};

const stores = new Map<string, Map<string, Entry>>();
const MAX_ENTRIES_PER_STORE = 10_000;

type RateLimitOptions = {
    namespace: string;
    windowMs: number;
    maxAttempts: number;
    blockMs: number;
    message: string;
    key: (req: Parameters<RequestHandler>[0]) => string;
};

const getStore = (namespace: string) => {
    let store = stores.get(namespace);
    if (!store) {
        store = new Map<string, Entry>();
        stores.set(namespace, store);
    }
    return store;
};

export const createRateLimiter = ({
    namespace,
    windowMs,
    maxAttempts,
    blockMs,
    message,
    key,
}: RateLimitOptions): RequestHandler => {
    return (req, res, next) => {
        const store = getStore(namespace);
        const now = Date.now();
        const entryKey = key(req);
        const entry = store.get(entryKey);

        if (entry?.blockedUntil && entry.blockedUntil > now) {
            const retryAfterSec = Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));
            res.setHeader?.('Retry-After', String(retryAfterSec));
            return res.status(429).json({ message });
        }

        if (!entry || entry.resetAt <= now) {
            if (!entry && store.size >= MAX_ENTRIES_PER_STORE) {
                sweepExpiredEntries(now);
                if (store.size >= MAX_ENTRIES_PER_STORE) {
                    const oldestKey = store.keys().next().value;
                    if (oldestKey !== undefined) store.delete(oldestKey);
                }
            }
            store.set(entryKey, { count: 1, resetAt: now + windowMs });
            return next();
        }

        entry.count += 1;
        if (entry.count > maxAttempts) {
            entry.blockedUntil = now + blockMs;
            const retryAfterSec = Math.max(1, Math.ceil(blockMs / 1000));
            res.setHeader?.('Retry-After', String(retryAfterSec));
            return res.status(429).json({ message });
        }

        return next();
    };
};

export const sweepExpiredEntries = (now = Date.now()) => {
    let sweptCount = 0;
    for (const [namespace, store] of stores.entries()) {
        for (const [key, entry] of store.entries()) {
            const isBlocked = Boolean(entry.blockedUntil && entry.blockedUntil > now);
            const isWindowActive = entry.resetAt > now;
            if (!isBlocked && !isWindowActive) {
                store.delete(key);
                sweptCount++;
            }
        }
        if (store.size === 0) {
            stores.delete(namespace);
        }
    }
    return sweptCount;
};

// Periodic sweep every 60 seconds to prevent unbounded memory growth
const sweepInterval = setInterval(() => {
    sweepExpiredEntries();
}, 60000);

if (sweepInterval.unref) {
    sweepInterval.unref();
}
