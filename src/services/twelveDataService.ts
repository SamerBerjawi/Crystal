import { Currency } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export interface ExchangeRateResponse {
    symbol: string;
    rate: number;
    timestamp: number;
}

/** Rate limiter: TwelveData free tier allows 8 API credits per minute. Keep at least 250ms spacing between outbound calls. */
let lastOutboundCall = 0;
const MIN_CALL_INTERVAL_MS = 250;

async function rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const elapsed = now - lastOutboundCall;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL_MS - elapsed));
    }
    lastOutboundCall = Date.now();
    return fetchWithTimeout(url);
}

/** A usable exchange rate is a finite number above zero; anything else is an error, never silently 1:1. */
const asRate = (value: unknown, label: string): number => {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
        throw new Error(`TwelveData returned no usable exchange rate for ${label}.`);
    }
    return n;
};

export async function fetchExchangeRate(from: Currency, to: Currency, apiKey: string): Promise<number> {
    if (from === to) return 1;

    const symbol = `${from}/${to}`;
    const url = `https://api.twelvedata.com/exchange_rate?symbol=${symbol}&apikey=${apiKey}`;

    const response = await rateLimitedFetch(url);
    if (!response.ok) {
        throw new Error(`TwelveData API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === 'error') {
        const msg = String(data.message || 'API error');
        if (data.code === 429 || /rate limit|api credits/i.test(msg)) {
            throw new Error(`Twelve Data rate limit reached: ${msg}`);
        }
        throw new Error(`TwelveData API error: ${msg}`);
    }

    return asRate(data.rate, symbol);
}

export interface SymbolMetadata {
    symbol: string;
    name: string;
    type: string;
    currency: string;
    exchange: string;
}

export async function fetchSymbolMetadata(symbol: string, apiKey: string): Promise<SymbolMetadata | null> {
    if (!apiKey || !symbol) return null;

    const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`;
    
    try {
        const response = await rateLimitedFetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.status === 'error' || !data.name) return null;

        return {
            symbol: data.symbol,
            name: data.name,
            type: data.type,
            currency: data.currency,
            exchange: data.exchange
        };
    } catch (error) {
        console.error('Error fetching symbol metadata:', error);
        return null;
    }
}

export async function searchSymbols(query: string, apiKey?: string): Promise<SymbolMetadata[]> {
    if (!apiKey) return [];
    const clean = query.trim();
    if (clean.length < 2) return [];
    const params = new URLSearchParams({ symbol: clean, outputsize: '6', apikey: apiKey });
    try {
        const response = await rateLimitedFetch(`https://api.twelvedata.com/symbol_search?${params.toString()}`);
        if (!response.ok) return [];
        const data = await response.json();
        if (!Array.isArray(data?.data)) return [];
        const seen = new Set<string>();
        const results: SymbolMetadata[] = [];
        for (const item of data.data) {
            const sym = String(item.symbol || '').trim();
            const exch = String(item.exchange || '').trim();
            const key = `${sym}:${exch}`;
            if (!sym || seen.has(key)) continue;
            seen.add(key);
            results.push({
                symbol: sym,
                name: String(item.instrument_name || sym),
                type: String(item.instrument_type || 'Common Stock'),
                currency: String(item.currency || 'EUR').toUpperCase(),
                exchange: exch,
            });
        }
        return results;
    } catch {
        return [];
    }
}

export interface Quote { price: number; currency: Currency; exchange?: string }

/** A quote's price and currency. Refuses a quote with no currency, because guessing is how a USD price gets valued as EUR (DEF-04). */
export const parseQuote = (data: Record<string, unknown>, supported: readonly string[]): Quote => {
    if (data.status === 'error' || data.code) {
        const msg = String(data.message || 'Unable to fetch price');
        if (data.code === 429 || /rate limit|api credits/i.test(msg)) {
            throw new Error(`Twelve Data rate limit reached: ${msg}`);
        }
        throw new Error(msg);
    }
    const price = Number(data.close ?? data.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price returned');
    const currency = String(data.currency || data.currency_quote || '').toUpperCase();
    if (!supported.includes(currency)) throw new Error(`Twelve Data quoted this in ${currency || 'an unknown currency'}`);
    return { price, currency: currency as Currency, exchange: data.exchange ? String(data.exchange) : undefined };
};

/** The latest quote for a ticker, from one exchange when you've chosen it. */
export async function fetchQuote(symbol: string, apiKey: string, exchange: string | undefined, supported: readonly string[]): Promise<Quote> {
    if (!apiKey) throw new Error('Missing Twelve Data API key');
    const params = new URLSearchParams({ symbol: symbol.toUpperCase(), apikey: apiKey });
    if (exchange) params.set('exchange', exchange);
    const response = await rateLimitedFetch(`https://api.twelvedata.com/quote?${params.toString()}`);
    return parseQuote(await response.json(), supported);
}

export async function fetchAllExchangeRates(base: Currency, targets: Currency[], apiKey: string): Promise<Record<string, number>> {
    const rates: Record<string, number> = { [base]: 1 };
    
    const symbolsToFetch = targets.filter(t => t !== base).map(t => `${t}/${base}`);
    if (symbolsToFetch.length === 0) return rates;

    const url = `https://api.twelvedata.com/exchange_rate?symbol=${symbolsToFetch.join(',')}&apikey=${apiKey}`;
    
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
        throw new Error(`TwelveData API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (symbolsToFetch.length === 1) {
        if (data.status === 'error') {
            const msg = String(data.message || 'TwelveData exchange rate error');
            if (data.code === 429 || /rate limit|api credits/i.test(msg)) {
                throw new Error(`Twelve Data rate limit reached: ${msg}`);
            }
            throw new Error(msg);
        }
        rates[targets.find(t => t !== base)!] = asRate(data.rate, `${base}/${targets.find(t => t !== base)}`);
    } else {
        if (data.status === 'error') {
            const msg = String(data.message || 'TwelveData exchange rate error');
            if (data.code === 429 || /rate limit|api credits/i.test(msg)) {
                throw new Error(`Twelve Data rate limit reached: ${msg}`);
            }
            throw new Error(msg);
        }
        // Batch response is an object with symbols as keys
        Object.entries(data).forEach(([symbol, result]: [string, any]) => {
            if (result.status === 'error') {
                console.warn(`Failed to fetch rate for ${symbol}: ${result.message}`);
                return;
            }
            const fromCurrency = symbol.split('/')[0] as Currency;
            try {
                rates[fromCurrency] = asRate(result.rate, symbol);
            } catch (error) {
                console.warn(String((error as Error).message));
            }
        });
    }

    return rates;
}

/** A ticker on its own listing, then as a EUR pair for crypto. A pair like BTC/USD is asked for as it's written. */
export async function fetchBestQuote(ticker: string, apiKey: string, exchange: string | undefined, supported: readonly string[]): Promise<Quote> {
    const symbol = ticker.toUpperCase();
    if (symbol.includes('/')) return fetchQuote(symbol, apiKey, undefined, supported);
    try {
        return await fetchQuote(symbol, apiKey, exchange, supported);
    } catch (error) {
        if (exchange) throw error;
        return fetchQuote(`${symbol}/EUR`, apiKey, undefined, supported);
    }
}
