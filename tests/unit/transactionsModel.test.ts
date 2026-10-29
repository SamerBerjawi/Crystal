import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Transaction } from '../../types';
import {
  buildRows, draftFromRow, emptyDraft, filterRows, groupByDay, kpiTotals, merchantOptions, metricSeries, needsReview, periodRange, periodTotals, planSave, rowsToCsv, topCategories,
} from '../../utils/transactionsModel';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', accountId: 'a1', date: '2026-10-10', description: '', amount: -10, category: 'Food', type: 'expense', currency: 'EUR', ...over,
});

const accounts = [
  { id: 'a1', name: 'Checking', currency: 'EUR' },
  { id: 'a2', name: 'Savings', currency: 'EUR' },
  { id: 'a3', name: 'US card', currency: 'USD' },
] as Account[];

const data: Transaction[] = [
  tx({ id: 'e1', merchant: 'Lidl', description: 'Groceries', amount: -42.5, date: '2026-10-12' }),
  tx({ id: 'i1', type: 'income', amount: 3000, category: 'Salary', date: '2026-10-01', description: 'October salary' }),
  tx({ id: 'x1', transferId: 'xfer-1', amount: -200, type: 'expense', category: 'Transfer', merchant: 'Internal Transfer', description: 'Transfer to Savings', date: '2026-10-05' }),
  tx({ id: 'x2', transferId: 'xfer-1', accountId: 'a2', amount: 200, type: 'income', category: 'Transfer', merchant: 'Internal Transfer', description: 'Transfer from Checking', date: '2026-10-05' }),
  tx({ id: 'p1', isSplitParent: true, amount: -60, category: 'Shopping', date: '2026-10-08' }),
  tx({ id: 'c1', parentTransactionId: 'p1', amount: -30, category: 'Food', date: '2026-10-08' }),
  tx({ id: 'u1', amount: -5, category: '', description: 'Unknown card payment', date: '2026-10-12' }),
  tx({ id: 'b1', isBalanceAdjustment: true, amount: 15, type: 'income', category: 'Adjustment', date: '2026-10-03' }),
];

test('rows merge transfer legs, hide split parts and sort newest first', () => {
  const rows = buildRows(data);
  assert.deepEqual(rows.map(r => r.id), ['e1', 'u1', 'p1', 'xfer:xfer-1', 'b1', 'i1']);
  const transfer = rows.find(r => r.kind === 'transfer')!;
  assert.equal(transfer.accountId, 'a1');
  assert.equal(transfer.toAccountId, 'a2');
  assert.equal(transfer.amount, 200);
  assert.deepEqual(transfer.txIds.sort(), ['x1', 'x2']);
  assert.equal(transfer.title, 'Transfer to Savings');
  const lidl = rows.find(r => r.id === 'e1')!;
  assert.equal(lidl.title, 'Lidl');
  assert.equal(lidl.detail, 'Groceries');
  assert.equal(rows.find(r => r.id === 'p1')!.split, true);
  assert.equal(buildRows(data, { showBalanceAdjustments: false }).some(r => r.id === 'b1'), false);
});

test('review, filters and day groups', () => {
  const rows = buildRows(data);
  assert.deepEqual(rows.filter(needsReview).map(r => r.id), ['u1']);
  assert.deepEqual(filterRows(rows, { query: 'lidl' }).map(r => r.id), ['e1']);
  assert.deepEqual(filterRows(rows, { query: '42.50' }).map(r => r.id), ['e1']);
  assert.deepEqual(filterRows(rows, { kinds: ['transfer'] }).map(r => r.id), ['xfer:xfer-1']);
  assert.deepEqual(filterRows(rows, { accountIds: ['a2'] }).map(r => r.id), ['xfer:xfer-1'], 'a transfer matches either account');
  assert.deepEqual(filterRows(rows, { from: '2026-10-06', to: '2026-10-12', kinds: ['expense'] }).map(r => r.id), ['e1', 'u1', 'p1']);
  assert.deepEqual(groupByDay(rows).map(g => [g.date, g.rows.length]), [['2026-10-12', 2], ['2026-10-08', 1], ['2026-10-05', 1], ['2026-10-03', 1], ['2026-10-01', 1]]);
});

