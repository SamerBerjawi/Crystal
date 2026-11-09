import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFinancialData, threeWayMerge } from '../../utils/threeWayMerge';
import { canUseDevCache } from '../../utils/browserCache';
import { readLocalDevSnapshot } from '../../hooks/useFinancialPersistence';

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

test('untouched here -> take theirs; untouched there -> take mine; plain lists -> mine; string ID order lists merge additions and deletions', () => {
  assert.deepEqual(threeWayMerge([1], [1], [2]), [2]);
  assert.deepEqual(threeWayMerge([1], [3], [1]), [3]);
  assert.deepEqual(threeWayMerge(['a'], ['a', 'b'], ['a', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(threeWayMerge(['a', 'b', 'c'], ['b', 'a', 'c'], ['a', 'c', 'd']), ['a', 'c', 'd']);
});

test('a missing base is treated as empty', () => {
  assert.deepEqual((threeWayMerge(undefined, [item('m')], [item('t')]) as any[]).map(i => i.id).sort(), ['m', 't']);
});

test('mergeFinancialData merges composite-key arrays (warrantHoldings, budgets, categoryRules) without last-writer-wins loss', () => {
  const base = {
    warrantHoldings: [
      { isin: 'BE0003796134', grantDate: '2025-01-15', name: 'Grant 2025', quantity: 100, grantPrice: 10 },
    ],
    budgets: [
      { category: 'Groceries', period: 'monthly', amount: 400, currency: 'EUR' },
    ],
    categoryRules: [
      { pattern: 'DELHAIZE', category: 'Groceries', isActive: true },
    ],
  };

  const mine = {
    warrantHoldings: [
      { isin: 'BE0003796134', grantDate: '2025-01-15', name: 'Grant 2025', quantity: 120, grantPrice: 10 }, // edited quantity
      { isin: 'BE0003796134', grantDate: '2026-01-15', name: 'Grant 2026', quantity: 50, grantPrice: 12 },  // added on Device A
    ],
    budgets: [
      { category: 'Groceries', period: 'monthly', amount: 450, currency: 'EUR' },                           // edited on Device A
      { category: 'Dining', period: 'monthly', amount: 200, currency: 'EUR' },                              // added on Device A
    ],
    categoryRules: [
      { pattern: 'DELHAIZE', category: 'Groceries', isActive: true, description: 'Supermarket' },           // edited on Device A
      { pattern: 'UBER', category: 'Transport', isActive: true },                                           // added on Device A
    ],
  };

  const theirs = {
    warrantHoldings: [
      { isin: 'BE0003796134', grantDate: '2025-01-15', name: 'Grant 2025 (Updated)', quantity: 100, grantPrice: 10 }, // edited name on Device B
      { isin: 'LU1234567890', grantDate: '2026-03-01', name: 'Lux Grant', quantity: 80, grantPrice: 15 },             // added on Device B
    ],
    budgets: [
      { category: 'Groceries', period: 'monthly', amount: 400, currency: 'EUR' },
      { category: 'Utilities', period: 'monthly', amount: 150, currency: 'EUR' },                                     // added on Device B
    ],
    categoryRules: [
      { pattern: 'DELHAIZE', category: 'Groceries', isActive: true },
      { pattern: 'NETFLIX', category: 'Subscriptions', isActive: true },                                              // added on Device B
    ],
  };

  const merged = mergeFinancialData<typeof mine>(base, mine, theirs);

  assert.equal(merged.warrantHoldings?.length, 3);
  const merged2025 = merged.warrantHoldings?.find(w => w.grantDate === '2025-01-15');
  assert.equal(merged2025?.quantity, 120);
  assert.equal(merged2025?.name, 'Grant 2025 (Updated)');
  assert.ok(merged.warrantHoldings?.some(w => w.isin === 'BE0003796134' && w.grantDate === '2026-01-15'));
  assert.ok(merged.warrantHoldings?.some(w => w.isin === 'LU1234567890' && w.grantDate === '2026-03-01'));

  assert.equal(merged.budgets?.length, 3);
  assert.equal(merged.budgets?.find(b => b.category === 'Groceries')?.amount, 450);
  assert.ok(merged.budgets?.some(b => b.category === 'Dining'));
  assert.ok(merged.budgets?.some(b => b.category === 'Utilities'));

  assert.equal(merged.categoryRules?.length, 3);
  assert.equal(merged.categoryRules?.find(r => r.pattern === 'DELHAIZE')?.description, 'Supermarket');
  assert.ok(merged.categoryRules?.some(r => r.pattern === 'UBER'));
  assert.ok(merged.categoryRules?.some(r => r.pattern === 'NETFLIX'));
});

test('canUseDevCache and readLocalDevSnapshot strictly gate access behind (isDevEnvironment || isDemoMode) && !isAuthenticated', () => {
  assert.equal(canUseDevCache({ isDevEnvironment: false, isDemoMode: false, isAuthenticated: false }), false);
  assert.equal(canUseDevCache({ isDevEnvironment: true, isDemoMode: false, isAuthenticated: true }), false);
  assert.equal(canUseDevCache({ isDevEnvironment: false, isDemoMode: true, isAuthenticated: true }), false);
  assert.equal(canUseDevCache({ isDevEnvironment: true, isDemoMode: false, isAuthenticated: false }), true);
  assert.equal(canUseDevCache({ isDevEnvironment: false, isDemoMode: true, isAuthenticated: false }), true);
  assert.equal(readLocalDevSnapshot({ isDevEnvironment: false, isDemoMode: false, isAuthenticated: false }), null);
  assert.equal(readLocalDevSnapshot({ isDevEnvironment: true, isDemoMode: true, isAuthenticated: true }), null);
});
