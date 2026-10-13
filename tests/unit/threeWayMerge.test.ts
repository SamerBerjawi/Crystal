import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threeWayMerge } from '../../utils/threeWayMerge';

const item = (id: string, v = 0) => ({ id, v });

test('lists: adds from both sides survive', () => {
  const base = [item('a')];
  const merged = threeWayMerge(base, [item('a'), item('mine')], [item('a'), item('theirs')]) as any[];
  assert.deepEqual(merged.map(i => i.id).sort(), ['a', 'mine', 'theirs']);
});

test('lists: my delete and their edit of different items both apply', () => {
  const base = [item('a'), item('b'), item('c')];
  const mine = [item('a'), item('c')];                       // deleted b
  const theirs = [item('a'), item('b'), item('c', 9)];       // edited c
  const merged = threeWayMerge(base, mine, theirs) as any[];
  assert.deepEqual(merged, [item('a'), item('c', 9)]);
});

test('lists: an item edited on both sides merges per field', () => {
  const base = [{ id: 'x', name: 'n', note: '' }];
  const merged = threeWayMerge(base, [{ id: 'x', name: 'mine', note: '' }], [{ id: 'x', name: 'n', note: 'theirs' }]) as any[];
  assert.deepEqual(merged, [{ id: 'x', name: 'mine', note: 'theirs' }]);
});

test('objects: different fields changed on each side are both kept', () => {
  const base = { a: false, b: false, c: 1 };
  assert.deepEqual(threeWayMerge(base, { ...base, a: true }, { ...base, b: true }), { a: true, b: true, c: 1 });
});

test('the same field changed on both sides: this device wins', () => {
  const base = { a: 1 };
  assert.deepEqual(threeWayMerge(base, { a: 2 }, { a: 3 }), { a: 2 });
});

test('untouched here -> take theirs; untouched there -> take mine; plain lists -> mine', () => {
  assert.deepEqual(threeWayMerge([1], [1], [2]), [2]);
  assert.deepEqual(threeWayMerge([1], [3], [1]), [3]);
  assert.deepEqual(threeWayMerge(['a'], ['a', 'b'], ['a', 'c']), ['a', 'b']);
});

test('a missing base is treated as empty', () => {
  assert.deepEqual((threeWayMerge(undefined, [item('m')], [item('t')]) as any[]).map(i => i.id).sort(), ['m', 't']);
});
