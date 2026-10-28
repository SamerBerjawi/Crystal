import {
  Account,
  BillPayment,
  Category,
  FinancialGoal,
  LoanPaymentOverrides,
  MileageLog,
  RecurringTransaction,
  RecurringTransactionOverride,
  ScheduledPayment,
  Transaction,
} from '../types';
import {
  calculateStatementPeriods,
  calculateTrendLine,
  convertCurrency,
  flattenCategories,
  generateAmortizationSchedule,
  generateBalanceForecast,
  generateSyntheticCreditCardPayments,
  generateSyntheticLoanPayments,
  generateSyntheticPropertyTransactions,
  parseLocalDate,
  safeAdd,
  safeDivide,
  safeRound,
  safeSubtract,
  toLocalISOString,
  toLocalISOYearMonth,
} from '../utils';

export interface TxWithMeta {
  tx: Transaction;
  parsedDate: Date;
  convertedAmount?: number;
}

export interface DetailModelOptions {
  referenceDate?: Date;
  showBalanceAdjustments?: boolean;
  rates?: Record<string, number>;
  conversionRates?: Record<string, number>;
}

/**
 * Normalizes either raw Transaction[] or AccountDetail's { tx, parsedDate, convertedAmount }[]
 * into a clean array with dates and amounts converted into `targetCurrency`.
 */
export function normalizeAccountTransactions(
  input: Array<Transaction | TxWithMeta>,
  targetCurrency: Account['currency'],
  options?: DetailModelOptions
): Array<{ tx: Transaction; parsedDate: Date; amountInAccountCurrency: number; dateStr: string }> {
  const showAdjustments = options?.showBalanceAdjustments ?? true;
  const effectiveRates = options?.rates ?? options?.conversionRates;
  const result: Array<{ tx: Transaction; parsedDate: Date; amountInAccountCurrency: number; dateStr: string }> = [];

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const tx = 'tx' in item ? item.tx : item;
    if (!showAdjustments && tx.isBalanceAdjustment) continue;
    const parsedDate = 'parsedDate' in item && item.parsedDate instanceof Date
      ? item.parsedDate
      : parseLocalDate(tx.date);
    const dateStr = toLocalISOString(parsedDate);
    const amountInAccountCurrency = convertCurrency(
      tx.amount,
      tx.currency || targetCurrency,
      targetCurrency,
      effectiveRates
    );
    result.push({ tx, parsedDate, amountInAccountCurrency, dateStr });
  }

  return result;
}

/**
 * BUG-02 & BUG-07 Fix:
 * `account.balance` includes all saved transactions, even future-dated ones.
 * This backs out any transactions dated strictly after `todayStr` in `account.currency`.
 * Supports both:
 *  - `resolveRealTodayBalance(account, transactions, options)`
 *  - `resolveRealTodayBalance(displayBalance, currency, transactions, options)`
 */
