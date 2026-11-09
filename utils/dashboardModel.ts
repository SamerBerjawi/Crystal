import {
  Account,
  AccountType,
  BillPayment,
  Category,
  CategorySpending,
  Currency,
  DisplayTransaction,
  Duration,
  FinancialGoal,
  ForecastDuration,
  LoanPaymentOverrides,
  RecurringTransaction,
  RecurringTransactionOverride,
  Transaction,
  Warrant,
} from '../types';
import {
  ASSET_TYPES,
  DEBT_TYPES,
  LIQUID_ACCOUNT_TYPES,
} from '../constants';
import {
  calculateAccountTotals,
  calculateStatementPeriods,
  convertToMain,
  formatDateKey,
  getCreditCardStatementDetails,
  getDateRange,
  getPreferredTimeZone,
  parseLocalDate,
  resolveAccountBalance,
  safeRound,
  toLocalISOString,
} from '../utils';
import {
  forecastFromData,
  horizonTiles,
  warrantTaxBills,
} from './forecastModel';
import { resolveTransferInfo } from './transferDetails';
import type { FlowBucket } from '../components/PeriodFlowWidget';

export type AssetGroup = {
  types: AccountType[];
  value: number;
  color: string;
  icon: string;
};

export type EnrichedTransaction = Transaction & {
  convertedAmount: number;
  parsedDate: Date;
};

export const findCategoryDetails = (
  name: string,
  categories: Category[]
): Category | undefined => {
  for (const cat of categories) {
    if (cat.name === name) return cat;
    if (cat.subCategories.length > 0) {
      const found = findCategoryDetails(name, cat.subCategories);
      if (found) return found;
    }
  }
  return undefined;
};

export const findCategoryById = (
  id: string,
  categories: Category[]
): Category | undefined => {
  for (const cat of categories) {
    if (cat.id === id) return cat;
    if (cat.subCategories?.length) {
      const found = findCategoryById(id, cat.subCategories);
      if (found) return found;
    }
  }
  return undefined;
};

export const mapHistoricalDurationToForecast = (duration: Duration): ForecastDuration => {
  switch (duration) {
    case 'TODAY':
    case 'WTD':
    case 'MTD':
    case '30D':
      return '3M';
    case '60D':
    case '90D':
    case '6M':
      return '6M';
    case 'YTD':
    case '1Y':
    case 'ALL':
    default:
      return '1Y';
  }
};

export const computeMonthFlow = (analyticsTransactions: Transaction[]) => {
  const monthPrefix = toLocalISOString(new Date()).slice(0, 7);
  return analyticsTransactions.reduce(
    (flow, tx) => {
      if (tx.transferId || !tx.date.startsWith(monthPrefix)) return flow;
      const eur = convertToMain(tx.amount, tx.currency);
      if (tx.type === 'income') flow.income += eur;
      else flow.spending += Math.abs(eur);
      return flow;
    },
    { income: 0, spending: 0 }
  );
};

export const computeMonthDeltas = (
  analyticsTransactions: Transaction[],
  monthFlow: { income: number; spending: number }
) => {
  const today = new Date();
  const day = today.getDate();
  const prevStart = toLocalISOString(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const prevCutoff = toLocalISOString(
    new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      Math.min(day, new Date(today.getFullYear(), today.getMonth(), 0).getDate())
    )
  );
  const prevMonthName = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  ).toLocaleDateString('en-GB', { month: 'short' });

  let income = 0;
  let spending = 0;
  for (const tx of analyticsTransactions) {
    if (tx.transferId || tx.date < prevStart || tx.date > prevCutoff) continue;
    const eur = convertToMain(tx.amount, tx.currency);
    if (tx.type === 'income') income += eur;
    else spending += Math.abs(eur);
  }
  const change = (now: number, before: number) =>
    before > 0 ? ((now - before) / before) * 100 : null;
  const text = (value: number | null) =>
    value === null ? undefined : `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(0)}%`;
  const prevSaved = income > 0 ? ((income - spending) / income) * 100 : null;
  const nowSaved =
    monthFlow.income > 0
      ? ((monthFlow.income - monthFlow.spending) / monthFlow.income) * 100
      : null;
  const savedGap = prevSaved !== null && nowSaved !== null ? nowSaved - prevSaved : null;
  const incomeChange = change(monthFlow.income, income);
  const spendingChange = change(monthFlow.spending, spending);

  return {
    since: `against the same days of ${prevMonthName}`,
    income: {
      badge: text(incomeChange),
      tone: (incomeChange ?? 0) >= 0 ? ('pine' as const) : ('tomato' as const),
    },
    spending: {
      badge: text(spendingChange),
      tone: (spendingChange ?? 0) <= 0 ? ('pine' as const) : ('tomato' as const),
    },
    saved: {
      badge:
        savedGap === null
          ? undefined
          : `${savedGap >= 0 ? '+' : '−'}${Math.abs(savedGap).toFixed(0)} pts`,
      tone: (savedGap ?? 0) >= 0 ? ('pine' as const) : ('tomato' as const),
    },
  };
};

