import type { Account, Currency, FinancialGoal, GoalCategory, GoalProjectionStatus, RecurrenceFrequency } from '../types';
import { advanceRecurrenceDate, parseLocalDate, round2, safeAdd } from '../utils';
import { addDays, iso, parseAmountInput, type Converter } from './scheduleModel';
import { goalCategoryOf, type ForecastDay } from './forecastModel';

/*
 * Goals model. A goal is projected from its own saved amount
 * and contributions, never from an account balance (F-05); amounts are converted before they are added (F-06);
 * savings, spending and income are never mixed into one figure (F-07). Unit tested in tests/unit/goalsModel.test.ts.
 */

const DAY_MS = 86400000;

export interface GoalProjectionView {
  /** Projected date it is reached, `YYYY-MM-DD`; undefined when there is no plan to reach it. */
  projectedDate?: string;
  status: GoalProjectionStatus | 'done' | 'no-plan';
  /** Per month needed to be reached by its date (one-time goals with a date in the future). */
  neededMonthly?: number;
  remaining: number;
}

/** Periods per year of a contribution cadence. */
const perYear = (f: RecurrenceFrequency = 'monthly') => (f === 'daily' ? 365 : f === 'weekly' ? 52 : f === 'biweekly' ? 26 : f === 'yearly' ? 1 : 12);

/** When the goal is reached from its saved amount and contributions, and whether that is in time (F-05). */
export const projectGoal = (g: FinancialGoal, today: Date): GoalProjectionView => {
  const remaining = round2(g.amount - (g.currentAmount ?? 0));
  if (g.completed || remaining <= 0.005) return { status: 'done', remaining: Math.max(0, remaining) };
  const todayStr = iso(today);
  let projectedDate: string | undefined;
  const contribution = g.monthlyContribution && g.monthlyContribution > 0 ? g.monthlyContribution : 0;
  if (contribution > 0) {
    const frequency = g.frequency || 'monthly';
    const periods = Math.ceil(remaining / contribution);
    const day = g.dueDateOfMonth || 1;
    const start = g.startDate && g.startDate > todayStr ? parseLocalDate(g.startDate) : today;
    let d = frequency === 'monthly' || frequency === 'yearly'
      ? new Date(start.getFullYear(), start.getMonth(), Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()))
      : new Date(start);
    let guard = 0;
    while (iso(d) < iso(start) && guard++ < 100) d = advanceRecurrenceDate(d, frequency, 1, day);
    for (let i = 1; i < periods && i < 5000; i++) d = advanceRecurrenceDate(d, frequency, 1, day);
    projectedDate = iso(d);
  }
  let neededMonthly: number | undefined;
  if (g.type === 'one-time' && g.date && g.date > todayStr) {
    const months = Math.max(1, (parseLocalDate(g.date).getTime() - today.getTime()) / (DAY_MS * 30.44));
    neededMonthly = round2(remaining / months);
  }
  if (!projectedDate) return { status: 'no-plan', remaining, neededMonthly };
  const target = g.type === 'one-time' ? g.date : g.endDate;
  if (!target) return { projectedDate, status: 'on-track', remaining, neededMonthly };
  if (projectedDate <= target) return { projectedDate, status: 'on-track', remaining, neededMonthly };
  const late = (parseLocalDate(projectedDate).getTime() - parseLocalDate(target).getTime()) / DAY_MS;
  return { projectedDate, status: late <= 60 ? 'at-risk' : 'off-track', remaining, neededMonthly };
};

export interface GoalNode { goal: FinancialGoal; children: FinancialGoal[] }

/** Top-level goals (buckets with their items) in the user's order, then any not in the order. */
export const goalTree = (goals: FinancialGoal[], order: string[]): GoalNode[] => {
  const top = goals.filter(g => !g.parentId || !goals.some(p => p.id === g.parentId));
  const rank = new Map(order.map((id, i) => [id, i]));
  const sorted = [...top].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  return sorted.map(goal => ({ goal, children: goals.filter(c => c.parentId === goal.id) }));
};

/** `order` with `id` moved one place up or down among the top-level goals. */
export const moveGoal = (tree: GoalNode[], id: string, direction: -1 | 1): string[] => {
  const ids = tree.map(n => n.goal.id);
  const i = ids.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
};

export interface Ring { category: GoalCategory; label: string; saved: number; target: number; pct: number; count: number }

