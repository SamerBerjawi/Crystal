import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, BillPayment, RecurringTransaction, Transaction } from '../../types';
import { OVERVIEW_LAYOUT_KEY, resolveOverviewLayout } from '../../utils/overviewLayout';
import { buildSummaryFacts, isUncategorised, suggestCategories } from '../../utils/overviewSummary';
import { computeSafeToSpend, spendingAccounts } from '../../utils/safeToSpend';

const account = (overrides: Partial<Account>): Account => ({
  id: 'main',
  name: 'Main',
  type: 'Checking',
  balance: 1000,
  currency: 'EUR',
  isPrimary: true,
  ...overrides,
} as Account);

const recurring = (overrides: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 'r1',
  accountId: 'main',
  description: 'Rent',
  amount: 300,
  type: 'expense',
  currency: 'EUR',
  frequency: 'monthly',
  startDate: '2026-01-10',
  nextDueDate: '2026-11-10',
  ...overrides,
} as RecurringTransaction);

const today = new Date(2026, 10, 1);

test('spendingAccounts takes the primary checking and cash accounts only', () => {
  const result = spendingAccounts([
    account({}),
    account({ id: 'second', isPrimary: false }),
    account({ id: 'savings', type: 'Savings', isPrimary: false }),
    account({ id: 'wallet', type: 'Other Assets', otherSubType: 'Cash', isPrimary: false }),
    account({ id: 'hidden-cash', type: 'Other Assets', otherSubType: 'Cash', isPrimary: false, includeInAnalytics: false }),
  ]);
  assert.deepEqual(result.map(item => item.id), ['main', 'wallet']);
});

test('spendingAccounts falls back to every checking account when none is primary', () => {
  const result = spendingAccounts([account({ isPrimary: false }), account({ id: 'second', isPrimary: false })]);
  assert.equal(result.length, 2);
});

test('safe to spend counts what falls before the next income, and not on it', () => {
  const result = computeSafeToSpend({
    accounts: [account({})],
    transactions: [],
    recurringItems: [
      recurring({ id: 'pay', type: 'income', amount: 2000, description: 'Salary', nextDueDate: '2026-11-15' }),
      recurring({ id: 'before', nextDueDate: '2026-11-10' }),
      recurring({ id: 'payday', amount: 50, nextDueDate: '2026-11-15' }),
      recurring({ id: 'after', amount: 70, nextDueDate: '2026-11-20' }),
    ],
    bills: [],
    referenceDate: today,
  });
  assert.equal(result.until, '2026-11-15');
  assert.equal(result.untilReason, 'income');
  assert.equal(result.upcoming, 300);
  assert.equal(result.amount, 700);
  assert.equal(result.daysLeft, 14);
  assert.equal(result.perDay, 50);
});

test('safe to spend runs to the end of the month without scheduled income', () => {
  const result = computeSafeToSpend({ accounts: [account({})], transactions: [], recurringItems: [recurring({ nextDueDate: '2026-11-30' })], bills: [], referenceDate: today });
  assert.equal(result.until, '2026-11-30');
  assert.equal(result.untilReason, 'monthEnd');
  assert.equal(result.upcoming, 300);
});

test('safe to spend takes off the cushion and unpaid bills, including overdue ones', () => {
  const bill = { id: 'b1', description: 'Water', amount: -40, type: 'payment', status: 'unpaid', dueDate: '2026-10-28', accountId: 'main', currency: 'EUR' } as BillPayment;
  const paid = { ...bill, id: 'b2', status: 'paid' } as BillPayment;
  const result = computeSafeToSpend({ accounts: [account({})], transactions: [], recurringItems: [], bills: [bill, paid], cushion: 100, referenceDate: today });
  assert.equal(result.upcoming, 40);
  assert.equal(result.amount, 860);
});

test('safe to spend ignores transfers between spending accounts', () => {
  const result = computeSafeToSpend({
    accounts: [account({}), account({ id: 'wallet', type: 'Other Assets', otherSubType: 'Cash', isPrimary: false, balance: 50 })],
    transactions: [],
    recurringItems: [recurring({ type: 'transfer', toAccountId: 'wallet', nextDueDate: '2026-11-05' })],
    bills: [],
    referenceDate: today,
  });
  assert.equal(result.upcoming, 0);
  assert.equal(result.cash, 1050);
});

