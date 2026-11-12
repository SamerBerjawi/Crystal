import { round2 } from '../utils';

/*
 * The odds of independence. Instead of one date, this runs thousands of possible futures with year-to-year market luck
 * and asks how many of them still have money at the end of retirement, for each year you could stop working.
 * Pure, seeded (the same inputs always give the same picture), and tested in tests/unit/fireCone.test.ts.
 *
 * Everything is in today's money. The expected return is a REAL return (after inflation), so spending and saving need no
 * inflation adjustment. It is arithmetic on your own figures, not advice: returns here are random draws, not history.
 */

/** A one-off amount at a date: positive money in (an inheritance), negative money out (a house deposit, a gap year). */
export interface PlanEvent { id?: string; label: string; date: string; amount: number }

export interface ConeInput {
  /** What the counted accounts hold today. */
  start: number;
  /** Added every month until you stop working. */
  monthlySaving: number;
  /** Spent every year once you stop working. */
  annualSpending: number;
  /** Average yearly return after inflation, as a fraction (0.05 is 5%). */
  expectedReturn: number;
  /** Yearly ups and downs, as a fraction. 0.12 is a portfolio that is mostly shares. */
  volatility: number;
  /** How many years the money has to last after you stop working. */
  planYears: number;
  today: Date;
  events?: PlanEvent[];
  /** The share of futures that must work out for a date to count as "on course". */
  targetOdds?: number;
  /** The year, counted from now, to draw the range of outcomes for. Left out, the earliest on-course year (or the last one). */
  retireInYears?: number;
  /** How far ahead to look for a stopping year. */
  maxWaitYears?: number;
  paths?: number;
  seed?: number;
}

export interface FanPoint { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }

export interface Cone {
  /** For each year you could stop working (0 is now), the share of futures where the money lasts. */
  curve: { years: number; odds: number }[];
  /** The first year that reaches the target odds, or null. */
  earliest: number | null;
  chosen: { years: number; odds: number; fan: FanPoint[]; endMedian: number; endP10: number };
  targetOdds: number;
}

/** What is kept between visits. Anything left out falls back to your own figures or the defaults. */
export interface FireSettings {
  stopIn?: number; spending?: number; saving?: number; expectedReturn?: number; volatility?: number; planYears?: number; events?: PlanEvent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Settings as stored, made safe: wild values pulled into range, malformed events dropped. */
export const normalizeFireSettings = (raw: unknown): FireSettings => {
  const i = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const events = (Array.isArray(i.events) ? i.events : []).flatMap((e: any): PlanEvent[] =>
    e && typeof e.label === 'string' && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && num(e.amount) && e.amount !== 0
      ? [{ id: typeof e.id === 'string' ? e.id : undefined, label: e.label.slice(0, 60), date: e.date, amount: round2(clamp(e.amount, -1e9, 1e9)) }] : []).slice(0, 20);
  return {
    stopIn: num(i.stopIn) ? Math.round(clamp(i.stopIn, 0, 35)) : undefined,
    spending: num(i.spending) ? round2(clamp(i.spending, 0, 1e8)) : undefined,
    saving: num(i.saving) ? round2(clamp(i.saving, 0, 1e7)) : undefined,
    expectedReturn: num(i.expectedReturn) ? clamp(i.expectedReturn, 0, 0.15) : undefined,
    volatility: num(i.volatility) ? clamp(i.volatility, 0, 0.5) : undefined,
    planYears: num(i.planYears) ? Math.round(clamp(i.planYears, 5, 70)) : undefined,
    events,
  };
};

export const DEFAULTS = { targetOdds: 0.85, maxWaitYears: 40, paths: 2000, seed: 20240229 } as const;

/** A small seeded generator, so a picture does not change when the page redraws. */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Standard normal draws, one row of `months` per path. Shared by every stopping year so the curve compares like with like. */
export const makeShocks = (paths: number, months: number, seed: number): Float32Array => {
  const random = mulberry32(seed);
  const out = new Float32Array(paths * months);
  for (let i = 0; i < out.length; i += 2) {
    const u = Math.max(random(), 1e-12);
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    out[i] = radius * Math.cos(2 * Math.PI * v);
    if (i + 1 < out.length) out[i + 1] = radius * Math.sin(2 * Math.PI * v);
  }
  return out;
};

/** Whole months from today to a date (0 is this month). Dates in the past are negative and do not count. */
export const monthOffset = (today: Date, date: string): number => {
  const [y, m] = date.split('-').map(Number);
  if (!y || !m) return -1;
  return (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth());
};

interface Run {
  start: number; saving: number; spend: number; mean: number; vol: number;
  retireMonth: number; totalMonths: number; eventAt: Map<number, number>;
}

/** Walks every path. Returns how many lasted, and (when asked) every path's value at each year end. */
const walk = (shocks: Float32Array, paths: number, stride: number, run: Run, keepYears: boolean) => {
  const sigma = run.vol / Math.sqrt(12);
  // Log returns shifted so the average yearly growth is the expected return, not lower from the ups and downs.
  const drift = Math.log(1 + run.mean) / 12 - (sigma * sigma) / 2;
  const years = Math.floor(run.totalMonths / 12);
  const yearEnds = keepYears ? new Float64Array(paths * (years + 1)) : null;
  let lasted = 0;
  const ends = new Float64Array(paths);
  for (let p = 0; p < paths; p++) {
    let value = run.start;
    let failed = false;
    if (yearEnds) yearEnds[p * (years + 1)] = value;
    const row = p * stride;
    for (let month = 1; month <= run.totalMonths; month++) {
      value *= Math.exp(drift + sigma * shocks[row + month - 1]);
      value += month <= run.retireMonth ? run.saving : -run.spend / 12;
      const event = run.eventAt.get(month);
      if (event) value += event;
      if (value <= 0) {
        // Running out before you stop working is a setback; running out after is the failure.
        if (month > run.retireMonth) failed = true;
        value = 0;
      }
      if (yearEnds && month % 12 === 0) yearEnds[p * (years + 1) + month / 12] = value;
    }
    if (!failed) lasted += 1;
    ends[p] = value;
  }
  return { lasted, yearEnds, years, ends };
};

const percentile = (sorted: ArrayLike<number>, share: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(share * (sorted.length - 1) + 0.5)))];

