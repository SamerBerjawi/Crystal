import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleRunBackup, Transaction, TransactionRule } from '../../types';
import { alwaysFileRule } from '../../utils/rules';
import {
  blankDraft, buildRevert, buildRun, draftFromRule, findRuleProblem, matchingTransactions, moveRule, previewChanges, ruleFromDraft, ruleSentence, ruleSuggestions, sentenceText, shiftRule,
} from '../../utils/rulesModel';

const tx = (id: string, extra: Partial<Transaction> = {}) => ({ id, description: 'UBER trip', merchant: '', category: 'Other', amount: -9, type: 'expense', date: '2026-10-01', ...extra }) as Transaction;
const rule = (id: string, priority: number, extra: Partial<TransactionRule> = {}): TransactionRule => ({
  id, name: id, isActive: true, priority,
  conditions: [{ field: 'description', operator: 'contains', value: 'uber' }],
  actions: [{ field: 'category', value: 'Transport' }],
  ...extra,
});
const NOW = '2026-11-01T00:00:00.000Z';

test('rules read as plain sentences', () => {
  assert.equal(sentenceText(rule('a', 1)), 'When description contains uber, set category to Transport');
  assert.equal(sentenceText(alwaysFileRule('colruyt', 'Colruyt', { category: 'Groceries', description: 'Food' })), 'Always file Colruyt under Groceries, described as Food');
  assert.equal(sentenceText(alwaysFileRule('x', 'X', { description: 'Food' })), 'Always describe X as Food');
  const many = rule('b', 1, { conditionLogic: 'OR', conditions: [{ field: 'amount', operator: 'greater_than', value: '40' }, { field: 'text', operator: 'matches', value: '^a' }] });
  assert.equal(sentenceText(many), 'When amount is above 40 or anywhere matches pattern ^a, set category to Transport');
  assert.ok(ruleSentence(rule('c', 1)).some(part => part.isValue && part.text === 'uber'));
});

test('a preview lists only real changes, with the rule that made them', () => {
  const rules = [rule('r', 1)];
  const changes = previewChanges([tx('1'), tx('2', { description: 'rent' }), tx('3', { category: 'Transport' })], rules);
  assert.deepEqual(changes.map(change => change.transaction.id), ['1']);
  assert.deepEqual(changes[0].updates, { category: 'Transport' });
  assert.equal(changes[0].ruleName, 'r');
});

test('a run saves changes, a backup and a readable log', () => {
  const rules = [rule('r', 1)];
  const { payload, backup, logs } = buildRun(previewChanges([tx('1')], rules), NOW);
  assert.equal(payload[0].category, 'Transport');
  assert.deepEqual(backup.transactions, [{ id: '1', originalCategory: 'Other', originalMerchant: '', originalDescription: 'UBER trip' }]);
  assert.equal(logs[0].batchId, backup.batchId);
  assert.equal(logs[0].changeDetails, 'Category: Other → Transport');
});

test('undo restores the originals and skips deleted transactions', () => {
  const backup: RuleRunBackup = { batchId: 'b', timestamp: NOW, transactions: [{ id: '1', originalCategory: 'Other', originalMerchant: 'M', originalDescription: 'D' }, { id: 'gone', originalCategory: '', originalMerchant: '', originalDescription: '' }] };
  const { payload, logs } = buildRevert(backup, [tx('1', { category: 'Transport' })], NOW);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].category, 'Other');
  assert.equal(payload[0].merchant, 'M');
  assert.equal(logs[0].ruleId, 'rollback');
});

test('moving rules rewrites priority and leaves always file alone', () => {
  const filing = alwaysFileRule('a', 'A', { category: 'B' });
  const rules = [rule('one', 3), rule('two', 2), rule('three', 1), filing];
  const order = (items: TransactionRule[]) => items.filter(item => !item.kind).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map(item => item.id);
  assert.deepEqual(order(moveRule(rules, 'three', 'one', 'before')), ['three', 'one', 'two']);
  assert.deepEqual(order(moveRule(rules, 'one', 'three', 'after')), ['two', 'three', 'one']);
  assert.deepEqual(order(shiftRule(rules, 'two', -1)), ['two', 'one', 'three']);
  assert.deepEqual(order(shiftRule(rules, 'one', -1)), ['one', 'two', 'three']);
  assert.ok(moveRule(rules, 'three', 'one', 'before').includes(filing));
});

