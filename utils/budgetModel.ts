import type { Account, Budget, Category, Currency, FinancialGoal, GoalProjectionStatus, Transaction } from '../types';
import { parseAmount as parseTypedAmount } from './parseAmount';
import { safeAdd } from '../utils';

/*
 * Budget logic for BudgetNew (UI_UX_DESIGN_REFERENCE.md §5.1, D13). Pure and strict-typed, so it is unit tested
 * (tests/unit/budgetModel.test.ts). Amounts are converted by an injected `convert` so this file needs no rates.
 */

export type Convert = (amount: number, currency: Currency) => number;

/** Accounts whose spending counts against a budget (classic parity: checking, savings and credit cards). */
export const BUDGET_ACCOUNT_TYPES: readonly string[] = ['Checking', 'Savings', 'Credit Card'];

/** History lengths for auto-fill (classic parity with the quick-create options). */
export const AUTOFILL_OPTIONS: { value: '1' | '3' | '6' | '12'; label: string }[] = [
  { value: '1', label: 'Last month' },
  { value: '3', label: '3-month avg' },
  { value: '6', label: '6-month avg' },
  { value: '12', label: '12-month avg' },
];

export const UNCATEGORIZED = 'Uncategorized';

/* ── Months ─────────────────────────────────────────────────────────────── */

/** A calendar month; `month` is 0–11. */
export interface Month { year: number; month: number }

export const monthOf = (d: Date): Month => ({ year: d.getFullYear(), month: d.getMonth() });

export const shiftMonth = (m: Month, offset: number): Month => {
  const total = m.year * 12 + m.month + offset;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
};

export const sameMonth = (a: Month, b: Month) => a.year === b.year && a.month === b.month;

/** -1 when `a` is before `b`, 0 when equal, 1 when after. */
export const compareMonths = (a: Month, b: Month) => Math.sign((a.year * 12 + a.month) - (b.year * 12 + b.month));

export const daysInMonth = (m: Month) => new Date(m.year, m.month + 1, 0).getDate();

const pad = (n: number) => String(n).padStart(2, '0');

/** First and last day of the month as `YYYY-MM-DD` (inclusive). */
export const monthBounds = (m: Month): { from: string; to: string } => ({
  from: `${m.year}-${pad(m.month + 1)}-01`,
  to: `${m.year}-${pad(m.month + 1)}-${pad(daysInMonth(m))}`,
});

/* ── Pace ───────────────────────────────────────────────────────────────── */

export interface Pace {
  days: number;
  /** Days of the month that have started (today counts). */
  elapsed: number;
  /** Days still to spend in, today included. 0 for a past month. */
  left: number;
  /** Share of the month gone, 0–100. */
  elapsedPct: number;
  when: 'past' | 'current' | 'future';
}

export const monthPace = (m: Month, today: Date): Pace => {
  const days = daysInMonth(m);
  const order = compareMonths(m, monthOf(today));
  if (order < 0) return { days, elapsed: days, left: 0, elapsedPct: 100, when: 'past' };
  if (order > 0) return { days, elapsed: 0, left: days, elapsedPct: 0, when: 'future' };
  const elapsed = today.getDate();
  return { days, elapsed, left: days - elapsed + 1, elapsedPct: (elapsed / days) * 100, when: 'current' };
};

/** Month-end spend if the current daily rate holds. A past month is what was spent; a future one has none yet. */
export const projectedSpend = (spent: number, pace: Pace) =>
  pace.when === 'current' ? (pace.elapsed > 0 ? (spent / pace.elapsed) * pace.days : spent) : spent;

/** Days of history before a month-end forecast is shown: earlier, one payment swings it too much. */
export const FORECAST_MIN_DAYS = 5;

/**
 * Month-end forecast that does not extrapolate fixed bills: recurring spending already paid
 * (`recurringPaid`) and still due this month (`recurringDue`) count once, and only the rest of
 * the spending is extrapolated at the current daily rate. Rent paid on the 1st is not ×30.
 * Null for the current month before day `FORECAST_MIN_DAYS`.
 */
export const forecastMonthEnd = (
  spent: number,
  pace: Pace,
  recurring: { paid: number; due: number } = { paid: 0, due: 0 },
): number | null => {
  if (pace.when !== 'current') return spent;
  if (pace.elapsed < FORECAST_MIN_DAYS) return null;
  const paid = Math.min(spent, Math.max(0, recurring.paid));
  const variable = Math.max(0, spent - paid);
  const projectedVariable = (variable / pace.elapsed) * pace.days;
  return safeAdd(safeAdd(paid, Math.max(0, recurring.due)), projectedVariable);
};

/* ── Spending ───────────────────────────────────────────────────────────── */

