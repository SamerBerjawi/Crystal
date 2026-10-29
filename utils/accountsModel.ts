import { ASSET_TYPES, DEBT_TYPES, LIQUID_ACCOUNT_TYPES } from '../constants';
import { Account, Currency, LoanPaymentOverrides, Transaction } from '../types';
import {
  arrayToCSV,
  calculateAccountTotals,
  calculateStatementPeriods,
  classifyAccountBalanceEur,
  debtFromBalance,
  convertCurrency,
  convertToEur,
  generateAmortizationSchedule,
  parseLocalDate,
  resolveAccountBalance,
  safeAdd,
  safeRound,
  safeSubtract,
  toLocalISOString,
} from '../utils';
import { computeVehicleAccountMetrics } from './accountDetailModel';
import { formatShortDate } from './dateFormat';

export interface AccountsModelOptions {
  conversionRates?: Partial<Record<Currency, number>>;
  referenceDate?: Date;
  loanPaymentOverrides?: LoanPaymentOverrides;
  /** Bank consent per linked account id, for the "consent expires soon" attention rule. */
  bankConsentExpiry?: Map<string, string | undefined>;
}

/** Accounts counted as liquid cash: checking, savings, cards (signed) and physical cash. */
export const isLiquidAccount = (a: Account): boolean =>
  LIQUID_ACCOUNT_TYPES.includes(a.type) || (a.type === 'Other Assets' && a.otherSubType === 'Cash');

/**
 * Returns accounts that belong on the Accounts hub page.
 * Fixes BUG-01: Keeps `Pension Fund` and `Spare Change` sub-types visible on Accounts
 * while hiding security/market `Investment` holdings (`Stock`, `ETF`, `Crypto`) that belong on Investments.
 */
export const getVisibleAccountsForAccountsPage = (accounts: Account[]): Account[] => {
  return accounts.filter((acc) => {
    if (acc.type === 'Investment') {
      return acc.subType === 'Pension Fund' || acc.subType === 'Spare Change';
    }
    return true;
  });
};

/**
 * Today's balance of an account, signed, in its own currency. One rule for every figure
 * on the Accounts pages (see `resolveAccountBalance`): future-dated items excluded,
 * amortised loans as principal + accrued interest.
 */
export const computeAccountDisplayBalance = (
  account: Account,
  accountTransactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {},
  options: AccountsModelOptions = {}
): number =>
  resolveAccountBalance(account, accountTransactions, loanPaymentOverrides, {
    rates: options.conversionRates as Record<string, number> | undefined,
    referenceDate: options.referenceDate,
  });

/**
 * The balance-adjustment amount that brings an account to `targetBalance` on `dateStr`
 * (default today), measured against the balance on that day, not against `account.balance`
 * (which includes future-dated items). Returns null for amortised loans, whose balance
 * comes from the schedule: correct those with payment overrides instead.
 */
export const computeBalanceAdjustmentDelta = (
  account: Account,
  accountTransactions: Transaction[],
  targetBalance: number,
  dateStr?: string,
  rates?: Record<string, number>
): number | null => {
  const isScheduledLoan =
    (account.type === 'Loan' || account.type === 'Lending') &&
    !!(account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined);
  if (isScheduledLoan) return null;
  const asOf = dateStr ? parseLocalDate(dateStr) : new Date();
  const balanceOnDate = resolveAccountBalance(account, accountTransactions, {}, { rates, referenceDate: asOf });
  return safeRound(safeSubtract(targetBalance, balanceOnDate), account.currency === 'BTC' ? 8 : 2);
};

export interface AccountSparklineResult {
  /** Daily balance in the account's own currency, oldest first. */
  sparklineData: { date: Date; value: number }[];
  /** Change over the window, in the account's own currency. */
  trend: number;
  trendPct: number | null;
  isPositiveTrend: boolean;
}

export interface AccountsKpiSparkPoint {
  day: string;
  date: string;
  value: number;
}

const NUM_SPARK_POINTS = 90;

const summarizeSparkline = (points: { date: Date; value: number }[]): AccountSparklineResult => {
  if (points.length === 0) {
    return { sparklineData: [], trend: 0, trendPct: null, isPositiveTrend: true };
  }
  const startVal = points[0].value;
  const endVal = points[points.length - 1].value;
  const trend = safeSubtract(endVal, startVal);
  const startAbs = Math.abs(startVal);
  // A higher signed balance is more asset or less debt, so up is always good.
  return {
    sparklineData: points,
    trend,
    trendPct: startAbs >= 1 ? safeRound((trend / startAbs) * 100, 1) : null,
    isPositiveTrend: trend >= 0,
  };
};

/**
 * The 90-day daily balance of one account, in the account's own currency.
 *  - Amortised loans: the schedule's balance on each day (principal + accrued interest).
 *  - Property / Vehicle: today's balance, the last valuation before that, nothing before purchase.
 *  - Everything else: walk back from today's balance through dated transactions.
 * `displayBalance` is today's balance when the caller already has it.
 */
