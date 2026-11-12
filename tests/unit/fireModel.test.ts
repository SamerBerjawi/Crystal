import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Transaction } from '../../types';
import { setMainCurrency } from '../../utils';
import { balanceHistory, defaultFireAccounts, monthlyCashflow, trailingSavings } from '../../utils/fireModel';

const today = new Date(2026, 10, 15); // 15 November 2026

const account = (over: Partial<Account>): Account => ({ id: 'a', name: 'Account', type: 'Checking', balance: 0, currency: 'EUR', status: 'open', ...over } as Account);
let n = 0;
const tx = (accountId: string, date: string, amount: number, over: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++n}`, accountId, date, description: 'x', amount: amount < 0 ? amount : amount, category: 'Salary', type: amount < 0 ? 'expense' : 'income', currency: 'EUR', ...over }) as Transaction;


test('which accounts count: cash, savings and investments, not a home, a car or debt', () => {
  const all = [
    account({ id: 'chk' }), account({ id: 'sav', type: 'Savings' }), account({ id: 'inv', type: 'Investment' }),
    account({ id: 'cash', type: 'Other Assets', otherSubType: 'Cash' }), account({ id: 'gold', type: 'Other Assets', otherSubType: 'Precious Metals' }),
    account({ id: 'home', type: 'Property' }), account({ id: 'car', type: 'Vehicle' }), account({ id: 'cc', type: 'Credit Card' }), account({ id: 'loan', type: 'Loan' }),
    account({ id: 'old', type: 'Savings', status: 'closed' }), account({ id: 'hidden', type: 'Savings', includeInAnalytics: false }),
  ];
  assert.deepEqual(defaultFireAccounts(all).map(a => a.id), ['chk', 'sav', 'inv', 'cash']);
});

test('history walks back from today, and a move between your own accounts changes nothing', () => {
  const a = account({ id: 'a', balance: 1000 });
  const b = account({ id: 'b', type: 'Savings', balance: 5000 });
  const rows = [
    tx('a', '2026-09-10', 500), tx('a', '2026-10-12', -200), tx('a', '2026-11-03', 300),
    tx('a', '2026-09-20', -400, { transferId: 'T1', type: 'expense' }), tx('b', '2026-09-20', 400, { transferId: 'T1', type: 'income' }),
  ];
  const both = balanceHistory([a, b], rows, today);
  // Today 6000 (1000 + 5000). November +300; October -200; September +500 (the transfer is internal).
  assert.deepEqual(both.map(p => [p.month, p.value]), [['2026-08', 5400], ['2026-09', 5900], ['2026-10', 5700], ['2026-11', 6000]]);

  const onlyA = balanceHistory([a], rows, today);
  // The transfer now leaves the set, so it counts: September -400 as well.
  assert.deepEqual(onlyA.map(p => [p.month, p.value]), [['2026-08', 1000 - 300 + 200 - 500 + 400], ['2026-09', 1000 - 300 + 200], ['2026-10', 1000 - 300], ['2026-11', 1000]]);
});

test('a transaction dated after today is not part of today\'s value', () => {
  const a = account({ id: 'a', balance: 1000 });
  const history = balanceHistory([a], [tx('a', '2026-11-20', 200), tx('a', '2026-11-02', 100)], today);
  assert.equal(history[history.length - 1].value, 800, 'the balance already includes the 200 that has not happened yet');
  assert.equal(history[history.length - 2].value, 700);
});

test('with no transactions there is one point, today', () => {
  assert.deepEqual(balanceHistory([account({ balance: 250 })], [], today), [{ month: '2026-11', value: 250 }]);
});

test('savings rate per month: transfers are not spending, a month without income has no rate', () => {
  const a = account({ id: 'a' });
  const rows = [
    tx('a', '2026-09-01', 3000), tx('a', '2026-09-05', -1800), tx('a', '2026-09-06', -200),
    tx('a', '2026-09-07', -1000, { transferId: 'T', type: 'expense' }),
    tx('a', '2026-10-05', -500),
    tx('a', '2026-11-01', 3000), tx('a', '2026-11-04', -600),
    tx('a', '2026-11-30', -9999),
  ];
  const series = monthlyCashflow(rows, [a], today, 24);
  assert.deepEqual(series.map(m => [m.month, m.income, m.spending, m.partial]), [['2026-09', 3000, 2000, false], ['2026-10', 0, 500, false], ['2026-11', 3000, 600, true]], 'the 30th is after today');
  assert.equal(series[0].rate, 1000 / 3000);
  assert.equal(series[1].rate, null);
  assert.equal(series[2].rate, 2400 / 3000);
  const trailing = trailingSavings(series, 12);
  assert.deepEqual([trailing.months, trailing.income, trailing.spending, trailing.saved], [2, 3000, 2500, 500], 'the partial month is left out');
  assert.equal(trailing.rate, 500 / 3000);
  assert.deepEqual(monthlyCashflow([], [a], today), []);
});

/** Two years of a steady life: 4,000 in, 2,500 out, 1,000 a month moved to investments. */
const ledger = () => {
  const chk = account({ id: 'chk', balance: 6000 });
  const inv = account({ id: 'inv', type: 'Investment', balance: 54000 });
  const home = account({ id: 'home', type: 'Property', balance: 200000 });
  const rows: Transaction[] = [];
  const months: string[] = [];
  for (let i = 12; i >= 1; i--) { const d = new Date(2026, 10 - i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  months.forEach((m, i) => {
    rows.push(tx('chk', `${m}-01`, 4000), tx('chk', `${m}-05`, -1500), tx('chk', `${m}-15`, -1000, { category: 'Groceries' }));
    rows.push(tx('chk', `${m}-20`, -1000, { transferId: `T${i}`, type: 'expense' }), tx('inv', `${m}-20`, 1000, { transferId: `T${i}`, type: 'income' }));
  });
  rows.push(tx('chk', '2026-11-01', 4000), tx('chk', '2026-11-08', -800));
  return { accounts: [chk, inv, home], rows };
};


test('the history of the portfolio ignores the monthly move into investments', () => {
  const { accounts, rows } = ledger();
  const history = balanceHistory(defaultFireAccounts(accounts), rows, today);
  const byMonth = Object.fromEntries(history.map(p => [p.month, p.value]));
  // November: +4000 -800 = +3200, so October ended at 56,800. Each month before that added 1,500 (4,000 - 2,500; the transfer is internal).
  assert.equal(byMonth['2026-11'], 60000);
  assert.equal(byMonth['2026-10'], 56800);
  assert.equal(byMonth['2026-09'], 55300);
  assert.equal(history[0].month, '2025-10');
  assert.equal(history[0].value, 56800 - 12 * 1500, 'where the accounts began');
  assert.equal(history.length, 14);
});

