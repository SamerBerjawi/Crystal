import type { Account, BillPayment, Currency, FinancialGoal, RecurrenceFrequency, Warrant } from '../types';
import { advanceRecurrenceDate, getMainCurrency, parseLocalDate, round2, safeAdd } from '../utils';
import { addDays, buildOccurrences, iso, isOpen, makeConverter, owningAccountId, type Converter, type Occurrence, type OccurrenceInput } from './scheduleModel';

/*
 * Forecast model. Projects the selected accounts'
 * balance day by day from today's balances (future-dated transactions excluded, E-01), the Schedule engine's
 * occurrences from today onwards, and active goals (contributions once, E-03; savings goals as a
 * transfer, F-08). Everything in the display currency. Pure, so it is unit tested (tests/unit/forecastModel.test.ts).
 */

export type Horizon = '3M' | '6M' | 'EOY' | '1Y' | '2Y';
export const HORIZONS: { value: Horizon; label: string }[] = [
  { value: '3M', label: '3 months' },
  { value: '6M', label: '6 months' },
  { value: 'EOY', label: 'End of year' },
  { value: '1Y', label: '1 year' },
  { value: '2Y', label: '2 years' },
];

/** The last day of the horizon (inclusive). */
export const horizonEnd = (h: Horizon, today: Date): Date => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const clamp = (year: number, month: number) => new Date(year, month, Math.min(d, new Date(year, month + 1, 0).getDate()));
  switch (h) {
    case '3M': return clamp(y, m + 3);
    case '6M': return clamp(y, m + 6);
    case 'EOY': return new Date(y, 11, 31);
    case '2Y': return clamp(y + 2, m);
    default: return clamp(y + 1, m);
  }
};

/** Days of history drawn before today. */
export const historyDays = (h: Horizon): number => (h === '3M' ? 30 : h === '6M' ? 60 : 90);

export interface Assumptions {
  /** % change applied to money coming in. */
  incomeChange: number;
  /** % a year, on investment accounts. */
  marketReturn: number;
  /** % a year, compounding on money going out. */
  inflation: number;
}
export const NO_ASSUMPTIONS: Assumptions = { incomeChange: 0, marketReturn: 0, inflation: 0 };
export const hasAssumptions = (a: Assumptions) => a.incomeChange !== 0 || a.marketReturn !== 0 || a.inflation !== 0;

export type EventKind = 'recurring' | 'bill' | 'loan' | 'card' | 'property' | 'goal';

export interface ForecastEvent {
  key: string;
  /** Where the money moves on the projection (overdue items move to today). */
  date: string;
  /** Its own date (for overdue items, the day it was due). */
  dueDate: string;
  kind: EventKind;
  /** Groups events of one series or goal (for "What moves the line"). */
  seriesKey: string;
  description: string;
  /** Change to the selected accounts' total, display currency. A move between two selected accounts is 0. */
  amount: number;
  /** Per selected account, display currency. */
  legs: { accountId: string | null; amount: number }[];
  native: { amount: number; currency: Currency };
  accountId?: string;
  toAccountId?: string;
  overdue: boolean;
  /** Total of the selected accounts after this event. */
  balanceAfter: number;
  occurrence?: Occurrence;
  goalId?: string;
}

export interface ForecastDay {
  date: string;
  /** End-of-day total of the selected accounts. */
  total: number;
  byAccount: Record<string, number>;
  net: number;
  events: ForecastEvent[];
}

export interface Projection {
  start: number;
  startByAccount: Record<string, number>;
  days: ForecastDay[];
  events: ForecastEvent[];
}

const isActiveGoal = (g: FinancialGoal, goalsById: Map<string, FinancialGoal>, activeIds: Set<string>) => {
  if (g.isBucket || g.disabled || g.completed) return false;
  if (!activeIds.has(g.id)) return false;
  if (g.parentId) {
    const parent = goalsById.get(g.parentId);
    if (parent && (parent.disabled || parent.completed || !activeIds.has(parent.id))) return false;
  }
  return true;
};

export const goalCategoryOf = (g: FinancialGoal) => g.goalCategory || (g.transactionType === 'income' ? 'income' : 'savings');

