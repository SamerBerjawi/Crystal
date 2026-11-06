import { safeAdd, safeRound } from '../utils';
import { isoDay, monthLabel, parseDay } from './accountPagesModel';

/**
 * Pure figures for the Activity tab on every account page. Rows carry amounts already in the account's currency,
 * signed as they move its balance, so this file is only dates and arithmetic.
 */

export type ActivityRange = '30d' | '90d' | '1y' | 'all';
export type ActivityKind = 'all' | 'in' | 'out';

export interface ActivityRow<T = unknown> {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  /** Lower-case text the search box looks in. */
  text: string;
  item: T;
}

export const RANGE_DAYS: Record<Exclude<ActivityRange, 'all'>, number> = { '30d': 30, '90d': 90, '1y': 365 };
export const RANGE_NAMES: Record<ActivityRange, string> = { '30d': '30 days', '90d': '90 days', '1y': 'year', all: 'all time' };

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** First day (inclusive) of a range ending today, or undefined for all time. */
export const rangeStart = (range: ActivityRange, today = new Date()): string | undefined =>
  range === 'all' ? undefined : isoDay(addDays(today, -(RANGE_DAYS[range] - 1)));

export function inRange<T>(rows: ActivityRow<T>[], range: ActivityRange, today = new Date()): ActivityRow<T>[] {
  const start = rangeStart(range, today);
  const end = isoDay(today);
  return rows.filter(row => row.date <= end && (!start || row.date >= start));
}

/** The same number of days straight before the range, to compare against. Undefined for all time. */
export function previousRange<T>(rows: ActivityRow<T>[], range: ActivityRange, today = new Date()): ActivityRow<T>[] | undefined {
  if (range === 'all') return undefined;
  const days = RANGE_DAYS[range];
  const end = isoDay(addDays(today, -days));
  const start = isoDay(addDays(today, -(days * 2 - 1)));
  return rows.filter(row => row.date >= start && row.date <= end);
}

export interface ActivityFilters {
  kind: ActivityKind;
  query: string;
  category?: string;
}

export function filterRows<T>(rows: ActivityRow<T>[], { kind, query, category }: ActivityFilters): ActivityRow<T>[] {
  const needle = query.trim().toLowerCase();
  return rows.filter(row =>
    (kind === 'all' || (kind === 'in' ? row.amount > 0 : row.amount < 0))
    && (!category || row.category === category)
    && (!needle || row.text.includes(needle)));
}

export interface ActivitySummary {
  in: number;
  out: number; // positive
  net: number;
  count: number;
  largestIn?: ActivityRow;
  largestOut?: ActivityRow;
}

export function summarize<T>(rows: ActivityRow<T>[]): ActivitySummary {
  let inflow = 0;
  let outflow = 0;
  let largestIn: ActivityRow<T> | undefined;
  let largestOut: ActivityRow<T> | undefined;
  rows.forEach(row => {
    if (row.amount > 0) {
      inflow = safeAdd(inflow, row.amount);
      if (!largestIn || row.amount > largestIn.amount) largestIn = row;
    } else if (row.amount < 0) {
      outflow = safeAdd(outflow, -row.amount);
      if (!largestOut || row.amount < largestOut.amount) largestOut = row;
    }
  });
  return { in: safeRound(inflow, 2), out: safeRound(outflow, 2), net: safeRound(inflow - outflow, 2), count: rows.length, largestIn, largestOut };
}

/** How much a figure moved against the one before, as a percentage. Undefined when there was nothing to compare with. */
export const changePercent = (now: number, before: number): number | undefined =>
  before === 0 ? undefined : Math.round(((now - before) / Math.abs(before)) * 100);

/** Totals by category, largest first, for money going out (or in). The rest folds into "Other" after `limit`. */
export function byCategory<T>(rows: ActivityRow<T>[], direction: 'in' | 'out', limit = 6): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  rows.forEach(row => {
    if (direction === 'out' ? row.amount >= 0 : row.amount <= 0) return;
    const label = row.category || 'Uncategorised';
    totals.set(label, safeAdd(totals.get(label) ?? 0, Math.abs(row.amount)));
  });
  const sorted = [...totals.entries()].map(([label, value]) => ({ label, value: safeRound(value, 2) })).sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit - 1).reduce((sum, item) => safeAdd(sum, item.value), 0);
  return [...sorted.slice(0, limit - 1), { label: 'Other', value: safeRound(rest, 2) }];
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Money out on each weekday, Monday first. Shows which days the account is busy. */
export function byWeekday<T>(rows: ActivityRow<T>[]): { name: string; out: number; count: number }[] {
  const days = WEEKDAYS.map(name => ({ name, out: 0, count: 0 }));
  rows.forEach(row => {
    if (row.amount >= 0) return;
    const slot = days[(parseDay(row.date).getDay() + 6) % 7];
    slot.out = safeAdd(slot.out, -row.amount);
    slot.count += 1;
  });
  return days.map(day => ({ ...day, out: safeRound(day.out, 2) }));
}

