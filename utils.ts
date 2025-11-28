

import { Currency, Account, Transaction, Duration, Category, FinancialGoal, RecurringTransaction, BillPayment, ScheduledPayment, RecurringTransactionOverride, LoanPaymentOverrides, Budget } from './types';
import { ASSET_TYPES, DEBT_TYPES, LIQUID_ACCOUNT_TYPES } from './constants';
import { v4 as uuidv4 } from 'uuid';

const symbolMap: { [key in Currency]: string } = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'BTC': 'BTC',
  'RON': 'lei'
};

export function formatCurrency(amount: number, currency: Currency, options?: { showPlusSign?: boolean }): string {
  if (currency === 'BTC') {
    return `${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })} BTC`;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let sign = '';
  if (amount < 0) {
    sign = '-';
  } else if (options?.showPlusSign && amount > 0) {
    sign = '+';
  }

  const symbol = symbolMap[currency] || currency;

  return `${sign}${symbol} ${formatter.format(Math.abs(amount))}`;
}

export const CONVERSION_RATES: { [key in Currency]?: number } = {
    'USD': 0.93, 'GBP': 1.18, 'BTC': 65000, 'EUR': 1, 'RON': 0.20
};

export const convertToEur = (balance: number, currency: Currency): number => {
    return balance * (CONVERSION_RATES[currency] || 1);
}

export const getPreferredTimeZone = (fallback: string = 'UTC'): string => {
    if (typeof window === 'undefined') return fallback;

    // Use the cached timezone set by the app whenever possible so reads are cheap.
    const cachedTz = (window as any).__crystalTimezone;
    if (typeof cachedTz === 'string' && cachedTz.trim().length > 0) return cachedTz;

    try {
        const stored = window.localStorage.getItem('financialData');
        if (stored) {
            const parsed = JSON.parse(stored);
            const prefTz = parsed?.preferences?.timezone;
            if (typeof prefTz === 'string' && prefTz.trim().length > 0) return prefTz;
        }
    } catch (error) {
        console.warn('Unable to read preferred timezone from storage', error);
    }

    return fallback;
};

export const parseDateAsUTC = (dateString: string, timeZone?: string): Date => {
    if (!dateString) return new Date(0);

    const tz = getPreferredTimeZone(timeZone);
    const parts = dateString.split('-').map(Number);
    const baseDate = (!isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2]))
        ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
        : new Date(dateString);

    if (isNaN(baseDate.getTime())) return new Date(0);

    // Align the parsed date to midnight in the user's preferred timezone so that
    // grouping by day and range comparisons remain consistent even when the
    // preferred timezone is not UTC.
    const asLocale = new Date(baseDate.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = asLocale.getTime() - baseDate.getTime();
    return new Date(baseDate.getTime() - offsetMs);
};

export const formatDateKey = (date: Date, timeZone?: string): string => {
    const tz = getPreferredTimeZone(timeZone);
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
};

export function calculateAccountTotals(accounts: Account[]) {
    const totalAssets = accounts
      .filter(acc => ASSET_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    
    const totalDebt = accounts
      .filter(acc => DEBT_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + Math.abs(convertToEur(acc.balance, acc.currency)), 0);
      
    const creditCardDebt = accounts
      .filter(acc => acc.type === 'Credit Card')
      .reduce((sum, acc) => sum + Math.abs(convertToEur(acc.balance, acc.currency)), 0);

    // FIX: Calculate liquidCash to ensure return type compatibility with calculateFinancialHealth
    const liquidCash = accounts
      .filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);

    // Debts reduce net worth, so subtract the total debt (which we treat as a positive number)
    const netWorth = totalAssets - totalDebt;

    return { totalAssets, totalDebt, netWorth, creditCardDebt, liquidCash };
}

export function getDateRange(duration: Duration, allTransactions: Transaction[] = []): { start: Date, end: Date } {
    const tz = getPreferredTimeZone();
    const now = new Date();
    const nowInPreferredTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const end = new Date(Date.UTC(nowInPreferredTz.getUTCFullYear(), nowInPreferredTz.getUTCMonth(), nowInPreferredTz.getUTCDate(), 23, 59, 59, 999));
    const start = new Date(Date.UTC(nowInPreferredTz.getUTCFullYear(), nowInPreferredTz.getUTCMonth(), nowInPreferredTz.getUTCDate(), 0, 0, 0, 0));

    switch (duration) {
        case 'TODAY':
            break;
        case 'WTD':
            const dayOfWeek = start.getUTCDay(); // Sunday - 0, Monday - 1, ...
            const diff = start.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when week starts on Monday
            start.setUTCDate(diff);
            break;
        case 'MTD':
            start.setUTCDate(1);
            break;
        case '30D':
            start.setUTCDate(start.getUTCDate() - 29);
            break;
        case '60D':
            start.setUTCDate(start.getUTCDate() - 59);
            break;
        case '90D':
            start.setUTCDate(start.getUTCDate() - 89);
            break;
        case '6M':
            start.setUTCMonth(start.getUTCMonth() - 6);
            break;
        case 'YTD':
            start.setUTCMonth(0, 1);
            break;
        case '1Y':
            start.setUTCFullYear(start.getUTCFullYear() - 1);
            break;
        case 'ALL':
            if (allTransactions.length > 0) {
                const firstDateString = allTransactions.reduce((earliest, tx) => {
                    return tx.date < earliest ? tx.date : earliest;
                }, allTransactions[0].date);
                start.setTime(parseDateAsUTC(firstDateString).getTime());
            }
            break;
    }
    return { start, end };
}

