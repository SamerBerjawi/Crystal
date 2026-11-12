import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProposal, findCategoryOutliers, findMerchantSpellings, pendingProposals, refreshProposals, spellingKey, undoProposal } from '../../utils/cleanup';
import type { Transaction } from '../../types';

let n = 0;
const tx = (merchant: string | undefined, category = 'Food', extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, accountId: 'a', date: '2025-01-01', description: merchant ?? '', merchant, amount: 10, category, type: 'expense', currency: 'EUR', ...extra,
});

test('spellings of one merchant share a key', () => {
  assert.equal(spellingKey('NETFLIX.COM'), spellingKey('Netflix'));
  assert.equal(spellingKey('Spotify AB'), spellingKey('spotify ab'));
  assert.notEqual(spellingKey('Shell'), spellingKey('Shelf'));
});

test('the most used spelling wins and the rest are renamed', () => {
  const list = [tx('Netflix'), tx('Netflix'), tx('NETFLIX.COM'), tx('Albert Heijn')];
  const [proposal] = findMerchantSpellings(list);
  assert.equal(proposal.title, 'Call it Netflix');
  assert.deepEqual(proposal.changes.map(c => [c.from, c.to]), [['NETFLIX.COM', 'Netflix']]);
  assert.equal(findMerchantSpellings([tx('Netflix'), tx('Netflix')]).length, 0);
});

test('transfers and adjustments are never proposed', () => {
  assert.equal(findMerchantSpellings([tx('Netflix'), tx('netflix', 'Food', { transferId: 'x' })]).length, 0);
});

test('a few strays are filed under the usual category', () => {
  const list = [...Array(8)].map(() => tx('Lidl', 'Groceries')).concat([tx('Lidl', 'Shopping'), tx('Lidl', 'Dining')]);
  const [proposal] = findCategoryOutliers(list);
  assert.equal(proposal.title, 'File Lidl under Groceries');
  assert.equal(proposal.changes.length, 2);
  assert.match(proposal.detail, /8 of 10/);
});

test('a split merchant, or a small sample, is left alone', () => {
  const split = [...Array(5)].map(() => tx('Amazon', 'Shopping')).concat([...Array(5)].map(() => tx('Amazon', 'Books')));
  assert.equal(findCategoryOutliers(split).length, 0);
  assert.equal(findCategoryOutliers([tx('Lidl', 'Groceries'), tx('Lidl', 'Dining')]).length, 0);
});

test('applying edits only what still looks as proposed, and undo reverses it', () => {
  const list = [tx('Netflix'), tx('Netflix'), tx('NETFLIX.COM'), tx('NETFLIX.COM')];
  const [proposal] = findMerchantSpellings(list);
  const edited = list.map(t => t.merchant === 'NETFLIX.COM' && t === list[3] ? { ...t, merchant: 'My own name' } : t);
  const { changed, skipped } = applyProposal(edited, proposal);
  assert.equal(changed.length, 1);
  assert.equal(skipped, 1);
  assert.equal(changed[0].merchant, 'Netflix');
  assert.deepEqual(changed[0].lockedFields, ['merchant']);
  const back = undoProposal(changed, proposal);
  assert.equal(back.changed[0].merchant, 'NETFLIX.COM');
});

test('a decided tidy-up is not offered again, and a gone one disappears', () => {
  const list = [tx('Netflix'), tx('Netflix'), tx('NETFLIX.COM')];
  const first = refreshProposals(list, [], '2025-02-01');
  assert.equal(first.length, 1);
  assert.equal(first[0].createdAt, '2025-02-01');
  const dismissed = first.map(p => ({ ...p, status: 'dismissed' as const }));
  assert.equal(pendingProposals(refreshProposals(list, dismissed, '2025-03-01')).length, 0);
  assert.equal(refreshProposals(list, dismissed, '2025-03-01').length, 1);
  assert.equal(refreshProposals([tx('Netflix')], first, '2025-03-01').length, 0);
  // The first sighting date is kept when it is found again.
  assert.equal(refreshProposals(list, first, '2025-03-01')[0].createdAt, '2025-02-01');
});

test('proposals queued by another source stay until decided', () => {
  const outside = { id: 'x', kind: 'assistant' as const, title: 't', detail: 'd', source: 'assistant' as const, status: 'pending' as const, createdAt: '2025-01-01', changes: [] };
  assert.equal(refreshProposals([], [outside], '2025-02-01').length, 1);
});

test('new strays after a tidy-up are offered again as a new round', () => {
  const list = [tx('Netflix'), tx('Netflix'), tx('NETFLIX.COM')];
  const applied = refreshProposals(list, [], '2025-02-01').map(p => ({ ...p, status: 'applied' as const, resolvedAt: '2025-02-02' }));
  const later = [tx('Netflix'), tx('Netflix'), tx('Netflix'), tx('NETFLIX.COM')];
  const again = refreshProposals(later, applied, '2025-03-01');
  assert.equal(pendingProposals(again).length, 1);
  assert.equal(pendingProposals(again)[0].id, `${applied[0].id}#1`);
  // Stable: looking again changes nothing, so it cannot loop.
  assert.deepEqual(refreshProposals(later, again, '2025-03-02').map(p => p.id), again.map(p => p.id));
});
