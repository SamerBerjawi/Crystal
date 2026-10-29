import test from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../../types';
import { generateAmortizationSchedule, toLocalISOString } from '../../utils';
import { applyLoanOverride, loanOverrideKinds } from '../../utils/accountDetailModel';

/* Phase 4.2: payment plan changes, checked against the schedule they produce. */

const start = new Date();
start.setMonth(start.getMonth() + 1); // every payment is in the future, so none is "Paid"
const loan: Account = {
  id: 'loan',
  name: 'Loan',
  type: 'Loan',
  balance: 0,
  currency: 'EUR',
  principalAmount: 12000,
  interestRate: 6,
  duration: 12,
  loanStartDate: toLocalISOString(start),
};
const plan = (overrides = {}) => generateAmortizationSchedule(loan, [], overrides);
const sum = (rows: { principal: number }[]) => Math.round(rows.reduce((s, r) => s + r.principal, 0) * 100) / 100;

test('skipping a payment pays nothing that month and adds a month at the end', () => {
  const o = applyLoanOverride({}, 3, { status: 'Deferred', deferralType: 'full' });
  const rows = plan(o);
  assert.equal(rows[2].totalPayment, 0);
  assert.equal(rows[2].status, 'Deferred');
  assert.equal(rows.length, 13);
  assert.equal(sum(rows), 12000, 'all principal is still repaid');
  assert.deepEqual(loanOverrideKinds(o[3]), ['skipped']);
});

test('interest only pays the interest and no principal', () => {
  const o = applyLoanOverride({}, 2, { status: 'Deferred', deferralType: 'interest_only' });
  const row = plan(o)[1];
  assert.equal(row.principal, 0);
  assert.ok(row.interest > 0);
  assert.deepEqual(loanOverrideKinds(o[2]), ['interest_only']);
});

test('an edited payment uses the typed figures', () => {
  const o = applyLoanOverride({}, 1, { totalPayment: 2000, principal: 1940, interest: 60 });
  const row = plan(o)[0];
  assert.equal(row.totalPayment, 2000);
  assert.equal(row.principal, 1940);
  assert.deepEqual(loanOverrideKinds(o[1]), ['edited']);
});

test('one change keeps the payment\'s other changes; removing the last change drops the payment', () => {
  let o = applyLoanOverride({}, 4, { status: 'Deferred', deferralType: 'interest_only' });
  o = applyLoanOverride(o, 4, { extraPrincipal: 500 });
  assert.deepEqual(o[4], { status: 'Deferred', deferralType: 'interest_only', extraPrincipal: 500 });
  o = applyLoanOverride(o, 4, { extraPrincipal: undefined });
  assert.deepEqual(o[4], { status: 'Deferred', deferralType: 'interest_only' }, 'clearing extra principal keeps the deferral');
  o = applyLoanOverride(o, 4, { status: undefined });
  assert.equal(o[4], undefined, 'ending the deferral removes its kind and the now-empty payment');
});

test('clear removes one payment\'s changes and leaves the others', () => {
  let o = applyLoanOverride({}, 1, { extraPrincipal: 100 });
  o = applyLoanOverride(o, 2, { status: 'Deferred', deferralType: 'full' });
  o = applyLoanOverride(o, 1, 'clear');
  assert.deepEqual(Object.keys(o), ['2']);
});
