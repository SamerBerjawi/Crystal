import { ASSET_TYPES, DEBT_TYPES, LIQUID_ACCOUNT_TYPES } from '../constants';
import { Account, Currency, LoanPaymentOverrides, Transaction } from '../types';
import {
  arrayToCSV,
  calculateAccountTotals,
  convertCurrency,
  convertToEur,
  generateAmortizationSchedule,
  parseLocalDate,
  safeRound,
  toLocalISOString,
} from '../utils';
import { computeVehicleAccountMetrics, resolveRealTodayBalance } from './accountDetailModel';

export interface AccountsModelOptions {
  conversionRates?: Partial<Record<Currency, number>>;
  referenceDate?: Date;
}

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
 * Computes the effective display balance of an account in its native currency,
 * resolving amortized or simple loan/lending balances when configured.
 */
export const computeAccountDisplayBalance = (
  account: Account,
  accountTransactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {}
): number => {
  if (account.type === 'Loan' || account.type === 'Lending') {
    if (
      account.principalAmount &&
      account.duration &&
      account.loanStartDate &&
      account.interestRate !== undefined
    ) {
      const overrides = loanPaymentOverrides[account.id] || {};
      const schedule = generateAmortizationSchedule(account, accountTransactions, overrides);

      const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
      const totalPaidPrincipal = schedule.reduce(
        (acc, p) => (p.status === 'Paid' ? acc + p.principal : acc),
        0
      );
      const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
      const totalPaidInterest = schedule.reduce(
        (acc, p) => (p.status === 'Paid' ? acc + p.interest : acc),
        0
      );

      const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
      const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);

      const totalOutstanding = outstandingPrincipal + outstandingInterest;
      return account.type === 'Loan' ? -totalOutstanding : totalOutstanding;
    }

    if (account.totalAmount) {
      const isLending = account.type === 'Lending';
      const loanPayments = accountTransactions.filter(
        (tx) => tx.type === (isLending ? 'expense' : 'income')
      );
      const totalPaid = loanPayments.reduce((sum, tx) => {
        const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
        return sum + (totalPayment > 0 ? totalPayment : Math.abs(tx.amount));
      }, 0);
      const outstanding = Math.max(0, account.totalAmount - totalPaid);
      return isLending ? outstanding : -outstanding;
    }
  }
  return account.balance;
};

export interface AccountSparklineResult {
  sparklineData: { date: Date; value: number }[];
  trend: number;
  trendPct: number | null;
  isPositiveTrend: boolean;
}

export interface AccountsKpiSparkPoint {
  day: string;
  date: string;
  value: number;
}

/**
 * Computes the 90-day daily balance sparkline for a single account.
 * Fixes:
 *  - BUG-02: Backs out future-dated transactions (`tx.date > today`) before walking backward.
 *  - BUG-03: Preserves true signed balances (no `Math.max(0, value)` clamping on liabilities or overdrafts).
 *  - Respects `priceHistory` for `Property` and `Vehicle` accounts when available.
 */