export interface DayGroup<T = unknown> {
  date: string;
  /** "Today", "Yesterday", or the weekday and date. */
  label: string;
  net: number;
  rows: ActivityRow<T>[];
}

export function dayLabel(date: string, today = new Date()): string {
  const target = parseDay(date);
  const gap = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - target.getTime()) / 86_400_000);
  if (gap === 0) return 'Today';
  if (gap === 1) return 'Yesterday';
  const sameYear = target.getFullYear() === today.getFullYear();
  return target.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Rows grouped by day, newest first, each day with what it netted. */
export function groupByDay<T>(rows: ActivityRow<T>[], today = new Date()): DayGroup<T>[] {
  const groups = new Map<string, ActivityRow<T>[]>();
  [...rows].sort((a, b) => b.date.localeCompare(a.date)).forEach(row => groups.set(row.date, [...(groups.get(row.date) ?? []), row]));
  return [...groups.entries()].map(([date, items]) => ({
    date,
    label: dayLabel(date, today),
    net: safeRound(items.reduce((sum, row) => safeAdd(sum, row.amount), 0), 2),
    rows: items,
  }));
}

export type FlowUnit = 'weeks' | 'months' | 'quarters';
export const FLOW_UNITS: { id: FlowUnit; label: string }[] = [{ id: 'weeks', label: 'Weeks' }, { id: 'months', label: 'Months' }, { id: 'quarters', label: 'Quarters' }];
export const FLOW_COUNT: Record<FlowUnit, number> = { weeks: 12, months: 12, quarters: 8 };

/** One transaction as the money-flow chart sees it. `amount` is signed as it moves the account's balance. */
export interface FlowRow {
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  /** Who paid in: the merchant, or the description. */
  source: string;
}

export interface FlowPeriod {
  id: string;
  short: string;
  long: string;
  inValue: number;
  outValue: number;
  /** The account's balance when the period ended. Absent when the chart has no balance to follow. */
  balance?: number;
  /** The period has not finished yet. */
  isOpen: boolean;
  /** Where the money went, largest first. */
  categories: { name: string; value: number; share: number }[];
  topSource?: { name: string; value: number };
}

const longRange = (start: Date, end: Date) => `${dayName(start)} to ${dayName(end)}`;
const dayName = (date: Date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The last N weeks, months or quarters, oldest first, ending with the one that holds today. */
export function flowBounds(unit: FlowUnit, today = new Date()): { start: Date; end: Date; short: string; long: string }[] {
  const count = FLOW_COUNT[unit];
  const bounds: { start: Date; end: Date; short: string; long: string }[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    let start: Date;
    let end: Date;
    if (unit === 'weeks') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - back * 7);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    } else if (unit === 'months') {
      start = new Date(today.getFullYear(), today.getMonth() - back, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    } else {
      start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 - back * 3, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    }
    const quarter = `Q${Math.floor(start.getMonth() / 3) + 1}`;
    bounds.push({
      start,
      end,
      short: unit === 'months' ? start.toLocaleDateString(undefined, { month: 'short' }) : unit === 'quarters' ? quarter : dayName(start),
      long: unit === 'months' ? start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : unit === 'quarters' ? `${quarter} ${start.getFullYear()}` : longRange(start, end),
    });
  }
  return bounds;
}

/**
 * Money in and out period by period, the way the Money flow widget reads it. With a balance for today, each period also
 * carries the balance when it ended, worked back from today through what moved since.
 */
export function flowPeriods(rows: FlowRow[], unit: FlowUnit, todayBalance?: number, today = new Date()): FlowPeriod[] {
  const todayKey = isoDay(today);
  return flowBounds(unit, today).map(({ start, end, short, long }) => {
    const from = isoDay(start);
    const to = isoDay(end);
    let inflow = 0;
    let outflow = 0;
    let after = 0;
    const categories = new Map<string, number>();
    const sources = new Map<string, number>();
    rows.forEach(row => {
      if (row.date > todayKey) return;
      if (row.date > to) { after = safeAdd(after, row.amount); return; }
      if (row.date < from) return;
      if (row.amount >= 0) {
        inflow = safeAdd(inflow, row.amount);
        sources.set(row.source, safeAdd(sources.get(row.source) ?? 0, row.amount));
      } else {
        outflow = safeAdd(outflow, -row.amount);
        categories.set(row.category || 'Uncategorised', safeAdd(categories.get(row.category || 'Uncategorised') ?? 0, -row.amount));
      }
    });
    const topSource = [...sources.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      id: from,
      short,
      long,
      inValue: safeRound(inflow, 2),
      outValue: safeRound(outflow, 2),
      balance: todayBalance === undefined ? undefined : safeRound(todayBalance - after, 2),
      isOpen: to >= todayKey,
      categories: [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, value]) => ({ name, value: safeRound(value, 2), share: outflow > 0 ? value / outflow : 0 })),
      topSource: topSource ? { name: topSource[0], value: safeRound(topSource[1], 2) } : undefined,
    };
  });
}