interface GoalMovement { date: string; amount: number; kind: 'contribution' | 'target' }

/**
 * When a goal moves money between today and `end` (E-03, F-10): contributions at the goal's cadence until it is
 * reached or its date, then (one-time goals) what is still missing on the date. Amounts in the goal's currency.
 */
export const goalMovements = (g: FinancialGoal, today: Date, end: Date): GoalMovement[] => {
  const todayStr = iso(today);
  const endStr = iso(end);
  let remaining = round2(g.amount - (g.currentAmount ?? 0));
  if (remaining <= 0.005) return [];
  const out: GoalMovement[] = [];
  const contribution = g.monthlyContribution && g.monthlyContribution > 0 ? g.monthlyContribution : 0;
  const stopStr = g.type === 'one-time' && g.date ? g.date : (g.endDate || endStr);
  if (contribution > 0) {
    const frequency: RecurrenceFrequency = g.frequency || 'monthly';
    const day = g.dueDateOfMonth || 1;
    const startFrom = g.startDate && g.startDate > todayStr ? parseLocalDate(g.startDate) : today;
    let next = new Date(startFrom.getFullYear(), startFrom.getMonth(), Math.min(day, new Date(startFrom.getFullYear(), startFrom.getMonth() + 1, 0).getDate()));
    if (frequency !== 'monthly' && frequency !== 'yearly') next = new Date(startFrom);
    let guard = 0;
    while (iso(next) < iso(startFrom) && guard++ < 1000) next = advanceRecurrenceDate(next, frequency, 1, day);
    guard = 0;
    while (remaining > 0.005 && guard++ < 2000) {
      const date = iso(next);
      if (date > endStr || date > stopStr) break;
      const amount = Math.min(contribution, remaining);
      out.push({ date, amount: round2(amount), kind: 'contribution' });
      remaining = round2(remaining - amount);
      next = advanceRecurrenceDate(next, frequency, 1, day);
    }
  }
  if (g.type === 'one-time' && g.date && remaining > 0.005 && g.date >= todayStr && g.date <= endStr) {
    out.push({ date: g.date, amount: remaining, kind: 'target' });
  }
  return out;
};

export interface ProjectInput {
  accounts: Account[];
  /** Today's balance of each selected account, display currency. */
  startBalances: Record<string, number>;
  occurrences: Occurrence[];
  goals: FinancialGoal[];
  activeGoalIds: string[];
  today: Date;
  end: Date;
  convert: Converter;
  assumptions?: Assumptions;
}