export const computeDayTrends = (analyticsTransactions: Transaction[]) => {
  const days = 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const first = toLocalISOString(start);
  const income = Array<number>(days).fill(0);
  const spending = Array<number>(days).fill(0);
  for (const tx of analyticsTransactions) {
    if (tx.transferId || tx.date < first) continue;
    const index = Math.round((parseLocalDate(tx.date).getTime() - start.getTime()) / 86400000);
    if (index < 0 || index >= days) continue;
    const eur = convertToMain(tx.amount, tx.currency);
    if (tx.type === 'income') income[index] += eur;
    else spending[index] += Math.abs(eur);
  }
  const toSeries = (values: number[]) => values.map(value => ({ value }));
  return { income: toSeries(income), spending: toSeries(spending) };
};

export const computeDashboardForecast = (params: {
  accounts: Account[];
  selectedAccounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  recurringTransactions: RecurringTransaction[];
  financialGoals: FinancialGoal[];
  activeGoalIds: string[];
  billsAndPayments: BillPayment[];
  warrants: Warrant[];
  recurringTransactionOverrides: RecurringTransactionOverride[];
  forecastDuration: ForecastDuration;
}) => {
  const {
    accounts,
    selectedAccounts,
    transactions,
    loanPaymentOverrides,
    recurringTransactions,
    financialGoals,
    activeGoalIds,
    billsAndPayments,
    warrants,
    recurringTransactionOverrides,
    forecastDuration,
  } = params;

  const projectionEndDate = new Date();
  switch (forecastDuration) {
    case '3M':
      projectionEndDate.setMonth(projectionEndDate.getMonth() + 3);
      break;
    case '6M':
      projectionEndDate.setMonth(projectionEndDate.getMonth() + 6);
      break;
    case 'EOY':
      projectionEndDate.setFullYear(projectionEndDate.getFullYear(), 11, 31);
      break;
    case '1Y':
    default:
      projectionEndDate.setMonth(projectionEndDate.getMonth() + 12);
      break;
  }

  const today = new Date();
  const aYearOut = new Date(today.getFullYear(), today.getMonth() + 13, 0);
  const projection = forecastFromData(
    {
      recurring: recurringTransactions,
      overrides: recurringTransactionOverrides,
      bills: [...billsAndPayments, ...warrantTaxBills(warrants, selectedAccounts, accounts)],
      accounts,
      transactions,
      loanPaymentOverrides,
    },
    selectedAccounts,
    financialGoals,
    activeGoalIds,
    today,
    projectionEndDate > aYearOut ? projectionEndDate : aYearOut,
    convertToMain
  );

  const chartEnd = toLocalISOString(projectionEndDate);
  const chartData = projection.days
    .filter(day => day.date <= chartEnd)
    .map(day => ({ date: day.date, value: day.total }));

  const todayIso = toLocalISOString(today);
  const in30 = toLocalISOString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30));
  const window30 = projection.days.filter(day => day.date >= todayIso && day.date <= in30);
  let expectedIn = 0;
  let goingOut = 0;
  let lowest: { value: number; date: string } | null = null;
  for (const day of window30) {
    for (const event of day.events) {
      if (event.amount > 0) expectedIn += event.amount;
      else if (event.amount < 0) goingOut += -event.amount;
    }
    if (!lowest || day.total < lowest.value) lowest = { value: day.total, date: day.date };
  }
  const next30Raw = {
    days: window30.map(day => ({ date: day.date, total: day.total })),
    expectedIn: safeRound(expectedIn, 2),
    goingOut: safeRound(goingOut, 2),
    lowest,
  };

  return {
    forecastChartData: chartData,
    lowestBalanceForecasts: horizonTiles(projection.days, today),
    next30Raw,
  };
};

export const computeAdvancedNextDueDate = (rt: RecurringTransaction, postedDateStr: string): string => {
  const postedDate = parseLocalDate(postedDateStr);
  const nextDueDate = new Date(postedDate);
  const interval = rt.frequencyInterval || 1;
  const startDateLocal = parseLocalDate(rt.startDate);

  switch (rt.frequency) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + interval);
      break;
    case 'weekly':
      nextDueDate.setDate(nextDueDate.getDate() + 7 * interval);
      break;
    case 'biweekly':
      nextDueDate.setDate(nextDueDate.getDate() + 14 * interval);
      break;
    case 'monthly': {
      const d = rt.dueDateOfMonth || startDateLocal.getDate();
      nextDueDate.setMonth(nextDueDate.getMonth() + interval, 1);
      const lastDayOfNextMonth = new Date(
        nextDueDate.getFullYear(),
        nextDueDate.getMonth() + 1,
        0
      ).getDate();
      nextDueDate.setDate(Math.min(d, lastDayOfNextMonth));
      break;
    }
    case 'yearly':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + interval);
      break;
  }

  return toLocalISOString(nextDueDate);
};

