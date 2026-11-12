import type {
  Account, AppPreferences, BillPayment, Budget, Category, FinancialGoal, LoanPaymentOverrides, RecurringTransaction, RecurringTransactionOverride, Transaction, Warrant,
} from '../types';
import {
  calculateAccountTotals, convertCurrency, convertToMain, formatCurrency, generateSyntheticCreditCardPayments, generateSyntheticLoanPayments, generateSyntheticPropertyTransactions,
  getMainCurrency, parseLocalDate, round2, safeAdd, toLocalISOString,
} from '../utils';
import { LIQUID_ACCOUNT_TYPES } from '../constants';
import { netWorthHistory } from './challengesModel';
import { biggestAhead, forecastFromData, warrantTaxBills } from './forecastModel';
import { budgetAgainstActual, categoryMatches, expensesIn, groupedSpend, inScope, isCounted, type ReportFilters } from './reportsModel';
import { computeSafeToSpend } from './safeToSpend';
import { isDigitalOrService, serviceStatus, serviceTotals, services } from './subscriptionsModel';
import { subscriptionAudit } from './subscriptionAudit';

/*
 * What Ask Crystal can look up. Each tool runs the app's own functions on the data already loaded in the browser, so
 * a figure the assistant quotes is the figure the rest of Crystal shows. The model chooses a tool and its arguments;
 * it never does the arithmetic. Pure, and tested in tests/unit/assistantTools.test.ts.
 *
 * A tool never guesses. A name it cannot match comes back as an error that lists the real names, so the model asks
 * again with a valid one instead of answering from a near miss.
 */

export interface AssistantTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, any>) => unknown;
}

export interface AssistantData {
  accounts: Account[];
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  recurringOverrides: RecurringTransactionOverride[];
  bills: BillPayment[];
  loanPaymentOverrides: LoanPaymentOverrides;
  warrants: Warrant[];
  goals: FinancialGoal[];
  preferences: AppPreferences;
  today: Date;
}

type Json = Record<string, any>;

const iso = (date: Date) => toLocalISOString(date);
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const money = (value: number) => formatCurrency(round2(value), getMainCurrency());
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const plain = (text: unknown) => String(text ?? '').trim().toLowerCase();
const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseLocalDate(value);
  return Number.isFinite(date.getTime()) && iso(date) === value;
};
const amountOf = (tx: Transaction) => Math.abs(convertToMain(tx.amount, tx.currency));
const merchantOf = (tx: Transaction) => tx.merchant?.trim() || tx.description || 'Unknown';

export const PERIODS = ['this_month', 'last_month', 'last_7_days', 'last_30_days', 'last_90_days', 'this_year', 'last_year', 'last_12_months', 'all_time'] as const;

export interface Period { start: string; end: string; label: string }

/** A named period, a whole month ("2026-03") or two dates, worked out here so the model never has to do calendar maths. */
export const resolvePeriod = (args: Json, today: Date, earliest?: string): Period | { error: string } => {
  if (args.start !== undefined || args.end !== undefined) {
    if (!isIsoDate(args.start) || !isIsoDate(args.end)) return { error: 'start and end must both be dates written YYYY-MM-DD.' };
    if (args.start > args.end) return { error: 'start must not be after end.' };
    return { start: args.start, end: args.end, label: `${args.start} to ${args.end}` };
  }
  if (args.month !== undefined) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(args.month));
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return { error: 'month must be written YYYY-MM, for example 2026-03.' };
    const first = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return { start: iso(first), end: iso(last), label: first.toLocaleDateString('en', { month: 'long', year: 'numeric' }) };
  }
  const period = String(args.period ?? 'this_month');
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  switch (period) {
    case 'this_month': return { start: iso(new Date(y, m, 1)), end: iso(today), label: 'this month so far' };
    case 'last_month': return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)), label: 'last month' };
    case 'last_7_days': return { start: iso(addDays(today, -6)), end: iso(today), label: 'the last 7 days' };
    case 'last_30_days': return { start: iso(addDays(today, -29)), end: iso(today), label: 'the last 30 days' };
    case 'last_90_days': return { start: iso(addDays(today, -89)), end: iso(today), label: 'the last 90 days' };
    case 'this_year': return { start: iso(new Date(y, 0, 1)), end: iso(today), label: 'this year so far' };
    case 'last_year': return { start: iso(new Date(y - 1, 0, 1)), end: iso(new Date(y - 1, 11, 31)), label: String(y - 1) };
    case 'last_12_months': return { start: iso(new Date(y - 1, m, d + 1)), end: iso(today), label: 'the last 12 months' };
    case 'all_time': return { start: earliest ?? iso(new Date(y - 10, 0, 1)), end: iso(today), label: 'all time' };
    default: return { error: `Unknown period "${period}". Use one of: ${PERIODS.join(', ')}, or give month (YYYY-MM), or start and end dates.` };
  }
};

