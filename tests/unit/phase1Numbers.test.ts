import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, RecurringTransaction, Transaction } from '../../types';
import {
  advanceRecurrenceDate,
  calculateAccountTotals,
  computeLoanBalanceBreakdown,
  expandRecurringOccurrences,
  resolveAccountBalance,
  toLocalISOString,
} from '../../utils';
import {
  computeAccount90dSparkline,
  computeAccountsHeroModel,
  computeBalanceAdjustmentDelta,
  groupAccountsByType,
} from '../../utils/accountsModel';
import {
  computeOperatingAccountMetrics,
  computeVehicleAccountMetrics,
  computeVehicleTcoMetrics,
} from '../../utils/accountDetailModel';
import { parseAmount } from '../../utils/budgetModel';

/*
 * One regression case per Phase 1 finding in docs/ACCOUNTS_BUDGET_REVIEW_PLAN.md.
 * Dates are relative to today because the amortisation schedule reads the real clock.
 */

const RATES = { EUR: 1, USD: 0.9, GBP: 1.2 };
const today = new Date();
today.setHours(0, 0, 0, 0);
const iso = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return toLocalISOString(d);
};
const close = (actual: number, expected: number, tolerance = 0.02) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);

const tx = (p: Partial<Transaction> & Pick<Transaction, 'id' | 'accountId' | 'date' | 'amount'>): Transaction => ({
  description: 'x',
  category: 'Other',
  type: p.amount >= 0 ? 'income' : 'expense',
  currency: 'EUR',
  ...p,
});

test('L-D1: a biweekly bill is counted once per occurrence in safe to spend', () => {
  const checking: Account = { id: 'chk', name: 'Checking', type: 'Checking', balance: 1000, currency: 'EUR' };
  const rt: RecurringTransaction = {
    id: 'rt-gym',
    accountId: 'chk',
    description: 'Gym',
    amount: 20,
    type: 'expense',
    currency: 'EUR',
    frequency: 'biweekly',
    startDate: iso(2),
    nextDueDate: iso(2),
    weekendAdjustment: 'on',
  };
  const m = computeOperatingAccountMetrics(checking, [checking], [], {
    recurringTransactions: [rt],
    referenceDate: today,
    rates: RATES,
  });
  // Days 2 and 16: only day 2 is inside the 14-day window.
  assert.equal(m.upcomingPayments.length, 1);
  assert.equal(m.safeToSpend, 980);
});

test('advanceRecurrenceDate: biweekly advances 14 days and month-ends clamp without skipping February', () => {
  assert.equal(toLocalISOString(advanceRecurrenceDate(new Date(2026, 0, 1), 'biweekly')), '2026-01-15');
  const feb = advanceRecurrenceDate(new Date(2026, 0, 31), 'monthly', 1, 31);
  assert.equal(toLocalISOString(feb), '2026-02-28');
  assert.equal(toLocalISOString(advanceRecurrenceDate(feb, 'monthly', 1, 31)), '2026-03-31');
});

test('expandRecurringOccurrences: skipped occurrences and end dates are respected', () => {
  const rt: RecurringTransaction = {
    id: 'rt-1', accountId: 'a', description: 'Weekly', amount: 10, type: 'expense', currency: 'EUR',
    frequency: 'weekly', startDate: '2026-03-02', nextDueDate: '2026-03-02', endDate: '2026-03-16',
    weekendAdjustment: 'on',
  };
  const occ = expandRecurringOccurrences(rt, new Date(2026, 2, 1), new Date(2026, 2, 31), [
    { recurringTransactionId: 'rt-1', originalDate: '2026-03-09', isSkipped: true },
  ]);
  assert.deepEqual(occ.map((o) => o.date), ['2026-03-02', '2026-03-16']);
});

test('L-A4 / D1: a USD account sparkline is in USD, ending at today\'s USD balance', () => {
  const usd: Account = { id: 'usd', name: 'US Checking', type: 'Checking', balance: 1000, currency: 'USD' };
  const txs = [tx({ id: 't1', accountId: 'usd', date: iso(-10), amount: 200, currency: 'USD' })];
  const { sparklineData, trend } = computeAccount90dSparkline(usd, txs, undefined, {
    conversionRates: RATES,
    referenceDate: today,
  });
  assert.equal(sparklineData[sparklineData.length - 1].value, 1000);
  assert.equal(sparklineData[0].value, 800);
  assert.equal(trend, 200);
});