export interface InitialPostedModalData {
  initialType?: 'income' | 'expense' | 'transfer';
  initialFromAccountId?: string;
  initialToAccountId?: string;
  initialCategory?: string;
  initialDetails?: {
    date: string;
    amount: string;
    description: string;
    merchant: string;
  };
}

export const buildInitialPostedModalData = (
  item?: RecurringTransaction | BillPayment
): InitialPostedModalData => {
  if (!item) return {};
  let type: 'income' | 'expense' | 'transfer';
  let from: string | undefined;
  let to: string | undefined;
  let category: string | undefined;
  let merchant: string | undefined;

  if ('frequency' in item) {
    const rt = item as RecurringTransaction;
    type = rt.type;
    category = rt.category;
    merchant = rt.merchant;
    if (type === 'transfer') {
      from = rt.accountId;
      to = rt.toAccountId;
    } else if (type === 'income') {
      to = rt.accountId;
    } else {
      from = rt.accountId;
    }
  } else {
    const bill = item as BillPayment;
    type = bill.type === 'deposit' ? 'income' : 'expense';
    category = type === 'income' ? 'Income' : 'Bills & Utilities';
    merchant = (bill as unknown as { merchant?: string; biller?: string }).merchant ||
      (bill as unknown as { biller?: string }).biller;
    if (bill.accountId) {
      if (type === 'income') to = bill.accountId;
      else from = bill.accountId;
    }
  }

  return {
    initialType: type,
    initialFromAccountId: from,
    initialToAccountId: to,
    initialCategory: category,
    initialDetails: {
      date: 'dueDate' in item ? item.dueDate : (item as RecurringTransaction).nextDueDate,
      amount: safeRound(Math.abs(item.amount), 2).toFixed(2),
      description: item.description,
      merchant: merchant || (item as unknown as { merchant?: string })?.merchant || '',
    },
  };
};

export const computePeriodAggregate = (params: {
  duration: Duration;
  analyticsTransactions: Transaction[];
  analyticsSelectedAccountIds: string[];
  transferLookup: Map<string, Transaction[]>;
  excludeTransfersFromAnalytics?: boolean;
}) => {
  const {
    duration,
    analyticsTransactions,
    analyticsSelectedAccountIds,
    transferLookup,
    excludeTransfersFromAnalytics,
  } = params;

  const { start, end } = getDateRange(duration, analyticsTransactions);
  const txsInPeriod = analyticsTransactions.filter(tx => {
    const txDate = parseLocalDate(tx.date);
    return txDate >= start && txDate <= end;
  });

  const processedTransferIds = new Set<string>();
  let calculatedIncome = 0;
  let calculatedExpenses = 0;

  txsInPeriod.forEach(tx => {
    if (!analyticsSelectedAccountIds.includes(tx.accountId)) return;

    const convertedAmount = convertToMain(tx.amount, tx.currency);

    if (tx.transferId) {
      if (processedTransferIds.has(tx.transferId)) return;

      const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
      processedTransferIds.add(tx.transferId);

      if (counterpart) {
        const counterpartSelected = analyticsSelectedAccountIds.includes(counterpart.accountId);
        if (!counterpartSelected) {
          if (excludeTransfersFromAnalytics) return;
          if (tx.type === 'income') calculatedIncome += convertedAmount;
          else calculatedExpenses += Math.abs(convertedAmount);
        }
      } else {
        if (tx.type === 'income') calculatedIncome += convertedAmount;
        else calculatedExpenses += Math.abs(convertedAmount);
      }
    } else {
      if (tx.type === 'income') calculatedIncome += convertedAmount;
      else calculatedExpenses += Math.abs(convertedAmount);
    }
  });

  return {
    filteredTransactions: txsInPeriod.filter(tx =>
      analyticsSelectedAccountIds.includes(tx.accountId)
    ),
    income: safeRound(calculatedIncome, 2),
    expenses: safeRound(calculatedExpenses, 2),
  };
};