export const computeAccount90dSparkline = (
  account: Account,
  accountTransactions: Transaction[],
  displayBalance?: number,
  options: AccountsModelOptions = {}
): AccountSparklineResult => {
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = toLocalISOString(endDate);
  const overrides = options.loanPaymentOverrides || {};
  const rates = options.conversionRates as Record<string, number> | undefined;
  const ownTxs = accountTransactions.filter((tx) => tx.accountId === account.id);

  const todayBalance =
    displayBalance !== undefined
      ? displayBalance
      : computeAccountDisplayBalance(account, ownTxs, overrides, { ...options, referenceDate: endDate });

  const dayAt = (offsetFromStart: number) => {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - (NUM_SPARK_POINTS - 1 - offsetFromStart));
    return d;
  };

  const isScheduledLoan =
    (account.type === 'Loan' || account.type === 'Lending') &&
    !!(account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined);
  if (isScheduledLoan) {
    const points: { date: Date; value: number }[] = [];
    for (let i = 0; i < NUM_SPARK_POINTS; i++) {
      const d = dayAt(i);
      if (toLocalISOString(d) < account.loanStartDate!) continue;
      const value =
        i === NUM_SPARK_POINTS - 1
          ? todayBalance
          : resolveAccountBalance(account, ownTxs, overrides, { rates, referenceDate: d });
      points.push({ date: d, value });
    }
    return summarizeSparkline(points);
  }

  if (account.type === 'Property' || account.type === 'Vehicle') {
    const records = [...(account.priceHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
    const startStr = account.purchaseDate || account.leaseStartDate || account.openingDate;
    const points: { date: Date; value: number }[] = [];
    for (let i = 0; i < NUM_SPARK_POINTS; i++) {
      const d = dayAt(i);
      const dStr = toLocalISOString(d);
      if (startStr && dStr < startStr) continue;
      let value = todayBalance;
      if (dStr < todayStr) {
        const applicable = records.filter((r) => r.date <= dStr);
        if (applicable.length > 0) value = applicable[applicable.length - 1].price;
        else if (account.purchasePrice !== undefined) value = account.purchasePrice;
      }
      points.push({ date: d, value });
    }
    return summarizeSparkline(points);
  }

  const changeByDate: Record<string, number> = {};
  for (const tx of ownTxs) {
    if (tx.date > todayStr) continue; // already excluded from today's balance
    const native = convertCurrency(tx.amount, tx.currency || account.currency, account.currency, rates);
    changeByDate[tx.date] = safeAdd(changeByDate[tx.date] || 0, native);
  }

  const history: { date: Date; value: number }[] = [];
  let running = todayBalance;
  for (let i = NUM_SPARK_POINTS - 1; i >= 0; i--) {
    const d = dayAt(i);
    const dStr = toLocalISOString(d);
    if (account.openingDate && dStr < account.openingDate) break;
    history.push({ date: d, value: safeRound(running, 2) });
    running = safeSubtract(running, changeByDate[dStr] || 0);
  }
  return summarizeSparkline(history.reverse());
};

/**
 * The 90-day daily trends of net worth, assets, liabilities and liquid cash, in EUR.
 * Built from the same per-account balances and the same signed classification as
 * `calculateAccountTotals`, so the last point of each series equals the headline figure
 * and assets − liabilities = net worth on every day.
 */
export const computePortfolio90dTrends = (
  openAccounts: Account[],
  analyticsTransactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {},
  options: AccountsModelOptions = {}
): {
  netWorth: { date: string; value: number }[];
  assets: AccountsKpiSparkPoint[];
  liabilities: AccountsKpiSparkPoint[];
  liquidCash: AccountsKpiSparkPoint[];
} => {
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rates = options.conversionRates as Record<string, number> | undefined;

  const includedAccounts = openAccounts.filter((acc) => acc.includeInAnalytics ?? true);
  const txsByAccount: Record<string, Transaction[]> = {};
  analyticsTransactions.forEach((tx) => {
    (txsByAccount[tx.accountId] = txsByAccount[tx.accountId] || []).push(tx);
  });

  const dateKeys: string[] = [];
  for (let idx = 0; idx < NUM_SPARK_POINTS; idx++) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - (NUM_SPARK_POINTS - 1 - idx));
    dateKeys.push(toLocalISOString(d));
  }
  const indexByDate = new Map(dateKeys.map((k, i) => [k, i]));

  const dailyAssets = new Array<number>(NUM_SPARK_POINTS).fill(0);
  const dailyLiabilities = new Array<number>(NUM_SPARK_POINTS).fill(0);
  const dailyLiquid = new Array<number>(NUM_SPARK_POINTS).fill(0);

  includedAccounts.forEach((acc) => {
    const accTxs = txsByAccount[acc.id] || [];
    const { sparklineData } = computeAccount90dSparkline(acc, accTxs, undefined, {
      ...options,
      loanPaymentOverrides,
      referenceDate: endDate,
    });
    const isLiquid = isLiquidAccount(acc);

    sparklineData.forEach((pt) => {
      const idx = indexByDate.get(toLocalISOString(pt.date));
      if (idx === undefined) return;
      const { asset, debt } = classifyAccountBalanceEur(acc, pt.value, rates);
      dailyAssets[idx] = safeAdd(dailyAssets[idx], asset);
      dailyLiabilities[idx] = safeAdd(dailyLiabilities[idx], debt);
      if (isLiquid) {
        dailyLiquid[idx] = safeAdd(dailyLiquid[idx], convertToEur(pt.value, acc.currency, rates));
      }
    });
  });

  const netWorth: { date: string; value: number }[] = [];
  const assets: AccountsKpiSparkPoint[] = [];
  const liabilities: AccountsKpiSparkPoint[] = [];
  const liquidCash: AccountsKpiSparkPoint[] = [];

  dateKeys.forEach((dateStr, idx) => {
    const dayStr = parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    netWorth.push({ date: dateStr, value: safeSubtract(dailyAssets[idx], dailyLiabilities[idx]) });
    assets.push({ date: dateStr, day: dayStr, value: dailyAssets[idx] });
    liabilities.push({ date: dateStr, day: dayStr, value: dailyLiabilities[idx] });
    liquidCash.push({ date: dateStr, day: dayStr, value: dailyLiquid[idx] });
  });

  return { netWorth, assets, liabilities, liquidCash };
};

