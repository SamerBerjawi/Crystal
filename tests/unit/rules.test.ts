import test from 'node:test';
import assert from 'node:assert/strict';
import { MerchantRule, TransactionRule } from '../../types';
import { alwaysFileRule, applyRules, applySavedRules, evaluateRuleCondition, filingFor, setFiling, spareChangeFor, withFiling } from '../../utils/rules';

const rule = (id: string, extra: Partial<TransactionRule> = {}): TransactionRule => ({
  id,
  name: id,
  isActive: true,
  conditions: [{ field: 'description', operator: 'contains', value: 'uber' }],
  actions: [{ field: 'category', value: 'Transport' }],
  ...extra,
});
const tx = (extra = {}) => ({ description: 'UBER trip', merchant: '', category: '', amount: -9, type: 'expense', ...extra });
const colruyt = alwaysFileRule('colruyt', 'Colruyt', { category: 'Groceries', description: 'Food shop' });

test('text conditions ignore case, and each operator works', () => {
  const data = { description: 'Card UBER Trip', merchant: 'Uber' };
  const check = (operator: any, value: string, field: any = 'description') => evaluateRuleCondition(data, { field, operator, value });
  assert.ok(check('contains', 'uber'));
  assert.ok(check('equals', 'UBER', 'merchant'));
  assert.ok(check('starts_with', 'card'));
  assert.ok(check('ends_with', 'trip'));
  assert.ok(!check('contains', 'lyft'));
});

test('amounts compare by size, whatever the sign', () => {
  const data = { amount: -50 };
  assert.ok(evaluateRuleCondition(data, { field: 'amount', operator: 'greater_than', value: '40' }));
  assert.ok(evaluateRuleCondition(data, { field: 'amount', operator: 'less_than', value: '60' }));
  assert.ok(evaluateRuleCondition(data, { field: 'amount', operator: 'equals', value: '50' }));
  assert.ok(!evaluateRuleCondition(data, { field: 'amount', operator: 'equals', value: 'abc' }));
});

test('a pattern searches merchant, description and notes, and a broken one matches nothing', () => {
  const data = { merchant: 'Shop', description: 'x', notes: 'invoice 123' };
  assert.ok(evaluateRuleCondition(data, { field: 'text', operator: 'matches', value: 'invoice\\s\\d+' }));
  assert.ok(evaluateRuleCondition(data, { field: 'text', operator: 'matches', value: '^shop' }));
  assert.ok(!evaluateRuleCondition(data, { field: 'text', operator: 'matches', value: '(' }));
});

test('highest priority goes first and the first match wins', () => {
  const low = rule('low', { priority: 1, actions: [{ field: 'category', value: 'Low' }] });
  const high = rule('high', { priority: 9, actions: [{ field: 'category', value: 'High' }] });
  const result = applyRules(tx(), [low, high]);
  assert.equal(result.category, 'High');
  assert.equal(result.appliedRuleId, 'high');
});

test('any and all behave differently', () => {
  const conditions: TransactionRule['conditions'] = [
    { field: 'description', operator: 'contains', value: 'uber' },
    { field: 'description', operator: 'contains', value: 'lyft' },
  ];
  assert.equal(applyRules(tx(), [rule('all', { conditions })]).appliedRuleId, undefined);
  assert.equal(applyRules(tx(), [rule('any', { conditions, conditionLogic: 'OR' })]).appliedRuleId, 'any');
});

test('inactive rules and rules with no conditions never run', () => {
  assert.equal(applyRules(tx(), [rule('off', { isActive: false }), rule('empty', { conditions: [] })]).appliedRuleId, undefined);
});

test('always file wins what it sets, and rules fill what it leaves', () => {
  const filing = alwaysFileRule('colruyt', 'Colruyt', { category: 'Groceries' });
  const fill = rule('fill', {
    conditions: [{ field: 'merchant', operator: 'contains', value: 'colruyt' }],
    actions: [{ field: 'category', value: 'Wrong' }, { field: 'description', value: 'Weekly shop' }],
  });
  const result = applyRules(tx({ merchant: 'Colruyt', description: 'Card payment' }), [fill, filing]);
  assert.equal(result.category, 'Groceries');
  assert.equal(result.description, 'Weekly shop');
  assert.equal(result.filingRuleId, filing.id);
  assert.equal(result.appliedRuleId, 'fill');
});