/** The top-level expense category a transaction's category belongs to (budgets are set on those). */
export const parentCategoryName = (name: string, categories: Category[]): string | undefined => {
  for (const parent of categories) {
    if (parent.name === name) return parent.name;
    if ((parent.subCategories ?? []).some(sub => sub.name === name)) return parent.name;
  }
  return undefined;
};

export const budgetAccountIds = (accounts: Pick<Account, 'id' | 'type'>[]) =>
  new Set(accounts.filter(a => BUDGET_ACCOUNT_TYPES.includes(a.type)).map(a => a.id));

/**
 * Expense spending per top-level category in `[from, to]`, in the display currency. Transfers, balance
 * adjustments and other accounts are left out. A refund (income booked in an expense category) is netted
 * against that category, never below 0. A split counts through its parts (each has its own category); a
 * combined transaction counts once through its parent. Spending in no known category is `Uncategorized`.
 */
export const spendByCategory = (
  transactions: Transaction[],
  range: { from: string; to: string },
  options: { accountIds: Set<string>; categories: Category[]; convert: Convert },
): Map<string, number> => {
  const splitParents = new Set(transactions.filter(t => t.isSplitParent).map(t => t.id));
  const spend = new Map<string, number>();
  const refunds = new Map<string, number>();
  for (const t of transactions) {
    const day = t.date.slice(0, 10);
    if (day < range.from || day > range.to) continue;
    if (t.transferId || t.isBalanceAdjustment || t.isSplitParent) continue;
    if (t.parentTransactionId && !splitParents.has(t.parentTransactionId)) continue;
    if (!options.accountIds.has(t.accountId)) continue;
    const parent = parentCategoryName(t.category, options.categories);
    const amount = Math.abs(options.convert(t.amount, t.currency));
    if (t.type === 'expense') {
      const key = parent ?? UNCATEGORIZED;
      spend.set(key, safeAdd(spend.get(key) ?? 0, amount));
    } else if (t.type === 'income' && parent) {
      refunds.set(parent, safeAdd(refunds.get(parent) ?? 0, amount));
    }
  }
  for (const [name, refunded] of refunds) {
    const spent = spend.get(name);
    if (spent !== undefined) spend.set(name, Math.max(0, spent - refunded));
  }
  return spend;
};

/** Average monthly spend per category over the `months` full months before `current` (Uncategorized left out). */
export const averageMonthlySpend = (
  transactions: Transaction[],
  current: Month,
  months: number,
  options: { accountIds: Set<string>; categories: Category[]; convert: Convert },
): Map<string, number> => {
  const from = monthBounds(shiftMonth(current, -months)).from;
  const to = monthBounds(shiftMonth(current, -1)).to;
  const total = spendByCategory(transactions, { from, to }, options);
  total.delete(UNCATEGORIZED);
  const avg = new Map<string, number>();
  for (const [name, sum] of total) if (sum / months > 0) avg.set(name, sum / months);
  return avg;
};

/* ── Budget lines ───────────────────────────────────────────────────────── */

/** over: past the limit · near: 85%+ used · ahead: spending faster than the month is passing · ok. */
export type BudgetStatus = 'over' | 'near' | 'ahead' | 'ok';

export interface BudgetLine {
  budget: Budget;
  name: string;
  /** The limit in the display currency. */
  limit: number;
  spent: number;
  remaining: number;
  /** Spent as a share of the limit (can pass 100). */
  pct: number;
  status: BudgetStatus;
}

export const statusOf = (pct: number, pace: Pace): BudgetStatus => {
  if (pct > 100) return 'over';
  if (pct >= 85) return 'near';
  if (pace.when === 'current' && pct > pace.elapsedPct + 10) return 'ahead';
  return 'ok';
};

export const budgetLines = (budgets: Budget[], spend: Map<string, number>, convert: Convert, pace: Pace): BudgetLine[] =>
  budgets.map(budget => {
    const limit = convert(budget.amount, budget.currency);
    const spent = spend.get(budget.categoryName) ?? 0;
    const pct = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 101 : 0;
    return { budget, name: budget.categoryName, limit, spent, remaining: limit - spent, pct, status: statusOf(pct, pace) };
  });

export type LineSort = 'used' | 'left' | 'limit' | 'name';

export const LINE_SORTS: { value: LineSort; label: string }[] = [
  { value: 'used', label: 'Most used' },
  { value: 'left', label: 'Least left' },
  { value: 'limit', label: 'Largest budget' },
  { value: 'name', label: 'Name' },
];

export const sortLines = (lines: BudgetLine[], sort: LineSort): BudgetLine[] => {
  const copy = [...lines];
  if (sort === 'used') copy.sort((a, b) => b.pct - a.pct);
  else if (sort === 'left') copy.sort((a, b) => a.remaining - b.remaining);
  else if (sort === 'limit') copy.sort((a, b) => b.limit - a.limit);
  else copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
};

