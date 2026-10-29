import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Budget, Category, Transaction } from '../../types';
import { toLocalISOString } from '../../utils';
import { computeAccountsHeroModel, computeCashSegmentNetFlow } from '../../utils/accountsModel';
import {
  computeCompoundingProjection,
  computeCreditCardAccountMetrics,
  computePensionAccountMetrics,
  computeSavingsAccountMetrics,
  computeXirr,
  monthlyRateFromApy,
  resolveRealTodayBalance,
} from '../../utils/accountDetailModel';
import { forecastMonthEnd, linkBudgetsToCategories, monthPace } from '../../utils/budgetModel';

/*
 * One regression case per Phase 2 finding in docs/ACCOUNTS_BUDGET_REVIEW_PLAN.md.
 */

const RATES = { EUR: 1, USD: 0.9, RON: 0.2 };
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

test('L-A6: 30-day net flow covers 30 days including today and skips balance adjustments', () => {
  const chk: Account = { id: 'c', name: 'Checking', type: 'Checking', balance: 0, currency: 'EUR' };
  const txs = [
    tx({ id: 'in', accountId: 'c', date: iso(-29), amount: 100 }),
    tx({ id: 'out', accountId: 'c', date: iso(-30), amount: 1000 }),
    tx({ id: 'adj', accountId: 'c', date: iso(-1), amount: 50, isBalanceAdjustment: true }),
  ];
  assert.equal(computeCashSegmentNetFlow([chk], txs, 30, { referenceDate: today, conversionRates: RATES }), 100);
});

test('L-A7: the savings threshold is in EUR, Lending overdue is flagged', () => {
  const ron: Account = { id: 'ron', name: 'RON savings', type: 'Savings', balance: 2000, currency: 'RON' };
  const eur: Account = { id: 'eur', name: 'EUR savings', type: 'Savings', balance: 2000, currency: 'EUR' };
  const lent: Account = {
    id: 'lend', name: 'Lent to friend', type: 'Lending', balance: 0, currency: 'EUR',
    principalAmount: 1200, interestRate: 0, duration: 12, loanStartDate: iso(-100),
  };
  const hero = computeAccountsHeroModel([ron, eur, lent], [], {}, 'EUR', { conversionRates: RATES, referenceDate: today });
  const ids = hero.attentionItems.map((a) => a.id);
  assert.ok(!ids.includes('sav-apy-ron'), '2,000 RON (≈ €400) is under the €1,000 threshold');
  assert.ok(ids.includes('sav-apy-eur'));
  assert.ok(ids.includes('loan-overdue-lend'));
});

test('L-A7: a bank consent ending within 14 days is flagged', () => {
  const chk: Account = { id: 'c', name: 'Checking', type: 'Checking', balance: 10, currency: 'EUR' };
  const hero = computeAccountsHeroModel([chk], [], {}, 'EUR', {
    conversionRates: RATES,
    referenceDate: today,
    bankConsentExpiry: new Map([['c', `${iso(5)}T12:00:00`]]),
  });
  assert.ok(hero.attentionItems.some((a) => a.id === 'bank-consent-c'));
});

test('L-A7: a card payment due within 7 days is flagged while something is owed', () => {
  if (today.getDate() > 24) return; // the payment day must fall in this month for this fixture
  const card: Account = {
    id: 'cc', name: 'Card', type: 'Credit Card', balance: -300, currency: 'EUR',
    statementStartDate: 1, paymentDate: today.getDate() + 3,
  };
  const hero = computeAccountsHeroModel([card], [], {}, 'EUR', { conversionRates: RATES, referenceDate: today });
  assert.ok(hero.attentionItems.some((a) => a.id === 'cc-due-cc'));
});

test('L-D4: APY compounds to exactly the APY over a year', () => {
  close(Math.pow(1 + monthlyRateFromApy(5), 12) - 1, 0.05, 1e-9);
  const proj = computeCompoundingProjection({ initialBalance: 10000, monthlyDeposit: 0, apy: 5, years: 1 });
  close(proj.finalBalance, 10500);
});

test('L-D5: XIRR solves a simple one-year return', () => {
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const r = computeXirr([
    { date: yearAgo, amount: -1000 },
    { date: today, amount: 1100 },
  ])!;
  close(r, 0.1, 0.002);
});

test('L-D5: a pension funded monthly gets a money-weighted return above the "all on day one" figure', () => {
  const pension: Account = {
    id: 'p', name: 'Pension', type: 'Investment', subType: 'Pension Fund', balance: 1300, currency: 'EUR',
  };
  const txs: Transaction[] = [];
  for (let m = 12; m >= 1; m--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - m);
    txs.push(tx({ id: `c${m}`, accountId: 'p', date: toLocalISOString(d), amount: 100, category: 'Contribution' }));
  }
  const m = computePensionAccountMetrics(pension, txs, { referenceDate: today, rates: RATES });
  assert.ok(m.annualizedReturn !== null && m.annualizedReturn > 0.12, `got ${m.annualizedReturn}`);
});

