import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Transaction } from '../../types';
import { DEFAULT_MATCHER_CONFIG } from '../../utils/matcherConfig';
import {
  buildTransferPairUpdates,
  findTransferSuggestions,
  resolveManualTransferPair,
} from '../../utils/transferMatcher';
import { buildDisplayTransactions } from '../../utils/transactionsLedgerModel';
import { setMainCurrency, updateConversionRates } from '../../utils';

const acc = (id: string, name: string, currency: Account['currency'] = 'EUR'): Account =>
  ({ id, name, type: 'Checking', balance: 1000, currency }) as Account;

const tx = (id: string, accountId: string, over: Partial<Transaction> = {}): Transaction =>
  ({
    id,
    accountId,
    date: '2026-11-18',
    description: 'Payment',
    merchant: 'Payment',
    amount: -100,
    category: 'Uncategorized',
    type: 'expense',
    currency: 'EUR',
    ...over,
  }) as Transaction;

const NOW = new Date('2026-11-18T12:00:00');

test('findTransferSuggestions matches 100 EUR expense on Account A with 100 EUR income on Account B', () => {
  const accounts = [acc('a', 'Account A'), acc('b', 'Account B')];
  const exp = tx('e1', 'a', { amount: -100, type: 'expense', needsReview: true });
  const inc = tx('i1', 'b', { amount: 100, type: 'income', needsReview: true });

  const suggestions = findTransferSuggestions([exp, inc], DEFAULT_MATCHER_CONFIG, [], NOW);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].expenseTx.id, 'e1');
  assert.equal(suggestions[0].incomeTx.id, 'i1');
  assert.equal(suggestions[0].matchScore, 80);

  const updates = buildTransferPairUpdates(exp, inc, accounts, 'xfer-1');
  assert.equal(updates[0].transferId, 'xfer-1');
  assert.equal(updates[1].transferId, 'xfer-1');
  assert.equal(updates[0].category, 'Transfer');
  assert.equal(updates[1].category, 'Transfer');
  assert.equal(updates[0].description, 'Transfer to Account B');
  assert.equal(updates[1].description, 'Transfer from Account A');
  assert.equal(updates[0].needsReview, false);
  assert.equal(updates[1].needsReview, false);

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
  const display = buildDisplayTransactions(updates, accountMap, accounts);
  assert.equal(display.length, 1);
  assert.equal(display[0].isTransfer, true);
  assert.equal(display[0].fromAccountId, 'a');
  assert.equal(display[0].toAccountId, 'b');
});

test('findTransferSuggestions matches same-currency pairs even when main currency lacks a conversion rate', () => {
  setMainCurrency('USD');
  updateConversionRates({});
  try {
    const exp = tx('e1', 'a', { amount: -100, type: 'expense', currency: 'EUR' });
    const inc = tx('i1', 'b', { amount: 100, type: 'income', currency: 'EUR' });
    const suggestions = findTransferSuggestions([exp, inc], DEFAULT_MATCHER_CONFIG, [], NOW);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].matchScore, 80);
  } finally {
    setMainCurrency('EUR');
    updateConversionRates({});
  }
});

test('findTransferSuggestions assigns highest-scoring pair first so weaker matches do not steal legs', () => {
  const weakExp = tx('e-weak', 'a', { date: '2026-11-15', amount: -104, type: 'expense' });
  const exactExp = tx('e-exact', 'a', { date: '2026-11-18', amount: -100, type: 'expense' });
  const inc = tx('i-100', 'b', { date: '2026-11-18', amount: 100, type: 'income' });

  const suggestions = findTransferSuggestions([weakExp, exactExp, inc], DEFAULT_MATCHER_CONFIG, [], NOW);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].expenseTx.id, 'e-exact');
  assert.equal(suggestions[0].incomeTx.id, 'i-100');
});

test('findTransferSuggestions skips split parents, combined parents, balance adjustments, and ignored pairs', () => {
  const splitParent = tx('sp', 'a', { amount: -100, type: 'expense', isSplitParent: true });
  const adj = tx('adj', 'a', { amount: -100, type: 'expense', isBalanceAdjustment: true });
  const realExp = tx('e1', 'a', { amount: -100, type: 'expense' });
  const inc = tx('i1', 'b', { amount: 100, type: 'income' });

  assert.equal(findTransferSuggestions([splitParent, adj, inc], DEFAULT_MATCHER_CONFIG, [], NOW).length, 0);
  assert.equal(findTransferSuggestions([realExp, inc], DEFAULT_MATCHER_CONFIG, ['e1|i1'], NOW).length, 0);
});

test('resolveManualTransferPair requires one expense and one income on two different accounts', () => {
  const expA = tx('e1', 'a', { amount: -100, type: 'expense' });
  const incB = tx('i1', 'b', { amount: 100, type: 'income' });
  const incA = tx('i2', 'a', { amount: 100, type: 'income' });
  const expB = tx('e2', 'b', { amount: -100, type: 'expense' });

  assert.deepEqual(resolveManualTransferPair([expA, incB]), { expenseTx: expA, incomeTx: incB });
  assert.equal(resolveManualTransferPair([expA, incA]), null);
  assert.equal(resolveManualTransferPair([expA, expB]), null);
  assert.equal(resolveManualTransferPair([{ ...expA, transferId: 'xfer-old' }, incB]), null);
});
