import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWrapped, longestNoSpendStreak, wrappedYears } from '../../utils/wrappedModel';
import { setMainCurrency } from '../../utils';
import type { Account, Transaction } from '../../types';

const tx = (id: string, date: string, type: 'income' | 'expense', amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, accountId: 'a', date, description: id, amount: type === 'expense' ? -amount : amount, category: 'Dining', type, currency: 'EUR', ...extra,
});
const TODAY = new Date(2026, 10, 7);

test('totals ignore transfers and adjustments', () => {
  const rows = [
    tx('1', '2025-01-10', 'income', 1000),
    tx('2', '2025-01-12', 'expense', 100, { merchant: 'Cafe' }),
    tx('3', '2025-02-01', 'expense', 50, { transferId: 't' }),
    tx('4', '2025-02-02', 'expense', 70, { isBalanceAdjustment: true }),
  ];
  const w = buildWrapped(2025, rows, [], [], TODAY);
  assert.equal(w.income, 1000);
  assert.equal(w.expense, 100);
  assert.equal(w.saved, 900);
  assert.equal(w.savingsRate, 0.9);
  assert.equal(w.topMerchants[0].label, 'Cafe');
  assert.equal(w.hasData, true);
});

test('best and worst month, biggest purchase, busiest day', () => {
  const rows = [
    tx('1', '2025-03-01', 'income', 500),
    tx('2', '2025-03-05', 'expense', 100, { merchant: 'A' }),
    tx('3', '2025-04-01', 'income', 500),
    tx('4', '2025-04-05', 'expense', 450, { merchant: 'B' }),
    tx('5', '2025-04-05', 'expense', 10, { merchant: 'C' }),
  ];
  const w = buildWrapped(2025, rows, [], [], TODAY);
  assert.equal(w.bestMonth?.month, 2);
  assert.equal(w.worstMonth?.month, 3);
  assert.equal(w.biggestPurchase?.label, 'B');
  assert.deepEqual(w.busiestDay, { date: '2025-04-05', total: 460, count: 2 });
});

test('no-spend streak counts the gap between spending days', () => {
  const spend = new Set(['2025-01-01', '2025-01-10']);
  const { streak, noSpendDays } = longestNoSpendStreak(spend, new Date(2025, 0, 1), new Date(2025, 0, 15));
  assert.equal(streak.days, 8);
  assert.equal(streak.start, '2025-01-02');
  assert.equal(noSpendDays, 13);
});

test('kilometres use the last reading before the year as the start', () => {
  const logs = [{ date: '2024-12-20', reading: 10000 }, { date: '2025-06-01', reading: 11000 }, { date: '2025-12-01', reading: 12500 }];
  const w = buildWrapped(2025, [tx('1', '2025-01-02', 'expense', 5)], [], logs, TODAY);
  assert.equal(w.kilometres, 2500);
});

test('life events of the year are carried into Wrapped, oldest first', () => {
  const events = [
    { id: 'b', date: '2025-09-01', title: 'New job', kind: 'job' as const },
    { id: 'x', date: '2024-12-31', title: 'Last year', kind: 'other' as const },
    { id: 'a', date: '2025-03-02', title: 'Bought the flat', kind: 'home' as const },
  ];
  const w = buildWrapped(2025, [tx('1', '2025-01-02', 'expense', 5)], [], [], TODAY, events);
  assert.deepEqual(w.lifeEvents.map(e => e.id), ['a', 'b']);
  assert.deepEqual(buildWrapped(2025, [tx('1', '2025-01-02', 'expense', 5)], [], [], TODAY).lifeEvents, []);
  // Events alone do not make a year worth reviewing.
  assert.equal(buildWrapped(2025, [], [], [], TODAY, events).hasData, false);
});

test('wrappedYears lists years newest first; empty year has no data', () => {
  assert.deepEqual(wrappedYears([tx('1', '2024-05-01', 'expense', 1), tx('2', '2026-01-01', 'expense', 1)]), [2026, 2024]);
  assert.equal(buildWrapped(2020, [], [], [], TODAY).hasData, false);
});

test('buildWrapped does not double-convert net worth when mainCurrency is USD', () => {
  setMainCurrency('USD');
  try {
    const accounts: Account[] = [{ id: 'a', name: 'Checking', type: 'Checking', balance: 1000, currency: 'USD' }];
    const w = buildWrapped(2026, [tx('1', '2026-03-01', 'income', 200, { currency: 'USD' })], accounts, [], TODAY);
    assert.equal(w.netWorth?.end, 1000);
    assert.equal(w.netWorth?.start, 800);
    assert.equal(w.netWorth?.change, 200);
  } finally {
    setMainCurrency('EUR');
  }
});