test('safe to spend can go negative, and then there is no daily figure', () => {
  const result = computeSafeToSpend({ accounts: [account({ balance: 100 })], transactions: [], recurringItems: [recurring({ nextDueDate: '2026-11-05' })], bills: [], referenceDate: today });
  assert.equal(result.amount, -200);
  assert.equal(result.perDay, 0);
});

test('summary states up to three facts with correct grammar', () => {
  assert.deepEqual(buildSummaryFacts({ incomeYesterday: null, billsDue: 0, toReview: 0 }), []);
  assert.equal(buildSummaryFacts({ incomeYesterday: '€412.00', billsDue: 3, toReview: 5 }).length, 3);
  assert.equal(buildSummaryFacts({ incomeYesterday: '€1.00', billsDue: 1, toReview: 1, tasksDue: 2 }).length, 3);
  assert.equal(buildSummaryFacts({ incomeYesterday: null, billsDue: 0, toReview: 0, tasksDue: 2 })[0].link, '2 tasks');
  assert.equal(buildSummaryFacts({ incomeYesterday: null, billsDue: 1, toReview: 0 })[0].rest, ' is due soon');
  assert.equal(buildSummaryFacts({ incomeYesterday: null, billsDue: 0, toReview: 1 })[0].rest, ' needs review');
});

test('transfers and balance adjustments are never uncategorised', () => {
  assert.equal(isUncategorised({ category: '' } as Transaction), true);
  assert.equal(isUncategorised({ category: 'Uncategorized' } as Transaction), true);
  assert.equal(isUncategorised({ category: '', transferId: 't' } as Transaction), false);
  assert.equal(isUncategorised({ category: 'Food' } as Transaction), false);
});

test('a new user gets the curated layout', () => {
  const layout = resolveOverviewLayout({}, false);
  assert.equal(layout[0].id, 'safeToSpend');
  assert.ok(!layout.some(widget => widget.id === 'transactionMap'));
});

test('a saved layout wins, and unknown widgets are dropped', () => {
  const layout = resolveOverviewLayout({ dashboardLayouts: { [OVERVIEW_LAYOUT_KEY]: [{ id: 'todayWidget', title: 'x', x: 0, y: 0, w: 2, h: 4 }, { id: 'gone', title: 'y', x: 1, y: 0, w: 2, h: 4 }] } }, false);
  assert.deepEqual(layout.map(widget => widget.id), ['todayWidget']);
});

test('old tabs carry over in order, at half the column count, without removed widgets', () => {
  const layout = resolveOverviewLayout({
    dashboardLayouts: {
      'overview-pc': [
        { id: 'netWorthOverTime', title: '', x: 0, y: 2, w: 12, h: 2 },
        { id: 'todayWidget', title: '', x: 0, y: 0, w: 6, h: 2 },
      ],
    },
    dashboardHiddenWidgets: { 'activity-pc': ['transactionMap'] },
  }, false);
  const ids = layout.map(widget => widget.id);
  assert.deepEqual(ids.slice(0, 3), ['safeToSpend', 'todayWidget', 'netWorthOverTime']);
  assert.equal(layout[1].w, 3);
  assert.equal(layout[2].w, 6);
  assert.ok(!ids.includes('transactionMap'));
  assert.ok(ids.includes('wealthVelocity'));
});

test('category suggestions put the rule first, then the merchant, then the kind, and never Transfer', () => {
  const tx = (merchant: string, category: string, type = 'expense') => ({ merchant, category, type }) as Transaction;
  const history = [tx('Shop', 'Food'), tx('Shop', 'Food'), tx('Shop', 'Gifts'), tx('Other', 'Fuel'), tx('Other', 'Transfer'), tx('Boss', 'Salary', 'income')];
  assert.deepEqual(suggestCategories(tx('Shop', ''), history, 'Treats'), ['Treats', 'Food', 'Gifts']);
  assert.deepEqual(suggestCategories(tx('Nobody', ''), history), ['Food', 'Gifts', 'Fuel']);
});
