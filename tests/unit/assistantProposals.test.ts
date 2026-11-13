import test from 'node:test';
import assert from 'node:assert/strict';
import { addProposal, buildProposalTools } from '../../utils/assistantProposals';
import { applyProposal } from '../../utils/cleanup';
import type { Category, CleanupProposal, Transaction } from '../../types';

let n = 0;
const tx = (merchant: string, category: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, accountId: 'a', date: '2025-01-01', description: merchant, merchant, amount: 10, category, type: 'expense', currency: 'EUR', ...extra,
});
const cat = (name: string): Category => ({ id: name, name, color: '#000', icon: 'x', classification: 'expense', subCategories: [] } as Category);

const setup = (transactions: Transaction[]) => {
  const queue: CleanupProposal[] = [];
  const tools = buildProposalTools({ transactions, incomeCategories: [], expenseCategories: [cat('Groceries'), cat('Dining')], now: () => '2025-02-01T00:00:00Z' }, item => queue.push(item));
  const run = (name: string, args: Record<string, unknown>) => tools.find(t => t.name === name)!.run(args) as any;
  return { queue, run };
};

test('recategorising queues the exact edits and changes nothing itself', () => {
  const list = [tx('Lidl', 'Dining'), tx('Lidl', 'Groceries'), tx('Lidl', 'Dining'), tx('Aldi', 'Dining')];
  const { queue, run } = setup(list);
  const result = run('propose_recategorise', { merchant: 'lidl', category: 'groceries', reason: 'It is a supermarket.' });
  assert.equal(result.proposed, true);
  assert.equal(result.changes, 2);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].source, 'assistant');
  assert.equal(queue[0].status, 'pending');
  assert.equal(queue[0].detail, 'It is a supermarket.');
  assert.deepEqual(queue[0].changes.map(c => c.to), ['Groceries', 'Groceries']);
  assert.equal(list.filter(t => t.category === 'Dining').length, 3);
  assert.equal(applyProposal(list, queue[0]).changed.length, 2);
});

test('an unknown merchant or category is an error that lists real names', () => {
  const { queue, run } = setup([tx('Lidl', 'Dining')]);
  assert.match(run('propose_recategorise', { merchant: 'Lid', category: 'Groceries' }).error, /Lidl/);
  assert.match(run('propose_recategorise', { merchant: 'Lidl', category: 'Nonsense' }).error, /Groceries/);
  assert.equal(queue.length, 0);
});

test('nothing to change queues nothing', () => {
  const { queue, run } = setup([tx('Lidl', 'Groceries')]);
  const result = run('propose_recategorise', { merchant: 'Lidl', category: 'Groceries' });
  assert.equal(result.proposed, false);
  assert.equal(queue.length, 0);
});

test('renaming a merchant queues a rename, and transfers are left out', () => {
  const list = [tx('NETFLIX.COM', 'Dining'), tx('NETFLIX.COM', 'Dining', { transferId: 'x' })];
  const { queue, run } = setup(list);
  const result = run('propose_rename_merchant', { from: 'netflix.com', to: 'Netflix' });
  assert.equal(result.changes, 1);
  assert.equal(queue[0].title, 'Call NETFLIX.COM Netflix');
  assert.match(run('propose_rename_merchant', { from: 'NETFLIX.COM', to: '  ' }).error, /1 and 100/);
});

test('asking twice replaces the suggestion instead of piling up', () => {
  const { queue, run } = setup([tx('Lidl', 'Dining')]);
  run('propose_recategorise', { merchant: 'Lidl', category: 'Groceries' });
  run('propose_recategorise', { merchant: 'Lidl', category: 'Groceries' });
  assert.equal(queue.length, 2);
  assert.equal(addProposal(queue.slice(0, 1), queue[1]).length, 1);
});
