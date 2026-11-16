import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Transaction } from '../../types';
import {
  groupUnreviewedByAccount,
  isUnreviewedSync,
  markTransactionsReviewedPatch,
} from '../../utils/syncedReviewModel';

const account = (id: string, name: string, over: Partial<Account> = {}): Account =>
  ({ id, name, type: 'Checking', balance: 1000, currency: 'EUR', ...over }) as Account;

const tx = (id: string, accountId: string, over: Partial<Transaction> = {}): Transaction =>
  ({
    id,
    accountId,
    date: '2026-11-15',
    description: id,
    merchant: id,
    amount: -12.5,
    category: 'Uncategorized',
    type: 'expense',
    currency: 'EUR',
    ...over,
  }) as Transaction;

test('isUnreviewedSync excludes split parents, combined parents, and spare-change legs', () => {
  assert.equal(isUnreviewedSync(tx('a', 'chk', { needsReview: true })), true);
  assert.equal(isUnreviewedSync(tx('b', 'chk', { needsReview: false })), false);
  assert.equal(isUnreviewedSync(tx('c', 'chk')), false);
  assert.equal(isUnreviewedSync(tx('d', 'chk', { needsReview: true, isSplitParent: true })), false);
  assert.equal(isUnreviewedSync(tx('e', 'chk', { needsReview: true, isCombinedParent: true })), false);
  assert.equal(isUnreviewedSync(tx('f', 'chk', { needsReview: true, transferId: 'spare-123' })), false);
});

test('groupUnreviewedByAccount groups incoming synced transactions by account with counts and net totals', () => {
  const accounts = [
    account('chk', 'Everyday Checking', { financialInstitution: 'KBC' }),
    account('cc', 'Travel Card', { type: 'Credit Card', currency: 'USD' }),
  ];
  const txs: Transaction[] = [
    tx('t1', 'chk', { needsReview: true, date: '2026-11-14', amount: -25, category: 'Groceries' }),
    tx('t2', 'chk', { needsReview: true, date: '2026-11-16', amount: -10, category: 'Uncategorized' }),
    tx('t3', 'chk', { needsReview: false, date: '2026-11-16', amount: -99 }),
    tx('t4', 'cc', { needsReview: true, date: '2026-11-15', amount: -40, currency: 'USD', category: 'Uncategorized' }),
  ];

  const summary = groupUnreviewedByAccount(txs, accounts);
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.uncategorisedCount, 2);
  assert.equal(summary.groups.length, 2);
  // Checking has the newest date (2026-11-16), so it sorts first
  assert.equal(summary.groups[0].accountId, 'chk');
  assert.equal(summary.groups[0].transactions.map(t => t.id).join(','), 't2,t1');
  assert.equal(summary.groups[0].netAmount, -35);
  assert.equal(summary.groups[0].uncategorisedCount, 1);
  assert.equal(summary.groups[1].accountId, 'cc');
  assert.equal(summary.groups[1].currency, 'USD');
});

test('markTransactionsReviewedPatch produces minimal patches and clears needsReview', () => {
  const txs: Transaction[] = [
    tx('t1', 'chk', { needsReview: true }),
    tx('t2', 'chk', { needsReview: false }),
    tx('t3', 'cc', { needsReview: true }),
  ];
  const patches = markTransactionsReviewedPatch(txs, ['t1', 't2']);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, 't1');
  assert.equal(patches[0].needsReview, false);
});
