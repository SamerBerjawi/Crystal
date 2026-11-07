import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from '../../types';
import { isBankSynced, syncFill, withEditLocks } from '../../utils/lockedFields';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1', accountId: 'a', date: '2026-10-01', description: 'CARD PAYMENT 123', merchant: 'Shop', amount: -10, category: 'Shopping', type: 'expense', currency: 'EUR',
  importId: 'enable-banking-c1-a', sureId: 'bank-1', ...over,
});

test('only transactions from a bank connection are synced', () => {
  assert.equal(isBankSynced(tx()), true);
  assert.equal(isBankSynced(tx({ importId: 'imp-1' })), false);
  assert.equal(isBankSynced(tx({ importId: undefined })), false);
});

test('editing the merchant or description of a synced transaction locks that field', () => {
  const edited = withEditLocks(tx(), { ...tx(), merchant: 'Corner Shop' });
  assert.deepEqual(edited.lockedFields, ['merchant']);
  const both = withEditLocks(tx(), { ...tx(), merchant: 'Corner Shop', description: 'Lunch' });
  assert.deepEqual(both.lockedFields, ['merchant', 'description']);
});

test('clearing a field counts as an edit, and earlier locks are kept', () => {
  const cleared = withEditLocks(tx(), { ...tx(), merchant: '' });
  assert.deepEqual(cleared.lockedFields, ['merchant']);
  const more = withEditLocks(tx({ lockedFields: ['merchant'] }), { ...tx({ lockedFields: ['merchant'] }), description: 'Lunch' });
  assert.deepEqual(more.lockedFields, ['merchant', 'description']);
});

test('unchanged saves, other fields, and non-synced transactions are left alone', () => {
  const same = { ...tx(), category: 'Food' };
  assert.equal(withEditLocks(tx(), same), same);
  const manual = { ...tx({ importId: undefined }), merchant: 'Changed' };
  assert.equal(withEditLocks(tx({ importId: undefined }), manual), manual);
  const fresh = { ...tx(), merchant: 'New' };
  assert.equal(withEditLocks(undefined, fresh), fresh);
});

test('a sync fills empty fields but never a locked one', () => {
  const incoming = { merchant: 'Bank Merchant', description: 'Bank text' };
  assert.deepEqual(
    syncFill(tx({ merchant: '', description: '' }), incoming),
    { ...tx({ merchant: 'Bank Merchant', description: 'Bank text' }) },
  );
  // You cleared the merchant on purpose: it stays empty.
  assert.equal(syncFill(tx({ merchant: '', lockedFields: ['merchant'] }), { merchant: 'Bank Merchant', description: '' }), undefined);
  // Locked merchant stays empty but the empty description is still filled.
  const filled = syncFill(tx({ merchant: '', description: '', lockedFields: ['merchant'] }), incoming);
  assert.equal(filled?.merchant, '');
  assert.equal(filled?.description, 'Bank text');
  // Filled fields are never overwritten.
  assert.equal(syncFill(tx(), incoming), undefined);
});

test('sync corrects a merchant that was wrongly set to Apple, unless you locked it', () => {
  const wrong = { ...tx(), merchant: 'Apple' };
  assert.equal(syncFill(wrong, { merchant: 'Delhaize', description: wrong.description })?.merchant, 'Delhaize');
  assert.equal(syncFill(wrong, { merchant: 'Apple', description: wrong.description }), undefined);
  assert.equal(syncFill({ ...wrong, lockedFields: ['merchant'] }, { merchant: 'Delhaize', description: wrong.description }), undefined);
  assert.equal(syncFill({ ...tx(), merchant: 'Shop' }, { merchant: 'Delhaize', description: 'x' }), undefined);
});
