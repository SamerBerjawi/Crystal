import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatchScore, detectAmountFormat, detectDateFormat, parseCSV, parseDate, rowMatchesFilters } from '../../utils/importParsing';

test('parseCSV keeps quoted separators and skips blank lines', () => {
  const { headers, data } = parseCSV('Date,Name,Amount\n2026-01-02,"Shop, Inc",-5\n\n2026-01-03,Pay,10', ',');
  assert.deepEqual(headers, ['Date', 'Name', 'Amount']);
  assert.equal(data.length, 2);
  assert.equal(data[0].Name, 'Shop, Inc');
});

test('parseDate reads each format and rejects impossible dates', () => {
  assert.equal(parseDate('31/12/2026', 'DD/MM/YYYY')?.getMonth(), 11);
  assert.equal(parseDate('12/31/26', 'MM/DD/YYYY')?.getFullYear(), 2026);
  assert.equal(parseDate('2026-02-30', 'YYYY-MM-DD'), null);
  assert.equal(parseDate('not-a-date', 'YYYY-MM-DD'), null);
  assert.equal(parseDate('March 3, 2026', 'YYYY-MM-DD')?.getMonth(), 2);
});

test('detectDateFormat uses days above 12', () => {
  assert.equal(detectDateFormat([{ d: '25/01/2026' }, { d: '03/02/2026' }], 'd'), 'DD/MM/YYYY');
  assert.equal(detectDateFormat([{ d: '01/25/2026' }], 'd'), 'MM/DD/YYYY');
  assert.equal(detectDateFormat([{ d: '2026-01-25' }], 'd'), 'YYYY-MM-DD');
});

test('two amount columns mean double entry', () => {
  assert.equal(detectAmountFormat({ amountIn: 'In', amountOut: 'Out' }), 'double_entry');
  assert.equal(detectAmountFormat({ amount: 'Amount' }), 'single_signed');
});

test('short keywords only match exactly', () => {
  assert.equal(calculateMatchScore('Description', ['cr']), 0);
  assert.equal(calculateMatchScore('CR', ['cr']), 100);
});

test('row filters cover dates, amounts and text', () => {
  const row = { date: '2026-03-15', amount: -20, name: 'Coffee Shop' };
  assert.ok(rowMatchesFilters(row, { date: { type: 'month', value: '3' } }));
  assert.ok(!rowMatchesFilters(row, { date: { type: 'year', value: '2025' } }));
  assert.ok(rowMatchesFilters(row, { amount: { type: 'lt', value: '0' } }));
  assert.ok(rowMatchesFilters(row, { name: { type: 'contains', value: 'coffee' } }));
  assert.ok(!rowMatchesFilters(row, { name: { type: 'contains', value: 'tea' } }));
  assert.ok(rowMatchesFilters(row, { name: { type: 'contains', value: '' } }));
});