test('L-D4: no invented pension defaults: no retirement year or return means no projection', () => {
  const pension: Account = {
    id: 'p', name: 'Pension', type: 'Investment', subType: 'Pension Fund', balance: 1000, currency: 'EUR',
  };
  const m = computePensionAccountMetrics(pension, [], { referenceDate: today });
  assert.equal(m.retirementYear, null);
  assert.equal(m.projectedValueAtRetirement, null);
  assert.deepEqual(m.missingForProjection, { retirementYear: true, expectedReturn: true });
  const set = computePensionAccountMetrics(
    { ...pension, expectedRetirementYear: today.getFullYear() + 10, apy: 4 },
    [],
    { referenceDate: today }
  );
  assert.ok((set.projectedValueAtRetirement ?? 0) > 1000);
});

test('L-D6: months before the last recorded payout are not estimated on top of it', () => {
  const ref = new Date(today.getFullYear(), 5, 15);
  const acc: Account = { id: 's', name: 'Savings', type: 'Savings', balance: 12000, currency: 'EUR', apy: 4, openingDate: `${ref.getFullYear() - 1}-01-01` };
  const payout = tx({ id: 'q1', accountId: 's', date: `${ref.getFullYear()}-03-31`, amount: 118, category: 'Interest' });
  const cats: Category[] = [{ id: 'i', name: 'Interest', color: '#000', classification: 'income', subCategories: [] }];
  const m = computeSavingsAccountMetrics(acc, [payout], cats, { referenceDate: ref });
  const byMonth = Object.fromEntries(m.interestHistory.map((p) => [p.monthKey, p.value]));
  const y = ref.getFullYear();
  assert.equal(byMonth[`${y}-01`], 0, 'January is covered by the quarterly payout');
  assert.equal(byMonth[`${y}-03`], 118);
  assert.ok(byMonth[`${y}-04`] > 0, 'months after the payout are estimated');
  // YTD = the payout + estimates for April, May and half of June.
  assert.ok(m.totalInterestYTD > 118 && m.totalInterestYTD < 118 + 39.3 * 2.6, `got ${m.totalInterestYTD}`);
});

test('L-D7: card spend history is by statement cycle; transfers in are payments, other income refunds', () => {
  const ref = new Date(today.getFullYear(), today.getMonth(), 20);
  const y = ref.getFullYear();
  const mo = String(ref.getMonth() + 1).padStart(2, '0');
  const card: Account = { id: 'cc', name: 'Card', type: 'Credit Card', balance: -100, currency: 'EUR', statementStartDate: 15, paymentDate: 5 };
  const txs = [
    tx({ id: 'a', accountId: 'cc', date: `${y}-${mo}-14`, amount: -40 }),
    tx({ id: 'b', accountId: 'cc', date: `${y}-${mo}-16`, amount: -60 }),
    tx({ id: 'r', accountId: 'cc', date: `${y}-${mo}-17`, amount: 10, category: 'Shopping' }),
  ];
  const m = computeCreditCardAccountMetrics(card, txs, { referenceDate: ref });
  const last = m.spendingHistory[m.spendingHistory.length - 1].value;
  const prev = m.spendingHistory[m.spendingHistory.length - 2].value;
  assert.equal(last, 50, 'cycle from the 15th: 60 spent, 10 refunded');
  assert.equal(prev, 40, 'the 14th belongs to the previous cycle');
});

test('L-D8: the number overload only backs out the given account\'s future items', () => {
  const txs = [
    tx({ id: 'mine', accountId: 'a', date: iso(3), amount: -50 }),
    tx({ id: 'other', accountId: 'b', date: iso(3), amount: -500 }),
  ];
  assert.equal(resolveRealTodayBalance(1000, 'EUR', txs, { accountId: 'a', referenceDate: today }), 1050);
});

test('L-B4: fixed bills are counted once, only the rest is extrapolated; nothing before day 5', () => {
  const month = { year: 2026, month: 3 }; // April, 30 days
  const day10 = monthPace(month, new Date(2026, 3, 10));
  // Rent 1,000 paid on the 1st, 100 of other spending by the 10th, a 50 bill still due.
  assert.equal(forecastMonthEnd(1100, day10, { paid: 1000, due: 50 }), 1000 + 50 + 300);
  assert.equal(forecastMonthEnd(1000, monthPace(month, new Date(2026, 3, 2)), { paid: 1000, due: 0 }), null);
});

test('Q8: budgets follow their category by id through a rename', () => {
  const cats: Category[] = [{ id: 'cat-food', name: 'Food', color: '#000', classification: 'expense', subCategories: [] }];
  const budgets: Budget[] = [{ id: 'b1', categoryName: 'Food', amount: 300, period: 'monthly', currency: 'EUR' }];
  const linked = linkBudgetsToCategories(budgets, cats);
  assert.equal(linked[0].categoryId, 'cat-food');
  assert.equal(linkBudgetsToCategories(linked, cats), linked, 'unchanged input returns the same array');
  const renamed = linkBudgetsToCategories(linked, [{ ...cats[0], name: 'Groceries' }]);
  assert.equal(renamed[0].categoryName, 'Groceries');
});
