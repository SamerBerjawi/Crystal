import test from 'node:test';
import assert from 'node:assert/strict';
import type { EnableBankingConnection, Transaction } from '../../types';
import { clearDeleted, countDeleted, deletedIdsByAccount, forgetDeleted, MAX_REMEMBERED, rememberDeleted } from '../../utils/deletedSync';

const connection = (over: Partial<EnableBankingConnection> = {}): EnableBankingConnection => ({
  id: 'c1', applicationId: 'app', countryCode: 'NL', status: 'ready',
  accounts: [
    { id: 'p1', name: 'Main', bankName: 'Bank', currency: 'EUR', balance: 0, linkedAccountId: 'chk' },
    { id: 'p2', name: 'Other', bankName: 'Bank', currency: 'EUR', balance: 0 },
  ],
  ...over,
} as EnableBankingConnection);

const synced = (sureId: string, over: Partial<Transaction> = {}) => ({ importId: 'enable-banking-c1-chk', sureId, ...over }) as Transaction;

test('a deleted synced transaction is remembered on its bank account', () => {
  const [next] = rememberDeleted([connection()], [synced('b1'), synced('b2')]);
  assert.deepEqual(next.accounts[0].deletedTransactionIds, ['b1', 'b2']);
  assert.equal(next.accounts[1].deletedTransactionIds, undefined);
  assert.deepEqual([...(deletedIdsByAccount(next).get('chk') ?? [])], ['b1', 'b2']);
});

test('remembering is idempotent and ignores transactions that did not come from the bank', () => {
  const once = rememberDeleted([connection()], [synced('b1')]);
  assert.equal(rememberDeleted(once, [synced('b1')]), once);
  const base = [connection()];
  assert.equal(rememberDeleted(base, [synced('x', { importId: 'imp-1' }), synced('y', { importId: 'enable-banking-c1-other' }), { importId: 'enable-banking-c1-chk' } as Transaction]), base);
});

test('restoring a transaction forgets it', () => {
  const remembered = rememberDeleted([connection()], [synced('b1'), synced('b2')]);
  const [next] = forgetDeleted(remembered, [synced('b1')]);
  assert.deepEqual(next.accounts[0].deletedTransactionIds, ['b2']);
  const untouched = [connection()];
  assert.equal(forgetDeleted(untouched, [synced('b1')]), untouched);
});

test('only the newest ids are kept', () => {
  const many = Array.from({ length: MAX_REMEMBERED + 3 }, (_, i) => synced(`b${i}`));
  const [next] = rememberDeleted([connection()], many);
  const ids = next.accounts[0].deletedTransactionIds as string[];
  assert.equal(ids.length, MAX_REMEMBERED);
  assert.equal(ids[0], 'b3');
  assert.equal(ids[ids.length - 1], `b${MAX_REMEMBERED + 2}`);
});

test('resetting a connection forgets all its deleted ids and leaves others alone', () => {
  const other = connection({ id: 'c2' });
  const remembered = rememberDeleted([connection(), other], [synced('b1'), synced('b2')]);
  assert.equal(countDeleted(remembered[0]), 2);
  const cleared = clearDeleted(remembered, 'c1');
  assert.equal(countDeleted(cleared[0]), 0);
  assert.equal('deletedTransactionIds' in cleared[0].accounts[0], false);
  assert.equal(cleared[1], remembered[1]);
  assert.equal(clearDeleted(cleared, 'c1')[0], cleared[0]);
});
