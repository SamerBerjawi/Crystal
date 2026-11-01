import test from 'node:test';
import assert from 'node:assert/strict';
import { AppPreferences, Transaction } from '../../types';
import { applyRules } from '../../utils/rules';
import { migrateRules, RULES_VERSION, undoRulesMigration } from '../../utils/rulesMigration';

const old = (extra: Partial<AppPreferences> = {}) => ({
  currency: 'EUR',
  merchantRules: {
    colruyt: { category: 'Groceries', defaultDescription: 'Food', logo: 'colruyt.be', notes: 'Keep' },
    ikea: { logo: 'ikea.com' },
  },
  regexCategorizationRules: [
    { id: 'r1', pattern: 'uber', category: 'Transport', isActive: true, description: 'Rides' },
    { id: 'r2', pattern: 'lyft', category: 'Transport', isActive: false },
  ],
  transactionRules: [{ id: 'keep', name: 'Keep', isActive: true, priority: 5, conditions: [{ field: 'description', operator: 'contains', value: 'rent' }], actions: [{ field: 'category', value: 'Housing' }] }],
  ...extra,
}) as unknown as AppPreferences;
const txs = [{ merchant: 'COLRUYT Laken' }, { merchant: 'Colruyt' }] as Transaction[];
const NOW = '2026-11-01T00:00:00.000Z';

test('merchant filing becomes always file, and the rest of the merchant stays', () => {
  const result = migrateRules(old(), txs, NOW);
  const filing = result.transactionRules!.find(rule => rule.kind === 'always')!;
  assert.equal(filing.name, 'Colruyt');
  assert.deepEqual(filing.actions, [{ field: 'category', value: 'Groceries' }, { field: 'description', value: 'Food' }]);
  assert.deepEqual(result.merchantRules!.colruyt, { logo: 'colruyt.be', notes: 'Keep' });
  assert.deepEqual(result.merchantRules!.ikea, { logo: 'ikea.com' });
});

test('regex rules become ordinary rules, after existing ones and in order', () => {
  const result = migrateRules(old(), txs, NOW);
  const ordinary = result.transactionRules!.filter(rule => rule.kind !== 'always').sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  assert.deepEqual(ordinary.map(rule => rule.id), ['keep', 'regex-r1', 'regex-r2']);
  assert.equal(ordinary[1].name, 'Rides');
  assert.deepEqual(ordinary[1].conditions, [{ field: 'text', operator: 'matches', value: 'uber' }]);
  assert.equal(ordinary[2].isActive, false);
  assert.equal(result.regexCategorizationRules, undefined);
});

test('results stay the same after migrating', () => {
  const result = migrateRules(old(), txs, NOW);
  const rules = result.transactionRules!;
  assert.equal(applyRules({ merchant: 'Colruyt', description: 'x', category: '', amount: -1, type: 'expense' }, rules).category, 'Groceries');
  assert.equal(applyRules({ merchant: '', description: 'UBER', category: '', amount: -1, type: 'expense' }, rules).category, 'Transport');
  assert.equal(applyRules({ merchant: '', description: 'rent', category: '', amount: -1, type: 'expense' }, rules).category, 'Housing');
});

test('migrating twice changes nothing', () => {
  const once = migrateRules(old(), txs, NOW);
  assert.equal(migrateRules(once, txs, '2030-01-01T00:00:00.000Z'), once);
  assert.equal(once.rulesVersion, RULES_VERSION);
});

test('with nothing to move it still marks the version, and keeps no backup', () => {
  const result = migrateRules({ currency: 'EUR' } as AppPreferences, [], NOW);
  assert.equal(result.rulesVersion, RULES_VERSION);
  assert.equal(result.rulesMigrationBackup, undefined);
});

test('a merchant with no transactions still gets a readable name', () => {
  const result = migrateRules(old(), [], NOW);
  assert.equal(result.transactionRules!.find(rule => rule.kind === 'always')!.name, 'Colruyt');
});

test('an old backup restored later migrates again', () => {
  const result = migrateRules(migrateRules({ ...old(), rulesVersion: undefined }, txs, NOW), txs, NOW);
  assert.equal(result.transactionRules!.filter(rule => rule.kind === 'always').length, 1);
});

test('the backup restores the old setup exactly', () => {
  const start = old();
  const restored = undoRulesMigration(migrateRules(start, txs, NOW));
  assert.deepEqual(restored.merchantRules, start.merchantRules);
  assert.deepEqual(restored.regexCategorizationRules, start.regexCategorizationRules);
  assert.deepEqual(restored.transactionRules, start.transactionRules);
  assert.equal(restored.rulesVersion, undefined);
});