export const computePeriodChanges = (params: {
  duration: Duration;
  analyticsTransactions: Transaction[];
  analyticsSelectedAccountIds: string[];
  income: number;
  expenses: number;
  transferLookup: Map<string, Transaction[]>;
  excludeTransfersFromAnalytics?: boolean;
}) => {
  const {
    duration,
    analyticsTransactions,
    analyticsSelectedAccountIds,
    income,
    expenses,
    transferLookup,
    excludeTransfersFromAnalytics,
  } = params;

  const { start, end } = getDateRange(duration, analyticsTransactions);
  const diff = end.getTime() - start.getTime();

  if (duration === 'ALL' || diff <= 0) {
    return { incomeChange: null, expenseChange: null };
  }

  const prevStart = new Date(start.getTime() - diff);
  const prevEnd = new Date(start.getTime() - 1);

  const txsInPrevPeriod = analyticsTransactions.filter(tx => {
    const txDate = parseLocalDate(tx.date);
    return txDate >= prevStart && txDate <= prevEnd;
  });

  let prevIncome = 0;
  let prevExpenses = 0;
  const processedTransferIds = new Set<string>();

  txsInPrevPeriod.forEach(tx => {
    if (!analyticsSelectedAccountIds.includes(tx.accountId)) return;

    const convertedAmount = convertToMain(tx.amount, tx.currency);

    if (tx.transferId) {
      if (processedTransferIds.has(tx.transferId)) return;
      const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
      processedTransferIds.add(tx.transferId);
      if (counterpart && !analyticsSelectedAccountIds.includes(counterpart.accountId)) {
        if (excludeTransfersFromAnalytics) return;
        if (tx.type === 'income') prevIncome += convertedAmount;
        else prevExpenses += Math.abs(convertedAmount);
      }
    } else {
      if (tx.type === 'income') prevIncome += convertedAmount;
      else prevExpenses += Math.abs(convertedAmount);
    }
  });

  const calculateChangeString = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    if (isNaN(change) || !isFinite(change)) return null;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  return {
    incomeChange: calculateChangeString(income, safeRound(prevIncome, 2)),
    expenseChange: calculateChangeString(expenses, safeRound(prevExpenses, 2)),
  };
};

export const computeOutflowsByCategory = (params: {
  enrichedTransactions: EnrichedTransaction[];
  analyticsSelectedAccountIds: string[];
  expenseCategories: Category[];
  transferLookup: Map<string, Transaction[]>;
  excludeTransfersFromAnalytics?: boolean;
  accountLookup: Map<string, Account>;
}): CategorySpending[] => {
  const {
    enrichedTransactions,
    analyticsSelectedAccountIds,
    expenseCategories,
    transferLookup,
    excludeTransfersFromAnalytics,
    accountLookup,
  } = params;

  const spending: { [key: string]: CategorySpending } = {};
  const processedTransferIds = new Set<string>();

  enrichedTransactions.forEach(tx => {
    if (tx.type !== 'expense') return;

    const convertedAmount = tx.convertedAmount;

    if (tx.transferId) {
      if (processedTransferIds.has(tx.transferId)) return;

      const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
      processedTransferIds.add(tx.transferId);

      if (counterpart && !analyticsSelectedAccountIds.includes(counterpart.accountId)) {
        if (excludeTransfersFromAnalytics) return;

        const name = `Transfer to ${accountLookup.get(counterpart.accountId)?.name || 'Unknown'}`;
        if (!spending[name]) {
          spending[name] = { name, value: 0, color: 'var(--muted)', icon: 'arrow_upward' };
        }
        spending[name].value += Math.abs(convertedAmount);
      }
    } else {
      const category = findCategoryDetails(tx.category, expenseCategories);
      let parentCategory = category;
      if (category?.parentId) {
        parentCategory = findCategoryById(category.parentId, expenseCategories) || category;
      }
      const name = parentCategory?.name || 'Uncategorized';
      if (!spending[name]) {
        spending[name] = {
          name,
          value: 0,
          color: parentCategory?.color || 'var(--muted)',
          icon: parentCategory?.icon,
        };
      }
      spending[name].value += Math.abs(convertedAmount);
    }
  });

  return Object.values(spending).sort((a, b) => b.value - a.value);
};

export const filterTransactionsForCategory = (params: {
  categoryName: string;
  filteredTransactions: Transaction[];
  analyticsSelectedAccountIds: string[];
  expenseCategories: Category[];
  transferLookup: Map<string, Transaction[]>;
  accountLookup: Map<string, Account>;
}): Transaction[] => {
  const {
    categoryName,
    filteredTransactions,
    analyticsSelectedAccountIds,
    expenseCategories,
    transferLookup,
    accountLookup,
  } = params;

  return filteredTransactions.filter(tx => {
    if (categoryName.startsWith('Transfer to ')) {
      if (!tx.transferId || tx.type !== 'expense') return false;
      const counterpart = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
      if (!counterpart) return false;
      const destName = `Transfer to ${accountLookup.get(counterpart.accountId)?.name || 'Unknown'}`;
      return (
        destName === categoryName &&
        !analyticsSelectedAccountIds.includes(counterpart.accountId)
      );
    }

    const category = findCategoryDetails(tx.category, expenseCategories);
    let parentCategory = category;
    if (category?.parentId) {
      parentCategory = findCategoryById(category.parentId, expenseCategories) || category;
    }
    return parentCategory?.name === categoryName && tx.type === 'expense' && !tx.transferId;
  });
};