/** The projection (E-01…E-05, F-08, F-10). */
export const projectBalances = (input: ProjectInput): Projection => {
  const { accounts, startBalances, occurrences, goals, today, end, convert } = input;
  const assumptions = input.assumptions ?? NO_ASSUMPTIONS;
  const selected = new Set(accounts.map(a => a.id));
  const todayStr = iso(today);
  const endStr = iso(end);
  const byDate = new Map<string, Omit<ForecastEvent, 'balanceAfter'>[]>();
  const push = (e: Omit<ForecastEvent, 'balanceAfter'>) => {
    if (e.legs.length === 0) return;
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  };
  const years = (date: string) => (parseLocalDate(date).getTime() - today.getTime()) / (365.25 * 86400000);
  const scale = (value: number, sign: 1 | -1, date: string) => {
    if (sign > 0 && assumptions.incomeChange) return value * (1 + assumptions.incomeChange / 100);
    if (sign < 0 && assumptions.inflation) return value * Math.pow(1 + assumptions.inflation / 100, Math.max(0, years(date)));
    return value;
  };

  // Occurrences from the Schedule engine (only today onwards; overdue past occurrences are not stacked on today).
  for (const o of occurrences) {
    if (!isOpen(o)) continue;
    if (o.date < todayStr || o.date > endStr) continue;
    const date = o.date;
    const base = convert(o.amount, o.currency);
    const legs: { accountId: string | null; amount: number }[] = [];
    const isTransfer = o.type === 'transfer';
    if (isTransfer) {
      if (o.accountId && selected.has(o.accountId)) legs.push({ accountId: o.accountId, amount: -round2(base) });
      if (o.toAccountId && selected.has(o.toAccountId)) legs.push({ accountId: o.toAccountId, amount: round2(base) });
    } else {
      const sign: 1 | -1 = o.flow === 'in' ? 1 : -1;
      const value = round2(scale(base, sign, date) * sign);
      if (o.accountId) { if (selected.has(o.accountId)) legs.push({ accountId: o.accountId, amount: value }); }
      else legs.push({ accountId: null, amount: value }); // a bill with no account counts on the total
    }
    const kind: EventKind = o.source === 'recurring' ? 'recurring' : o.source;
    push({
      key: o.key, date, dueDate: o.date, kind, seriesKey: o.source === 'recurring' || o.source === 'bill' || !o.series ? `${kind}:${o.sourceId}` : `${kind}:${owningAccountId(o.series) ?? o.sourceId}`,
      description: o.merchant || o.description,
      amount: round2(legs.reduce((s, l) => s + l.amount, 0)),
      legs, native: { amount: o.flow === 'in' ? o.amount : -o.amount, currency: o.currency },
      accountId: o.accountId, toAccountId: o.toAccountId, overdue: o.date < todayStr, occurrence: o,
    });
  }

  // Goals.
  const activeIds = new Set(input.activeGoalIds);
  const goalsById = new Map(goals.map(g => [g.id, g]));
  for (const g of goals) {
    if (!isActiveGoal(g, goalsById, activeIds)) continue;
    const category = goalCategoryOf(g);
    const from = g.paymentAccountId;
    const to = category === 'savings' ? g.destinationAccountId : undefined;
    if (from && !selected.has(from) && !(to && selected.has(to))) continue;
    for (const m of goalMovements(g, today, end)) {
      const value = round2(convert(m.amount, g.currency));
      const legs: { accountId: string | null; amount: number }[] = [];
      if (category === 'income') legs.push({ accountId: from && selected.has(from) ? from : null, amount: value });
      else {
        if (!from) legs.push({ accountId: null, amount: -value });
        else if (selected.has(from)) legs.push({ accountId: from, amount: -value });
        if (to && to !== from && selected.has(to)) legs.push({ accountId: to, amount: value });
        if (to && to === from) legs.length = 0; // saving inside the same account moves nothing (F-08)
      }
      push({
        key: `goal|${g.id}|${m.date}|${m.kind}`, date: m.date, dueDate: m.date, kind: 'goal', seriesKey: `goal:${g.id}`,
        description: m.kind === 'contribution' ? `${g.name} (contribution)` : g.name,
        amount: round2(legs.reduce((s, l) => s + l.amount, 0)), legs,
        native: { amount: category === 'income' ? m.amount : -m.amount, currency: g.currency },
        accountId: from, toAccountId: to, overdue: false, goalId: g.id,
      });
    }
  }

  // Walk the days.
  const byAccount: Record<string, number> = {};
  for (const a of accounts) byAccount[a.id] = round2(startBalances[a.id] ?? 0);
  let total = round2(Object.values(byAccount).reduce((s, v) => s + v, 0));
  const start = total;
  const startByAccount = { ...byAccount };
  const marketDaily = assumptions.marketReturn ? Math.pow(1 + assumptions.marketReturn / 100, 1 / 365) - 1 : 0;
  const days: ForecastDay[] = [];
  const events: ForecastEvent[] = [];
  for (let d = new Date(today), guard = 0; iso(d) <= endStr && guard < 1200; d = addDays(d, 1), guard++) {
    const date = iso(d);
    // Growth after today: market return on investments, APY on savings and pensions (classic behaviour).
    if (date !== todayStr) {
      for (const a of accounts) {
        const bal = byAccount[a.id];
        if (bal <= 0) continue;
        let rate = 0;
        if (a.type === 'Investment' && a.subType !== 'Pension Fund' && marketDaily) rate = marketDaily;
        else if ((a.type === 'Savings' || (a.type === 'Investment' && a.subType === 'Pension Fund')) && a.apy && a.apy > 0) rate = Math.pow(1 + a.apy / 100, 1 / 365) - 1;
        if (!rate) continue;
        const growth = round2(bal * rate);
        byAccount[a.id] = round2(bal + growth);
        total = round2(total + growth);
      }
    }
    const todays = (byDate.get(date) ?? []).sort((a, b) => (a.amount >= 0) === (b.amount >= 0) ? Math.abs(b.amount) - Math.abs(a.amount) : a.amount >= 0 ? -1 : 1);
    const dayEvents: ForecastEvent[] = [];
    let net = 0;
    for (const e of todays) {
      for (const leg of e.legs) if (leg.accountId) byAccount[leg.accountId] = round2((byAccount[leg.accountId] ?? 0) + leg.amount);
      total = round2(total + e.amount);
      net = safeAdd(net, e.amount);
      const full = { ...e, balanceAfter: total };
      dayEvents.push(full);
      events.push(full);
    }
    days.push({ date, total, byAccount: { ...byAccount }, net: round2(net), events: dayEvents });
  }
  return { start, startByAccount, days, events };
};

