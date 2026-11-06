import test from 'node:test';
import assert from 'node:assert/strict';
import { ladderRungs } from '../../utils/fixedTerm';
import type { Account } from '../../types';

const account = (over: Partial<Account>): Account => ({ id: 'a', name: 'Bill', type: 'Savings', balance: 1000, currency: 'EUR', ...over });
const today = new Date(2026, 10, 6);

test('ladderRungs lists open accounts with a maturity ahead, soonest first', () => {
  const rungs = ladderRungs([
    account({ id: 'late', maturityDate: '2027-03-24', openingDate: '2026-09-24' }),
    account({ id: 'soon', maturityDate: '2026-11-18', openingDate: '2026-08-18', rollsOver: true }),
    account({ id: 'none' }),
    account({ id: 'past', maturityDate: '2026-10-01' }),
    account({ id: 'closed', maturityDate: '2027-01-01', status: 'closed' }),
  ], today);
  assert.deepEqual(rungs.map(rung => rung.account.id), ['soon', 'late']);
  assert.equal(rungs[0].daysLeft, 12);
  assert.equal(rungs[0].rollsOver, true);
});

test('ladderRungs measures how much of the term is gone', () => {
  const [rung] = ladderRungs([account({ maturityDate: '2026-12-06', openingDate: '2026-10-06' })], today);
  assert.equal(rung.termDays, 61);
  assert.ok(Math.abs(rung.elapsed - 31 / 61) < 0.01);
});

test('ladderRungs starts today when there is no opening date', () => {
  const [rung] = ladderRungs([account({ maturityDate: '2026-12-06' })], today);
  assert.equal(rung.elapsed, 0);
  assert.equal(rung.termDays, rung.daysLeft);
});
