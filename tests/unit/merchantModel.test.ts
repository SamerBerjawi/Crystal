import test from 'node:test';
import assert from 'node:assert/strict';
import { MerchantLocation, Transaction, TransactionRule } from '../../types';
import { branchesOf, keywordRulesFor, newKeywordRule, primaryBranch, removeBranch, transactionsAtBranch, transactionsWithKeyword, withBranches } from '../../utils/merchantModel';

const branch = (id: string, extra: Partial<MerchantLocation> = {}): MerchantLocation => ({ id, address: `${id} street`, ...extra });

const tx = (id: string, merchant: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, accountId: 'a', date: '2026-01-01', description: 'card payment', merchant, amount: -5, category: 'Food', type: 'expense', currency: 'EUR', ...extra,
});

test('branchesOf prefers the list and falls back to the address on the rule', () => {
  const list = [branch('one')];
  assert.deepEqual(branchesOf({ locations: list, address: 'old' }), list);
  const [main] = branchesOf({ address: 'Rue 1', placeName: 'Store', latitude: 1, longitude: 2 });
  assert.equal(main.label, 'Store');
  assert.equal(main.isPrimary, true);
  assert.deepEqual(branchesOf({ category: 'Food' }), []);
  assert.deepEqual(branchesOf(undefined), []);
});

test('removing the primary branch promotes the next without changing the old list', () => {
  const list = [branch('one', { isPrimary: true }), branch('two'), branch('three')];
  const left = removeBranch(list, 'one');
  assert.equal(primaryBranch(left).id, 'two');
  assert.equal(left[0].isPrimary, true);
  assert.equal(list[1].isPrimary, undefined);
  assert.deepEqual(removeBranch(list, 'two').map(item => item.id), ['one', 'three']);
  assert.deepEqual(removeBranch([branch('one')], 'one'), []);
});

test('withBranches copies the primary onto the rule and clears it when none are left', () => {
  const rule = withBranches({ notes: 'keep' }, [branch('one'), branch('two', { isPrimary: true, city: 'Ghent' })]);
  assert.equal(rule.address, 'two street');
  assert.equal(rule.city, 'Ghent');
  assert.equal(rule.notes, 'keep');
  const cleared = withBranches(rule, []);
  assert.equal(cleared.locations, undefined);
  assert.equal(cleared.address, undefined);
});

test('transactionsAtBranch only touches this merchant and keeps fields the branch lacks', () => {
  const list = [tx('a', 'Delhaize', { postalCode: '1000', latitude: 9 }), tx('b', 'Colruyt')];
  const updated = transactionsAtBranch(list, 'delhaize', 'Delhaize', branch('one', { city: 'Ghent', label: 'Sablon' }));
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, 'a');
  assert.equal(updated[0].city, 'Ghent');
  assert.equal(updated[0].postalCode, '1000');
  assert.equal(updated[0].latitude, 9);
  assert.equal(updated[0].locationLabel, 'Sablon');
});

test('keywordRulesFor leaves out the always file rule', () => {
  const keyword = newKeywordRule('Uber', 'UBER *EATS');
  const always: TransactionRule = { ...newKeywordRule('Uber', 'uber'), id: 'always', kind: 'always' };
  const other = newKeywordRule('Bolt', 'BOLT');
  assert.deepEqual(keywordRulesFor([keyword, always, other], 'uber').map(rule => rule.id), [keyword.id]);
  assert.deepEqual(keywordRulesFor(undefined, 'uber'), []);
});

test('newKeywordRule only sets the filing it was given', () => {
  assert.deepEqual(newKeywordRule('Uber', 'x').actions.map(action => action.field), ['merchant']);
  assert.deepEqual(newKeywordRule('Uber', 'x', 'Transport', 'Ride').actions.map(action => action.field), ['merchant', 'category', 'description']);
});

test('transactionsWithKeyword looks in the description and merchant, and ignores blanks', () => {
  const list = [tx('a', 'Uber', { description: 'trip' }), tx('b', 'Other', { description: 'UBER *EATS' }), tx('c', 'Other')];
  assert.deepEqual(transactionsWithKeyword(list, ' uber ').map(item => item.id), ['a', 'b']);
  assert.deepEqual(transactionsWithKeyword(list, '  '), []);
});
