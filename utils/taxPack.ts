import type { Currency, InvestmentTransaction, Transaction } from '../types';
import { safeAdd, safeMultiply, round2 } from '../utils';
import { taxYearRange, type ChecklistItem, type TaxCountry } from './taxCountries';

/*
 * The numbers for a tax year, worked out from the transactions already in Crystal: what came in, what looks deductible,
 * what the investments paid and what was sold. Everything is a summary to hand to an accountant or to check against your
 * own forms, not a tax return.
 */

export interface TaxLine { category: string; total: number; count: number }

export interface TaxSale { date: string; symbol: string; name: string; quantity: number; proceeds: number; costBasis: number; gain: number }

export interface TaxSummary {
  year: number;
  label: string;
  start: string;
  end: string;
  income: TaxLine[];
  incomeTotal: number;
  investmentIncome: TaxLine[];
  investmentIncomeTotal: number;
  deductible: TaxLine[];
  deductibleTotal: number;
  sales: TaxSale[];
  salesProceeds: number;
  salesGain: number;
  transactionCount: number;
}

export interface TaxSummaryInput {
  year: number;
  country: TaxCountry;
  transactions: Transaction[];
  investmentTransactions: InvestmentTransaction[];
  /** Converts an amount to the main currency. */
  toMain: (amount: number, currency: Currency) => number;
}

const INVESTMENT_INCOME = /dividend|interest|coupon|capital gain|distribution/i;

const addTo = (map: Map<string, TaxLine>, category: string, amount: number) => {
  const line = map.get(category) ?? { category, total: 0, count: 0 };
  line.total = safeAdd(line.total, amount);
  line.count += 1;
  map.set(category, line);
};

const sorted = (map: Map<string, TaxLine>): TaxLine[] =>
  [...map.values()].map(line => ({ ...line, total: round2(line.total) })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

const sum = (lines: TaxLine[]) => round2(lines.reduce((total, line) => safeAdd(total, line.total), 0));

/** Realised gains by average cost, per symbol, across all trades up to the year's end. Your country may require another method. */
export const salesInRange = (trades: InvestmentTransaction[], start: string, end: string, toMain: TaxSummaryInput['toMain']): TaxSale[] => {
  const book = new Map<string, { quantity: number; cost: number }>();
  const sales: TaxSale[] = [];
  const ordered = [...trades].filter(t => t.date <= end).sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'buy' ? -1 : 1));
  for (const trade of ordered) {
    const value = toMain(safeMultiply(trade.quantity, trade.price), trade.currency ?? 'EUR');
    const held = book.get(trade.symbol) ?? { quantity: 0, cost: 0 };
    if (trade.type === 'buy') {
      held.quantity = safeAdd(held.quantity, trade.quantity);
      held.cost = safeAdd(held.cost, value);
    } else {
      const average = held.quantity > 0 ? held.cost / held.quantity : 0;
      const costBasis = round2(Math.min(trade.quantity, held.quantity) * average);
      held.quantity = Math.max(0, held.quantity - trade.quantity);
      held.cost = Math.max(0, held.cost - costBasis);
      if (trade.date >= start) sales.push({ date: trade.date, symbol: trade.symbol, name: trade.name, quantity: trade.quantity, proceeds: round2(value), costBasis, gain: round2(value - costBasis) });
    }
    book.set(trade.symbol, held);
  }
  return sales;
};

export const buildTaxSummary = ({ year, country, transactions, investmentTransactions, toMain }: TaxSummaryInput): TaxSummary => {
  const { start, end, label } = taxYearRange(country, year);
  const income = new Map<string, TaxLine>();
  const investment = new Map<string, TaxLine>();
  const deductible = new Map<string, TaxLine>();
  let transactionCount = 0;
  const keywords = country.deductibleKeywords.map(word => word.toLowerCase());

  for (const tx of transactions) {
    const day = tx.date.slice(0, 10);
    if (day < start || day > end) continue;
    if (tx.isSplitParent || tx.isCombinedParent || tx.transferId || tx.isBalanceAdjustment || tx.isMarketAdjustment) continue;
    const amount = toMain(Math.abs(tx.amount), tx.currency);
    if (tx.type === 'income') {
      transactionCount += 1;
      addTo(INVESTMENT_INCOME.test(`${tx.category} ${tx.description}`) ? investment : income, tx.category || 'Uncategorised', amount);
    } else if (keywords.length && keywords.some(word => `${tx.category}`.toLowerCase().includes(word))) {
      transactionCount += 1;
      addTo(deductible, tx.category, amount);
    }
  }

  const sales = salesInRange(investmentTransactions, start, end, toMain);
  const incomeLines = sorted(income);
  const investmentLines = sorted(investment);
  const deductibleLines = sorted(deductible);
  return {
    year, label, start, end,
    income: incomeLines, incomeTotal: sum(incomeLines),
    investmentIncome: investmentLines, investmentIncomeTotal: sum(investmentLines),
    deductible: deductibleLines, deductibleTotal: sum(deductibleLines),
    sales, salesProceeds: round2(sales.reduce((total, s) => safeAdd(total, s.proceeds), 0)), salesGain: round2(sales.reduce((total, s) => safeAdd(total, s.gain), 0)),
    transactionCount,
  };
};

