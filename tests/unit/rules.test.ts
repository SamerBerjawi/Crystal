import test from 'node:test';
import assert from 'node:assert/strict';
import { applySavedRules, spareChangeFor } from '../../utils/rules';
import { MerchantRule, RegexCategorizationRule } from '../../types';

const regex = (pattern: string, category: string, isActive = true) => ({ id: pattern, pattern, category, isActive }) as unknown as RegexCategorizationRule;

test('a bank record with an id still takes its merchant category', () => {
  const merchantRules = { colruyt: { category: 'Groceries' } } as unknown as Record<string, MerchantRule>;
  const result = applySavedRules({ id: 'bank-1', merchant: 'Colruyt', description: 'Card payment', category: '', amount: -20, type: 'expense' }, { merchantRules });
  assert.equal(result.category, 'Groceries');
  assert.equal(result.id, 'bank-1');
});

test('a merchant category beats a regex rule', () => {
  const merchantRules = { colruyt: { category: 'Groceries' } } as unknown as Record<string, MerchantRule>;
  const result = applySavedRules({ merchant: 'Colruyt', description: 'x', category: '', amount: -1 }, { merchantRules, regexCategorizationRules: [regex('colruyt', 'Eating out')] });
  assert.equal(result.category, 'Groceries');
});

test('regex rules fill in without a merchant rule, first match wins, inactive and broken ones are skipped', () => {
  const rules = { regexCategorizationRules: [regex('(', 'Broken'), regex('uber', 'Off', false), regex('uber', 'Transport'), regex('ub', 'Other')] };
  assert.equal(applySavedRules({ description: 'UBER trip', category: '', amount: -9 }, rules).category, 'Transport');
});

test('round-ups go to the next whole unit', () => {
  assert.equal(spareChangeFor(-3.25), 0.75);
  assert.equal(spareChangeFor(-3), 0);
  assert.equal(spareChangeFor(-0.99), 0.01);
});
