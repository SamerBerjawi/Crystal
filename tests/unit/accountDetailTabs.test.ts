import test from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../../types';
import { detailTabsFor, resolveAccountArchetype, resolveDetailTab } from '../../utils/accountDetailModel';

/* Phase 4.1: which tabs each kind of account gets, and which one opens. */

const acc = (p: Partial<Account> & Pick<Account, 'type'>): Account => ({
  id: 'a',
  name: 'A',
  balance: 0,
  currency: 'EUR',
  ...p,
});
const ids = (a: Account) => detailTabsFor(a, resolveAccountArchetype(a)).map((t) => t.id);

test('every account gets Overview, Activity and Details', () => {
  assert.deepEqual(ids(acc({ type: 'Checking' })), ['overview', 'activity', 'details']);
  assert.deepEqual(ids(acc({ type: 'Credit Card' })), ['overview', 'activity', 'details']);
  assert.deepEqual(ids(acc({ type: 'Savings' })), ['overview', 'activity', 'details']);
});

test('a loan with a schedule gets a Payment plan; one without does not', () => {
  const scheduled = acc({ type: 'Loan', principalAmount: 1000, duration: 12, loanStartDate: '2026-01-01', interestRate: 3 });
  assert.deepEqual(ids(scheduled), ['overview', 'plan', 'activity', 'details']);
  assert.deepEqual(ids(acc({ type: 'Loan', totalAmount: 1000 })), ['overview', 'activity', 'details']);
});

test('property gets Valuations, a vehicle Valuations & logs', () => {
  assert.deepEqual(ids(acc({ type: 'Property' })), ['overview', 'valuations', 'activity', 'details']);
  const vehicle = detailTabsFor(acc({ type: 'Vehicle' }), 'physical_asset');
  assert.equal(vehicle.find((t) => t.id === 'valuations')?.label, 'Valuations & logs');
});

test('the hash wins, then the remembered tab, then Overview; unknown tabs fall through', () => {
  const tabs = detailTabsFor(acc({ type: 'Checking' }), 'operating');
  assert.equal(resolveDetailTab(tabs, '#activity', 'details'), 'activity');
  assert.equal(resolveDetailTab(tabs, '', 'details'), 'details');
  assert.equal(resolveDetailTab(tabs, '#plan', 'valuations'), 'overview', 'a checking account has no plan or valuations');
  assert.equal(resolveDetailTab(tabs, null, null), 'overview');
});