export const computeAccount90dSparkline = (
  account: Account,
  accountTransactions: Transaction[],
  displayBalance?: number,
  options: AccountsModelOptions = {}
): AccountSparklineResult => {
  const NUM_POINTS = 90;
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = toLocalISOString(endDate);

  const effectiveDisplayBalance =
    displayBalance !== undefined
      ? displayBalance
      : computeAccountDisplayBalance(account, accountTransactions);

  // Back out future transactions from the starting balance (BUG-02)
  const realTodayNativeBalance = resolveRealTodayBalance(
    effectiveDisplayBalance,
    account.currency,
    accountTransactions,
    { ...options, referenceDate: endDate }
  );

  // Property / Vehicle with explicit priceHistory
  if (
    (account.type === 'Property' || account.type === 'Vehicle') &&
    account.priceHistory &&
    account.priceHistory.length > 0
  ) {
    const sortedRecords = [...account.priceHistory].sort(
      (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
    );
    const points: { date: Date; value: number }[] = [];
    for (let i = NUM_POINTS - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      const dStr = toLocalISOString(d);
      let valNative = realTodayNativeBalance;
      const applicable = sortedRecords.filter((r) => r.date <= dStr);
      if (applicable.length > 0) {
        const lastEntry = applicable[applicable.length - 1] as { price?: number; value?: number };
        valNative = lastEntry.price ?? lastEntry.value ?? realTodayNativeBalance;
      } else if (account.purchasePrice !== undefined) {
        valNative = account.purchasePrice;
      }
      const valEur = convertCurrency(valNative, account.currency, 'EUR', options.conversionRates);
      points.push({ date: d, value: valEur });
    }
    const startVal = points[0].value;
    const endVal = points[points.length - 1].value;
    const trendVal = endVal - startVal;
    const startAbs = Math.abs(startVal);
    const trendPct = startAbs >= 1 ? safeRound((trendVal / startAbs) * 100, 1) : null;
    return {
      sparklineData: points,
      trend: trendVal,
      trendPct,
      isPositiveTrend: trendVal >= 0,
    };
  }

  const currentBalEur = convertCurrency(
    realTodayNativeBalance,
    account.currency,
    'EUR',
    options.conversionRates
  );

  const txsByDate: Record<string, number> = {};
  accountTransactions.forEach((tx) => {
    if (tx.date > todayStr) return; // Ignore future transactions in past 90d walk (already backed out of realTodayNativeBalance)
    const amountEur = convertCurrency(tx.amount, tx.currency, 'EUR', options.conversionRates);
    txsByDate[tx.date] = (txsByDate[tx.date] || 0) + amountEur;
  });

  const runningDate = new Date(endDate);
  const history: { date: Date; value: number }[] = [];
  let runningBal = currentBalEur;

  for (let i = 0; i < NUM_POINTS; i++) {
    history.push({
      date: new Date(runningDate),
      value: runningBal,
    });
    const dateStr = toLocalISOString(runningDate);
    const change = txsByDate[dateStr] || 0;
    runningBal -= change;
    runningDate.setDate(runningDate.getDate() - 1);
  }

  // BUG-03 Fix: Do NOT clamp negative values to 0
  const data = history.reverse();
  const startVal = data[0].value;
  const endVal = data[data.length - 1].value;
  const trendVal = endVal - startVal;
  // For both assets and signed liabilities (e.g. -500 -> -200 gives trendVal = +300),
  // a higher signed balance means higher asset or lower debt!
  const isPositive = trendVal >= 0;
  const startAbs = Math.abs(startVal);
  const trendPct = startAbs >= 1 ? safeRound((trendVal / startAbs) * 100, 1) : null;

  return {
    sparklineData: data,
    trend: trendVal,
    trendPct,
    isPositiveTrend: isPositive,
  };
};

/**
 * Reconstructs the 90-day daily trends across Portfolio Net Worth, Assets, Liabilities, and Liquid Cash.
 * Fixes BUG-04 & BUG-02:
 *  - Backs out future-dated transactions before walking backward.
 *  - Respects Property/Vehicle `priceHistory` and amortized Loan schedules per account.
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
  const NUM_POINTS = 90;
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const includedAccounts = openAccounts.filter((acc) => acc.includeInAnalytics ?? true);
  const txsByAccount: Record<string, Transaction[]> = {};
  analyticsTransactions.forEach((tx) => {
    (txsByAccount[tx.accountId] = txsByAccount[tx.accountId] || []).push(tx);
  });

  const dailyNetWorth = new Array<number>(NUM_POINTS).fill(0);
  const dailyAssets = new Array<number>(NUM_POINTS).fill(0);
  const dailyLiabilities = new Array<number>(NUM_POINTS).fill(0);
  const dailyLiquid = new Array<number>(NUM_POINTS).fill(0);

  includedAccounts.forEach((acc) => {
    const accTxs = txsByAccount[acc.id] || [];
    const displayBal = computeAccountDisplayBalance(acc, accTxs, loanPaymentOverrides);
    const { sparklineData } = computeAccount90dSparkline(acc, accTxs, displayBal, {
      ...options,
      referenceDate: endDate,
    });

    const isDebt = DEBT_TYPES.includes(acc.type);
    const isLiquid =
      LIQUID_ACCOUNT_TYPES.includes(acc.type) ||
      (acc.type === 'Other Assets' && acc.otherSubType === 'Cash');

    sparklineData.forEach((pt, idx) => {
      dailyNetWorth[idx] += pt.value;
      if (isDebt) {
        dailyLiabilities[idx] += Math.abs(pt.value);
      } else {
        dailyAssets[idx] += Math.max(0, pt.value);
      }
      if (isLiquid) {
        dailyLiquid[idx] += Math.max(0, pt.value);
      }
    });
  });

  const netWorth: { date: string; value: number }[] = [];
  const assets: AccountsKpiSparkPoint[] = [];
  const liabilities: AccountsKpiSparkPoint[] = [];
  const liquidCash: AccountsKpiSparkPoint[] = [];

  for (let idx = 0; idx < NUM_POINTS; idx++) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - (NUM_POINTS - 1 - idx));
    const dateStr = toLocalISOString(d);
    const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    netWorth.push({ date: dateStr, value: dailyNetWorth[idx] });
    assets.push({ date: dateStr, day: dayStr, value: dailyAssets[idx] });
    liabilities.push({ date: dateStr, day: dayStr, value: dailyLiabilities[idx] });
    liquidCash.push({ date: dateStr, day: dayStr, value: dailyLiquid[idx] });
  }

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
  const cutoffStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoffStart.setDate(cutoffStart.getDate() - days);

  const cashIds = new Set(cashAccounts.map((a) => a.id));
  return allTransactions
    .filter((t) => {
      if (!cashIds.has(t.accountId) || t.transferId) return false;
      const txDate = parseLocalDate(t.date);
      return txDate >= cutoffStart && txDate <= todayEnd;
    })
    .reduce((sum, t) => {
      const eurAmount = options.conversionRates
        ? convertCurrency(t.amount, t.currency, 'EUR', options.conversionRates)
        : convertToEur(t.amount, t.currency);
      return sum + eurAmount;
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

  const { totalAssets: assetsEur, totalDebt: debtEur, netWorth: netWorthEur } =
    calculateAccountTotals(analyticsOpen, analyticsTxs, loanPaymentOverrides);

  const toPref = (eurVal: number) =>
    safeRound(convertCurrency(eurVal, 'EUR', preferredCurrency, options.conversionRates), 2);

  const totalAssets = toPref(assetsEur);
  const totalLiabilities = toPref(debtEur);
  const netWorth = toPref(netWorthEur);

  const grossFootprint = totalAssets + totalLiabilities;
  const solvencyRatioPct =
    grossFootprint > 0
      ? safeRound((totalAssets / grossFootprint) * 100, 1)
      : 100;

  // Liquid cash & 30d net flow / burn runway
  const liquidAccounts = analyticsOpen.filter(
    (a) =>
      LIQUID_ACCOUNT_TYPES.includes(a.type) ||
      (a.type === 'Other Assets' && a.otherSubType === 'Cash')
  );
  const liquidCashEur = liquidAccounts.reduce(
    (sum, a) =>
      sum +
      convertCurrency(
        resolveRealTodayBalance(a, analyticsTxs, options),
        a.currency,
        'EUR',
        options.conversionRates
      ),
    0
  );
  const liquidCash = toPref(liquidCashEur);

  const netFlow30dEur = computeCashSegmentNetFlow(liquidAccounts, analyticsTxs, 30, options);
  const netFlow30d = toPref(netFlow30dEur);

  // Compute 30d non-transfer expense burn across liquid accounts
  const now = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const cutoff30d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff30d.setDate(cutoff30d.getDate() - 30);
  const liquidIds = new Set(liquidAccounts.map((a) => a.id));
  const monthlyExpenseBurnEur = analyticsTxs
    .filter((t) => {
      if (!liquidIds.has(t.accountId) || t.transferId || t.isBalanceAdjustment) return false;
      const d = parseLocalDate(t.date);
      return t.amount < 0 && d >= cutoff30d && d <= todayEnd;
    })
    .reduce(
      (sum, t) =>
        sum +
        Math.abs(convertCurrency(t.amount, t.currency, 'EUR', options.conversionRates)),
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

  // 5-Bucket Allocation Breakdown
  const sumBucketEur = (accs: Account[], isLiability = false) =>
    accs.reduce((s, a) => {
      const accTxs = analyticsTxs.filter((t) => t.accountId === a.id);
      const disp = computeAccountDisplayBalance(a, accTxs, loanPaymentOverrides);
      const real = resolveRealTodayBalance(disp, a.currency, accTxs, options);
      const eur = convertCurrency(real, a.currency, 'EUR', options.conversionRates);
      return s + (isLiability ? Math.abs(Math.min(0, eur)) : Math.max(0, eur));
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
      label: 'Liquid Cash',
      value: toPref(sumBucketEur(bucketCashAccounts, false)),
      kind: 'asset',
      count: bucketCashAccounts.length,
    },
    {
      id: 'savings_pension',
      label: 'Savings & Pension',
      value: toPref(sumBucketEur(bucketSavingsAccounts, false)),
      kind: 'asset',
      count: bucketSavingsAccounts.length,
    },
    {
      id: 'property_assets',
      label: 'Property & Physical',
      value: toPref(sumBucketEur(bucketPhysicalAccounts, false)),
      kind: 'asset',
      count: bucketPhysicalAccounts.length,
    },
    {
      id: 'credit_cards',
      label: 'Credit Cards',
      value: toPref(sumBucketEur(bucketCcAccounts, true)),
      kind: 'liability',
      count: bucketCcAccounts.length,
    },
    {
      id: 'loans_debt',
      label: 'Loans & Mortgages',
      value: toPref(sumBucketEur(bucketLoanAccounts, true)),
      kind: 'liability',
      count: bucketLoanAccounts.length,
    },
  ];
  const totalBucketSum = rawBuckets.reduce((s, b) => s + b.value, 0);
  const allocationItems: AccountsAllocationItem[] = rawBuckets.map((b) => ({
    ...b,
    pct: totalBucketSum > 0 ? safeRound((b.value / totalBucketSum) * 100, 1) : 0,
  }));

  // Ranked Attention Items
  const attentionItems: AccountAttentionItem[] = [];
  open.forEach((acc) => {
    const accTxs = transactions.filter((t) => t.accountId === acc.id);
    if (acc.type === 'Credit Card' && (acc.creditLimit || 0) > 0) {
      const realBal = resolveRealTodayBalance(acc, accTxs, options);
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
    } else if (acc.type === 'Loan' && acc.principalAmount && acc.duration && acc.loanStartDate) {
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
          title: 'Overdue Loan Installment',
          subtitle: `${overdue.length} scheduled payment${overdue.length > 1 ? 's' : ''} past due`,
          metricLabel: `Due ${overdue[0].date}`,
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
    } else if (acc.type === 'Savings' && acc.balance > 1000 && !(acc.apy && acc.apy > 0)) {
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

/**
 * Priority ranking for Card & Account Wallet cards:
 * 0. Primary account first
 * 1. Checking accounts
 * 2. Credit cards
 * 3. Savings accounts
 * 4. Meal vouchers
 * 5. Other
 */
export const getCardWalletPriority = (a: Account): number => {
  if (a.isPrimary) return 0;
  if (isMealVoucherAccount(a)) return 4;
  if (a.type === 'Checking') return 1;
  if (a.type === 'Credit Card') return 2;
  if (a.type === 'Savings') return 3;
  return 5;
};

/**
 * Returns open card & liquid accounts for the `Card & Account Wallet` rail sorted strictly by priority:
 * 1. Primary account first
 * 2. Checking accounts
 * 3. Credit cards
 * 4. Savings accounts
 * 5. Meal vouchers
 */
export const getCardWalletAccounts = (
  accounts: Account[],
  accountOrder?: string[]
): Account[] => {
  const orderIndex = new Map<string, number>();
  if (accountOrder) {
    accountOrder.forEach((id, idx) => orderIndex.set(id, idx));
  }

  const eligible = accounts.filter(
    (a) =>
      a.status !== 'closed' &&
      (Boolean(a.isPrimary) ||
        a.type === 'Checking' ||
        a.type === 'Credit Card' ||
        a.type === 'Savings' ||
        isMealVoucherAccount(a))
  );

  return [...eligible].sort((a, b) => {
    const prioA = getCardWalletPriority(a);
    const prioB = getCardWalletPriority(b);
    if (prioA !== prioB) {
      return prioA - prioB;
    }

    // Within same priority, respect custom accountOrder if available
    const idxA = orderIndex.get(a.id);
    const idxB = orderIndex.get(b.id);
    if (idxA !== undefined && idxB !== undefined) {
      return idxA - idxB;
    }
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;

    // Default stable tie-breaker: keep relative position in accounts
    return accounts.indexOf(a) - accounts.indexOf(b);
  });
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
    label: 'Checking Accounts',
    icon: 'bank',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Checking',
  },
  {
    key: 'credit_card',
    label: 'Credit Cards',
    icon: 'card',
    category: 'liability',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Credit Card',
  },
  {
    key: 'savings',
    label: 'Savings Accounts',
    icon: 'piggy',
    category: 'asset',
    matcher: (acc) => !isMealVoucherAccount(acc) && acc.type === 'Savings',
  },
  {
    key: 'meal_voucher',
    label: 'Meal Vouchers',
    icon: 'card',
    category: 'asset',
    matcher: (acc) => isMealVoucherAccount(acc),
  },
  {
    key: 'loan',
    label: 'Loans & Mortgages',
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
    label: 'Property & Real Estate',
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
    label: 'Other Assets',
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
    label: 'Other Liabilities',
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
      if (def.category === 'liability') {
        return sum + Math.abs(converted);
      }
      return sum + converted;
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
  institutionFilter?: string | 'ALL';
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
    if (
      options.institutionFilter &&
      options.institutionFilter !== 'ALL' &&
      (acc.financialInstitution || '').toLowerCase() !== options.institutionFilter.toLowerCase()
    ) {
      return false;
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
      const trA = options.sparklinesById?.[a.id]?.trend ?? 0;
      const trB = options.sparklinesById?.[b.id]?.trend ?? 0;
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

