import test from 'node:test';
import assert from 'node:assert/strict';
import type { Account, BillPayment, RecurringTransaction, RecurringTransactionOverride, Transaction } from '../../types';
import {
  buildOccurrences, cadenceLabel, classifyFlow, dailyCommitted, groupUpcoming, makeConverter, monthGrid, monthlyEquivalent,
  endSeriesAt, firstDueOnOrAfter, nextDueAfterPaying, splitSeriesAt, parseAmountInput, planSeries, seriesGroups, summarize, emptySeriesDraft, oldUnpaidBills, type Occurrence,
} from '../../utils/scheduleModel';

/* Schedule engine (docs/SCHEDULE_NEW_PLAN.md §2 and docs/NEW_PAGES_PLAN_INDEX.md §3.3). */

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day); };
const TODAY = d('2026-10-29'); // a Thursday

const accounts: Account[] = [
  { id: 'chk', name: 'Checking', type: 'Checking', balance: 1000, currency: 'EUR' },
  { id: 'sav', name: 'Savings', type: 'Savings', balance: 5000, currency: 'EUR' },
  { id: 'loan', name: 'Mortgage', type: 'Loan', balance: -100000, currency: 'EUR' },
];

const series = (over: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 'rt', accountId: 'chk', description: 'Rent', amount: 1200, type: 'expense', currency: 'EUR', frequency: 'monthly',
  startDate: '2026-01-01', nextDueDate: '2026-11-01', weekendAdjustment: 'on', ...over,
});

const build = (recurring: RecurringTransaction[], extra: { overrides?: RecurringTransactionOverride[]; transactions?: Transaction[]; bills?: BillPayment[]; to?: string } = {}) =>
  buildOccurrences({
    recurring, overrides: extra.overrides ?? [], bills: extra.bills ?? [], accounts, transactions: extra.transactions ?? [],
    from: TODAY, to: d(extra.to ?? '2027-03-31'), today: TODAY, includeSynthetic: false,
  });

const eur = makeConverter('EUR', { EUR: 1, USD: 0.5 });
const tx = (over: Partial<Transaction>): Transaction => ({ id: 't', accountId: 'chk', date: '2026-10-01', description: 'Rent', amount: -1200, category: '', type: 'expense', currency: 'EUR', ...over });

