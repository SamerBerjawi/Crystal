import test from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Category, RecurringTransaction, Transaction } from '../../types';
import {
  cashFlowWarning,
  generateInsights,
  idleCash,
  savingsRateChange,
  spendingAnomalies,
  subscriptionAudit,
  visibleInsights,
  type InsightInput,
} from '../../utils/insightsModel';

const today = new Date(2026, 10, 15); // 2026-11-15

const cat = (name: string): Category => ({
  id: name,
  name,
  color: '#000',
  classification: 'expense',
  subCategories: [],
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't1',
  accountId: 'chk',
  date: '2026-10-10',
  description: 'Purchase',
  amount: -100,
  category: 'Food',
  type: 'expense',
  currency: 'EUR',
  ...over,
});

const series = (over: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 'rt1',
  accountId: 'chk',
  description: 'Streaming',
  merchant: 'StreamCo',
  amount: 15,
  type: 'expense',
  currency: 'EUR',
  frequency: 'monthly',
  startDate: '2026-01-01',
  nextDueDate: '2026-11-20',
  weekendAdjustment: 'on',
  ...over,
});

const baseInput = (over: Partial<InsightInput> = {}): InsightInput => ({
  today,
  accounts: [{ id: 'chk', name: 'Main', type: 'Checking', balance: 1000, currency: 'EUR' } as Account],
  transactions: [],
  categories: [cat('Food'), cat('Shopping')],
  recurring: [],
  convert: amount => amount,
  format: amount => `€${amount}`,
  ...over,
});

test('cashFlowWarning triggers only when lowestBalance is negative', () => {
  assert.equal(cashFlowWarning(baseInput()).length, 0);
  assert.equal(cashFlowWarning(baseInput({ lowestBalance: { date: '2026-12-01', total: 50 } })).length, 0);
  const [warn] = cashFlowWarning(baseInput({ lowestBalance: { date: '2026-12-01', total: -120 } }));
  assert.equal(warn.id, 'cashFlow-2026-12-01');
  assert.equal(warn.tone, 'attention');
  assert.equal(warn.page, 'Forecasting');
});

test('idleCash flags checking balance above 2x average monthly spend plus threshold', () => {
  const history = [
    tx({ id: '1', date: '2026-08-10', amount: -600 }),
    tx({ id: '2', date: '2026-09-10', amount: -600 }),
    tx({ id: '3', date: '2026-10-10', amount: -600 }),
  ];
  // Avg monthly spend = 600. 2x = 1200. Threshold = max(500, 300) = 500 -> needs >= 1700 in checking.
  assert.equal(
    idleCash(baseInput({
      accounts: [{ id: 'chk', name: 'Main', type: 'Checking', balance: 1500, currency: 'EUR' } as Account],
      transactions: history,
    })).length,
    0,
  );
  const [card] = idleCash(baseInput({
    accounts: [{ id: 'chk', name: 'Main', type: 'Checking', balance: 2500, currency: 'EUR' } as Account],
    transactions: history,
  }));
  assert.equal(card.id, 'idleCash-2026-11');
  assert.equal(card.title, '€1300 is sitting idle');
});

test('spendingAnomalies flags categories at >= 1.5x usual and >= 50 over usual', () => {
  const history = [
    tx({ id: '1', date: '2026-08-10', amount: -200, category: 'Food' }),
    tx({ id: '2', date: '2026-09-10', amount: -200, category: 'Food' }),
    tx({ id: '3', date: '2026-10-10', amount: -200, category: 'Food' }),
    tx({ id: 'now', date: '2026-11-05', amount: -340, category: 'Food' }),
  ];
  const [anomaly] = spendingAnomalies(baseInput({ transactions: history }));
  assert.equal(anomaly.id, 'spendingAnomaly-Food-2026-11');
  assert.equal(anomaly.tone, 'attention');
});

test('savingsRateChange compares last full month against the 3 months before it', () => {
  // July, Aug, Sep: 1000 in, 800 out -> 20% savings rate.
  // Oct (last full month before Nov): 1000 in, 500 out -> 50% savings rate (+30 pts).
  const txs = [
    tx({ id: 'i7', date: '2026-07-05', amount: 1000, type: 'income', category: 'Salary' }),
    tx({ id: 'e7', date: '2026-07-10', amount: -800 }),
    tx({ id: 'i8', date: '2026-08-05', amount: 1000, type: 'income', category: 'Salary' }),
    tx({ id: 'e8', date: '2026-08-10', amount: -800 }),
    tx({ id: 'i9', date: '2026-09-05', amount: 1000, type: 'income', category: 'Salary' }),
    tx({ id: 'e9', date: '2026-09-10', amount: -800 }),
    tx({ id: 'i10', date: '2026-10-05', amount: 1000, type: 'income', category: 'Salary' }),
    tx({ id: 'e10', date: '2026-10-10', amount: -500 }),
  ];
  const [card] = savingsRateChange(baseInput({ transactions: txs }));
  assert.equal(card.id, 'savingsRate-2026-10');
  assert.equal(card.tone, 'positive');
});

test('subscriptionAudit summarizes 3+ active services and highlights trials ending soon', () => {
  const subs = [
    series({ id: 's1', merchant: 'Netflix', amount: 18 }),
    series({ id: 's2', merchant: 'Spotify', amount: 11 }),
    series({ id: 's3', merchant: 'Cloud', amount: 9, trialEndsOn: '2026-11-18' }),
  ];
  const [audit] = subscriptionAudit(baseInput({ recurring: subs }));
  assert.equal(audit.id, 'subscriptions-2026-11');
  assert.equal(audit.tone, 'attention');
  assert.ok(audit.body.includes('Netflix'));
  assert.ok(audit.body.includes('2026-11-18'));
});

test('generateInsights sorts attention first and visibleInsights filters dismissed ids', () => {
  const subs = [
    series({ id: 's1', merchant: 'Netflix', amount: 18 }),
    series({ id: 's2', merchant: 'Spotify', amount: 11 }),
    series({ id: 's3', merchant: 'Cloud', amount: 9 }),
  ];
  const all = generateInsights(baseInput({
    recurring: subs,
    lowestBalance: { date: '2026-12-01', total: -50 },
  }));
  assert.equal(all.length, 2);
  assert.equal(all[0].kind, 'cashFlow');
  assert.equal(all[1].kind, 'subscriptions');
  const shown = visibleInsights(all, ['cashFlow-2026-12-01']);
  assert.deepEqual(shown.map(i => i.kind), ['subscriptions']);
});