export function fuzzySearch(needle: string, haystack: string): boolean {
  if (!needle) return true;
  if (!haystack) return false;

  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  
  let needleIndex = 0;
  for (let i = 0; i < h.length; i++) {
    if (h[i] === n[needleIndex]) {
      needleIndex++;
    }
    if (needleIndex === n.length) {
      return true;
    }
  }
  return false;
}

export const flattenCategories = (categories: Category[], parentId?: string): Omit<Category, 'subCategories'>[] => {
    let flatList: Omit<Category, 'subCategories'>[] = [];
    for (const cat of categories) {
        const { subCategories, ...rest } = cat;
        flatList.push({ ...rest, parentId });
        if (subCategories && subCategories.length > 0) {
            flatList = [...flatList, ...flattenCategories(subCategories, cat.id)];
        }
    }
    return flatList;
};

export const arrayToCSV = (data: any[]): string => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            const value = typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
            const escaped = ('' + value).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

export const downloadCSV = (csvString: string, filename: string) => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

export function calculateStatementPeriods(statementStartDay: number, paymentDueDay: number) {
    const today = new Date();
    const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    let currentStatementStart: Date;
    const todayDay = todayStart.getUTCDate();
    const todayMonth = todayStart.getUTCMonth();
    const todayYear = todayStart.getUTCFullYear();

    if (todayDay >= statementStartDay) {
        currentStatementStart = new Date(Date.UTC(todayYear, todayMonth, statementStartDay));
    } else {
        currentStatementStart = new Date(Date.UTC(todayYear, todayMonth - 1, statementStartDay));
    }

    // Previous Period
    const previousStatementStart = new Date(currentStatementStart);
    previousStatementStart.setUTCMonth(previousStatementStart.getUTCMonth() - 1);
    const previousStatementEnd = new Date(previousStatementStart);
    previousStatementEnd.setUTCMonth(previousStatementEnd.getUTCMonth() + 1);
    previousStatementEnd.setUTCDate(previousStatementEnd.getUTCDate() - 1);
    let previousPaymentDueDate = new Date(Date.UTC(previousStatementEnd.getUTCFullYear(), previousStatementEnd.getUTCMonth(), paymentDueDay));
    if (previousPaymentDueDate <= previousStatementEnd) {
        previousPaymentDueDate.setUTCMonth(previousPaymentDueDate.getUTCMonth() + 1);
    }

    // Current Period
    const currentStatementEnd = new Date(currentStatementStart);
    currentStatementEnd.setUTCMonth(currentStatementEnd.getUTCMonth() + 1);
    currentStatementEnd.setUTCDate(currentStatementEnd.getUTCDate() - 1);
    let currentPaymentDueDate = new Date(Date.UTC(currentStatementEnd.getUTCFullYear(), currentStatementEnd.getUTCMonth(), paymentDueDay));
    if (currentPaymentDueDate <= currentStatementEnd) {
        currentPaymentDueDate.setUTCMonth(currentPaymentDueDate.getUTCMonth() + 1);
    }

    // Future Period
    const futureStatementStart = new Date(currentStatementStart);
    futureStatementStart.setUTCMonth(futureStatementStart.getUTCMonth() + 1);
    const futureStatementEnd = new Date(futureStatementStart);
    futureStatementEnd.setUTCMonth(futureStatementEnd.getUTCMonth() + 1);
    futureStatementEnd.setUTCDate(futureStatementEnd.getUTCDate() - 1);
    let futurePaymentDueDate = new Date(Date.UTC(futureStatementEnd.getUTCFullYear(), futureStatementEnd.getUTCMonth(), paymentDueDay));
    if (futurePaymentDueDate <= futureStatementEnd) {
        futurePaymentDueDate.setUTCMonth(futurePaymentDueDate.getUTCMonth() + 1);
    }
    
    return {
        previous: { start: previousStatementStart, end: previousStatementEnd, paymentDue: previousPaymentDueDate },
        current: { start: currentStatementStart, end: currentStatementEnd, paymentDue: currentPaymentDueDate },
        future: { start: futureStatementStart, end: futureStatementEnd, paymentDue: futurePaymentDueDate }
    };
}

