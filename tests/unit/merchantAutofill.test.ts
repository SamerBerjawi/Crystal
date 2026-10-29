import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MerchantRule, Transaction } from '../../types';
import {
  emptyLocation, isBranch, locationFromBranch, locationLine, matchMerchants, merchantAutofill, merchantBranches, merchantPool, merchantRuleFor, type AutofillField,
} from '../../utils/transactionsModel';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', accountId: 'a1', date: '2026-10-10', description: '', amount: -10, category: 'Food', type: 'expense', currency: 'EUR', ...over,
});

const transactions: Transaction[] = [
  tx({ id: '1', merchant: 'Lidl', date: '2026-10-01', category: 'Groceries' }),
  tx({ id: '2', merchant: 'lidl', date: '2026-10-12', category: 'Groceries' }),
  tx({ id: '3', merchant: 'Delhaize', date: '2026-10-20', category: 'Groceries' }),
  tx({ id: '4', merchant: 'Delhaize', date: '2026-09-02' }),
  tx({ id: '5', merchant: 'Shell', date: '2026-10-15', category: 'Fuel' }),
  tx({ id: '6', merchant: 'ACME Corp', type: 'income', amount: 3000, category: 'Salary' }),
  tx({ id: '7', merchant: 'Internal Transfer', transferId: 'x1' }),
  tx({ id: '8', merchant: 'Le Pain Quotidien', date: '2026-08-01', category: 'Restaurants' }),
];

const rules: Record<string, MerchantRule> = {
  ikea: {
    category: 'Home', defaultDescription: 'Furniture',
    locations: [
      { id: 'b1', label: 'Anderlecht', address: 'Boulevard Industriel 1, Anderlecht', city: 'Anderlecht', country: 'Belgium' },
      { id: 'b2', label: 'Zaventem', address: 'Weiveldlaan 19, Zaventem', city: 'Zaventem', country: 'Belgium', isPrimary: true },
    ],
  },
  lidl: { category: 'Supermarket' },
  shell: { address: 'Rue Royale 1, Brussels', placeName: 'Shell Royale', city: 'Brussels', country: 'Belgium' },
};

const none = new Set<AutofillField>();

test('the pool merges past and saved merchants, most used then most recent, without transfers or other kinds', () => {
  const pool = merchantPool(transactions, rules, 'expense');
  assert.deepEqual(pool.map(s => s.name), ['Delhaize', 'lidl', 'Shell', 'Le Pain Quotidien', 'Ikea']);
  const lidl = pool[1];
  assert.equal(lidl.count, 2);
  assert.equal(lidl.lastDate, '2026-10-12');
  assert.equal(lidl.category, 'Supermarket', 'a saved category wins over the last used one');
  assert.equal(lidl.saved, true);
  assert.equal(pool.find(s => s.name === 'Delhaize')?.category, 'Groceries');
  assert.ok(!pool.some(s => s.name === 'Internal Transfer'));
  assert.ok(!pool.some(s => s.name === 'ACME Corp'));
  assert.deepEqual(merchantPool(transactions, {}, 'income').map(s => s.name), ['ACME Corp']);
});

test('a saved merchant with no transactions is named from its place name when it matches', () => {
  const pool = merchantPool([], { 'pain quotidien': { placeName: 'Pain Quotidien' }, 'h&m': {} });
  assert.deepEqual(pool.map(s => s.name).sort(), ['H&M', 'Pain Quotidien']);
});