export function resolveRealTodayBalance(
  accountOrBalance: Account | number,
  transactionsOrCurrency: Array<Transaction | TxWithMeta> | Account['currency'],
  optionsOrTransactions?: DetailModelOptions | Array<Transaction | TxWithMeta>,
  maybeOptions?: DetailModelOptions
): number {
  const isAccountObj = typeof accountOrBalance === 'object' && accountOrBalance !== null;
  const startingBalance: number = isAccountObj
    ? (accountOrBalance as Account).balance
    : (accountOrBalance as number);
  const targetCurrency = isAccountObj
    ? (accountOrBalance as Account).currency
    : (transactionsOrCurrency as Account['currency']);
  const accountId = isAccountObj ? (accountOrBalance as Account).id : undefined;
  const transactions = isAccountObj
    ? (transactionsOrCurrency as Array<Transaction | TxWithMeta>)
    : (optionsOrTransactions as Array<Transaction | TxWithMeta>);
  const options = isAccountObj
    ? (optionsOrTransactions as DetailModelOptions | undefined)
    : maybeOptions;

  const ref = options?.referenceDate ?? new Date();
  const todayStr = toLocalISOString(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  const normalized = normalizeAccountTransactions(transactions || [], targetCurrency, options);

  let realBalance: number = startingBalance;
  for (const { tx, dateStr, amountInAccountCurrency } of normalized) {
    if (accountId && tx.accountId !== accountId) continue;
    if (dateStr > todayStr) {
      realBalance = safeSubtract(realBalance, amountInAccountCurrency);
    }
  }
  return safeRound(realBalance, 2);
}

/**
 * BUG-10 Fix:
 * Bidirectional link resolution between a Loan and its financed Asset (Property or Vehicle).
 */
export function findLinkedLoanForAsset(asset: Account, allAccounts: Account[]): Account | undefined {
  if (asset.linkedLoanId) {
    const direct = allAccounts.find(a => a.id === asset.linkedLoanId);
    if (direct) return direct;
  }
  return allAccounts.find(a => a.type === 'Loan' && a.linkedAssetId === asset.id);
}

export function findLinkedAssetForLoan(loan: Account, allAccounts: Account[]): Account | undefined {
  if (loan.linkedAssetId) {
    const direct = allAccounts.find(a => a.id === loan.linkedAssetId);
    if (direct) return direct;
  }
  return allAccounts.find(
    a => (a.type === 'Property' || a.type === 'Vehicle') && a.linkedLoanId === loan.id
  );
}

/**
 * Resolves the outstanding principal and total balance on a Loan/Lending account in `targetCurrency`.
 */
export function resolveLoanOutstanding(
  loan: Account,
  allTransactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {},
  options?: { showBalanceAdjustments?: boolean; targetCurrency?: Account['currency']; rates?: Record<string, number> }
): {
  outstandingPrincipal: number;
  outstandingInterest: number;
  totalOutstanding: number;
  paidPrincipal: number;
  paidInterest: number;
} {
  const showAdjustments = options?.showBalanceAdjustments ?? true;
  const targetCurrency = options?.targetCurrency ?? loan.currency;
  const effectiveRates = options?.rates ?? (options as DetailModelOptions | undefined)?.conversionRates;
  const filteredTxs = allTransactions.filter(tx => showAdjustments || !tx.isBalanceAdjustment);

  let outstandingPrincipal = 0;
  let outstandingInterest = 0;
  let paidPrincipal = 0;
  let paidInterest = 0;

  if (loan.principalAmount && loan.duration && loan.loanStartDate && loan.interestRate !== undefined) {
    const overrides = loanPaymentOverrides[loan.id] || {};
    const schedule = generateAmortizationSchedule(loan, filteredTxs, overrides);
    const totalScheduledPrincipal = schedule.reduce((s, p) => safeAdd(s, p.principal), 0);
    const totalScheduledInterest = schedule.reduce((s, p) => safeAdd(s, p.interest), 0);
    paidPrincipal = schedule.reduce((s, p) => (p.status === 'Paid' ? safeAdd(s, p.principal) : s), 0);
    paidInterest = schedule.reduce((s, p) => (p.status === 'Paid' ? safeAdd(s, p.interest) : s), 0);
    outstandingPrincipal = Math.max(0, safeSubtract(totalScheduledPrincipal, paidPrincipal));
    outstandingInterest = Math.max(0, safeSubtract(totalScheduledInterest, paidInterest));
  } else {
    const isLending = loan.type === 'Lending';
    const loanPayments = filteredTxs.filter(
      tx => tx.accountId === loan.id && tx.type === (isLending ? 'expense' : 'income')
    );
    const totalPaid = loanPayments.reduce((s, tx) => {
      const p = tx.principalAmount !== undefined
        ? convertCurrency(tx.principalAmount, tx.currency || loan.currency, loan.currency, effectiveRates)
        : 0;
      const i = tx.interestAmount !== undefined
        ? convertCurrency(tx.interestAmount, tx.currency || loan.currency, loan.currency, effectiveRates)
        : 0;
      const breakdown = safeAdd(p, i);
      const raw = Math.abs(convertCurrency(tx.amount, tx.currency || loan.currency, loan.currency, effectiveRates));
      return safeAdd(s, p > 0 ? p : (breakdown > 0 ? breakdown : raw));
    }, 0);
    paidPrincipal = totalPaid;
    if (loan.totalAmount) {
      outstandingPrincipal = Math.max(0, safeSubtract(loan.totalAmount, totalPaid));
    } else {
      outstandingPrincipal = Math.abs(loan.balance);
    }
  }

  const conv = (v: number) => safeRound(convertCurrency(v, loan.currency, targetCurrency, effectiveRates), 2);
  const outP = conv(outstandingPrincipal);
  const outI = conv(outstandingInterest);

  return {
    outstandingPrincipal: outP,
    outstandingInterest: outI,
    totalOutstanding: safeRound(safeAdd(outP, outI), 2),
    paidPrincipal: conv(paidPrincipal),
    paidInterest: conv(paidInterest),
  };
}

/**
 * Determines whether a transaction represents an interest / yield payout on a Savings account.
 * Flattens hierarchical categories so sub-categories are matched properly.
 */
export function isSavingsInterestTransaction(
  tx: Transaction,
  allCategories: Category[] = []
): boolean {
  if (tx.type !== 'income' || tx.transferId || tx.isBalanceAdjustment || tx.isMarketAdjustment) {
    return false;
  }
  const flat = flattenCategories(allCategories);
  const matchedCat = flat.find(
    c => c.id === tx.category || c.name.toLowerCase() === (tx.category || '').toLowerCase()
  );
  const categoryLabel = (matchedCat ? matchedCat.name : tx.category || '').toLowerCase();
  const parentCat = matchedCat?.parentId
    ? flat.find(c => c.id === matchedCat.parentId)?.name.toLowerCase() || ''
    : '';

  const catMatches =
    /interest|yield|apy|savings bonus|dividend|investment income|investments & dividends/i.test(categoryLabel) ||
    /interest|yield|dividend/i.test(parentCat);

  const textMatches = /\b(interest|apy|yield|dividend|zinsen|intérêts|rente|renten|compound)\b/i.test(
    `${tx.description || ''} ${tx.merchant || ''} ${tx.notes || ''}`
  );

  return catMatches || textMatches;
}

export interface SavingsMonthYieldPoint {
  [key: string]: unknown;
  name: string;
  monthKey: string;
  actual: number;
  accrued: number;
  projected: number;
  value: number;
  isProjected: boolean;
}

/**
 * Comprehensive Savings Interest & Trajectory Calculator.
 * Fixes:
 *  - `referenceDate` freezing in the past when no transaction occurred in the last 30 days
 *  - `totalInterestYTD` showing 0 when APY > 0 and interest transactions aren't manually logged
 *  - Sub-category hierarchy lookup in `allCategories`
 *  - Pre-`openingDate` months assuming full current balance
 *  - Cross-currency mixing between `EUR` (`convertedAmount`) and `account.currency`
 *  - 90-day `growthIndexPct` division-by-zero (`499,900%`) when balance 90d ago was 0
 */
export function computeSavingsAccountMetrics(
  account: Account,
  transactions: Array<Transaction | TxWithMeta>,
  allCategories: Category[] = [],
  options?: DetailModelOptions
) {
  const apy = Math.max(0, account.apy || 0);
  const ref = options?.referenceDate ?? new Date();
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const todayStr = toLocalISOString(refDay);

  const normalized = normalizeAccountTransactions(transactions, account.currency, options).filter(
    t => t.tx.accountId === account.id
  );

  const realTodayBalance = resolveRealTodayBalance(account, transactions, options);
  const projectedAnnualInterest = safeRound((Math.max(0, realTodayBalance) * apy) / 100, 2);
  const projectedMonthlyInterest = safeRound(projectedAnnualInterest / 12, 2);

  // Determine the earliest date the account was active
  const earliestTxDate = normalized.length > 0
    ? normalized.reduce((min, t) => (t.parsedDate < min ? t.parsedDate : min), normalized[0].parsedDate)
    : null;
  const parsedOpening = account.openingDate ? parseLocalDate(account.openingDate) : null;
  const effectiveOpenDate = parsedOpening && earliestTxDate
    ? (parsedOpening < earliestTxDate ? parsedOpening : earliestTxDate)
    : (parsedOpening || earliestTxDate);
  const effectiveOpenStr = effectiveOpenDate ? toLocalISOString(effectiveOpenDate) : null;

  // Map daily net transaction changes on or before todayStr
  const dailyChanges: Record<string, number> = {};
  for (const { dateStr, amountInAccountCurrency } of normalized) {
    if (dateStr <= todayStr) {
      dailyChanges[dateStr] = safeAdd(dailyChanges[dateStr] || 0, amountInAccountCurrency);
    }
  }

  // Reconstruct daily end-of-day balances going back 370 days from refDay
  const dailyBalances = new Map<string, number>();
  let runningBal = realTodayBalance;
  const cursor = new Date(refDay);
  for (let i = 0; i <= 370; i++) {
    const dStr = toLocalISOString(cursor);
    if (effectiveOpenStr && dStr < effectiveOpenStr) {
      dailyBalances.set(dStr, 0);
    } else {
      dailyBalances.set(dStr, Math.max(0, safeRound(runningBal, 2)));
    }
    const delta = dailyChanges[dStr] || 0;
    runningBal = safeSubtract(runningBal, delta);
    cursor.setDate(cursor.getDate() - 1);
  }

  // Build 12-month interest history ending in refDay's month
  const interestHistory: SavingsMonthYieldPoint[] = [];
  let recordedInterestYTD = 0;
  let accruedInterestYTD = 0;
  let totalInterestYTD = 0;

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(refDay.getFullYear(), refDay.getMonth() - i, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const monthKey = toLocalISOYearMonth(monthStart);
    const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });

    // Recorded interest transactions in this calendar month
    const monthInterestTxs = normalized.filter(
      ({ tx, parsedDate }) =>
        parsedDate >= monthStart &&
        parsedDate <= monthEnd &&
        parsedDate <= refDay &&
        isSavingsInterestTransaction(tx, allCategories)
    );
    const actualInterest = safeRound(
      monthInterestTxs.reduce((sum, t) => safeAdd(sum, Math.max(0, t.amountInAccountCurrency)), 0),
      2
    );

    // Average daily balance over active days in this month (up to refDay)
    const lastElapsedDay = monthEnd > refDay ? refDay.getDate() : daysInMonth;
    let sumDailyBal = 0;
    let activeDays = 0;
    for (let dayNum = 1; dayNum <= lastElapsedDay; dayNum++) {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNum);
      const dStr = toLocalISOString(d);
      if (effectiveOpenStr && dStr < effectiveOpenStr) continue;
      const bal = dailyBalances.get(dStr) ?? Math.max(0, realTodayBalance);
      if (bal > 0) {
        sumDailyBal += bal;
        activeDays++;
      }
    }

    const avgActiveBalance = activeDays > 0 ? sumDailyBal / activeDays : 0;
    const activeMonthFraction = activeDays / daysInMonth;
    const accruedInterest = apy > 0 && activeDays > 0
      ? safeRound(avgActiveBalance * (apy / 100 / 12) * activeMonthFraction, 2)
      : 0;

    // Full-month projected interest for the current month (or historical month if active)
    const endOfMonthDateStr = toLocalISOString(monthEnd > refDay ? refDay : monthEnd);
    const monthEndBalance = dailyBalances.get(endOfMonthDateStr) ?? Math.max(0, realTodayBalance);
    const isBeforeOpen = effectiveOpenStr ? toLocalISOString(monthEnd) < effectiveOpenStr : false;
    const projectedForMonth = !isBeforeOpen && apy > 0
      ? safeRound((monthEndBalance * apy) / 100 / 12, 2)
      : 0;

    const effectiveValue = actualInterest > 0
      ? actualInterest
      : (i === 0 ? projectedForMonth : accruedInterest);

    interestHistory.push({
      name: monthLabel,
      monthKey,
      actual: actualInterest,
      accrued: accruedInterest,
      projected: projectedForMonth,
      value: effectiveValue,
      isProjected: actualInterest === 0,
    });

    // Accumulate YTD figures for months in the current calendar year
    if (monthStart.getFullYear() === refDay.getFullYear()) {
      recordedInterestYTD = safeAdd(recordedInterestYTD, actualInterest);
      accruedInterestYTD = safeAdd(accruedInterestYTD, accruedInterest);
      totalInterestYTD = safeAdd(
        totalInterestYTD,
        actualInterest > 0 ? actualInterest : accruedInterest
      );
    }
  }

  // Build 90-day balance history ending on refDay
  const raw90d: Array<{ date: string; value: number }> = [];
  const d90 = new Date(refDay);
  for (let i = 0; i <= 90; i++) {
    const dStr = toLocalISOString(d90);
    raw90d.push({
      date: dStr,
      value: dailyBalances.get(dStr) ?? 0,
    });
    d90.setDate(d90.getDate() - 1);
  }
  const chronological90d = raw90d.reverse();
  const trendVals = calculateTrendLine(chronological90d, 'value');
  const balanceHistory = chronological90d.map((item, idx) => ({
    ...item,
    trend: trendVals[idx],
  }));

  // Safe 90-day growth index calculation (no division by 1 when starting from 0!)
  const start90dBalance = balanceHistory[0]?.value ?? 0;
  const end90dBalance = balanceHistory[balanceHistory.length - 1]?.value ?? realTodayBalance;
  const start90dDateStr = balanceHistory[0]?.date ?? todayStr;
  let growthIndexPct = 0;
  if (start90dBalance > 0.01) {
    growthIndexPct = safeRound(((end90dBalance - start90dBalance) / start90dBalance) * 100, 1);
  } else if (end90dBalance > 0) {
    const netInflows90d = normalized
      .filter(t => t.dateStr > start90dDateStr && t.dateStr <= todayStr && !isSavingsInterestTransaction(t.tx, allCategories))
      .reduce((s, t) => safeAdd(s, t.amountInAccountCurrency), 0);
    if (netInflows90d > 0.01) {
      growthIndexPct = safeRound(((end90dBalance - netInflows90d) / netInflows90d) * 100, 1);
    } else {
      growthIndexPct = 0;
    }
  }

  const growthIndexLabel = `${growthIndexPct >= 0 ? '+' : ''}${growthIndexPct.toFixed(1)}%`;

  return {
    apy,
    realTodayBalance,
    projectedAnnualInterest,
    projectedMonthlyInterest,
    totalInterestYTD: safeRound(totalInterestYTD, 2),
    recordedInterestYTD: safeRound(recordedInterestYTD, 2),
    actualInterestYTD: safeRound(recordedInterestYTD, 2),
    accruedInterestYTD: safeRound(accruedInterestYTD, 2),
    interestHistory,
    balanceHistory,
    growthIndexPct,
    growthIndexLabel,
    referenceDate: refDay,
  };
}