const flatten = (categories: Category[], parent?: string): { name: string; path: string }[] =>
  categories.flatMap(category => [{ name: category.name, path: parent ? `${parent} > ${category.name}` : category.name }, ...flatten(category.subCategories ?? [], category.name)]);

/** Finds the one category the user means. An exact name wins; a single partial match is accepted; anything else is an error. */
export const resolveCategory = (query: string, categories: Category[]): { name: string; note?: string } | { error: string } => {
  const wanted = plain(query);
  const all = flatten(categories);
  const exact = all.find(c => plain(c.name) === wanted);
  if (exact) return { name: exact.name };
  const partial = all.filter(c => plain(c.name).includes(wanted) || (wanted.length >= 4 && wanted.includes(plain(c.name))));
  const unique = [...new Set(partial.map(c => c.name))];
  if (unique.length === 1) return { name: unique[0], note: `"${query}" was matched to the category "${unique[0]}".` };
  const shown = (unique.length ? unique : [...new Set(all.map(c => c.name))]).slice(0, 40).join(', ');
  return { error: unique.length > 1 ? `"${query}" matches several categories: ${shown}. Ask again with the exact name.` : `There is no category called "${query}". The categories are: ${shown}. Ask again with the closest exact name.` };
};

const resolveAccount = (query: string, accounts: Account[]): { id: string; name: string } | { error: string } => {
  const wanted = plain(query);
  const open = accounts.filter(a => a.status !== 'closed');
  const exact = open.find(a => plain(a.name) === wanted);
  if (exact) return { id: exact.id, name: exact.name };
  const partial = open.filter(a => plain(a.name).includes(wanted));
  if (partial.length === 1) return { id: partial[0].id, name: partial[0].name };
  const shown = (partial.length ? partial : open).map(a => a.name).slice(0, 12).join(', ');
  return { error: partial.length > 1 ? `"${query}" matches several accounts: ${shown}.` : `There is no account called "${query}". The accounts are: ${shown}.` };
};

const sum = (values: number[]) => values.reduce((total, value) => safeAdd(total, value), 0);
const monthOf = (date: string) => date.slice(0, 7);

const periodSchema = {
  period: { type: 'string', enum: [...PERIODS], description: 'A named period. Defaults to this_month.' },
  month: { type: 'string', description: 'A whole calendar month as YYYY-MM. Use this for "March" or "October 2025".' },
  start: { type: 'string', description: 'Start date YYYY-MM-DD. Give together with end instead of period.' },
  end: { type: 'string', description: 'End date YYYY-MM-DD, included.' },
};

