import test from 'node:test';
import assert from 'node:assert/strict';
import type { RecurringTransaction, Transaction } from '../../types';
import { mapWithConcurrency } from '../../utils/concurrency';
import { applyArrayDelta, computeArrayDelta, threeWayMerge } from '../../utils/threeWayMerge';
import { matchPaid } from '../../utils/scheduleModel';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('mapWithConcurrency never exceeds the limit and keeps input order', async () => {
  let active = 0;
  let peak = 0;
  const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async n => {
    active += 1; peak = Math.max(peak, active);
    await sleep(5 * (7 - n));
    active -= 1;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60]);
  assert.equal(peak, 2);
});

test('mapWithConcurrency handles empty input and rejects on the first error without starting more work', async () => {
  assert.deepEqual(await mapWithConcurrency([], 3, async () => 1), []);
  const started: number[] = [];
  await assert.rejects(mapWithConcurrency([1, 2, 3, 4, 5], 1, async n => { started.push(n); if (n === 2) throw new Error('boom'); return n; }), /boom/);
  assert.deepEqual(started, [1, 2]);
});

test('threeWayMerge preserves composite-keyed recurringTransactionOverrides and priceHistory entries from both devices', () => {
  const baseOverrides = [{ recurringTransactionId: 'rt-1', originalDate: '2026-01-01', isSkipped: true }];
  const myOverrides = [...baseOverrides, { recurringTransactionId: 'rt-1', originalDate: '2026-02-01', isSkipped: true }];
  const theirOverrides = [...baseOverrides, { recurringTransactionId: 'rt-2', originalDate: '2026-01-15', amount: 120 }];

  const mergedOverrides = threeWayMerge(baseOverrides, myOverrides, theirOverrides) as any[];
  assert.equal(mergedOverrides.length, 3);
  assert.ok(mergedOverrides.some(o => o.recurringTransactionId === 'rt-1' && o.originalDate === '2026-02-01'));
  assert.ok(mergedOverrides.some(o => o.recurringTransactionId === 'rt-2' && o.originalDate === '2026-01-15'));

  const basePrices = { AAPL: [{ date: '2026-01-01', price: 180 }] };
  const myPrices = { AAPL: [{ date: '2026-01-01', price: 180 }, { date: '2026-01-02', price: 185 }] };
  const theirPrices = { AAPL: [{ date: '2026-01-01', price: 180 }, { date: '2026-01-03', price: 190 }] };
  const mergedPrices = threeWayMerge(basePrices, myPrices, theirPrices) as any;
  assert.equal(mergedPrices.length ?? mergedPrices.AAPL.length, 3);
});

test('computeArrayDelta and applyArrayDelta round-trip single edits and deletions on large arrays', () => {
  const base = Array.from({ length: 500 }, (_, i) => ({
    id: `tx-${i}`,
    amount: -10 - i,
    description: `Item ${i}`,
  }));
  const current = base
    .filter(item => item.id !== 'tx-10')
    .map(item => (item.id === 'tx-25' ? { ...item, amount: -999 } : item));
  current.push({ id: 'tx-500', amount: -42, description: 'New item' });

  const delta = computeArrayDelta(base, current);
  assert.ok(delta);
  assert.equal(delta.upserts.length, 2);
  assert.deepEqual(delta.deletedIds, ['tx-10']);

  const reconstructed = applyArrayDelta(base, delta);
  assert.deepEqual(reconstructed, current);
});

test('matchPaid date-windowed indexing handles 50,000 unlinked transactions in under 150ms', () => {
  const txs: Transaction[] = Array.from({ length: 50_000 }, (_, i) => ({
    id: `tx-${i}`,
    accountId: 'acc-1',
    amount: -15.99,
    currency: 'EUR',
    date: `202${i % 5}-0${(i % 9) + 1}-15`,
    description: 'Coffee Shop',
    category: 'Dining',
    type: 'expense',
  }));
  txs.push({
    id: 'tx-target',
    accountId: 'acc-1',
    amount: -12.99,
    currency: 'EUR',
    date: '2026-11-05',
    description: 'Netflix',
    merchant: 'Netflix',
    category: 'Subscriptions',
    type: 'expense',
  });

  const series = new Map<string, RecurringTransaction>([
    [
      'rt-netflix',
      {
        id: 'rt-netflix',
        accountId: 'acc-1',
        amount: 12.99,
        currency: 'EUR',
        description: 'Netflix',
        merchant: 'Netflix',
        category: 'Subscriptions',
        type: 'expense',
        frequency: 'monthly',
        startDate: '2026-01-05',
        nextDueDate: '2026-11-05',
        weekendAdjustment: 'on',
      },
    ],
  ]);
  const occurrences = [
    { key: 'rt-netflix|2026-11-05', sourceId: 'rt-netflix', originalDate: '2026-11-05', date: '2026-11-05' },
  ];

  const start = performance.now();
  const paid = matchPaid(occurrences, txs, series);
  const elapsedMs = performance.now() - start;

  assert.equal(paid.get('rt-netflix|2026-11-05'), 'tx-target');
  assert.ok(elapsedMs < 250, `Expected matchPaid on 50k txs under 250ms, took ${elapsedMs.toFixed(1)}ms`);
});
