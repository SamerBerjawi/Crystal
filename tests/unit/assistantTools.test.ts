import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Budget, Category, RecurringTransaction, Transaction } from '../../types';
import { setMainCurrency } from '../../utils';
import { buildAssistantTools, resolveCategory, resolvePeriod, toolSpecs, type AssistantData } from '../../utils/assistantTools';
import { computeSafeToSpend } from '../../utils/safeToSpend';

setMainCurrency('EUR');
const today = new Date(2026, 10, 7); // Saturday 7 November 2026

const account = (over: Partial<Account>): Account => ({ id: 'chk', name: 'Everyday', type: 'Checking', balance: 1000, currency: 'EUR', isPrimary: true, ...over } as Account);
const cat = (name: string, subCategories: Category[] = []): Category => ({ id: name, name, color: '#000', classification: 'expense', subCategories });
let n = 0;
const tx = (date: string, amount: number, category: string, merchant: string, over: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++n}`, accountId: 'chk', date, description: merchant, merchant, amount: -amount, category, type: 'expense', currency: 'EUR', ...over }) as Transaction;
const pay = (date: string, amount: number): Transaction => tx(date, -amount, 'Salary', 'Employer', { type: 'income', amount });

const ledger: Transaction[] = [
  tx('2026-10-03', 120, 'Groceries', 'Albert Heijn'),
  tx('2026-10-17', 80, 'Groceries', 'Lidl'),
  tx('2026-10-10', 60, 'Dining', 'Pasta Place'),
  tx('2026-10-24', 40, 'Dining', 'Burger Joint'),
  tx('2026-10-05', 900, 'Rent', 'Landlord'),
  tx('2026-10-30', 500, 'Dining', 'Transfer out', { transferId: 'x' }),
  tx('2026-11-02', 30, 'Dining', 'Pasta Place'),
  tx('2026-09-12', 70, 'Dining', 'Pasta Place'),
  pay('2026-10-28', 2500),
];

const recurring = (over: Partial<RecurringTransaction>): RecurringTransaction =>
  ({ id: 'r', accountId: 'chk', description: 'Rent', merchant: 'Landlord', amount: 800, type: 'expense', currency: 'EUR', frequency: 'monthly', startDate: '2026-01-10', nextDueDate: '2026-11-10', weekendAdjustment: 'on', ...over }) as RecurringTransaction;

const base = (over: Partial<AssistantData> = {}): AssistantData => ({
  accounts: [account({}), account({ id: 'sav', name: 'Rainy day', type: 'Savings', balance: 5000, isPrimary: false })],
  transactions: ledger,
  incomeCategories: [{ ...cat('Salary'), classification: 'income' }],
  expenseCategories: [cat('Food', [cat('Groceries'), cat('Dining')]), cat('Rent'), cat('Transport')],
  budgets: [{ id: 'b1', categoryName: 'Food', amount: 400, period: 'monthly', currency: 'EUR' } as Budget, { id: 'b2', categoryName: 'Rent', amount: 850, period: 'monthly', currency: 'EUR' } as Budget],
  recurringTransactions: [recurring({})],
  recurringOverrides: [], bills: [], loanPaymentOverrides: {}, warrants: [], goals: [],
  preferences: { showBalanceAdjustments: true } as any,
  today,
  ...over,
});

const run = (name: string, args: Record<string, any> = {}, data = base()): any => buildAssistantTools(data).find(t => t.name === name)!.run(args);

test('periods are worked out in code, not by the model', () => {
  assert.deepEqual(resolvePeriod({ period: 'last_month' }, today), { start: '2026-10-01', end: '2026-10-31', label: 'last month' });
  assert.deepEqual(resolvePeriod({}, today), { start: '2026-11-01', end: '2026-11-07', label: 'this month so far' });
  assert.deepEqual(resolvePeriod({ period: 'last_7_days' }, today), { start: '2026-11-01', end: '2026-11-07', label: 'the last 7 days' });
  assert.equal((resolvePeriod({ period: 'last_12_months' }, today) as any).start, '2025-11-08');
  assert.equal((resolvePeriod({ period: 'last_year' }, today) as any).end, '2025-12-31');
  assert.deepEqual(resolvePeriod({ month: '2026-02' }, today), { start: '2026-02-01', end: '2026-02-28', label: 'February 2026' });
  assert.equal((resolvePeriod({ month: '2026-13' }, today) as any).error.includes('YYYY-MM'), true);
  assert.equal('error' in resolvePeriod({ start: '2026-03-01', end: '2026-02-01' }, today), true);
  assert.equal('error' in resolvePeriod({ start: '2026-02-30', end: '2026-03-01' }, today), true, 'an impossible date');
  assert.equal('error' in resolvePeriod({ period: 'sometime' }, today), true);
});

test('categories match exactly or uniquely, and never guess', () => {
  const cats = base().expenseCategories;
  assert.deepEqual(resolveCategory('groceries', cats), { name: 'Groceries' });
  assert.equal((resolveCategory('dini', cats) as any).name, 'Dining');
  const missing = resolveCategory('eating out', cats) as any;
  assert.match(missing.error, /no category called "eating out"/);
  assert.match(missing.error, /Food/);
  assert.match(missing.error, /Dining/, 'sub-categories are listed too, so the model can find "eating out"');
});

test('spending adds up what the Reports page counts, and leaves transfers out', () => {
  const result = run('spending', { period: 'last_month' });
  assert.equal(result.total, 120 + 80 + 60 + 40 + 900, 'the 500 transfer is not spending');
  assert.equal(result.transaction_count, 5);
  assert.equal(result.total_display, '€1,200.00');
  assert.match(result.summary, /Spent €1,200\.00 last month/);
});

test('a parent category includes its sub-categories, and the match is reported', () => {
  const food = run('spending', { period: 'last_month', category: 'Food' });
  assert.equal(food.total, 300);
  const dining = run('spending', { month: '2026-10', category: 'dining' });
  assert.equal(dining.total, 100);
  assert.match(dining.summary, /in Dining/);
  const partial = run('spending', { period: 'last_month', category: 'grocer' });
  assert.equal(partial.total, 200);
  assert.match(partial.note, /matched to the category "Groceries"/);
});

test('an unknown category is an error with the real names, not a zero', () => {
  const result = run('spending', { period: 'last_month', category: 'eating out' });
  assert.equal(result.total, undefined);
  assert.match(result.error, /Dining/);
});

test('breakdowns are ordered and capped', () => {
  const byCategory = run('spending', { period: 'last_month', group_by: 'category', limit: 2 });
  assert.deepEqual(byCategory.groups.map((g: any) => g.name), ['Rent', 'Groceries']);
  assert.equal(byCategory.more_groups, 1);
  const byMonth = run('spending', { start: '2026-09-01', end: '2026-11-07', category: 'Dining', group_by: 'month' });
  assert.deepEqual(byMonth.groups.map((g: any) => [g.name, g.amount]), [['2026-09', 70], ['2026-10', 100], ['2026-11', 30]]);
  const byMerchant = run('spending', { period: 'last_month', category: 'Dining', group_by: 'merchant' });
  assert.equal(byMerchant.groups[0].name, 'Pasta Place');
});

test('merchant and account filters narrow the total', () => {
  assert.equal(run('spending', { start: '2026-01-01', end: '2026-11-07', merchant: 'pasta' }).total, 160);
  assert.equal(run('spending', { period: 'last_month', account: 'everyday' }).total, 1200);
  assert.match(run('spending', { period: 'last_month', account: 'nope' }).error, /no account called "nope"/);
});

test('income, transactions and the biggest purchases', () => {
  assert.equal(run('income', { period: 'last_month' }).total, 2500);
  const big = run('search_transactions', { period: 'last_month', type: 'expense', sort: 'largest', limit: 2 });
  assert.deepEqual(big.transactions.map((t: any) => t.name), ['Landlord', 'Albert Heijn']);
  assert.equal(big.transactions[0].amount, -900);
  assert.equal(big.matching, 5, 'the transfer is excluded from the count');
  const mid = run('search_transactions', { period: 'last_month', type: 'expense', min_amount: 50, max_amount: 100 });
  assert.deepEqual(mid.transactions.map((t: any) => t.name).sort(), ['Lidl', 'Pasta Place']);
  assert.equal(run('search_transactions', { period: 'last_month', query: 'lidl' }).transactions.length, 1);
});

test('budgets show what is used and what is over', () => {
  const result = run('budget_status', { month: '2026-10' });
  const food = result.budgets.find((b: any) => b.category === 'Food');
  assert.equal(food.spent, 300);
  assert.equal(food.left, 100);
  assert.equal(food.percent_used, 75);
  const rent = result.budgets.find((b: any) => b.category === 'Rent');
  assert.equal(rent.over_budget, true);
  assert.equal(result.over_budget_count, 1);
  assert.equal(result.budgets[0].category, 'Rent', 'the most used comes first');
  assert.match(run('budget_status', {}, base({ budgets: [] })).summary, /No budgets/);
});

test('summaries read naturally with one of something', () => {
  assert.match(run('budget_status', { month: '2026-10' }).summary, /^2 budgets for October 2026/);
  assert.match(run('budget_status', { month: '2026-10' }, base({ budgets: [base().budgets[0]] })).summary, /^1 budget for October 2026/);
  assert.match(run('list_accounts', {}, base({ accounts: [account({})] })).summary, /^1 open account\./);
});

test('safe to spend is the same number the Overview shows', () => {
  const data = base();
  const expected = computeSafeToSpend({ accounts: data.accounts, transactions: data.transactions, recurringItems: data.recurringTransactions, bills: [], overrides: [], cushion: 0, referenceDate: today });
  const result = run('safe_to_spend', {}, data);
  assert.equal(result.safe_to_spend, Math.round(expected.amount * 100) / 100);
  assert.equal(result.until, expected.until);
  assert.ok(result.summary.includes(result.safe_to_spend_display));
});

test('the forecast finds the lowest point and the biggest items ahead', () => {
  const result = run('forecast', { days: 30 });
  assert.equal(result.balance_today, 1000);
  assert.equal(result.lowest_balance, 200, 'the 800 rent on 10 November');
  assert.equal(result.lowest_balance_date, '2026-11-10');
  assert.equal(result.biggest_items[0].description, 'Landlord');
  assert.deepEqual(result.accounts, ['Everyday'], 'the primary account, like the Forecast page');
  assert.match(run('forecast', { until: '2030-01-01' }).error, /two years/);
  assert.equal(run('forecast', { days: 5000 }).to, '2028-11-06', 'a long span is trimmed to two years rather than refused');
  assert.match(run('forecast', { until: '2026-01-01' }).error, /after today/);
});

const salary = recurring({ id: 'pay', description: 'Salary', merchant: 'Employer', type: 'income', amount: 2500, nextDueDate: '2026-11-25' });

test('can afford says exactly where the balance goes, and why', () => {
  const data = base({ recurringTransactions: [recurring({}), salary] });
  const small = run('can_afford', { amount: 100, date: '2026-11-08' }, data);
  assert.equal(small.lowest_balance_without_purchase, 200, '1000 less 800 rent on the 10th, before the salary');
  assert.equal(small.lowest_balance_after_purchase, 100);
  assert.equal(small.goes_below_zero, false);
  assert.match(small.summary, /fits/);

  const tight = run('can_afford', { amount: 300, date: '2026-11-08' }, data);
  assert.equal(tight.lowest_balance_after_purchase, -100);
  assert.equal(tight.goes_below_zero, true);
  assert.equal(tight.already_below_zero_without_purchase, false);
  assert.equal(tight.lowest_balance_date, '2026-11-10');
  assert.match(tight.summary, /would take the balance to .*below zero/);

  const cushioned = run('can_afford', { amount: 100, date: '2026-11-08' }, base({ recurringTransactions: [recurring({}), salary], preferences: { safeToSpendCushion: 500 } as any }));
  assert.equal(cushioned.goes_below_zero, false);
  assert.equal(cushioned.goes_below_cushion, true);
  assert.match(cushioned.summary, /below your/);

  assert.match(run('can_afford', { amount: -5 }).error, /positive/);
  assert.match(run('can_afford', { amount: 5, date: '2026-01-01' }).error, /past/);
  assert.match(run('can_afford', { amount: 5, date: 'next march' }).error, /YYYY-MM-DD/);
});

test('a shortfall that was already coming is not blamed on the purchase', () => {
  // Rent only, no income: the balance is heading below zero whatever is bought.
  const result = run('can_afford', { amount: 100, date: '2026-11-08' });
  assert.equal(result.already_below_zero_without_purchase, true);
  assert.equal(result.lowest_balance_without_purchase, -600, 'two rents, 10 Nov and 10 Dec');
  assert.equal(result.lowest_balance_after_purchase, -700);
  assert.match(result.summary, /Even without this purchase/);
});

test('subscriptions and net worth', () => {
  const data = base({ recurringTransactions: [recurring({ id: 'nf', description: 'Netflix', merchant: 'Netflix', amount: 12, category: 'Streaming' }), recurring({ id: 'old', description: 'Gym', merchant: 'Gym', amount: 30, endDate: '2026-01-01' }), recurring({ id: 'rent', description: 'Rent', merchant: 'Landlord', amount: 900, category: 'Rent' })] });
  const subs = run('subscriptions', {}, data);
  assert.equal(subs.count, 1, 'a cancelled one is not active, and rent is not a subscription');
  assert.equal(subs.monthly, 12);
  assert.equal(subs.yearly, 144);
  const worth = run('net_worth_history', { months: 3 });
  assert.equal(worth.points.length, 4);
  assert.equal(typeof worth.change, 'number');
  assert.match(worth.summary, /Net worth went from/);
});

test('the overview and account list are consistent with the accounts', () => {
  const overview = run('get_overview');
  assert.equal(overview.currency, 'EUR');
  assert.equal(overview.spending_this_month, 30);
  assert.equal(overview.income_this_month, 0);
  assert.equal(overview.total_assets, 6000);
  assert.equal(run('list_accounts').count, 2);
  assert.deepEqual(run('list_categories').categories.slice(0, 3), ['Food', 'Food > Groceries', 'Food > Dining']);
});

test('every tool is described for the model', () => {
  const specs = toolSpecs(buildAssistantTools(base()));
  assert.equal(specs.length, 12);
  for (const spec of specs) {
    assert.equal(spec.type, 'function');
    assert.match(spec.function.name, /^[a-z_]+$/);
    assert.ok(spec.function.description.length > 20, spec.function.name);
    assert.equal((spec.function.parameters as any).type, 'object');
  }
  assert.deepEqual((specs.find(s => s.function.name === 'can_afford')!.function.parameters as any).required, ['amount']);
});