// ---------------------------------------------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------------------------------------------

export interface LowPoint { label: string; from: string; to: string; value: number; date: string }

/** The lowest end-of-day total over the horizon. */
export const lowestPoint = (days: ForecastDay[]): { value: number; date: string } | null =>
  days.length ? days.reduce((min, d) => (d.total < min.value ? { value: d.total, date: d.date } : min), { value: days[0].total, date: days[0].date }) : null;

/**
 * The real minimum of each period (E-05): this month, the next 3 months, 6 months and 12 months after it. A period
 * past the horizon is left out.
 */
export const lowestPoints = (days: ForecastDay[], today: Date): LowPoint[] => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const periods = [
    { label: 'This month', from: new Date(y, m, 1), to: new Date(y, m + 1, 0) },
    { label: 'Next 3 months', from: new Date(y, m + 1, 1), to: new Date(y, m + 4, 0) },
    { label: 'Next 6 months', from: new Date(y, m + 1, 1), to: new Date(y, m + 7, 0) },
    { label: 'Next 12 months', from: new Date(y, m + 1, 1), to: new Date(y, m + 13, 0) },
  ];
  const last = days[days.length - 1]?.date ?? '';
  const out: LowPoint[] = [];
  for (const p of periods) {
    const from = iso(p.from);
    const to = iso(p.to);
    if (from > last) continue;
    const inside = days.filter(d => d.date >= from && d.date <= to);
    const low = lowestPoint(inside);
    if (low) out.push({ label: p.label, from, to, ...low });
  }
  return out;
};

export interface Driver { key: string; label: string; kind: EventKind; total: number; count: number }

/** What moves the line (N1): series summed over the horizon, the `limit` largest by size, the rest as Other. */
export const drivers = (events: ForecastEvent[], limit = 6): Driver[] => {
  const map = new Map<string, Driver>();
  for (const e of events) {
    if (Math.abs(e.amount) < 0.005) continue;
    const d = map.get(e.seriesKey) ?? { key: e.seriesKey, label: e.description.replace(/ \(contribution\)$/, '').replace(/\s*#\d+.*$/, ''), kind: e.kind, total: 0, count: 0 };
    d.total = round2(d.total + e.amount);
    d.count += 1;
    map.set(e.seriesKey, d);
  }
  const sorted = [...map.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit);
  return [...sorted.slice(0, limit), { key: 'other', label: 'Other', kind: 'recurring', total: round2(rest.reduce((s, d) => s + d.total, 0)), count: rest.reduce((s, d) => s + d.count, 0) }];
};

/** Days whose end-of-day total is below `cushion` (N2). */
export const daysBelow = (days: ForecastDay[], cushion: number) => {
  const below = days.filter(d => d.total < cushion);
  return { count: below.length, first: below[0]?.date ?? null };
};

/** The first income after `date` (for "2 days before Salary"). */
export const nextIncomeAfter = (events: ForecastEvent[], date: string) => events.find(e => e.date > date && e.amount > 0 && e.kind !== 'goal');

export interface ChartPoint { date: Date; iso: string; balance: number; scenario?: number }

/**
 * History (solid) then projection (dashed from `todayIndex`) as one series, so the line meets itself at today.
 * `history` is per day before today; the projection's days follow.
 */
export const chartSeries = (history: { date: string; value: number }[], projection: Projection, scenario?: Projection): { points: ChartPoint[]; todayIndex: number } => {
  const todayStr = projection.days[0]?.date ?? '';
  const past = history.filter(h => h.date < todayStr).map(h => ({ date: parseLocalDate(h.date), iso: h.date, balance: round2(h.value) }));
  const ahead = projection.days.map((d, i) => ({
    date: parseLocalDate(d.date), iso: d.date, balance: d.total,
    ...(scenario ? { scenario: scenario.days[i]?.total } : {}),
  }));
  return { points: [...past, ...ahead], todayIndex: past.length };
};

/** Sums per-account histories (already in the display currency) into one series by date. */
export const sumHistories = (histories: { date: string; value: number }[][]): { date: string; value: number }[] => {
  const map = new Map<string, number>();
  for (const h of histories) for (const p of h) map.set(p.date, safeAdd(map.get(p.date) ?? 0, p.value));
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value: round2(value) }));
};

