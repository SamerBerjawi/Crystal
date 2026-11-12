import test from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Budget, Category, RecurringTransaction, Transaction } from '../../types';
import { buildRecap, shiftWeek, weekOf } from '../../utils/weeklyRecap';

const tx = (id: string, date: string, amount: number, type: 'expense' | 'income', over: Partial<Transaction> = {}): Transaction =>
  ({ id, accountId: 'chk', date, amount: type === 'expense' ? -amount : amount, type, description: id, category: 'Food', currency: 'EUR', ...over } as Transaction);
const accounts = [{ id: 'chk', name: 'Chk', type: 'Checking', balance: 0, currency: 'EUR' }] as Account[];
const categories = [{ id: 'c1', name: 'Food', classification: 'expense', subCategories: [{ id: 'c2', name: 'Groceries', classification: 'expense', subCategories: [] }] }, { id: 'c3', name: 'Fun', classification: 'expense', subCategories: [] }] as unknown as Category[];
const convert = (a: number) => a;
const base = { accounts, categories, budgets: [] as Budget[], recurring: [] as RecurringTransaction[], convert };

test('a week runs Monday to Sunday', () => {
  assert.deepEqual(weekOf(new Date(2026, 10, 12)), { start: '2026-11-09', end: '2026-11-15' }); // a Thursday
  assert.deepEqual(weekOf(new Date(2026, 10, 15)), { start: '2026-11-09', end: '2026-11-15' }); // the Sunday
  assert.deepEqual(weekOf(new Date(2026, 10, 9)), { start: '2026-11-09', end: '2026-11-15' });  // the Monday
  assert.deepEqual(shiftWeek({ start: '2026-11-09', end: '2026-11-15' }, -1), { start: '2026-11-02', end: '2026-11-08' });
});

test('totals, change against the week before, and what is left out', () => {
  const t = [
    tx('a', '2026-11-03', 100, 'expense'), tx('b', '2026-11-10', 150, 'expense', { category: 'Groceries', merchant: 'Shop' }), tx('c', '2026-11-11', 50, 'expense', { category: 'Fun' }),
    tx('d', '2026-11-12', 1000, 'income'), tx('e', '2026-11-12', 300, 'expense', { transferId: 't1' }), tx('f', '2026-11-12', 40, 'expense', { isBalanceAdjustment: true } as Partial<Transaction>),
  ];
  const r = buildRecap({ ...base, transactions: t, week: { start: '2026-11-09', end: '2026-11-15' }, today: new Date(2026, 10, 12) });
  assert.equal(r.spent, 200);
  assert.equal(r.earned, 1000);
  assert.equal(r.saved, 800);
  assert.equal(r.prevSpent, 100);
  assert.equal(r.spentChange, 1);
  assert.equal(r.inProgress, true);
  assert.equal(r.topCategories[0].label, 'Food', 'Groceries rolls up to its parent');
  assert.equal(r.topCategories[0].share, 0.75);
  assert.equal(r.biggest?.label, 'Shop');
  assert.equal(r.transactionCount, 3);
});

test('a week with no spending last week has no change figure', () => {
  const r = buildRecap({ ...base, transactions: [tx('a', '2026-11-10', 10, 'expense')], week: { start: '2026-11-09', end: '2026-11-15' }, today: new Date(2026, 10, 12) });
  assert.equal(r.spentChange, undefined);
});

test('an empty week has no data', () => {
  const r = buildRecap({ ...base, transactions: [], week: { start: '2026-11-09', end: '2026-11-15' }, today: new Date(2026, 10, 12) });
  assert.equal(r.hasData, false);
  assert.equal(r.spent, 0);
});

test('budgets at 80% or more are named, month to date', () => {
  const budgets = [{ id: 'b1', categoryName: 'Food', amount: 200, period: 'monthly', currency: 'EUR' }, { id: 'b2', categoryName: 'Fun', amount: 1000, period: 'monthly', currency: 'EUR' }] as Budget[];
  const r = buildRecap({ ...base, budgets, transactions: [tx('a', '2026-11-03', 170, 'expense'), tx('b', '2026-11-05', 20, 'expense', { category: 'Fun' })], week: { start: '2026-11-02', end: '2026-11-08' }, today: new Date(2026, 10, 12) });
  assert.deepEqual(r.budgets.map(b => b.name), ['Food']);
  assert.equal(Math.round(r.budgets[0].pct), 85);
});

test('bills due in the seven days ahead are listed; older weeks look at nothing', () => {
  const rent = { id: 'r', accountId: 'chk', description: 'Rent', amount: 800, type: 'expense', currency: 'EUR', frequency: 'monthly', startDate: '2026-01-14', nextDueDate: '2026-11-14', weekendAdjustment: 'on' } as RecurringTransaction;
  const paused = { ...rent, id: 'p', description: 'Paused', pausedAt: '2026-10-01' } as RecurringTransaction;
  const now = buildRecap({ ...base, recurring: [rent, paused], transactions: [], week: { start: '2026-11-09', end: '2026-11-15' }, today: new Date(2026, 10, 12) });
  assert.deepEqual(now.upcoming.map(u => [u.name, u.date, u.amount]), [['Rent', '2026-11-14', 800]]);
  assert.equal(now.upcomingTotal, 800);
  const old = buildRecap({ ...base, recurring: [rent], transactions: [], week: { start: '2026-09-07', end: '2026-09-13' }, today: new Date(2026, 10, 12) });
  assert.deepEqual(old.upcoming, []);
  assert.equal(old.upcomingWindow, undefined);
});