test('totals skip transfers and adjustments, and convert currencies', () => {
  const rows = buildRows([...data, tx({ id: 'usd', accountId: 'a3', currency: 'USD', amount: -10, date: '2026-10-11' })]);
  const totals = periodTotals(rows, (amount, currency) => (currency === 'USD' ? amount * 0.5 : amount));
  assert.deepEqual(totals, { spent: 112.5, income: 3000 });
});

test('period ranges', () => {
  const today = new Date(2026, 9, 25);
  assert.deepEqual(periodRange('MTD', today), { from: '2026-10-01', to: '2026-10-25' });
  assert.deepEqual(periodRange('LM', today), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(periodRange('YTD', today), { from: '2026-01-01', to: '2026-10-25' });
  assert.deepEqual(periodRange('90D', today), { from: '2026-07-28', to: '2026-10-25' });
  assert.deepEqual(periodRange('1Y', today), { from: '2025-10-26', to: '2026-10-25' });
  assert.deepEqual(periodRange('ALL', today), {});
});

test('planSave: new expense, income and transfer', () => {
  let n = 0;
  const ctx = { accounts, transactions: data, newId: () => `n${++n}` };
  const expense = planSave({ ...emptyDraft('expense', 'a1', new Date(2026, 9, 25)), amount: '42.5', category: 'Food', merchant: ' Lidl ' }, ctx);
  assert.ok(expense.ok);
  assert.deepEqual(JSON.parse(JSON.stringify(expense.save[0])), { date: '2026-10-25', tagIds: [], id: 'n1', accountId: 'a1', description: '', merchant: 'Lidl', amount: -42.5, category: 'Food', type: 'expense', currency: 'EUR' });

  const transfer = planSave({ ...emptyDraft('transfer', 'a1', new Date(2026, 9, 25)), amount: '50', toAccountId: 'a3' }, ctx);
  assert.ok(transfer.ok);
  assert.equal(transfer.save.length, 2);
  assert.equal(transfer.save[0].amount, -50);
  assert.equal(transfer.save[1].amount, 50);
  assert.equal(transfer.save[1].currency, 'USD');
  assert.equal(transfer.save[0].transferId, transfer.save[1].transferId);

  assert.deepEqual(planSave({ ...emptyDraft('expense', 'a1', new Date()), amount: '' }, ctx), { ok: false, error: 'Enter an amount' });
  assert.deepEqual(planSave({ ...emptyDraft('expense', 'a1', new Date()), amount: '5' }, ctx), { ok: false, error: 'Choose a category' });
  assert.deepEqual(planSave({ ...emptyDraft('transfer', 'a1', new Date()), amount: '5', toAccountId: 'a1' }, ctx), { ok: false, error: 'Choose two different accounts' });
});

test('planSave: editing keeps ids and hidden fields, and type changes replace records', () => {
  let n = 0;
  const withLocation = [...data, tx({ id: 'loc', city: 'Ghent', importId: 'imp-1', amount: -9, category: 'Food' })];
  const rows = buildRows(withLocation);
  const ctx = { accounts, transactions: withLocation, newId: () => `n${++n}` };

  const edited = planSave({ ...draftFromRow(rows.find(r => r.id === 'loc')!, withLocation), amount: '12' }, { ...ctx, editing: rows.find(r => r.id === 'loc') });
  assert.ok(edited.ok);
  assert.equal(edited.save[0].id, 'loc');
  assert.equal(edited.save[0].city, 'Ghent');
  assert.equal(edited.save[0].importId, 'imp-1');
  assert.deepEqual(edited.remove, []);

  const transferRow = rows.find(r => r.kind === 'transfer')!;
  const editTransfer = planSave({ ...draftFromRow(transferRow), amount: '250' }, { ...ctx, editing: transferRow });
  assert.ok(editTransfer.ok);
  assert.deepEqual(editTransfer.save.map(t => [t.id, t.amount, t.transferId]), [['x1', -250, 'xfer-1'], ['x2', 250, 'xfer-1']]);

  const toExpense = planSave({ ...draftFromRow(transferRow), kind: 'expense', category: 'Rent' }, { ...ctx, editing: transferRow });
  assert.ok(toExpense.ok);
  assert.deepEqual(toExpense.remove.sort(), ['x1', 'x2']);
  assert.equal(toExpense.save[0].transferId, undefined);
});

test('CSV and top categories', () => {
  const rows = buildRows(data).slice(0, 1);
  const csv = rowsToCsv(rows, id => accounts.find(a => a.id === id)?.name ?? '', id => id);
  assert.equal(csv.split('\n')[1], '"2026-10-12","expense","Lidl","Groceries","Food","-42.50","EUR","Checking","","",""');
  assert.deepEqual(topCategories([...data, tx({ id: 'f2', category: 'Food' })], 'expense', 2), ['Food', 'Shopping']);
});

/* ------------------------------------------------------------------ round 2 */
import {
  canCombineRows, combineDefaults, defaultSplitParts, emptyLocation, firstDueDate, loanSplit, locationFields, planBulkEdit, planCombine, planRecurring,
  planSplit, planUncombine, planUnsplit, recurringDraftFromRow, roundUpAmount, roundUpPairOf, sortRows, splitRemaining,
} from '../../utils/transactionsModel';

const loanAcc = { id: 'loan', name: 'Car loan', currency: 'EUR', type: 'Loan', balance: -12000, interestRate: 6 } as unknown as Account;
const spareAcc = { id: 'spare', name: 'Spare', currency: 'EUR', type: 'Investment', subType: 'Spare Change', linkedAccountId: 'a1' } as unknown as Account;
const accts2 = [...accounts, loanAcc, spareAcc];

test('round-up and loan split arithmetic', () => {
  assert.equal(roundUpAmount(42.5), 0.5);
  assert.equal(roundUpAmount(42.5, 'skip', 3), 1.5);
  assert.equal(roundUpAmount(10, 'skip'), 0);
  assert.equal(roundUpAmount(10, 'unit'), 1);
  assert.equal(roundUpAmount(0), 0);
  assert.deepEqual(loanSplit(500, { balance: -12000, interestRate: 6 }), { interest: 60, principal: 440 });
  assert.deepEqual(loanSplit(30, { balance: -12000, interestRate: 6 }), { interest: 30, principal: 0 });
  assert.equal(loanSplit(500, { balance: -12000 }), null);
});

test('planSave: round-up pair is created, updated and removed', () => {
  let n = 0;
  const ctx = { accounts: accts2, transactions: data, newId: () => `n${++n}` };
  const base = { ...emptyDraft('expense', 'a1', new Date(2026, 9, 25)), amount: '42.5', category: 'Food', description: 'Lidl', roundUp: true };
  const created = planSave(base, ctx);
  assert.ok(created.ok);
  assert.equal(created.save.length, 3);
  assert.deepEqual(created.save.slice(1).map(t => [t.accountId, t.amount, t.transferId]), [['a1', -0.5, 'spare-n1'], ['spare', 0.5, 'spare-n1']]);

  const stored = [...data, ...created.save as Transaction[]];
  const row = buildRows(stored).find(r => r.id === 'n1')!;
  assert.ok(roundUpPairOf('n1', stored));
  const draft = draftFromRow(row, stored);
  assert.equal(draft.roundUp, true);
  const kept = planSave({ ...draft, amount: '43.2' }, { ...ctx, transactions: stored, editing: row });
  assert.ok(kept.ok);
  assert.equal(kept.save.length, 3);
  assert.equal(kept.save[1].amount, -0.8);
  const off = planSave({ ...draft, roundUp: false }, { ...ctx, transactions: stored, editing: row });
  assert.ok(off.ok);
  assert.equal(off.save.length, 1);
  assert.equal(off.remove.length, 2);
  const none = planSave({ ...base, accountId: 'a2' }, ctx);
  assert.ok(none.ok);
  assert.equal(none.save.length, 1, 'no spare account linked to a2');
});

test('planSave: loan payments carry principal and interest, and location is kept or cleared', () => {
  let n = 0;
  const ctx = { accounts: accts2, transactions: data, newId: () => `n${++n}` };
  const pay = { ...emptyDraft('transfer', 'a1', new Date(2026, 9, 25)), amount: '500', toAccountId: 'loan', principal: '440', interest: '60' };
  const ok = planSave(pay, ctx);
  assert.ok(ok.ok);
  assert.deepEqual([ok.save[1].principalAmount, ok.save[1].interestAmount, ok.save[0].principalAmount], [440, 60, undefined]);
  assert.deepEqual(planSave({ ...pay, interest: '10' }, ctx), { ok: false, error: 'Principal and interest must add up to the amount' });

  const place = { ...emptyLocation(), city: 'Ghent', country: 'Belgium', latitude: 51.05, longitude: 3.72 };
  assert.deepEqual([locationFields(place).city, locationFields(place).latitude], ['Ghent', 51.05]);
  assert.equal(locationFields(emptyLocation()).city, undefined);
  const withPlace = planSave({ ...emptyDraft('expense', 'a1', new Date()), amount: '5', category: 'Food', location: place }, ctx);
  assert.ok(withPlace.ok);
  assert.equal(withPlace.save[0].city, 'Ghent');
  const stored = [...data, tx({ id: 'loc', city: 'Ghent', country: 'Belgium', address: 'Korenmarkt 1' })];
  const row = buildRows(stored).find(r => r.id === 'loc')!;
  assert.equal(row.located, true);
  const draft = draftFromRow(row, stored);
  assert.equal(draft.location.address, 'Korenmarkt 1');
  const cleared = planSave({ ...draft, location: emptyLocation() }, { ...ctx, transactions: stored, editing: row });
  assert.ok(cleared.ok);
  assert.equal(cleared.save[0].city, undefined);
  assert.equal(cleared.save[0].address, undefined);
});

test('split, re-split and unsplit', () => {
  let n = 0;
  const t = data.find(x => x.id === 'e1')!;
  const parts = defaultSplitParts(t);
  assert.deepEqual(parts.map(p => p.amount), ['21.25', '21.25']);
  assert.equal(splitRemaining(t, parts), 0);
  parts[1] = { ...parts[1], amount: '30', category: 'Home' };
  assert.equal(splitRemaining(t, parts), -8.75);
  assert.deepEqual(planSplit(t, parts, [], () => `s${++n}`), { ok: false, error: 'The parts must add up to the original amount' });
  parts[0].amount = '12.50';
  const plan = planSplit(t, parts, [], () => `s${++n}`);
  assert.ok(plan.ok);
  assert.equal(plan.save[0].isSplitParent, true);
  assert.deepEqual(plan.save.slice(1).map(c => [c.amount, c.category, c.parentTransactionId]), [[-12.5, 'Food', 'e1'], [-30, 'Home', 'e1']]);

  const stored = [...data.filter(x => x.id !== 'e1'), ...(plan.save as Transaction[])];
  assert.deepEqual(buildRows(stored).filter(r => r.title === 'Lidl').map(r => [r.split, r.amount]), [[true, -42.5]], 'one row: the parent');
  const children = stored.filter(x => x.parentTransactionId === 'e1');
  const redo = planSplit(stored.find(x => x.id === 'e1')!, [{ amount: '40', category: 'Food', description: 'a' }, { amount: '2.5', category: 'Food', description: 'b' }], children, () => `r${++n}`);
  assert.ok(redo.ok);
  assert.equal(redo.remove.length, 2);
  const un = planUnsplit(stored.find(x => x.id === 'e1')!, children);
  assert.ok(un.ok);
  assert.equal(un.save[0].isSplitParent, false);
  assert.equal(un.remove.length, 2);
  assert.deepEqual(planUnsplit(data[0], []), { ok: false, error: 'This transaction is not split' });
});

test('combine and uncombine', () => {
  const a = tx({ id: 'ca', amount: -10, date: '2026-10-01', description: 'Coffee' });
  const b = tx({ id: 'cb', amount: -5, date: '2026-10-03', description: 'Cake' });
  const rows = buildRows([a, b]);
  assert.equal(canCombineRows(rows), true);
  assert.equal(canCombineRows(buildRows(data).filter(r => r.kind === 'transfer' || r.id === 'e1')), false);
  const fields = combineDefaults([a, b]);
  assert.deepEqual([fields.date, fields.category, fields.accountId], ['2026-10-03', 'Food', 'a1']);
  const plan = planCombine([a, b], fields, accounts, () => 'X');
  assert.ok(plan.ok);
  assert.deepEqual([plan.save[0].amount, plan.save[0].type, plan.save[0].id, plan.save[0].isCombinedParent], [-15, 'expense', 'combined-parent-X', true]);
  assert.deepEqual(plan.save.slice(1).map(t => t.parentTransactionId), ['combined-parent-X', 'combined-parent-X']);
  assert.deepEqual(planCombine([a, b], { ...fields, description: ' ' }, accounts, () => 'X'), { ok: false, error: 'Enter a description' });
  const stored = plan.save as Transaction[];
  const only = buildRows(stored);
  assert.deepEqual(only.map(r => [r.id, r.combined]), [['combined-parent-X', true]]);
  const un = planUncombine(stored[0], stored.slice(1));
  assert.ok(un.ok);
  assert.deepEqual([un.save.map(t => t.parentTransactionId), un.remove], [[undefined, undefined], ['combined-parent-X']]);
});

test('bulk edit: fields, tags, category switches and transfers', () => {
  const rows = buildRows(data);
  const pick = (...ids: string[]) => rows.filter(r => ids.includes(r.id));
  const date = planBulkEdit(pick('e1', 'xfer:xfer-1'), data, { date: '2026-09-30', accountId: 'a2' });
  assert.ok(date.ok);
  const byId = new Map(date.save.map(t => [t.id, t]));
  assert.equal(byId.get('e1')!.date, '2026-09-30');
  assert.equal(byId.get('e1')!.accountId, 'a2');
  assert.equal(byId.get('x1')!.accountId, 'a1', 'transfers keep their accounts');
  assert.equal(byId.get('x2')!.date, '2026-09-30', 'both transfer legs follow the date');

  const income = planBulkEdit(pick('e1', 'xfer:xfer-1'), data, { category: { name: 'Salary', classification: 'income' } });
  assert.ok(income.ok);
  const m = new Map(income.save.map(t => [t.id, t]));
  assert.deepEqual([m.get('e1')!.type, m.get('e1')!.amount], ['income', 42.5]);
  assert.deepEqual([m.get('x2')!.transferId, m.get('x2')!.type, m.get('x2')!.amount], [undefined, 'income', 200]);
  assert.deepEqual(income.remove, ['x1'], 'the other transfer leg is removed');

  const tagged = [tx({ id: 't1', tagIds: ['a'] })];
  const add = planBulkEdit(buildRows(tagged), tagged, { tagIds: ['b'], tagMode: 'add' });
  assert.ok(add.ok);
  assert.deepEqual(add.save[0].tagIds, ['a', 'b']);
  const replace = planBulkEdit(buildRows(tagged), tagged, { tagIds: ['b'] });
  assert.ok(replace.ok);
  assert.deepEqual(replace.save[0].tagIds, ['b']);
  const loc = planBulkEdit(buildRows([tx({ id: 'l', city: 'Ghent' })]), [tx({ id: 'l', city: 'Ghent' })], { location: null });
  assert.ok(loc.ok);
  assert.equal(loc.save[0].city, undefined);
  assert.deepEqual(planBulkEdit(rows.slice(0, 1), data, {}), { ok: false, error: 'Nothing to change' });
});

test('recurring plan', () => {
  const row = buildRows(data).find(r => r.id === 'e1')!;
  const draft = recurringDraftFromRow(row, new Date(2026, 9, 25));
  assert.deepEqual([draft.frequency, draft.startDate, draft.amount, draft.category], ['monthly', '2026-10-25', '42.5', 'Food']);
  const plan = planRecurring({ ...draft, dueDay: '5' }, accounts);
  assert.ok(plan.ok);
  assert.deepEqual([plan.data.nextDueDate, plan.data.dueDateOfMonth, plan.data.amount, plan.data.type, plan.data.currency], ['2026-11-05', 5, 42.5, 'expense', 'EUR']);
  assert.equal(firstDueDate('2026-10-25', 'monthly', '28'), '2026-10-28');
  assert.equal(firstDueDate('2026-10-25', 'weekly', '5'), '2026-10-25');
  const transfer = planRecurring({ ...draft, kind: 'transfer', toAccountId: 'a2' }, accounts);
  assert.ok(transfer.ok);
  assert.deepEqual([transfer.data.category, transfer.data.toAccountId], ['Transfer', 'a2']);
  assert.deepEqual(planRecurring({ ...draft, kind: 'transfer', toAccountId: 'a1' }, accounts), { ok: false, error: 'Choose two different accounts' });
  assert.deepEqual(planRecurring({ ...draft, endDate: '2026-01-01' }, accounts), { ok: false, error: 'The end date is before the start date' });
  assert.equal((planRecurring({ ...draft, frequency: 'daily', interval: '4' }, accounts) as { ok: true; data: { frequencyInterval: number } }).data.frequencyInterval, 1);
});

test('sort and the amount and location filters', () => {
  const rows = buildRows([...data, tx({ id: 'big', amount: -900, merchant: 'Apple', city: 'Brussels', date: '2026-09-01' })]);
  assert.deepEqual(sortRows(rows, 'amount-desc').slice(0, 2).map(r => r.id), ['i1', 'big']);
  assert.deepEqual(sortRows(rows, 'date-asc')[0].id, 'big');
  assert.deepEqual(sortRows(rows, 'merchant-asc').slice(0, 2).map(r => r.title), ['Adjustment', 'Apple']);
  assert.deepEqual(filterRows(rows, { minAmount: 500 }).map(r => r.id).sort(), ['big', 'i1']);
  assert.deepEqual(filterRows(rows, { maxAmount: 6 }).map(r => r.id), ['u1']);
  assert.deepEqual(filterRows(rows, { places: ['Brussels'] }).map(r => r.id), ['big']);
  assert.deepEqual(filterRows(rows, { query: 'brussels' }).map(r => r.id), ['big']);
});

/* --------------------------------------------------------------- overview */
import {
  balanceAccounts, bucketSeries, niceMax, pctChange, placeClusters, placeOptions, previousRange, spendByWeekday, sparkPath, topCategory, totalBalance, weekdayOf,
} from '../../utils/transactionsModel';

test('weekday totals skip transfers and adjustments, Monday first', () => {
  assert.equal(weekdayOf('2026-10-26'), 0, 'a Monday');
  assert.equal(weekdayOf('2026-10-25'), 6, 'a Sunday');
  const rows = buildRows([
    tx({ id: 'a', date: '2026-10-26', amount: -10 }), tx({ id: 'b', date: '2026-10-26', amount: -5.5 }), tx({ id: 'c', date: '2026-10-25', amount: -20, currency: 'USD' }),
    tx({ id: 'd', date: '2026-10-26', amount: 500, type: 'income' }), tx({ id: 'e', date: '2026-10-27', amount: -99, isBalanceAdjustment: true }),
    tx({ id: 'x1', transferId: 't', date: '2026-10-28', amount: -50 }), tx({ id: 'x2', transferId: 't', date: '2026-10-28', amount: 50, type: 'income', accountId: 'a2' }),
  ]);
  const days = spendByWeekday(rows, (a, c) => (c === 'USD' ? a * 0.5 : a));
  assert.deepEqual(days[0], { total: 15.5, count: 2 });
  assert.deepEqual(days[6], { total: 10, count: 1 });
  assert.deepEqual([days[1].count, days[2].count], [0, 0]);
  assert.deepEqual(filterRows(rows, { weekdays: [6] }).map(r => r.id), ['c']);
});

test('nice maximums', () => {
  assert.deepEqual([0, 0.4, 1, 1.3, 2.4, 4.9, 7, 1274.23].map(niceMax), [1, 0.5, 1, 2, 2.5, 5, 10, 2000]);
});

test('map clusters group by city, else by coordinate cell, and the Locations options count them', () => {
  const rows = buildRows([
    tx({ id: '1', city: 'Ghent', latitude: 51.05, longitude: 3.72, amount: -10 }), tx({ id: '2', city: 'Ghent', latitude: 51.07, longitude: 3.74, amount: -20 }),
    tx({ id: '3', latitude: 50.85, longitude: 4.35, amount: -5 }), tx({ id: '4', city: 'Paris', amount: -1 }), tx({ id: '5', latitude: 0, longitude: 0 }),
  ]);
  const clusters = placeClusters(rows, a => a);
  assert.deepEqual(clusters.map(c => [c.key, c.count, c.spent]), [['Ghent', 2, 30], ['geo:50.9,4.3', 1, 5]]);
  assert.equal(Math.round(clusters[0].lat * 100) / 100, 51.06);
  assert.equal(clusters[1].label, 'Near 50.85, 4.35');
  assert.deepEqual(placeOptions(rows).map(o => [o.key, o.count]), [['Ghent', 2], ['geo:50.9,4.3', 1], ['Paris', 1]]);
  assert.deepEqual(filterRows(rows, { places: ['Paris'] }).map(r => r.id), ['4']);
});

test('previous range, percentage change, series and sparkline path', () => {
  assert.deepEqual(previousRange({ from: '2026-10-01', to: '2026-10-25' }), { from: '2026-09-06', to: '2026-09-30' });
  assert.deepEqual(previousRange({ from: '2026-09-01', to: '2026-09-30' }), { from: '2026-08-02', to: '2026-08-31' });
  assert.equal(previousRange({}), undefined);
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(97.4, 100), -2.6);
  assert.equal(pctChange(5, 0), null);
  const rows = buildRows([tx({ id: 'a', date: '2026-10-01', amount: -10 }), tx({ id: 'b', date: '2026-10-10', amount: -30 }), tx({ id: 'c', date: '2026-10-10', amount: 100, type: 'income' })]);
  const spent = bucketSeries(rows, 'spent', { from: '2026-10-01', to: '2026-10-10' }, a => a, 5);
  assert.deepEqual(spent, [10, 0, 0, 0, 30]);
  assert.deepEqual(bucketSeries(rows, 'income', { from: '2026-10-01', to: '2026-10-10' }, a => a, 5), [0, 0, 0, 0, 100]);
  const path = sparkPath([1, 3, 2, 5], 100, 40);
  assert.ok(path.startsWith('M2.0,30.8') && path.split('C').length === 4);
  assert.equal(sparkPath([1], 100, 40), '');
});

