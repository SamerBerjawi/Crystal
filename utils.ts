
import { Currency, Account, Transaction, Duration, Category, FinancialGoal, RecurringTransaction, BillPayment, ScheduledPayment, RecurringTransactionOverride, LoanPaymentOverrides } from './types';
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
    if (!dateString || typeof dateString !== 'string') return new Date(0);

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

export function calculateAccountTotals(accounts: Account[], transactions: Transaction[] = []) {
    const totalAssets = accounts
      .filter(acc => ASSET_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    
    const totalDebt = accounts
      .filter(acc => DEBT_TYPES.includes(acc.type))
      .reduce((sum, acc) => {
        let debtValue = Math.abs(acc.balance);

        if (acc.type === 'Loan' && acc.totalAmount) {
             // Calculate remaining balance based on totalAmount - paid principal
             // Only process if totalAmount is defined, implying a fixed loan structure
             const accountTxs = transactions.filter(t => t.accountId === acc.id && t.type === 'income');
             const totalPrincipalPaid = accountTxs.reduce((paid, tx) => {
                 const principalPart = tx.principalAmount !== undefined ? tx.principalAmount : tx.amount;
                 return paid + principalPart;
             }, 0);
             debtValue = Math.max(0, acc.totalAmount - totalPrincipalPaid);
        }

        return sum + convertToEur(debtValue, acc.currency);
      }, 0);
      
    const creditCardDebt = accounts
      .filter(acc => acc.type === 'Credit Card')
      .reduce((sum, acc) => sum + Math.abs(convertToEur(acc.balance, acc.currency)), 0);

    // Debts reduce net worth, so subtract the total debt (which we treat as a positive number)
    const netWorth = totalAssets - totalDebt;

    return { totalAssets, totalDebt, netWorth, creditCardDebt };
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

export const getCreditCardStatementDetails = (account: Account, startDate: Date, endDate: Date, transactions: Transaction[]) => {
    const statementTransactions = transactions.filter(tx => {
        const txDate = parseDateAsUTC(tx.date);
        return txDate >= startDate && txDate <= endDate && tx.accountId === account.id;
    });
    
    // In Crystal, expenses are negative, income/payments are positive for CC accounts
    const statementBalance = statementTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Find payments made towards this account in this period (or slightly after, up to due date?)
    // Typically payments are positive transactions.
    const amountPaid = statementTransactions
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    return { statementBalance, amountPaid };
};

// Mock function for balance forecast (replace with actual logic later)
export const generateBalanceForecast = (
    accounts: Account[], 
    recurringTransactions: RecurringTransaction[], 
    financialGoals: FinancialGoal[],
    billsAndPayments: BillPayment[],
    endDate: Date,
    overrides: RecurringTransactionOverride[] = []
) => {
    const data: { date: string; value: number; [key: string]: any }[] = [];
    const today = new Date();
    const startDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    let currentDate = new Date(startDate);
    
    // Initial Balances
    const accountBalances = new Map<string, number>();
    accounts.forEach(acc => accountBalances.set(acc.id, convertToEur(acc.balance, acc.currency)));
    let totalBalance = Array.from(accountBalances.values()).reduce((sum, bal) => sum + bal, 0);

    const dailySummary: { id: string, date: string, description: string, amount: number, accountName: string, type: string, originalItem: any, balance: number }[] = [];

    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        let dailyChange = 0;
        const dailyItems: any[] = [];

        // Process Recurring Transactions
        recurringTransactions.forEach(rt => {
            // Check overrides first
            const override = overrides.find(o => o.recurringTransactionId === rt.id && o.originalDate === dateStr);
            
            // Check if this recurrence happens today (simplified logic)
            // In a real app, you'd need robust recurrence rule parsing (daily, weekly, monthly, etc.)
            // Using a simplified check against nextDueDate for demonstration
            // Note: This mock doesn't correctly project future dates for all recurrence types without state
            // A proper implementation would advance nextDueDate statefully in the loop
            
            // Let's do a simple projection based on frequency:
            const rtStartDate = parseDateAsUTC(rt.startDate);
            if (currentDate >= rtStartDate && (!rt.endDate || currentDate <= parseDateAsUTC(rt.endDate))) {
                let isDue = false;
                
                // Simplified check: aligns with start date or specific day of month
                if (rt.frequency === 'monthly') {
                    if (rt.dueDateOfMonth) {
                        isDue = currentDate.getUTCDate() === rt.dueDateOfMonth;
                    } else {
                        isDue = currentDate.getUTCDate() === rtStartDate.getUTCDate();
                    }
                } else if (rt.frequency === 'daily') {
                    isDue = true;
                } else if (rt.frequency === 'weekly') {
                     isDue = currentDate.getUTCDay() === rtStartDate.getUTCDay();
                } else if (rt.frequency === 'yearly') {
                     isDue = currentDate.getUTCMonth() === rtStartDate.getUTCMonth() && currentDate.getUTCDate() === rtStartDate.getUTCDate();
                }
                
                if (isDue) {
                     if (override && override.isSkipped) {
                         // Skipped
                     } else {
                         const amount = override?.amount !== undefined ? override.amount : rt.amount;
                         const signedAmount = rt.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
                         const eurAmount = convertToEur(signedAmount, rt.currency);
                         
                         if (accountBalances.has(rt.accountId)) {
                             accountBalances.set(rt.accountId, (accountBalances.get(rt.accountId) || 0) + eurAmount);
                             dailyChange += eurAmount;
                         } else if (rt.type === 'transfer' && rt.toAccountId && accountBalances.has(rt.toAccountId)) {
                             // Income side of transfer if From account isn't tracked but To account is
                             const incomeEur = convertToEur(Math.abs(amount), rt.currency);
                             accountBalances.set(rt.toAccountId, (accountBalances.get(rt.toAccountId) || 0) + incomeEur);
                             dailyChange += incomeEur;
                         }
                         
                         // If it's a transfer and both accounts are tracked, net change is 0 for total, but individual balances update
                         if (rt.type === 'transfer' && rt.toAccountId && accountBalances.has(rt.accountId) && accountBalances.has(rt.toAccountId)) {
                             const incomeEur = convertToEur(Math.abs(amount), rt.currency);
                             accountBalances.set(rt.toAccountId, (accountBalances.get(rt.toAccountId) || 0) + incomeEur);
                             // dailyChange doesn't change for total
                         }

                         dailyItems.push({ description: override?.description || rt.description, amount: signedAmount, type: 'Recurring', originalItem: rt });
                     }
                }
            }
        });
        
        // Process One-time Bills
        billsAndPayments.forEach(bill => {
            if (bill.status === 'unpaid' && bill.dueDate === dateStr) {
                 const signedAmount = bill.amount; // bill.amount is already signed
                 const eurAmount = convertToEur(signedAmount, bill.currency);
                 if (bill.accountId && accountBalances.has(bill.accountId)) {
                     accountBalances.set(bill.accountId, (accountBalances.get(bill.accountId) || 0) + eurAmount);
                     dailyChange += eurAmount;
                 } else if (!bill.accountId) {
                     // Assume it affects the total if no account specified (e.g. general cashflow)
                     dailyChange += eurAmount;
                 }
                 dailyItems.push({ description: bill.description, amount: signedAmount, type: 'Bill/Payment', originalItem: bill });
            }
        });
        
        // Process Goals (Contributions) - Simplified linear projection
        // This effectively reserves money, so we might treat it as an 'expense' from the main balance
        // OR if the goal is linked to a tracked account, it's just a move within the portfolio (no net change).
        // Let's assume goals consume cash flow (reduce 'available' balance).
        /* 
        financialGoals.forEach(goal => {
            if (goal.date && goal.date === dateStr) {
                 // Target date reached
            }
        });
        */

        totalBalance += dailyChange;
        
        const row: any = { date: dateStr, value: totalBalance, dailySummary: dailyItems };
        accounts.forEach(acc => {
            row[acc.id] = accountBalances.get(acc.id);
        });
        
        data.push(row);
        
        dailyItems.forEach(item => {
            dailySummary.push({
                id: uuidv4(),
                date: dateStr,
                description: item.description,
                amount: item.amount,
                accountName: 'Multiple', // TODO: refine
                type: item.type,
                originalItem: item.originalItem,
                balance: totalBalance
            });
        });

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    return { chartData: data, tableData: dailySummary };
};

// Generate synthetic recurring transactions for loans
export const generateSyntheticLoanPayments = (
    accounts: Account[], 
    transactions: Transaction[],
    overrides: Record<number, Partial<ScheduledPayment>> = {} // Not used in this simple gen yet, but passed for future
): RecurringTransaction[] => {
    const loans = accounts.filter(a => a.type === 'Loan' || a.type === 'Lending');
    const synthetic: RecurringTransaction[] = [];

    loans.forEach(loan => {
        if (loan.status === 'closed') return;
        
        const schedule = generateAmortizationSchedule(loan, transactions, overrides); // We can reuse this logic if we want precise dates
        // For now, let's just create a simple monthly recurring item based on the loan fields
        // If paymentDayOfMonth is set, we can be more precise.
        
        // Better approach: Use the amortization schedule to create individual 'recurring' items?
        // No, RecurringTransaction type is for *series*.
        // We will return a single RecurringTransaction that represents the monthly payment series.
        
        if (loan.monthlyPayment || loan.paymentDayOfMonth || (loan.totalAmount && loan.duration && loan.interestRate)) {
             let amount = loan.monthlyPayment;
             if (!amount && loan.totalAmount && loan.duration && loan.interestRate) {
                 // Calculate PMT
                 const r = loan.interestRate / 100 / 12;
                 const n = loan.duration;
                 const p = loan.totalAmount - (loan.downPayment || 0);
                 if (p > 0) {
                    amount = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                 }
             }
             
             if (amount) {
                const startDate = loan.loanStartDate || new Date().toISOString().split('T')[0];
                // Calculate next due date based on paymentDayOfMonth
                const today = new Date();
                let nextDue = new Date(today.getFullYear(), today.getMonth(), loan.paymentDayOfMonth || 1);
                if (nextDue < today) {
                    nextDue.setMonth(nextDue.getMonth() + 1);
                }

                synthetic.push({
                    id: `loan-pmt-${loan.id}`,
                    accountId: loan.linkedAccountId || 'external', // Where money comes from
                    toAccountId: loan.id, // Where money goes
                    description: `Loan Payment: ${loan.name}`,
                    amount: amount,
                    category: 'Housing', // Default?
                    type: loan.type === 'Lending' ? 'income' : 'expense', // expense for user paying loan, income for user lending
                    currency: loan.currency,
                    frequency: 'monthly',
                    frequencyInterval: 1,
                    startDate: startDate,
                    nextDueDate: nextDue.toISOString().split('T')[0],
                    dueDateOfMonth: loan.paymentDayOfMonth,
                    weekendAdjustment: 'after',
                    isSynthetic: true
                });
             }
        }
    });
    return synthetic;
};

export const generateSyntheticCreditCardPayments = (accounts: Account[], transactions: Transaction[]): RecurringTransaction[] => {
    const creditCards = accounts.filter(a => a.type === 'Credit Card');
    const synthetic: RecurringTransaction[] = [];

    creditCards.forEach(cc => {
        if (cc.status === 'closed' || !cc.statementStartDate || !cc.paymentDate) return;

        // Logic to estimate future payments. 
        // Simple assumption: Pay off full balance on due date.
        // We need to calculate the estimated due date.
        
        const today = new Date();
        let nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), cc.paymentDate);
        if (nextPaymentDate < today) {
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        }
        
        // Estimate amount: Current Balance. 
        // Ideally this should forecast future spend, but Current Balance is a good baseline for 'next payment'.
        const amount = Math.abs(cc.balance);
        
        if (amount > 0) {
            synthetic.push({
                id: `cc-pmt-${cc.id}`,
                accountId: cc.settlementAccountId || 'external',
                toAccountId: cc.id,
                description: `Credit Card Bill: ${cc.name}`,
                amount: amount,
                category: 'Bills & Utilities',
                type: 'transfer', // It's a transfer from checking to CC
                currency: cc.currency,
                frequency: 'monthly',
                startDate: nextPaymentDate.toISOString().split('T')[0],
                nextDueDate: nextPaymentDate.toISOString().split('T')[0],
                dueDateOfMonth: cc.paymentDate,
                weekendAdjustment: 'after',
                isSynthetic: true
            });
        }
    });
    return synthetic;
};

