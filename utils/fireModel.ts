import type { Account, Transaction } from '../types';
import { calculateAccountTotals, convertToMain, parseLocalDate, round2, safeAdd, safeSubtract, toLocalISOString } from '../utils';
import { isCounted } from './reportsModel';

/*
 * What FIRE starts from: the counted accounts, their history and your savings rate. Pure, and tested in tests/unit/fireModel.test.ts.
 *
 * Everything is in today's money. The expected return is a REAL return (after inflation), so the FI number does not
 * drift and contributions need no inflation adjustment. Amounts are in the main currency.
 *
 * This is arithmetic on your own figures, not advice: it assumes steady returns and steady saving, which real life does
 * not. The page says so, and shows a range.
 */

// ---- accounts and history ----

const inAnalytics = (account: Account) => account.status !== 'closed' && (account.includeInAnalytics ?? true);

/** Cash, savings and investments, which is what most people count toward independence. A home or a car is not spendable. */
export const defaultFireAccounts = (accounts: Account[]): Account[] =>
  accounts.filter(account => inAnalytics(account) && (account.type === 'Checking' || account.type === 'Savings' || account.type === 'Investment' || (account.type === 'Other Assets' && account.otherSubType === 'Cash')));

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