/**
 * Reconstructs the 90-day daily net worth trend across all open analytics-enabled accounts.
 */
export const computePortfolio90dNetWorthTrend = (
  openAccounts: Account[],
  analyticsTransactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {},
  options: AccountsModelOptions = {}
): { date: string; value: number }[] => {
  return computePortfolio90dTrends(
    openAccounts,
    analyticsTransactions,
    loanPaymentOverrides,
    options
  ).netWorth;
};

/**
 * Computes net cash flow (excluding internal transfers and future-dated transactions)
 * for liquid cash accounts over the exact requested window (default 30 days).
 * Fixes BUG-05: Previously `Accounts.tsx` subtracted 90 days while labeling the metric '30d Net Flow'.
 */
export const computeCashSegmentNetFlow = (
  cashAccounts: Account[],
  allTransactions: Transaction[],
  days = 30,
  options: AccountsModelOptions = {}
): number => {
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  // `days` days including today: today − (days − 1) … today.
  const cutoffStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoffStart.setDate(cutoffStart.getDate() - (days - 1));

  const cashIds = new Set(cashAccounts.map((a) => a.id));
  return allTransactions
    .filter((t) => {
      // Same exclusions as the expense burn next to it: transfers and balance adjustments.
      if (!cashIds.has(t.accountId) || t.transferId || t.isBalanceAdjustment) return false;
      const txDate = parseLocalDate(t.date);
      return txDate >= cutoffStart && txDate <= todayEnd;
    })
    .reduce((sum, t) => {
      const eurAmount = options.conversionRates
        ? convertCurrency(t.amount, t.currency, 'EUR', options.conversionRates)
        : convertToEur(t.amount, t.currency);
      return safeAdd(sum, eurAmount);
    }, 0);
};

export type AccountsPageSegment =
  | 'all'
  | 'cash_cards'
  | 'savings_yield'
  | 'loans_debt'
  | 'property_vehicles'
  | 'archived';

export type AccountSegmentId =
  | AccountsPageSegment
  | 'cash'
  | 'savings_pension'
  | 'property_assets'
  | 'credit_cards'
  | 'closed';

/**
 * Filters visible accounts into the primary segments of the `/accounts-new` workspace.
 */
export const filterAccountsBySegment = (
  visibleAccounts: Account[],
  segment: AccountSegmentId
): Account[] => {
  if (segment === 'closed' || segment === 'archived') {
    return visibleAccounts.filter((a) => a.status === 'closed');
  }
  const open = visibleAccounts.filter((a) => a.status !== 'closed');
  switch (segment) {
    case 'cash':
      return open.filter(
        (a) =>
          a.type === 'Checking' ||
          (a.type === 'Other Assets' && a.otherSubType === 'Cash')
      );
    case 'cash_cards':
      return open.filter(
        (a) =>
          a.type === 'Checking' ||
          a.type === 'Credit Card' ||
          (a.type === 'Other Assets' && a.otherSubType === 'Cash')
      );
    case 'savings_pension':
    case 'savings_yield':
      return open.filter(
        (a) =>
          a.type === 'Savings' ||
          (a.type === 'Investment' &&
            (a.subType === 'Pension Fund' || a.subType === 'Spare Change'))
      );
    case 'property_assets':
    case 'property_vehicles':
      return open.filter(
        (a) =>
          a.type === 'Property' ||
          a.type === 'Vehicle' ||
          a.type === 'Lending' ||
          (a.type === 'Other Assets' && a.otherSubType !== 'Cash')
      );
    case 'credit_cards':
      return open.filter((a) => a.type === 'Credit Card');
    case 'loans_debt':
      return open.filter((a) => a.type === 'Loan' || a.type === 'Other Liabilities');
    case 'all':
    default:
      return open;
  }
};

export interface AccountsAllocationItem {
  id: string;
  label: string;
  value: number;
  pct: number;
  kind: 'asset' | 'liability';
  count: number;
}