test('L-A3: an overdrawn checking account lowers assets; assets − liabilities = net worth', () => {
  const accounts: Account[] = [
    { id: 'a', name: 'Savings', type: 'Savings', balance: 5000, currency: 'EUR' },
    { id: 'b', name: 'Overdrawn', type: 'Checking', balance: -300, currency: 'EUR' },
    { id: 'c', name: 'Card', type: 'Credit Card', balance: -700, currency: 'EUR' },
  ];
  const hero = computeAccountsHeroModel(accounts, [], {}, 'EUR', { conversionRates: RATES, referenceDate: today });
  assert.equal(hero.totalAssets, 4700);
  assert.equal(hero.totalLiabilities, 700);
  assert.equal(hero.netWorth, 4000);
  const last = hero.trend90d[hero.trend90d.length - 1].value;
  assert.equal(last, hero.netWorth, '90-day chart ends at the headline');
  const assetsLast = hero.assetsTrend[hero.assetsTrend.length - 1].value;
  const liabLast = hero.liabilitiesTrend[hero.liabilitiesTrend.length - 1].value;
  close(assetsLast - liabLast, hero.netWorth);
});

test('L-A3: a card in credit lowers debt instead of adding to it, in totals and group subtotals', () => {
  const card: Account = { id: 'cc', name: 'Card', type: 'Credit Card', balance: 50, currency: 'EUR' };
  const loanCard: Account = { id: 'cc2', name: 'Card 2', type: 'Credit Card', balance: -200, currency: 'EUR' };
  const totals = calculateAccountTotals([card, loanCard], [], {}, { rates: RATES, referenceDate: today });
  assert.equal(totals.totalDebt, 150);
  const groups = groupAccountsByType([card, loanCard], { cc: 50, cc2: -200 }, (v) => v, 'liabilities');
  assert.equal(groups[0].subtotal, 150);
});

test('L-A2 / BUG-07: future-dated items are out of every headline figure', () => {
  const accounts: Account[] = [{ id: 'a', name: 'Checking', type: 'Checking', balance: 900, currency: 'EUR' }];
  const txs = [tx({ id: 'f', accountId: 'a', date: iso(5), amount: -100 })];
  const hero = computeAccountsHeroModel(accounts, txs, {}, 'EUR', { conversionRates: RATES, referenceDate: today });
  assert.equal(hero.netWorth, 1000);
  assert.equal(hero.liquidCash, 1000);
  assert.equal(hero.trend90d[hero.trend90d.length - 1].value, 1000);
});

test('X1: one FX table: totals use the rates passed in, not the module defaults', () => {
  const usd: Account = { id: 'u', name: 'USD', type: 'Checking', balance: 100, currency: 'USD' };
  const totals = calculateAccountTotals([usd], [], {}, { rates: { EUR: 1, USD: 0.5 } });
  assert.equal(totals.totalAssets, 50);
});

test('L-A1 / Q2: a loan balance is principal + accrued interest, not all future interest', () => {
  const loan: Account = {
    id: 'loan', name: 'Car loan', type: 'Loan', balance: 0, currency: 'EUR',
    principalAmount: 12000, interestRate: 6, duration: 12, loanStartDate: iso(-15),
  };
  const breakdown = computeLoanBalanceBreakdown(loan, [], {}, today)!;
  assert.equal(breakdown.outstandingPrincipal, 12000);
  // First month's interest is 60; about half of it has accrued after 15 days.
  assert.ok(breakdown.accruedInterest > 25 && breakdown.accruedInterest < 35, `accrued ${breakdown.accruedInterest}`);
  assert.ok(breakdown.futureInterest > 300, 'future interest is reported separately');
  const balance = resolveAccountBalance(loan, [], {}, { referenceDate: today });
  close(balance, -(12000 + breakdown.accruedInterest));
  const totals = calculateAccountTotals([loan], [], {}, { referenceDate: today });
  close(totals.totalDebt, 12000 + breakdown.accruedInterest);
});

test('L-A4: a loan sparkline follows the schedule and ends at today\'s balance', () => {
  const loan: Account = {
    id: 'loan', name: 'Loan', type: 'Loan', balance: 0, currency: 'EUR',
    principalAmount: 12000, interestRate: 6, duration: 12, loanStartDate: iso(-200),
  };
  const todayBal = resolveAccountBalance(loan, [], {}, { referenceDate: today });
  const { sparklineData } = computeAccount90dSparkline(loan, [], undefined, { referenceDate: today });
  close(sparklineData[sparklineData.length - 1].value, todayBal);
  assert.ok(sparklineData.every((p) => p.value < 0), 'a loan stays negative');
});

test('L-D2: a used car leased at 40,000 km starts its allowance at 40,000, not 0', () => {
  const car: Account = {
    id: 'car', name: 'Car', type: 'Vehicle', balance: 0, currency: 'EUR', ownership: 'Leased',
    leaseStartDate: iso(-182), leaseEndDate: iso(365 * 3 - 182), annualMileageAllowance: 15000,
    mileageLogs: [
      { id: 'm1', date: iso(-180), reading: 40000 },
      { id: 'm2', date: iso(0), reading: 47000 },
    ],
  };
  const m = computeVehicleAccountMetrics(car, [car], [], {}, { referenceDate: today });
  assert.equal(m.leaseStats!.distanceDrivenInLease, 7000);
  assert.equal(m.leaseStats!.mileageStatus, 'On Track');
});

