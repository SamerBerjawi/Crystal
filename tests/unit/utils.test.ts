import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, convertToEur, parseLocalDate, escapeHtml, safeAdd, safeSubtract, safeMultiply, round2, toCents, fromCents } from '../../utils';
import { upsertEntity, removeEntityById } from '../../utils/collection';

test('formatCurrency formats EUR', () => {
  assert.match(formatCurrency(1234.56, 'EUR'), /1[.,]?234[.,]56/);
});

test('convertToEur is 1:1 for EUR', () => {
  assert.equal(convertToEur(100, 'EUR'), 100);
});

test('parseLocalDate parses YYYY-MM-DD as a local date', () => {
  const d = parseLocalDate('2026-07-29');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6);
  assert.equal(d.getDate(), 29);
});

test('safe math avoids float drift', () => {
  assert.equal(safeAdd(0.1, 0.2), 0.3);
  assert.equal(safeSubtract(0.3, 0.1), 0.2);
  assert.equal(safeMultiply(1.1, 3), 3.3);
  assert.equal(round2(1.005), 1.01);
  assert.equal(fromCents(toCents(12.34)), 12.34);
});

test('escapeHtml escapes markup', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('upsertEntity / removeEntityById', () => {
  const list = [{ id: 'a', v: 1 }];
  assert.deepEqual(upsertEntity(list, { id: 'a', v: 2 }), [{ id: 'a', v: 2 }]);
  assert.equal(upsertEntity(list, { id: 'b', v: 3 }).length, 2);
  assert.deepEqual(removeEntityById(list, 'a'), []);
});

test('convertToEur falls back to 1:1 for a currency with no usable rate instead of NaN/0', async () => {
    const { convertToEur } = await import('../../utils');
    assert.equal(convertToEur(100, 'USD' as any, { EUR: 1 }), 100);
    assert.equal(convertToEur(100, 'USD' as any, { USD: Number.NaN, EUR: 1 }), 100);
    assert.equal(convertToEur(100, 'USD' as any, { USD: 0.5, EUR: 1 }), 50);
});