export function getCreditCardStatementDetails(
    creditCardAccount: Account,
    statementStart: Date,
    statementEnd: Date,
    allTransactions: Transaction[]
): { statementBalance: number; amountPaid: number } {
    if (creditCardAccount.type !== 'Credit Card') {
        return { statementBalance: 0, amountPaid: 0 };
    }

    const transactionsInPeriod = allTransactions.filter(tx => {
        if (tx.accountId !== creditCardAccount.id) return false;
        const txDate = parseDateAsUTC(tx.date);
        return txDate >= statementStart && txDate <= statementEnd;
    });

    let statementBalance = 0;
    let amountPaid = 0;

    for (const tx of transactionsInPeriod) {
        // Check if this is a payment from the linked settlement account
        if (
            tx.type === 'income' &&
            tx.transferId &&
            creditCardAccount.settlementAccountId
        ) {
            const counterpart = allTransactions.find(
                t => t.transferId === tx.transferId && t.id !== tx.id
            );

            // If the counterpart is from the settlement account, it's a payment.
            // We should not include it in the current statement balance.
            if (counterpart && counterpart.accountId === creditCardAccount.settlementAccountId) {
                amountPaid += tx.amount;
                continue; // Skip this transaction
            }
        }
        
        // All other transactions (expenses, refunds, non-settlement income) affect the statement balance.
        statementBalance += tx.amount;
    }

    return { statementBalance, amountPaid };
}


export function generateSyntheticLoanPayments(accounts: Account[], transactions: Transaction[], loanPaymentOverrides: LoanPaymentOverrides = {}): RecurringTransaction[] {
    const syntheticPayments: RecurringTransaction[] = [];

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const loanAccounts = accounts.filter(
        (acc) =>
            (acc.type === 'Loan' || acc.type === 'Lending') &&
            acc.monthlyPayment &&
            acc.monthlyPayment > 0 &&
            acc.linkedAccountId
    );

    for (const account of loanAccounts) {
        const schedule = generateAmortizationSchedule(account, transactions, loanPaymentOverrides[account.id] || {});
        const isLending = account.type === 'Lending';

        schedule.forEach(payment => {
            const paymentDate = parseDateAsUTC(payment.date);
            if (payment.status === 'Paid' || paymentDate < todayUTC) {
                return;
            }

            syntheticPayments.push({
                id: `loan-pmt-${account.id}-${payment.paymentNumber}`,
                accountId: isLending ? account.id : account.linkedAccountId!,
                toAccountId: isLending ? account.linkedAccountId! : account.id,
                description: `${isLending ? 'Lending Repayment' : 'Loan Payment'} #${payment.paymentNumber}: ${account.name}`,
                amount: payment.totalPayment,
                type: 'transfer',
                currency: account.currency,
                frequency: 'monthly',
                startDate: payment.date,
                nextDueDate: payment.date,
                endDate: payment.date,
                dueDateOfMonth: parseDateAsUTC(payment.date).getUTCDate(),
                weekendAdjustment: 'after',
                isSynthetic: true,
            });
        });
    }
    return syntheticPayments;
}

export function generateSyntheticCreditCardPayments(accounts: Account[], allTransactions: Transaction[]): RecurringTransaction[] {
    const syntheticPayments: RecurringTransaction[] = [];
    const configuredCreditCards = accounts.filter(
        (acc) =>
            acc.type === 'Credit Card' &&
            acc.statementStartDate &&
            acc.paymentDate &&
            acc.settlementAccountId
    );

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    for (const account of configuredCreditCards) {
        const periods = calculateStatementPeriods(account.statementStartDate!, account.paymentDate!);

        // Handle the last (previous) statement if it's unpaid.
        const { statementBalance: prevStatementBalance, amountPaid: prevAmountPaid } = getCreditCardStatementDetails(
            account,
            periods.previous.start,
            periods.previous.end,
            allTransactions
        );

        const unpaidBalance = Math.abs(prevStatementBalance) - prevAmountPaid;

        if (unpaidBalance > 0.005) { // Use a small epsilon to avoid floating point issues
            const dueDateStr = periods.previous.paymentDue.toISOString().split('T')[0];
            const syntheticRT: RecurringTransaction = {
                id: `cc-pmt-${account.id}-${dueDateStr}`,
                accountId: account.settlementAccountId!,
                toAccountId: account.id,
                description: `Payment for ${account.name} (Statement ending ${periods.previous.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })})`,
                amount: unpaidBalance,
                type: 'transfer',
                currency: account.currency,
                frequency: 'monthly', // Semantically it's a monthly event, even if we generate one-off
                startDate: dueDateStr,
                endDate: dueDateStr,
                nextDueDate: dueDateStr,
                weekendAdjustment: 'after',
                isSynthetic: true,
            };
            syntheticPayments.push(syntheticRT);
        }
        
        // Handle upcoming (current and future) statements for forecasting
        const statementDetails = [
            { period: periods.current, type: 'Current' },
            { period: periods.future, type: 'Next' }
        ];

        for (const detail of statementDetails) {
            // Only create synthetic payments for FUTURE due dates
            if (detail.period.paymentDue >= todayUTC) {
                const { statementBalance } = getCreditCardStatementDetails(
                    account,
                    detail.period.start,
                    detail.period.end,
                    allTransactions
                );

                if (statementBalance < 0) {
                    const paymentAmount = Math.abs(statementBalance);
                    const dueDateStr = detail.period.paymentDue.toISOString().split('T')[0];

                    // Don't duplicate if we already created an unpaid entry for the same date
                    if (!syntheticPayments.some(p => p.id === `cc-pmt-${account.id}-${dueDateStr}`)) {
                        const syntheticRT: RecurringTransaction = {
                            id: `cc-pmt-${account.id}-${dueDateStr}`,
                            accountId: account.settlementAccountId!,
                            toAccountId: account.id,
                            description: `Payment for ${account.name} (${detail.type} Statement)`,
                            amount: paymentAmount,
                            type: 'transfer',
                            currency: account.currency,
                            frequency: 'monthly',
                            startDate: dueDateStr,
                            endDate: dueDateStr,
                            nextDueDate: dueDateStr,
                            weekendAdjustment: 'after',
                            isSynthetic: true,
                        };
                        syntheticPayments.push(syntheticRT);
                    }
                }
            }
        }
    }
    return syntheticPayments;
}

