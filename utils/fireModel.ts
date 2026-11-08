import type { Account, Transaction } from '../types';
import { calculateAccountTotals, convertToMain, parseLocalDate, round2, safeAdd, safeSubtract, toLocalISOString } from '../utils';
import { isCounted } from './reportsModel';

/*
 * Financial independence (FIRE) and net-worth milestones. Pure, and tested in tests/unit/fireModel.test.ts.
 *
 * Everything is in today's money. The expected return is a REAL return (after inflation), so the FI number does not
 * drift and contributions need no inflation adjustment. Amounts are in the main currency.
 *
 * This is arithmetic on your own figures, not advice: it assumes steady returns and steady saving, which real life does
 * not. The page says so, and shows a range.
 */

export interface FireSettings {
  /** The share of the portfolio you expect to spend each year. 0.04 is the "4% rule". */
  withdrawalRate: number;
  /** Expected yearly return after inflation. */
  expectedReturn: number;
  expenses: { mode: 'actual' | 'manual'; manualAnnual?: number };
  contribution: { mode: 'actual' | 'manual'; manualMonthly?: number };
  /** The accounts that count. Left out, the default set is used (cash, savings and investments). */
  accountIds?: string[];
  currentAge?: number;
  retirementAge?: number;
}

export const DEFAULT_FIRE_SETTINGS: FireSettings = {
  withdrawalRate: 0.04,
  expectedReturn: 0.05,
  expenses: { mode: 'actual' },
  contribution: { mode: 'actual' },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Settings as stored, made safe: missing values filled in, wild ones pulled into a sensible range. */
export const normalizeFireSettings = (raw: unknown): FireSettings => {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const age = (value: unknown) => (finite(value) ? Math.round(clamp(value, 16, 100)) : undefined);
  const settings: FireSettings = {
    withdrawalRate: finite(input.withdrawalRate) ? clamp(input.withdrawalRate, 0.02, 0.1) : DEFAULT_FIRE_SETTINGS.withdrawalRate,
    expectedReturn: finite(input.expectedReturn) ? clamp(input.expectedReturn, 0, 0.15) : DEFAULT_FIRE_SETTINGS.expectedReturn,
    expenses: input.expenses?.mode === 'manual' && finite(input.expenses.manualAnnual) && input.expenses.manualAnnual > 0
      ? { mode: 'manual', manualAnnual: round2(input.expenses.manualAnnual) } : { mode: 'actual' },
    contribution: input.contribution?.mode === 'manual' && finite(input.contribution.manualMonthly)
      ? { mode: 'manual', manualMonthly: round2(input.contribution.manualMonthly) } : { mode: 'actual' },
    accountIds: Array.isArray(input.accountIds) ? input.accountIds.filter((id: unknown) => typeof id === 'string') : undefined,
    currentAge: age(input.currentAge),
    retirementAge: age(input.retirementAge),
  };
  // A retirement age at or before today's age leaves nothing to grow into.
  if (settings.currentAge !== undefined && settings.retirementAge !== undefined && settings.retirementAge <= settings.currentAge) settings.retirementAge = undefined;
  return settings;
};

// ---- accounts and history ----

const inAnalytics = (account: Account) => account.status !== 'closed' && (account.includeInAnalytics ?? true);

/** Cash, savings and investments, which is what most people count toward independence. A home or a car is not spendable. */
export const defaultFireAccounts = (accounts: Account[]): Account[] =>
  accounts.filter(account => inAnalytics(account) && (account.type === 'Checking' || account.type === 'Savings' || account.type === 'Investment' || (account.type === 'Other Assets' && account.otherSubType === 'Cash')));

export const fireAccounts = (accounts: Account[], settings: FireSettings): Account[] => {
  if (!settings.accountIds) return defaultFireAccounts(accounts);
  const wanted = new Set(settings.accountIds);
  return accounts.filter(account => wanted.has(account.id) && inAnalytics(account));
};

const monthKeyOf = (date: string) => date.slice(0, 7);
const keyOfDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const addMonthsToKey = (key: string, months: number) => {
  const [year, month] = key.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};
const monthsBetweenKeys = (from: string, to: string) => {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

const signed = (tx: Transaction) => (tx.type === 'expense' ? -Math.abs(convertToMain(tx.amount, tx.currency)) : Math.abs(convertToMain(tx.amount, tx.currency)));

export interface ValuePoint { month: string; value: number }

/**
 * What these accounts were worth at the end of each month, newest last. It starts from today's value and walks the
 * transactions backwards, the way the Overview's net worth chart does: a transfer between two of these accounts changes
 * nothing, while one to an account outside the set counts. Market gains and losses are not in the transactions, so the
 * past is "what was paid in and out", and is least exact for investments.
 */
export const balanceHistory = (selected: Account[], transactions: Transaction[], today: Date, maxMonths = 60): ValuePoint[] => {
  const ids = new Set(selected.map(account => account.id));
  const todayKey = toLocalISOString(today).slice(0, 10);
  const currentMonth = keyOfDate(today);
  const usable = transactions.filter(tx => !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment);

  const legs = new Map<string, Transaction[]>();
  usable.forEach(tx => { if (tx.transferId) legs.set(tx.transferId, [...(legs.get(tx.transferId) ?? []), tx]); });
  const internal = new Set<string>();
  legs.forEach((group, id) => { if (group.every(tx => ids.has(tx.accountId))) internal.add(id); });

  const relevant = usable.filter(tx => ids.has(tx.accountId) && !(tx.transferId && internal.has(tx.transferId)));
  // Already "as of today": the balance of an account leaves out what is dated after today.
  const nowValue = round2(calculateAccountTotals(selected, usable).netWorth);

  const delta = new Map<string, number>();
  relevant.forEach(tx => {
    if (tx.date.slice(0, 10) > todayKey) return;
    delta.set(monthKeyOf(tx.date), safeAdd(delta.get(monthKeyOf(tx.date)) ?? 0, signed(tx)));
  });
  if (delta.size === 0) return [{ month: currentMonth, value: nowValue }];

  const earliest = [...delta.keys()].sort()[0];
  const first = monthsBetweenKeys(earliest, currentMonth) > maxMonths ? addMonthsToKey(currentMonth, -maxMonths) : earliest;
  const points: ValuePoint[] = [];
  let value = nowValue;
  for (let key = currentMonth; ; key = addMonthsToKey(key, -1)) {
    points.push({ month: key, value: round2(value) });
    if (key <= first) {
      // The month before the first transaction is what the accounts held to begin with.
      points.push({ month: addMonthsToKey(key, -1), value: round2(safeSubtract(value, delta.get(key) ?? 0)) });
      break;
    }
    value = safeSubtract(value, delta.get(key) ?? 0);
  }
  return points.reverse();
};

// ---- savings rate ----

export interface MonthCashflow { month: string; income: number; spending: number; saved: number; rate: number | null; partial: boolean }

/** Income and spending per month for the last `months` months. Transfers are neither, so moving money to savings is saving. */
export const monthlyCashflow = (transactions: Transaction[], accounts: Account[], today: Date, months = 24, showAdjustments = false): MonthCashflow[] => {
  const ids = new Set(accounts.filter(inAnalytics).map(account => account.id));
  const currentMonth = keyOfDate(today);
  const todayKey = toLocalISOString(today).slice(0, 10);
  const totals = new Map<string, { income: number; spending: number }>();
  transactions.forEach(tx => {
    if (!ids.has(tx.accountId) || !isCounted(tx, showAdjustments) || tx.date.slice(0, 10) > todayKey) return;
    const cell = totals.get(monthKeyOf(tx.date)) ?? { income: 0, spending: 0 };
    if (tx.type === 'income') cell.income = safeAdd(cell.income, Math.abs(convertToMain(tx.amount, tx.currency)));
    else if (tx.type === 'expense') cell.spending = safeAdd(cell.spending, Math.abs(convertToMain(tx.amount, tx.currency)));
    totals.set(monthKeyOf(tx.date), cell);
  });
  const earliest = [...totals.keys()].sort()[0];
  if (!earliest) return [];
  const start = monthsBetweenKeys(earliest, currentMonth) >= months ? addMonthsToKey(currentMonth, -(months - 1)) : earliest;
  const out: MonthCashflow[] = [];
  for (let key = start; key <= currentMonth; key = addMonthsToKey(key, 1)) {
    const cell = totals.get(key) ?? { income: 0, spending: 0 };
    const saved = round2(safeSubtract(cell.income, cell.spending));
    out.push({ month: key, income: round2(cell.income), spending: round2(cell.spending), saved, rate: cell.income > 0 ? saved / cell.income : null, partial: key === currentMonth });
  }
  return out;
};

export interface TrailingSavings { income: number; spending: number; saved: number; rate: number | null; months: number }

/** The last `count` finished months that had any activity. A short history is used as far as it goes. */
export const trailingSavings = (series: MonthCashflow[], count = 12): TrailingSavings => {
  const used = series.filter(month => !month.partial && (month.income > 0 || month.spending > 0)).slice(-count);
  const income = used.reduce((sum, month) => safeAdd(sum, month.income), 0);
  const spending = used.reduce((sum, month) => safeAdd(sum, month.spending), 0);
  return { income: round2(income), spending: round2(spending), saved: round2(safeSubtract(income, spending)), rate: income > 0 ? safeSubtract(income, spending) / income : null, months: used.length };
};

// ---- the arithmetic of independence ----

export const fiNumber = (annualExpenses: number, withdrawalRate: number) => (annualExpenses > 0 && withdrawalRate > 0 ? round2(annualExpenses / withdrawalRate) : 0);

/** What you need today for growth alone to reach `fi` in `years` years, with no more saving. With no years left, all of it. */
export const coastNumber = (fi: number, years: number, annualReturn: number) => (fi > 0 ? round2(years > 0 ? fi / Math.pow(1 + annualReturn, years) : fi) : 0);

const monthlyRate = (annualReturn: number) => Math.pow(1 + annualReturn, 1 / 12) - 1;

/** Whole months until `start` grows, with `monthly` added at each month's end, to `target`. Null when it never does (within 100 years). */
export const monthsToReach = (start: number, target: number, monthly: number, annualReturn: number, maxMonths = 1200): number | null => {
  if (start >= target) return 0;
  const m = monthlyRate(annualReturn);
  let value = start;
  for (let month = 1; month <= maxMonths; month++) {
    value = value * (1 + m) + monthly;
    if (value >= target) return month;
    // Shrinking and already past the point of no return.
    if (month > 24 && value < start && monthly <= 0) return null;
  }
  return null;
};

export const projectValues = (start: number, monthly: number, annualReturn: number, months: number): number[] => {
  const m = monthlyRate(annualReturn);
  const out = [start];
  for (let i = 1; i <= months; i++) out.push(out[i - 1] * (1 + m) + monthly);
  return out.map(round2);
};

/** Months until growth and saving reach the Coast FI number, which itself falls as the retirement age nears. Null if it never does before then. */
export const monthsToCoast = (start: number, monthly: number, annualReturn: number, fi: number, yearsToRetirement: number): number | null => {
  if (fi <= 0 || yearsToRetirement <= 0) return null;
  if (start >= coastNumber(fi, yearsToRetirement, annualReturn)) return 0;
  const m = monthlyRate(annualReturn);
  let value = start;
  const total = Math.floor(yearsToRetirement * 12);
  for (let month = 1; month <= total; month++) {
    value = value * (1 + m) + monthly;
    if (value >= coastNumber(fi, yearsToRetirement - month / 12, annualReturn)) return month;
  }
  return null;
};

/** The month a value has been at or above `threshold` continuously since. Null when it is below today. */
export const sinceMonth = (history: ValuePoint[], threshold: number): { month: string; beforeHistory: boolean } | null => {
  if (history.length === 0 || history[history.length - 1].value < threshold) return null;
  let index = history.length - 1;
  while (index > 0 && history[index - 1].value >= threshold) index -= 1;
  return { month: history[index].month, beforeHistory: index === 0 };
};

/**
 * The month Coast FI was last reached and held since. The amount needed falls the further back you look (more years to
 * grow), so each month is compared with what was needed then, not with today's number.
 */
export const sinceCoast = (history: ValuePoint[], fi: number, yearsToRetirement: number, annualReturn: number): { month: string; beforeHistory: boolean } | null => {
  const last = history.length - 1;
  if (last < 0) return null;
  const needed = (index: number) => coastNumber(fi, yearsToRetirement + (last - index) / 12, annualReturn);
  if (history[last].value < needed(last)) return null;
  let index = last;
  while (index > 0 && history[index - 1].value >= needed(index - 1)) index -= 1;
  return { month: history[index].month, beforeHistory: index === 0 };
};

/** Round-number steps worth marking: 1k, 2.5k, 5k, 7.5k, 10k, 25k ... through the three past `max`. */
export const niceThresholds = (max: number): number[] => {
  const out: number[] = [];
  let beyond = 0;
  for (let power = 3; power <= 9; power++) {
    for (const step of [1, 2.5, 5, 7.5]) {
      const value = step * Math.pow(10, power);
      out.push(value);
      if (value > max && ++beyond >= 3) return out;
    }
  }
  return out;
};

// ---- the whole picture ----

export interface FireStage { id: string; label: string; amount: number; kind: 'percent' | 'coast' | 'fi' }

export interface StageStatus extends FireStage {
  reached: boolean;
  /** For a reached stage, the month it was passed (and held since). */
  since?: { month: string; beforeHistory: boolean };
  /** For one ahead, months from now at the current pace. */
  monthsAway?: number | null;
}

export interface NetWorthMilestone { amount: number; reached: boolean; since?: { month: string; beforeHistory: boolean }; monthsAway?: number | null; progress?: number }

export interface FireSummary {
  ready: boolean;
  warnings: string[];
  accounts: Account[];
  portfolio: number;
  history: ValuePoint[];
  expenses: { annual: number; monthly: number; source: 'actual' | 'manual'; monthsOfData: number };
  savings: { series: MonthCashflow[]; trailing: TrailingSavings; monthlyContribution: number };
  fi: {
    number: number;
    progress: number;
    remaining: number;
    /** What the portfolio could pay each month at the withdrawal rate. */
    monthlyIncome: number;
    coverage: number;
    months: number | null;
    scenarios: { cautious: number | null; expected: number | null; optimistic: number | null };
  };
  coast: { number: number; reached: boolean; yearsToRetirement: number; monthsAway: number | null } | null;
  stages: StageStatus[];
  netWorth: { current: number; history: ValuePoint[]; milestones: NetWorthMilestone[]; otherAssets: number };
  /** The portfolio month by month from now, for the chart: as far as FI plus a margin, at most 40 years. */
  projection: number[];
}

export interface FireInput { accounts: Account[]; transactions: Transaction[]; today: Date; showAdjustments?: boolean }

/** The month `months` from now, as a date on the 1st. */
export const dateInMonths = (today: Date, months: number) => new Date(today.getFullYear(), today.getMonth() + months, 1);

export const buildFire = ({ accounts, transactions, today, showAdjustments = false }: FireInput, rawSettings: Partial<FireSettings> | undefined): FireSummary => {
  const settings = normalizeFireSettings(rawSettings);
  const selected = fireAccounts(accounts, settings);
  const history = balanceHistory(selected, transactions, today);
  const portfolio = history[history.length - 1]?.value ?? 0;
  const warnings: string[] = [];

  const series = monthlyCashflow(transactions, accounts, today, 24, showAdjustments);
  const trailing = trailingSavings(series, 12);
  const annualFromHistory = trailing.months > 0 ? round2((trailing.spending / trailing.months) * 12) : 0;
  const annual = settings.expenses.mode === 'manual' ? settings.expenses.manualAnnual ?? 0 : annualFromHistory;
  const monthlyContribution = settings.contribution.mode === 'manual' ? settings.contribution.manualMonthly ?? 0 : trailing.months > 0 ? round2(trailing.saved / trailing.months) : 0;

  if (selected.length === 0) warnings.push('No accounts are counted toward independence. Choose some in the settings.');
  if (settings.expenses.mode === 'actual' && trailing.months === 0) warnings.push('There is no spending history yet, so there is no FI number. Add transactions, or enter your yearly spending in the settings.');
  else if (settings.expenses.mode === 'actual' && trailing.months < 3) warnings.push(`Only ${trailing.months} ${trailing.months === 1 ? 'month' : 'months'} of history, so spending and saving are rough.`);
  if (monthlyContribution <= 0 && annual > 0) warnings.push('You are not adding to the portfolio at the moment, so it only grows by its return.');

  const number = fiNumber(annual, settings.withdrawalRate);
  const ready = number > 0;
  const r = settings.expectedReturn;
  const scenario = (rate: number) => (ready ? monthsToReach(portfolio, number, monthlyContribution, Math.max(0, rate)) : null);
  const months = scenario(r);

  const yearsToRetirement = settings.currentAge !== undefined && settings.retirementAge !== undefined ? settings.retirementAge - settings.currentAge : 0;
  const coastAmount = ready && yearsToRetirement > 0 ? coastNumber(number, yearsToRetirement, r) : 0;
  const coast = coastAmount > 0 ? {
    number: coastAmount,
    reached: portfolio >= coastAmount,
    yearsToRetirement,
    monthsAway: monthsToCoast(portfolio, monthlyContribution, r, number, yearsToRetirement),
  } : null;

  const stage = (id: string, label: string, amount: number, kind: FireStage['kind']): FireStage => ({ id, label, amount, kind });
  const stageDefs: FireStage[] = ready
    ? [
      stage('quarter', '25% of FI', round2(number * 0.25), 'percent'),
      stage('half', 'Half way', round2(number * 0.5), 'percent'),
      ...(coast ? [stage('coast', 'Coast FI', coast.number, 'coast')] : []),
      stage('lean', 'Lean FI (70%)', round2(number * 0.7), 'percent'),
      stage('fi', 'Financial independence', number, 'fi'),
      stage('fat', 'Fat FI (150%)', round2(number * 1.5), 'percent'),
    ].sort((a, b) => a.amount - b.amount)
    : [];
  const stages: StageStatus[] = stageDefs.map(stage => {
    // Coast FI moves: what you need rises as retirement nears, so it has its own date arithmetic.
    if (stage.kind === 'coast' && coast) {
      const since = coast.reached ? sinceCoast(history, number, yearsToRetirement, r) : null;
      return since ? { ...stage, reached: true, since } : { ...stage, reached: false, monthsAway: coast.monthsAway };
    }
    const since = sinceMonth(history, stage.amount);
    return since ? { ...stage, reached: true, since } : { ...stage, reached: false, monthsAway: monthsToReach(portfolio, stage.amount, monthlyContribution, r) };
  });

  // Net worth: what is outside the counted accounts is held flat (a home, a car), the portfolio grows.
  const everything = accounts.filter(inAnalytics);
  const worthHistory = balanceHistory(everything, transactions, today);
  const worth = worthHistory[worthHistory.length - 1]?.value ?? 0;
  const otherAssets = round2(safeSubtract(worth, portfolio));
  const top = niceThresholds(Math.max(worth, 0));
  const reachedAmounts = top.filter(amount => worth >= amount);
  const nextAmounts = top.filter(amount => worth < amount).slice(0, 3);
  const lowerBound = reachedAmounts[reachedAmounts.length - 1] ?? 0;
  const milestones: NetWorthMilestone[] = [
    ...reachedAmounts.slice(-4).map(amount => ({ amount, reached: true, since: sinceMonth(worthHistory, amount) ?? undefined })),
    ...nextAmounts.map((amount, index) => ({
      amount, reached: false,
      monthsAway: monthsToReach(portfolio, safeSubtract(amount, otherAssets), monthlyContribution, r),
      ...(index === 0 && amount > lowerBound ? { progress: Math.max(0, Math.min(1, (worth - lowerBound) / (amount - lowerBound))) } : {}),
    })),
  ];

  const horizon = months === null ? 120 : Math.min(480, Math.max(120, months + 24));

  return {
    ready, warnings, accounts: selected, portfolio, history,
    expenses: { annual, monthly: round2(annual / 12), source: settings.expenses.mode, monthsOfData: trailing.months },
    savings: { series, trailing, monthlyContribution },
    fi: {
      number,
      progress: ready ? portfolio / number : 0,
      remaining: round2(Math.max(0, number - portfolio)),
      monthlyIncome: round2((portfolio * settings.withdrawalRate) / 12),
      coverage: annual > 0 ? (portfolio * settings.withdrawalRate) / annual : 0,
      months,
      scenarios: { cautious: scenario(r - 0.02), expected: months, optimistic: scenario(r + 0.02) },
    },
    coast,
    stages,
    netWorth: { current: worth, history: worthHistory, milestones, otherAssets },
    projection: projectValues(portfolio, monthlyContribution, r, horizon),
  };
};

/** "9 months", "20 years", "4 years 2 months". Null is "never at this pace". */
export const describeMonths = (months: number | null): string => {
  if (months === null) return 'not at this pace';
  if (months <= 0) return 'now';
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${years === 1 ? 'year' : 'years'}${rest ? ` ${rest} ${rest === 1 ? 'month' : 'months'}` : ''}`;
};