export const buildAssistantTools = (data: AssistantData): AssistantTool[] => {
  const { accounts, transactions, today } = data;
  const currency = getMainCurrency();
  const showAdjustments = data.preferences.showBalanceAdjustments ?? true;
  const analyticsAccounts = accounts.filter(account => account.includeInAnalytics ?? true);
  const analyticsIds = new Set(analyticsAccounts.map(account => account.id));
  const scoped = analyticsIds.size === 0 ? transactions : transactions.filter(tx => analyticsIds.has(tx.accountId));
  const earliest = transactions.reduce<string | undefined>((min, tx) => (!min || tx.date < min ? tx.date : min), undefined);
  const cushion = data.preferences.safeToSpendCushion ?? 0;

  const recurringItems = () => [
    ...data.recurringTransactions,
    ...generateSyntheticLoanPayments(analyticsAccounts, scoped, data.loanPaymentOverrides),
    ...generateSyntheticCreditCardPayments(analyticsAccounts, scoped),
    ...generateSyntheticPropertyTransactions(analyticsAccounts),
  ];

  /** The accounts the Forecast page starts with: the primary account, or every liquid one. */
  const forecastAccounts = () => {
    const primary = accounts.find(account => account.isPrimary);
    return primary ? [primary] : accounts.filter(account => account.status !== 'closed' && LIQUID_ACCOUNT_TYPES.includes(account.type));
  };

  const project = (end: Date) => {
    const selected = forecastAccounts();
    return forecastFromData(
      { recurring: data.recurringTransactions, overrides: data.recurringOverrides, bills: [...data.bills, ...warrantTaxBills(data.warrants, selected, accounts)], accounts, transactions, loanPaymentOverrides: data.loanPaymentOverrides },
      selected, data.goals, [], today, end, convertToMain,
    );
  };

  const withScope = (args: Json) => {
    const period = resolvePeriod(args, today, earliest);
    if ('error' in period) return { error: period.error } as const;
    let category = 'all';
    let categoryNote: string | undefined;
    if (args.category) {
      const resolved = resolveCategory(String(args.category), [...data.expenseCategories, ...data.incomeCategories]);
      if ('error' in resolved) return { error: resolved.error } as const;
      category = resolved.name;
      categoryNote = resolved.note;
    }
    let accountId = 'all';
    let accountName: string | undefined;
    if (args.account) {
      const resolved = resolveAccount(String(args.account), accounts);
      if ('error' in resolved) return { error: resolved.error } as const;
      accountId = resolved.id;
      accountName = resolved.name;
    }
    const filters: ReportFilters = { startDate: period.start, endDate: period.end, merchant: String(args.merchant ?? ''), category, accountId };
    // Like the Reports page: all accounts that count toward analytics, unless one account is asked for.
    const pool = accountId === 'all' ? scoped : transactions;
    return { period, filters, pool, categoryNote, accountName } as const;
  };

  const describe = (scope: { period: Period; filters: ReportFilters; accountName?: string }, noun: string, total: number, count: number) => {
    const parts = [`${noun} ${money(total)} ${scope.period.label} (${scope.period.start} to ${scope.period.end}, ${count} ${count === 1 ? 'transaction' : 'transactions'})`];
    if (scope.filters.category !== 'all') parts.push(`in ${scope.filters.category}`);
    if (scope.filters.merchant) parts.push(`at "${scope.filters.merchant}"`);
    if (scope.accountName) parts.push(`on ${scope.accountName}`);
    return `${parts.join(' ')}.`;
  };

  const groupRows = (rows: Transaction[], by: string, limit: number) => {
    let groups: { name: string; amount: number; count: number }[];
    if (by === 'month') {
      const map = new Map<string, { amount: number; count: number }>();
      rows.forEach(tx => { const g = map.get(monthOf(tx.date)) ?? { amount: 0, count: 0 }; g.amount = safeAdd(g.amount, amountOf(tx)); g.count += 1; map.set(monthOf(tx.date), g); });
      groups = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, g]) => ({ name, ...g }));
    } else if (by === 'category' || by === 'merchant') {
      groups = groupedSpend(rows, by).map(g => ({ name: g.label, amount: g.totalEur, count: g.count }));
    } else {
      return { groups: [], more: 0 };
    }
    const shown = groups.slice(0, limit).map(g => ({ name: g.name, amount: round2(g.amount), display: money(g.amount), count: g.count }));
    return { groups: shown, more: Math.max(0, groups.length - shown.length) };
  };

  const limitOf = (value: unknown, fallback: number, max: number) => Math.min(max, Math.max(1, Math.round(Number(value)) || fallback));

  const tools: AssistantTool[] = [
    {
      name: 'get_overview',
      description: `A snapshot: net worth, assets, debts, this month's income and spending, and how much is safe to spend. Amounts are in ${currency}. Start here for broad questions.`,
      parameters: { type: 'object', properties: {} },
      run: () => {
        const totals = calculateAccountTotals(analyticsAccounts, scoped, data.loanPaymentOverrides);
        const month = resolvePeriod({ period: 'this_month' }, today) as Period;
        const spent = expensesIn(scoped, { startDate: month.start, endDate: month.end, merchant: '', category: 'all', accountId: 'all' }, showAdjustments, month.start, month.end, data.expenseCategories);
        const earned = scoped.filter(tx => tx.type === 'income' && isCounted(tx, showAdjustments) && tx.date >= month.start && tx.date <= month.end);
        const spentTotal = sum(spent.map(amountOf));
        const earnedTotal = sum(earned.map(amountOf));
        const safe = computeSafeToSpend({ accounts, transactions, recurringItems: recurringItems(), bills: data.bills, overrides: data.recurringOverrides, cushion, referenceDate: today });
        return {
          currency,
          net_worth: round2(totals.netWorth), net_worth_display: money(totals.netWorth),
          total_assets: round2(totals.totalAssets), total_assets_display: money(totals.totalAssets),
          total_debt: round2(totals.totalDebt), total_debt_display: money(totals.totalDebt),
          income_this_month: round2(earnedTotal), income_this_month_display: money(earnedTotal),
          spending_this_month: round2(spentTotal), spending_this_month_display: money(spentTotal),
          safe_to_spend: round2(safe.amount), safe_to_spend_display: money(safe.amount), safe_to_spend_until: safe.until,
          summary: `Net worth is ${money(totals.netWorth)} (assets ${money(totals.totalAssets)}, debts ${money(totals.totalDebt)}). So far this month: income ${money(earnedTotal)}, spending ${money(spentTotal)}. Safe to spend: ${money(safe.amount)} until ${safe.until}.`,
        };
      },
    },
    {
      name: 'list_accounts',
      description: `Every open account with its balance, in its own currency and in ${currency}.`,
      parameters: { type: 'object', properties: {} },
      run: () => {
        const rows = accounts.filter(a => a.status !== 'closed').map(a => ({
          name: a.name, type: a.type, currency: a.currency,
          balance: round2(a.balance), balance_display: formatCurrency(round2(a.balance), a.currency),
          balance_main: round2(convertToMain(a.balance, a.currency)), balance_main_display: money(convertToMain(a.balance, a.currency)),
          counts_in_analytics: a.includeInAnalytics ?? true,
        }));
        return { currency, count: rows.length, accounts: rows, summary: `${count(rows.length, 'open account')}.` };
      },
    },
    {
      name: 'list_categories',
      description: 'The exact category names. Use this when a category name did not match, or to see what exists.',
      parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['expense', 'income'], description: 'Defaults to expense.' } } },
      run: args => {
        const list = args.kind === 'income' ? data.incomeCategories : data.expenseCategories;
        const names = flatten(list).map(c => c.path);
        return { kind: args.kind === 'income' ? 'income' : 'expense', categories: names, summary: `${count(names.length, args.kind === 'income' ? 'income category' : 'expense category', args.kind === 'income' ? 'income categories' : 'expense categories')} (a sub-category is written Parent > Child).` };
      },
    },
    {
      name: 'spending',
      description: `Total spending in a period, optionally for one category (sub-categories included), merchant or account, and optionally broken down. Amounts are in ${currency}. Transfers are not spending.`,
      parameters: {
        type: 'object',
        properties: {
          ...periodSchema,
          category: { type: 'string', description: 'An exact category name, such as "Groceries". Sub-categories are included.' },
          merchant: { type: 'string', description: 'Part of a merchant name.' },
          account: { type: 'string', description: 'An account name.' },
          group_by: { type: 'string', enum: ['category', 'merchant', 'month', 'none'], description: 'How to break the total down. Defaults to none.' },
          limit: { type: 'integer', description: 'How many groups to list, at most 25. Defaults to 10.' },
        },
      },
      run: args => {
        const scope = withScope(args);
        if ('error' in scope) return { error: scope.error };
        const rows = expensesIn(scope.pool, scope.filters, showAdjustments, scope.period.start, scope.period.end, data.expenseCategories);
        const total = sum(rows.map(amountOf));
        const by = ['category', 'merchant', 'month'].includes(args.group_by) ? args.group_by : 'none';
        const { groups, more } = groupRows(rows, by, limitOf(args.limit, 10, 25));
        return {
          currency, period: scope.period, total: round2(total), total_display: money(total), transaction_count: rows.length,
          filters: { category: scope.filters.category === 'all' ? null : scope.filters.category, merchant: scope.filters.merchant || null, account: scope.accountName ?? null },
          ...(by !== 'none' ? { grouped_by: by, groups, more_groups: more } : {}),
          ...(scope.categoryNote ? { note: scope.categoryNote } : {}),
          summary: describe(scope, 'Spent', total, rows.length),
        };
      },
    },
    {
      name: 'income',
      description: `Money earned in a period, optionally for one category or account. Amounts are in ${currency}. Transfers between your own accounts are not income.`,
      parameters: {
        type: 'object',
        properties: {
          ...periodSchema,
          category: { type: 'string', description: 'An exact income category name, such as "Salary".' },
          account: { type: 'string', description: 'An account name.' },
          group_by: { type: 'string', enum: ['category', 'month', 'none'], description: 'Defaults to none.' },
        },
      },
      run: args => {
        const scope = withScope(args);
        if ('error' in scope) return { error: scope.error };
        const rows = scope.pool.filter(tx => tx.type === 'income' && isCounted(tx, showAdjustments) && tx.date >= scope.period.start && tx.date <= scope.period.end && inScope(tx, scope.filters, data.incomeCategories));
        const total = sum(rows.map(amountOf));
        const by = ['category', 'month'].includes(args.group_by) ? args.group_by : 'none';
        const { groups, more } = groupRows(rows, by, 12);
        return {
          currency, period: scope.period, total: round2(total), total_display: money(total), transaction_count: rows.length,
          ...(by !== 'none' ? { grouped_by: by, groups, more_groups: more } : {}),
          ...(scope.categoryNote ? { note: scope.categoryNote } : {}),
          summary: describe(scope, 'Earned', total, rows.length),
        };
      },
    },
    {
      name: 'search_transactions',
      description: `Individual transactions, newest first or largest first. Use for "what did I pay X" or "my biggest purchases". At most 25 rows. Amounts are in ${currency}; spending is negative.`,
      parameters: {
        type: 'object',
        properties: {
          ...periodSchema,
          query: { type: 'string', description: 'Part of a merchant name or description.' },
          category: { type: 'string', description: 'An exact category name.' },
          account: { type: 'string', description: 'An account name.' },
          type: { type: 'string', enum: ['expense', 'income', 'any'], description: 'Defaults to any.' },
          min_amount: { type: 'number', description: `Smallest absolute amount, in ${currency}.` },
          max_amount: { type: 'number', description: `Largest absolute amount, in ${currency}.` },
          sort: { type: 'string', enum: ['newest', 'largest'], description: 'Defaults to newest.' },
          limit: { type: 'integer', description: 'At most 25. Defaults to 10.' },
        },
      },
      run: args => {
        const scope = withScope({ ...args, merchant: undefined });
        if ('error' in scope) return { error: scope.error };
        const query = plain(args.query);
        const type = args.type === 'expense' || args.type === 'income' ? args.type : 'any';
        let rows = scope.pool.filter(tx => isCounted(tx, showAdjustments) && tx.date >= scope.period.start && tx.date <= scope.period.end
          && (type === 'any' || tx.type === type)
          && (scope.filters.category === 'all' || categoryMatches(tx.category, scope.filters.category, [...data.expenseCategories, ...data.incomeCategories]))
          && (scope.filters.accountId === 'all' || tx.accountId === scope.filters.accountId)
          && (!query || plain(tx.merchant).includes(query) || plain(tx.description).includes(query))
          && (args.min_amount === undefined || amountOf(tx) >= Number(args.min_amount))
          && (args.max_amount === undefined || amountOf(tx) <= Number(args.max_amount)));
        const matching = rows.length;
        rows = [...rows].sort(args.sort === 'largest' ? (a, b) => amountOf(b) - amountOf(a) : (a, b) => b.date.localeCompare(a.date));
        const shown = rows.slice(0, limitOf(args.limit, 10, 25)).map(tx => {
          const signed = tx.type === 'expense' ? -amountOf(tx) : amountOf(tx);
          return {
            date: tx.date, name: merchantOf(tx), category: tx.category, account: accounts.find(a => a.id === tx.accountId)?.name ?? '',
            amount: round2(signed), display: money(signed),
            ...(tx.currency !== currency ? { original: formatCurrency(Math.abs(tx.amount), tx.currency) } : {}),
          };
        });
        return {
          currency, period: scope.period, matching, showing: shown.length, transactions: shown,
          ...(scope.categoryNote ? { note: scope.categoryNote } : {}),
          summary: `${count(matching, 'matching transaction')} ${scope.period.label}; showing ${shown.length}.`,
        };
      },
    },
    {
      name: 'budget_status',
      description: `How each monthly budget is going for one month: budget, spent, left and the share used. Amounts in ${currency}.`,
      parameters: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM. Defaults to the current month.' } } },
      run: args => {
        const period = resolvePeriod({ month: args.month ?? iso(today).slice(0, 7) }, today);
        if ('error' in period) return { error: period.error };
        if (data.budgets.length === 0) return { currency, budgets: [], summary: 'No budgets are set up.' };
        const rows = expensesIn(scoped, { startDate: period.start, endDate: period.end, merchant: '', category: 'all', accountId: 'all' }, showAdjustments, period.start, period.end, data.expenseCategories);
        const items = budgetAgainstActual(rows, data.budgets, period.start, period.end, data.expenseCategories).map(item => ({
          category: item.categoryName,
          budget: round2(item.budgetEur), budget_display: money(item.budgetEur),
          spent: round2(item.actualEur), spent_display: money(item.actualEur),
          left: round2(item.varianceEur), left_display: money(item.varianceEur),
          percent_used: item.budgetEur > 0 ? Math.round((item.actualEur / item.budgetEur) * 100) : null,
          over_budget: item.varianceEur < 0,
        })).sort((a, b) => (b.percent_used ?? 0) - (a.percent_used ?? 0));
        const over = items.filter(item => item.over_budget);
        return {
          currency, period, budgets: items, over_budget_count: over.length,
          summary: `${count(items.length, 'budget')} for ${period.label}; ${over.length} over budget${over.length ? ` (${over.map(o => o.category).join(', ')})` : ''}.`,
        };
      },
    },
    {
      name: 'safe_to_spend',
      description: `How much can be spent now without going short before the next income, after upcoming bills and the cushion. In ${currency}.`,
      parameters: { type: 'object', properties: {} },
      run: () => {
        const safe = computeSafeToSpend({ accounts, transactions, recurringItems: recurringItems(), bills: data.bills, overrides: data.recurringOverrides, cushion, referenceDate: today });
        return {
          currency, safe_to_spend: round2(safe.amount), safe_to_spend_display: money(safe.amount), per_day: round2(safe.perDay), per_day_display: money(safe.perDay),
          cash: round2(safe.cash), cash_display: money(safe.cash), upcoming_payments: round2(safe.upcoming), upcoming_payments_display: money(safe.upcoming),
          cushion: round2(safe.cushion), until: safe.until, days_left: safe.daysLeft, until_reason: safe.untilReason === 'income' ? 'the next income' : 'the end of the month',
          next_payments: safe.payments.slice(0, 5).map(p => ({ date: p.date, description: p.description, amount: round2(p.amount), display: money(p.amount) })),
          summary: `${money(safe.amount)} is safe to spend until ${safe.until} (${safe.daysLeft} days, about ${money(safe.perDay)} a day), from ${money(safe.cash)} cash less ${money(safe.upcoming)} of upcoming payments and a ${money(safe.cushion)} cushion.`,
        };
      },
    },
    {
      name: 'forecast',
      description: `The projected balance of the main accounts from scheduled income, bills and recurring payments (not goals): where it ends, its lowest point and the biggest items ahead. In ${currency}.`,
      parameters: { type: 'object', properties: { until: { type: 'string', description: 'End date YYYY-MM-DD, at most two years ahead.' }, days: { type: 'integer', description: 'Days ahead if no end date. Defaults to 60, at most 730.' } } },
      run: args => {
        let end: Date;
        if (args.until !== undefined) {
          if (!isIsoDate(args.until)) return { error: 'until must be a date written YYYY-MM-DD.' };
          end = parseLocalDate(args.until);
        } else {
          end = addDays(today, limitOf(args.days, 60, 730));
        }
        if (end <= today) return { error: 'The end date must be after today.' };
        if (end > addDays(today, 730)) return { error: 'The forecast looks at most two years ahead.' };
        const projection = project(end);
        if (projection.days.length === 0) return { error: 'There is nothing to forecast: no main account was found.' };
        const low = projection.days.reduce((min, day) => (day.total < min.total ? day : min), projection.days[0]);
        const last = projection.days[projection.days.length - 1];
        return {
          currency, accounts: forecastAccounts().map(a => a.name), from: iso(today), to: last.date,
          balance_today: round2(projection.start), balance_today_display: money(projection.start),
          balance_at_end: round2(last.total), balance_at_end_display: money(last.total),
          lowest_balance: round2(low.total), lowest_balance_display: money(low.total), lowest_balance_date: low.date,
          biggest_items: biggestAhead(projection.events, 5).map(e => ({ date: e.date, description: e.description, amount: round2(e.amount), display: money(e.amount) })),
          summary: `Across ${forecastAccounts().map(a => a.name).join(', ')}: ${money(projection.start)} today, ${money(last.total)} on ${last.date}, lowest ${money(low.total)} on ${low.date}.`,
        };
      },
    },
    {
      name: 'can_afford',
      description: `Whether a one-off purchase fits: the projected balance with the purchase taken out on its date, its lowest point afterwards, and whether that dips below zero or below the cushion. Amount in ${currency}.`,
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: `The price, in ${currency}.` },
          date: { type: 'string', description: 'When it is paid, YYYY-MM-DD. Defaults to today.' },
        },
        required: ['amount'],
      },
      run: args => {
        const amount = Number(args.amount);
        if (!Number.isFinite(amount) || amount <= 0) return { error: 'amount must be a positive number.' };
        const date = args.date === undefined ? iso(today) : args.date;
        if (!isIsoDate(date)) return { error: 'date must be written YYYY-MM-DD.' };
        if (date < iso(today)) return { error: 'The date cannot be in the past.' };
        const payDate = parseLocalDate(date);
        if (payDate > addDays(today, 700)) return { error: 'The forecast looks at most two years ahead.' };
        const horizon = addDays(payDate, 45);
        const projection = project(horizon);
        const upto = projection.days.filter(day => day.date <= date);
        const onDay = upto.length ? upto[upto.length - 1].total : projection.start;
        const after = projection.days.filter(day => day.date >= date);
        const lowestBase = after.length ? after.reduce((min, day) => (day.total < min.total ? day : min), after[0]) : { total: onDay, date };
        const lowestAfter = round2(lowestBase.total - amount);
        const alreadyBelowZero = lowestBase.total < 0;
        const belowZero = lowestAfter < 0;
        const belowCushion = lowestAfter < cushion;
        // Say whose fault a shortfall is: the purchase's, or one already on its way without it.
        const verdict = alreadyBelowZero
          ? `Even without this purchase the balance is projected to fall to ${money(lowestBase.total)} on ${lowestBase.date}. Paying ${money(amount)} on ${date} would make that ${money(lowestAfter)}.`
          : belowZero
            ? `Paying ${money(amount)} on ${date} would take the balance to ${money(lowestAfter)} on ${lowestBase.date}, below zero. Without it the lowest point is ${money(lowestBase.total)}.`
            : belowCushion
              ? `Paying ${money(amount)} on ${date} keeps the balance above zero, but its lowest point, ${money(lowestAfter)} on ${lowestBase.date}, is below your ${money(cushion)} cushion.`
              : `Paying ${money(amount)} on ${date} fits: the balance never drops below ${money(lowestAfter)} (on ${lowestBase.date}), above your ${money(cushion)} cushion.`;
        return {
          currency, accounts: forecastAccounts().map(a => a.name), amount: round2(amount), date,
          balance_on_date: round2(onDay), balance_on_date_display: money(onDay),
          balance_on_date_after_purchase: round2(onDay - amount), balance_on_date_after_purchase_display: money(onDay - amount),
          lowest_balance_without_purchase: round2(lowestBase.total), lowest_balance_without_purchase_display: money(lowestBase.total), already_below_zero_without_purchase: alreadyBelowZero,
          lowest_balance_after_purchase: lowestAfter, lowest_balance_after_purchase_display: money(lowestAfter), lowest_balance_date: lowestBase.date,
          cushion: round2(cushion), goes_below_zero: belowZero, goes_below_cushion: belowCushion,
          based_on: 'scheduled income, bills and recurring payments; goal contributions and one-off spending not yet entered are not included',
          summary: verdict,
        };
      },
    },
    {
      name: 'subscriptions',
      description: `Active subscriptions and recurring services: monthly and yearly cost, the dearest ones and anything worth a second look. In ${currency}.`,
      parameters: { type: 'object', properties: {} },
      run: () => {
        // Services only, as on the Subscriptions page: rent, loans and tax are not subscriptions.
        const active = services(data.recurringTransactions).filter(rt => serviceStatus(rt, today) === 'active' && isDigitalOrService(rt));
        const totals = serviceTotals(active, today, convertToMain);
        const audit = subscriptionAudit(active, transactions, today, convertToMain, data.preferences.ignoredSubscriptions ?? []);
        return {
          currency, count: active.length, monthly: round2(totals.monthly), monthly_display: money(totals.monthly), yearly: round2(totals.yearly), yearly_display: money(totals.yearly),
          dearest: audit.priciest.map(p => ({ name: p.service.merchant || p.service.description, yearly: round2(p.yearly), yearly_display: money(p.yearly) })),
          worth_a_look: audit.findings.map(f => f.title),
          summary: `${count(active.length, 'active subscription')} cost${active.length === 1 ? 's' : ''} ${money(totals.monthly)} a month, ${money(totals.yearly)} a year.${audit.findings.length ? ` ${audit.findings.length} worth a look.` : ''}`,
        };
      },
    },
    {
      name: 'net_worth_history',
      description: `Net worth month by month, oldest first, with the change over the span. In ${currency}.`,
      parameters: { type: 'object', properties: { months: { type: 'integer', description: 'How many months back, at most 60. Defaults to 12.' } } },
      run: args => {
        const months = limitOf(args.months, 12, 60);
        const { history } = netWorthHistory(accounts, transactions, today);
        const toMain = (value: number) => convertCurrency(value, 'EUR', currency);
        const points = history.slice(0, months + 1).reverse().map(point => ({ month: point.date, value: round2(toMain(point.value)), display: money(toMain(point.value)) }));
        if (points.length < 2) return { currency, points, summary: 'There is not enough history.' };
        const change = points[points.length - 1].value - points[0].value;
        return {
          currency, points, change: round2(change), change_display: money(change),
          change_percent: points[0].value > 0 ? round2((change / points[0].value) * 100) : null,
          summary: `Net worth went from ${points[0].display} (${points[0].month}) to ${points[points.length - 1].display} (${points[points.length - 1].month}), a change of ${money(change)}.`,
        };
      },
    },
  ];
  return tools;
};

export const toolSpecs = (tools: AssistantTool[]) => tools.map(tool => ({ type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
