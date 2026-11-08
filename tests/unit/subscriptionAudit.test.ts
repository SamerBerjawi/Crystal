import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RecurringTransaction, Transaction } from '../../types';
import { subscriptionAudit } from '../../utils/subscriptionAudit';

const today = new Date(2026, 10, 7);
const eur = (amount: number) => amount;
const series = (over: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 'a', accountId: 'x', description: 'Netflix', merchant: 'Netflix', amount: 12, type: 'expense', currency: 'EUR', frequency: 'monthly', startDate: '2025-01-05', nextDueDate: '2026-11-20', weekendAdjustment: 'on', ...over,
});
const charge = (id: string, date: string, amount: number, over: Partial<Transaction> = {}): Transaction => ({
  id, accountId: 'x', date, description: 'Netflix', merchant: 'Netflix', amount: -amount, category: 'Fun', type: 'expense', currency: 'EUR', ...over,
});

test('creep compares the first charge with the latest, not just with the amount on file', () => {
  const audit = subscriptionAudit([series({ amount: 15.99 })], [charge('1', '2025-03-05', 9.99), charge('2', '2026-01-05', 12.99), charge('3', '2026-10-05', 15.99)], today, eur);
  const creep = audit.findings.find(f => f.kind === 'creep');
  assert.ok(creep);
  assert.match(creep.title, /up 60%/);
  assert.equal(creep.key, 'audit:creep:a:3');
  assert.equal(subscriptionAudit([series({})], [charge('1', '2025-03-05', 12), charge('2', '2026-10-05', 12.2)], today, eur).findings.length, 0, 'a few cents is not creep');
});

test('charges at the same merchant from before the series started are not part of its history', () => {
  const older = charge('old', '2024-06-15', 19.99);
  const audit = subscriptionAudit([series({ startDate: '2025-01-05' })], [older, charge('1', '2025-03-05', 9.99, { recurringSourceId: 'a' }), charge('2', '2026-10-05', 15.99, { recurringSourceId: 'a' })], today, eur);
  const creep = audit.findings.find(f => f.kind === 'creep');
  assert.ok(creep, 'creep is measured from the first charge of this series, 9.99, not the 2024 one');
  assert.match(creep.title, /up 60%/);
});

test('stale needs a past charge, and waits longer than a missed cycle', () => {
  const quiet = subscriptionAudit([series({})], [charge('1', '2026-05-01', 12)], today, eur).findings.find(f => f.kind === 'stale');
  assert.ok(quiet);
  assert.equal(quiet.key, 'audit:stale:a:2026-05-01');
  assert.equal(subscriptionAudit([series({})], [charge('1', '2026-10-01', 12)], today, eur).findings.length, 0, 'recent charge');
  assert.equal(subscriptionAudit([series({})], [], today, eur).findings.length, 0, 'no charges at all is not flagged');
  assert.equal(subscriptionAudit([series({ startDate: '2026-10-01' })], [charge('1', '2026-05-01', 12)], today, eur).findings.length, 0, 'a new series is not stale');
  assert.equal(subscriptionAudit([series({ frequency: 'yearly' })], [charge('1', '2026-01-10', 100)], today, eur).findings.length, 0, 'a yearly one is fine ten months on');
});

test('trial ending within two weeks names the date and the saving', () => {
  const audit = subscriptionAudit([series({ trialEndsOn: '2026-11-12', amount: 10 })], [], today, eur);
  assert.equal(audit.findings[0].kind, 'trial');
  assert.equal(audit.findings[0].yearlySaving, 120);
  assert.equal(subscriptionAudit([series({ trialEndsOn: '2026-12-30' })], [], today, eur).findings.length, 0, 'too far away');
  assert.equal(subscriptionAudit([series({ trialEndsOn: '2026-11-01' })], [], today, eur).findings.length, 0, 'already over');
});

test('overlap groups services in a shared streaming-style category and saves the cheapest', () => {
  const services = [
    series({ id: 'n', merchant: 'Netflix', amount: 15, category: 'Streaming' }),
    series({ id: 'd', merchant: 'Disney+', amount: 10, category: 'Streaming' }),
    series({ id: 'l', merchant: 'Gym', amount: 40, category: 'Health' }),
    series({ id: 'm1', merchant: 'Loan A', amount: 300, category: 'Loans' }),
    series({ id: 'm2', merchant: 'Loan B', amount: 200, category: 'Loans' }),
  ];
  const audit = subscriptionAudit(services, [], today, eur);
  const overlaps = audit.findings.filter(f => f.kind === 'overlap');
  assert.equal(overlaps.length, 1, 'two loans are not an overlap');
  assert.equal(overlaps[0].service.id, 'n');
  assert.equal(overlaps[0].yearlySaving, 120);
});

test('a service in both a trial and an overlap is counted once, at the larger saving', () => {
  const services = [
    series({ id: 'n', merchant: 'Netflix', amount: 15, category: 'Streaming' }),
    series({ id: 'd', merchant: 'Disney+', amount: 10, category: 'Streaming', trialEndsOn: '2026-11-10' }),
  ];
  const audit = subscriptionAudit(services, [], today, eur);
  assert.equal(audit.findings.length, 2);
  assert.equal(audit.potentialSaving, 120, 'Disney+ once, not 120 + 120');
});

test('totals, income share and the priciest services', () => {
  const income: Transaction = { id: 'i', accountId: 'x', date: '2026-06-01', description: 'Pay', amount: 12000, category: 'Salary', type: 'income', currency: 'EUR' };
  const audit = subscriptionAudit([series({ id: 'a', amount: 10 }), series({ id: 'b', merchant: 'Big', description: 'Big', amount: 50 }), series({ id: 'c', merchant: 'Weekly', description: 'Weekly', amount: 5, frequency: 'weekly' })], [income], today, eur);
  // Same arithmetic as the page's "Over a year": monthly equivalent rounded to cents, times 12 (5 a week is 21.67 a month).
  assert.equal(audit.yearlyCost, 120 + 600 + 260.04);
  assert.equal(audit.incomeShare, 980.04 / 12000);
  assert.equal(audit.priciest[0].service.id, 'b');
  assert.equal(subscriptionAudit([series({})], [], today, eur).incomeShare, undefined, 'no income, no share');
});

test('a dismissed finding stays hidden until its facts change', () => {
  const tx = [charge('1', '2025-03-05', 9.99), charge('2', '2026-10-05', 15.99)];
  const first = subscriptionAudit([series({})], tx, today, eur);
  const key = first.findings[0].key;
  assert.equal(subscriptionAudit([series({})], tx, today, eur, [key]).findings.length, 0);
  const later = subscriptionAudit([series({})], [...tx, charge('9', '2026-11-05', 19.99)], today, eur, [key]);
  assert.equal(later.findings.length, 1, 'a new price brings it back');
});
