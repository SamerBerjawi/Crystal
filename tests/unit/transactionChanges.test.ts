import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Transaction } from '../../types';
import { getMainCurrency, setMainCurrency } from '../../utils';
import { applyBalanceChanges, applyTransactionChanges, planTransactionChanges } from '../../utils/transactionChanges';

const account = (id: string, extra: Partial<Account> = {}) => ({ id, name: id, type: 'Checking', currency: 'EUR', balance: 100, ...extra }) as Account;

const tx = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, accountId: 'a', date: '2026-01-01', description: id, amount, category: 'Food', type: amount >= 0 ? 'income' : 'expense', currency: 'EUR', ...extra,
});

test('a new transaction moves the balance once, however often an updater reruns', () => {
  const accounts = [account('a')];
  const plan = planTransactionChanges([], [{ ...tx('x', 50), id: undefined }], [], accounts);
  assert.equal(plan.added.length, 1);
  assert.match(plan.added[0].id, /^txn-/);
  assert.deepEqual(plan.balanceChanges, { a: 50 });
  assert.equal(applyBalanceChanges(accounts, plan.balanceChanges)[0].balance, 150);
  assert.deepEqual(applyTransactionChanges([], plan), applyTransactionChanges([], plan));
  assert.equal(applyTransactionChanges([], plan)[0].id, plan.added[0].id);
});

test('editing moves the balance by the difference, across accounts too', () => {
  const accounts = [account('a'), account('b')];
  const current = [tx('x', -20)];
  assert.deepEqual(planTransactionChanges(current, [{ ...current[0], amount: -30 }], [], accounts).balanceChanges, { a: -10 });
  assert.deepEqual(planTransactionChanges(current, [{ ...current[0], accountId: 'b' }], [], accounts).balanceChanges, { a: 20, b: -20 });
  const plan = planTransactionChanges(current, [{ ...current[0], amount: -30 }], [], accounts);
  assert.equal(applyTransactionChanges(current, plan)[0].amount, -30);
});

test('deleting reverses the amount, and a save with both applies both', () => {
  const current = [tx('x', -20), tx('y', 5)];
  const plan = planTransactionChanges(current, [{ ...tx('z', 1) }], ['x'], [account('a')]);
  assert.deepEqual(plan.balanceChanges, { a: 21 });
  assert.deepEqual(applyTransactionChanges(current, plan).map(item => item.id), ['y', 'z']);
});

test('a record restored by undo counts as new and keeps its id', () => {
  const plan = planTransactionChanges([], [tx('x', -20)], [], [account('a')]);
  assert.equal(plan.added[0].id, 'x');
  assert.deepEqual(plan.balanceChanges, { a: -20 });
});

test('a split loan payment moves the balance by its principal', () => {
  const plan = planTransactionChanges([], [tx('x', 1000, { accountId: 'loan', principalAmount: 600, interestAmount: 400 })], [], [account('loan', { type: 'Loan', balance: -5000 })]);
  assert.deepEqual(plan.balanceChanges, { loan: 600 });
});

test('the change lands in the account currency, whatever the main currency is', () => {
  const main = getMainCurrency();
  setMainCurrency('USD');
  try {
    const plan = planTransactionChanges([], [tx('x', 10)], [], [account('a')]);
    assert.deepEqual(plan.balanceChanges, { a: 10 });
    const foreign = planTransactionChanges([], [tx('y', 10, { currency: 'USD' })], [], [account('a')]);
    assert.equal(foreign.balanceChanges.a, 9.3);
  } finally {
    setMainCurrency(main);
  }
});

test('splitting and unsplitting leave the balance alone', () => {
  const parent = tx('p', -100);
  const parts = [tx('s1', -60, { parentTransactionId: 'p' }), tx('s2', -40, { parentTransactionId: 'p' })];
  const accounts = [account('a')];
  const split = planTransactionChanges([parent], [{ ...parent, isSplitParent: true }, ...parts], [], accounts);
  assert.equal(split.added.length, 2);
  assert.ok(!split.balanceChanges.a);
  const saved = applyTransactionChanges([parent], split);
  const unsplit = planTransactionChanges(saved, [{ ...saved[0], isSplitParent: false }], ['s1', 's2'], accounts);
  assert.ok(!unsplit.balanceChanges.a);
  assert.deepEqual(applyTransactionChanges(saved, unsplit).map(item => item.id), ['p']);
});

test('combining and uncombining leave the balance alone', () => {
  const parts = [tx('c1', -3), tx('c2', -4)];
  const accounts = [account('a')];
  const parent = tx('total', -7, { isCombinedParent: true });
  const combine = planTransactionChanges(parts, [parent, ...parts.map(part => ({ ...part, parentTransactionId: 'total' }))], [], accounts);
  assert.ok(!combine.balanceChanges.a);
  const saved = applyTransactionChanges(parts, combine);
  const uncombine = planTransactionChanges(saved, saved.filter(item => item.id !== 'total').map(part => ({ ...part, parentTransactionId: undefined })), ['total'], accounts);
  assert.ok(!uncombine.balanceChanges.a);
});

test('balances round to cents, or eight places for BTC, and untouched accounts stay the same object', () => {
  const eur = account('a', { balance: 10.1 });
  const btc = account('b', { currency: 'BTC', balance: 0.1 });
  const other = account('c');
  const result = applyBalanceChanges([eur, btc, other], { a: 0.2, b: 0.000000011 });
  assert.equal(result[0].balance, 10.3);
  assert.equal(result[1].balance, 0.10000001);
  assert.equal(result[2], other);
});
