import test from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../../types';
import { calculateAccountTotals, resolveAccountBalance } from '../../utils';

/* Phase 4.3, decision Q5: a leased car counts in net worth only at its residual value. */

const car = (p: Partial<Account> = {}): Account => ({
  id: 'car', name: 'Leased car', type: 'Vehicle', ownership: 'Leased', balance: 30000, currency: 'EUR', ...p,
});

test('a leased vehicle without a residual value is not an asset, whatever its stored balance', () => {
  assert.equal(resolveAccountBalance(car()), 0);
  assert.equal(calculateAccountTotals([car()]).totalAssets, 0);
});

test('a leased vehicle with a residual value counts at that value', () => {
  assert.equal(resolveAccountBalance(car({ residualValue: 18000 })), 18000);
  assert.equal(calculateAccountTotals([car({ residualValue: 18000 })]).totalAssets, 18000);
});

test('an owned vehicle still counts at its balance', () => {
  assert.equal(resolveAccountBalance(car({ ownership: 'Owned' })), 30000);
});
