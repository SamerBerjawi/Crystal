import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, ScheduledPayment } from '../../types';
import { generateAmortizationSchedule } from '../../utils';
import { withExtraPrincipal } from '../../utils/scheduleModel';

const loan = { id: 'l', name: 'Loan', type: 'Loan', currency: 'EUR', balance: -200000, principalAmount: 200000, interestRate: 3, duration: 240, loanStartDate: '2040-01-01', monthlyPayment: 1109 } as Account;

test('extra principal counts once in the schedule', () => {
  const base = generateAmortizationSchedule(loan, [], {});
  const extra = generateAmortizationSchedule(loan, [], withExtraPrincipal({}, 2, 1000));
  assert.equal(extra[1].totalPayment, base[1].totalPayment + 1000);
  assert.equal(extra[1].interest, base[1].interest);
  assert.equal(extra[1].outstandingBalance, base[1].outstandingBalance - 1000);
});

test('it keeps an edited payment and replaces a deferral', () => {
  const edited: Record<number, Partial<ScheduledPayment>> = { 2: { totalPayment: 1500 }, 3: { status: 'Deferred', totalPayment: 0, principal: 0, interest: 0 } };
  assert.deepEqual(withExtraPrincipal(edited, 2, 100)[2], { totalPayment: 1500, extraPrincipal: 100 });
  assert.deepEqual(withExtraPrincipal(edited, 3, 100)[3], { extraPrincipal: 100 });
  assert.deepEqual(withExtraPrincipal(edited, 4, 100)[2], edited[2]);
  assert.deepEqual(withExtraPrincipal({ 2: { principal: 1600, totalPayment: 2100, extraPrincipal: 1000 } }, 2, 500)[2], { extraPrincipal: 500 });
});
