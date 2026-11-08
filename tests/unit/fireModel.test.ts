import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Transaction } from '../../types';
import { setMainCurrency } from '../../utils';
import {
  balanceHistory, buildFire, coastNumber, defaultFireAccounts, describeMonths, sinceCoast, fiNumber, fireAccounts, monthlyCashflow, monthsToCoast, monthsToReach, niceThresholds, normalizeFireSettings,
  projectValues, sinceMonth, trailingSavings, type ValuePoint,
} from '../../utils/fireModel';

setMainCurrency('EUR');
const today = new Date(2026, 10, 15); // 15 November 2026

const account = (over: Partial<Account>): Account => ({ id: 'a', name: 'Account', type: 'Checking', balance: 0, currency: 'EUR', status: 'open', ...over } as Account);
let n = 0;
const tx = (accountId: string, date: string, amount: number, over: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++n}`, accountId, date, description: 'x', amount: amount < 0 ? amount : amount, category: 'Salary', type: amount < 0 ? 'expense' : 'income', currency: 'EUR', ...over }) as Transaction;

/** The textbook answer, for a start P, monthly c and yearly rate: the smallest n with P(1+m)^n + c((1+m)^n - 1)/m >= T. */
const closedForm = (P: number, T: number, c: number, annual: number) => {
  const m = Math.pow(1 + annual, 1 / 12) - 1;
  return Math.ceil(Math.log((T * m + c) / (P * m + c)) / Math.log(1 + m) - 1e-9);
};

test('the FI number and the coast number are the textbook ones', () => {
  assert.equal(fiNumber(30000, 0.04), 750000);
  assert.equal(fiNumber(24000, 0.03), 800000);
  assert.equal(fiNumber(0, 0.04), 0, 'no spending, no number');
  assert.equal(coastNumber(750000, 25, 0.05), Math.round((750000 / Math.pow(1.05, 25)) * 100) / 100);
  assert.equal(coastNumber(750000, 0, 0.05), 750000, 'with no years left you need all of it');
  assert.equal(coastNumber(750000, 25, 0), 750000, 'with no growth you need all of it now');
});

test('months to reach a target match the closed form, with and without saving', () => {
  assert.equal(monthsToReach(150000, 750000, 2000, 0.05), closedForm(150000, 750000, 2000, 0.05));
  assert.equal(monthsToReach(60000, 750000, 1500, 0.05), closedForm(60000, 750000, 1500, 0.05));
  assert.equal(monthsToReach(100000, 200000, 0, 0.05), 171, 'doubling at 5% a year: 12 * ln 2 / ln 1.05 = 170.5');
  assert.equal(monthsToReach(1000, 1000, 500, 0.05), 0, 'already there');
  assert.equal(monthsToReach(1500, 1000, 0, 0.05), 0, 'already past it');
  assert.equal(monthsToReach(100000, 750000, 0, 0), null, 'no saving and no growth never gets there');
  assert.equal(monthsToReach(100000, 750000, -3000, 0), null, 'spending the portfolio down never gets there');
  assert.equal(monthsToReach(1000, 1e12, 10, 0.01), null, 'further than 100 years is "never"');
  assert.ok((monthsToReach(60000, 750000, 1500, 0.03) as number) > (monthsToReach(60000, 750000, 1500, 0.05) as number), 'a lower return takes longer');
});

test('the projection is the same arithmetic month by month', () => {
  const values = projectValues(60000, 1500, 0.05, 24);
  assert.equal(values.length, 25);
  assert.equal(values[0], 60000);
  const m = Math.pow(1.05, 1 / 12) - 1;
  const expected = 60000 * Math.pow(1 + m, 24) + 1500 * ((Math.pow(1 + m, 24) - 1) / m);
  assert.ok(Math.abs(values[24] - expected) < 0.05, `${values[24]} vs ${expected}`);
  // The projection is rounded to cents, so aim a cent below it.
  assert.equal(monthsToReach(60000, values[24] - 0.01, 1500, 0.05), 24, 'reaching the value the projection reaches takes the months it took');
});

test('coast FI: reached now, or the first month growth alone will do', () => {
  assert.equal(monthsToCoast(300000, 0, 0.05, 750000, 25), 0, '300k is above the 221k coast number');
  const t = monthsToCoast(60000, 1500, 0.05, 750000, 25) as number;
  assert.ok(t > 0 && t < 25 * 12);
  const m = Math.pow(1.05, 1 / 12) - 1;
  const at = (months: number) => 60000 * Math.pow(1 + m, months) + 1500 * ((Math.pow(1 + m, months) - 1) / m);
  assert.ok(at(t) >= coastNumber(750000, 25 - t / 12, 0.05), 'at that month it is enough');
  assert.ok(at(t - 1) < coastNumber(750000, 25 - (t - 1) / 12, 0.05), 'and a month earlier it was not');
  assert.equal(monthsToCoast(1000, 0, 0, 750000, 25), null, 'never, with no saving and no growth');
  assert.equal(monthsToCoast(1000, 0, 0.05, 750000, 0), null, 'no years left');
});

test('a value is "since" the month it last rose above a line and stayed there', () => {
  const history: ValuePoint[] = [10, 20, 90, 120, 110, 130].map((value, i) => ({ month: `2026-0${i + 1}`, value }));
  assert.deepEqual(sinceMonth(history, 100), { month: '2026-04', beforeHistory: false }, 'not March: 90 is below, and it has held since April');
  assert.equal(sinceMonth(history, 200), null, 'not there yet');
  assert.deepEqual(sinceMonth(history, 5), { month: '2026-01', beforeHistory: true }, 'above it before the history begins');
  const dipped: ValuePoint[] = [150, 90, 150, 160].map((value, i) => ({ month: `2026-0${i + 1}`, value }));
  assert.deepEqual(sinceMonth(dipped, 100), { month: '2026-03', beforeHistory: false }, 'a dip resets it: the date is the last time it got there');
  assert.equal(sinceMonth([], 1), null);
});

test('round-number milestones climb from a thousand and run past the target', () => {
  const steps = niceThresholds(260000);
  assert.deepEqual(steps.slice(0, 6), [1000, 2500, 5000, 7500, 10000, 25000]);
  assert.ok(steps.includes(100000) && steps.includes(250000));
  assert.deepEqual(steps.filter(step => step > 260000), [500000, 750000, 1000000], 'the three after what you have, so there is always a next one');
  assert.ok(niceThresholds(0).length >= 3);
});

test('settings are filled in and held to a sensible range', () => {
  assert.deepEqual(normalizeFireSettings(undefined), { withdrawalRate: 0.04, expectedReturn: 0.05, expenses: { mode: 'actual' }, contribution: { mode: 'actual' }, accountIds: undefined, currentAge: undefined, retirementAge: undefined });
  const wild = normalizeFireSettings({ withdrawalRate: 0.5, expectedReturn: -3, currentAge: 3, retirementAge: 400, expenses: { mode: 'manual', manualAnnual: -5 } });
  assert.equal(wild.withdrawalRate, 0.1);
  assert.equal(wild.expectedReturn, 0);
  assert.equal(wild.currentAge, 16);
  assert.equal(wild.retirementAge, 100);
  assert.deepEqual(wild.expenses, { mode: 'actual' }, 'a manual amount that is not positive is ignored');
  assert.equal(normalizeFireSettings({ currentAge: 50, retirementAge: 45 }).retirementAge, undefined, 'retiring before today makes no sense');
  assert.deepEqual(normalizeFireSettings({ expenses: { mode: 'manual', manualAnnual: 24000.456 }, contribution: { mode: 'manual', manualMonthly: -200 } }).contribution, { mode: 'manual', manualMonthly: -200 }, 'a negative contribution (drawing down) is allowed');
  assert.deepEqual(normalizeFireSettings({ accountIds: ['a', 5, 'b'] }).accountIds, ['a', 'b']);
});

test('which accounts count: cash, savings and investments, not a home, a car or debt', () => {
  const all = [
    account({ id: 'chk' }), account({ id: 'sav', type: 'Savings' }), account({ id: 'inv', type: 'Investment' }),
    account({ id: 'cash', type: 'Other Assets', otherSubType: 'Cash' }), account({ id: 'gold', type: 'Other Assets', otherSubType: 'Precious Metals' }),
    account({ id: 'home', type: 'Property' }), account({ id: 'car', type: 'Vehicle' }), account({ id: 'cc', type: 'Credit Card' }), account({ id: 'loan', type: 'Loan' }),
    account({ id: 'old', type: 'Savings', status: 'closed' }), account({ id: 'hidden', type: 'Savings', includeInAnalytics: false }),
  ];
  assert.deepEqual(defaultFireAccounts(all).map(a => a.id), ['chk', 'sav', 'inv', 'cash']);
  assert.deepEqual(fireAccounts(all, normalizeFireSettings({ accountIds: ['home', 'chk', 'old', 'hidden'] })).map(a => a.id), ['chk', 'home'], 'a chosen set is honoured, minus closed or hidden accounts');
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

test('the whole picture, worked out on paper', () => {
  const { accounts, rows } = ledger();
  const fire = buildFire({ accounts, transactions: rows, today }, undefined);
  assert.equal(fire.ready, true);
  assert.deepEqual(fire.accounts.map(a => a.id), ['chk', 'inv'], 'the home is left out');
  assert.equal(fire.portfolio, 60000);

  // 12 finished months: 48,000 in, 30,000 out.
  assert.equal(fire.savings.trailing.months, 12);
  assert.equal(fire.savings.trailing.rate, 18000 / 48000);
  assert.equal(fire.expenses.annual, 30000);
  assert.equal(fire.expenses.monthly, 2500);
  assert.equal(fire.savings.monthlyContribution, 1500);
  assert.equal(fire.fi.number, 750000);
  assert.equal(fire.fi.remaining, 690000);
  assert.equal(fire.fi.progress, 60000 / 750000);
  assert.equal(fire.fi.monthlyIncome, 200, '60,000 at 4% a year is 200 a month');
  assert.equal(fire.fi.coverage, 2400 / 30000, 'that covers 8% of the 30,000 spent');
  assert.equal(fire.fi.months, closedForm(60000, 750000, 1500, 0.05));

  const { cautious, expected, optimistic } = fire.fi.scenarios;
  assert.ok(optimistic! < expected! && expected! < cautious!, 'a better return gets there sooner');
  assert.equal(cautious, closedForm(60000, 750000, 1500, 0.03));
  assert.equal(optimistic, closedForm(60000, 750000, 1500, 0.07));
  assert.equal(fire.coast, null, 'without ages there is no coast number');
  assert.equal(fire.warnings.length, 0);
});

test('the history of the portfolio ignores the monthly move into investments', () => {
  const { accounts, rows } = ledger();
  const fire = buildFire({ accounts, transactions: rows, today }, undefined);
  const byMonth = Object.fromEntries(fire.history.map(p => [p.month, p.value]));
  // November: +4000 -800 = +3200, so October ended at 56,800. Each month before that added 1,500 (4,000 - 2,500; the transfer is internal).
  assert.equal(byMonth['2026-11'], 60000);
  assert.equal(byMonth['2026-10'], 56800);
  assert.equal(byMonth['2026-09'], 55300);
  assert.equal(fire.history[0].month, '2025-10');
  assert.equal(fire.history[0].value, 56800 - 12 * 1500, 'where the accounts began');
  assert.equal(fire.history.length, 14);
});

test('milestones: when each stage was passed, and how far off the next ones are', () => {
  const { accounts, rows } = ledger();
  const fire = buildFire({ accounts, transactions: rows, today }, { currentAge: 35, retirementAge: 60 });
  assert.equal(fire.coast!.number, coastNumber(750000, 25, 0.05));
  assert.equal(fire.coast!.reached, false);
  assert.ok(fire.coast!.monthsAway! > 0);
  assert.deepEqual(fire.stages.map(s => s.id), ['quarter', 'coast', 'half', 'lean', 'fi', 'fat'].sort((x, y) => fire.stages.find(s => s.id === x)!.amount - fire.stages.find(s => s.id === y)!.amount), 'in order of amount');
  assert.deepEqual(fire.stages.filter(s => s.kind !== 'coast').map(s => s.amount), [187500, 375000, 525000, 750000, 1125000]);
  assert.ok(fire.stages.every(s => !s.reached), '60k is below every stage');
  assert.equal(fire.stages.find(s => s.id === 'fi')!.monthsAway, fire.fi.months);
  const coastStage = fire.stages.find(s => s.id === 'coast')!;
  assert.equal(coastStage.monthsAway, fire.coast!.monthsAway, 'the Coast row and the Coast note give one answer');
  assert.ok(coastStage.monthsAway! > monthsToReach(60000, fire.coast!.number, 1500, 0.05)!, 'later than reaching today\'s number, because the number rises as retirement nears');

  // Net worth: 60,000 plus a 200,000 home = 260,000. It passed 250,000 in June 2026 (238,800 + 1,500 a month).
  assert.equal(fire.netWorth.current, 260000);
  const reached = fire.netWorth.milestones.filter(m => m.reached);
  assert.deepEqual(reached.map(m => m.amount), [50000, 75000, 100000, 250000]);
  assert.deepEqual(reached.find(m => m.amount === 250000)!.since, { month: '2026-06', beforeHistory: false });
  assert.deepEqual(reached.find(m => m.amount === 100000)!.since, { month: '2025-10', beforeHistory: true }, 'above 100k for the whole recorded history');
  const next = fire.netWorth.milestones.filter(m => !m.reached);
  assert.deepEqual(next.map(m => m.amount), [500000, 750000, 1000000]);
  assert.equal(next[0].progress, (260000 - 250000) / (500000 - 250000));
  assert.equal(next[0].monthsAway, closedForm(60000, 500000 - 200000, 1500, 0.05), 'the home is held flat; the portfolio does the climbing');
});

test('a stage already passed is dated', () => {
  const { accounts, rows } = ledger();
  const rich = accounts.map(a => (a.id === 'inv' ? { ...a, balance: 450000 } : a));
  const fire = buildFire({ accounts: rich, transactions: rows, today }, undefined);
  const quarter = fire.stages.find(s => s.id === 'quarter')!;
  assert.equal(quarter.reached, true);
  assert.deepEqual(quarter.since, { month: '2025-10', beforeHistory: true });
  assert.equal(fire.stages.find(s => s.id === 'half')!.reached, true, '456k is above the 375k half-way mark');
  assert.equal(fire.stages.find(s => s.id === 'fi')!.reached, false);
  assert.ok(fire.fi.progress > 0.6 && fire.fi.progress < 0.7);
});

test('your own numbers replace the history', () => {
  const { accounts, rows } = ledger();
  const fire = buildFire({ accounts, transactions: rows, today }, { withdrawalRate: 0.03, expenses: { mode: 'manual', manualAnnual: 24000 }, contribution: { mode: 'manual', manualMonthly: 2000 }, expectedReturn: 0.04 });
  assert.equal(fire.fi.number, 800000);
  assert.equal(fire.expenses.source, 'manual');
  assert.equal(fire.savings.monthlyContribution, 2000);
  assert.equal(fire.fi.months, closedForm(60000, 800000, 2000, 0.04));
  assert.equal(fire.savings.trailing.rate, 18000 / 48000, 'the savings rate is still what actually happened');
});

test('not enough to go on is said plainly, not guessed', () => {
  const none = buildFire({ accounts: [account({ balance: 1000 })], transactions: [], today }, undefined);
  assert.equal(none.ready, false);
  assert.equal(none.fi.number, 0);
  assert.equal(none.fi.months, null);
  assert.equal(none.stages.length, 0);
  assert.match(none.warnings.join(' '), /no spending history/i);

  const two = buildFire({ accounts: [account({ id: 'a', balance: 5000 })], transactions: [tx('a', '2026-09-01', 3000), tx('a', '2026-09-10', -2000), tx('a', '2026-10-01', 3000), tx('a', '2026-10-10', -2000)], today }, undefined);
  assert.equal(two.savings.trailing.months, 2);
  assert.equal(two.expenses.annual, 24000, 'two months of 2,000 is 2,000 a month');
  assert.match(two.warnings.join(' '), /Only 2 months/);

  const spender = buildFire({ accounts: [account({ id: 'a', balance: 5000 })], transactions: [tx('a', '2026-10-01', 2000), tx('a', '2026-10-10', -3000)], today }, undefined);
  assert.match(spender.warnings.join(' '), /not adding to the portfolio/);

  const noAccounts = buildFire({ accounts: [account({ type: 'Property', balance: 1 })], transactions: [], today }, undefined);
  assert.match(noAccounts.warnings.join(' '), /No accounts are counted/);
});

test('the projection runs to the FI month with a margin, and never past 40 years', () => {
  const { accounts, rows } = ledger();
  const fire = buildFire({ accounts, transactions: rows, today }, undefined);
  assert.equal(fire.projection[0], 60000);
  assert.equal(fire.projection.length, Math.min(480, Math.max(120, fire.fi.months! + 24)) + 1);
  assert.ok(fire.projection[fire.fi.months!] >= 750000 && fire.projection[fire.fi.months! - 1] < 750000);
  const never = buildFire({ accounts: [account({ id: 'a', balance: 100 })], transactions: [tx('a', '2026-10-01', 1000), tx('a', '2026-10-10', -1500)], today }, { expectedReturn: 0 });
  assert.equal(never.fi.months, null);
  assert.equal(never.projection.length, 121);
});

test('a span of months is put in words', () => {
  assert.equal(describeMonths(null), 'not at this pace');
  assert.equal(describeMonths(0), 'now');
  assert.equal(describeMonths(1), '1 month');
  assert.equal(describeMonths(9), '9 months');
  assert.equal(describeMonths(12), '1 year');
  assert.equal(describeMonths(26), '2 years 2 months');
  assert.equal(describeMonths(241), '20 years 1 month');
});

test('Coast FI is dated against what was needed at the time', () => {
  // 25 years to go and a 750k FI number at 5%: 221.5k needed now, less the further back you look.
  const need = (monthsAgo: number) => coastNumber(750000, 25 + monthsAgo / 12, 0.05);
  const history: ValuePoint[] = [3, 2, 1, 0].map((ago, i) => ({ month: `2026-0${i + 8}`, value: need(ago) + (ago === 3 ? -1 : 1) }));
  assert.deepEqual(sinceCoast(history, 750000, 25, 0.05), { month: '2026-09', beforeHistory: false }, 'above what was needed from the second month on');
  assert.deepEqual(sinceCoast(history.map(p => ({ ...p, value: 1e9 })), 750000, 25, 0.05), { month: '2026-08', beforeHistory: true });
  assert.equal(sinceCoast([{ month: '2026-08', value: 1 }], 750000, 25, 0.05), null);
  assert.equal(sinceCoast([], 750000, 25, 0.05), null);
});

test('a portfolio already past Coast FI says since when', () => {
  const { accounts, rows } = ledger();
  const rich = accounts.map(a => (a.id === 'inv' ? { ...a, balance: 450000 } : a));
  const fire = buildFire({ accounts: rich, transactions: rows, today }, { currentAge: 35, retirementAge: 60 });
  assert.equal(fire.coast!.reached, true);
  const stage = fire.stages.find(s => s.id === 'coast')!;
  assert.equal(stage.reached, true);
  assert.deepEqual(stage.since, { month: '2025-10', beforeHistory: true });
});