export type ChecklistStatus = 'have' | 'missing' | 'optional';

export interface ChecklistRow extends ChecklistItem { status: ChecklistStatus; documents: number }

/** Each item the country asks for, against the documents attached for the year. Items your data does not touch are optional. */
export const buildChecklist = (country: TaxCountry, summary: TaxSummary, documents: { checklistKey: string | null }[]): ChecklistRow[] => {
  const applies = (item: ChecklistItem) => item.need === 'always'
    || (item.need === 'investmentIncome' && summary.investmentIncomeTotal > 0)
    || (item.need === 'sales' && summary.sales.length > 0)
    || (item.need === 'deductible' && summary.deductible.length > 0);
  return country.checklist.map(item => {
    const documentsFor = documents.filter(doc => doc.checklistKey === item.key).length;
    return { ...item, documents: documentsFor, status: documentsFor > 0 ? 'have' : applies(item) ? 'missing' : 'optional' };
  });
};

/** A spreadsheet cell that cannot run as a formula when opened. */
const cell = (value: string | number): string => {
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (rows: (string | number)[][]): string => rows.map(row => row.map(cell).join(',')).join('\n') + '\n';

const lines = (heading: string, rows: TaxLine[]): (string | number)[][] => [[heading], ['Category', 'Transactions', 'Total'], ...rows.map(row => [row.category, row.count, row.total]), []];

export const summaryCsv = (summary: TaxSummary, country: TaxCountry, currency: string): string => toCsv([
  ['Crystal tax summary'],
  ['Tax year', summary.label], ['From', summary.start], ['To', summary.end], ['Country', country.name], ['Currency', currency], [],
  ...lines('Income', summary.income), ['Income total', '', summary.incomeTotal], [],
  ...lines('Investment income', summary.investmentIncome), ['Investment income total', '', summary.investmentIncomeTotal], [],
  ...lines('Spending in deductible categories', summary.deductible), ['Deductible categories total', '', summary.deductibleTotal], [],
  ['Sales proceeds', '', summary.salesProceeds], ['Realised gain (average cost)', '', summary.salesGain], [],
  ['A summary from your own records, not a tax return. What counts depends on your country and situation.'],
]);

export const salesCsv = (summary: TaxSummary): string => toCsv([
  ['Date', 'Symbol', 'Name', 'Quantity', 'Proceeds', 'Cost (average cost)', 'Gain'],
  ...summary.sales.map(s => [s.date, s.symbol, s.name, s.quantity, s.proceeds, s.costBasis, s.gain]),
]);

export const checklistCsv = (rows: ChecklistRow[]): string => toCsv([
  ['Document', 'What it is', 'Status', 'Files attached'],
  ...rows.map(row => [row.label, row.hint, row.status === 'have' ? 'Attached' : row.status === 'missing' ? 'Missing' : 'Not needed by your data', row.documents]),
]);

export const transactionsCsv = (transactions: Transaction[], summary: TaxSummary): string => toCsv([
  ['Date', 'Description', 'Category', 'Type', 'Amount', 'Currency'],
  ...transactions
    .filter(tx => tx.date.slice(0, 10) >= summary.start && tx.date.slice(0, 10) <= summary.end && !tx.isSplitParent && !tx.isCombinedParent && !tx.transferId && !tx.isBalanceAdjustment && !tx.isMarketAdjustment)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(tx => [tx.date.slice(0, 10), tx.description, tx.category, tx.type, Math.abs(tx.amount), tx.currency]),
]);
