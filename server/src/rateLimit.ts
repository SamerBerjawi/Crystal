import { RequestHandler } from 'express';

type Entry = {
  count: number;
  resetAt: number;
  blockedUntil?: number;
};

const stores = new Map<string, Map<string, Entry>>();

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