// ---------------------------------------------------------------------------------------------------------------
// The Forecast page (D-010, D-090)
// ---------------------------------------------------------------------------------------------------------------

export type ForecastRange = '30' | '60' | '90' | '6M' | 'EOY' | '1Y';
export const FORECAST_RANGES: { id: ForecastRange; label: string }[] = [
  { id: '30', label: '30 days' },
  { id: '60', label: '60 days' },
  { id: '90', label: '90 days' },
  { id: '6M', label: '6 months' },
  { id: 'EOY', label: 'End of year' },
  { id: '1Y', label: '1 year' },
];

/** The saved default period, as one of the ranges. */
export const rangeFromDuration = (duration?: string): ForecastRange => (duration === '3M' ? '90' : duration === '6M' || duration === 'EOY' ? duration : '1Y');

export const rangeEnd = (range: ForecastRange, today: Date): Date => {
  if (range === '30' || range === '60' || range === '90') return addDays(today, Number(range));
  return horizonEnd(range, today);
};

const WEEK_DAYS = 7;
/** Past this many days, bubbles group by week so they stay readable. */
export const WEEKLY_AFTER_DAYS = 100;

export type BubbleLane = 'in' | 'out' | 'fixed';

export interface Bubble {
  key: string;
  /** The day it sits on: its own, or the first of its week when grouped. */
  date: string;
  lane: BubbleLane;
  /** Size, always positive. */
  amount: number;
  label: string;
  events: ForecastEvent[];
  /** Only a single bill or recurring item can be dragged. Payments from accounts are fixed. */
  isMovable: boolean;
}

const canMove = (event: ForecastEvent) => (event.kind === 'recurring' || event.kind === 'bill') && !event.occurrence?.isReadOnly;

const laneOf = (event: ForecastEvent): BubbleLane => {
  if (event.kind !== 'recurring' && event.kind !== 'bill') return 'fixed';
  return event.amount > 0 ? 'in' : 'out';
};