export const buildCone = (input: ConeInput): Cone => {
  const targetOdds = input.targetOdds ?? DEFAULTS.targetOdds;
  const maxWait = input.maxWaitYears ?? DEFAULTS.maxWaitYears;
  const paths = input.paths ?? DEFAULTS.paths;
  const seed = input.seed ?? DEFAULTS.seed;
  const planYears = Math.max(1, Math.round(input.planYears));
  const totalMonths = (maxWait + planYears) * 12;
  const shocks = makeShocks(paths, totalMonths, seed);

  const eventAt = new Map<number, number>();
  (input.events ?? []).forEach(event => {
    const month = monthOffset(input.today, event.date);
    if (month >= 0 && Number.isFinite(event.amount)) eventAt.set(Math.max(1, month), (eventAt.get(Math.max(1, month)) ?? 0) + event.amount);
  });
  const runFor = (retireYears: number): Run => ({
    start: input.start, saving: input.monthlySaving, spend: input.annualSpending, mean: input.expectedReturn, vol: Math.max(0, input.volatility),
    retireMonth: retireYears * 12, totalMonths: (retireYears + planYears) * 12, eventAt,
  });

  const curve: Cone['curve'] = [];
  for (let years = 0; years <= maxWait; years++) {
    curve.push({ years, odds: walk(shocks, paths, totalMonths, runFor(years), false).lasted / paths });
  }
  const earliest = curve.find(point => point.odds >= targetOdds)?.years ?? null;

  const wanted = input.retireInYears !== undefined ? Math.min(maxWait, Math.max(0, Math.round(input.retireInYears))) : earliest ?? maxWait;
  const { yearEnds, years, ends } = walk(shocks, paths, totalMonths, runFor(wanted), true);
  const fan: FanPoint[] = [];
  for (let y = 0; y <= years; y++) {
    const column = new Float64Array(paths);
    for (let p = 0; p < paths; p++) column[p] = yearEnds![p * (years + 1) + y];
    column.sort();
    fan.push({ year: y, p10: round2(percentile(column, 0.1)), p25: round2(percentile(column, 0.25)), p50: round2(percentile(column, 0.5)), p75: round2(percentile(column, 0.75)), p90: round2(percentile(column, 0.9)) });
  }
  const sortedEnds = Float64Array.from(ends).sort();
  return {
    curve, earliest, targetOdds,
    chosen: { years: wanted, odds: curve[wanted].odds, fan, endMedian: round2(percentile(sortedEnds, 0.5)), endP10: round2(percentile(sortedEnds, 0.1)) },
  };
};