/** Periods from monthly totals a page already has (loan payments, contributions), oldest first. */
export function monthPeriods(items: { month: string; in: number; out: number }[], today = new Date()): FlowPeriod[] {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return items.map(item => {
    const [year, month] = item.month.split('-').map(Number);
    return {
      id: item.month,
      short: monthLabel(item.month),
      long: new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      inValue: item.in,
      outValue: item.out,
      isOpen: item.month >= current,
      categories: [],
    };
  });
}

/** What the page's transactions look like to the flow chart. */
export const flowRowsOf = (transactions: { date: string; category?: string; merchant?: string; description?: string; amount: number }[], convert: (tx: any) => number): FlowRow[] =>
  transactions.map(tx => ({ date: tx.date.slice(0, 10), amount: convert(tx), category: tx.category || '', source: tx.merchant?.trim() || tx.description || 'Transaction' }));

export interface DaySpend {
  out: number;
  count: number;
}

/** What went out each day, transfers left out, and how many transactions the day had. */
export function spendByDay<T extends { transferId?: string }>(rows: ActivityRow<T>[]): Map<string, DaySpend> {
  const days = new Map<string, DaySpend>();
  rows.forEach(row => {
    const day = days.get(row.date) ?? { out: 0, count: 0 };
    day.count += 1;
    if (row.amount < 0 && !row.item.transferId) day.out = safeAdd(day.out, -row.amount);
    days.set(row.date, day);
  });
  return days;
}

/** The calendar never shows more than this much history, whatever the range. */
export const HEAT_MAX_DAYS = 365 * 3;

/** First day the calendar shows for a range. All time starts at the first transaction, within the cap. */
export function heatStart(range: ActivityRange, earliest: string | undefined, today = new Date()): Date {
  const cap = addDays(today, -(HEAT_MAX_DAYS - 1));
  if (range !== 'all') return addDays(today, -(RANGE_DAYS[range] - 1));
  const first = earliest ? parseDay(earliest) : today;
  return first < cap ? cap : first;
}

/** Level 0 to 4 for a day's spend: none, then the quarter of busy days it falls in. Thresholds come from the days shown. */
export function heatLevelOf(values: number[]): (value: number) => 0 | 1 | 2 | 3 | 4 {
  const positive = values.filter(value => value > 0).sort((a, b) => a - b);
  const at = (share: number) => (positive.length ? positive[Math.min(positive.length - 1, Math.ceil(positive.length * share))] : 0);
  const [first, second, third] = [at(0.25), at(0.5), at(0.75)];
  // The busiest quarter of days always reaches level 4, however few days there are.
  return value => (value <= 0 ? 0 : value < first ? 1 : value < second ? 2 : value < third ? 3 : 4);
}

export interface HeatBin { bin: number; count: number; date: Date }
export interface HeatColumn { bin: number; bins: HeatBin[] }

/** Week columns (Sunday first, as the heatmap expects) from the week holding `start` to the week holding `end`. `count` is the day's level. */
export function heatColumns(spend: Map<string, DaySpend>, start: Date, end: Date): { columns: HeatColumn[]; levelOf: (value: number) => number } {
  const first = addDays(start, -start.getDay());
  const weeks = Math.floor((addDays(end, -end.getDay()).getTime() - first.getTime()) / (7 * 86_400_000)) + 1;
  const shown: number[] = [];
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) shown.push(spend.get(isoDay(day))?.out ?? 0);
  const levelOf = heatLevelOf(shown);
  const columns = Array.from({ length: weeks }, (_, week) => ({
    bin: week,
    bins: Array.from({ length: 7 }, (__, row) => {
      const date = addDays(first, week * 7 + row);
      const inside = date >= start && date <= end;
      return { bin: row, date, count: inside ? levelOf(spend.get(isoDay(date))?.out ?? 0) : 0 };
    }),
  }));
  return { columns, levelOf };
}

export interface HeatStats {
  quiet: number;
  days: number;
  longestStreak: number;
  average: number;
  busiest: { date: string; value: number } | null;
}

/** Quiet days, the longest run of them, the average spend and the busiest day between two dates. */
export function heatStats(spend: Map<string, DaySpend>, start: Date, end: Date): HeatStats {
  const days: { date: string; value: number }[] = [];
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) days.push({ date: isoDay(day), value: spend.get(isoDay(day))?.out ?? 0 });
  let longestStreak = 0;
  let run = 0;
  days.forEach(day => { run = day.value === 0 ? run + 1 : 0; longestStreak = Math.max(longestStreak, run); });
  const busiest = days.reduce<{ date: string; value: number } | null>((best, day) => (day.value > (best?.value ?? 0) ? day : best), null);
  const total = days.reduce((sum, day) => safeAdd(sum, day.value), 0);
  return { quiet: days.filter(day => day.value === 0).length, days: days.length, longestStreak, average: days.length ? total / days.length : 0, busiest };
}
