import { Currency, Account, Transaction, Duration, Category, FinancialGoal, RecurringTransaction, BillPayment } from './types';
import { ASSET_TYPES, DEBT_TYPES, LIQUID_ACCOUNT_TYPES } from './constants';

const symbolMap: { [key in Currency]: string } = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'BTC': 'BTC',
  'RON': 'lei'
};

export function formatCurrency(amount: number, currency: Currency): string {
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

  const sign = amount < 0 ? '-' : '';
  const symbol = symbolMap[currency] || currency;

  return `${sign}${symbol} ${formatter.format(Math.abs(amount))}`;
}


export const CONVERSION_RATES: { [key in Currency]?: number } = {
    'USD': 0.93, 'GBP': 1.18, 'BTC': 65000, 'EUR': 1, 'RON': 0.20
};

export const convertToEur = (balance: number, currency: Currency): number => {
    return balance * (CONVERSION_RATES[currency] || 0);
}

export function calculateAccountTotals(accounts: Account[]) {
    const totalAssets = accounts
      .filter(acc => ASSET_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    
    const totalDebt = accounts
      .filter(acc => DEBT_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
      
    const creditCardDebt = accounts
      .filter(acc => acc.type === 'Credit Card')
      .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);

    const netWorth = totalAssets + totalDebt;

    return { totalAssets, totalDebt, netWorth, creditCardDebt };
}

export function getDateRange(duration: Duration, allTransactions: Transaction[] = []): { start: Date, end: Date } {
    const end = new Date();
    const start = new Date();

    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    switch (duration) {
        case '7D':
            start.setDate(start.getDate() - 6);
            break;
        case '30D':
            start.setDate(start.getDate() - 29);
            break;
        case '90D':
            start.setDate(start.getDate() - 89);
            break;
        case 'YTD':
            start.setMonth(0, 1);
            break;
        case '1Y':
            start.setFullYear(start.getFullYear() - 1);
            break;
        case '2Y':
            start.setFullYear(start.getFullYear() - 2);
            break;
        case '3Y':
            start.setFullYear(start.getFullYear() - 3);
            break;
        case '4Y':
            start.setFullYear(start.getFullYear() - 4);
            break;
        case '5Y':
            start.setFullYear(start.getFullYear() - 5);
            break;
        case '10Y':
            start.setFullYear(start.getFullYear() - 10);
            break;
        case 'ALL':
            if (allTransactions.length > 0) {
                const firstTxDate = allTransactions.reduce((earliest, tx) => {
                    const txDate = new Date(tx.date);
                    return txDate < earliest ? txDate : earliest;
                }, new Date(allTransactions[0].date));
                start.setTime(firstTxDate.getTime());
                start.setHours(0, 0, 0, 0);
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

export function calculateStatementPeriods(statementStartDay: number, paymentDueDay: number, today: Date) {
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    let currentStatementStart: Date;
    const todayDay = todayStart.getDate();
    const todayMonth = todayStart.getMonth();
    const todayYear = todayStart.getFullYear();

    if (todayDay >= statementStartDay) {
        currentStatementStart = new Date(Date.UTC(todayYear, todayMonth, statementStartDay));
    } else {
        currentStatementStart = new Date(Date.UTC(todayYear, todayMonth - 1, statementStartDay));
    }

    const currentStatementEnd = new Date(currentStatementStart);
    currentStatementEnd.setUTCMonth(currentStatementEnd.getUTCMonth() + 1);
    currentStatementEnd.setUTCDate(currentStatementEnd.getUTCDate() - 1);

    const futureStatementStart = new Date(currentStatementStart);
    futureStatementStart.setUTCMonth(futureStatementStart.getUTCMonth() + 1);

    const futureStatementEnd = new Date(futureStatementStart);
    futureStatementEnd.setUTCMonth(futureStatementEnd.getUTCMonth() + 1);
    futureStatementEnd.setUTCDate(futureStatementEnd.getUTCDate() - 1);

    // Calculate Payment Due Dates, ensuring it's after the statement ends.
    let currentPaymentDueDate = new Date(Date.UTC(currentStatementEnd.getUTCFullYear(), currentStatementEnd.getUTCMonth(), paymentDueDay));
    if (currentPaymentDueDate <= currentStatementEnd) {
        currentPaymentDueDate.setUTCMonth(currentPaymentDueDate.getUTCMonth() + 1);
    }
    
    let futurePaymentDueDate = new Date(Date.UTC(futureStatementEnd.getUTCFullYear(), futureStatementEnd.getUTCMonth(), paymentDueDay));
    if (futurePaymentDueDate <= futureStatementEnd) {
        futurePaymentDueDate.setUTCMonth(futurePaymentDueDate.getUTCMonth() + 1);
    }

    return {
        current: { start: currentStatementStart, end: currentStatementEnd, paymentDue: currentPaymentDueDate },
        future: { start: futureStatementStart, end: futureStatementEnd, paymentDue: futurePaymentDueDate }
    };
}

export function generateBalanceForecast(
    accounts: Account[],
    recurringTransactions: RecurringTransaction[],
    financialGoals: FinancialGoal[],
    billsAndPayments: BillPayment[],
    forecastEndDate: Date
): { date: string; value: number }[] {
    const liquidAccounts = accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type));
    const liquidAccountIds = new Set(liquidAccounts.map(a => a.id));

    if (liquidAccounts.length === 0) return [];

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const dailyChanges = new Map<string, number>();

    // 1. Process recurring transactions
    recurringTransactions.forEach(rt => {
        const fromSelected = liquidAccountIds.has(rt.accountId);
        const toSelected = rt.toAccountId ? liquidAccountIds.has(rt.toAccountId) : false;

        if (!fromSelected && !toSelected) return;

        let nextDate = new Date(rt.nextDueDate.replace(/-/g, '/'));

        while (nextDate < startDate && (!rt.endDate || nextDate < new Date(rt.endDate.replace(/-/g, '/')))) {
            const interval = rt.frequencyInterval || 1;
            switch(rt.frequency) {
                case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
                case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
                case 'monthly': {
                    const d = rt.dueDateOfMonth || new Date(rt.startDate.replace(/-/g, '/')).getDate();
                    nextDate.setMonth(nextDate.getMonth() + interval, 1);
                    const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                    nextDate.setDate(Math.min(d, lastDay));
                    break;
                }
                case 'yearly': {
                     const d = rt.dueDateOfMonth || new Date(rt.startDate.replace(/-/g, '/')).getDate();
                     const m = new Date(rt.startDate.replace(/-/g, '/')).getMonth();
                     nextDate.setFullYear(nextDate.getFullYear() + interval);
                     const lastDay = new Date(nextDate.getFullYear(), m + 1, 0).getDate();
                     nextDate.setMonth(m, Math.min(d, lastDay));
                     break;
                }
            }
        }
        
        while (nextDate <= forecastEndDate && (!rt.endDate || nextDate <= new Date(rt.endDate.replace(/-/g, '/')))) {
            const dateStr = nextDate.toISOString().split('T')[0];
            let amount = rt.type === 'expense' ? -rt.amount : rt.amount;
            if (rt.type === 'transfer') {
                if (fromSelected && !toSelected) amount = -rt.amount;
                else if (!fromSelected && toSelected) amount = rt.amount;
                else amount = 0;
            }
            if (amount !== 0) {
                dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + convertToEur(amount, rt.currency));
            }
            
             const interval = rt.frequencyInterval || 1;
             switch(rt.frequency) {
                case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
                case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
                case 'monthly': {
                    const d = rt.dueDateOfMonth || new Date(rt.startDate.replace(/-/g, '/')).getDate();
                    nextDate.setMonth(nextDate.getMonth() + interval, 1);
                    const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                    nextDate.setDate(Math.min(d, lastDay));
                    break;
                }
                case 'yearly': {
                     const d = rt.dueDateOfMonth || new Date(rt.startDate.replace(/-/g, '/')).getDate();
                     const m = new Date(rt.startDate.replace(/-/g, '/')).getMonth();
                     nextDate.setFullYear(nextDate.getFullYear() + interval);
                     const lastDay = new Date(nextDate.getFullYear(), m + 1, 0).getDate();
                     nextDate.setMonth(m, Math.min(d, lastDay));
                     break;
                }
            }
        }
    });

    // 2. Process financial goals
    financialGoals.forEach(goal => {
        // Recurring goal contributions
        if (goal.type === 'recurring' && goal.transactionType === 'expense' && goal.monthlyContribution && goal.currentAmount < goal.amount) {
            let nextDate = new Date(goal.startDate!.replace(/-/g, '/'));
            const dayOfMonth = goal.dueDateOfMonth || nextDate.getDate();
            nextDate.setDate(dayOfMonth);

            while (nextDate < startDate) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
    
            let remainingAmountToSave = goal.amount - goal.currentAmount;
    
            while (nextDate <= forecastEndDate && remainingAmountToSave > 0) {
                const dateStr = nextDate.toISOString().split('T')[0];
                const contribution = Math.min(goal.monthlyContribution, remainingAmountToSave);
                remainingAmountToSave -= contribution;
    
                dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) - convertToEur(contribution, goal.currency));
                
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        }
        // One-time goals
        if (goal.type === 'one-time' && goal.date) {
            const goalDate = new Date(goal.date.replace(/-/g, '/'));
            if (goalDate >= startDate && goalDate <= forecastEndDate) {
                const dateStr = goal.date;
                const amount = goal.transactionType === 'expense' ? -goal.amount : goal.amount;
                dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + convertToEur(amount, goal.currency));
            }
        }
    });

    // 3. Process unpaid bills and payments
    billsAndPayments.forEach(bill => {
        if (bill.status === 'unpaid') {
            const dueDate = new Date(bill.dueDate.replace(/-/g, '/'));
            if (dueDate >= startDate && dueDate <= forecastEndDate) {
                const dateStr = bill.dueDate;
                dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + convertToEur(bill.amount, bill.currency));
            }
        }
    });

    // 4. Generate the forecast data
    const forecastData: { date: string; value: number }[] = [];
    let runningBalance = liquidAccounts.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    
    let currentDate = new Date(startDate);
    while (currentDate <= forecastEndDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        runningBalance += dailyChanges.get(dateStr) || 0;
        forecastData.push({ date: dateStr, value: runningBalance });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return forecastData;
}