/** Savings, spending and income progress (F-07), each in the display currency (F-06). Buckets and done goals left out. */
export const summaryRings = (goals: FinancialGoal[], convert: Converter): Ring[] => {
  const rings: Record<GoalCategory, Ring> = {
    savings: { category: 'savings', label: 'Savings', saved: 0, target: 0, pct: 0, count: 0 },
    expense: { category: 'expense', label: 'Spending', saved: 0, target: 0, pct: 0, count: 0 },
    income: { category: 'income', label: 'Income', saved: 0, target: 0, pct: 0, count: 0 },
  };
  for (const g of goals) {
    if (g.isBucket || g.disabled || g.completed) continue;
    const r = rings[goalCategoryOf(g)];
    r.saved = safeAdd(r.saved, convert(Math.min(g.currentAmount ?? 0, g.amount), g.currency));
    r.target = safeAdd(r.target, convert(g.amount, g.currency));
    r.count += 1;
  }
  return (['savings', 'expense', 'income'] as GoalCategory[]).map(c => {
    const r = rings[c];
    return { ...r, saved: round2(r.saved), target: round2(r.target), pct: r.target > 0 ? Math.min(100, (r.saved / r.target) * 100) : 0 };
  });
};

export interface Coverage { accountId: string; goalsTotal: number; projected: number; byDate: string }

/**
 * Accounts whose savings goals need more than the account is projected to hold on the latest goal date (F-05). Uses
 * the projection when the account is in it, else today's balance.
 */
export const accountCoverage = (
  goals: FinancialGoal[], days: ForecastDay[], todayBalances: Record<string, number>, convert: Converter,
): Coverage[] => {
  const groups = new Map<string, { total: number; latest: string }>();
  for (const g of goals) {
    if (g.isBucket || g.disabled || g.completed || goalCategoryOf(g) !== 'savings') continue;
    const accountId = g.destinationAccountId || g.paymentAccountId;
    if (!accountId) continue;
    const entry = groups.get(accountId) ?? { total: 0, latest: '' };
    entry.total = safeAdd(entry.total, convert(g.amount, g.currency));
    const due = g.type === 'one-time' ? g.date ?? '' : g.endDate ?? '';
    if (due > entry.latest) entry.latest = due;
    groups.set(accountId, entry);
  }
  const out: Coverage[] = [];
  for (const [accountId, { total, latest }] of groups) {
    const day = latest ? [...days].reverse().find(d => d.date <= latest) : days[days.length - 1];
    const projected = day?.byAccount[accountId] ?? todayBalances[accountId];
    if (projected === undefined) continue;
    if (projected + 0.005 < total) out.push({ accountId, goalsTotal: round2(total), projected: round2(projected), byDate: latest || day?.date || '' });
  }
  return out;
};

export interface MonthlyTarget { key: string; label: string; income: number; savings: number; expense: number }

/**
 * What goals ask of each month for the next `months` months (F9): a dated goal's remainder in its month, a recurring
 * goal's contribution every month. By account or by month, in the display currency.
 */
