import test from 'node:test';
import assert from 'node:assert/strict';
import { Tag, Transaction } from '../../types';
import { sortTags, summariseTags, taggedShare } from '../../utils/tagsModel';

const tag = (id: string, name: string): Tag => ({ id, name, color: '#000', icon: 'label' });
const tx = (amount: number, date: string, tagIds?: string[]) => ({ id: date + amount, amount, date, currency: 'EUR', tagIds }) as Transaction;
const today = new Date(2026, 9, 15);

test('counts, totals and six months of history per tag', () => {
  const [work] = summariseTags([tag('w', 'Work')], [tx(-10, '2026-10-01', ['w']), tx(30, '2026-05-02', ['w']), tx(-5, '2026-04-30', ['w']), tx(-1, '2026-10-01')], today);
  assert.equal(work.count, 3);
  assert.equal(work.netAmount, 15);
  assert.deepEqual(work.history.map(point => point.value), [30, 0, 0, 0, 0, 10]);
});

test('a transaction with a deleted tag is ignored', () => {
  assert.equal(summariseTags([tag('w', 'Work')], [tx(-10, '2026-10-01', ['gone'])], today)[0].count, 0);
});

test('sorts by use, size and name', () => {
  const tags = summariseTags([tag('a', 'Beta'), tag('b', 'Alpha')], [tx(-100, '2026-10-01', ['a']), tx(-1, '2026-10-02', ['b']), tx(-1, '2026-10-03', ['b'])], today);
  assert.deepEqual(sortTags(tags, 'count').map(item => item.id), ['b', 'a']);
  assert.deepEqual(sortTags(tags, 'amount').map(item => item.id), ['a', 'b']);
  assert.deepEqual(sortTags(tags, 'name').map(item => item.id), ['b', 'a']);
});

test('the tagged share counts each transaction once', () => {
  assert.equal(taggedShare([tx(1, '2026-01-01', ['a', 'b']), tx(2, '2026-01-02')]), 50);
  assert.equal(taggedShare([]), 0);
});