test('top category and the balance card', () => {
  const rows = buildRows([tx({ id: 'a', category: 'Food', amount: -60 }), tx({ id: 'b', category: 'Rent', amount: -30 }), tx({ id: 'c', category: '', amount: -90 }), tx({ id: 'i', type: 'income', amount: 500, category: 'Salary' })]);
  assert.deepEqual(topCategory(rows, a => a), { name: 'Food', total: 60, share: 67 });
  assert.equal(topCategory([], a => a), null);
  const accs = [
    { id: 'c', type: 'Checking', balance: 1000, currency: 'EUR' }, { id: 's', type: 'Savings', balance: 500, currency: 'USD' },
    { id: 'cc', type: 'Credit Card', balance: -200, currency: 'EUR' }, { id: 'inv', type: 'Investment', balance: 9999, currency: 'EUR' }, { id: 'old', type: 'Checking', balance: 5, currency: 'EUR', status: 'closed' },
  ] as unknown as Account[];
  const liquid = balanceAccounts(accs);
  assert.deepEqual(liquid.map(a => a.id), ['c', 's', 'cc']);
  const conv = (a: number, c: string) => (c === 'USD' ? a * 0.5 : a);
  assert.deepEqual(totalBalance(liquid, [], conv), { total: 1050, count: 3 });
  assert.deepEqual(totalBalance(liquid, ['s'], conv), { total: 250, count: 1 });
});

