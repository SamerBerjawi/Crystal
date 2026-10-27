import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Budget, Category, FinancialGoal, Transaction } from '../../types';
import {
  allocation, autofillPlan, averageMonthlySpend, budgetAccountIds, budgetLines, budgetSuggestions, dailyAllowance, friendlyAmount,
  goalViews, monthBounds, monthPace, parseAmount, projectedSpend, shiftMonth, sortLines, spendByCategory, summarize, unbudgeted,
} from '../../utils/budgetModel';

const identity = (amount: number) => amount;
const usdToEur = (amount: number, currency: string) => (currency === 'USD' ? amount * 0.5 : amount);

const cat = (name: string, subs: string[] = []): Category => ({
  id: name, name, color: 'red', classification: 'expense', subCategories: subs.map(s => ({ id: s, name: s, color: 'red', classification: 'expense', subCategories: [], parentId: name })),
});
const categories = [cat('Food', ['Groceries', 'Restaurants']), cat('Transport', ['Fuel']), cat('Shopping')];

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', accountId: 'a1', date: '2026-10-10', description: '', amount: -10, category: 'Groceries', type: 'expense', currency: 'EUR', ...over,
});

const accounts = [
  { id: 'a1', type: 'Checking' }, { id: 'a2', type: 'Credit Card' }, { id: 'inv', type: 'Investment' },
] as { id: string; type: never }[];
const accountIds = budgetAccountIds(accounts);
const opts = { accountIds, categories, convert: usdToEur };

const budget = (categoryName: string, amount: number, over: Partial<Budget> = {}): Budget => ({ id: `b-${categoryName}`, categoryName, amount, period: 'monthly', currency: 'EUR', ...over });

test('months shift across years and bound the whole month', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 2), { year: 2027, month: 1 });
  assert.deepEqual(monthBounds({ year: 2024, month: 1 }), { from: '2024-02-01', to: '2024-02-29' });
});

test('pace counts today as a day still to spend in', () => {
  const today = new Date(2026, 9, 27);
  assert.deepEqual(monthPace({ year: 2026, month: 9 }, today), { days: 31, elapsed: 27, left: 5, elapsedPct: (27 / 31) * 100, when: 'current' });
  assert.equal(monthPace({ year: 2026, month: 8 }, today).left, 0);
  assert.equal(monthPace({ year: 2026, month: 10 }, today).elapsed, 0);
  assert.equal(projectedSpend(270, monthPace({ year: 2026, month: 9 }, today)), 310);
  assert.equal(dailyAllowance(50, monthPace({ year: 2026, month: 9 }, today)), 10);
  assert.equal(dailyAllowance(50, monthPace({ year: 2026, month: 8 }, today)), 0);
});

test('spend rolls sub-categories into parents and skips what is not spending', () => {
  const data = [
    tx({ id: 'g', amount: -40 }),
    tx({ id: 'r', amount: -20, category: 'Restaurants', currency: 'USD' }),
    tx({ id: 'fuel', amount: -30, category: 'Fuel', accountId: 'a2' }),
    tx({ id: 'unknown', amount: -5, category: 'Mystery' }),
    tx({ id: 'income', amount: 100, type: 'income', category: 'Food' }),
    tx({ id: 'xfer', amount: -200, transferId: 'x1' }),
    tx({ id: 'adj', amount: -9, isBalanceAdjustment: true }),
    tx({ id: 'other-account', amount: -99, accountId: 'inv' }),
    tx({ id: 'last-month', amount: -99, date: '2026-09-30' }),
    // A split counts through its parts.
    tx({ id: 'sp', amount: -60, category: 'Shopping', isSplitParent: true }),
    tx({ id: 'sp1', amount: -45, category: 'Shopping', parentTransactionId: 'sp' }),
    tx({ id: 'sp2', amount: -15, category: 'Groceries', parentTransactionId: 'sp' }),
    // A combined transaction counts once, through its parent.
    tx({ id: 'cp', amount: -12, category: 'Transport', isCombinedParent: true }),
    tx({ id: 'cp1', amount: -7, category: 'Fuel', parentTransactionId: 'cp' }),
    tx({ id: 'cp2', amount: -5, category: 'Fuel', parentTransactionId: 'cp' }),
  ];
  const spend = spendByCategory(data, monthBounds({ year: 2026, month: 9 }), opts);
  assert.deepEqual(Object.fromEntries(spend), { Food: 40 + 10 + 15, Transport: 30 + 12, Uncategorized: 5, Shopping: 45 });
});