test('a rule with nothing left to set lets the next rule fill the gap', () => {
  const filing = alwaysFileRule('colruyt', 'Colruyt', { category: 'Groceries' });
  const blocked = rule('blocked', { priority: 9, conditions: [{ field: 'merchant', operator: 'contains', value: 'colruyt' }] });
  const next = rule('next', { priority: 1, conditions: [{ field: 'merchant', operator: 'contains', value: 'colruyt' }], actions: [{ field: 'description', value: 'Filled' }] });
  const result = applyRules(tx({ merchant: 'Colruyt' }), [blocked, next, filing]);
  assert.equal(result.description, 'Filled');
  assert.equal(result.appliedRuleId, 'next');
});

test('a switched-off always file does nothing', () => {
  assert.equal(applyRules(tx({ merchant: 'Colruyt' }), [{ ...colruyt, isActive: false }]).category, '');
});

test('merchant spelling variants share one always file', () => {
  assert.equal(applyRules(tx({ merchant: '  COLRUYT ' }), [colruyt]).category, 'Groceries');
});

test('a bank record with an id still gets filed, and notes reach patterns', () => {
  const result = applySavedRules({ id: 'bank-1', merchant: 'Colruyt', description: 'Card payment', category: '', amount: -20, type: 'expense' }, { transactionRules: [colruyt] });
  assert.equal(result.category, 'Groceries');
  assert.equal(result.id, 'bank-1');
  const pattern = rule('p', { conditions: [{ field: 'text', operator: 'matches', value: 'refund' }] });
  assert.equal(applySavedRules({ description: 'x', notes: 'Refund', category: '', amount: 1 }, { transactionRules: [pattern] }).category, 'Transport');
});

test('filing lookups, saving and clearing', () => {
  assert.equal(filingFor('COLRUYT', [colruyt])?.id, colruyt.id);
  assert.equal(filingFor('', [colruyt]), undefined);
  const added = setFiling([], 'delhaize', 'Delhaize', { category: 'Groceries' });
  assert.equal(added.length, 1);
  assert.equal(added[0].kind, 'always');
  const edited = setFiling(added, 'delhaize', 'Delhaize', { category: 'Food' });
  assert.equal(edited.length, 1);
  assert.equal(edited[0].actions[0].value, 'Food');
  assert.deepEqual(setFiling(edited, 'delhaize', 'Delhaize', {}), []);
});

test('merchants read their filing back in the old shape', () => {
  const merchants = { colruyt: { logo: 'colruyt.be' } as MerchantRule };
  const merged = withFiling(merchants, [colruyt, { ...alwaysFileRule('off', 'Off', { category: 'X' }), isActive: false }]);
  assert.equal(merged.colruyt.category, 'Groceries');
  assert.equal(merged.colruyt.defaultDescription, 'Food shop');
  assert.equal(merged.colruyt.logo, 'colruyt.be');
  assert.equal(merged.off, undefined);
});

test('round-ups go to the next whole unit', () => {
  assert.equal(spareChangeFor(-3.25), 0.75);
  assert.equal(spareChangeFor(-3), 0);
  assert.equal(spareChangeFor(-0.99), 0.01);
});

test('when a keyword rule detects a merchant, that merchant always-file rule supplies category and description', () => {
  const detectColruyt = rule('detect-colruyt', {
    conditions: [{ field: 'description', operator: 'contains', value: 'ETABLISSEMENTS FRANZ COLRUYT' }],
    actions: [{ field: 'merchant', value: 'Colruyt' }],
  });
  const result = applyRules(
    tx({ description: 'CARD PAYMENT ETABLISSEMENTS FRANZ COLRUYT HALLE', merchant: '' }),
    [detectColruyt, colruyt],
  );
  assert.equal(result.merchant, 'Colruyt');
  assert.equal(result.category, 'Groceries');
  assert.equal(result.description, 'Food shop');
  assert.equal(result.appliedRuleId, 'detect-colruyt');
  assert.equal(result.filingRuleId, colruyt.id);
});