export const generateSyntheticPropertyTransactions = (accounts: Account[]): RecurringTransaction[] => {
    const properties = accounts.filter(a => a.type === 'Property');
    const synthetic: RecurringTransaction[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    properties.forEach(prop => {
        if (prop.status === 'closed') return;
        
        // Property Tax
        if (prop.propertyTaxAmount && prop.propertyTaxDate) {
             synthetic.push({
                id: `prop-tax-${prop.id}`,
                accountId: prop.linkedAccountId || 'external',
                description: `Property Tax: ${prop.name}`,
                amount: prop.propertyTaxAmount,
                category: 'Housing',
                type: 'expense',
                currency: prop.currency,
                frequency: 'yearly',
                frequencyInterval: 1,
                startDate: todayStr,
                nextDueDate: prop.propertyTaxDate,
                weekendAdjustment: 'after',
                isSynthetic: true
            });
        }
        
        // Insurance
        if (prop.insuranceAmount && prop.insurancePaymentDate && prop.insuranceFrequency) {
             synthetic.push({
                id: `prop-ins-${prop.id}`,
                accountId: prop.linkedAccountId || 'external',
                description: `Home Insurance: ${prop.name}`,
                amount: prop.insuranceAmount,
                category: 'Housing',
                type: 'expense',
                currency: prop.currency,
                frequency: prop.insuranceFrequency,
                frequencyInterval: 1,
                startDate: todayStr,
                nextDueDate: prop.insurancePaymentDate,
                weekendAdjustment: 'after',
                isSynthetic: true
            });
        }
        
         // HOA
        if (prop.hoaFeeAmount && prop.hoaFeeFrequency) {
             synthetic.push({
                id: `prop-hoa-${prop.id}`,
                accountId: prop.linkedAccountId || 'external',
                description: `HOA Fee: ${prop.name}`,
                amount: prop.hoaFeeAmount,
                category: 'Housing',
                type: 'expense',
                currency: prop.currency,
                frequency: prop.hoaFeeFrequency,
                frequencyInterval: 1,
                startDate: todayStr,
                nextDueDate: todayStr, // Assume due now if not specified? Or 1st of month?
                dueDateOfMonth: 1,
                weekendAdjustment: 'after',
                isSynthetic: true
            });
        }
        
        // Rental Income
        if (prop.isRental && prop.rentalIncomeAmount && prop.rentalIncomeFrequency) {
            synthetic.push({
                id: `prop-rent-${prop.id}`,
                accountId: prop.linkedAccountId || 'external',
                description: `Rental Income: ${prop.name}`,
                amount: prop.rentalIncomeAmount,
                category: 'Income',
                type: 'income',
                currency: prop.currency,
                frequency: prop.rentalIncomeFrequency,
                frequencyInterval: 1,
                startDate: todayStr,
                nextDueDate: todayStr,
                dueDateOfMonth: 1,
                weekendAdjustment: 'after',
                isSynthetic: true
            });
        }
    });
    
    return synthetic;
};


export const generateAmortizationSchedule = (
    account: Account, 
    transactions: Transaction[],
    overrides: Record<number, Partial<ScheduledPayment>> = {}
): ScheduledPayment[] => {
    const schedule: ScheduledPayment[] = [];
    if (account.type !== 'Loan' && account.type !== 'Lending') return schedule;
    
    const principal = account.totalAmount;
    const rate = account.interestRate;
    const duration = account.duration; // months
    const startDate = account.loanStartDate ? parseDateAsUTC(account.loanStartDate) : null;
    
    if (!principal || !rate || !duration || !startDate) return schedule;

    const monthlyRate = rate / 100 / 12;
    const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, duration)) / (Math.pow(1 + monthlyRate, duration) - 1);
    
    let currentBalance = principal - (account.downPayment || 0);
    let currentDate = new Date(startDate);

    // Align first payment to paymentDayOfMonth if set
    if (account.paymentDayOfMonth) {
        if (currentDate.getUTCDate() > account.paymentDayOfMonth) {
            currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
        }
        currentDate.setUTCDate(account.paymentDayOfMonth);
    } else {
         currentDate.setUTCMonth(currentDate.getUTCMonth() + 1); // First payment usually 1 month after start
    }

    for (let i = 1; i <= duration; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Check for user overrides
        const override = overrides[i] || {};
        
        let interestPayment = currentBalance * monthlyRate;
        let principalPayment = monthlyPayment - interestPayment;
        let totalPayment = monthlyPayment;

        if (override.totalPayment !== undefined) {
             totalPayment = override.totalPayment;
             // Recalculate splits if total changed but splits didn't
             if (override.interest === undefined && override.principal === undefined) {
                 // Keep interest logic, adjust principal
                 interestPayment = currentBalance * monthlyRate; // Or stick to strict calc?
                 principalPayment = totalPayment - interestPayment;
             }
        }
        if (override.interest !== undefined) interestPayment = override.interest;
        if (override.principal !== undefined) principalPayment = override.principal;
        
        // Re-sum total if splits changed but total didn't
        if ((override.interest !== undefined || override.principal !== undefined) && override.totalPayment === undefined) {
            totalPayment = principalPayment + interestPayment;
        }

        // Check if payment was made (fuzzy match on amount and date window)
        // Look for transactions around the due date (+/- 5 days)
        const windowStart = new Date(currentDate); windowStart.setUTCDate(windowStart.getUTCDate() - 5);
        const windowEnd = new Date(currentDate); windowEnd.setUTCDate(windowEnd.getUTCDate() + 5);
        
        // Filter for payments (income into loan account)
        // Note: This matching logic is basic. A robust system would link specific transactions to schedule items.
        const paymentTx = transactions.find(tx => {
            const txDate = parseDateAsUTC(tx.date);
            const isPayment = tx.accountId === account.id && tx.type === 'income';
            // Match amount loosely or just date? Let's use date + type.
            return isPayment && txDate >= windowStart && txDate <= windowEnd;
        });

        let status: 'Paid' | 'Due' | 'Upcoming' | 'Overdue' = 'Upcoming';
        const today = new Date();
        
        if (paymentTx) {
            status = 'Paid';
            // Adjust logic: if paid, use actuals? 
            // For projection, we want the plan. For history, we might want actuals.
            // Let's stick to the plan for the table, but mark status.
        } else if (currentDate < today) {
            status = 'Overdue';
        } else if (currentDate.getTime() <= today.getTime() + (7 * 24 * 60 * 60 * 1000)) { // Due within 7 days
             status = 'Due';
        }

        currentBalance -= principalPayment;
        if (currentBalance < 0) currentBalance = 0; // Rounding fix

        schedule.push({
            paymentNumber: i,
            date: dateStr,
            totalPayment,
            principal: principalPayment,
            interest: interestPayment,
            outstandingBalance: currentBalance,
            status,
            transactionId: paymentTx?.id
        });

        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
    }

    return schedule;
};