export const monthlyTargets = (
  goals: FinancialGoal[], activeIds: string[], accountName: (id?: string) => string, today: Date, convert: Converter, by: 'account' | 'month', months = 6,
): MonthlyTarget[] => {
  const active = new Set(activeIds);
  const limit = iso(new Date(today.getFullYear(), today.getMonth() + months, 0));
  const map = new Map<string, MonthlyTarget>();
  const add = (key: string, label: string, category: GoalCategory, amount: number) => {
    const t = map.get(key) ?? { key, label, income: 0, savings: 0, expense: 0 };
    t[category === 'income' ? 'income' : category === 'expense' ? 'expense' : 'savings'] = round2(t[category === 'income' ? 'income' : category === 'expense' ? 'expense' : 'savings'] + amount);
    map.set(key, t);
  };
  const monthLabel = (ym: string) => parseLocalDate(`${ym}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  for (const g of goals) {
    if (g.isBucket || g.disabled || g.completed || !active.has(g.id)) continue;
    const remaining = round2(g.amount - (g.currentAmount ?? 0));
    if (remaining <= 0) continue;
    const category = goalCategoryOf(g);
    const accountKey = g.paymentAccountId || 'none';
    const accountLabel = accountName(g.paymentAccountId) || 'No account';
    const entries: { ym: string; amount: number }[] = [];
    if (g.monthlyContribution && g.monthlyContribution > 0) {
      for (let i = 0; i < months; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const ym = iso(d).slice(0, 7);
        if (g.type === 'one-time' && g.date && `${ym}-01` > g.date) break;
        entries.push({ ym, amount: (g.monthlyContribution * perYear(g.frequency)) / 12 });
      }
    } else if (g.type === 'one-time' && g.date && g.date >= iso(today) && g.date <= limit) {
      entries.push({ ym: g.date.slice(0, 7), amount: remaining });
    }
    for (const e of entries) {
      const amount = convert(e.amount, g.currency);
      if (by === 'account') add(accountKey, accountLabel, category, amount);
      else add(e.ym, monthLabel(e.ym), category, amount);
    }
  }
  return [...map.values()].sort((a, b) => (by === 'month' ? (a.key < b.key ? -1 : 1) : a.label.localeCompare(b.label)));
};

// ---------------------------------------------------------------------------------------------------------------
// The goal form
// ---------------------------------------------------------------------------------------------------------------

export interface GoalDraft {
  category: GoalCategory | 'bucket';
  name: string;
  amount: string;
  saved: string;
  currency: Currency;
  timing: 'by-date' | 'ongoing';
  date: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  contribution: string;
  dayOfMonth: string;
  paymentAccountId: string;
  destinationAccountId: string;
  parentId: string;
}

export const emptyGoalDraft = (currency: Currency, today: Date, parentId = ''): GoalDraft => ({
  category: 'savings', name: '', amount: '', saved: '', currency, timing: 'by-date', date: iso(addDays(today, 365)), frequency: 'monthly',
  startDate: iso(today), contribution: '', dayOfMonth: '', paymentAccountId: '', destinationAccountId: '', parentId,
});

export const draftFromGoal = (g: FinancialGoal): GoalDraft => ({
  category: g.isBucket ? 'bucket' : goalCategoryOf(g),
  name: g.name,
  amount: g.isBucket ? '' : String(g.amount),
  saved: g.isBucket ? '' : String(g.currentAmount ?? 0),
  currency: g.currency,
  timing: g.type === 'recurring' ? 'ongoing' : 'by-date',
  date: g.date ?? '',
  frequency: g.frequency ?? 'monthly',
  startDate: g.startDate ?? '',
  contribution: g.monthlyContribution ? String(g.monthlyContribution) : '',
  dayOfMonth: g.dueDateOfMonth ? String(g.dueDateOfMonth) : '',
  paymentAccountId: g.paymentAccountId ?? '',
  destinationAccountId: g.destinationAccountId ?? '',
  parentId: g.parentId ?? '',
});

export type GoalPlan = { ok: true; goal: Omit<FinancialGoal, 'id'> & { id?: string } } | { ok: false; error: string };

/** Validates a draft and builds the goal (classic `GoalScenarioModal` rules: a bucket has no amount, no account and no parent). */
export const planGoal = (draft: GoalDraft, existing?: FinancialGoal): GoalPlan => {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: 'Add a name' };
  if (draft.category === 'bucket') {
    return {
      ok: true,
      goal: {
        ...(existing ?? {}), id: existing?.id, name, type: 'one-time', goalCategory: 'savings', transactionType: 'expense', amount: 0, currentAmount: 0,
        currency: draft.currency, isBucket: true, parentId: undefined, paymentAccountId: undefined, destinationAccountId: undefined,
        date: undefined, frequency: undefined, startDate: undefined, monthlyContribution: undefined, dueDateOfMonth: undefined,
      },
    };
  }
  const amount = round2(parseAmountInput(draft.amount));
  if (!(amount > 0)) return { ok: false, error: 'Enter a target amount' };
  const saved = draft.saved.trim() ? round2(parseAmountInput(draft.saved)) : 0;
  if (Number.isNaN(saved) || saved < 0) return { ok: false, error: 'Saved so far must be zero or more' };
  const contribution = draft.contribution.trim() ? round2(parseAmountInput(draft.contribution)) : undefined;
  if (contribution !== undefined && (Number.isNaN(contribution) || contribution < 0)) return { ok: false, error: 'Check the contribution' };
  const ongoing = draft.timing === 'ongoing';
  if (!ongoing && !draft.date) return { ok: false, error: 'Choose a date' };
  if (ongoing && !contribution) return { ok: false, error: 'An ongoing goal needs a contribution' };
  const day = Number(draft.dayOfMonth);
  const usesDay = ongoing ? draft.frequency === 'monthly' || draft.frequency === 'yearly' : !!contribution;
  return {
    ok: true,
    goal: {
      ...(existing ?? {}),
      id: existing?.id,
      name,
      type: ongoing ? 'recurring' : 'one-time',
      goalCategory: draft.category,
      transactionType: draft.category === 'income' ? 'income' : 'expense',
      amount,
      currentAmount: saved,
      currency: draft.currency,
      isBucket: false,
      parentId: draft.parentId || undefined,
      paymentAccountId: draft.paymentAccountId || undefined,
      destinationAccountId: draft.category === 'savings' && draft.destinationAccountId ? draft.destinationAccountId : undefined,
      date: ongoing ? undefined : draft.date,
      frequency: ongoing ? draft.frequency : undefined,
      startDate: ongoing ? (draft.startDate || undefined) : undefined,
      monthlyContribution: contribution,
      dueDateOfMonth: usesDay && day >= 1 && day <= 31 ? day : undefined,
    },
  };
};

/** Accounts a goal can pay from or into (open, not debts). */
export const goalAccounts = (accounts: Account[]) => accounts.filter(a => a.status !== 'closed' && !['Credit Card', 'Loan', 'Other Liabilities'].includes(a.type));