export interface AccountAttentionItem {
  id: string;
  accountId: string;
  accountName: string;
  severity: 'danger' | 'warn' | 'info';
  title: string;
  subtitle: string;
  metricLabel: string;
}

export interface AccountsHeroModel {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  netWorth90dDelta: number;
  netWorth90dPct: number;
  solvencyRatioPct: number;
  liquidCash: number;
  liquidRunwayMonths: number | null;
  netFlow30d: number;
  trend90d: { date: string; value: number }[];
  assetsTrend: AccountsKpiSparkPoint[];
  liabilitiesTrend: AccountsKpiSparkPoint[];
  liquidCashTrend: AccountsKpiSparkPoint[];
  allocationItems: AccountsAllocationItem[];
  attentionItems: AccountAttentionItem[];
}

/**
 * Computes the complete Balance-Sheet Hero model for `/accounts-new`:
 *  - Net Worth, Total Assets, Total Liabilities, and Solvency Ratio % in `preferredCurrency`
 *  - 90-day Net Worth trajectory and delta
 *  - Liquid Cash, 30d Net Flow, and Liquid Runway (months of expenses covered)
 *  - 5-bucket Allocation breakdown for the `Allocation` chart mode
 *  - Ranked Attention items (high CC utilization, upcoming/overdue loans, lease pace alerts, idle cash)
 */