/**
 * BUG-13 & BUG-07 Fix:
 * Credit Card metrics driven by the card's statement period and normalized to `account.currency`.
 */
export function computeCreditCardAccountMetrics(
  account: Account,
  transactions: Array<Transaction | TxWithMeta>,
  options?: DetailModelOptions
) {
  const ref = options?.referenceDate ?? new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const normalized = normalizeAccountTransactions(transactions, account.currency, options).filter(
    t => t.tx.accountId === account.id
  );

  const realTodayBalance = resolveRealTodayBalance(account, transactions, options);
  const creditLimit = Math.max(0, account.creditLimit || 0);
  const balanceOwed = Math.max(0, safeRound(-realTodayBalance, 2));
  const creditSurplus = Math.max(0, safeRound(realTodayBalance, 2));
  const utilization = creditLimit > 0 ? safeRound((balanceOwed / creditLimit) * 100, 1) : 0;
  const availableCredit = safeRound(Math.max(0, creditLimit - balanceOwed) + creditSurplus, 2);

  // Use configured statement period if statementStartDate is set, else current calendar month
  const activeWindowStart = account.statementStartDate
    ? calculateStatementPeriods(account.statementStartDate, account.paymentDate || 25).current.start
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const activeWindowEnd = account.statementStartDate
    ? calculateStatementPeriods(account.statementStartDate, account.paymentDate || 25).current.end
    : new Date(today.getFullYear(), today.getMonth() + 1, 0);

  let totalSpent = 0;
  let totalPayments = 0;

  for (const { tx, parsedDate, amountInAccountCurrency } of normalized) {
    if (parsedDate >= activeWindowStart && parsedDate <= activeWindowEnd) {
      const absVal = Math.abs(amountInAccountCurrency);
      if (tx.type === 'expense') {
        totalSpent = safeAdd(totalSpent, absVal);
      } else if (tx.type === 'income') {
        const cat = (tx.category || '').toLowerCase();
        if (tx.transferId || cat.includes('payment') || cat.includes('transfer')) {
          totalPayments = safeAdd(totalPayments, absVal);
        } else {
          // Refund / cashback reduces cycle spend
          totalSpent = Math.max(0, safeSubtract(totalSpent, absVal));
        }
      }
    }
  }

  const spendingHistory: Array<{ name: string; value: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = d.toLocaleString('en-US', { month: 'short' });
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    let monthTotal = 0;
    for (const { tx, parsedDate, amountInAccountCurrency } of normalized) {
      if (parsedDate >= startOfMonth && parsedDate <= endOfMonth) {
        const absVal = Math.abs(amountInAccountCurrency);
        if (tx.type === 'expense') {
          monthTotal = safeAdd(monthTotal, absVal);
        } else if (tx.type === 'income') {
          const cat = (tx.category || '').toLowerCase();
          if (!(tx.transferId || cat.includes('payment') || cat.includes('transfer'))) {
            monthTotal = Math.max(0, safeSubtract(monthTotal, absVal));
          }
        }
      }
    }
    spendingHistory.push({ name: monthKey, value: safeRound(monthTotal, 2) });
  }

  return {
    realTodayBalance,
    balanceOwed,
    creditSurplus,
    creditBalance: creditSurplus,
    creditLimit,
    utilization,
    availableCredit,
    totalSpent: safeRound(totalSpent, 2),
    totalPayments: safeRound(totalPayments, 2),
    spendingHistory,
    activeWindowStart,
    activeWindowEnd,
  };
}

/**
 * BUG-12 & BUG-07 Fix:
 * Physical Cash metrics using a true rolling 30-day window for burn rate & runway, in `account.currency`.
 */
export function computeCashAccountMetrics(
  account: Account,
  transactions: Array<Transaction | TxWithMeta>,
  options?: DetailModelOptions
) {
  const ref = options?.referenceDate ?? new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const rolling30dStart = new Date(today);
  rolling30dStart.setDate(rolling30dStart.getDate() - 29);

  const normalized = normalizeAccountTransactions(transactions, account.currency, options).filter(
    t => t.tx.accountId === account.id
  );
  const realTodayBalance = resolveRealTodayBalance(account, transactions, options);

  let mtdInflow = 0;
  let mtdOutflow = 0;
  let rolling30dInflow = 0;
  let rolling30dOutflow = 0;
  let lastReplenishment: Date | null = null;

  for (const { tx, parsedDate, amountInAccountCurrency } of normalized) {
    if (parsedDate > today) continue;
    const absVal = Math.abs(amountInAccountCurrency);
    const isInflow = tx.type === 'income' || amountInAccountCurrency > 0;

    if (isInflow && (tx.transferId || tx.category === 'Transfer' || tx.type === 'income')) {
      if (!lastReplenishment || parsedDate > lastReplenishment) {
        lastReplenishment = parsedDate;
      }
    }

    if (parsedDate >= startOfMonth) {
      if (isInflow) mtdInflow = safeAdd(mtdInflow, absVal);
      else mtdOutflow = safeAdd(mtdOutflow, absVal);
    }

    if (parsedDate >= rolling30dStart) {
      if (isInflow) rolling30dInflow = safeAdd(rolling30dInflow, absVal);
      else rolling30dOutflow = safeAdd(rolling30dOutflow, absVal);
    }
  }

  const avgDailySpend = safeDivide(rolling30dOutflow, 30);
  const runwayDays = avgDailySpend > 0 && realTodayBalance > 0
    ? Math.floor(realTodayBalance / avgDailySpend)
    : null;

  let burnRateMessage = 'Stagnant reserve';
  if (realTodayBalance <= 0) {
    burnRateMessage = 'Reserve depleted';
  } else if (avgDailySpend <= 0) {
    burnRateMessage = 'Stagnant reserve';
  } else if (runwayDays !== null) {
    if (runwayDays < 3) burnRateMessage = 'Low reserve warning';
    else if (runwayDays > 60) burnRateMessage = 'Robust liquidity';
    else burnRateMessage = `~${runwayDays} days runway`;
  }

  const flowData: Array<{ name: string; income: number; expense: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = d.toLocaleString('en-US', { month: 'short' });
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    let inc = 0;
    let exp = 0;
    for (const { parsedDate, amountInAccountCurrency } of normalized) {
      if (parsedDate >= mStart && parsedDate <= mEnd && parsedDate <= today) {
        const absVal = Math.abs(amountInAccountCurrency);
        if (amountInAccountCurrency > 0) inc = safeAdd(inc, absVal);
        else exp = safeAdd(exp, absVal);
      }
    }
    flowData.push({ name: monthKey, income: safeRound(inc, 2), expense: safeRound(exp, 2) });
  }

  return {
    realTodayBalance,
    totalInflow: safeRound(mtdInflow, 2),
    totalOutflow: safeRound(mtdOutflow, 2),
    netChange: safeRound(safeSubtract(mtdInflow, mtdOutflow), 2),
    rolling30dInflow: safeRound(rolling30dInflow, 2),
    rolling30dOutflow: safeRound(rolling30dOutflow, 2),
    avgDailySpend: safeRound(avgDailySpend, 2),
    runwayDays,
    burnRateMessage,
    lastReplenishment,
    flowData,
  };
}

/**
 * BUG-10 Fix:
 * Property metrics that prioritize explicit `account.purchasePrice` over refinanced loan principal.
 */
