import type { Account, Budget, Category, RecurringTransaction, Transaction } from '../types';
import { parseLocalDate, round2, safeAdd } from '../utils';
import { budgetAccountIds, budgetLines, monthBounds, monthOf, monthPace, parentCategoryName, spendByCategory, type BudgetLine, type Convert } from './budgetModel';
import { nextDates } from './scheduleModel';

/*
 * The weekly recap: one Monday to Sunday week of what came in and went out, against the week before, with what is coming.
 * Pure, and tested in tests/unit/weeklyRecap.test.ts. Amounts are converted by an injected `convert`.
 */

export interface WeekRange { start: string; end: string }

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: string, n: number) => { const d = parseLocalDate(iso); d.setDate(d.getDate() + n); return isoOf(d); };

/** The Monday-to-Sunday week that holds a day. */
export const weekOf = (day: Date): WeekRange => {
  const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
  const start = isoOf(monday);
  return { start, end: addDays(start, 6) };
};

export const shiftWeek = (week: WeekRange, weeks: number): WeekRange => {
  const start = addDays(week.start, 7 * weeks);
  return { start, end: addDays(start, 6) };
};

export interface RecapShare { label: string; total: number; count: number; share: number }

export interface Recap {
  week: WeekRange;
  /** The week holds today, so it is not finished. */
  inProgress: boolean;
  hasData: boolean;
  spent: number;
  earned: number;
  saved: number;
  transactionCount: number;
  prevSpent: number;
  prevEarned: number;
  /** Change in spending against the week before, as a fraction. Undefined when that week had none. */
  spentChange?: number;
  topCategories: RecapShare[];
  topMerchants: RecapShare[];
  biggest?: { label: string; date: string; amount: number };
  /** Budgets at 80% or more, month to date as of the end of this week. */
  budgets: BudgetLine[];
  upcoming: { name: string; date: string; amount: number }[];
  upcomingTotal: number;
  /** The seven days the upcoming bills are taken from. */
  upcomingWindow?: WeekRange;
}

export interface RecapInput {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  convert: Convert;
  week: WeekRange;
  today: Date;
}

const counted = (tx: Transaction) => !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment && !tx.isMarketAdjustment && !tx.transferId;

export const buildRecap = ({ transactions, accounts, categories, budgets, recurring, convert, week, today }: RecapInput): Recap => {
  const todayIso = isoOf(today);
  const inProgress = week.start <= todayIso && todayIso <= week.end;
  const prev = shiftWeek(week, -1);
  const inWeek = (tx: Transaction, range: WeekRange) => { const day = tx.date.slice(0, 10); return day >= range.start && day <= range.end; };
  const abs = (tx: Transaction) => Math.abs(convert(tx.amount, tx.currency));

  const total = (range: WeekRange, type: 'expense' | 'income') =>
    round2(transactions.filter(tx => counted(tx) && tx.type === type && inWeek(tx, range)).reduce((sum, tx) => safeAdd(sum, abs(tx)), 0));

  const rows = transactions.filter(tx => counted(tx) && inWeek(tx, week));
  const expenses = rows.filter(tx => tx.type === 'expense');
  const spent = total(week, 'expense');
  const earned = total(week, 'income');
  const prevSpent = total(prev, 'expense');

  const rank = (keyOf: (tx: Transaction) => string, limit: number): RecapShare[] => {
    const sums = new Map<string, { total: number; count: number }>();
    expenses.forEach(tx => { const key = keyOf(tx); const entry = sums.get(key) ?? { total: 0, count: 0 }; entry.total = safeAdd(entry.total, abs(tx)); entry.count += 1; sums.set(key, entry); });
    return [...sums.entries()].map(([label, v]) => ({ label, total: round2(v.total), count: v.count, share: spent > 0 ? v.total / spent : 0 })).sort((a, b) => b.total - a.total).slice(0, limit);
  };
  const biggestTx = [...expenses].sort((a, b) => abs(b) - abs(a))[0];

  // Budgets: the month the week ends in, up to the end of the week (or today).
  const reference = parseLocalDate(week.end > todayIso ? todayIso : week.end);
  const month = monthOf(reference);
  const bounds = monthBounds(month);
  const spend = spendByCategory(transactions, { from: bounds.from, to: week.end > todayIso ? todayIso : week.end }, { accountIds: budgetAccountIds(accounts), categories, convert });
  const hot = budgetLines(budgets, spend, convert, monthPace(month, reference)).filter(line => line.limit > 0 && line.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 4);

  // Coming up: the next seven days from today, or the week after a finished one. Older weeks have nothing to look ahead to.
  const windowStart = inProgress ? todayIso : addDays(week.end, 1);
  const upcomingWindow: WeekRange = { start: windowStart, end: addDays(windowStart, 6) };
  const show = upcomingWindow.end >= todayIso;
  const upcoming = show
    ? recurring.filter(rt => rt.type === 'expense' && !rt.pausedAt && !rt.isSynthetic && !rt.isSkipped).flatMap(rt =>
        nextDates(rt, parseLocalDate(upcomingWindow.start), 8).filter(date => date >= upcomingWindow.start && date <= upcomingWindow.end).map(date => ({ name: rt.merchant?.trim() || rt.description, date, amount: round2(Math.abs(convert(rt.amount, rt.currency))) })))
      .sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
    : [];

  return {
    week, inProgress, hasData: rows.length > 0, spent, earned, saved: round2(earned - spent), transactionCount: rows.length,
    prevSpent, prevEarned: total(prev, 'income'), spentChange: prevSpent > 0 ? (spent - prevSpent) / prevSpent : undefined,
    topCategories: rank(tx => parentCategoryName(tx.category, categories) ?? (tx.category || 'Uncategorized'), 5),
    topMerchants: rank(tx => tx.merchant?.trim() || tx.description || 'Unknown merchant', 3),
    biggest: biggestTx ? { label: biggestTx.merchant?.trim() || biggestTx.description || 'Unknown', date: biggestTx.date.slice(0, 10), amount: round2(abs(biggestTx)) } : undefined,
    budgets: hot, upcoming, upcomingTotal: round2(upcoming.reduce((sum, u) => sum + u.amount, 0)),
    upcomingWindow: show ? upcomingWindow : undefined,
  };
};
