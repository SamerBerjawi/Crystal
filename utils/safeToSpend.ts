import type { Account, BillPayment, RecurringTransaction, RecurringTransactionOverride, Transaction } from '../types';
import { convertToEur, expandRecurringOccurrences, parseLocalDate, safeAdd, safeRound, safeSubtract, toLocalISOString } from '../utils';
import { resolveRealTodayBalance } from './accountDetailModel';

const INCOME_LOOKAHEAD_DAYS = 62;
const DAY_MS = 86_400_000;

export interface SafeToSpendPayment {
  date: string;
  description: string;
  amount: number;
}

export interface SafeToSpend {
  /** Cash, less everything due before the next income, less the cushion. All in EUR. */
  amount: number;
  perDay: number;
  cash: number;
  upcoming: number;
  cushion: number;
  /** The next income date, or the last day of the month when none is scheduled. */
  until: string;
  untilReason: 'income' | 'monthEnd';
  daysLeft: number;
  accounts: Account[];
  payments: SafeToSpendPayment[];
}

const isCash = (account: Account) => account.type === 'Other Assets' && account.otherSubType === 'Cash';

/** The primary checking account and cash accounts (D-076). With no primary set, every checking account counts. */
export const spendingAccounts = (accounts: Account[]): Account[] => {
  const open = accounts.filter(account => account.status !== 'closed' && (account.includeInAnalytics ?? true));
  const checking = open.filter(account => account.type === 'Checking');
  const primary = checking.filter(account => account.isPrimary);
  return [...(primary.length ? primary : checking), ...open.filter(isCash)];
};

interface SafeToSpendInput {
  accounts: Account[];
  transactions: Transaction[];
  /** Recurring items, including the synthetic loan and card payments. */
  recurringItems: RecurringTransaction[];
  bills: BillPayment[];
  overrides?: RecurringTransactionOverride[];
  cushion?: number;
  referenceDate?: Date;
}

export function computeSafeToSpend({ accounts, transactions, recurringItems, bills, overrides = [], cushion = 0, referenceDate = new Date() }: SafeToSpendInput): SafeToSpend {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayStr = toLocalISOString(today);
  const spending = spendingAccounts(accounts);
  const ids = new Set(spending.map(account => account.id));

  const cash = spending.reduce((sum, account) => {
    const balance = resolveRealTodayBalance(account, transactions.filter(tx => tx.accountId === account.id), { referenceDate: today });
    return safeAdd(sum, convertToEur(balance, account.currency));
  }, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const lookahead = new Date(today);
  lookahead.setDate(lookahead.getDate() + INCOME_LOOKAHEAD_DAYS);

  const incomeDates = [
    ...recurringItems
      .filter(item => item.type === 'income' && ids.has(item.accountId))
      .flatMap(item => expandRecurringOccurrences(item, tomorrow, lookahead, overrides).map(occurrence => occurrence.date)),
    ...bills
      .filter(bill => bill.type === 'deposit' && bill.status === 'unpaid' && !!bill.accountId && ids.has(bill.accountId) && bill.dueDate > todayStr)
      .map(bill => bill.dueDate),
  ].sort();

  const until = incomeDates[0] ?? toLocalISOString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const untilReason = incomeDates.length ? 'income' : 'monthEnd';
  const lastDay = new Date(parseLocalDate(until));
  // With a payday, what falls on that day is paid from the new income. A month end has no such cover, so it counts.
  if (untilReason === 'income') lastDay.setDate(lastDay.getDate() - 1);

  const payments: SafeToSpendPayment[] = [];

  recurringItems
    .filter(item => (item.type === 'expense' || item.type === 'transfer') && ids.has(item.accountId))
    .filter(item => !(item.type === 'transfer' && item.toAccountId && ids.has(item.toAccountId)))
    .forEach(item => {
      expandRecurringOccurrences(item, today, lastDay, overrides).forEach(occurrence => {
        payments.push({ date: occurrence.date, description: occurrence.description, amount: convertToEur(occurrence.amount, item.currency) });
      });
    });

  const lastDayStr = toLocalISOString(lastDay);
  bills
    .filter(bill => bill.type === 'payment' && bill.status === 'unpaid' && !!bill.accountId && ids.has(bill.accountId) && bill.dueDate <= lastDayStr)
    .forEach(bill => {
      payments.push({ date: bill.dueDate, description: bill.description, amount: convertToEur(Math.abs(bill.amount), bill.currency) });
    });

  payments.sort((a, b) => a.date.localeCompare(b.date));

  const upcoming = payments.reduce((sum, payment) => safeAdd(sum, payment.amount), 0);
  const amount = safeRound(safeSubtract(safeSubtract(cash, upcoming), cushion), 2);
  const daysLeft = Math.max(1, Math.round((parseLocalDate(until).getTime() - today.getTime()) / DAY_MS));

  return {
    amount,
    perDay: amount > 0 ? safeRound(amount / daysLeft, 2) : 0,
    cash: safeRound(cash, 2),
    upcoming: safeRound(upcoming, 2),
    cushion,
    until,
    untilReason,
    daysLeft,
    accounts: spending,
    payments,
  };
}