test('budget lines, statuses and the summary', () => {
  const pace = monthPace({ year: 2026, month: 9 }, new Date(2026, 9, 10)); // about a third of the month gone
  const spend = new Map([['Food', 95], ['Transport', 60], ['Shopping', 10], ['Fun', 25], ['Uncategorized', 5]]);
  const lines = budgetLines([budget('Food', 100), budget('Transport', 50), budget('Shopping', 100), budget('Bills', 40, { currency: 'USD' })], spend, usdToEur, pace);
  assert.deepEqual(lines.map(l => [l.name, l.status]), [['Food', 'near'], ['Transport', 'over'], ['Shopping', 'ok'], ['Bills', 'ok']]);
  assert.equal(lines[3].limit, 20);
  const s = summarize(lines, spend);
  assert.equal(s.budgeted, 270);
  assert.equal(s.spent, 165);
  assert.equal(s.outside, 30);
  assert.deepEqual(s.counts, { over: 1, near: 1, ahead: 0, ok: 2 });
  assert.deepEqual(unbudgeted(spend, lines.map(l => l.budget)), [{ name: 'Fun', spent: 25 }, { name: 'Uncategorized', spent: 5 }]);
  assert.deepEqual(sortLines(lines, 'left').map(l => l.name), ['Transport', 'Food', 'Bills', 'Shopping']);
});

test('spending ahead of the month is flagged before it reaches the limit', () => {
  const pace = monthPace({ year: 2026, month: 9 }, new Date(2026, 9, 5));
  const [line] = budgetLines([budget('Food', 100)], new Map([['Food', 50]]), identity, pace);
  assert.equal(line.status, 'ahead');
});

test('averages use full months before the current one', () => {
  const data = [
    tx({ id: '1', amount: -90, date: '2026-07-15' }),
    tx({ id: '2', amount: -60, date: '2026-09-02' }),
    tx({ id: '3', amount: -500, date: '2026-10-02' }), // current month: ignored
    tx({ id: '4', amount: -30, category: 'Mystery', date: '2026-09-02' }), // uncategorized: ignored
  ];
  const avg = averageMonthlySpend(data, { year: 2026, month: 9 }, 3, opts);
  assert.deepEqual(Object.fromEntries(avg), { Food: 50 });
});

test('suggestions: new categories and budgets far from the average', () => {
  const avg = new Map([['Food', 420], ['Transport', 52], ['Shopping', 80], ['Fun', 4]]);
  const s = budgetSuggestions(avg, [budget('Food', 350), budget('Transport', 50), budget('Shopping', 150)], identity);
  assert.deepEqual(s.map(x => [x.categoryName, x.kind, x.suggested]), [['Food', 'raise', 420], ['Shopping', 'lower', 80]]);
  assert.equal(friendlyAmount(51), 55);
  assert.equal(friendlyAmount(512), 520);
  assert.equal(friendlyAmount(1210), 1250);
});

test('auto-fill overwrites existing budgets and adds new ones', () => {
  const plan = autofillPlan(new Map([['Food', 99.6], ['Fun', 0.2]]), [budget('Food', 50)], 'EUR');
  assert.deepEqual(plan, [{ id: 'b-Food', categoryName: 'Food', amount: 100, period: 'monthly', currency: 'EUR' }]);
});

test('allocation folds small shares into Other', () => {
  const pace = monthPace({ year: 2026, month: 9 }, new Date(2026, 9, 10));
  const lines = budgetLines([budget('A', 900), budget('B', 20), budget('C', 20), budget('D', 60)], new Map(), identity, pace);
  assert.deepEqual(allocation(lines).map(s => [s.name, s.value]), [['A', 900], ['D', 60], ['Other', 40]]);
});

test('amounts parse with either decimal separator', () => {
  assert.equal(parseAmount('1,250.5'), 1250.5);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.ok(Number.isNaN(parseAmount('')));
});

test('goal views add up buckets and skip disabled goals', () => {
  const g = (over: Partial<FinancialGoal>): FinancialGoal => ({ id: 'g', name: 'Goal', type: 'one-time', transactionType: 'expense', amount: 100, currentAmount: 0, currency: 'EUR', ...over });
  const views = goalViews([
    g({ id: 'trip', name: 'Trip', isBucket: true, amount: 0 }),
    g({ id: 'flights', parentId: 'trip', amount: 600, currentAmount: 300 }),
    g({ id: 'hotel', parentId: 'trip', amount: 400, currentAmount: 100, currency: 'USD' }),
    g({ id: 'car', name: 'Car', amount: 1000, currentAmount: 1000 }),
    g({ id: 'off', name: 'Off', disabled: true }),
    g({ id: 'fund', name: 'Fund', type: 'recurring', amount: 200, currentAmount: 150, monthlyContribution: 50, endDate: '2027-01-01' }),
  ], usdToEur);
  assert.deepEqual(views.map(v => [v.name, v.target, v.saved, v.parts, v.done]), [
    ['Fund', 200, 150, 0, false], ['Trip', 800, 350, 2, false], ['Car', 1000, 1000, 0, true],
  ]);
  assert.equal(views[0].due, '2027-01-01');
  assert.equal(views[0].monthly, 50);
});