export const computeAccountsHeroModel = (
  accounts: Account[],
  transactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {},
  preferredCurrency: Currency = 'EUR',
  options: AccountsModelOptions = {}
): AccountsHeroModel => {
  const visible = getVisibleAccountsForAccountsPage(accounts);
  const open = visible.filter((a) => a.status !== 'closed');
  const analyticsOpen = open.filter((a) => a.includeInAnalytics ?? true);
  const analyticsIds = new Set(analyticsOpen.map((a) => a.id));
  const analyticsTxs = transactions.filter((t) => analyticsIds.has(t.accountId));

  const rates = options.conversionRates as Record<string, number> | undefined;
  const balanceOptions = { rates, referenceDate: options.referenceDate };

  const { totalAssets: assetsEur, totalDebt: debtEur, netWorth: netWorthEur } =
    calculateAccountTotals(analyticsOpen, analyticsTxs, loanPaymentOverrides, balanceOptions);

  // Today's signed native balance per account: the single source for every figure below.
  const txsByAccount = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = txsByAccount.get(t.accountId);
    if (list) list.push(t);
    else txsByAccount.set(t.accountId, [t]);
  }
  const todayBalance = new Map<string, number>();
  for (const a of open) {
    todayBalance.set(
      a.id,
      resolveAccountBalance(a, txsByAccount.get(a.id) || [], loanPaymentOverrides, balanceOptions)
    );
  }
  const balanceEur = (a: Account) => convertToEur(todayBalance.get(a.id) ?? 0, a.currency, rates);

  const toPref = (eurVal: number) =>
    safeRound(convertCurrency(eurVal, 'EUR', preferredCurrency, rates), 2);

  const totalAssets = toPref(assetsEur);
  const totalLiabilities = toPref(debtEur);
  const netWorth = toPref(netWorthEur);

  const grossFootprint = totalAssets + totalLiabilities;
  const solvencyRatioPct =
    grossFootprint > 0
      ? safeRound((totalAssets / grossFootprint) * 100, 1)
      : 100;

  // Liquid cash & 30d net flow / burn runway
  const liquidAccounts = analyticsOpen.filter(isLiquidAccount);
  const liquidCashEur = liquidAccounts.reduce((sum, a) => safeAdd(sum, balanceEur(a)), 0);
  const liquidCash = toPref(liquidCashEur);

  const netFlow30dEur = computeCashSegmentNetFlow(liquidAccounts, analyticsTxs, 30, options);
  const netFlow30d = toPref(netFlow30dEur);

  // Compute 30d non-transfer expense burn across liquid accounts
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const cutoff30d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff30d.setDate(cutoff30d.getDate() - 29);
  const liquidIds = new Set(liquidAccounts.map((a) => a.id));
  const monthlyExpenseBurnEur = analyticsTxs
    .filter((t) => {
      if (!liquidIds.has(t.accountId) || t.transferId || t.isBalanceAdjustment) return false;
      const d = parseLocalDate(t.date);
      return t.amount < 0 && d >= cutoff30d && d <= todayEnd;
    })
    .reduce(
      (sum, t) => safeAdd(sum, Math.abs(convertCurrency(t.amount, t.currency, 'EUR', rates))),
      0
    );
  const liquidRunwayMonths =
    monthlyExpenseBurnEur > 0 && liquidCashEur > 0
      ? safeRound(liquidCashEur / monthlyExpenseBurnEur, 1)
      : null;

  // 90d Trends across Net Worth, Assets, Liabilities, and Liquid Cash
  const portfolioTrends = computePortfolio90dTrends(
    analyticsOpen,
    analyticsTxs,
    loanPaymentOverrides,
    options
  );

  const trend90d = portfolioTrends.netWorth.map((pt) => ({
    date: pt.date,
    value: toPref(pt.value),
  }));

  const assetsTrend: AccountsKpiSparkPoint[] = portfolioTrends.assets.map((pt) => ({
    date: pt.date,
    day: pt.day,
    value: toPref(pt.value),
  }));

  const liabilitiesTrend: AccountsKpiSparkPoint[] = portfolioTrends.liabilities.map((pt) => ({
    date: pt.date,
    day: pt.day,
    value: toPref(pt.value),
  }));

  const liquidCashTrend: AccountsKpiSparkPoint[] = portfolioTrends.liquidCash.map((pt) => ({
    date: pt.date,
    day: pt.day,
    value: toPref(pt.value),
  }));

  const start90d = trend90d[0]?.value ?? netWorth;
  const end90d = trend90d[trend90d.length - 1]?.value ?? netWorth;
  const netWorth90dDelta = safeRound(end90d - start90d, 2);
  const netWorth90dPct =
    Math.abs(start90d) > 0.01
      ? safeRound((netWorth90dDelta / Math.abs(start90d)) * 100, 1)
      : 0;

  // 5-Bucket Allocation Breakdown (signed, same classification as the totals)
  const sumBucketEur = (accs: Account[], isLiability = false) =>
    accs.reduce((s, a) => {
      const { asset, debt } = classifyAccountBalanceEur(a, todayBalance.get(a.id) ?? 0, rates);
      return safeAdd(s, isLiability ? debt : asset);
    }, 0);

  const bucketCashAccounts = analyticsOpen.filter(
    (a) => a.type === 'Checking' || (a.type === 'Other Assets' && a.otherSubType === 'Cash')
  );
  const bucketSavingsAccounts = analyticsOpen.filter(
    (a) =>
      a.type === 'Savings' ||
      (a.type === 'Investment' && (a.subType === 'Pension Fund' || a.subType === 'Spare Change'))
  );
  const bucketPhysicalAccounts = analyticsOpen.filter(
    (a) =>
      a.type === 'Property' ||
      a.type === 'Vehicle' ||
      a.type === 'Lending' ||
      (a.type === 'Other Assets' && a.otherSubType !== 'Cash')
  );
  const bucketCcAccounts = analyticsOpen.filter((a) => a.type === 'Credit Card');
  const bucketLoanAccounts = analyticsOpen.filter(
    (a) => a.type === 'Loan' || a.type === 'Other Liabilities'
  );

  const rawBuckets: Omit<AccountsAllocationItem, 'pct'>[] = [
    {
      id: 'cash',
      label: 'Liquid cash',
      value: toPref(sumBucketEur(bucketCashAccounts, false)),
      kind: 'asset',
      count: bucketCashAccounts.length,
    },
    {
      id: 'savings_pension',
      label: 'Savings & pension',
      value: toPref(sumBucketEur(bucketSavingsAccounts, false)),
      kind: 'asset',
      count: bucketSavingsAccounts.length,
    },
    {
      id: 'property_assets',
      label: 'Property & physical',
      value: toPref(sumBucketEur(bucketPhysicalAccounts, false)),
      kind: 'asset',
      count: bucketPhysicalAccounts.length,
    },
    {
      id: 'credit_cards',
      label: 'Credit cards',
      value: toPref(sumBucketEur(bucketCcAccounts, true)),
      kind: 'liability',
      count: bucketCcAccounts.length,
    },
    {
      id: 'loans_debt',
      label: 'Loans & mortgages',
      value: toPref(sumBucketEur(bucketLoanAccounts, true)),
      kind: 'liability',
      count: bucketLoanAccounts.length,
    },
  ];
  // Shares of the gross footprint; a bucket that is net negative (all overdrawn) shows 0 %.
  const totalBucketSum = rawBuckets.reduce((s, b) => safeAdd(s, Math.max(0, b.value)), 0);
  const allocationItems: AccountsAllocationItem[] = rawBuckets.map((b) => ({
    ...b,
    pct: totalBucketSum > 0 ? safeRound((Math.max(0, b.value) / totalBucketSum) * 100, 1) : 0,
  }));

  // Ranked Attention Items
  const attentionItems: AccountAttentionItem[] = [];
  open.forEach((acc) => {
    const accTxs = txsByAccount.get(acc.id) || [];
    if (acc.type === 'Credit Card' && (acc.creditLimit || 0) > 0) {
      const realBal = todayBalance.get(acc.id) ?? 0;
      const owed = Math.max(0, -realBal);
      const util = (owed / (acc.creditLimit || 1)) * 100;
      if (util >= 30) {
        attentionItems.push({
          id: `cc-util-${acc.id}`,
          accountId: acc.id,
          accountName: acc.name,
          severity: util >= 80 ? 'danger' : 'warn',
          title: util >= 80 ? 'High Credit Utilization' : 'Elevated Credit Utilization',
          subtitle: `${util.toFixed(0)}% of credit limit used`,
          metricLabel: `${util.toFixed(1)}% used`,
        });
      }
    } else if ((acc.type === 'Loan' || acc.type === 'Lending') && acc.principalAmount && acc.duration && acc.loanStartDate) {
      const schedule = generateAmortizationSchedule(
        acc,
        accTxs,
        loanPaymentOverrides[acc.id] || {}
      );
      const overdue = schedule.filter((p) => p.status === 'Overdue');
      if (overdue.length > 0) {
        attentionItems.push({
          id: `loan-overdue-${acc.id}`,
          accountId: acc.id,
          accountName: acc.name,
          severity: 'danger',
          title: acc.type === 'Lending' ? 'Overdue repayment to you' : 'Overdue Loan Installment',
          subtitle: `${overdue.length} scheduled payment${overdue.length > 1 ? 's' : ''} past due`,
          metricLabel: `Due ${formatShortDate(overdue[0].date)}`,
        });
      }
    } else if (acc.type === 'Vehicle' && acc.ownership === 'Leased') {
      const vMetrics = computeVehicleAccountMetrics(acc, accounts, transactions, loanPaymentOverrides, options);
      if (vMetrics.leaseStats?.mileageStatus === 'Over Budget') {
        attentionItems.push({
          id: `veh-mileage-${acc.id}`,
          accountId: acc.id,
          accountName: acc.name,
          severity: 'warn',
          title: 'Lease Mileage Over Pace',
          subtitle: `+${Math.round(vMetrics.leaseStats.mileageDiff).toLocaleString()} km above pro-rata allowance`,
          metricLabel: `${vMetrics.leaseStats.daysRemaining}d left`,
        });
      }
    } else if (
      acc.type === 'Savings' &&
      // Threshold in EUR, so 1,000 RON and 1,000 BTC are not treated alike.
      convertToEur(todayBalance.get(acc.id) ?? 0, acc.currency, rates) > 1000 &&
      !(acc.apy && acc.apy > 0)
    ) {
      attentionItems.push({
        id: `sav-apy-${acc.id}`,
        accountId: acc.id,
        accountName: acc.name,
        severity: 'info',
        title: '0% APY on Savings Reserve',
        subtitle: 'Set an APY rate to track accrued interest and compounding',
        metricLabel: '0% APY',
      });
    }
  });

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntil = (d: Date) => Math.round((d.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
  open.forEach((acc) => {
    // Card statement due within 7 days while something is owed.
    if (acc.type === 'Credit Card' && acc.statementStartDate && acc.paymentDate) {
      const owed = Math.max(0, -(todayBalance.get(acc.id) ?? 0));
      const due = calculateStatementPeriods(acc.statementStartDate, acc.paymentDate).current.paymentDue;
      const days = daysUntil(due);
      if (owed > 0 && days >= 0 && days <= 7) {
        attentionItems.push({
          id: `cc-due-${acc.id}`,
          accountId: acc.id,
          accountName: acc.name,
          severity: days <= 2 ? 'danger' : 'warn',
          title: 'Card payment due soon',
          subtitle: days === 0 ? 'Due today' : `Due in ${days} day${days > 1 ? 's' : ''}`,
          metricLabel: `Due ${formatShortDate(toLocalISOString(due))}`,
        });
      }
    }
    // Bank connection consent ending within 14 days.
    const expiry = options.bankConsentExpiry?.get(acc.id);
    if (expiry) {
      const days = daysUntil(new Date(expiry));
      if (days <= 14) {
        attentionItems.push({
          id: `bank-consent-${acc.id}`,
          accountId: acc.id,
          accountName: acc.name,
          severity: days <= 3 ? 'danger' : 'warn',
          title: days < 0 ? 'Bank connection expired' : 'Bank connection expires soon',
          subtitle: days < 0 ? 'Reconnect to keep syncing' : `Reconnect within ${days} day${days === 1 ? '' : 's'}`,
          metricLabel: days < 0 ? 'Expired' : `${days}d left`,
        });
      }
    }
  });

  const severityOrder: Record<AccountAttentionItem['severity'], number> = {
    danger: 0,
    warn: 1,
    info: 2,
  };
  attentionItems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    netWorth90dDelta,
    netWorth90dPct,
    solvencyRatioPct,
    liquidCash,
    liquidRunwayMonths,
    netFlow30d,
    trend90d,
    assetsTrend,
    liabilitiesTrend,
    liquidCashTrend,
    allocationItems,
    attentionItems,
  };
};

