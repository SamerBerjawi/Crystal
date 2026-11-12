import { parseLocalDate, round2 } from '../utils';
import { xirr, type Flow } from './investmentMetrics';

/*
 * Benchmark replay: what the same money would be worth had every buy and sale gone into an index instead, on the same
 * days. Pure, and tested in tests/unit/benchmark.test.ts.
 *
 * The replay is in the index's own currency, with your flows converted at today's rates, so a benchmark quoted in another
 * currency also carries that currency's moves. Pick one listed in your main currency to compare like with like.
 */

export interface PricePoint { date: string; close: number }

export interface BenchmarkPoint {
  date: string;
  /** What the replay is worth on this day. */
  index: number;
  /** Net money put in up to this day. */
  invested: number;
}

export interface BenchmarkResult {
  /** The index replay's worth now. */
  indexValue: number;
  indexGain: number;
  indexXirr: number | null;
  /** The last price date used. */
  asOf: string;
  /** Your priced holdings' worth now, minus the replay's. Positive means you beat the index. */
  lead: number | null;
  /** Your yearly return minus the index's, as a fraction. */
  leadPerYear: number | null;
  points: BenchmarkPoint[];
  /** Some of your money went in before the price history starts, so those buys were priced at its first day. */
  startsBeforeData: boolean;
  /** Your sales were larger than the replay held, so it ran out of units. */
  shortfall: boolean;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const buildBenchmark = ({ flows, series, yourValue, yourXirr }: { flows: Flow[]; series: PricePoint[]; yourValue: number; yourXirr: number | null }): BenchmarkResult | null => {
  const prices = series.filter(p => Number.isFinite(p.close) && p.close > 0).sort((a, b) => a.date.localeCompare(b.date));
  const dated = flows.filter(f => f.amount !== 0 && Number.isFinite(f.amount)).sort((a, b) => a.date.localeCompare(b.date));
  if (prices.length === 0 || dated.length === 0) return null;

  // Last close on or before a day; before the history starts, the first close.
  let cursor = 0;
  const priceOn = (date: string) => {
    while (cursor + 1 < prices.length && prices[cursor + 1].date <= date) cursor++;
    return prices[cursor].close;
  };
  const resetCursor = () => { cursor = 0; };

  let units = 0;
  let shortfall = false;
  const startsBeforeData = dated[0].date < prices[0].date;
  const unitsAfter: { date: string; units: number; invested: number }[] = [];
  let invested = 0;
  dated.forEach(flow => {
    const price = priceOn(flow.date);
    if (flow.amount < 0) { units += -flow.amount / price; invested += -flow.amount; }
    else {
      const wanted = flow.amount / price;
      if (wanted > units + 1e-9) shortfall = true;
      units = Math.max(0, units - wanted);
      invested -= flow.amount;
    }
    unitsAfter.push({ date: flow.date, units, invested });
  });

  const last = prices[prices.length - 1];
  const indexValue = units * last.close;
  const indexRate = xirr([...dated, { date: last.date, amount: indexValue }]);

  // A point per month from the first flow to the last price, holding the units as they stood that day.
  resetCursor();
  const points: BenchmarkPoint[] = [];
  const start = parseLocalDate(dated[0].date);
  const end = parseLocalDate(last.date);
  let step = 0;
  for (let d = new Date(start); d <= end; d = new Date(start.getFullYear(), start.getMonth() + (++step), start.getDate())) {
    const day = iso(d);
    const done = unitsAfter.filter(u => u.date <= day);
    const state = done[done.length - 1];
    points.push({ date: day, index: round2((state?.units ?? 0) * priceOn(day)), invested: round2(state?.invested ?? 0) });
  }
  const finalState = unitsAfter[unitsAfter.length - 1];
  if (points[points.length - 1]?.date !== last.date) points.push({ date: last.date, index: round2(indexValue), invested: round2(finalState.invested) });

  return {
    indexValue: round2(indexValue), indexGain: round2(indexValue - finalState.invested + 0),
    indexXirr: indexRate, asOf: last.date,
    lead: yourValue > 0 ? round2(yourValue - indexValue) : null,
    leadPerYear: yourXirr !== null && indexRate !== null ? yourXirr - indexRate : null,
    points, startsBeforeData, shortfall,
  };
};