/** Every event in the range as a bubble, or one per lane and week on the long ranges. */
export const forecastBubbles = (events: ForecastEvent[], weekly: boolean, today: Date): Bubble[] => {
  const moving = events.filter(event => Math.abs(event.amount) >= 0.005);
  if (!weekly) {
    return moving.map(event => ({ key: event.key, date: event.date, lane: laneOf(event), amount: Math.abs(event.amount), label: event.description, events: [event], isMovable: canMove(event) }));
  }
  const weeks = new Map<string, Bubble>();
  const todayMs = today.getTime();
  for (const event of moving) {
    const offset = Math.floor((parseLocalDate(event.date).getTime() - todayMs) / (WEEK_DAYS * 86400000));
    const date = iso(addDays(today, offset * WEEK_DAYS));
    const lane = laneOf(event);
    const key = `${lane}|${date}`;
    const bubble = weeks.get(key) ?? { key, date, lane, amount: 0, label: '', events: [], isMovable: false };
    bubble.amount = round2(bubble.amount + Math.abs(event.amount));
    bubble.events.push(event);
    bubble.label = bubble.events.length === 1 ? event.description : `${bubble.events.length} items`;
    weeks.set(key, bubble);
  }
  return [...weeks.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
};

export interface HorizonSummary { today: number; expectedIn: number; goingOut: number; end: number; lowest: { value: number; date: string } | null; below: { count: number; first: string | null } }

export const horizonSummary = (projection: Projection, cushion: number): HorizonSummary => {
  const expectedIn = projection.events.reduce((sum, event) => (event.amount > 0 ? safeAdd(sum, event.amount) : sum), 0);
  const goingOut = projection.events.reduce((sum, event) => (event.amount < 0 ? safeAdd(sum, event.amount) : sum), 0);
  return {
    today: projection.start,
    expectedIn,
    goingOut,
    end: projection.days[projection.days.length - 1]?.total ?? projection.start,
    lowest: lowestPoint(projection.days),
    below: daysBelow(projection.days, cushion),
  };
};

/** The biggest movements ahead, largest first. */
export const biggestAhead = (events: ForecastEvent[], limit = 8) =>
  [...events].filter(event => Math.abs(event.amount) >= 0.005).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, limit);

export interface MoveSuggestion { event: ForecastEvent; toDate: string }

/**
 * When the line dips under the buffer: the largest movable payment in the two weeks up to the dip, and the day
 * after the next income, which is where moving it would help most.
 */
export const moveSuggestion = (projection: Projection, cushion: number): MoveSuggestion | null => {
  const { first } = daysBelow(projection.days, cushion);
  if (!first) return null;
  const income = nextIncomeAfter(projection.events, first);
  if (!income) return null;
  const earliest = iso(addDays(parseLocalDate(first), -14));
  const candidates = projection.events
    .filter(event => event.amount < 0 && canMove(event) && event.date >= earliest && event.date <= first)
    .sort((a, b) => a.amount - b.amount);
  return candidates[0] ? { event: candidates[0], toDate: iso(addDays(parseLocalDate(income.date), 1)) } : null;
};

export interface BufferSuggestion {
  id: string;
  /** Move a bill or recurring payment past the next income, or stop a goal's contributions counting. */
  action: 'move' | 'pause-goal';
  event: ForecastEvent;
  toDate?: string;
  goalId?: string;
  /** 0 goals and one-time bills, 1 recurring payments, 2 anything that looks like a tax. Lower is suggested first. */
  tier: 0 | 1 | 2;
  /** What it frees before the dip, positive. */
  frees: number;
}

const isTaxEvent = (event: ForecastEvent) => /\btax\b/i.test(event.description);
/** Tax instalments made from a warrant aren't saved as bills, so they can't be moved from here. */
export const isDerivedBill = (event: ForecastEvent) => !!event.occurrence?.bill?.id?.startsWith('warrant-tax-');

/**
 * Ways to stay above the buffer, best first: goals and one-time bills, then recurring payments, then taxes. Within a
 * group, the one that frees the most comes first. One per goal or series, at most `limit`.
 */
export const bufferSuggestions = (projection: Projection, cushion: number, limit = 4): BufferSuggestion[] => {
  const { first } = daysBelow(projection.days, cushion);
  if (!first) return [];
  const income = nextIncomeAfter(projection.events, first);
  const earliest = iso(addDays(parseLocalDate(first), -21));
  const found = new Map<string, BufferSuggestion>();

  for (const event of projection.events) {
    if (event.amount >= 0 || event.date > first) continue;
    if (event.kind === 'goal' && event.goalId) {
      const id = `goal:${event.goalId}`;
      const frees = (found.get(id)?.frees ?? 0) + Math.abs(event.amount);
      found.set(id, { id, action: 'pause-goal', event: found.get(id)?.event ?? event, goalId: event.goalId, tier: 0, frees });
    } else if (income && canMove(event) && event.date >= earliest && !isDerivedBill(event)) {
      const id = `move:${event.seriesKey}`;
      const frees = Math.abs(event.amount);
      if (frees <= (found.get(id)?.frees ?? 0)) continue;
      const tier = isTaxEvent(event) ? 2 : event.kind === 'bill' ? 0 : 1;
      found.set(id, { id, action: 'move', event, toDate: iso(addDays(parseLocalDate(income.date), 1)), tier, frees });
    }
  }
  return [...found.values()].sort((a, b) => a.tier - b.tier || b.frees - a.frees).slice(0, limit);
};