/**
 * Splits a list of accounts into Asset accounts and Liability accounts.
 */
export const splitAssetsAndLiabilities = (
  accounts: Account[]
): { assets: Account[]; liabilities: Account[] } => {
  const assets = accounts.filter((a) => ASSET_TYPES.includes(a.type) || a.type === 'Investment');
  const liabilities = accounts.filter((a) => DEBT_TYPES.includes(a.type));
  return { assets, liabilities };
};

/**
 * Detects if an account represents a Meal Voucher benefit card (e.g. Edenred, Pluxee/Sodexo, Monizze).
 */
export const isMealVoucherAccount = (a: {
  name?: string;
  type?: string;
  subType?: string;
  otherSubType?: string;
  financialInstitution?: string;
}): boolean => {
  const norm = (s?: string | null) => (s || '').toLowerCase().trim();
  const sub = norm(a.subType);
  const otherSub = norm(a.otherSubType);
  const name = norm(a.name);
  const inst = norm(a.financialInstitution);
  const type = norm(a.type);

  if (type === 'meal voucher' || type === 'meal vouchers') return true;
  if (otherSub === 'meal voucher' || otherSub === 'meal vouchers') return true;
  if (sub.includes('meal') || sub.includes('voucher') || sub.includes('repas') || sub.includes('maaltijd')) return true;
  if (otherSub.includes('meal') || otherSub.includes('voucher') || otherSub.includes('repas') || otherSub.includes('maaltijd')) return true;
  if (
    name.includes('meal voucher') ||
    name.includes('meal vouchers') ||
    name.includes('titre-repas') ||
    name.includes('titres-repas') ||
    name.includes('chèque-repas') ||
    name.includes('cheque repas') ||
    name.includes('cheques repas') ||
    name.includes('maaltijdcheque') ||
    name.includes('maaltijdcheques') ||
    name.includes('ticket restaurant')
  ) {
    return true;
  }
  if (
    inst.includes('edenred') ||
    inst.includes('pluxee') ||
    inst.includes('sodexo') ||
    inst.includes('monizze') ||
    name.includes('edenred') ||
    name.includes('pluxee') ||
    name.includes('sodexo') ||
    name.includes('monizze')
  ) {
    return true;
  }
  return false;
};

