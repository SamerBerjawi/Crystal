import type { Account, LifeEvent, Transaction } from '../types';
import { lifeEventsInYear } from './lifeEvents';
import { convertCurrency, convertToMain, getMainCurrency, parseLocalDate, safeAdd, safeSubtract, round2 } from '../utils';
import { netWorthHistory } from './challengesModel';

export interface WrappedRank { label: string; total: number; count: number }
export interface WrappedMonth { month: number; income: number; expense: number; saved: number }

export interface Wrapped {
  year: number;
  hasData: boolean;
  income: number;
  expense: number;
  saved: number;
  /** Share of income kept, 0 to 1. Undefined when there was no income. */
  savingsRate?: number;
  transactionCount: number;
  months: WrappedMonth[];
  bestMonth?: WrappedMonth;
  worstMonth?: WrappedMonth;
  topMerchants: WrappedRank[];
  topCategories: WrappedRank[];
  biggestPurchase?: { label: string; date: string; amount: number };
  busiestDay?: { date: string; total: number; count: number };
  /** Longest run of days with no spending, inside the year (up to today for the current year). */
  longestNoSpendStreak: { days: number; start?: string; end?: string };
  noSpendDays: number;
  netWorth?: { start: number; end: number; change: number; changePct?: number };
  kilometres?: number;
  /** Life events marked in this year, oldest first. */
  lifeEvents: LifeEvent[];
}