export interface BudgetSummary {
  /** Total of every limit. */
  budgeted: number;
  /** Spent in categories that have a budget. */
  spent: number;
  remaining: number;
  /** spent / budgeted, 0–∞. */
  pct: number;
  /** Spent in categories without a budget (Uncategorized included). */
  outside: number;
  counts: Record<BudgetStatus, number>;
}

export const summarize = (lines: BudgetLine[], spend: Map<string, number>): BudgetSummary => {
  const budgeted = lines.reduce((s, l) => safeAdd(s, l.limit), 0);
  const spent = lines.reduce((s, l) => safeAdd(s, l.spent), 0);
  const named = new Set(lines.map(l => l.name));
  let outside = 0;
  for (const [name, value] of spend) if (!named.has(name)) outside += value;
  const counts: Record<BudgetStatus, number> = { over: 0, near: 0, ahead: 0, ok: 0 };
  for (const l of lines) counts[l.status] += 1;
  return { budgeted, spent, remaining: budgeted - spent, pct: budgeted > 0 ? (spent / budgeted) * 100 : 0, outside, counts };
};

/** Categories with spending this month but no budget, largest first. */
export const unbudgeted = (spend: Map<string, number>, budgets: Budget[]) => {
  const named = new Set(budgets.map(b => b.categoryName));
  return [...spend.entries()]
    .filter(([name, value]) => !named.has(name) && value > 0)
    .map(([name, spent]) => ({ name, spent }))
    .sort((a, b) => b.spent - a.spent);
};

/** Safe to spend per remaining day; 0 when the month is over or nothing is left. */
export const dailyAllowance = (remaining: number, pace: Pace) => (pace.left > 0 ? Math.max(0, remaining / pace.left) : 0);

/* ── Suggestions and auto-fill ──────────────────────────────────────────── */

/** Rounds a suggested limit up to a friendly figure: 5s below 200, 10s below 1,000, then 50s. */
export const friendlyAmount = (value: number) => {
  if (value <= 0) return 0;
  const step = value < 200 ? 5 : value < 1000 ? 10 : 50;
  return Math.ceil(value / step) * step;
};

export interface Suggestion {
  categoryName: string;
  average: number;
  /** The current limit (display currency), when there is a budget. */
  current?: number;
  budget?: Budget;
  suggested: number;
  kind: 'new' | 'raise' | 'lower';
}

/**
 * Where the history disagrees with the budgets: a category with regular spending and no budget (new), or a
 * budget at least 15% (and 10 units) away from the average (raise or lower). Biggest gap first.
 */
export const budgetSuggestions = (average: Map<string, number>, budgets: Budget[], convert: Convert): Suggestion[] => {
  const byName = new Map(budgets.map(b => [b.categoryName, b]));
  const out: Suggestion[] = [];
  for (const [categoryName, avg] of average) {
    const budget = byName.get(categoryName);
    if (!budget) {
      if (avg >= 10) out.push({ categoryName, average: avg, suggested: friendlyAmount(avg), kind: 'new' });
      continue;
    }
    const current = convert(budget.amount, budget.currency);
    const gap = avg - current;
    if (Math.abs(gap) >= 10 && (current === 0 || Math.abs(gap) / current >= 0.15)) {
      out.push({ categoryName, average: avg, current, budget, suggested: friendlyAmount(avg), kind: gap > 0 ? 'raise' : 'lower' });
    }
  }
  const gapOf = (s: Suggestion) => Math.abs(s.average - (s.current ?? 0));
  return out.sort((a, b) => gapOf(b) - gapOf(a));
};

export type BudgetDraft = Omit<Budget, 'id'> & { id?: string };

/**
 * Auto-fill: one budget per category with history, at the same friendly amount the preview shows.
 * With `keepExisting` (the default) categories that already have a budget are left alone.
 */
export const autofillPlan = (
  average: Map<string, number>,
  budgets: Budget[],
  currency: Currency,
  options: { keepExisting?: boolean; categories?: Category[] } = {},
): BudgetDraft[] => {
  const keepExisting = options.keepExisting ?? true;
  return [...average.entries()]
    .map(([categoryName, avg]) => ({ categoryName, amount: friendlyAmount(avg), existing: budgets.find(b => b.categoryName === categoryName) }))
    .filter(item => item.amount > 0 && !(keepExisting && item.existing))
    .map(item => ({
      id: item.existing?.id,
      categoryId: item.existing?.categoryId ?? options.categories?.find(c => c.name === item.categoryName)?.id,
      categoryName: item.categoryName,
      amount: item.amount,
      period: 'monthly' as const,
      currency: item.existing?.currency ?? currency,
    }));
};

