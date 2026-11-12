import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBenchmark } from '../../utils/benchmark';

const series = [
  { date: '2024-01-01', close: 100 },
  { date: '2024-07-01', close: 110 },
  { date: '2025-01-01', close: 121 },
];

test('one buy replayed into the index grows with its price', () => {
  const r = buildBenchmark({ flows: [{ date: '2024-01-01', amount: -1000 }], series, yourValue: 1300, yourXirr: 0.3 })!;
  assert.equal(r.indexValue, 1210);
  assert.equal(r.indexGain, 210);
  assert.ok(Math.abs(r.indexXirr! - 0.21) < 0.005);
  assert.equal(r.lead, 90);
  assert.ok(r.leadPerYear! > 0.08);
  assert.equal(r.asOf, '2025-01-01');
});

test('a buy between prices uses the last close on or before it', () => {
  const r = buildBenchmark({ flows: [{ date: '2024-09-15', amount: -1100 }], series, yourValue: 0, yourXirr: null })!;
  assert.equal(r.indexValue, 1210); // 1100 / 110 units at 121
  assert.equal(r.lead, null);
});

test('a sale takes units out of the replay', () => {
  const r = buildBenchmark({ flows: [{ date: '2024-01-01', amount: -1000 }, { date: '2024-07-01', amount: 550 }], series, yourValue: 500, yourXirr: 0.1 })!;
  assert.equal(r.indexValue, 605); // 10 units, sold 5, 5 left at 121
  assert.equal(r.shortfall, false);
});

test('selling more than the replay holds is flagged, never negative', () => {
  const r = buildBenchmark({ flows: [{ date: '2024-01-01', amount: -100 }, { date: '2024-07-01', amount: 500 }], series, yourValue: 0, yourXirr: null })!;
  assert.equal(r.indexValue, 0);
  assert.equal(r.shortfall, true);
});

test('money that went in before the price history is flagged and priced at the first day', () => {
  const r = buildBenchmark({ flows: [{ date: '2023-06-01', amount: -1000 }], series, yourValue: 1000, yourXirr: 0 })!;
  assert.equal(r.startsBeforeData, true);
  assert.equal(r.indexValue, 1210);
});

test('points start at the first flow, hold invested money, and end on the last price day', () => {
  const r = buildBenchmark({ flows: [{ date: '2024-01-01', amount: -1000 }], series, yourValue: 1200, yourXirr: 0.2 })!;
  assert.equal(r.points[0].date, '2024-01-01');
  assert.equal(r.points[0].index, 1000);
  assert.ok(r.points.every(p => p.invested === 1000));
  assert.equal(r.points[r.points.length - 1].date, '2025-01-01');
  assert.equal(r.points[r.points.length - 1].index, 1210);
});

test('no prices or no flows gives nothing', () => {
  assert.equal(buildBenchmark({ flows: [], series, yourValue: 0, yourXirr: null }), null);
  assert.equal(buildBenchmark({ flows: [{ date: '2024-01-01', amount: -1 }], series: [], yourValue: 0, yourXirr: null }), null);
});
