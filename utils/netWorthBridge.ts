import type { Transaction } from '../types';
import { convertToMain, parseLocalDate, round2, safeAdd, safeSubtract, toLocalISOString } from '../utils';

/*
 * Net worth bridge: what moved your net worth between two dates. It starts from today's net worth and walks back through
 * the transactions the same way the net-worth chart does, so the two always agree. Pure, and tested in
 * tests/unit/netWorthBridge.test.ts.
 *
 * Every step is something Crystal recorded: income, spending, market gains you logged as market adjustments, balance
 * corrections, and money moved to or from accounts outside the selection. Moves between selected accounts cancel out.
 * Amounts use today's exchange rates, so there is no separate currency step.
 */

export type BridgeKind = 'income' | 'spending' | 'market' | 'corrections' | 'transfers';

export interface BridgeDetail { label: string; amount: number }

export interface BridgeStep {
  kind: BridgeKind;
  label: string;
  /** What this step added to net worth (negative for spending). */
  amount: number;
  count: number;
  /** The biggest contributors, largest first, with the rest folded into "Everything else". */
  details: BridgeDetail[];
}

export interface NetWorthBridge {
  start: string;
  end: string;
  startValue: number;
  endValue: number;
  change: number;
  /** Change as a share of the starting value. Undefined when it started at or below zero. */
  changePct?: number;
  steps: BridgeStep[];
  /** True when any transaction fell in the period. */
  hasActivity: boolean;
}

export interface BridgeInput {
  /** Transactions already limited to what counts for analytics, split parents left out. */
  transactions: Transaction[];
  selectedAccountIds: string[];
  /** Net worth of the selected accounts today, in the main currency. */
  netWorth: number;
  start: Date;
  end: Date;
  today: Date;
  /** Names for the details of market gains, corrections and transfers. */
  accountNames?: Map<string, string>;
  convert?: (amount: number, currency: Transaction['currency']) => number;
}

const LABELS: Record<BridgeKind, string> = {
  income: 'Income',
  spending: 'Spending',
  market: 'Market gains and losses',
  corrections: 'Balance corrections',
  transfers: 'Moved to or from other accounts',
};
const ORDER: BridgeKind[] = ['income', 'spending', 'market', 'corrections', 'transfers'];
const MAX_DETAILS = 4;

const dayOf = (date: Date) => toLocalISOString(date);