const amountOf = (tx: Transaction) => Math.abs(convertToMain(tx.amount, tx.currency));
const isCounted = (tx: Transaction) => !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment && !tx.isMarketAdjustment && !tx.transferId;
const merchantOf = (tx: Transaction) => tx.merchant?.trim() || tx.description || 'Unknown merchant';
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const rank = (rows: Transaction[], keyOf: (tx: Transaction) => string, limit: number): WrappedRank[] => {
  const totals = new Map<string, { total: number; count: number }>();
  rows.forEach(tx => {
    const key = keyOf(tx);
    const entry = totals.get(key) ?? { total: 0, count: 0 };
    entry.total = safeAdd(entry.total, amountOf(tx));
    entry.count += 1;
    totals.set(key, entry);
  });
  return [...totals.entries()]
    .map(([label, { total, count }]) => ({ label, total: round2(total), count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};

/** Years that have at least one counted transaction, newest first. */
export const wrappedYears = (transactions: Transaction[]): number[] => {
  const years = new Set<number>();
  transactions.forEach(tx => { if (isCounted(tx)) years.add(Number(tx.date.slice(0, 4))); });
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
};

/** Longest stretch of days without an expense between `start` and `end` (both included). */
export const longestNoSpendStreak = (spendDays: Set<string>, start: Date, end: Date) => {
  let best = { days: 0, start: undefined as string | undefined, end: undefined as string | undefined };
  let runStart: Date | null = null;
  let noSpend = 0;
  const close = (lastDay: Date) => {
    if (!runStart) return;
    const days = Math.round((lastDay.getTime() - runStart.getTime()) / 86400000) + 1;
    if (days > best.days) best = { days, start: isoOf(runStart), end: isoOf(lastDay) };
    runStart = null;
  };
  for (let day = new Date(start); day <= end; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    if (spendDays.has(isoOf(day))) {
      close(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1));
    } else {
      noSpend += 1;
      if (!runStart) runStart = new Date(day);
    }
  }
  close(end);
  return { streak: best, noSpendDays: noSpend };
};

export const buildWrapped = (
  year: number,
  transactions: Transaction[],
  accounts: Account[],
  mileage: { date: string; reading: number }[] = [],
  today: Date = new Date(),
  lifeEvents: LifeEvent[] = [],
): Wrapped => {
  const prefix = `${year}-`;
  const rows = transactions.filter(tx => isCounted(tx) && tx.date.startsWith(prefix));
  const expenses = rows.filter(tx => tx.type === 'expense');
  const incomes = rows.filter(tx => tx.type === 'income');

  const months: WrappedMonth[] = Array.from({ length: 12 }, (_, month) => ({ month, income: 0, expense: 0, saved: 0 }));
  rows.forEach(tx => {
    const bucket = months[Number(tx.date.slice(5, 7)) - 1];
    if (!bucket) return;
    if (tx.type === 'income') bucket.income = safeAdd(bucket.income, amountOf(tx));
    else bucket.expense = safeAdd(bucket.expense, amountOf(tx));
  });
  months.forEach(m => { m.income = round2(m.income); m.expense = round2(m.expense); m.saved = round2(safeSubtract(m.income, m.expense)); });

  const income = round2(months.reduce((sum, m) => safeAdd(sum, m.income), 0));
  const expense = round2(months.reduce((sum, m) => safeAdd(sum, m.expense), 0));
  const saved = round2(safeSubtract(income, expense));

  const lastMonth = year === today.getFullYear() ? today.getMonth() : 11;
  const active = months.filter(m => m.month <= lastMonth && (m.income > 0 || m.expense > 0));
  const bestMonth = active.length ? active.reduce((a, b) => (b.saved > a.saved ? b : a)) : undefined;
  const worstMonth = active.length > 1 ? active.reduce((a, b) => (b.saved < a.saved ? b : a)) : undefined;

  const biggest = expenses.reduce<Transaction | undefined>((top, tx) => (!top || amountOf(tx) > amountOf(top) ? tx : top), undefined);

  const perDay = new Map<string, { total: number; count: number }>();
  expenses.forEach(tx => {
    const entry = perDay.get(tx.date) ?? { total: 0, count: 0 };
    entry.total = safeAdd(entry.total, amountOf(tx));
    entry.count += 1;
    perDay.set(tx.date, entry);
  });
  const busiest = [...perDay.entries()].sort((a, b) => b[1].total - a[1].total)[0];

  const yearStart = new Date(year, 0, 1);
  const yearEnd = year === today.getFullYear() ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : new Date(year, 11, 31);
  const { streak, noSpendDays } = yearEnd >= yearStart
    ? longestNoSpendStreak(new Set(perDay.keys()), yearStart, yearEnd)
    : { streak: { days: 0, start: undefined, end: undefined }, noSpendDays: 0 };

  let netWorth: Wrapped['netWorth'];
  const { history } = netWorthHistory(accounts, transactions, today);
  const monthsBack = (y: number, m: number) => (today.getFullYear() * 12 + today.getMonth()) - (y * 12 + m);
  const endIndex = year >= today.getFullYear() ? 0 : monthsBack(year, 11);
  const startIndex = monthsBack(year - 1, 11);
  if (history[endIndex] && history[startIndex] && startIndex > endIndex) {
    const toMain = (value: number) => convertCurrency(value, 'EUR', getMainCurrency());
    const start = round2(toMain(history[startIndex].value));
    const end = round2(toMain(history[endIndex].value));
    netWorth = { start, end, change: round2(safeSubtract(end, start)), changePct: start > 0 ? (end - start) / start : undefined };
  }

  const readings = mileage.filter(log => log.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
  const before = mileage.filter(log => log.date < `${prefix}01-01`).sort((a, b) => b.date.localeCompare(a.date))[0];
  const first = before ?? readings[0];
  const last = readings[readings.length - 1];
  const kilometres = first && last && last.reading > first.reading ? last.reading - first.reading : undefined;

  return {
    year,
    hasData: rows.length > 0,
    income,
    expense,
    saved,
    savingsRate: income > 0 ? saved / income : undefined,
    transactionCount: rows.length,
    months,
    bestMonth,
    worstMonth,
    topMerchants: rank(expenses, merchantOf, 5),
    topCategories: rank(expenses, tx => tx.category || 'Uncategorized', 5),
    biggestPurchase: biggest ? { label: merchantOf(biggest), date: biggest.date, amount: round2(amountOf(biggest)) } : undefined,
    busiestDay: busiest ? { date: busiest[0], total: round2(busiest[1].total), count: busiest[1].count } : undefined,
    longestNoSpendStreak: streak,
    noSpendDays,
    netWorth,
    kilometres,
    lifeEvents: lifeEventsInYear(lifeEvents, year),
  };
};

/** "12 March" style label for a YYYY-MM-DD date. */
export const wrappedDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