test('matches rank exact, prefix, word start, then contains; nothing typed gives the top', () => {
  const pool = merchantPool(transactions, rules, 'expense');
  assert.deepEqual(matchMerchants(pool, 'LIDL').map(s => s.name), ['lidl']);
  assert.deepEqual(matchMerchants(pool, 'pain').map(s => s.name), ['Le Pain Quotidien']);
  assert.deepEqual(matchMerchants(pool, 'e').map(s => s.name), ['Delhaize', 'Shell', 'Le Pain Quotidien', 'Ikea']);
  const ranked = merchantPool([
    tx({ id: 'a', merchant: 'Big Shop' }), tx({ id: 'b', merchant: 'Bshop' }), tx({ id: 'c', merchant: 'Shopping' }), tx({ id: 'd', merchant: 'Shop' }),
  ]);
  assert.deepEqual(matchMerchants(ranked, 'shop').map(s => s.name), ['Shop', 'Shopping', 'Big Shop', 'Bshop']);
  assert.deepEqual(matchMerchants(pool, 'zz'), []);
  assert.equal(matchMerchants(pool, '  ', 2).length, 2);
});

test('rules are found by the normalized name', () => {
  assert.equal(merchantRuleFor(rules, '  IKEA ')?.category, 'Home');
  assert.equal(merchantRuleFor(rules, 'Ikeaa'), undefined);
  assert.equal(merchantRuleFor(undefined, 'Ikea'), undefined);
});

test('branches put the primary first; a single address becomes one branch', () => {
  assert.deepEqual(merchantBranches(rules.ikea).map(b => b.id), ['b2', 'b1']);
  const [shell] = merchantBranches(rules.shell);
  assert.equal(shell.address, 'Rue Royale 1, Brussels');
  assert.equal(locationFromBranch(shell).label, 'Shell Royale');
  assert.deepEqual(merchantBranches(rules.lidl), []);
  assert.deepEqual(merchantBranches(undefined), []);
  assert.ok(isBranch(locationFromBranch(rules.ikea.locations![0]), rules.ikea.locations![0]));
  assert.ok(!isBranch(locationFromBranch(rules.ikea.locations![0]), rules.ikea.locations![1]));
});

test('autofill fills category, description and the primary branch', () => {
  const { patch, filled } = merchantAutofill(rules.ikea, { edited: none, filled: none });
  assert.equal(patch.category, 'Home');
  assert.equal(patch.description, 'Furniture');
  assert.equal(patch.location?.city, 'Zaventem');
  assert.equal(patch.location?.label, 'Zaventem');
  assert.deepEqual([...filled].sort(), ['category', 'description', 'location']);
});

test('autofill never touches a field the user edited', () => {
  const { patch, filled } = merchantAutofill(rules.ikea, { edited: new Set<AutofillField>(['category', 'location']), filled: none });
  assert.deepEqual(Object.keys(patch), ['description']);
  assert.deepEqual([...filled], ['description']);
});

test('switching merchant replaces what the last one filled and clears what this one lacks', () => {
  const first = merchantAutofill(rules.ikea, { edited: none, filled: none });
  const { patch, filled } = merchantAutofill(rules.lidl, { edited: none, filled: first.filled });
  assert.equal(patch.category, 'Supermarket');
  assert.equal(patch.description, '');
  assert.deepEqual(patch.location, emptyLocation());
  assert.deepEqual([...filled], ['category']);
  // No rule at all: only what was filled is cleared; nothing else is touched.
  assert.deepEqual(merchantAutofill(undefined, { edited: none, filled: new Set<AutofillField>(['category']) }).patch, { category: '' });
  assert.deepEqual(merchantAutofill(undefined, { edited: none, filled: none }).patch, {});
});

test('a category of the other kind is left out', () => {
  const { patch } = merchantAutofill(rules.ikea, { edited: none, filled: none }, name => name !== 'Home');
  assert.equal(patch.category, undefined);
  assert.equal(patch.description, 'Furniture');
});

test('a location line does not repeat a branch named after its city', () => {
  assert.equal(locationLine({ place: 'Mons', city: 'mons', country: 'Belgium' }), 'Mons, Belgium');
  assert.equal(locationLine({ place: 'IKEA', city: 'Mons', country: 'Belgium' }), 'IKEA, Mons, Belgium');
  assert.equal(locationLine({ city: ' ', country: 'Belgium' }), 'Belgium');
});
