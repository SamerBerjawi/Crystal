import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePlans, simulatePlan, type DebtInput } from '../../utils/debtPlan';

const today = new Date(2026, 0, 15);
const card: DebtInput = { id: 'card', name: 'Card', balance: 1000, rate: 24, minimum: 50 };
const loan: DebtInput = { id: 'loan', name: 'Loan', balance: 5000, rate: 6, minimum: 150 };

test('a single zero-interest debt is paid off in balance / payment months', () => {
  const r = simulatePlan([{ id: 'a', name: 'A', balance: 1000, rate: 0, minimum: 100 }], 0, 'minimums', today);
  assert.equal(r.months, 10);
  assert.equal(r.interest, 0);
  assert.equal(r.payoff, '2026-11');
  assert.equal(r.balances[0], 1000);
  assert.equal(r.balances[10], 0);
});

test('interest on one debt matches the closed form', () => {
  // 1200 at 12% a year, 100 a month: n = -ln(1 - r*P/pmt) / ln(1+r) with r = 1%, about 12.85 months, so 85 of interest
  const r = simulatePlan([{ id: 'a', name: 'A', balance: 1200, rate: 12, minimum: 100 }], 0, 'minimums', today);
  assert.equal(r.months, 13);
  assert.ok(Math.abs(r.interest - 85) < 1.5, `interest ${r.interest}`);
});

test('avalanche pays the high rate first and beats snowball on interest here', () => {
  // The card is both the highest rate and the smallest balance, so use a trap: a big balance at a high rate.
  const big: DebtInput = { id: 'big', name: 'Big', balance: 8000, rate: 20, minimum: 200 };
  const small: DebtInput = { id: 'small', name: 'Small', balance: 500, rate: 5, minimum: 25 };
  const c = comparePlans([big, small], 300, today);
  assert.ok(c.avalanche.interest < c.snowball.interest);
  assert.equal(c.cheapest, 'avalanche');
  assert.equal(c.snowball.order[0].id, 'small');
  assert.equal(c.avalanche.order[0].id, 'big'); // the extra all goes to the 20% debt
  assert.ok(c.avalanche.months! <= c.minimums.months!);
});

test('extra money shortens the plan and saves interest against minimums only', () => {
  const c = comparePlans([card, loan], 200, today);
  assert.ok(c.avalanche.months! < c.minimums.months!);
  assert.ok(c.saved.avalanche > 0);
  assert.equal(c.saved.avalanche, Math.round((c.minimums.interest - c.avalanche.interest) * 100) / 100);
});

test('a paid-off debt hands its payment on, so the budget stays level', () => {
  const r = simulatePlan([card, loan], 100, 'avalanche', today);
  // Budget 300 a month the whole way: total owed never rises and ends at zero.
  assert.equal(r.balances[r.balances.length - 1], 0);
  assert.ok(r.balances.every((b, i) => i === 0 || b <= r.balances[i - 1]));
  assert.equal(r.order[0].id, 'card');
});

test('a payment that does not cover the interest never finishes and is named', () => {
  const r = simulatePlan([{ id: 'a', name: 'A', balance: 10000, rate: 24, minimum: 100 }], 0, 'minimums', today);
  assert.equal(r.months, null);
  assert.equal(r.payoff, null);
  assert.deepEqual(r.stuck, ['a']);
});

test('debts with no payment or no balance are left out', () => {
  const r = simulatePlan([{ id: 'a', name: 'A', balance: 500, rate: 0, minimum: 0 }, { id: 'b', name: 'B', balance: 0, rate: 5, minimum: 10 }], 50, 'avalanche', today);
  assert.equal(r.months, 0);
  assert.equal(r.balances[0], 0);
});