export type AccountGroupKey =
  | 'checking'
  | 'credit_card'
  | 'savings'
  | 'meal_voucher'
  | 'loan'
  | 'investment'
  | 'lending'
  | 'property'
  | 'vehicle'
  | 'other_assets'
  | 'other_liabilities';

export type AccountGroupIcon =
  | 'bank'
  | 'card'
  | 'piggy'
  | 'invoice'
  | 'investments'
  | 'transactions'
  | 'home'
  | 'pin'
  | 'wallet'
  | 'warning';

export interface AccountTypeGroup {
  key: AccountGroupKey;
  label: string;
  icon: AccountGroupIcon;
  category: 'asset' | 'liability';
  accounts: Account[];
  subtotal: number;
}

interface AccountGroupDefinition {
  key: AccountGroupKey;
  label: string;
  icon: AccountGroupIcon;
  category: 'asset' | 'liability';
  matcher: (acc: Account) => boolean;
}

export const ACCOUNT_GROUP_DEFINITIONS: AccountGroupDefinition[] = [
  {
    key: 'checking',
    label: 'Checking accounts',
    icon: 'bank',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Checking',
  },
  {
    key: 'credit_card',
    label: 'Credit cards',
    icon: 'card',
    category: 'liability',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Credit Card',
  },
  {
    key: 'savings',
    label: 'Savings accounts',
    icon: 'piggy',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Savings',
  },
  {
    key: 'meal_voucher',
    label: 'Meal vouchers',
    icon: 'card',
    category: 'asset',
    matcher: (acc) => isMealVoucherAccount(acc),
  },
  {
    key: 'loan',
    label: 'Loans & mortgages',
    icon: 'invoice',
    category: 'liability',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Loan',
  },
  {
    key: 'investment',
    label: 'Investments',
    icon: 'investments',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Investment',
  },
  {
    key: 'lending',
    label: 'Lending',
    icon: 'transactions',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Lending',
  },
  {
    key: 'property',
    label: 'Property & real estate',
    icon: 'home',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Property',
  },
  {
    key: 'vehicle',
    label: 'Vehicles',
    icon: 'pin',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Vehicle',
  },
  {
    key: 'other_assets',
    label: 'Other assets',
    icon: 'wallet',
    category: 'asset',
    matcher: (acc) =>
      !isMealVoucherAccount(acc) &&
      (acc.type === 'Other Assets' ||
        (!DEBT_TYPES.includes(acc.type) &&
          acc.type !== 'Checking' &&
          acc.type !== 'Savings' &&
          acc.type !== 'Investment' &&
          acc.type !== 'Lending' &&
          acc.type !== 'Property' &&
          acc.type !== 'Vehicle')),
  },
  {
    key: 'other_liabilities',
    label: 'Other liabilities',
    icon: 'warning',
    category: 'liability',
    matcher: (acc) =>
      !isMealVoucherAccount(acc) &&
      (acc.type === 'Other Liabilities' ||
        (DEBT_TYPES.includes(acc.type) &&
          acc.type !== 'Credit Card' &&
          acc.type !== 'Loan')),
  },
];

/**
 * Groups a list of accounts into type sections (Split Sheet, List, and Bento views).
 * Mode 'all' orders: Checking -> Credit Cards -> Savings -> Meal Vouchers -> Loans -> Investments -> Lending -> Property -> Vehicles -> Other Assets -> Other Liabilities.
 * Mode 'assets' filters asset groups; mode 'liabilities' filters liability groups.
 */