test('drafts catch what would never run', () => {
  const draft = blankDraft();
  assert.match(findRuleProblem(draft)!, /value/);
  draft.conditions[0].value = 'uber';
  assert.match(findRuleProblem(draft)!, /set/);
  draft.actions[0].value = 'Transport';
  assert.equal(findRuleProblem(draft), null);
  assert.match(findRuleProblem({ ...draft, conditions: [{ field: 'text', operator: 'matches', value: '(' }] })!, /pattern/);
  assert.match(findRuleProblem({ ...draft, conditions: [{ field: 'amount', operator: 'equals', value: 'abc' }] })!, /number/);
  assert.match(findRuleProblem({ ...draft, kind: 'always', merchant: '' })!, /merchant/i);
  assert.match(findRuleProblem({ ...draft, kind: 'always', merchant: 'A', category: '', description: '' })!, /category or description/);
});

test('a draft round-trips, and an always file uses the merchant key', () => {
  const start = rule('r', 4, { conditionLogic: 'OR' });
  const again = ruleFromDraft(draftFromRule(start), []);
  assert.equal(again.id, 'r');
  assert.equal(again.priority, 4);
  assert.equal(again.conditionLogic, 'OR');

  const filing = ruleFromDraft({ ...blankDraft(), kind: 'always', merchant: ' Colruyt ', category: 'Groceries' }, []);
  assert.equal(filing.conditions[0].value, 'colruyt');
  assert.equal(filing.name, 'Colruyt');
  const back = draftFromRule(filing);
  assert.equal(back.merchant, 'Colruyt');
  assert.equal(back.category, 'Groceries');
});

test('a new rule goes to the top, and a blank name comes from the sentence', () => {
  const draft = { ...blankDraft(), conditions: [{ field: 'description', operator: 'contains', value: 'uber' } as const], actions: [{ field: 'category', value: 'Transport' } as const] };
  const made = ruleFromDraft(draft, [rule('old', 7)]);
  assert.equal(made.priority, 8);
  assert.equal(made.name, 'Description contains uber');
});

test('matches count against a draft, including one not saved yet', () => {
  assert.equal(matchingTransactions(rule('r', 1), [tx('1'), tx('2', { description: 'rent' })]).length, 1);
});

test('suggestions come from repeats, skip what rules cover, and can be always file', () => {
  const repeats = [tx('1', { merchant: 'Delhaize', description: 'Shop', category: 'Groceries' }), tx('2', { merchant: 'Delhaize', description: 'Shop', category: 'Groceries' })];
  const suggestions = ruleSuggestions(repeats, []);
  const filing = suggestions.find(item => item.rule.kind === 'always')!;
  assert.equal(sentenceText(filing.rule), 'Always file Delhaize under Groceries');
  assert.match(filing.reason, /2/);
  assert.equal(ruleSuggestions(repeats, [alwaysFileRule('delhaize', 'Delhaize', { category: 'Groceries' })]).filter(item => item.rule.kind === 'always').length, 0);
});

test('a merchant filed two ways is suggested once, the most common way', () => {
  const mixed = [tx('1', { merchant: 'A', category: 'Food' }), tx('2', { merchant: 'A', category: 'Food' }), tx('3', { merchant: 'A', category: 'Food' }), tx('4', { merchant: 'a', category: 'Other' }), tx('5', { merchant: 'A', category: 'Other' })];
  const filings = ruleSuggestions(mixed, []).filter(item => item.rule.kind === 'always');
  assert.equal(filings.length, 1);
  assert.equal(sentenceText(filings[0].rule), 'Always file A under Food');
});

test('one-offs and uncategorised merchants are not suggested', () => {
  assert.equal(ruleSuggestions([tx('1', { merchant: 'Once', category: 'Food' })], []).filter(item => item.rule.kind === 'always').length, 0);
  assert.equal(ruleSuggestions([tx('1', { merchant: 'A', category: '' }), tx('2', { merchant: 'A', category: '' })], []).filter(item => item.rule.kind === 'always').length, 0);
});
