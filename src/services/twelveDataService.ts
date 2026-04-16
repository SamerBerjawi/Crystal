import { Currency } from '../../types';

export interface ExchangeRateResponse {
    symbol: string;
    rate: number;
    timestamp: number;
}

export async function fetchExchangeRate(from: Currency, to: Currency, apiKey: string): Promise<number> {
    if (from === to) return 1;

    const symbol = `${from}/${to}`;
    const url = `https://api.twelvedata.com/exchange_rate?symbol=${symbol}&apikey=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TwelveData API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === 'error') {
        throw new Error(`TwelveData API error: ${data.message}`);
    }

    return data.rate;
}

export async function fetchAllExchangeRates(base: Currency, targets: Currency[], apiKey: string): Promise<Record<string, number>> {
    const rates: Record<string, number> = { [base]: 1 };
    
    // TwelveData supports batch requests for some endpoints, but exchange_rate might need individual calls or a comma-separated list if supported.
    // Let's try individual calls for now to be safe, or check if they support multiple symbols.
    // Actually, TwelveData supports comma-separated symbols for many endpoints.
    
    const symbolsToFetch = targets.filter(t => t !== base).map(t => `${t}/${base}`);
    if (symbolsToFetch.length === 0) return rates;

    const url = `https://api.twelvedata.com/exchange_rate?symbol=${symbolsToFetch.join(',')}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TwelveData API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (symbolsToFetch.length === 1) {
        if (data.status === 'error') throw new Error(data.message);
        rates[targets.find(t => t !== base)!] = data.rate;
    } else {
        // Batch response is an object with symbols as keys
        Object.entries(data).forEach(([symbol, result]: [string, any]) => {
            if (result.status === 'error') {
                console.warn(`Failed to fetch rate for ${symbol}: ${result.message}`);
                return;
            }
            const fromCurrency = symbol.split('/')[0] as Currency;
            rates[fromCurrency] = result.rate;
        });
    }

    return rates;
}