test('L-D2: a lease with no mileage logs is not reported over or under budget', () => {
  const car: Account = {
    id: 'car', name: 'Car', type: 'Vehicle', balance: 0, currency: 'EUR', ownership: 'Leased',
    leaseStartDate: iso(-182), leaseEndDate: iso(900), annualMileageAllowance: 15000,
  };
  const m = computeVehicleAccountMetrics(car, [car], [], {}, { referenceDate: today });
  assert.equal(m.leaseStats!.mileageStatus, 'On Track');
  assert.equal(m.leaseStats!.mileageDiff, 0);
});

test('L-D3: TCO matches whole words and counts vehicle categories paid from other accounts', () => {
  const car: Account = { id: 'car', name: 'Car', type: 'Vehicle', balance: 9000, currency: 'EUR', purchasePrice: 10000 };
  const checking: Account = { id: 'chk', name: 'Checking', type: 'Checking', balance: 0, currency: 'EUR' };
  const txs: Transaction[] = [
    tx({ id: '1', accountId: 'chk', date: iso(-5), amount: -60, category: 'Fuel' }),
    tx({ id: '2', accountId: 'chk', date: iso(-5), amount: -500, category: 'Groceries', description: 'Revolut top-up' }),
    tx({ id: '3', accountId: 'car', date: iso(-4), amount: -40, category: 'Transport', description: 'Levy payment' }),
    tx({ id: '4', accountId: 'chk', date: iso(-3), amount: -25, category: 'Taxi' }),
  ];
  const tco = computeVehicleTcoMetrics(car, txs, { allAccounts: [car, checking] });
  assert.equal(tco.fuelSpend, 60, 'fuel on checking counts; "Revolut"/"levy" are not fuel');
  assert.equal(tco.otherOperatingSpend, 40, 'the levy on the car account is "other", not fuel');
  assert.equal(tco.insuranceTaxSpend, 0, '"Taxi" is not tax');
  assert.equal(tco.depreciation, 1000);
});

test('L-D3: with two vehicles, costs on other accounts are not guessed', () => {
  const a: Account = { id: 'a', name: 'A', type: 'Vehicle', balance: 1, currency: 'EUR' };
  const b: Account = { id: 'b', name: 'B', type: 'Vehicle', balance: 1, currency: 'EUR' };
  const txs = [tx({ id: '1', accountId: 'chk', date: iso(-5), amount: -60, category: 'Fuel' })];
  assert.equal(computeVehicleTcoMetrics(a, txs, { allAccounts: [a, b] }).fuelSpend, 0);
});

test('L-H1: a back-dated reconciliation is measured against the balance on that date', () => {
  const acc: Account = { id: 'a', name: 'Checking', type: 'Checking', balance: 1000, currency: 'EUR' };
  const txs = [
    tx({ id: '1', accountId: 'a', date: iso(-5), amount: 300 }),
    tx({ id: '2', accountId: 'a', date: iso(10), amount: -100 }),
  ];
  // Balance 10 days ago = 1000 + 100 (future) − 300 = 800. Statement said 850.
  assert.equal(computeBalanceAdjustmentDelta(acc, txs, 850, iso(-10)), 50);
  // Today = 1100 (future item excluded).
  assert.equal(computeBalanceAdjustmentDelta(acc, txs, 1100), 0);
  const loan: Account = {
    id: 'l', name: 'Loan', type: 'Loan', balance: 0, currency: 'EUR',
    principalAmount: 1000, interestRate: 5, duration: 12, loanStartDate: iso(-30),
  };
  assert.equal(computeBalanceAdjustmentDelta(loan, [], -500), null, 'amortised loans are not reconciled');
});

test('L-B3: budget amounts parse in both number styles', () => {
  assert.equal(parseAmount('1.250,50'), 1250.5);
  assert.equal(parseAmount('1.250'), 1250);
  assert.equal(parseAmount('1,250.50'), 1250.5);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
});

test('BUG-06: a loan paid from checking shows up in that account\'s safe to spend', () => {
  const checking: Account = { id: 'chk', name: 'Checking', type: 'Checking', balance: 2000, currency: 'EUR' };
  const loan: Account = {
    id: 'loan', name: 'Loan', type: 'Loan', balance: 0, currency: 'EUR', linkedAccountId: 'chk',
    principalAmount: 12000, interestRate: 0, duration: 12, monthlyPayment: 1000, loanStartDate: iso(-25),
  };
  const m = computeOperatingAccountMetrics(checking, [checking, loan], [], { referenceDate: today });
  assert.equal(m.upcomingPayments.length, 1);
  assert.equal(m.safeToSpend, 1000);
});