export const buildRecentDashboardTransactions = (params: {
  analyticsTransactions: Transaction[];
  analyticsSelectedAccountIds: string[];
  accountMap: Record<string, string>;
  transferLookup: Map<string, Transaction[]>;
  accounts: Account[];
}): DisplayTransaction[] => {
  const {
    analyticsTransactions,
    analyticsSelectedAccountIds,
    accountMap,
    transferLookup,
    accounts,
  } = params;

  const sortedSourceTransactions = analyticsTransactions
    .filter(
      tx =>
        analyticsSelectedAccountIds.includes(tx.accountId) &&
        !(
          tx.transferId &&
          resolveTransferInfo(
            tx,
            accounts,
            transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id)
          )?.kind === 'spare_change'
        )
    )
    .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

  const processedTransferIds = new Set<string>();
  const result: DisplayTransaction[] = [];

  for (const tx of sortedSourceTransactions) {
    if (result.length >= 10) break;

    if (tx.transferId) {
      if (processedTransferIds.has(tx.transferId)) continue;

      const pair = transferLookup.get(tx.transferId)?.find(t => t.id !== tx.id);
      processedTransferIds.add(tx.transferId);

      if (pair) {
        const expensePart = tx.amount < 0 ? tx : pair;
        const incomePart = tx.amount > 0 ? tx : pair;
        result.push({
          ...expensePart,
          id: `transfer-${expensePart.transferId}`,
          originalId: expensePart.id,
          amount: Math.abs(expensePart.amount),
          isTransfer: true,
          type: 'expense',
          fromAccountName: accountMap[expensePart.accountId] || 'Unknown',
          toAccountName: accountMap[incomePart.accountId] || 'Unknown',
          category: 'Transfer',
        });
      } else {
        result.push({ ...tx, accountName: accountMap[tx.accountId] });
      }
    } else {
      result.push({ ...tx, accountName: accountMap[tx.accountId] });
    }
  }
  return result;
};

export const computeDashboardSparklines = (
  enrichedTransactions: EnrichedTransaction[],
  duration: Duration,
  transactions: Transaction[]
) => {
  const NUM_POINTS = 90;
  const { start, end } = getDateRange(duration, transactions);
  const timeRange = end.getTime() - start.getTime();
  const interval = timeRange / NUM_POINTS;

  const incomeBuckets = Array(NUM_POINTS).fill(0);
  const expenseBuckets = Array(NUM_POINTS).fill(0);

  const relevantTxs = enrichedTransactions.filter(tx => !tx.transferId);

  for (const tx of relevantTxs) {
    const txTime = tx.parsedDate.getTime();
    const index = Math.floor((txTime - start.getTime()) / interval);
    const convertedAmount = tx.convertedAmount;
    if (index >= 0 && index < NUM_POINTS) {
      if (tx.type === 'income') {
        incomeBuckets[index] += convertedAmount;
      } else {
        expenseBuckets[index] += Math.abs(convertedAmount);
      }
    }
  }

  return {
    incomeSparkline: incomeBuckets.map(value => ({ value })),
    expenseSparkline: expenseBuckets.map(value => ({ value })),
  };
};

export const computePeriodFlowBuckets = (params: {
  enrichedTransactions: EnrichedTransaction[];
  duration: Duration;
  transactions: Transaction[];
  eurToDisplay: (eur: number) => number;
}): FlowBucket[] => {
  const { enrichedTransactions, duration, transactions, eurToDisplay } = params;
  const { start, end } = getDateRange(duration, transactions);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const unit: 'day' | 'week' | 'month' = days <= 14 ? 'day' : days <= 100 ? 'week' : 'month';
  const keyOf = (date: Date) => {
    if (unit === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
    if (unit === 'week') {
      const offset = Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset * 7);
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };
  const labelOf = (date: Date) =>
    unit === 'month'
      ? date.toLocaleDateString('en-GB', { month: 'short' })
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const buckets = new Map<number, FlowBucket>();
  const ensure = (date: Date) => {
    const key = keyOf(date);
    if (!buckets.has(key.getTime())) {
      buckets.set(key.getTime(), { name: labelOf(key), 'Money in': 0, 'Money out': 0 });
    }
    return buckets.get(key.getTime())!;
  };

  for (
    let cursor = keyOf(start);
    cursor <= end;
    cursor =
      unit === 'month'
        ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
        : new Date(
            cursor.getFullYear(),
            cursor.getMonth(),
            cursor.getDate() + (unit === 'week' ? 7 : 1)
          )
  ) {
    ensure(cursor);
  }
  for (const tx of enrichedTransactions) {
    if (tx.transferId) continue;
    const bucket = ensure(tx.parsedDate);
    const amount = eurToDisplay(tx.convertedAmount);
    if (tx.type === 'income') bucket['Money in'] += amount;
    else bucket['Money out'] += Math.abs(amount);
  }
  const ordered = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, bucket]) => ({
      ...bucket,
      'Money in': safeRound(bucket['Money in'], 2),
      'Money out': safeRound(bucket['Money out'], 2),
    }));
  const used = (bucket: FlowBucket) => bucket['Money in'] > 0 || bucket['Money out'] > 0;
  const first = ordered.findIndex(used);
  const last = ordered.length - 1 - [...ordered].reverse().findIndex(used);
  return (duration === 'ALL' && first >= 0 ? ordered.slice(first, last + 1) : ordered).slice(-24);
};

