import test from 'node:test';
import assert from 'node:assert/strict';
import type { Account } from '../../types';
import { debtsFromAccounts } from '../../utils/debtPlanInputs';

const acc = (over: Partial<Account>): Account => ({ id: 'a', name: 'A', type: 'Checking', balance: 0, currency: 'EUR', ...over } as Account);
const base = { transactions: [], loanPaymentOverrides: {}, settings: {} };

test('a scheduled loan brings its own balance, rate and payment', () => {
  const loan = acc({ id: 'l', name: 'Car', type: 'Loan', balance: -10000, principalAmount: 10000, duration: 48, interestRate: 6, loanStartDate: '2026-01-01', monthlyPayment: 234.85 });
  const [debt] = debtsFromAccounts({ ...base, accounts: [loan] });
  assert.equal(debt.id, 'l');
  assert.equal(debt.needsDetails, false);
  assert.ok(Math.abs(debt.rate - 6) < 0.05, `rate ${debt.rate}`);
  assert.ok(Math.abs(debt.minimum - 234.85) < 0.01);
  assert.ok(debt.balance > 0 && debt.balance <= 10000.01);
});

test('another liability takes what you entered and is flagged until it has a payment', () => {
  const owed = acc({ id: 'o', name: 'Family', type: 'Other Liabilities', balance: -3000 });
  const [bare] = debtsFromAccounts({ ...base, accounts: [owed] });
  assert.equal(bare.balance, 3000);
  assert.equal(bare.needsDetails, true);
  const [set] = debtsFromAccounts({ ...base, accounts: [owed], settings: { overrides: { o: { rate: 0, payment: 250 } } } });
  assert.equal(set.minimum, 250);
  assert.equal(set.needsDetails, false);
});

test('closed accounts, lending, and debts with nothing owed are left out', () => {
  const list = [
    acc({ id: '1', type: 'Loan', balance: -500, status: 'closed' }),
    acc({ id: '2', type: 'Lending', balance: 800 }),
    acc({ id: '3', type: 'Other Liabilities', balance: 0 }),
    acc({ id: '4', type: 'Checking', balance: -50 }),
  ];
  assert.deepEqual(debtsFromAccounts({ ...base, accounts: list }), []);
});
