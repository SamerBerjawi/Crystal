import { Currency, Account, Transaction, Duration, Category } from './types';
import { ASSET_TYPES, DEBT_TYPES } from './constants';

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

export const getApiBaseUrl = (): string => {
    const envValue = import.meta.env?.VITE_API_BASE_URL as string | undefined;
    if (envValue) {
        return envValue.replace(/\/$/, '');
    }

    if (typeof window !== 'undefined') {
        const { origin } = window.location;
        if (origin.includes('localhost')) {
            return 'http://localhost:3000/api';
        }
        return `${origin}/api`;
    }

    return 'http://localhost:3000/api';
};
