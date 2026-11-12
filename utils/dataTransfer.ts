import { Account, Budget, Category, FinancialData, RecurringTransaction, Transaction } from '../types';
import { parseLocalDate } from '../utils';

export interface ExportConfig {
  format: 'json' | 'csv';
  dataTypes: string[];
  dateRange?: { start: string; end: string };
  /** Empty means all. */
  accountIds?: string[];
}

export interface ExportSource {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  allCategories: Category[];
  fullFinancialData: FinancialData;
}

export type RestoreStrategy = 'merge' | 'replace';

const filterForExport = ({ dateRange, accountIds }: ExportConfig, source: ExportSource) => {
  let transactions = source.transactions;
  if (dateRange) {
    const start = parseLocalDate(dateRange.start);
    const end = parseLocalDate(dateRange.end);
    end.setHours(23, 59, 59, 999);
    transactions = transactions.filter(item => {
      const date = parseLocalDate(item.date);
      return date >= start && date <= end;
    });
  }
  const hasAccounts = !!accountIds?.length;
  return {
    transactions: hasAccounts ? transactions.filter(item => accountIds!.includes(item.accountId)) : transactions,
    accounts: hasAccounts ? source.accounts.filter(item => accountIds!.includes(item.id)) : source.accounts,
  };
};

/** The JSON backup: only the chosen data, with what restoring it needs. */
export const buildJsonExport = (config: ExportConfig, source: ExportSource): Record<string, unknown> => {
  const { accounts, transactions } = filterForExport(config, source);
  const full = source.fullFinancialData;
  const chosen = (type: string) => config.dataTypes.includes(type);
  const data: Record<string, unknown> = {};

  if (chosen('accounts')) data.accounts = accounts;
  if (chosen('transactions')) data.transactions = transactions;
  if (chosen('budgets')) data.budgets = source.budgets;
  if (chosen('schedule')) {
    data.recurringTransactions = source.recurringTransactions;
    data.recurringTransactionOverrides = full.recurringTransactionOverrides;
    data.loanPaymentOverrides = full.loanPaymentOverrides;
    data.billsAndPayments = full.billsAndPayments;
  }
  if (chosen('categories')) {
    data.incomeCategories = source.allCategories.filter(item => item.classification === 'income');
    data.expenseCategories = source.allCategories.filter(item => item.classification === 'expense');
  }
  if (chosen('investments')) {
    data.investmentTransactions = full.investmentTransactions;
    data.warrants = full.warrants;
    // Prices keep the portfolio's value right after a restore.
    data.manualWarrantPrices = full.manualWarrantPrices;
    data.priceHistory = full.priceHistory;
  }
  if (chosen('invoices')) data.invoices = full.invoices;
  if (chosen('memberships')) data.memberships = full.memberships;
  if (chosen('goals')) {
    data.financialGoals = full.financialGoals;
    data.predictions = full.predictions;
    data.lifeEvents = full.lifeEvents;
    if (full.goalOrder !== undefined) data.goalOrder = full.goalOrder;
  }
  if (chosen('tasks')) data.tasks = full.tasks;
  if (chosen('tags')) data.tags = full.tags;
  if (chosen('preferences')) data.preferences = full.preferences || {};
  if (chosen('userStats')) data.userStats = full.userStats;
  return data;
};

const flattenCategoriesForCsv = (categories: Category[], parentName = ''): Record<string, unknown>[] =>
  categories.flatMap(category => {
    const { subCategories, ...rest } = category;
    const row = { ...rest, parentCategory: parentName || undefined };
    return [row, ...(subCategories?.length ? flattenCategoriesForCsv(subCategories, category.name) : [])];
  });

/** One table per data type. Preferences and stats have no table form, and empty tables are left out. */
export const buildCsvExports = (config: ExportConfig, source: ExportSource): { type: string; rows: any[] }[] => {
  const { accounts, transactions } = filterForExport(config, source);
  const full = source.fullFinancialData;
  const tables: Record<string, any[]> = {
    transactions,
    accounts,
    categories: flattenCategoriesForCsv(source.allCategories),
    budgets: source.budgets,
    schedule: [...source.recurringTransactions, ...(full.billsAndPayments || [])],
    investments: full.investmentTransactions || [],
    invoices: full.invoices || [],
    memberships: full.memberships || [],
    goals: full.financialGoals || [],
    tasks: full.tasks || [],
    tags: full.tags || [],
  };
  return config.dataTypes.map(type => ({ type, rows: tables[type] ?? [] })).filter(table => table.rows.length > 0);
};

/** Applies a backup section by section. Merging keeps what's here and adds items with new ids. */
export const applyRestore = (current: FinancialData, incoming: Partial<FinancialData>, strategy: Record<string, RestoreStrategy>): FinancialData => {
  const merged: any = { ...current };
  (Object.keys(incoming) as (keyof FinancialData)[]).forEach(key => {
    const next: any = incoming[key];
    const existing: any = current[key];
    const shouldReplace = (strategy[key] || 'merge') === 'replace';
    if (Array.isArray(next) && Array.isArray(existing)) {
      if (shouldReplace) {
        merged[key] = next;
      } else {
        const known = new Set(existing.map((item: any) => item.id).filter(Boolean));
        merged[key] = [...existing, ...next.filter((item: any) => !known.has(item.id))];
      }
    } else if (typeof next === 'object' && next !== null) {
      merged[key] = shouldReplace ? next : { ...existing, ...next };
    }
  });
  return merged;
};
