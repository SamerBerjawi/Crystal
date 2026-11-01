import test from 'node:test';
import assert from 'node:assert/strict';
import { Category, Transaction } from '../../types';
import { applyBulkEdit, BulkField, BulkValues } from '../../utils/bulkEdit';
import { parseMileageBatch, parseReading, readingProblem } from '../../utils/mileageModel';
import { amountLeft, buildSplit, initialParts } from '../../utils/splitModel';

const tx = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, accountId: 'a', date: '2026-01-01', description: id, amount, category: 'Food', type: amount >= 0 ? 'income' : 'expense', currency: 'EUR', ...extra,
});

const values: BulkValues = { date: '2026-02-02', accountId: 'b', description: 'New', merchant: 'Shop', category: '', tagIds: ['t'], locationText: '', location: {} };
const fields = (...names: BulkField[]) => new Set(names);
const categories = [{ id: 'c', name: 'Salary', classification: 'income', subCategories: [{ id: 'd', name: 'Bonus', classification: 'income', subCategories: [] }] }] as unknown as Category[];

test('a split starts with parts that add up, even with an odd cent', () => {
  const source = tx('x', -10.01);
  const parts = initialParts(source);
  assert.deepEqual(parts.map(part => part.amount), ['5.00', '5.01']);
  assert.equal(amountLeft(source, parts), 0);
});

test('amounts left follow typed amounts, with comma decimals', () => {
  const source = tx('x', -100);
  assert.equal(amountLeft(source, [{ id: '1', amount: '60,50', category: '', description: '' }]), 39.5);
});

test('split parts keep the sign and fall back to the original', () => {
  const { parent, subTransactions } = buildSplit(tx('x', -100), [
    { id: '1', amount: '60', category: 'Fuel', description: ' Tank ' },
    { id: '2', amount: '40', category: '', description: '' },
  ], 1);
  assert.equal(parent.isSplitParent, true);
  assert.deepEqual(subTransactions.map(part => [part.id, part.amount, part.category, part.description, part.parentTransactionId]), [
    ['split-x-0-1', -60, 'Fuel', 'Tank', 'x'],
    ['split-x-1-1', -40, 'Food', 'x (Part 2)', 'x'],
  ]);
});

test('bulk edit changes only the chosen fields', () => {
  const { updated } = applyBulkEdit([tx('x', -5, { merchant: 'Old', city: 'Ghent' })], [], fields('merchant'), values, categories);
  assert.equal(updated[0].merchant, 'Shop');
  assert.equal(updated[0].description, 'x');
  assert.equal(updated[0].date, '2026-01-01');
  assert.equal(updated[0].city, 'Ghent');
});

test('bulk edit keeps both sides of a transfer in step, but not the account', () => {
  const pair = [tx('o', -5, { transferId: 't' }), tx('i', 5, { transferId: 't', accountId: 'z' })];
  const { updated, idsToDelete } = applyBulkEdit([pair[0]], pair, fields('date', 'accountId'), values, categories);
  assert.deepEqual(idsToDelete, []);
  assert.deepEqual(updated.map(item => [item.id, item.date, item.accountId]), [['i', '2026-02-02', 'z'], ['o', '2026-02-02', 'b']]);
});

test('a new category sets the type and sign, and ends a transfer', () => {
  const pair = [tx('o', -5, { transferId: 't' }), tx('i', 5, { transferId: 't' })];
  const { updated, idsToDelete } = applyBulkEdit([pair[0]], pair, fields('category'), { ...values, category: 'Bonus' }, categories);
  assert.deepEqual(idsToDelete, ['i']);
  assert.equal(updated.length, 1);
  assert.deepEqual([updated[0].type, updated[0].amount, updated[0].transferId, updated[0].category], ['income', 5, undefined, 'Bonus']);
});

test('a blank location clears it, and typed text becomes the city', () => {
  const source = tx('x', -5, { city: 'Ghent', latitude: 1 });
  const cleared = applyBulkEdit([source], [], fields('location'), values, categories).updated[0];
  assert.equal(cleared.city, undefined);
  assert.equal(cleared.latitude, undefined);
  const typed = applyBulkEdit([source], [], fields('location'), { ...values, locationText: 'Leuven' }, categories).updated[0];
  assert.deepEqual([typed.city, typed.address], ['Leuven', 'Leuven']);
});

test('a reading has to sit between its neighbours', () => {
  const logs = [{ id: 'a', date: '2026-01-01', reading: 100 }, { id: 'b', date: '2026-03-01', reading: 300 }];
  assert.match(readingProblem(50, '2026-02-01', logs) ?? '', /lower than 100/);
  assert.match(readingProblem(400, '2026-02-01', logs) ?? '', /higher than 300/);
  assert.equal(readingProblem(200, '2026-02-01', logs), null);
  assert.equal(readingProblem(250, '2026-01-01', logs, 'a'), null);
  assert.equal(parseReading('45.000 km'), 45000);
  assert.ok(Number.isNaN(parseReading('none')));
});

test('a batch reads any separator, keeps the date as written, and measures from the last reading', () => {
  const logs = [{ id: 'a', date: '2026-01-01', reading: 100 }];
  const entries = parseMileageBatch('2026-02-01, 150, oil\n2026/3/1;90\n\n2026-04-01\t200', logs);
  assert.deepEqual(entries.map(entry => [entry.date, entry.reading, entry.diff]), [['2026-02-01', 150, 50], ['2026-03-01', 90, -60], ['2026-04-01', 200, 110]]);
  assert.match(entries[1].warning ?? '', /Lower/);
});

test('a batch names the line of each problem', () => {
  const entries = parseMileageBatch('2026-02-01\n2026-13-01 5\n2026-02-30 5\n2026-02-01 abc', []);
  assert.deepEqual(entries.map(entry => entry.error?.slice(0, 6)), ['Line 1', 'Line 2', 'Line 3', 'Line 4']);
});