export function computePropertyAccountMetrics(
  account: Account,
  allAccounts: Account[],
  transactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {},
  options?: DetailModelOptions
) {
  const linkedLoan = findLinkedLoanForAsset(account, allAccounts);
  const currentMarketValue = account.balance;

  let outstandingLoanBalance = 0;
  let principalPaidViaLoan = 0;

  if (linkedLoan) {
    const loanStats = resolveLoanOutstanding(linkedLoan, transactions, loanPaymentOverrides, {
      showBalanceAdjustments: options?.showBalanceAdjustments,
      targetCurrency: account.currency,
      rates: options?.rates,
    });
    outstandingLoanBalance = loanStats.outstandingPrincipal;
    principalPaidViaLoan = loanStats.paidPrincipal;
  }

  const downPaymentInPropCurrency = linkedLoan?.downPayment
    ? convertCurrency(linkedLoan.downPayment, linkedLoan.currency, account.currency, options?.rates)
    : 0;
  const loanPrincipalInPropCurrency = linkedLoan?.principalAmount
    ? convertCurrency(linkedLoan.principalAmount, linkedLoan.currency, account.currency, options?.rates)
    : 0;

  // Always prefer explicit `account.purchasePrice` so refinancing doesn't fabricate appreciation!
  const purchasePrice =
    account.purchasePrice !== undefined && account.purchasePrice > 0
      ? account.purchasePrice
      : linkedLoan
        ? safeRound(safeAdd(loanPrincipalInPropCurrency, downPaymentInPropCurrency), 2)
        : 0;

  const marketEquity = safeRound(safeSubtract(currentMarketValue, outstandingLoanBalance), 2);
  const investedEquity = linkedLoan
    ? safeRound(safeAdd(principalPaidViaLoan, downPaymentInPropCurrency), 2)
    : (account.principalOwned || 0);
  const appreciation = purchasePrice > 0 ? safeRound(safeSubtract(currentMarketValue, purchasePrice), 2) : 0;
  const appreciationPercent = purchasePrice > 0 ? safeRound((appreciation / purchasePrice) * 100, 2) : 0;
  const ownershipPercent = currentMarketValue > 0
    ? Math.min(100, Math.max(0, safeRound((marketEquity / currentMarketValue) * 100, 1)))
    : 0;

  const ltv = currentMarketValue > 0
    ? safeRound((outstandingLoanBalance / currentMarketValue) * 100, 1)
    : 0;
  const pricePerSqMeter = account.propertySize && account.propertySize > 0
    ? safeRound(currentMarketValue / account.propertySize, 2)
    : 0;

  return {
    linkedLoan,
    currentMarketValue,
    currentValue: currentMarketValue,
    outstandingLoanBalance,
    loanBalance: outstandingLoanBalance,
    principalPaidViaLoan,
    purchasePrice,
    marketEquity,
    netEquity: marketEquity,
    investedEquity,
    appreciation,
    appreciationPercent,
    ownershipPercent,
    ltv,
    pricePerSqMeter,
  };
}

/**
 * BUG-10 & BUG-11 Fix:
 * Vehicle metrics with bidirectional loan lookup, `account.currentMileage` fallback,
 * baseline start-of-lease odometer subtraction, and clamped lease progress.
 */