/** Splits a total into its biggest parts, keeping the rest as one line so the parts still add up. */
const topParts = (parts: Map<string, number>): BridgeDetail[] => {
  const sorted = [...parts.entries()].map(([label, amount]) => ({ label, amount: round2(amount) })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  if (sorted.length <= MAX_DETAILS + 1) return sorted;
  const head = sorted.slice(0, MAX_DETAILS);
  const rest = sorted.slice(MAX_DETAILS).reduce((sum, part) => safeAdd(sum, part.amount), 0);
  return [...head, { label: 'Everything else', amount: round2(rest) }];
};

export const buildNetWorthBridge = (input: BridgeInput): NetWorthBridge => {
  const { transactions, selectedAccountIds, netWorth, today, accountNames } = input;
  const convert = input.convert ?? ((amount: number, currency: Transaction['currency']) => convertToMain(amount, currency));
  const selected = new Set(selectedAccountIds);
  const todayKey = dayOf(today);
  const startKey = dayOf(input.start);
  // A period cannot run past today: the future is a forecast, not something that happened.
  const endKey = dayOf(input.end) > todayKey ? todayKey : dayOf(input.end);

  // A transfer cancels out when every leg of it sits inside the selection.
  const legs = new Map<string, Transaction[]>();
  transactions.forEach(tx => { if (tx.transferId) legs.set(tx.transferId, [...(legs.get(tx.transferId) ?? []), tx]); });
  const internal = new Set<string>();
  legs.forEach((group, id) => { if (group.every(tx => selected.has(tx.accountId))) internal.add(id); });

  const signed = (tx: Transaction) => {
    const value = Math.abs(convert(tx.amount, tx.currency));
    return tx.type === 'expense' ? -value : value;
  };
  const relevant = transactions.filter(tx => selected.has(tx.accountId) && !(tx.transferId && internal.has(tx.transferId)));

  const futureDelta = relevant.filter(tx => tx.date > todayKey).reduce((sum, tx) => safeAdd(sum, signed(tx)), 0);
  const afterEnd = relevant.filter(tx => tx.date > endKey && tx.date <= todayKey).reduce((sum, tx) => safeAdd(sum, signed(tx)), 0);
  const endValue = round2(safeSubtract(safeSubtract(netWorth, futureDelta), afterEnd));

  const inPeriod = relevant.filter(tx => tx.date >= startKey && tx.date <= endKey);
  const kindOf = (tx: Transaction): BridgeKind =>
    tx.transferId ? 'transfers' : tx.isMarketAdjustment ? 'market' : tx.isBalanceAdjustment ? 'corrections' : tx.type === 'income' ? 'income' : 'spending';

  const totals = new Map<BridgeKind, { amount: number; count: number; parts: Map<string, number> }>();
  inPeriod.forEach(tx => {
    const kind = kindOf(tx);
    const entry = totals.get(kind) ?? { amount: 0, count: 0, parts: new Map<string, number>() };
    const value = signed(tx);
    entry.amount = safeAdd(entry.amount, value);
    entry.count += 1;
    const label = kind === 'income' || kind === 'spending'
      ? (tx.category || 'Uncategorized')
      : (accountNames?.get(tx.accountId) ?? 'Account');
    entry.parts.set(label, safeAdd(entry.parts.get(label) ?? 0, value));
    totals.set(kind, entry);
  });

  const steps: BridgeStep[] = ORDER
    // Income and spending always show, even at zero, so the bridge reads the same from one period to the next.
    .filter(kind => kind === 'income' || kind === 'spending' || (totals.get(kind)?.count ?? 0) > 0)
    .map(kind => {
      const entry = totals.get(kind);
      return { kind, label: LABELS[kind], amount: round2(entry?.amount ?? 0), count: entry?.count ?? 0, details: entry ? topParts(entry.parts) : [] };
    });

  const change = round2(steps.reduce((sum, step) => safeAdd(sum, step.amount), 0));
  const startValue = round2(safeSubtract(endValue, change));

  return {
    start: startKey,
    end: endKey,
    startValue,
    endValue,
    change,
    changePct: startValue > 0 ? change / startValue : undefined,
    steps,
    hasActivity: inPeriod.length > 0,
  };
};

export interface BridgePeriod { id: string; label: string; start: Date; end: Date }

/** The periods offered on the page, ending at or before today. */
export const bridgePeriods = (today: Date, dataYears: number[] = []): BridgePeriod[] => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const day = (year: number, month: number, date: number) => new Date(year, month, date);
  const older = dataYears.filter(year => year < y - 1).sort((a, b) => b - a).map(year => ({ id: `y${year}`, label: String(year), start: day(year, 0, 1), end: day(year, 11, 31) }));
  return [
    { id: 'mtd', label: 'This month', start: day(y, m, 1), end: today },
    { id: 'last-month', label: 'Last month', start: day(y, m - 1, 1), end: day(y, m, 0) },
    { id: 'qtd', label: 'This quarter', start: day(y, Math.floor(m / 3) * 3, 1), end: today },
    { id: 'ytd', label: 'This year', start: day(y, 0, 1), end: today },
    { id: 'last-year', label: 'Last year', start: day(y - 1, 0, 1), end: day(y - 1, 11, 31) },
    { id: '12m', label: 'Last 12 months', start: day(y - 1, m, today.getDate() + 1), end: today },
    ...older,
  ];
};

/** One sentence on what drove the change, for the top of the page. */
export const bridgeHeadline = (bridge: NetWorthBridge): { direction: 'up' | 'down' | 'flat'; driver?: BridgeStep } => {
  const direction = Math.abs(bridge.change) < 0.005 ? 'flat' : bridge.change > 0 ? 'up' : 'down';
  if (direction === 'flat') return { direction };
  const sameWay = bridge.steps.filter(step => (direction === 'up' ? step.amount > 0 : step.amount < 0));
  const driver = sameWay.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
  return { direction, driver };
};

/** Where each step's bar starts and ends along the shared axis, as the running total before and after it. */
export const bridgeBars = (bridge: NetWorthBridge) => {
  let running = bridge.startValue;
  const bars = bridge.steps.map(step => {
    const from = running;
    running = round2(safeAdd(running, step.amount));
    return { step, from, to: running };
  });
  const points = [bridge.startValue, bridge.endValue, ...bars.flatMap(bar => [bar.from, bar.to])];
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  // The axis hugs the moves, not zero, so a small change against a large balance is still readable.
  const pad = (hi - lo) * 0.2 || Math.abs(hi) * 0.05 || 1;
  const min = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
  return { bars, min, max: hi + pad, truncated: min > 0 };
};