export function generateSyntheticPropertyTransactions(accounts: Account[]): RecurringTransaction[] {
    const syntheticItems: RecurringTransaction[] = [];
    const properties = accounts.filter(acc => acc.type === 'Property');
    const today = new Date().toISOString().split('T')[0];

    properties.forEach(property => {
        // 1. Property Taxes (Annual)
        if (property.propertyTaxAmount && property.propertyTaxDate) {
            const taxDate = parseDateAsUTC(property.propertyTaxDate);
             syntheticItems.push({
                id: `prop-tax-${property.id}`,
                accountId: 'external', // Implicitly external if not linked, or handled during forecasting mapping if account is missing
                description: `Property Tax: ${property.name}`,
                amount: property.propertyTaxAmount,
                type: 'expense',
                category: 'Housing',
                currency: property.currency,
                frequency: 'yearly',
                startDate: property.propertyTaxDate,
                nextDueDate: property.propertyTaxDate,
                dueDateOfMonth: taxDate.getUTCDate(),
                weekendAdjustment: 'before',
                isSynthetic: true,
            });
        }

        // 2. Home Insurance
        if (property.insuranceAmount && property.insuranceFrequency && property.insurancePaymentDate) {
             const insDate = parseDateAsUTC(property.insurancePaymentDate);
             syntheticItems.push({
                id: `prop-ins-${property.id}`,
                accountId: 'external',
                description: `Home Insurance: ${property.name} (${property.insuranceProvider || 'Provider'})`,
                amount: property.insuranceAmount,
                type: 'expense',
                category: 'Housing',
                currency: property.currency,
                frequency: property.insuranceFrequency,
                startDate: property.insurancePaymentDate,
                nextDueDate: property.insurancePaymentDate,
                dueDateOfMonth: insDate.getUTCDate(),
                weekendAdjustment: 'before',
                isSynthetic: true,
            });
        }

        // 3. HOA Fees
        if (property.hoaFeeAmount && property.hoaFeeFrequency) {
             syntheticItems.push({
                id: `prop-hoa-${property.id}`,
                accountId: 'external',
                description: `HOA/Syndic Fees: ${property.name}`,
                amount: property.hoaFeeAmount,
                type: 'expense',
                category: 'Housing',
                currency: property.currency,
                frequency: property.hoaFeeFrequency,
                startDate: today, // Assume starts now if not specified
                nextDueDate: today,
                dueDateOfMonth: new Date().getDate(),
                weekendAdjustment: 'before',
                isSynthetic: true,
            });
        }

        // 4. Rental Income
        if (property.isRental && property.rentalIncomeAmount && property.rentalIncomeFrequency) {
             syntheticItems.push({
                id: `prop-rent-${property.id}`,
                accountId: property.linkedAccountId || property.id, // Deposit into linked account or property itself (tracking value)
                description: `Rental Income: ${property.name}`,
                amount: property.rentalIncomeAmount,
                type: 'income',
                category: 'Income',
                currency: property.currency,
                frequency: property.rentalIncomeFrequency,
                startDate: today,
                nextDueDate: today,
                dueDateOfMonth: 1, // Default to 1st of month
                weekendAdjustment: 'after',
                isSynthetic: true,
            });
        }
    });

    return syntheticItems;
}