test('monthly on the 31st lands on the last day of shorter months, then the 31st again', () => {
  const occ = build([series({ startDate: '2026-10-31', nextDueDate: '2026-10-31', dueDateOfMonth: 31 })]);
  assert.deepEqual(occ.map(o => o.date).slice(0, 5), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
});

test('a biweekly series advances every 14 days', () => {
  const occ = build([series({ frequency: 'biweekly', nextDueDate: '2026-10-30', startDate: '2026-10-30' })], { to: '2026-12-01' });
  assert.deepEqual(occ.map(o => o.date), ['2026-10-30', '2026-11-13', '2026-11-27']);
});

test('the weekend rule moves a Sunday payment to Monday', () => {
  const occ = build([series({ nextDueDate: '2026-11-01', weekendAdjustment: 'after' })], { to: '2026-11-05' });
  assert.equal(occ[0].originalDate, '2026-11-01');
  assert.equal(occ[0].date, '2026-11-02');
});

test('an override moves one payment and changes its amount; a skipped one stays listed but not counted', () => {
  const overrides: RecurringTransactionOverride[] = [
    { recurringTransactionId: 'rt', originalDate: '2026-11-01', date: '2026-11-03', amount: -900 },
    { recurringTransactionId: 'rt', originalDate: '2026-12-01', isSkipped: true },
  ];
  const occ = build([series({})], { overrides, to: '2026-12-15' });
  assert.equal(occ[0].date, '2026-11-03');
  assert.equal(occ[0].amount, 900);
  assert.equal(occ[0].isOverride, true);
  assert.equal(occ[1].status, 'skipped');
  const s = summarize(occ, TODAY, eur, 60);
  assert.equal(s.out, 900);
  assert.equal(s.count, 1);
});

test('one transaction pays at most one occurrence (E-06)', () => {
  // Weekly on 20 and 27 Oct; one payment on 23 Oct is within 4.5 days of both but pays only the nearest (the 20th).
  const rt = series({ frequency: 'weekly', nextDueDate: '2026-10-20', startDate: '2026-10-20', amount: 20 });
  const occ = build([rt], { transactions: [tx({ recurringSourceId: 'rt', date: '2026-10-23', amount: -20 })], to: '2026-10-30' });
  const paid = occ.filter(o => o.status === 'paid');
  const overdue = occ.filter(o => o.status === 'overdue');
  assert.equal(paid.length, 0, 'paid occurrences before today are history and left out');
  assert.equal(overdue.length, 1, 'the other occurrence is still overdue');
});

test('an unpaid payment from 20 days ago is still overdue (E-07)', () => {
  const occ = build([series({ nextDueDate: '2026-10-09', dueDateOfMonth: 9 })], { to: '2026-11-15' });
  assert.equal(occ[0].date, '2026-10-09');
  assert.equal(occ[0].status, 'overdue');
  assert.equal(groupUpcoming(occ, TODAY, eur)[0].id, 'overdue');
});

test('paying a later payment early leaves the earlier one open (E-09)', () => {
  const rt = series({ nextDueDate: '2026-10-15', dueDateOfMonth: 15 });
  const paidEarly = tx({ id: 'early', recurringSourceId: 'rt', recurringOccurrenceDate: '2026-11-15', date: '2026-10-28' });
  const occ = build([rt], { transactions: [paidEarly], to: '2026-12-31' });
  assert.equal(occ.find(o => o.originalDate === '2026-10-15')?.status, 'overdue');
  assert.equal(occ.find(o => o.originalDate === '2026-11-15')?.status, 'paid');
  // nextDueDate stays on the oldest open one…
  assert.equal(nextDueAfterPaying(rt, '2026-11-15', ['2026-10-15', '2026-12-15']), '2026-10-15');
  // …and paying that one then steps over November, already paid.
  assert.equal(nextDueAfterPaying(rt, '2026-10-15', ['2026-12-15'], ['2026-11-15']), '2026-12-15');
});

test('money in, out and moves (S-01)', () => {
  const byId = new Map(accounts.map(a => [a.id, a]));
  assert.equal(classifyFlow('transfer', 'chk', 'loan', byId), 'out');
  assert.equal(classifyFlow('transfer', 'chk', 'sav', byId), 'move');
  assert.equal(classifyFlow('transfer', 'chk', undefined, byId), 'out');
  assert.equal(classifyFlow('transfer', undefined, 'chk', byId), 'in');
  assert.equal(classifyFlow('income', 'chk', undefined, byId), 'in');
  const occ = build([
    series({ id: 'mortgage', type: 'transfer', toAccountId: 'loan', amount: 800, nextDueDate: '2026-11-05' }),
    series({ id: 'save', type: 'transfer', toAccountId: 'sav', amount: 300, nextDueDate: '2026-11-06' }),
    series({ id: 'salary', type: 'income', amount: 3000, nextDueDate: '2026-11-25' }),
  ], { to: '2026-11-27' });
  const s = summarize(occ, TODAY, eur);
  assert.equal(s.out, 800);
  assert.equal(s.moves, 300);
  assert.equal(s.in, 3000);
  assert.equal(s.net, 2200);
  assert.equal(s.largestOut?.sourceId, 'mortgage');
});

test('a USD series is converted into the display currency (S-02)', () => {
  const occ = build([series({ currency: 'USD', amount: 100, nextDueDate: '2026-11-02' })], { to: '2026-11-10' });
  assert.equal(summarize(occ, TODAY, eur).out, 50);
});

test('overdue items count on today in the committed-cash chart', () => {
  const occ = build([series({ nextDueDate: '2026-10-20', dueDateOfMonth: 20, amount: 100 })], { to: '2026-11-30' });
  const days = dailyCommitted(occ, TODAY, eur, 30);
  assert.equal(days.length, 30);
  assert.equal(days[0].out, 100);
  assert.equal(days[22].out, 100); // 20 Nov
  assert.equal(days[29].cumulative, -200);
});

test('monthly equivalents', () => {
  assert.equal(monthlyEquivalent({ amount: 120, frequency: 'yearly' }), 10);
  assert.equal(monthlyEquivalent({ amount: 10, frequency: 'weekly' }), 43.33);
  assert.equal(monthlyEquivalent({ amount: 100, frequency: 'biweekly' }), 216.67);
  assert.equal(monthlyEquivalent({ amount: 100, frequency: 'monthly', frequencyInterval: 2 }), 50);
  assert.equal(monthlyEquivalent({ amount: 1, frequency: 'daily' }), 30.42);
});

test('groups: overdue, today, next 7 days, then months', () => {
  const occ = build([
    series({ id: 'a', nextDueDate: '2026-10-25', dueDateOfMonth: 25 }),
    series({ id: 'b', nextDueDate: '2026-10-29', dueDateOfMonth: 29 }),
    series({ id: 'c', nextDueDate: '2026-11-03', dueDateOfMonth: 3 }),
  ], { to: '2026-12-31' });
  const ids = groupUpcoming(occ, TODAY, eur).map(g => g.id);
  assert.deepEqual(ids.slice(0, 3), ['overdue', 'today', 'next7']);
  assert.ok(ids.includes('2026-11') && ids.includes('2026-12'));
});

test('unpaid bills are listed however late; paid ones only inside the range', () => {
  const bills: BillPayment[] = [
    { id: 'b1', description: 'Tax', amount: -500, type: 'payment', currency: 'EUR', dueDate: '2026-08-01', status: 'unpaid' },
    { id: 'b2', description: 'Refund', amount: 50, type: 'deposit', currency: 'EUR', dueDate: '2026-11-10', status: 'unpaid' },
    { id: 'b3', description: 'Old', amount: -10, type: 'payment', currency: 'EUR', dueDate: '2026-09-01', status: 'paid' },
  ];
  const occ = build([], { bills });
  assert.deepEqual(occ.map(o => o.sourceId), ['b1', 'b2']);
  assert.equal(occ[0].status, 'overdue');
  assert.equal(occ[1].flow, 'in');
  assert.deepEqual(oldUnpaidBills(bills, TODAY).map(b => b.id), ['b1']);
});

test('amounts typed the European or the English way', () => {
  assert.equal(parseAmountInput('1.250,50'), 1250.5);
  assert.equal(parseAmountInput('1,250.50'), 1250.5);
  assert.equal(parseAmountInput('12,5'), 12.5);
  assert.ok(Number.isNaN(parseAmountInput('')));
});

test('a series draft needs an amount, a name, an account and two accounts for a transfer', () => {
  const draft = emptySeriesDraft('chk', 'EUR', TODAY);
  assert.equal(planSeries(draft).ok, false);
  assert.equal(planSeries({ ...draft, amount: '10' }).ok, false);
  const ok = planSeries({ ...draft, amount: '10', description: 'Gym', dueDateOfMonth: '5' });
  assert.ok(ok.ok && ok.kind === 'recurring' && ok.series.dueDateOfMonth === 5 && ok.series.amount === 10);
  assert.equal(planSeries({ ...draft, amount: '10', description: 'Save', type: 'transfer', toAccountId: 'chk' }).ok, false);
  const bill = planSeries({ ...draft, kind: 'bill', amount: '40', description: 'Fine' });
  assert.ok(bill.ok && bill.kind === 'bill' && bill.bill.amount === -40 && bill.bill.type === 'payment');
});

test('series groups: by kind, ended ones apart, monthly totals', () => {
  const groups = seriesGroups([
    series({ id: 'rent' }),
    series({ id: 'salary', type: 'income', amount: 3000 }),
    series({ id: 'gym', amount: 30, endDate: '2026-06-30' }),
  ], [], accounts, TODAY, eur);
  assert.deepEqual(groups.map(g => g.id), ['income', 'expense', 'ended']);
  assert.equal(groups.find(g => g.id === 'expense')?.monthlyOut, 1200);
  assert.equal(groups.find(g => g.id === 'income')?.monthlyIn, 3000);
});

test('the month grid starts on Monday and has six weeks', () => {
  const occ: Occurrence[] = build([series({ nextDueDate: '2026-11-01' })], { to: '2026-11-30' });
  const grid = monthGrid(2026, 10, occ, eur);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].date, '2026-10-26'); // Monday before 1 Nov 2026 (a Sunday)
  assert.equal(grid.find(g => g.date === '2026-11-01')?.out, 1200);
});