export const computeGlobalAssetAndLiabilityGroups = (
  analyticsAccounts: Account[],
  analyticsTransactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides
) => {
  const openAccounts = analyticsAccounts.filter(acc => acc.status !== 'closed');
  const { totalAssets, totalDebt } = calculateAccountTotals(
    openAccounts,
    analyticsTransactions,
    loanPaymentOverrides
  );

  const createBreakdown = (accs: Account[]) => {
    const grouped = accs.reduce(
      (acc, account) => {
        const nativeBalance = resolveAccountBalance(
          account,
          analyticsTransactions.filter(tx => tx.accountId === account.id),
          loanPaymentOverrides
        );
        acc[account.type] = (acc[account.type] || 0) + convertToMain(nativeBalance, account.currency);
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.abs(value) }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        ...item,
        color: index < 4 ? `var(--chart-${index + 1})` : 'var(--muted)',
      }));
  };

  const assetGroups: Record<string, AssetGroup> = {
    'Liquid Cash': { types: ['Checking', 'Savings'], value: 0, color: 'var(--chart-1)', icon: 'wallet' },
    Investments: { types: ['Investment'], value: 0, color: 'var(--chart-2)', icon: 'candlestick_chart' },
    Properties: { types: ['Property'], value: 0, color: 'var(--chart-3)', icon: 'home' },
    Vehicles: { types: ['Vehicle'], value: 0, color: 'var(--chart-4)', icon: 'directions_car' },
    'Other Assets': { types: ['Other Assets', 'Lending'], value: 0, color: 'var(--chart-5)', icon: 'Box' },
  };

  const liabilityGroups: Record<string, AssetGroup> = {
    Loans: { types: ['Loan'], value: 0, color: 'var(--chart-1)', icon: 'receipt_check' },
    'Credit Cards': { types: ['Credit Card'], value: 0, color: 'var(--chart-2)', icon: 'credit_card' },
    'Other Liabilities': { types: ['Other Liabilities'], value: 0, color: 'var(--chart-3)', icon: 'receipt' },
  };

  const calculateGroupTotal = (types: AccountType[]) => {
    const groupAccounts = openAccounts.filter(acc => types.includes(acc.type));
    const { totalAssets: groupAssets, totalDebt: groupDebt } = calculateAccountTotals(
      groupAccounts,
      analyticsTransactions,
      loanPaymentOverrides
    );
    return safeRound(groupAssets + groupDebt, 2);
  };

  for (const groupName in assetGroups) {
    assetGroups[groupName].value = calculateGroupTotal(assetGroups[groupName].types);
  }
  for (const groupName in liabilityGroups) {
    const groupAccounts = openAccounts.filter(acc =>
      liabilityGroups[groupName].types.includes(acc.type)
    );
    const { totalDebt: groupDebt } = calculateAccountTotals(
      groupAccounts,
      analyticsTransactions,
      loanPaymentOverrides
    );
    liabilityGroups[groupName].value = safeRound(groupDebt, 2);
  }

  return {
    globalTotalAssets: totalAssets,
    globalTotalDebt: totalDebt,
    globalAssetBreakdown: createBreakdown(
      openAccounts.filter(acc => ASSET_TYPES.includes(acc.type))
    ),
    globalDebtBreakdown: createBreakdown(
      openAccounts.filter(acc => DEBT_TYPES.includes(acc.type))
    ),
    assetGroups,
    liabilityGroups,
  };
};