/**
 * Links budgets to their category by id (Q8) and keeps `categoryName` in step with that category's
 * current name, so renaming a category no longer orphans its budget. Returns the same array when nothing changed.
 */
export const linkBudgetsToCategories = (budgets: Budget[], categories: Category[]): Budget[] => {
  if (categories.length === 0) return budgets;
  let changed = false;
  const next = budgets.map(b => {
    const byId = b.categoryId ? categories.find(c => c.id === b.categoryId) : undefined;
    if (byId) {
      if (byId.name === b.categoryName) return b;
      changed = true;
      return { ...b, categoryName: byId.name };
    }
    const byName = categories.find(c => c.name === b.categoryName);
    if (byName && byName.id !== b.categoryId) {
      changed = true;
      return { ...b, categoryId: byName.id };
    }
    return b;
  });
  return changed ? next : budgets;
};

/**
 * Parses a typed amount in either style: "1,250.50", "1.250,50", "1250,5", "1.250" (= 1250).
 * Same parser as the CSV importer. NaN when it is not a number.
 */
export const parseAmount = (text: string) => parseTypedAmount(text);

/* ── Allocation ─────────────────────────────────────────────────────────── */

export interface Slice { name: string; value: number; pct: number }

/** Each budget's share of the total, largest first. Shares under `minPct` are folded into one "Other" slice. */
export const allocation = (lines: BudgetLine[], minPct = 4): Slice[] => {
  const total = lines.reduce((s, l) => safeAdd(s, Math.max(0, l.limit)), 0);
  if (total <= 0) return [];
  const slices = lines.filter(l => l.limit > 0).map(l => ({ name: l.name, value: l.limit, pct: (l.limit / total) * 100 })).sort((a, b) => b.value - a.value);
  const big = slices.filter(s => s.pct >= minPct);
  const small = slices.filter(s => s.pct < minPct);
  if (small.length < 2) return slices;
  const other = small.reduce((s, x) => safeAdd(s, x.value), 0);
  return [...big, { name: 'Other', value: other, pct: (other / total) * 100 }];
};

/* ── Goals ──────────────────────────────────────────────────────────────── */

export interface GoalView {
  id: string;
  name: string;
  target: number;
  saved: number;
  pct: number;
  /** Number of goals inside a bucket. */
  parts: number;
  done: boolean;
  status?: GoalProjectionStatus;
  /** Target date (one-time) or end date (recurring), `YYYY-MM-DD`. */
  due?: string;
  monthly?: number;
  recurring: boolean;
  subGoals?: GoalView[];
}

/**
 * Top-level goals in the display currency, active first and then by progress. A bucket adds up the goals
 * inside it. Disabled goals are left out.
 */
export const goalViews = (goals: FinancialGoal[], convert: Convert): GoalView[] => {
  const active = goals.filter(g => !g.disabled);
  return active
    .filter(g => !g.parentId)
    .map(g => {
      const children = active.filter(c => c.parentId === g.id);
      const members = children.length ? children : [g];
      const target = members.reduce((s, m) => safeAdd(s, convert(m.amount, m.currency)), 0);
      const saved = members.reduce((s, m) => safeAdd(s, convert(m.currentAmount ?? 0, m.currency)), 0);
      const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
      const done = !!g.completed || (target > 0 && saved >= target);

      const subGoals: GoalView[] = children.map(c => {
        const cTarget = convert(c.amount, c.currency);
        const cSaved = convert(c.currentAmount ?? 0, c.currency);
        const cPct = cTarget > 0 ? Math.min(100, (cSaved / cTarget) * 100) : 0;
        const cDone = !!c.completed || (cTarget > 0 && cSaved >= cTarget);
        return {
          id: c.id,
          name: c.name,
          target: cTarget,
          saved: cSaved,
          pct: cPct,
          parts: 0,
          done: cDone,
          status: c.projection?.status,
          due: c.type === 'one-time' ? c.date : c.endDate,
          monthly: c.monthlyContribution !== undefined ? convert(c.monthlyContribution, c.currency) : undefined,
          recurring: c.type === 'recurring',
        };
      }).sort((a, b) => Number(a.done) - Number(b.done) || b.pct - a.pct);

      return {
        id: g.id,
        name: g.name,
        target,
        saved,
        pct,
        parts: children.length,
        done,
        status: g.projection?.status,
        due: g.type === 'one-time' ? g.date : g.endDate,
        monthly: g.monthlyContribution !== undefined ? convert(g.monthlyContribution, g.currency) : undefined,
        recurring: g.type === 'recurring',
        subGoals: subGoals.length > 0 ? subGoals : undefined,
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.pct - a.pct);
};
