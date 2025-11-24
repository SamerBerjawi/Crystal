import { InvestmentSubType } from '../types';

export interface QuoteTarget {
  symbol: string;
  subType?: InvestmentSubType;
}

const mapToYahooSymbol = ({ symbol, subType }: QuoteTarget): { querySymbol: string; original: string } => {
  const trimmed = symbol.trim().toUpperCase();
  if (subType === 'Crypto') {
    if (trimmed.includes('-') || trimmed.includes('=')) {
      return { querySymbol: trimmed, original: symbol };
    }
    return { querySymbol: `${trimmed}-USD`, original: symbol };
  }
  return { querySymbol: trimmed, original: symbol };
};

const extractPrice = (quote: any): number | null => {
  const price = quote?.regularMarketPrice ?? quote?.postMarketPrice ?? quote?.preMarketPrice;
  if (price === undefined || price === null) return null;
  const parsed = Number(price);
  return Number.isFinite(parsed) ? parsed : null;
};

export const fetchYahooPrices = async (targets: QuoteTarget[]): Promise<Record<string, number | null>> => {
  if (!Array.isArray(targets) || targets.length === 0) return {};

  const mapped = targets.map(mapToYahooSymbol);
  const symbolMap = mapped.reduce<Record<string, string>>((acc, { querySymbol, original }) => {
    acc[querySymbol] = original;
    return acc;
  }, {});

  const querySymbols = Array.from(new Set(mapped.map(t => t.querySymbol))).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(querySymbols)}`;

  const prices: Record<string, number | null> = {};
  targets.forEach(t => {
    prices[t.symbol] = null;
  });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Yahoo Finance quote request failed', response.status, response.statusText);
      return prices;
    }

    const data = await response.json();
    const results = data?.quoteResponse?.result || [];
    results.forEach((quote: any) => {
      const originalSymbol = symbolMap[quote.symbol];
      if (!originalSymbol) return;
      prices[originalSymbol] = extractPrice(quote);
    });
  } catch (error) {
    console.warn('Failed to fetch Yahoo Finance prices', error);
  }

  return prices;
};
