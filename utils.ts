import { Currency, Account, Transaction, Duration, Category, FinancialGoal, RecurringTransaction, BillPayment } from './types';
import { ASSET_TYPES, DEBT_TYPES, LIQUID_ACCOUNT_TYPES } from './constants';

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

export const parseDateAsUTC = (dateString: string): Date => {
    if (!dateString) return new Date(0);
    const parts = dateString.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return new Date(0);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};


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
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

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

    const currentStatementEnd = new Date(currentStatementStart);
    currentStatementEnd.setUTCMonth(currentStatementEnd.getUTCMonth() + 1);
    currentStatementEnd.setUTCDate(currentStatementEnd.getUTCDate() - 1);

    const futureStatementStart = new Date(currentStatementStart);
    futureStatementStart.setUTCMonth(futureStatementStart.getUTCMonth() + 1);

    const futureStatementEnd = new Date(futureStatementStart);
    futureStatementEnd.setUTCMonth(futureStatementEnd.getUTCMonth() + 1);
    futureStatementEnd.setUTCDate(futureStatementEnd.getUTCDate() - 1);

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

    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const dailyChanges = new Map<string, number>();

    recurringTransactions.forEach(rt => {
        const fromSelected = liquidAccountIds.has(rt.accountId);
        const toSelected = rt.toAccountId ? liquidAccountIds.has(rt.toAccountId) : false;

        if (!fromSelected && !toSelected) return;
        
        let nextDate = parseDateAsUTC(rt.nextDueDate);
        const endDateUTC = rt.endDate ? parseDateAsUTC(rt.endDate) : null;
        const startDateUTC = parseDateAsUTC(rt.startDate);

        while (nextDate < startDate && (!endDateUTC || nextDate < endDateUTC)) {
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
        if (goal.type === 'recurring' && goal.transactionType === 'expense' && goal.monthlyContribution && goal.currentAmount < goal.amount) {
            let nextDate = goal.startDate ? parseDateAsUTC(goal.startDate) : new Date();
            const dayOfMonth = goal.dueDateOfMonth || nextDate.getUTCDate();
            nextDate.setUTCDate(dayOfMonth);

            while (nextDate < startDate) {
                nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
            }
    
            let remainingAmountToSave = goal.amount - goal.currentAmount;
    
            while (nextDate <= forecastEndDate && remainingAmountToSave > 0) {
                const dateStr = nextDate.toISOString().split('T')[0];
                const contribution = Math.min(goal.monthlyContribution, remainingAmountToSave);
                remainingAmountToSave -= contribution;
    
                dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) - convertToEur(contribution, goal.currency));
                
                nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
            }
        }
        if (goal.type === 'one-time' && goal.date) {
            const goalDate = parseDateAsUTC(goal.date);
            if (goalDate >= startDate && goalDate <= forecastEndDate) {
                const dateStr = goal.date;
                const amount = goal.transactionType === 'expense' ? -goal.amount : goal.amount;
                dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + convertToEur(amount, goal.currency));
            }
        }
    });

    billsAndPayments.forEach(bill => {
        if (bill.status === 'unpaid') {
            const dueDate = parseDateAsUTC(bill.dueDate);
            if (dueDate >= startDate && dueDate <= forecastEndDate) {
                const dateStr = bill.dueDate;
                dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + convertToEur(bill.amount, bill.currency));
            }
        }
    });

    const forecastData: { date: string; value: number }[] = [];
    let runningBalance = liquidAccounts.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
    
    let currentDate = new Date(startDate.getTime());
    while (currentDate <= forecastEndDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        runningBalance += dailyChanges.get(dateStr) || 0;
        forecastData.push({ date: dateStr, value: runningBalance });
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    return forecastData;
}