export function generateBalanceForecast(
    accounts: Account[],
    recurringTransactions: RecurringTransaction[],
    financialGoals: FinancialGoal[],
    billsAndPayments: BillPayment[],
    forecastEndDate: Date,
    recurringTransactionOverrides: RecurringTransactionOverride[] = []
): {
    chartData: ({ date: string; value: number; dailySummary: { description: string; amount: number; type: string }[]; [key: string]: any })[];
    tableData: {
        id: string;
        date: string;
        accountName: string;
        description: string;
        amount: number;
        balance: number;
        type: 'Recurring' | 'Bill/Payment' | 'Financial Goal';
        isGoal: boolean;
        originalItem: RecurringTransaction | BillPayment | FinancialGoal;
    }[];
    lowestPoint: { value: number; date: string };
} {
    const accountIds = new Set(accounts.map(a => a.id));
    const today = new Date().toISOString().split('T')[0];

    if (accounts.length === 0) {
        return { chartData: [], tableData: [], lowestPoint: { value: 0, date: today } };
    }

    const accountMap = new Map(accounts.map(a => [a.id, a.name]));
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Optimization: Create a map for overrides for O(1) lookup
    const overrideMap = new Map<string, RecurringTransactionOverride>();
    recurringTransactionOverrides.forEach(o => {
        overrideMap.set(`${o.recurringTransactionId}-${o.originalDate}`, o);
    });

    type ForecastEvent = {
        date: string;
        amount: number;
        currency: Currency;
        description: string;
        accountName: string;
        accountId?: string;
        type: 'Recurring' | 'Bill/Payment' | 'Financial Goal';
        isGoal: boolean;
        originalItem: RecurringTransaction | BillPayment | FinancialGoal;
    };
    
    const dailyEvents = new Map<string, ForecastEvent[]>();

    const addEvent = (date: string, event: Omit<ForecastEvent, 'date'>) => {
        if (!dailyEvents.has(date)) {
            dailyEvents.set(date, []);
        }
        dailyEvents.get(date)!.push({ date, ...event });
    };

    recurringTransactions.forEach(rt => {
        let nextDate = parseDateAsUTC(rt.nextDueDate);
        const endDateUTC = rt.endDate ? parseDateAsUTC(rt.endDate) : null;
        const startDateUTC = parseDateAsUTC(rt.startDate);

        while (nextDate < startDate && (!endDateUTC || nextDate < endDateUTC)) {
            // This logic fast-forwards past-due occurrences to catch up to the present day for the forecast
            const interval = rt.frequencyInterval || 1;
            switch(rt.frequency) {
                case 'daily': nextDate.setUTCDate(nextDate.getUTCDate() + interval); break;
                case 'weekly': nextDate.setUTCDate(nextDate.getUTCDate() + 7 * interval); break;
                case 'monthly': {
                    const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                    nextDate.setUTCMonth(nextDate.getUTCMonth() + interval, 1);
                    const lastDay = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
                    nextDate.setUTCDate(Math.min(d, lastDay));
                    break;
                }
                case 'yearly': {
                     const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                     const m = startDateUTC.getUTCMonth();
                     nextDate.setUTCFullYear(nextDate.getUTCFullYear() + interval);
                     const lastDay = new Date(Date.UTC(nextDate.getUTCFullYear(), m + 1, 0)).getUTCDate();
                     nextDate.setUTCMonth(m, Math.min(d, lastDay));
                     break;
                }
            }
        }
        
        while (nextDate <= forecastEndDate && (!endDateUTC || nextDate <= endDateUTC)) {
            const dateStr = nextDate.toISOString().split('T')[0];
            // Use Map lookup instead of .find()
            const override = overrideMap.get(`${rt.id}-${dateStr}`);

            if (override?.isSkipped) {
                // No event added, just advance to the next occurrence
            } else {
                const effectiveDate = override?.date || dateStr;
                let amount = override?.amount !== undefined ? override.amount : (rt.type === 'expense' ? -rt.amount : rt.amount);
                let accountName = 'N/A';

                if (rt.type === 'transfer') {
                    const fromSelected = accountIds.has(rt.accountId);
                    const toSelected = rt.toAccountId ? accountIds.has(rt.toAccountId) : false;
                    
                    if (fromSelected && toSelected) {
                        // Internal transfer within selected accounts: net zero on Total, but individual balances change
                         addEvent(effectiveDate, { 
                             amount: -(override?.amount !== undefined ? override.amount : rt.amount), 
                             currency: rt.currency, 
                             description: `Transfer to ${accountMap.get(rt.toAccountId!) || 'External'}`, 
                             accountName: accountMap.get(rt.accountId) || 'Unknown',
                             accountId: rt.accountId,
                             type: 'Recurring', 
                             isGoal: false,
                             originalItem: rt
                        });
                        addEvent(effectiveDate, { 
                             amount: (override?.amount !== undefined ? override.amount : rt.amount), 
                             currency: rt.currency, 
                             description: `Transfer from ${accountMap.get(rt.accountId) || 'External'}`, 
                             accountName: accountMap.get(rt.toAccountId!) || 'Unknown',
                             accountId: rt.toAccountId,
                             type: 'Recurring', 
                             isGoal: false,
                             originalItem: rt
                        });
                    } else if (fromSelected) {
                        // Outflow from selected
                        accountName = `${accountMap.get(rt.accountId) || 'Unknown'} → External`;
                        amount = -(override?.amount !== undefined ? override.amount : rt.amount);
                        addEvent(effectiveDate, { amount, currency: rt.currency, description: override?.description || rt.description, accountName, accountId: rt.accountId, type: 'Recurring', isGoal: false, originalItem: rt });
                    } else if (toSelected) {
                        // Inflow to selected
                         accountName = `External → ${accountMap.get(rt.toAccountId!) || 'Unknown'}`;
                         amount = override?.amount !== undefined ? override.amount : rt.amount;
                         addEvent(effectiveDate, { amount, currency: rt.currency, description: override?.description || rt.description, accountName, accountId: rt.toAccountId, type: 'Recurring', isGoal: false, originalItem: rt });
                    }
                } else {
                    accountName = accountMap.get(rt.accountId) || 'Unknown';
                    if (accountIds.has(rt.accountId)) {
                         addEvent(effectiveDate, { amount, currency: rt.currency, description: override?.description || rt.description, accountName, accountId: rt.accountId, type: 'Recurring', isGoal: false, originalItem: rt });
                    }
                }
            }

            const interval = rt.frequencyInterval || 1;
             switch(rt.frequency) {
                case 'daily': nextDate.setUTCDate(nextDate.getUTCDate() + interval); break;
                case 'weekly': nextDate.setUTCDate(nextDate.getUTCDate() + 7 * interval); break;
                case 'monthly': {
                    const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                    nextDate.setUTCMonth(nextDate.getUTCMonth() + interval, 1);
                    const lastDay = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
                    nextDate.setUTCDate(Math.min(d, lastDay));
                    break;
                }
                case 'yearly': {
                     const d = rt.dueDateOfMonth || startDateUTC.getUTCDate();
                     const m = startDateUTC.getUTCMonth();
                     nextDate.setUTCFullYear(nextDate.getUTCFullYear() + interval);
                     const lastDay = new Date(Date.UTC(nextDate.getUTCFullYear(), m + 1, 0)).getUTCDate();
                     nextDate.setUTCMonth(m, Math.min(d, lastDay));
                     break;
                }
            }
        }
    });

    financialGoals.forEach(goal => {
        if (goal.paymentAccountId && !accountIds.has(goal.paymentAccountId)) {
            return;
        }

        if (goal.type === 'one-time' && goal.date) {
            const goalDate = parseDateAsUTC(goal.date);
            if (goalDate >= startDate && goalDate <= forecastEndDate) {
                const amount = goal.transactionType === 'expense' ? -(goal.amount - goal.currentAmount) : (goal.amount - goal.currentAmount);
                if (amount === 0) return;
                addEvent(goal.date, { amount, currency: goal.currency, description: goal.name, accountName: goal.paymentAccountId ? accountMap.get(goal.paymentAccountId) || 'Unknown' : 'External', accountId: goal.paymentAccountId, type: 'Financial Goal', isGoal: true, originalItem: goal });
            }
        }
    });

    billsAndPayments.forEach(bill => {
        if (bill.status === 'unpaid') {
            const dueDate = parseDateAsUTC(bill.dueDate);
            if (dueDate >= startDate && dueDate <= forecastEndDate) {
                // If bill has an accountId and it's selected, map it. If not, it might be general (External)
                if (!bill.accountId || accountIds.has(bill.accountId)) {
                     addEvent(bill.dueDate, { amount: bill.amount, currency: bill.currency, description: bill.description, accountName: bill.accountId ? accountMap.get(bill.accountId) || 'Unknown' : 'External', accountId: bill.accountId, type: 'Bill/Payment', isGoal: false, originalItem: bill });
                }
            }
        }
    });

    const chartData: ({ date: string; value: number; dailySummary: { description: string; amount: number; type: string }[]; [key: string]: any })[] = [];
    const tableData: any[] = [];
    
    // Initial Balances
    const currentBalances: Record<string, number> = {};
    let runningTotalBalance = 0;

    accounts.forEach(acc => {
        const balanceEur = convertToEur(acc.balance, acc.currency);
        currentBalances[acc.id] = balanceEur;
        runningTotalBalance += balanceEur;
    });
    
    let currentDate = new Date(startDate.getTime());
    while (currentDate <= forecastEndDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const eventsForDay = dailyEvents.get(dateStr) || [];
        
        // Sort expenses first just for table display logic
        eventsForDay.sort((a,b) => a.amount - b.amount); 
        
        const dailySummary: { description: string; amount: number; type: string }[] = [];

        if (eventsForDay.length > 0) {
            for (const event of eventsForDay) {
                const amountInEur = convertToEur(event.amount, event.currency);
                
                if (event.accountId && currentBalances[event.accountId] !== undefined) {
                    currentBalances[event.accountId] += amountInEur;
                }
                
                if (event.accountId && accountIds.has(event.accountId)) {
                     runningTotalBalance += amountInEur;
                } else if (!event.accountId) {
                     // Unassigned bill/income -> affects total view
                     runningTotalBalance += amountInEur;
                }

                tableData.push({ id: uuidv4(), date: dateStr, ...event, amount: amountInEur, balance: runningTotalBalance });
                dailySummary.push({
                    description: event.description,
                    amount: amountInEur,
                    type: event.type
                });
            }
        }
        
        // Construct data point
        const dataPoint: any = { 
            date: dateStr, 
            value: runningTotalBalance,
            dailySummary: dailySummary
        };
        // Add individual account balances to the data point for the multi-line chart
        Object.entries(currentBalances).forEach(([accId, bal]) => {
            dataPoint[accId] = bal;
        });
        
        chartData.push(dataPoint);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    let lowestPoint = { value: Infinity, date: '' };
    if (chartData.length > 0) {
        lowestPoint = chartData.reduce((min, p) => p.value < min.value ? { value: p.value, date: p.date } : min, { value: chartData[0].value, date: chartData[0].date });
    }

    return { chartData, tableData, lowestPoint };
}


export function generateAmortizationSchedule(
  account: Account,
  transactions: Transaction[],
  overrides: Record<number, Partial<ScheduledPayment>> = {}
): ScheduledPayment[] {
  const { principalAmount, interestRate, duration, loanStartDate, monthlyPayment, paymentDayOfMonth } = account;

  if (!principalAmount || !duration || !loanStartDate || interestRate === undefined) {
    return [];
  }

  const monthlyInterestRate = (interestRate || 0) / 100 / 12;

  const paymentTransactions = transactions.filter(tx => 
    tx.accountId === account.id &&
    tx.transferId &&
    ( (account.type === 'Loan' && tx.type === 'income') || (account.type === 'Lending' && tx.type === 'expense') )
  ).sort((a, b) => parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime());
  
  const paymentMap = new Map<string, Transaction>();
  paymentTransactions.forEach(p => {
    const monthYear = parseDateAsUTC(p.date).toISOString().slice(0, 7);
    paymentMap.set(monthYear, p);
  });

  const schedule: ScheduledPayment[] = [];
  let outstandingBalance = principalAmount; // Use full precision
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate with full precision, without intermediate rounding
  const standardAmortizedPayment = monthlyInterestRate > 0
    ? (principalAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, duration))) / (Math.pow(1 + monthlyInterestRate, duration) - 1)
    : (principalAmount / duration);

  for (let i = 1; i <= duration; i++) {
    const scheduledDate = parseDateAsUTC(loanStartDate);
    scheduledDate.setUTCMonth(scheduledDate.getUTCMonth() + i);
    const monthYearKey = parseDateAsUTC(scheduledDate.toISOString()).toISOString().slice(0, 7);
    
    const realPaymentForPeriod = paymentMap.get(monthYearKey);

    if (paymentDayOfMonth && !realPaymentForPeriod && scheduledDate >= today) {
        const year = parseDateAsUTC(scheduledDate.toISOString()).getUTCFullYear();
        const month = scheduledDate.getUTCMonth();
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        scheduledDate.setUTCDate(Math.min(paymentDayOfMonth, lastDayOfMonth));
    }
    const dateStr = scheduledDate.toISOString().split('T')[0];

    const override = overrides[i];

    let totalPayment: number;
    let principal: number;
    let interest: number;
    let status: ScheduledPayment['status'] = 'Upcoming';
    let transactionId: string | undefined = undefined;
    
    // Calculate interest on the high-precision outstanding balance
    const calculatedInterest = outstandingBalance * monthlyInterestRate;
    
    if (outstandingBalance <= 0 && !realPaymentForPeriod) {
        // Loan is paid off, generate a zero-value entry to maintain schedule length
        totalPayment = 0;
        principal = 0;
        interest = 0;
    } else if (realPaymentForPeriod) {
        status = 'Paid';
        transactionId = realPaymentForPeriod.id;
        
        principal = realPaymentForPeriod.principalAmount || 0;
        interest = realPaymentForPeriod.interestAmount || 0;
        totalPayment = principal + interest;
        
    } else {
        interest = calculatedInterest;

        let basePayment = standardAmortizedPayment;
        if (override?.totalPayment) {
            basePayment = override.totalPayment;
        } else if (monthlyPayment) {
            basePayment = monthlyPayment;
        }

        if (i === duration || outstandingBalance < (basePayment - interest)) {
            // This is the final payment to clear the balance.
            principal = outstandingBalance;
            totalPayment = principal + interest;
        } else {
            totalPayment = basePayment;
            principal = totalPayment - interest;
        }

        if (scheduledDate < today) {
            status = 'Overdue';
        }
    }
    
    const newOutstandingBalance = outstandingBalance - principal;

    schedule.push({
      paymentNumber: i,
      date: dateStr,
      totalPayment: parseFloat(totalPayment.toFixed(2)),
      principal: parseFloat(principal.toFixed(2)),
      interest: parseFloat(interest.toFixed(2)),
      outstandingBalance: parseFloat(Math.max(0, newOutstandingBalance).toFixed(2)),
      status,
      transactionId,
    });
    
    // Use high-precision value for the next iteration
    outstandingBalance = newOutstandingBalance;
  }
  return schedule;
}