export const groupAccountsByType = (
  accounts: Account[],
  displayBalancesById: Record<string, number> = {},
  convert?: (amount: number, fromCurrency: Currency) => number,
  mode: 'all' | 'assets' | 'liabilities' = 'all'
): AccountTypeGroup[] => {
  const groups: AccountTypeGroup[] = [];

  for (const def of ACCOUNT_GROUP_DEFINITIONS) {
    if (mode === 'assets' && def.category !== 'asset') continue;
    if (mode === 'liabilities' && def.category !== 'liability') continue;

    const matchedAccounts = accounts.filter(def.matcher);
    if (matchedAccounts.length === 0) continue;

    const subtotal = matchedAccounts.reduce((sum, acc) => {
      const bal = displayBalancesById[acc.id] ?? acc.balance;
      const converted = convert ? convert(bal, acc.currency) : bal;
      // Signed, like the balance-sheet totals: a card in credit lowers its group's debt.
      return safeAdd(sum, def.category === 'liability' ? debtFromBalance(acc, converted) : converted);
    }, 0);

    groups.push({
      key: def.key,
      label: def.label,
      icon: def.icon,
      category: def.category,
      accounts: matchedAccounts,
      subtotal: safeRound(subtotal, 2),
    });
  }

  return groups;
};

export interface AccountFilterAndSortOptions {
  search?: string;
  currencyFilter?: Currency | 'ALL';
  /** Financial institutions to keep (any of them). Empty or missing means all. */
  institutionFilter?: string[];
  linkedOnly?: boolean;
  linkedAccountIds?: Set<string>;
  analyticsOnly?: boolean;
  sortBy?: 'manual' | 'balance' | 'name' | 'change30d' | 'apy_apr';
  accountOrder?: string[];
  sparklinesById?: Record<string, AccountSparklineResult>;
  conversionRates?: Partial<Record<Currency, number>>;
}

/**
 * Filters and sorts accounts according to toolbar search, filter chips, and sort order.
 */
export const filterAndSortAccounts = (
  accounts: Account[],
  displayBalancesById: Record<string, number>,
  options: AccountFilterAndSortOptions = {}
): Account[] => {
  const q = (options.search || '').trim().toLowerCase();
  const filtered = accounts.filter((acc) => {
    if (options.currencyFilter && options.currencyFilter !== 'ALL' && acc.currency !== options.currencyFilter) {
      return false;
    }
    if (options.institutionFilter && options.institutionFilter.length > 0) {
      const inst = (acc.financialInstitution || '').trim().toLowerCase();
      if (!options.institutionFilter.some((name) => name.trim().toLowerCase() === inst)) return false;
    }
    if (options.linkedOnly && options.linkedAccountIds && !options.linkedAccountIds.has(acc.id)) {
      return false;
    }
    if (options.analyticsOnly && !(acc.includeInAnalytics ?? true)) {
      return false;
    }
    if (q) {
      const hay = [
        acc.name,
        acc.financialInstitution,
        acc.type,
        acc.subType,
        acc.otherSubType,
        acc.accountNumber,
        acc.last4,
        acc.address,
        acc.make,
        acc.model,
        acc.licensePlate,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sortBy = options.sortBy || 'manual';
  const orderIndex = new Map<string, number>();
  (options.accountOrder || []).forEach((id, idx) => orderIndex.set(id, idx));

  return [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'balance') {
      const balA = convertCurrency(
        Math.abs(displayBalancesById[a.id] ?? a.balance),
        a.currency,
        'EUR',
        options.conversionRates
      );
      const balB = convertCurrency(
        Math.abs(displayBalancesById[b.id] ?? b.balance),
        b.currency,
        'EUR',
        options.conversionRates
      );
      return balB - balA;
    }
    if (sortBy === 'change30d') {
      // Trends are in each account's own currency; compare them in EUR.
      const trA = convertCurrency(options.sparklinesById?.[a.id]?.trend ?? 0, a.currency, 'EUR', options.conversionRates);
      const trB = convertCurrency(options.sparklinesById?.[b.id]?.trend ?? 0, b.currency, 'EUR', options.conversionRates);
      return trB - trA;
    }
    if (sortBy === 'apy_apr') {
      const rateA = a.apy ?? a.interestRate ?? 0;
      const rateB = b.apy ?? b.interestRate ?? 0;
      return rateB - rateA;
    }
    // manual order with primary accounts prioritized if not explicitly ordered
    const idxA = orderIndex.get(a.id);
    const idxB = orderIndex.get(b.id);
    if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });
};

/**
 * Generates a CSV string for the provided accounts list.
 */
export const accountsToCSV = (
  accounts: Account[],
  displayBalancesById: Record<string, number>,
  preferredCurrency: Currency = 'EUR',
  options: AccountsModelOptions = {}
): string => {
  const rows = accounts.map((acc) => {
    const nativeBal = displayBalancesById[acc.id] ?? acc.balance;
    const convertedBal = safeRound(
      convertCurrency(nativeBal, acc.currency, preferredCurrency, options.conversionRates),
      2
    );
    return {
      Name: acc.name,
      Type: acc.subType || acc.otherSubType || acc.type,
      Institution: acc.financialInstitution || '',
      Status: acc.status || 'open',
      Currency: acc.currency,
      Balance: safeRound(nativeBal, 2),
      [`Balance (${preferredCurrency})`]: convertedBal,
      'APY / APR (%)': acc.apy ?? acc.interestRate ?? '',
      Identifier: acc.accountNumber || acc.last4 || acc.licensePlate || '',
    };
  });
  return arrayToCSV(rows);
};

