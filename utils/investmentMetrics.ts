import type { Currency, HoldingSummary, InvestmentTransaction, Warrant } from '../types';
import { parseLocalDate, round2 } from '../utils';

/*
 * Investment metrics: what your investments earned per year, how much of the pot is your own money, and how
 * concentrated it is. Pure, and tested in tests/unit/investmentMetrics.test.ts.
 *
 * Returns are money-weighted (XIRR): every buy, sale and grant is a dated cash flow, and today's value closes the
 * series. Amounts are converted at today's exchange rates, since only today's rates are stored. A holding with no live
 * price is valued at its last trade or cost, which would make its return meaningless, so it is left out of returns.
 */

export interface Flow { date: string; amount: number }

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The yearly rate that makes the dated flows add up to zero (negative is money in, positive is money out or value now).
 * Null when it cannot be worked out: the flows need both signs, and a very short or wild series has no sensible rate.
 */
export const xirr = (flows: Flow[]): number | null => {
  const usable = flows.filter(flow => Number.isFinite(flow.amount) && flow.amount !== 0);
  if (!usable.some(f => f.amount < 0) || !usable.some(f => f.amount > 0)) return null;
  const times = usable.map(flow => parseLocalDate(flow.date).getTime());
  const origin = Math.min(...times);
  const years = times.map(time => (time - origin) / DAY_MS / 365);
  const value = (rate: number) => usable.reduce((sum, flow, i) => sum + flow.amount / Math.pow(1 + rate, years[i]), 0);
  let lo = -0.9999;
  let hi = 100;
  let fLo = value(lo);
  const fHi = value(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = value(mid);
    if (Math.abs(fMid) < 1e-9 || hi - lo < 1e-12) return mid;
    if (fLo * fMid < 0) hi = mid; else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
};

/** Below this, a yearly rate says more about the timing than about the investment. */
export const MIN_RELIABLE_DAYS = 90;

export interface HoldingPerformance {
  symbol: string;
  name: string;
  /** Everything bought, in EUR. */
  invested: number;
  /** Everything sold, in EUR. */
  proceeds: number;
  /** Worth today, in EUR. Zero once sold out. */
  value: number;
  /** Proceeds plus value less invested: realized and unrealized together. */
  gain: number;
  /** Gain as a share of invested. Null when nothing was bought. */
  gainPct: number | null;
  /** Value back for each unit put in. */
  multiple: number | null;
  /** Yearly money-weighted return, or null when it cannot be told. */
  xirr: number | null;
  days: number;
  /** False for a short history, where a yearly rate would mislead. */
  reliable: boolean;
  open: boolean;
  /** No live price, so the value is a stand-in and the return is not worked out. */
  priced: boolean;
}

export interface PortfolioPerformance {
  invested: number;
  proceeds: number;
  value: number;
  gain: number;
  gainPct: number | null;
  xirr: number | null;
  days: number;
  reliable: boolean;
  /** Holdings left out of the return for want of a price. */
  excluded: number;
}

export interface Concentration {
  top?: { symbol: string; name: string; share: number };
  top3Share: number;
  /** How many equal holdings would spread the money as unevenly: 1 / sum of squared shares. */
  effectiveHoldings: number;
  level: 'balanced' | 'concentrated' | 'very concentrated' | 'single';
  currencies: { currency: string; share: number; value: number }[];
}

export interface Performance {
  holdings: HoldingPerformance[];
  portfolio: PortfolioPerformance;
  /** The money you put in against what it grew into. */
  contributions: { net: number; growth: number; value: number; growthShare: number | null };
  concentration: Concentration;
}

export interface PerformanceInput {
  trades: InvestmentTransaction[];
  grants?: Warrant[];
  holdings: HoldingSummary[];
  today: Date;
  toEur?: (amount: number, currency: Currency) => number;
  currencyOf?: (symbol: string) => Currency;
}

export const buildPerformance = ({ trades, grants = [], holdings, today, toEur = a => a, currencyOf = () => 'EUR' as Currency }: PerformanceInput): Performance => {
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const bySymbol = new Map<string, { name: string; flows: Flow[]; invested: number; proceeds: number; first: string }>();
  const touch = (symbol: string, name: string) => {
    const key = symbol.toUpperCase();
    const entry = bySymbol.get(key) ?? { name, flows: [], invested: 0, proceeds: 0, first: '9999-12-31' };
    bySymbol.set(key, entry);
    return entry;
  };

  const events = [
    ...grants.filter(w => w.isin).map(w => ({ symbol: w.isin, name: w.name, date: w.grantDate, amount: -toEur((Number(w.quantity) || 0) * (Number(w.grantPrice) || 0), currencyOf(w.isin)) })),
    ...trades.filter(t => t.symbol).map(t => {
      const value = toEur((Number(t.quantity) || 0) * (Number(t.price) || 0), t.currency ?? currencyOf(t.symbol));
      return { symbol: t.symbol, name: t.name || t.symbol, date: t.date, amount: t.type?.toLowerCase() === 'buy' ? -value : value };
    }),
  ];
  events.forEach(event => {
    const entry = touch(event.symbol, event.name);
    entry.flows.push({ date: event.date, amount: event.amount });
    if (event.amount < 0) entry.invested += -event.amount; else entry.proceeds += event.amount;
    if (event.date < entry.first) entry.first = event.date;
  });

  const held = new Map(holdings.map(h => [h.symbol.toUpperCase(), h]));
  const daysSince = (iso: string) => Math.max(0, Math.round((parseLocalDate(todayIso).getTime() - parseLocalDate(iso).getTime()) / DAY_MS));

  const rows: HoldingPerformance[] = [...bySymbol.entries()].map(([symbol, entry]) => {
    const holding = held.get(symbol);
    const open = !!holding && holding.quantity > 0.000001;
    const value = open ? holding!.currentValue : 0;
    const priced = !open || !holding!.priceUnavailable;
    const days = daysSince(entry.first);
    const gain = entry.proceeds + value - entry.invested;
    const rate = priced ? xirr([...entry.flows, ...(value > 0 ? [{ date: todayIso, amount: value }] : [])]) : null;
    return {
      symbol, name: holding?.name || entry.name, invested: round2(entry.invested), proceeds: round2(entry.proceeds), value: round2(value), gain: round2(gain),
      gainPct: entry.invested > 0 ? gain / entry.invested : null, multiple: entry.invested > 0 ? (entry.proceeds + value) / entry.invested : null,
      xirr: rate, days, reliable: rate !== null && days >= MIN_RELIABLE_DAYS, open, priced,
    };
  }).sort((a, b) => b.value - a.value || b.invested - a.invested);

  // The whole portfolio: every priced holding's flows together, closed by what they are worth now.
  const pricedRows = rows.filter(r => r.priced);
  const allFlows = pricedRows.flatMap(r => bySymbol.get(r.symbol)!.flows);
  const pricedValue = pricedRows.reduce((sum, r) => sum + r.value, 0);
  const portfolioDays = pricedRows.length ? Math.max(...pricedRows.map(r => r.days)) : 0;
  const portfolioRate = xirr([...allFlows, ...(pricedValue > 0 ? [{ date: todayIso, amount: pricedValue }] : [])]);
  const invested = pricedRows.reduce((sum, r) => sum + r.invested, 0);
  const proceeds = pricedRows.reduce((sum, r) => sum + r.proceeds, 0);
  const gain = proceeds + pricedValue - invested;
  const portfolio: PortfolioPerformance = {
    invested: round2(invested), proceeds: round2(proceeds), value: round2(pricedValue), gain: round2(gain), gainPct: invested > 0 ? gain / invested : null,
    xirr: portfolioRate, days: portfolioDays, reliable: portfolioRate !== null && portfolioDays >= MIN_RELIABLE_DAYS, excluded: rows.length - pricedRows.length,
  };

  const net = invested - proceeds;
  const contributions = { net: round2(net), growth: round2(pricedValue - net), value: round2(pricedValue), growthShare: pricedValue > 0 ? (pricedValue - net) / pricedValue : null };

  // Concentration looks at everything held today, priced or not.
  const open = holdings.filter(h => h.quantity > 0.000001 && h.currentValue > 0).sort((a, b) => b.currentValue - a.currentValue);
  const total = open.reduce((sum, h) => sum + h.currentValue, 0);
  const shares = open.map(h => h.currentValue / (total || 1));
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);
  const top = open[0];
  const top3Share = shares.slice(0, 3).reduce((sum, s) => sum + s, 0);
  const byCurrency = new Map<string, number>();
  open.forEach(h => byCurrency.set(h.currency ?? currencyOf(h.symbol), (byCurrency.get(h.currency ?? currencyOf(h.symbol)) ?? 0) + h.currentValue));
  const level: Concentration['level'] = open.length <= 1 ? 'single' : shares[0] > 0.5 ? 'very concentrated' : shares[0] > 0.3 || top3Share > 0.75 ? 'concentrated' : 'balanced';
  const concentration: Concentration = {
    top: top ? { symbol: top.symbol, name: top.name, share: shares[0] } : undefined,
    top3Share, effectiveHoldings: hhi > 0 ? 1 / hhi : 0, level,
    currencies: [...byCurrency.entries()].map(([currency, value]) => ({ currency, value: round2(value), share: total > 0 ? value / total : 0 })).sort((a, b) => b.value - a.value),
  };

  return { holdings: rows, portfolio, contributions, concentration };
};