test('cadence labels', () => {
  assert.equal(cadenceLabel(series({ dueDateOfMonth: 5 })), 'Monthly on the 5th');
  assert.equal(cadenceLabel(series({ frequency: 'biweekly', nextDueDate: '2026-10-30' })), 'Every 2 weeks on Friday');
  assert.equal(cadenceLabel(series({ frequency: 'daily', frequencyInterval: 3 })), 'Every 3 days');
});

test('a series starting on the 29th that pays on the 5th first pays on the next 5th', () => {
  assert.equal(firstDueOnOrAfter('2026-10-29', 5, 'monthly'), '2026-11-05');
  assert.equal(firstDueOnOrAfter('2026-10-03', 5, 'monthly'), '2026-10-05');
  assert.equal(firstDueOnOrAfter('2027-01-31', 30, 'monthly'), '2027-02-28');
  assert.equal(firstDueOnOrAfter('2026-10-29', 5, 'yearly'), '2027-10-05');
  assert.equal(firstDueOnOrAfter('2026-10-29', 5, 'weekly'), '2026-10-29');
  const plan = planSeries({ ...emptySeriesDraft('chk', 'EUR', TODAY), amount: '10', description: 'Gym', dueDateOfMonth: '5' });
  assert.ok(plan.ok && plan.kind === 'recurring' && plan.series.nextDueDate === '2026-11-05' && plan.series.startDate === '2026-10-29');
});

test('ending a series at a payment keeps the one before as its last', () => {
  const rt = series({});
  const ended = endSeriesAt(rt, '2027-01-01');
  assert.equal(ended.endDate, '2026-12-31');
  assert.deepEqual(build([ended]).map(o => o.date), ['2026-11-01', '2026-12-01']);
});

test('"this and future" ends the old series the day before and starts the new one there', () => {
  const rt = series({});
  const { id: _id, ...changes } = { ...rt, amount: 1300 };
  const { ended, started } = splitSeriesAt(rt, '2027-01-01', changes);
  assert.equal(ended.endDate, '2026-12-31');
  assert.equal(started.startDate, '2027-01-01');
  assert.equal(started.nextDueDate, '2027-01-01');
  const occ = build([ended, { ...started, id: 'rt2' }]);
  assert.deepEqual(occ.map(o => `${o.date}:${o.amount}`).slice(0, 4), ['2026-11-01:1200', '2026-12-01:1200', '2027-01-01:1300', '2027-02-01:1300']);
});