export const computeNetWorthSeries = (params: {
  duration: Duration;
  transactions: Transaction[];
  analyticsTransactions: Transaction[];
  analyticsSelectedAccountIds: string[];
  netWorth: number;
  forecastChartData: { date: string; value: number }[];
  showForecast: boolean;
}) => {
  const {
    duration,
    transactions,
    analyticsTransactions,
    analyticsSelectedAccountIds,
    netWorth,
    forecastChartData,
    showForecast,
  } = params;

  const transferGroups = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    if (!tx.transferId) return;
    const group = transferGroups.get(tx.transferId) || [];
    group.push(tx);
    transferGroups.set(tx.transferId, group);
  });

  const internalTransferIds = new Set<string>();
  transferGroups.forEach((group, transferId) => {
    if (group.length === 0) return;
    const allAccountsSelected = group.every(tx =>
      analyticsSelectedAccountIds.includes(tx.accountId)
    );
    if (allAccountsSelected) {
      internalTransferIds.add(transferId);
    }
  });

  const { start, end } = getDateRange(duration, transactions);

  if (duration === 'ALL') {
    const fiveYearsAgo = new Date(end);
    fiveYearsAgo.setFullYear(end.getFullYear() - 5);
    if (start < fiveYearsAgo) {
      start.setTime(fiveYearsAgo.getTime());
    }
  }

  const currentNetWorth = netWorth;
  const today = parseLocalDate(toLocalISOString(new Date()));

  const signedTxAmount = (tx: Transaction) =>
    tx.type === 'expense'
      ? -Math.abs(convertToMain(tx.amount, tx.currency))
      : Math.abs(convertToMain(tx.amount, tx.currency));

  const futureTransactionsDelta = analyticsTransactions
    .filter(tx => {
      if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
      if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
      const txDate = parseLocalDate(tx.date);
      return txDate > today;
    })
    .reduce((sum, tx) => sum + signedTxAmount(tx), 0);

  const todayNetWorth = currentNetWorth - futureTransactionsDelta;

  const transactionsToReverse = analyticsTransactions.filter(tx => {
    if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
    if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
    const txDate = parseLocalDate(tx.date);
    return txDate >= start && txDate <= today;
  });

  const totalChangeSinceStart = transactionsToReverse.reduce(
    (sum, tx) => sum + signedTxAmount(tx),
    0
  );
  const startingNetWorth = todayNetWorth - totalChangeSinceStart;

  const transactionsInPeriod = analyticsTransactions.filter(tx => {
    if (!analyticsSelectedAccountIds.includes(tx.accountId)) return false;
    if (tx.transferId && internalTransferIds.has(tx.transferId)) return false;
    const txDate = parseLocalDate(tx.date);
    return txDate >= start && txDate <= end;
  });

  const dailyChanges = new Map<string, number>();
  for (const tx of transactionsInPeriod) {
    const dateStr = formatDateKey(parseLocalDate(tx.date));
    dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + signedTxAmount(tx));
  }

  const data: { name: string; value?: number; forecast?: number }[] = [];
  let runningBalance = startingNetWorth;
  const currentDate = new Date(start);

  while (currentDate <= end) {
    const dateStr = formatDateKey(currentDate);
    runningBalance += dailyChanges.get(dateStr) || 0;
    data.push({ name: dateStr, value: parseFloat(runningBalance.toFixed(2)) });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const todayStr = formatDateKey(today);
  const todayDataPoint = data.find(d => d.name === todayStr);
  if (todayDataPoint) {
    todayDataPoint.value = parseFloat(currentNetWorth.toFixed(2));
  }

  if (showForecast && forecastChartData && forecastChartData.length > 0) {
    const currentForecastBase = forecastChartData[0].value;
    const currentNetWorthVal = currentNetWorth;
    const todayIndex = data.findIndex(d => d.name === todayStr);

    if (todayIndex !== -1) {
      data[todayIndex].forecast = data[todayIndex].value;
      forecastChartData.forEach(point => {
        if (point.date > todayStr) {
          const predictedChange = point.value - currentForecastBase;
          const projectedNetWorth = currentNetWorthVal + predictedChange;
          data.push({
            name: point.date,
            value: undefined,
            forecast: parseFloat(projectedNetWorth.toFixed(2)),
          });
        }
      });
    }
  }

  return data;
};

export const computeCreditCardStatements = (
  configuredCreditCards: Account[],
  transactions: Transaction[]
) => {
  if (configuredCreditCards.length === 0) return [];

  return configuredCreditCards.map(account => {
    const periods = calculateStatementPeriods(account.statementStartDate!, account.paymentDate!);

    const { statementBalance: prevBalance, amountPaid: prevAmountPaid } =
      getCreditCardStatementDetails(
        account,
        periods.previous.start,
        periods.previous.end,
        transactions
      );
    const { statementBalance: currentBalance, amountPaid: currentAmountPaid } =
      getCreditCardStatementDetails(
        account,
        periods.current.start,
        periods.current.end,
        transactions
      );
    const { statementBalance: futureBalance, amountPaid: futureAmountPaid } =
      getCreditCardStatementDetails(
        account,
        periods.future.start,
        periods.future.end,
        transactions
      );

    const timeZone = getPreferredTimeZone();
    const formatDate = (date: Date) =>
      date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
    const formatFullDate = (date: Date) =>
      date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      });

    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      accountBalance: account.balance,
      creditLimit: account.creditLimit,
      cardNetwork: account.cardNetwork,
      financialInstitution: account.financialInstitution,
      previous: {
        balance: prevBalance,
        amountPaid: prevAmountPaid,
        period: `${formatDate(periods.previous.start)} - ${formatDate(periods.previous.end)}`,
        paymentDue: formatFullDate(periods.previous.paymentDue),
      },
      current: {
        balance: currentBalance,
        amountPaid: currentAmountPaid,
        previousStatementBalance: prevBalance,
        period: `${formatDate(periods.current.start)} - ${formatDate(periods.current.end)}`,
        paymentDue: formatFullDate(periods.current.paymentDue),
      },
      future: {
        balance: futureBalance,
        amountPaid: futureAmountPaid,
        period: `${formatDate(periods.future.start)} - ${formatDate(periods.future.end)}`,
        paymentDue: formatFullDate(periods.future.paymentDue),
      },
    };
  });
};

