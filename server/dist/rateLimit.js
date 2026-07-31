"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = void 0;
const stores = new Map();
const getStore = (namespace) => {
    let store = stores.get(namespace);
    if (!store) {
        store = new Map();
        stores.set(namespace, store);
    }
    return store;
};
const createRateLimiter = ({ namespace, windowMs, maxAttempts, blockMs, message, key, }) => {
    return (req, res, next) => {
        const store = getStore(namespace);
        const now = Date.now();
        const entryKey = key(req);
        const entry = store.get(entryKey);
        if (entry?.blockedUntil && entry.blockedUntil > now) {
            return res.status(429).json({ message });
        }
        if (!entry || entry.resetAt <= now) {
            store.set(entryKey, { count: 1, resetAt: now + windowMs });
            return next();
        }
        entry.count += 1;
        if (entry.count > maxAttempts) {
            entry.blockedUntil = now + blockMs;
            return res.status(429).json({ message });
        }
        return next();
    };
};
exports.createRateLimiter = createRateLimiter;
