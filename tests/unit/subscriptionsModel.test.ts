import { assignLabelLanes } from '../../utils/subscriptionsModel';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Membership, RecurringTransaction, Transaction } from '../../types';
import { buildOccurrences, liveSeries, seriesGroups } from '../../utils/scheduleModel';
import {
  cancelService, detectSubscriptions, expiringCards, normalizeString, pauseService, renewals, resumeService, savedByPausing, seriesFromDetected, serviceStatus, serviceTotals, services,
} from '../../utils/subscriptionsModel';

const today = new Date(2026, 9, 15);
const eur = (amount: number) => amount;
const series = (over: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 'a', accountId: 'x', description: 'Netflix', amount: 12, type: 'expense', currency: 'EUR', frequency: 'monthly', startDate: '2026-01-20', nextDueDate: '2026-10-20', weekendAdjustment: 'on', ...over,
});
const charge = (date: string, amount = 12, merchant = 'Netflix'): Transaction => ({ id: date, accountId: 'x', date, description: merchant, merchant, amount: -amount, category: 'Fun', type: 'expense', currency: 'EUR' });

test('names lose card numbers and gateway noise', () => {
  assert.equal(normalizeString('PAYPAL *Netflix.com #1234'), normalizeString('netflix'));
});

test('steady monthly charges are found, and tracked or ignored ones are not', () => {
  const charges = [charge('2026-07-20'), charge('2026-08-20'), charge('2026-09-20'), charge('2026-10-10', 300, 'One off')];
  const found = detectSubscriptions(charges, [], [], today);
  assert.equal(found.length, 1);
  assert.equal(found[0].frequency, 'monthly');
  assert.equal(found[0].confidence, 'high');
  assert.equal(detectSubscriptions(charges, [series({})], [], today).length, 0);
  assert.equal(detectSubscriptions(charges, [], [found[0].key], today).length, 0);
});

test('old charges and wildly different amounts are left out', () => {
  assert.equal(detectSubscriptions([charge('2025-01-20'), charge('2025-02-20'), charge('2025-03-20')], [], [], today).length, 0);
  assert.equal(detectSubscriptions([charge('2026-07-20', 10), charge('2026-08-20', 90), charge('2026-09-20', 400)], [], [], today).length, 0);
});

test('tracking a find sets the next date on or after today', () => {
  const [found] = detectSubscriptions([charge('2026-07-20'), charge('2026-08-20'), charge('2026-09-20')], [], [], today);
  const draft = seriesFromDetected(found, today);
  assert.equal(draft.nextDueDate, '2026-10-20');
  assert.equal(draft.category, 'Subscriptions');
});

test('status reads paused, cancelled or active', () => {
  assert.equal(serviceStatus(series({}), today), 'active');
  assert.equal(serviceStatus(pauseService(series({}), today), today), 'paused');
  assert.equal(serviceStatus(cancelService(series({}), today), today), 'cancelled');
});

test('a paused item leaves occurrences and comes back on its next date', () => {
  const paused = pauseService(series({ nextDueDate: '2026-02-20' }), today);
  assert.equal(liveSeries([paused]).length, 0);
  const built = buildOccurrences({ recurring: [paused], overrides: [], bills: [], accounts: [], transactions: [], from: today, to: new Date(2026, 11, 31), today });
  assert.equal(built.length, 0);
  const back = resumeService(paused, today);
  assert.equal(back.pausedAt, undefined);
  assert.equal('pausedAt' in back, true, 'saving merges, so the field must be cleared on purpose');
  assert.equal(back.nextDueDate, '2026-10-20');
});

test('paused items sit with ended ones on the schedule', () => {
  const groups = seriesGroups([pauseService(series({}), today), series({ id: 'b' })], [], [], today, eur);
  assert.deepEqual(groups.map(group => [group.id, group.rows.length]), [['expense', 1], ['ended', 1]]);
});

test('resuming a cancelled service clears its end date', () => {
  assert.equal(resumeService(cancelService(series({}), today), today).endDate, undefined);
});

test('totals, renewals and what pausing saves', () => {
  const active = [series({}), series({ id: 'b', amount: 120, frequency: 'yearly', nextDueDate: '2027-03-01' })];
  const totals = serviceTotals(active, today, eur);
  assert.equal(totals.monthly, 22);
  assert.equal(totals.yearly, 264);
  assert.equal(totals.count, 2);
  assert.equal(totals.dueSoon, 1);
  assert.equal(totals.renewing, 12);
  assert.deepEqual(renewals(active, today, eur).map(item => item.date), ['2026-10-20']);
  assert.equal(savedByPausing([series({})], eur), 12);
});

test('services are your own payments, soonest first', () => {
  const list = services([series({ id: 'late', nextDueDate: '2026-12-01' }), series({ id: 'soon', nextDueDate: '2026-10-16' }), series({ id: 'pay', type: 'income' }), series({ id: 'auto', isSynthetic: true })]);
  assert.deepEqual(list.map(item => item.id), ['soon', 'late']);
});

test('cards running out soon are flagged', () => {
  const card = (expiryDate: string) => ({ id: expiryDate, provider: 'x', memberId: '1', color: '', icon: '', expiryDate }) as Membership;
  assert.deepEqual(expiringCards([card('2026-10-30'), card('2026-12-30'), card('2026-10-01')], today).map(item => item.id), ['2026-10-30']);
});

test('timeline labels take the first free lane and never overlap', () => {
  assert.deepEqual(assignLabelLanes([0, 5, 20, 22, 24], 10, 2), [0, 1, 0, 1, null]);
  assert.deepEqual(assignLabelLanes([10, 40, 70], 10, 2), [0, 0, 0]);
  assert.deepEqual(assignLabelLanes([], 10, 2), []);
});