test('a round-up folds into its transaction; one without a transaction stays listed', () => {
  const list = [
    tx({ id: 'n1', date: '2026-10-20', amount: -42.5, description: 'Lidl' }),
    tx({ id: 's1', date: '2026-10-20', amount: -0.5, transferId: 'spare-n1', description: 'Spare change for Lidl' }),
    tx({ id: 's2', accountId: 'spare', date: '2026-10-20', amount: 0.5, type: 'income', transferId: 'spare-n1', description: 'Spare change from Lidl' }),
    tx({ id: 'o1', date: '2026-10-21', amount: -0.3, transferId: 'spare-gone', description: 'Spare change for Gone' }),
    tx({ id: 'o2', accountId: 'spare', date: '2026-10-21', amount: 0.3, type: 'income', transferId: 'spare-gone', description: 'Spare change from Gone' }),
  ];
  const rows = buildRows(list);
  assert.deepEqual(rows.find(r => r.id === 'n1')?.spare, { amount: 0.5, currency: 'EUR', txIds: ['s1', 's2'] });
  assert.equal(rows.some(r => r.id === 'xfer:spare-n1'), false);
  assert.equal(rows.filter(r => r.roundUp).length, 1);
  assert.equal(rows.length, 2);
});

test('description and merchant filters work on their own', () => {
  const rows = buildRows([
    tx({ id: 'a', merchant: 'Lidl', description: 'Weekly shop', amount: -20 }),
    tx({ id: 'b', merchant: 'Shell', description: 'Fuel for Lidl trip', amount: -50 }),
  ]);
  assert.deepEqual(filterRows(rows, { merchant: 'lidl' }).map(r => r.id), ['a']);
  assert.deepEqual(filterRows(rows, { description: 'lidl' }).map(r => r.id), ['b']);
  assert.equal(filterRows(rows, { description: 'weekly', merchant: 'lidl' }).length, 1);
});