export const computeLiquidityAndSavingsRate = (
  analyticsAccounts: Account[],
  analyticsTransactions: Transaction[],
  duration: Duration
) => {
  const openAccounts = analyticsAccounts.filter(acc => acc.status !== 'closed');
  const liquidCash = openAccounts
    .filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type))
    .reduce((sum, acc) => sum + convertToMain(acc.balance, acc.currency), 0);

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const expenseTxs = analyticsTransactions.filter(t => {
    const d = parseLocalDate(t.date);
    return d >= threeMonthsAgo && t.type === 'expense' && !t.transferId;
  });
  const totalSpend = expenseTxs.reduce(
    (sum, tx) => sum + Math.abs(convertToMain(tx.amount, tx.currency)),
    0
  );
  const avgMonthlySpend = totalSpend / 3;
  const liquidityRatio = avgMonthlySpend > 0 ? liquidCash / avgMonthlySpend : 0;

  let totalIncomePeriod = 0;
  let totalExpensePeriod = 0;
  const { start, end } = getDateRange(duration, analyticsTransactions);
  const periodTxs = analyticsTransactions.filter(t => {
    const d = parseLocalDate(t.date);
    return d >= start && d <= end && !t.transferId;
  });
  periodTxs.forEach(tx => {
    const val = convertToMain(tx.amount, tx.currency);
    if (tx.type === 'income') totalIncomePeriod += val;
    else totalExpensePeriod += Math.abs(val);
  });
  const netFlowPeriod = totalIncomePeriod - totalExpensePeriod;
  const savingsRate = totalIncomePeriod > 0 ? (netFlowPeriod / totalIncomePeriod) * 100 : 0;

  return { liquidityRatio, savingsRate };
};

export const buildAssetAllocationData = (
  assetGroups: Record<string, AssetGroup>
): { name: string; value: number; color: string }[] => {
  const data = [
    { name: 'Liquid Cash', value: assetGroups?.['Liquid Cash']?.value || 0, color: assetGroups?.['Liquid Cash']?.color || 'var(--muted)' },
    { name: 'Investments', value: assetGroups?.['Investments']?.value || 0, color: assetGroups?.['Investments']?.color || 'var(--muted)' },
    { name: 'Properties', value: assetGroups?.['Properties']?.value || 0, color: assetGroups?.['Properties']?.color || 'var(--muted)' },
    { name: 'Vehicles', value: assetGroups?.['Vehicles']?.value || 0, color: assetGroups?.['Vehicles']?.color || 'var(--muted)' },
    { name: 'Other Assets', value: assetGroups?.['Other Assets']?.value || 0, color: assetGroups?.['Other Assets']?.color || 'var(--muted)' },
  ];
  return data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
};

export const computeKeyRatioGauges = (
  analyticsAccounts: Account[],
  analyticsTransactions: Transaction[],
  liquidityRatio: number,
  savingsRate: number
) => {
  const { totalAssets: assets, totalDebt: debt } = calculateAccountTotals(
    analyticsAccounts,
    analyticsTransactions
  );
  const debtRatio = assets > 0 ? (Math.abs(debt) / assets) * 100 : 0;
  const runway =
    liquidityRatio < 3
      ? { tone: 'loss' as const, status: 'Low' }
      : liquidityRatio < 6
        ? { tone: 'amber' as const, status: 'Building' }
        : { tone: 'pine' as const, status: 'Healthy' };
  const saving =
    savingsRate < 0
      ? { tone: 'loss' as const, status: 'Overspending' }
      : savingsRate < 10
        ? { tone: 'amber' as const, status: 'Thin' }
        : { tone: 'pine' as const, status: 'On track' };
  const owing =
    debtRatio > 60
      ? { tone: 'loss' as const, status: 'High' }
      : debtRatio > 35
        ? { tone: 'amber' as const, status: 'Watch' }
        : { tone: 'pine' as const, status: 'Low' };
  return { debtRatio, runway, saving, owing };
};

