import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import type { PricePoint } from '../../utils/benchmark';

export interface BenchmarkChoice { symbol: string; exchange?: string; label: string }

export interface BenchmarkSeries { symbol: string; currency: string; points: PricePoint[]; asOf: string }

/** Ready-made choices. Tracking funds, because plain index symbols usually need a paid Twelve Data plan. */
export const BENCHMARK_PRESETS: BenchmarkChoice[] = [
  { symbol: 'SPY', label: 'S&P 500 (SPY)' },
  { symbol: 'URTH', label: 'MSCI World (URTH)' },
  { symbol: 'QQQ', label: 'Nasdaq 100 (QQQ)' },
  { symbol: 'VWCE', exchange: 'XETR', label: 'FTSE All-World (VWCE)' },
];

export const choiceKey = (c: BenchmarkChoice) => c.exchange ? `${c.symbol}:${c.exchange}` : c.symbol;

/** "SPY" or "VWCE:XETR" as typed. Null when it is not a ticker. */
export const parseChoice = (text: string): BenchmarkChoice | null => {
  const [symbol, exchange] = text.trim().toUpperCase().split(':');
  if (!/^[A-Z0-9.\-/^]{1,24}$/.test(symbol ?? '') || (exchange !== undefined && !/^[A-Z0-9]{2,12}$/.test(exchange))) return null;
  return { symbol, exchange, label: exchange ? `${symbol} · ${exchange}` : symbol };
};

/** Daily prices from the server, which keeps them for a day. Your Twelve Data key travels in a header, never in the address. */
export async function fetchBenchmarkHistory(choice: BenchmarkChoice, from: string, apiKey: string): Promise<BenchmarkSeries> {
  const params = new URLSearchParams({ symbol: choice.symbol, from });
  if (choice.exchange) params.set('exchange', choice.exchange);
  const response = await fetchWithTimeout(`/api/benchmarks/history?${params.toString()}`, { headers: { 'X-Twelve-Data-Key': apiKey }, credentials: 'include', timeoutMs: 30_000 });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || body?.message || `Could not load ${choice.symbol} (${response.status}).`);
  return body as BenchmarkSeries;
}
