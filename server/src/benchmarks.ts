import express from 'express';
import { authenticateToken, AuthRequest } from './middleware';
import { createRateLimiter } from './rateLimit';

const benchmarksRouter = express.Router();

export interface PricePoint { date: string; close: number }
export interface BenchmarkSeries { symbol: string; currency: string; name?: string; points: PricePoint[]; fetchedAt: number; requestedFrom: string }

const SYMBOL = /^[A-Za-z0-9.:\-/^]{1,24}$/;
const EXCHANGE = /^[A-Za-z0-9]{2,12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED = 100;

/** Reads Twelve Data's time_series reply. Throws with a plain message when it is an error or holds no usable prices. */
export const parseTimeSeries = (data: any, symbol: string): Omit<BenchmarkSeries, 'fetchedAt' | 'requestedFrom'> => {
    if (!data || data.status === 'error' || data.code) {
        const message = String(data?.message || 'Twelve Data returned an error');
        throw new Error(/api credits|rate limit/i.test(message) ? `Twelve Data rate limit reached: ${message}` : message);
    }
    const values: unknown[] = Array.isArray(data.values) ? data.values : [];
    const byDay = new Map<string, number>();
    for (const row of values as any[]) {
        const date = String(row?.datetime ?? '').slice(0, 10);
        const close = Number(row?.close);
        if (DAY.test(date) && Number.isFinite(close) && close > 0) byDay.set(date, close);
    }
    if (byDay.size === 0) throw new Error(`No price history for ${symbol}`);
    const currency = String(data.meta?.currency ?? '').toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(currency)) throw new Error(`Twelve Data gave no currency for ${symbol}`);
    return {
        symbol: String(data.meta?.symbol ?? symbol).toUpperCase(),
        currency,
        name: data.meta?.exchange ? `${symbol.toUpperCase()} · ${data.meta.exchange}` : undefined,
        points: [...byDay.entries()].map(([date, close]) => ({ date, close })).sort((a, b) => a.date.localeCompare(b.date)),
    };
};

// Market prices are public, so one cache serves every user. A request asking for earlier history than the cache holds refetches.
const cache = new Map<string, BenchmarkSeries>();
const inflight = new Map<string, Promise<BenchmarkSeries>>();

const limiter = createRateLimiter({
    namespace: 'benchmarks',
    windowMs: 60 * 1000,
    maxAttempts: 20,
    blockMs: 60 * 1000,
    message: 'Too many benchmark lookups. Please wait a minute and try again.',
    key: req => `${(req as AuthRequest).user?.id || req.ip}`,
});

const load = async (symbol: string, exchange: string, from: string, apiKey: string): Promise<BenchmarkSeries> => {
    const key = exchange ? `${symbol.toUpperCase()}:${exchange.toUpperCase()}` : symbol.toUpperCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS && hit.requestedFrom <= from) return hit;
    const running = inflight.get(key);
    if (running) return running;
    const job = (async () => {
        const params = new URLSearchParams({ symbol: symbol.toUpperCase(), interval: '1day', start_date: from, order: 'ASC', outputsize: '5000', apikey: apiKey });
        params.set('symbol', symbol.toUpperCase());
        if (exchange) params.set('exchange', exchange.toUpperCase());
        const response = await fetch(`https://api.twelvedata.com/time_series?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
        const series = { ...parseTimeSeries(await response.json(), symbol.toUpperCase()), fetchedAt: Date.now(), requestedFrom: from };
        if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
        cache.set(key, series);
        return series;
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
};

// GET /api/benchmarks/history?symbol=SPY&exchange=NYSE&from=2020-01-01, with the Twelve Data key in the X-Twelve-Data-Key header.
benchmarksRouter.get('/history', authenticateToken, limiter, async (req: AuthRequest, res) => {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim() : '';
    const exchange = typeof req.query.exchange === 'string' ? req.query.exchange.trim() : '';
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const apiKey = String(req.header('x-twelve-data-key') ?? '').trim();
    if (!SYMBOL.test(symbol)) return res.status(400).json({ error: 'A valid symbol is required.' });
    if (exchange && !EXCHANGE.test(exchange)) return res.status(400).json({ error: 'That exchange code is not valid.' });
    if (!DAY.test(from)) return res.status(400).json({ error: 'A from date (YYYY-MM-DD) is required.' });
    if (!apiKey || apiKey.length > 128) return res.status(400).json({ error: 'A Twelve Data API key is required.' });
    try {
        const { fetchedAt, requestedFrom: _from, ...series } = await load(symbol, exchange, from, apiKey);
        res.json({ ...series, asOf: new Date(fetchedAt).toISOString() });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to fetch prices';
        res.status(/rate limit/i.test(message) ? 429 : 502).json({ error: message });
    }
});

export default benchmarksRouter;