export interface FinancialHealthScore {
    score: number;
    rank: string;
    breakdown: {
        liquidity: { score: number; max: number; value: number; status: string; label: string; };
        solvency: { score: number; max: number; value: number; status: string; label: string; };
        savings: { score: number; max: number; value: number; status: string; label: string; };
        budget: { score: number; max: number; value: number; status: string; label: string; };
    };
}

export function calculateFinancialHealth(
    accounts: Account[], 
    transactions: Transaction[], 
    budgets: Budget[],
    recurringTransactions: RecurringTransaction[]
): FinancialHealthScore {
    const { totalAssets, totalDebt, liquidCash } = calculateAccountTotals(accounts);
    
    // 1. Liquidity (Emergency Fund)
    // Target: 3-6 months of expenses
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    
    const recentExpenses = transactions.filter(t => {
        const d = parseDateAsUTC(t.date);
        return d >= threeMonthsAgo && d <= today && t.type === 'expense' && !t.transferId;
    }).reduce((sum, t) => sum + convertToEur(Math.abs(t.amount), t.currency), 0);
    
    const avgMonthlyExpense = recentExpenses / 3;
    const monthsRunway = avgMonthlyExpense > 0 ? liquidCash / avgMonthlyExpense : 0;
    
    let liquidityScore = 0;
    let liquidityStatus = 'Needs Attention';
    if (monthsRunway >= 6) { liquidityScore = 25; liquidityStatus = 'Excellent'; }
    else if (monthsRunway >= 3) { liquidityScore = 20; liquidityStatus = 'Good'; }
    else if (monthsRunway >= 1) { liquidityScore = 10; liquidityStatus = 'Fair'; }
    else { liquidityScore = 5; }

    // 2. Solvency (Debt Ratio)
    // Target: Debt < 30% of Assets (Low leverage)
    const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
    let solvencyScore = 0;
    let solvencyStatus = 'High Debt';
    
    if (totalDebt === 0) { solvencyScore = 25; solvencyStatus = 'Debt Free'; }
    else if (debtRatio < 20) { solvencyScore = 22; solvencyStatus = 'Excellent'; }
    else if (debtRatio < 40) { solvencyScore = 15; solvencyStatus = 'Good'; }
    else if (debtRatio < 60) { solvencyScore = 10; solvencyStatus = 'Fair'; }
    else { solvencyScore = 5; }

    // 3. Savings Rate (Estimated)
    // Target: > 20%
    const recentIncome = transactions.filter(t => {
        const d = parseDateAsUTC(t.date);
        return d >= threeMonthsAgo && d <= today && t.type === 'income' && !t.transferId;
    }).reduce((sum, t) => sum + convertToEur(t.amount, t.currency), 0);
    
    const avgMonthlyIncome = recentIncome / 3;
    const savingsRate = avgMonthlyIncome > 0 ? ((avgMonthlyIncome - avgMonthlyExpense) / avgMonthlyIncome) * 100 : 0;
    
    let savingsScore = 0;
    let savingsStatus = 'Low';
    if (savingsRate >= 50) { savingsScore = 25; savingsStatus = 'Super Saver'; }
    else if (savingsRate >= 20) { savingsScore = 20; savingsStatus = 'Healthy'; }
    else if (savingsRate >= 10) { savingsScore = 15; savingsStatus = 'Good'; }
    else if (savingsRate > 0) { savingsScore = 10; savingsStatus = 'Positive'; }
    else { savingsScore = 0; savingsStatus = 'Negative'; }

    // 4. Budget Discipline
    // Target: Staying under budget
    let budgetScore = 25;
    let budgetStatus = 'Disciplined';
    const currentMonthTxs = transactions.filter(t => {
         const d = parseDateAsUTC(t.date);
         return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && t.type === 'expense' && !t.transferId;
    });
    
    let overBudgetCount = 0;
    if (budgets.length > 0) {
        budgets.forEach(b => {
             const spent = currentMonthTxs
                .filter(t => t.category === b.categoryName) // Simplified matching
                .reduce((sum, t) => sum + convertToEur(Math.abs(t.amount), t.currency), 0);
             if (spent > b.amount) overBudgetCount++;
        });
        
        if (overBudgetCount > 2) { budgetScore = 10; budgetStatus = 'Needs Review'; }
        else if (overBudgetCount > 0) { budgetScore = 18; budgetStatus = 'Mostly Good'; }
    } else {
        // If no budgets, fallback to a neutral score or base it on spending trend vs last month
        budgetScore = 15; 
        budgetStatus = 'No Budgets Set';
    }

    const totalScore = liquidityScore + solvencyScore + savingsScore + budgetScore;
    
    let rank = 'Financial Novice';
    if (totalScore >= 90) rank = 'Wealth Wizard';
    else if (totalScore >= 80) rank = 'Financial Architect';
    else if (totalScore >= 60) rank = 'Budget Master';
    else if (totalScore >= 40) rank = 'Saver';

    return {
        score: totalScore,
        rank,
        breakdown: {
            liquidity: { score: liquidityScore, max: 25, value: monthsRunway, status: liquidityStatus, label: 'Emergency Fund' },
            solvency: { score: solvencyScore, max: 25, value: debtRatio, status: solvencyStatus, label: 'Debt Ratio' },
            savings: { score: savingsScore, max: 25, value: savingsRate, status: savingsStatus, label: 'Savings Rate' },
            budget: { score: budgetScore, max: 25, value: overBudgetCount, status: budgetStatus, label: 'Budgeting' },
        }
    };
}