export function computeVehicleAccountMetrics(
  account: Account,
  allAccounts: Account[],
  transactions: Transaction[],
  loanPaymentOverrides: LoanPaymentOverrides = {},
  options?: DetailModelOptions
) {
  const ref = options?.referenceDate ?? new Date();
  const linkedLoan = findLinkedLoanForAsset(account, allAccounts);

  let outstandingLoanBalance = 0;
  if (linkedLoan) {
    const loanStats = resolveLoanOutstanding(linkedLoan, transactions, loanPaymentOverrides, {
      showBalanceAdjustments: options?.showBalanceAdjustments,
      targetCurrency: account.currency,
      rates: options?.rates ?? options?.conversionRates,
    });
    outstandingLoanBalance = loanStats.outstandingPrincipal;
  }

  const sortedMileageLogs: MileageLog[] = [...(account.mileageLogs || [])].sort(
    (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  const currentMileage = sortedMileageLogs.length > 0
    ? sortedMileageLogs[sortedMileageLogs.length - 1].reading
    : 0;

  let leaseStats: {
    progress: number;
    timeProgress: number;
    mileageStatus: 'Over Budget' | 'Under Budget' | 'On Track';
    mileageDiff: number;
    daysRemaining: number;
    projectedMileage: number;
    proRataExpectedMileage: number;
    totalAllowance: number;
    totalMileageAllowance: number;
    remainingMileage: number;
    distanceDrivenInLease: number;
    drivenMileage: number;
    leaseDrivenMileage: number;
  } | null = null;

  if (account.ownership === 'Leased' && account.leaseStartDate && account.leaseEndDate) {
    const start = parseLocalDate(account.leaseStartDate);
    const end = parseLocalDate(account.leaseEndDate);
    const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const rawElapsedDays = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = Math.min(totalDays, Math.max(0, rawElapsedDays));
    const progress = Math.min(100, Math.max(0, safeRound((elapsedDays / totalDays) * 100, 1)));

    // Find baseline odometer at lease start if logs exist on/before leaseStartDate
    const logsOnOrBeforeStart = sortedMileageLogs.filter(
      log => parseLocalDate(log.date).getTime() <= start.getTime()
    );
    const baselineOdometer = logsOnOrBeforeStart.length > 0
      ? logsOnOrBeforeStart[logsOnOrBeforeStart.length - 1].reading
      : 0;
    const distanceDrivenInLease = Math.max(0, currentMileage - baselineOdometer);

    let mileageStatus: 'Over Budget' | 'Under Budget' | 'On Track' = 'On Track';
    let mileageDiff = 0;
    let projectedMileage = distanceDrivenInLease;
    let totalAllowance = 0;
    let proRataExpectedMileage = 0;

    if (account.annualMileageAllowance && account.annualMileageAllowance > 0) {
      const dailyAllowance = account.annualMileageAllowance / 365;
      const expectedMileage = elapsedDays * dailyAllowance;
      proRataExpectedMileage = Math.round(expectedMileage);
      const years = totalDays / 365;
      totalAllowance = Math.round(account.annualMileageAllowance * years);
      mileageDiff = Math.round(distanceDrivenInLease - expectedMileage);
      projectedMileage = elapsedDays > 0
        ? Math.round(baselineOdometer + (distanceDrivenInLease / elapsedDays) * totalDays)
        : currentMileage;

      if (mileageDiff > 1000) mileageStatus = 'Over Budget';
      else if (mileageDiff < -1000) mileageStatus = 'Under Budget';
    }

    leaseStats = {
      progress,
      timeProgress: progress,
      mileageStatus,
      mileageDiff,
      daysRemaining: Math.max(0, Math.ceil(totalDays - rawElapsedDays)),
      projectedMileage,
      proRataExpectedMileage,
      totalAllowance,
      totalMileageAllowance: totalAllowance,
      remainingMileage: Math.max(0, totalAllowance - distanceDrivenInLease),
      distanceDrivenInLease,
      drivenMileage: distanceDrivenInLease,
      leaseDrivenMileage: distanceDrivenInLease,
    };
  }

  const netEquity = safeRound(safeSubtract(account.balance, outstandingLoanBalance), 2);
  const purchasePrice = account.purchasePrice || 0;
  const depreciation = purchasePrice > 0 ? safeRound(safeSubtract(account.balance, purchasePrice), 2) : 0;

  return {
    linkedLoan,
    outstandingLoanBalance,
    sortedMileageLogs,
    currentMileage,
    leaseStats,
    netEquity,
    ownedStats: {
      currentValue: account.balance,
      purchasePrice,
      depreciation,
      netEquity,
      loanBalance: outstandingLoanBalance,
    },
  };
}

/**
 * BUG-14 Fix:
 * Pension metrics calculated consistently in `account.currency` with both cumulative return and CAGR.
 */
export function computePensionAccountMetrics(
  account: Account,
  transactions: Array<Transaction | TxWithMeta>,
  options?: DetailModelOptions
) {
  const ref = options?.referenceDate ?? new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const currentYear = today.getFullYear();
  const retirementYear = account.expectedRetirementYear || currentYear + 20;
  const yearsToRetirement = Math.max(0, retirementYear - currentYear);

  const normalized = normalizeAccountTransactions(transactions, account.currency, options).filter(
    t => t.tx.accountId === account.id
  );
  const realTodayBalance = resolveRealTodayBalance(account, transactions, options);

  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  let contributions = 0;
  let contributionsLast12Months = 0;

  for (const { tx, parsedDate, amountInAccountCurrency } of normalized) {
    if (parsedDate > today) continue;
    const cat = (tx.category || '').toLowerCase();
    const absVal = Math.abs(amountInAccountCurrency);
    if (tx.type === 'income') {
      if (!tx.isMarketAdjustment && !cat.includes('interest') && !cat.includes('dividend')) {
        contributions = safeAdd(contributions, absVal);
        if (parsedDate >= oneYearAgo) {
          contributionsLast12Months = safeAdd(contributionsLast12Months, absVal);
        }
      }
    } else if (tx.type === 'expense') {
      if (!tx.isMarketAdjustment) {
        contributions = Math.max(0, safeSubtract(contributions, absVal));
      }
    }
  }

  // If no contribution transactions were logged, treat initial balance or principal as base contribution if positive
  const effectiveContributions = contributions > 0 ? contributions : Math.max(0, realTodayBalance);
  const totalGrowth = safeRound(safeSubtract(realTodayBalance, contributions), 2);
  const cumulativeReturn = contributions > 0 ? totalGrowth / contributions : 0;

  // Compute years active for true annualized return (CAGR)
  const earliestDate = account.openingDate
    ? parseLocalDate(account.openingDate)
    : normalized.length > 0
      ? normalized.reduce((min, t) => (t.parsedDate < min ? t.parsedDate : min), normalized[0].parsedDate)
      : today;
  const yearsActive = Math.max(1 / 12, (today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const annualizedReturn =
    contributions > 0 && realTodayBalance > 0
      ? yearsActive >= 1
        ? Math.pow(realTodayBalance / contributions, 1 / yearsActive) - 1
        : cumulativeReturn
      : (account.apy ? account.apy / 100 : 0);

  const monthlyContributionAvg = safeRound(contributionsLast12Months / 12, 2);

  // Build historical + projected fortune trajectory in `account.currency`
  const openingDate = account.openingDate
    ? parseLocalDate(account.openingDate)
    : new Date(today.getFullYear() - 5, today.getMonth(), 1);
  const monthsToBackfill = Math.max(
    1,
    (today.getFullYear() - openingDate.getFullYear()) * 12 + (today.getMonth() - openingDate.getMonth()) + 1
  );
  const monthlyDataMap = new Map<string, { balance: number; contributions: number }>();

  let currentBal = realTodayBalance;
  let currentContrib = effectiveContributions;

  for (let i = 0; i < monthsToBackfill; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = toLocalISOYearMonth(d);
    monthlyDataMap.set(key, {
      balance: safeRound(Math.max(0, currentBal), 2),
      contributions: safeRound(Math.max(0, currentContrib), 2),
    });

    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const txsInMonth = normalized.filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth && t.parsedDate <= today);
    for (const { tx, amountInAccountCurrency } of txsInMonth) {
      currentBal = safeSubtract(currentBal, amountInAccountCurrency);
      const cat = (tx.category || '').toLowerCase();
      if (tx.type === 'income' && !tx.isMarketAdjustment && !cat.includes('interest') && !cat.includes('dividend')) {
        currentContrib = safeSubtract(currentContrib, Math.abs(amountInAccountCurrency));
      } else if (tx.type === 'expense' && !tx.isMarketAdjustment) {
        currentContrib = safeAdd(currentContrib, Math.abs(amountInAccountCurrency));
      }
    }
  }

  const historicalData = Array.from(monthlyDataMap.entries())
    .map(([date, data]) => ({ date, ...data, type: 'History' as const }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const projectionData: Array<{ date: string; balance: number; contributions: number; type: 'Projection' }> = [];
  let projBalance = realTodayBalance;
  let projContrib = effectiveContributions;
  const monthlyRate = (account.apy || 5) / 100 / 12;
  const monthsToRetire = yearsToRetirement * 12;
  const step = Math.max(1, Math.floor(monthsToRetire / 24));
  const dProj = new Date(today.getFullYear(), today.getMonth(), 1);

  for (let i = 1; i <= monthsToRetire; i++) {
    projBalance = (projBalance + monthlyContributionAvg) * (1 + monthlyRate);
    projContrib = projContrib + monthlyContributionAvg;
    dProj.setMonth(dProj.getMonth() + 1);
    if (i % step === 0 || i === monthsToRetire) {
      projectionData.push({
        date: toLocalISOYearMonth(dProj),
        balance: safeRound(projBalance, 2),
        contributions: safeRound(projContrib, 2),
        type: 'Projection',
      });
    }
  }

  const chartData = [...historicalData, ...projectionData];
  const projectedValueAtRetirement = chartData.length > 0 ? chartData[chartData.length - 1].balance : realTodayBalance;
  const monthlyHistory = historicalData.slice(-12).map((h) => ({
    name: h.date.slice(5),
    date: h.date,
    balance: h.balance,
    contributions: h.contributions,
  }));

  return {
    realTodayBalance,
    retirementYear,
    yearsToRetirement,
    totalContributions: safeRound(contributions, 2),
    totalInvested: safeRound(contributions, 2),
    totalGrowth: safeRound(totalGrowth, 2),
    totalReturn: safeRound(totalGrowth, 2),
    cumulativeReturn,
    annualizedReturn,
    annualizedReturnPct: safeRound(annualizedReturn * 100, 2),
    monthlyContributionAvg,
    monthlyHistory,
    chartData,
    projectedValueAtRetirement: safeRound(projectedValueAtRetirement, 2),
  };
}

/**
 * BUG-15 & BUG-07 Fix:
 * Spare Change metrics in `account.currency` that separate true micro round-up captures
 * from manual lump-sum top-ups so `avgRoundUp` and `biggestRoundUp` stay accurate.
 */
export function isRoundUpCapture(tx: Transaction, amountInAccountCurrency: number): boolean {
  if (tx.type !== 'income' || tx.isMarketAdjustment || tx.isBalanceAdjustment) return false;
  const txAny = tx as { isRoundUp?: boolean; roundUpTransactionId?: string };
  if (txAny.roundUpTransactionId || txAny.isRoundUp) return true;
  const text = `${tx.description || ''} ${tx.merchant || ''} ${tx.category || ''}`.toLowerCase();
  if (/round[- ]?up|spare change|micro[- ]?sav/i.test(text)) return true;
  // Micro-transfers <= 10 units are treated as round-ups when not explicitly tagged as salary/manual deposit
  return Math.abs(amountInAccountCurrency) > 0 && Math.abs(amountInAccountCurrency) <= 10;
}

export function computeSpareChangeAccountMetrics(
  account: Account,
  allAccountsOrTransactions: Account[] | Array<Transaction | TxWithMeta>,
  maybeTransactions?: Array<Transaction | TxWithMeta> | DetailModelOptions,
  maybeOptions?: DetailModelOptions
) {
  const hasAccountsArg =
    Array.isArray(allAccountsOrTransactions) &&
    Array.isArray(maybeTransactions);
  const allAccounts = hasAccountsArg ? (allAccountsOrTransactions as Account[]) : [];
  const transactions = hasAccountsArg
    ? (maybeTransactions as Array<Transaction | TxWithMeta>)
    : (allAccountsOrTransactions as Array<Transaction | TxWithMeta>);
  const options = hasAccountsArg
    ? maybeOptions
    : (maybeTransactions as DetailModelOptions | undefined);

  const sourceAccount = allAccounts.find(a => a.id === account.linkedAccountId);
  const ref = options?.referenceDate ?? new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const normalized = normalizeAccountTransactions(transactions, account.currency, options).filter(
    t => t.tx.accountId === account.id
  );
  const realTodayBalance = resolveRealTodayBalance(account, transactions, options);

  let totalRoundUpSaved = 0;
  let totalRoundUps = 0;
  let thisMonthSaved = 0;
  let biggestRoundUp = 0;
  let manualDeposits = 0;

  for (const { tx, parsedDate, amountInAccountCurrency } of normalized) {
    if (parsedDate > today) continue;
    const absVal = Math.abs(amountInAccountCurrency);
    if (tx.type === 'income' && !tx.isMarketAdjustment) {
      if (isRoundUpCapture(tx, amountInAccountCurrency)) {
        totalRoundUpSaved = safeAdd(totalRoundUpSaved, absVal);
        totalRoundUps++;
        if (absVal > biggestRoundUp) biggestRoundUp = absVal;
        if (parsedDate >= currentMonthStart) {
          thisMonthSaved = safeAdd(thisMonthSaved, absVal);
        }
      } else {
        manualDeposits = safeAdd(manualDeposits, absVal);
      }
    }
  }

  const totalSaved = totalRoundUpSaved > 0 ? totalRoundUpSaved : Math.max(0, realTodayBalance);
  const avgRoundUp = totalRoundUps > 0 ? safeRound(totalRoundUpSaved / totalRoundUps, 2) : 0;

  const monthlyData: Array<{ name: string; value: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = d.toLocaleString('en-US', { month: 'short' });
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    const monthTotal = normalized
      .filter(
        t =>
          t.parsedDate >= startOfMonth &&
          t.parsedDate <= endOfMonth &&
          t.parsedDate <= today &&
          isRoundUpCapture(t.tx, t.amountInAccountCurrency)
      )
      .reduce((sum, t) => safeAdd(sum, Math.abs(t.amountInAccountCurrency)), 0);

    monthlyData.push({ name: monthKey, value: safeRound(monthTotal, 2) });
  }

  const coffeesSaved = Math.floor(Math.max(0, totalSaved) / 4.5);

  return {
    sourceAccount,
    realTodayBalance,
    totalSaved: safeRound(totalSaved, 2),
    totalRoundUpSaved: safeRound(totalRoundUpSaved, 2),
    manualDeposits: safeRound(manualDeposits, 2),
    manualDepositsTotal: safeRound(manualDeposits, 2),
    totalRoundUps,
    avgRoundUp,
    thisMonthSaved: safeRound(thisMonthSaved, 2),
    biggestRoundUp: safeRound(biggestRoundUp, 2),
    monthlyData,
    coffeesSaved,
  };
}

export type AccountArchetypeId =
  | 'operating'
  | 'yield_pot'
  | 'credit_card'
  | 'loan'
  | 'physical_asset';

/**
 * Maps any Account to one of the 5 Unified Detail Archetypes in `/accounts-new/:id`.
 */
export function resolveAccountArchetype(account: Account): AccountArchetypeId {
  if (account.type === 'Savings') return 'yield_pot';
  if (
    account.type === 'Investment' &&
    (account.subType === 'Pension Fund' || account.subType === 'Spare Change')
  ) {
    return 'yield_pot';
  }
  if (account.type === 'Credit Card') return 'credit_card';
  if (account.type === 'Loan' || account.type === 'Lending') return 'loan';
  if (account.type === 'Property' || account.type === 'Vehicle') return 'physical_asset';
  return 'operating';
}

export interface OperatingAccountOptions extends DetailModelOptions {
  recurringTransactions?: RecurringTransaction[];
  recurringTransactionOverrides?: RecurringTransactionOverride[];
  billsAndPayments?: BillPayment[];
  financialGoals?: FinancialGoal[];
  loanPaymentOverrides?: LoanPaymentOverrides;
  allCategories?: Category[];
}

/**
 * Archetype 1: Operating & Liquid Accounts (`Checking`, `Cash`, `Other Assets`/`Liabilities`)
 * Computes `realTodayBalance`, 14-day `safeToSpend`, 30-day `lowestBalanceForecast`,
 * `avgMonthlySpend`, 6-month `inflowOutflow6m`, `topCategories90d`, and `upcomingPayments`.
 */
export function computeOperatingAccountMetrics(
  account: Account,
  allAccounts: Account[],
  allTransactions: Transaction[],
  options: OperatingAccountOptions = {}
) {
  const ref = options.referenceDate ?? new Date();
  const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const effectiveRates = options.rates ?? options.conversionRates;

  const accountTxs = allTransactions.filter((tx) => tx.accountId === account.id);
  const normalized = normalizeAccountTransactions(accountTxs, account.currency, options);
  const realTodayBalance = resolveRealTodayBalance(account, accountTxs, options);

  // 3-month average monthly spend
  const threeMonthsAgo = new Date(todayStart.getFullYear(), todayStart.getMonth() - 3, 1);
  const endOfLastMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 0);
  const totalSpend3Months = normalized
    .filter((t) => t.parsedDate >= threeMonthsAgo && t.parsedDate <= endOfLastMonth)
    .reduce((sum, { tx, amountInAccountCurrency }) => {
      if (amountInAccountCurrency < 0 && !tx.transferId) {
        return safeAdd(sum, Math.abs(amountInAccountCurrency));
      }
      return sum;
    }, 0);
  const avgMonthlySpend = safeRound(totalSpend3Months / 3, 2);

  // Full-context synthetic recurring items (BUG-06 fix)
  const contextAccounts = allAccounts.length > 0 ? allAccounts : [account];
  const syntheticLoans = generateSyntheticLoanPayments(
    contextAccounts,
    allTransactions,
    options.loanPaymentOverrides || {}
  );
  const syntheticCC = generateSyntheticCreditCardPayments(contextAccounts, allTransactions);
  const syntheticProperty = generateSyntheticPropertyTransactions(contextAccounts);
  const allRecurringItems = [
    ...(options.recurringTransactions || []),
    ...syntheticLoans,
    ...syntheticCC,
    ...syntheticProperty,
  ];

  // Upcoming 14-day obligations & Safe-to-Spend buffer
  const horizon14d = new Date(todayStart);
  horizon14d.setDate(horizon14d.getDate() + 14);
  let upcomingOutflows14d = 0;
  const upcomingPayments: Array<{
    date: string;
    description: string;
    amount: number;
    isRecurring: boolean;
  }> = [];

  const relevantRecurring = allRecurringItems.filter(
    (rt) => rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer')
  );
  relevantRecurring.forEach((rt) => {
    let nextDue = parseLocalDate(rt.nextDueDate);
    const interval = rt.frequencyInterval || 1;
    let safety = 0;
    while (nextDue <= horizon14d && safety < 60) {
      safety++;
      if (nextDue >= todayStart) {
        const amtNative = safeRound(
          convertCurrency(Math.abs(rt.amount), rt.currency, account.currency, effectiveRates),
          2
        );
        upcomingOutflows14d = safeAdd(upcomingOutflows14d, amtNative);
        upcomingPayments.push({
          date: toLocalISOString(nextDue),
          description: rt.description,
          amount: amtNative,
          isRecurring: true,
        });
      }
      const d = new Date(nextDue);
      if (rt.frequency === 'monthly') d.setMonth(d.getMonth() + interval);
      else if (rt.frequency === 'weekly') d.setDate(d.getDate() + 7 * interval);
      else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
      else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
      nextDue = d;
    }
  });

  (options.billsAndPayments || []).forEach((bill) => {
    if (bill.accountId === account.id && bill.status === 'unpaid' && bill.type === 'payment') {
      const due = parseLocalDate(bill.dueDate);
      if (due >= todayStart && due <= horizon14d) {
        const amtNative = safeRound(Math.abs(bill.amount), 2);
        upcomingOutflows14d = safeAdd(upcomingOutflows14d, amtNative);
        upcomingPayments.push({
          date: bill.dueDate,
          description: bill.description,
          amount: amtNative,
          isRecurring: false,
        });
      }
    }
  });

  upcomingPayments.sort((a, b) => a.date.localeCompare(b.date));
  const safeToSpend = safeRound(safeSubtract(realTodayBalance, upcomingOutflows14d), 2);

  // 30-day lowest balance forecast in account.currency
  const forecastEndDate = new Date(todayStart);
  forecastEndDate.setDate(forecastEndDate.getDate() + 30);
  const accountForForecast = { ...account, balance: realTodayBalance };
  const { lowestPoint } = generateBalanceForecast(
    [accountForForecast],
    allRecurringItems,
    options.financialGoals || [],
    options.billsAndPayments || [],
    forecastEndDate,
    options.recurringTransactionOverrides || []
  );
  const lowestBalanceForecast = safeRound(
    convertCurrency(lowestPoint.value, 'EUR', account.currency, effectiveRates),
    2
  );

  // 6-month inflow vs outflow bar chart
  const inflowOutflow6m: Array<{ name: string; income: number; expense: number; net: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(todayStart.getFullYear(), todayStart.getMonth() - i, 1);
    const name = d.toLocaleString('en-US', { month: 'short' });
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    let inc = 0;
    let exp = 0;
    for (const { parsedDate, amountInAccountCurrency } of normalized) {
      if (parsedDate >= mStart && parsedDate <= mEnd && parsedDate <= todayStart) {
        if (amountInAccountCurrency >= 0) inc = safeAdd(inc, amountInAccountCurrency);
        else exp = safeAdd(exp, Math.abs(amountInAccountCurrency));
      }
    }
    inflowOutflow6m.push({
      name,
      income: safeRound(inc, 2),
      expense: safeRound(exp, 2),
      net: safeRound(safeSubtract(inc, exp), 2),
    });
  }

  // Top spending categories in last 90 days
  const cutoff90d = new Date(todayStart);
  cutoff90d.setDate(cutoff90d.getDate() - 90);
  const flatCats = flattenCategories(options.allCategories || []);
  const catSums = new Map<string, number>();
  let total90dOutflow = 0;
  for (const { tx, parsedDate, amountInAccountCurrency } of normalized) {
    if (
      parsedDate >= cutoff90d &&
      parsedDate <= todayStart &&
      amountInAccountCurrency < 0 &&
      !tx.transferId
    ) {
      const matched = flatCats.find(
        (c) => c.id === tx.category || c.name.toLowerCase() === (tx.category || '').toLowerCase()
      );
      const label = matched ? matched.name : tx.category || 'Uncategorized';
      const absAmt = Math.abs(amountInAccountCurrency);
      catSums.set(label, safeAdd(catSums.get(label) || 0, absAmt));
      total90dOutflow = safeAdd(total90dOutflow, absAmt);
    }
  }
  const topCategories90d = Array.from(catSums.entries())
    .map(([category, amount]) => ({
      category,
      amount: safeRound(amount, 2),
      pct: total90dOutflow > 0 ? safeRound((amount / total90dOutflow) * 100, 1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const linkedCreditCards = contextAccounts.filter(
    (acc) => acc.type === 'Credit Card' && acc.settlementAccountId === account.id
  );
  const linkedGoals = (options.financialGoals || []).filter(
    (g) => g.paymentAccountId === account.id
  );

  return {
    realTodayBalance,
    safeToSpend,
    upcomingOutflows14d: safeRound(upcomingOutflows14d, 2),
    lowestBalanceForecast,
    avgMonthlySpend,
    inflowOutflow6m,
    topCategories90d,
    upcomingPayments: upcomingPayments.slice(0, 8),
    linkedCreditCards,
    linkedGoals,
  };
}

/**
 * Interactive Compounding Estimator for `Savings` and `Pension Fund` accounts.
 */
export function computeCompoundingProjection(params: {
  initialBalance: number;
  monthlyDeposit: number;
  apy: number;
  years: number;
}): {
  finalBalance: number;
  totalPrincipal: number;
  totalInterestEarned: number;
  yearlySeries: Array<{ year: number; principal: number; interest: number; balance: number }>;
} {
  const initial = Math.max(0, params.initialBalance || 0);
  const monthly = Math.max(0, params.monthlyDeposit || 0);
  const apy = Math.max(0, params.apy || 0);
  const years = Math.max(1, Math.min(50, Math.round(params.years || 1)));
  const monthlyRate = apy / 100 / 12;

  let balance = initial;
  let principal = initial;
  const yearlySeries: Array<{ year: number; principal: number; interest: number; balance: number }> = [];

  for (let y = 1; y <= years; y++) {
    for (let m = 1; m <= 12; m++) {
      balance = (balance + monthly) * (1 + monthlyRate);
      principal += monthly;
    }
    const balRounded = safeRound(balance, 2);
    const prinRounded = safeRound(principal, 2);
    yearlySeries.push({
      year: y,
      principal: prinRounded,
      interest: safeRound(Math.max(0, balRounded - prinRounded), 2),
      balance: balRounded,
    });
  }

  const finalBalance = yearlySeries[yearlySeries.length - 1]?.balance ?? initial;
  const totalPrincipal = yearlySeries[yearlySeries.length - 1]?.principal ?? initial;
  const totalInterestEarned = safeRound(Math.max(0, finalBalance - totalPrincipal), 2);

  return {
    finalBalance,
    totalPrincipal,
    totalInterestEarned,
    yearlySeries,
  };
}

/**
 * Archetype 4: Loan & Lending Account Metrics + Early-Payoff Simulator.
 */
export function computeLoanAccountMetrics(
  account: Account,
  allAccounts: Account[],
  transactions: Transaction[],
  loanPaymentOverrides: Record<number, Partial<ScheduledPayment>> = {},
  options: DetailModelOptions = {}
) {
  const showAdjustments = options.showBalanceAdjustments ?? true;
  const effectiveRates = options.rates ?? options.conversionRates;
  const filteredTxs = transactions.filter((tx) => showAdjustments || !tx.isBalanceAdjustment);

  const schedule = generateAmortizationSchedule(account, filteredTxs, loanPaymentOverrides);
  const totalScheduledPrincipal = schedule.reduce((sum, p) => safeAdd(sum, p.principal), 0);
  const totalScheduledInterest = schedule.reduce((sum, p) => safeAdd(sum, p.interest), 0);

  const totalPaidPrincipal = schedule.reduce(
    (acc, p) => (p.status === 'Paid' ? safeAdd(acc, p.principal) : acc),
    0
  );
  const totalPaidInterest = schedule.reduce(
    (acc, p) => (p.status === 'Paid' ? safeAdd(acc, p.interest) : acc),
    0
  );

  const outstandingPrincipal = Math.max(0, safeSubtract(totalScheduledPrincipal, totalPaidPrincipal));
  const outstandingInterest = Math.max(0, safeSubtract(totalScheduledInterest, totalPaidInterest));
  const totalOutstanding = safeRound(safeAdd(outstandingPrincipal, outstandingInterest), 2);

  const totalPrincipal =
    account.principalAmount || account.totalAmount || totalScheduledPrincipal || 1;
  const progressPercent = Math.min(
    100,
    Math.max(0, safeRound((totalPaidPrincipal / totalPrincipal) * 100, 1))
  );

  const linkedAsset = findLinkedAssetForLoan(account, allAccounts);
  let ltv = 0;
  let marketEquity = 0;
  if (linkedAsset) {
    const assetValue = convertCurrency(
      linkedAsset.balance,
      linkedAsset.currency,
      account.currency,
      effectiveRates
    );
    if (assetValue > 0) ltv = safeRound((outstandingPrincipal / assetValue) * 100, 1);
    marketEquity = safeRound(safeSubtract(assetValue, outstandingPrincipal), 2);
  }

  const equity = safeRound(safeAdd(totalPaidPrincipal, account.downPayment || 0), 2);
  const nextScheduledPayment =
    schedule.find((p) => p.status === 'Overdue' || p.status === 'Upcoming') || null;
  const lastActivePayment =
    [...schedule].reverse().find((p) => p.totalPayment > 0) || schedule[schedule.length - 1];
  const payoffDate = lastActivePayment ? parseLocalDate(lastActivePayment.date) : null;

  return {
    schedule,
    totalPrincipal: safeRound(totalPrincipal, 2),
    totalPaidPrincipal: safeRound(totalPaidPrincipal, 2),
    totalPaidInterest: safeRound(totalPaidInterest, 2),
    outstandingPrincipal: safeRound(outstandingPrincipal, 2),
    outstandingInterest: safeRound(outstandingInterest, 2),
    totalOutstanding,
    progressPercent,
    linkedAsset,
    ltv,
    equity,
    marketEquity,
    nextScheduledPayment,
    payoffDate,
  };
}

/**
 * Simulates the effect of adding an extra recurring monthly principal payment and/or
 * a one-time lump sum on a Loan's payoff date and total lifetime interest.
 */
export function simulateExtraLoanPayment(
  account: Account,
  transactions: Transaction[],
  loanPaymentOverrides: Record<number, Partial<ScheduledPayment>> = {},
  extraMonthlyPayment = 0,
  oneTimeLumpSum = 0
): {
  monthsSaved: number;
  interestSaved: number;
  newPayoffDate: string | null;
  baselineTotalInterest: number;
  acceleratedTotalInterest: number;
} {
  const baseSchedule = generateAmortizationSchedule(account, transactions, loanPaymentOverrides);
  const baseActive = baseSchedule.filter((p) => p.totalPayment > 0);
  const baselineTotalInterest = safeRound(
    baseActive.reduce((s, p) => safeAdd(s, p.interest), 0),
    2
  );

  if (extraMonthlyPayment <= 0 && oneTimeLumpSum <= 0) {
    return {
      monthsSaved: 0,
      interestSaved: 0,
      newPayoffDate: baseActive[baseActive.length - 1]?.date ?? null,
      baselineTotalInterest,
      acceleratedTotalInterest: baselineTotalInterest,
    };
  }

  const simOverrides: Record<number, Partial<ScheduledPayment>> = { ...loanPaymentOverrides };
  let appliedLump = false;
  for (const p of baseSchedule) {
    if (p.status === 'Upcoming' || p.status === 'Overdue') {
      const existingExtra = simOverrides[p.paymentNumber]?.extraPrincipal || 0;
      const lumpForThisPeriod = !appliedLump ? Math.max(0, oneTimeLumpSum) : 0;
      appliedLump = true;
      simOverrides[p.paymentNumber] = {
        ...simOverrides[p.paymentNumber],
        extraPrincipal: safeAdd(existingExtra, safeAdd(Math.max(0, extraMonthlyPayment), lumpForThisPeriod)),
      };
    }
  }

  const accelSchedule = generateAmortizationSchedule(account, transactions, simOverrides);
  const accelActive = accelSchedule.filter((p) => p.totalPayment > 0);
  const acceleratedTotalInterest = safeRound(
    accelActive.reduce((s, p) => safeAdd(s, p.interest), 0),
    2
  );

  return {
    monthsSaved: Math.max(0, baseActive.length - accelActive.length),
    interestSaved: safeRound(Math.max(0, baselineTotalInterest - acceleratedTotalInterest), 2),
    newPayoffDate: accelActive[accelActive.length - 1]?.date ?? null,
    baselineTotalInterest,
    acceleratedTotalInterest,
  };
}

/**
 * Archetype 5: Property Operating Cashflow & Rental Yield Calculator.
 */
export function computePropertyHoldingCashflow(account: Account) {
  const annualize = (amount: number | undefined, freq: Account['rentalIncomeFrequency'], defaultFreq: 'monthly' | 'yearly') => {
    const val = Math.max(0, amount || 0);
    if (val === 0) return 0;
    const f = freq || defaultFreq;
    if (f === 'monthly') return safeRound(val * 12, 2);
    if (f === 'weekly') return safeRound(val * 52, 2);
    if (f === 'biweekly') return safeRound(val * 26, 2);
    if (f === 'daily') return safeRound(val * 365, 2);
    return safeRound(val, 2);
  };

  const annualRentalIncome = annualize(account.rentalIncomeAmount, account.rentalIncomeFrequency, 'monthly');
  const monthlyRentalIncome = safeRound(annualRentalIncome / 12, 2);

  const annualPropertyTax = Math.max(0, account.propertyTaxAmount || 0);
  const annualInsurance = annualize(account.insuranceAmount, account.insuranceFrequency, 'yearly');
  const annualHoa = annualize(account.hoaFeeAmount, account.hoaFeeFrequency, 'monthly');
  const monthlyHoa = safeRound(annualHoa / 12, 2);

  const totalAnnualExpenses = safeRound(
    safeAdd(annualPropertyTax, safeAdd(annualInsurance, annualHoa)),
    2
  );
  const totalMonthlyExpenses = safeRound(totalAnnualExpenses / 12, 2);

  const annualNetCashflow = safeRound(safeSubtract(annualRentalIncome, totalAnnualExpenses), 2);
  const monthlyNetCashflow = safeRound(annualNetCashflow / 12, 2);

  const marketValue = Math.max(0, account.balance || 0);
  const grossRentalYieldPct =
    marketValue > 0 ? safeRound((annualRentalIncome / marketValue) * 100, 2) : 0;
  const netRentalYieldPct =
    marketValue > 0 ? safeRound((annualNetCashflow / marketValue) * 100, 2) : 0;

  return {
    monthlyRentalIncome,
    annualRentalIncome,
    annualPropertyTax,
    annualInsurance,
    monthlyHoa,
    annualHoa,
    totalAnnualExpenses,
    totalMonthlyExpenses,
    annualNetCashflow,
    monthlyNetCashflow,
    grossRentalYieldPct,
    netRentalYieldPct,
  };
}

/**
 * Archetype 5: Vehicle Total Cost of Ownership (TCO / km) Calculator.
 */
export function computeVehicleTcoMetrics(
  account: Account,
  transactions: Array<Transaction | TxWithMeta>,
  options: DetailModelOptions = {}
) {
  const normalized = normalizeAccountTransactions(transactions, account.currency, options).filter(
    (t) => t.tx.accountId === account.id
  );

  let fuelSpend = 0;
  let maintenanceSpend = 0;
  let insuranceTaxSpend = 0;
  let otherOperatingSpend = 0;

  for (const { tx, amountInAccountCurrency } of normalized) {
    if (amountInAccountCurrency >= 0 || tx.transferId || tx.isBalanceAdjustment) continue;
    const absAmt = Math.abs(amountInAccountCurrency);
    const text = `${tx.category || ''} ${tx.description || ''} ${tx.merchant || ''}`.toLowerCase();
    if (/fuel|gas|petrol|diesel|charging|supercharger|ev/i.test(text)) {
      fuelSpend = safeAdd(fuelSpend, absAmt);
    } else if (/service|repair|maintenance|tire|tyre|oil|mechanic|inspection/i.test(text)) {
      maintenanceSpend = safeAdd(maintenanceSpend, absAmt);
    } else if (/insurance|tax|registration|toll|parking/i.test(text)) {
      insuranceTaxSpend = safeAdd(insuranceTaxSpend, absAmt);
    } else {
      otherOperatingSpend = safeAdd(otherOperatingSpend, absAmt);
    }
  }

  const totalOperatingSpend = safeRound(
    safeAdd(safeAdd(fuelSpend, maintenanceSpend), safeAdd(insuranceTaxSpend, otherOperatingSpend)),
    2
  );
  const depreciation =
    account.purchasePrice && account.purchasePrice > account.balance
      ? safeRound(safeSubtract(account.purchasePrice, account.balance), 2)
      : 0;
  const totalCostOfOwnership = safeRound(safeAdd(totalOperatingSpend, depreciation), 2);

  const sortedLogs = [...(account.mileageLogs || [])].sort(
    (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );
  const distanceTrackedKm =
    sortedLogs.length >= 2
      ? Math.max(0, sortedLogs[sortedLogs.length - 1].reading - sortedLogs[0].reading)
      : sortedLogs.length === 1
        ? sortedLogs[0].reading
        : 0;

  const costPerKm =
    distanceTrackedKm > 0 ? safeRound(totalCostOfOwnership / distanceTrackedKm, 2) : null;

  return {
    fuelSpend: safeRound(fuelSpend, 2),
    maintenanceSpend: safeRound(maintenanceSpend, 2),
    insuranceTaxSpend: safeRound(insuranceTaxSpend, 2),
    otherOperatingSpend: safeRound(otherOperatingSpend, 2),
    totalOperatingSpend,
    depreciation,
    totalCostOfOwnership,
    distanceTrackedKm,
    costPerKm,
  };
}

export interface EnrichedMileageLog extends MileageLog {
  deltaKm: number;
  daysElapsed: number;
  kmPerDay: number;
}

/**
 * Enriches odometer mileage logs with distance deltas, elapsed days, and daily pace (km/day).
 */
export function enrichMileageLogsWithDeltas(mileageLogs: MileageLog[] = []): EnrichedMileageLog[] {
  const sorted = [...mileageLogs].sort(
    (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );
  return sorted.map((log, idx) => {
    if (idx === 0) {
      return { ...log, deltaKm: 0, daysElapsed: 0, kmPerDay: 0 };
    }
    const prev = sorted[idx - 1];
    const deltaKm = Math.max(0, log.reading - prev.reading);
    const msDiff = parseLocalDate(log.date).getTime() - parseLocalDate(prev.date).getTime();
    const daysElapsed = Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));
    const kmPerDay = safeRound(deltaKm / daysElapsed, 1);
    return { ...log, deltaKm, daysElapsed, kmPerDay };
  });
}

/**
 * Validates that a new or edited mileage log reading is monotonically non-decreasing
 * relative to adjacent chronological entries.
 */
export function validateMileageReading(
  mileageLogs: MileageLog[],
  date: string,
  reading: number,
  editingId?: string
): { valid: boolean; error?: string } {
  if (!date || Number.isNaN(reading) || reading < 0) {
    return { valid: false, error: 'Please enter a valid date and non-negative odometer reading.' };
  }
  const targetTime = parseLocalDate(date).getTime();
  const others = mileageLogs.filter((l) => l.id !== editingId);
  for (const log of others) {
    const t = parseLocalDate(log.date).getTime();
    if (t < targetTime && reading < log.reading) {
      return {
        valid: false,
        error: `Odometer reading (${reading.toLocaleString()} km) cannot be lower than earlier reading of ${log.reading.toLocaleString()} km on ${log.date}.`,
      };
    }
    if (t > targetTime && reading > log.reading) {
      return {
        valid: false,
        error: `Odometer reading (${reading.toLocaleString()} km) cannot exceed later reading of ${log.reading.toLocaleString()} km on ${log.date}.`,
      };
    }
  }
  return { valid: true };
}

/**
 * Parses CSV/TSV or whitespace-separated lines (`YYYY-MM-DD, reading`) for Batch Mileage Import.
 */
export function parseBatchMileageInput(
  rawText: string
): Array<{ date: string; reading: number; valid: boolean; rawLine: string }> {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((rawLine) => {
      const dateMatch = rawLine.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      const date = dateMatch ? dateMatch[1] : '';
      const remainder = date ? rawLine.replace(date, '').trim() : rawLine;
      // Match first number token (allowing thousand-separator commas like 13,500 or decimals)
      const numMatch = remainder.match(/(?:^|[,;\t\s])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\b/);
      const reading = numMatch ? Number(numMatch[1].replace(/,/g, '')) : NaN;
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(reading) && reading >= 0;
      return { date, reading: valid ? reading : 0, valid, rawLine };
    });
}

/**
 * 3-of-4 Loan Auto-Calculator for `AccountFormSheet`:
 * Given any 3 of `{ principal, annualRate, durationMonths, monthlyPayment }`, solves the 4th.
 */
export function solveLoanParameter(
  params: {
    principal?: number;
    annualRate?: number;
    durationMonths?: number;
    monthlyPayment?: number;
  },
  targetField: 'monthlyPayment' | 'principal' | 'durationMonths' | 'annualRate'
): number | null {
  const P = params.principal ?? 0;
  const r = (params.annualRate ?? 0) / 100 / 12;
  const n = params.durationMonths ?? 0;
  const M = params.monthlyPayment ?? 0;

  if (targetField === 'monthlyPayment') {
    if (P <= 0 || n <= 0) return null;
    if (r <= 0) return safeRound(P / n, 2);
    const factor = Math.pow(1 + r, n);
    return safeRound((P * (r * factor)) / (factor - 1), 2);
  }

  if (targetField === 'principal') {
    if (M <= 0 || n <= 0) return null;
    if (r <= 0) return safeRound(M * n, 2);
    const factor = Math.pow(1 + r, n);
    return safeRound((M * (factor - 1)) / (r * factor), 2);
  }

  if (targetField === 'durationMonths') {
    if (P <= 0 || M <= 0) return null;
    if (r <= 0) return Math.ceil(P / M);
    if (M <= P * r) return null; // Payment doesn't cover monthly interest
    const months = Math.log(M / (M - P * r)) / Math.log(1 + r);
    return Math.max(1, Math.round(months));
  }

  if (targetField === 'annualRate') {
    if (P <= 0 || n <= 0 || M <= 0) return null;
    if (M * n <= P) return 0;
    // Binary search for monthly rate r in [0, 1]
    let low = 0;
    let high = 1;
    for (let iter = 0; iter < 60; iter++) {
      const mid = (low + high) / 2;
      const factor = Math.pow(1 + mid, n);
      const estM = (P * (mid * factor)) / (factor - 1);
      if (estM > M) high = mid;
      else low = mid;
    }
    return safeRound(((low + high) / 2) * 12 * 100, 2);
  }

  return null;
}