/**
 * Pending warrant tax instalments as one-off bills, so every forecast counts them. They're paid from the first selected
 * account, else the primary account, else the first account.
 */
export const warrantTaxBills = (warrants: Warrant[], selected: Account[], accounts: Account[]): BillPayment[] => {
  const accountId = selected[0]?.id || accounts.find(a => a.isPrimary)?.id || accounts[0]?.id || '';
  return warrants.flatMap(w =>
    (w.taxPayments || [])
      .filter(tp => tp.status === 'pending' && tp.amount > 0 && tp.dueDate)
      .map(tp => ({
        id: `warrant-tax-${w.id}-${tp.id}`,
        description: `${w.name || w.isin} tax instalment`,
        amount: -Math.abs(tp.amount),
        type: 'payment' as const,
        dueDate: tp.dueDate,
        status: 'unpaid' as const,
        accountId,
        currency: getMainCurrency() as BillPayment['currency'],
      }))
  );
};

export type ForecastData = Pick<OccurrenceInput, 'recurring' | 'overrides' | 'bills' | 'accounts' | 'transactions' | 'loanPaymentOverrides'>;

/** The one way a forecast is worked out from saved data, so Overview and Forecast can't disagree. */
export const forecastFromData = (data: ForecastData, selected: Account[], goals: FinancialGoal[], activeGoalIds: string[], today: Date, end: Date, convert: Converter, assumptions?: Assumptions): Projection => {
  const todayStr = iso(today);
  const startBalances: Record<string, number> = {};
  for (const account of selected) {
    let realToday = convert(account.balance, account.currency);
    for (const tx of data.transactions ?? []) {
      if (tx.accountId !== account.id) continue;
      if (tx.isSplitParent || tx.isCombinedParent) continue;
      if (tx.date.slice(0, 10) > todayStr) {
        realToday -= convert(tx.amount, tx.currency || account.currency);
      }
    }
    startBalances[account.id] = round2(realToday);
  }
  return projectBalances({
    accounts: selected,
    startBalances,
    occurrences: buildOccurrences({ ...data, from: today, to: end, today, overdueDays: 0 }),
    goals,
    activeGoalIds,
    today,
    end,
    convert,
    assumptions,
  });
};

/**
 * One account's forecast in its own currency, for the account page. It starts from `startBalance`, the balance the
 * page shows for today, and counts only what lands on this account, so a bill with no account doesn't move it.
 */
export const accountForecast = (data: ForecastData, account: Account, startBalance: number, goals: FinancialGoal[], activeGoalIds: string[], today: Date, end: Date, rates?: Record<string, number>): { date: string; value: number }[] => {
  const projection = forecastFromData(data, [account], goals, activeGoalIds, today, end, makeConverter(account.currency, rates));
  const shift = startBalance - (projection.startByAccount[account.id] ?? 0);
  return projection.days.map(day => ({ date: day.date, value: round2((day.byAccount[account.id] ?? 0) + shift) }));
};

export interface HorizonTile { period: string; lowestBalance: number; date: string }

const TILE_LABELS: Record<string, string> = {
  'This month': 'This Month',
  'Next 3 months': 'Next 3 Months',
  'Next 6 months': 'Next 6 Months',
  'Next 12 months': 'Next Year',
};

/**
 * Overview's tiles: the same periods and lows as Forecast's Low points (D-130), so the two pages always agree. This
 * month runs from today, and the others start on the 1st of next month.
 */
export const horizonTiles = (days: { date: string; total: number }[], today: Date): HorizonTile[] => {
  const todayStr = iso(today);
  const ahead = days.filter(day => day.date >= todayStr) as ForecastDay[];
  return lowestPoints(ahead, today).map(low => ({ period: TILE_LABELS[low.label], lowestBalance: low.value, date: low.date }));
};