test('merchant options count transactions, and the exact-merchant filter keeps only those', () => {
  const rows = buildRows([
    tx({ id: 'a', merchant: 'Lidl', amount: -20 }),
    tx({ id: 'b', merchant: 'lidl', amount: -5 }),
    tx({ id: 'c', merchant: 'Shell', amount: -50 }),
    tx({ id: 'd', merchant: 'Lidl Plus', amount: -1 }),
  ]);
  assert.deepEqual(merchantOptions(rows).map(m => [m.name, m.count]), [['Lidl', 2], ['Lidl Plus', 1], ['Shell', 1]]);
  assert.deepEqual(filterRows(rows, { merchants: ['Lidl'] }).map(r => r.id).sort(), ['a', 'b']);
});

test('KPI totals and the metric series agree', () => {
  const rows = buildRows([
    tx({ id: 'e1', date: '2026-10-20', amount: -40, category: 'Food' }),
    tx({ id: 'e2', date: '2026-10-21', amount: 10, category: 'Food' }), // a refund
    tx({ id: 'i1', date: '2026-10-21', amount: 100, type: 'income', category: 'Salary' }),
    tx({ id: 't1', date: '2026-10-21', amount: -5, transferId: 'x', category: 'Transfer' }),
    tx({ id: 't2', date: '2026-10-21', accountId: 'a2', amount: 5, type: 'income', transferId: 'x', category: 'Transfer' }),
  ]);
  const same = (a: number) => a;
  const totals = kpiTotals(rows, same);
  assert.deepEqual(totals, { count: 4, income: 100, expense: 30, net: 70 });
  const sum = (m: 'income' | 'expense' | 'net') => metricSeries(rows, m, '2026-10-21', 3, same).points.slice(-3).reduce((s, p) => s + p.parts.reduce((a, b) => a + b, 0), 0);
  assert.equal(sum('income'), 100);
  assert.equal(sum('expense'), 30);
  assert.equal(sum('net'), 70);
});
