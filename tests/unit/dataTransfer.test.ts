import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRestore, buildCsvExports, buildJsonExport, ExportSource } from '../../utils/dataTransfer';

const source = {
  accounts: [{ id: 'a' }, { id: 'b' }],
  transactions: [{ id: '1', accountId: 'a', date: '2026-01-10' }, { id: '2', accountId: 'b', date: '2026-02-10' }],
  budgets: [],
  recurringTransactions: [{ id: 'r' }],
  allCategories: [{ id: 'c', classification: 'income' }, { id: 'd', classification: 'expense' }],
  fullFinancialData: { billsAndPayments: [{ id: 'bill' }], tags: [], investmentTransactions: [], priceHistory: { X: [] } },
} as unknown as ExportSource;

test('the JSON export holds only the chosen data', () => {
  const data = buildJsonExport({ format: 'json', dataTypes: ['categories', 'investments'] }, source);
  assert.deepEqual(Object.keys(data).sort(), ['expenseCategories', 'incomeCategories', 'investmentTransactions', 'manualWarrantPrices', 'priceHistory', 'warrants']);
});

test('date and account filters narrow transactions, and accounts follow the account filter', () => {
  const dated = buildJsonExport({ format: 'json', dataTypes: ['transactions'], dateRange: { start: '2026-02-01', end: '2026-02-28' } }, source);
  assert.deepEqual((dated.transactions as any[]).map(item => item.id), ['2']);
  const byAccount = buildJsonExport({ format: 'json', dataTypes: ['transactions', 'accounts'], accountIds: ['a'] }, source);
  assert.deepEqual((byAccount.transactions as any[]).map(item => item.id), ['1']);
  assert.deepEqual((byAccount.accounts as any[]).map(item => item.id), ['a']);
});

test('CSV leaves out empty tables and types with no table', () => {
  const tables = buildCsvExports({ format: 'csv', dataTypes: ['schedule', 'tags', 'preferences'] }, source);
  assert.deepEqual(tables.map(table => table.type), ['schedule']);
  assert.equal(tables[0].rows.length, 2);
});

test('restore merges by id, replaces on request and leaves other sections alone', () => {
  const current = { tags: [{ id: '1', name: 'old' }], tasks: [{ id: 't' }], preferences: { currency: 'EUR', country: 'BE' } } as any;
  const merged = applyRestore(current, { tags: [{ id: '1', name: 'new' }, { id: '2', name: 'added' }] } as any, { tags: 'merge' });
  assert.deepEqual(merged.tags.map((tag: any) => tag.name), ['old', 'added']);
  assert.equal(merged.tasks, current.tasks);

  const replaced = applyRestore(current, { tags: [{ id: '9' }] } as any, { tags: 'replace' });
  assert.deepEqual(replaced.tags, [{ id: '9' }]);

  const prefs = applyRestore(current, { preferences: { currency: 'USD' } } as any, {});
  assert.deepEqual(prefs.preferences, { currency: 'USD', country: 'BE' });
});
