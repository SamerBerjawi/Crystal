import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Budget, Category, Transaction } from '../../types';
import {
  autoMapImportColumns,
  buildImportPublishPayload,
  buildInitialImportEntityMaps,
  processConfiguredImportData,
} from '../../utils/importWizardModel';
import {
  buildCategoryColorMap,
  buildDisplayItemsWithSubs,
  buildDisplayTransactions,
  buildLedgerTableRenderItems,
  computeLedgerSummaryTotals,
  indexDisplayTransactions,
  sortLedgerTransactions,
} from '../../utils/transactionsLedgerModel';
import {
  buildGroupedCategoriesForDetail,
  computeCategoryBudgetInsight,
  filterCategoryGroupsForDetail,
  resolveSpareChangeAmount,
} from '../../utils/transactionDetailModel';
import {
  buildAssetAllocationData,
  computeAdvancedNextDueDate,
  computeKeyRatioGauges,
  computeMonthFlow,
  computeOutflowsByCategory,
  computePeriodAggregate,
  mapHistoricalDurationToForecast,
} from '../../utils/dashboardModel';

const mockAccounts: Account[] = [
  { id: 'acc-1', name: 'Main Checking', type: 'Checking', balance: 5000, currency: 'EUR', status: 'open' },
  { id: 'acc-2', name: 'Savings Vault', type: 'Savings', balance: 10000, currency: 'EUR', status: 'open' },
];

const mockCategories: Category[] = [
  {
    id: 'cat-food',
    name: 'Food & Dining',
    color: '#ef4444',
    icon: 'restaurant',
    classification: 'expense',
    subCategories: [
      { id: 'cat-groceries', name: 'Groceries', parentId: 'cat-food', color: '#ef4444', classification: 'expense', subCategories: [] },
      { id: 'cat-coffee', name: 'Coffee Shops', parentId: 'cat-food', color: '#ef4444', classification: 'expense', subCategories: [] },
    ],
  },
];

test('importWizardModel: autoMapImportColumns maps multilingual and standard headers', () => {
  const mapped = autoMapImportColumns(['Buchungsdatum', 'Betrag', 'Verwendungszweck / Merchant', 'Kategorie', 'Währung'], 'transactions');
  assert.equal(mapped.date, 'Buchungsdatum');
  assert.equal(mapped.amount, 'Betrag');
  assert.equal(mapped.category, 'Kategorie');
  assert.equal(mapped.currency, 'Währung');
});

test('importWizardModel: processConfiguredImportData normalizes European & accounting amounts and builds publish payload', () => {
  const parsedData = [
    { Date: '2026-03-15', Amount: '-1.234,56 €', Payee: 'Supermarket', Category: 'Groceries', Currency: 'EUR' },
    { Date: '2026-03-16', Amount: '(45.50)', Payee: 'Bakery', Category: 'NewCat', Currency: 'EUR' },
    { Date: 'invalid-date', Amount: '10.00', Payee: 'Bad Row', Category: 'Groceries', Currency: 'EUR' },
  ];
  const columnMap = { date: 'Date', amount: 'Amount', name: 'Payee', category: 'Category', currency: 'Currency' };

  const { cleaned, errors } = processConfiguredImportData({
    parsedData,
    columnMap,
    importType: 'transactions',
    dateFormat: 'YYYY-MM-DD',
    amountConfig: 'single_signed',
    accountSource: 'single',
    selectedSingleAccountId: 'acc-1',
    existingAccounts: mockAccounts,
  });

  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].amount, -1234.56);
  assert.equal(cleaned[1].amount, -45.5);
  assert.ok(errors[2]?.date);

  const maps = buildInitialImportEntityMaps({
    cleanedData: cleaned,
    excludedRows: new Set(),
    importType: 'transactions',
    accountSource: 'single',
    allCategories: mockCategories,
    existingAccounts: mockAccounts,
  });
  assert.equal(maps.categoryMap['Groceries'], 'Groceries');
  assert.equal(maps.categoryMap['NewCat'], '_CREATE_NEW_:NewCat');

  const { dataToPublish } = buildImportPublishPayload({
    importType: 'transactions',
    accountSource: 'single',
    cleanedData: cleaned,
    excludedRows: new Set(),
    ...maps,
  });
  assert.equal(dataToPublish.length, 2);
  assert.equal(dataToPublish[0].amount, -1234.56);
  assert.equal(dataToPublish[0].category, 'Groceries');
  assert.equal(dataToPublish[1].category, 'NewCat');
});

test('transactionsLedgerModel: pairs transfers, attaches spare change, and computes summary totals', () => {
  const txs: Transaction[] = [
    { id: 'tx-1', accountId: 'acc-1', date: '2026-03-10', description: 'Coffee', merchant: 'Cafe', amount: -4.2, category: 'Coffee Shops', type: 'expense', currency: 'EUR' },
    { id: 'tx-spare', accountId: 'acc-1', date: '2026-03-10', description: 'Spare change for Coffee', amount: -0.8, category: 'Transfer', type: 'expense', currency: 'EUR', transferId: 'spare-tx-1' },
    { id: 'tx-tr-out', accountId: 'acc-1', date: '2026-03-11', description: 'Move to savings', amount: -500, category: 'Transfer', type: 'expense', currency: 'EUR', transferId: 'tr-100' },
    { id: 'tx-tr-in', accountId: 'acc-2', date: '2026-03-11', description: 'Move to savings', amount: 500, category: 'Transfer', type: 'income', currency: 'EUR', transferId: 'tr-100' },
    { id: 'tx-inc', accountId: 'acc-1', date: '2026-03-12', description: 'Salary', amount: 3000, category: 'Salary', type: 'income', currency: 'EUR' },
  ];
  const accountMap = { 'acc-1': mockAccounts[0], 'acc-2': mockAccounts[1] };

  const display = buildDisplayTransactions(txs, accountMap, mockAccounts);
  // Spare change leg is folded into tx-1; transfer pair is collapsed into 1 row => 3 display rows total
  assert.equal(display.length, 3);
  const coffee = display.find(d => d.id === 'tx-1');
  assert.equal(coffee?.spareChangeAmount, 0.8);

  const summary = computeLedgerSummaryTotals(display);
  assert.equal(summary.totalIncome, 3000);
  assert.equal(summary.totalExpense, 4.2);
  assert.equal(summary.netFlow, 2995.8);

  const indexed = indexDisplayTransactions(display);
  assert.equal(indexed.length, 3);

  const sortedAsc = sortLedgerTransactions(display, { column: 'date', direction: 'ascending' }, accountMap, {});
  assert.equal(sortedAsc[0].id, 'tx-1');

  const withSubs = buildDisplayItemsWithSubs(sortedAsc, new Set(), false);
  const renderItems = buildLedgerTableRenderItems(withSubs, [], t => ({ amount: t.amount, currency: t.currency }));
  // 3 distinct dates => 3 group headers + 3 transaction rows = 6 items
  assert.equal(renderItems.length, 6);

  const colors = buildCategoryColorMap(mockCategories);
  assert.equal(colors['Groceries'], '#ef4444');
});

test('transactionDetailModel: groups categories, filters by search, resolves spare change, and computes budget insight', () => {
  const groups = buildGroupedCategoriesForDetail('expense', [], mockCategories);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, 'Food & Dining');
  assert.equal(groups[0].items.length, 3);

  const filtered = filterCategoryGroupsForDetail(groups, 'coffee');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].items.length, 1);
  assert.equal(filtered[0].items[0].id, 'Coffee Shops');

  const tx: Transaction = {
    id: 'tx-10',
    accountId: 'acc-1',
    date: '2026-03-10',
    description: 'Dinner',
    amount: -80,
    category: 'Food & Dining',
    type: 'expense',
    currency: 'EUR',
  };
  const spareLeg: Transaction = {
    id: 'tx-10-spare',
    accountId: 'acc-1',
    date: '2026-03-10',
    description: 'Round up',
    amount: -0.5,
    category: 'Transfer',
    type: 'expense',
    currency: 'EUR',
    transferId: 'spare-tx-10',
  };
  assert.equal(resolveSpareChangeAmount(tx, [tx, spareLeg]), 0.5);

  const budgets: Budget[] = [{ id: 'b-1', categoryName: 'Food & Dining', amount: 200, currency: 'EUR', period: 'monthly' }];
  const insight = computeCategoryBudgetInsight(tx, false, [tx], budgets);
  assert.deepEqual(insight, { spent: 80, limit: 200, pct: 40 });
});

test('dashboardModel: computes period aggregates, category outflows, due date advances, and key ratio gauges', () => {
  assert.equal(mapHistoricalDurationToForecast('30D'), '3M');
  assert.equal(mapHistoricalDurationToForecast('6M'), '6M');
  assert.equal(mapHistoricalDurationToForecast('1Y'), '1Y');

  const nextDue = computeAdvancedNextDueDate(
    {
      id: 'rt-1',
      accountId: 'acc-1',
      description: 'Rent',
      amount: -1000,
      category: 'Housing',
      type: 'expense',
      currency: 'EUR',
      frequency: 'monthly',
      startDate: '2026-01-31',
      nextDueDate: '2026-01-31',
      dueDateOfMonth: 31,
      weekendAdjustment: 'on',
    },
    '2026-01-31'
  );
  // Feb 2026 has 28 days, so advancing monthly from Jan 31 clamps to Feb 28
  assert.equal(nextDue, '2026-02-28');

  const todayIso = new Date().toISOString().slice(0, 10);
  const txs: Transaction[] = [
    { id: 't1', accountId: 'acc-1', date: todayIso, description: 'Paycheck', amount: 2500, category: 'Salary', type: 'income', currency: 'EUR' },
    { id: 't2', accountId: 'acc-1', date: todayIso, description: 'Supermarket', amount: -150, category: 'Groceries', type: 'expense', currency: 'EUR' },
  ];

  const flow = computeMonthFlow(txs);
  assert.equal(flow.income, 2500);
  assert.equal(flow.spending, 150);

  const agg = computePeriodAggregate({
    duration: 'ALL',
    analyticsTransactions: txs,
    analyticsSelectedAccountIds: ['acc-1'],
    transferLookup: new Map(),
  });
  assert.equal(agg.income, 2500);
  assert.equal(agg.expenses, 150);

  const outflows = computeOutflowsByCategory({
    enrichedTransactions: txs.map(t => ({ ...t, convertedAmount: t.amount, parsedDate: new Date(t.date) })),
    analyticsSelectedAccountIds: ['acc-1'],
    expenseCategories: mockCategories,
    transferLookup: new Map(),
    accountLookup: new Map(mockAccounts.map(a => [a.id, a])),
  });
  // Groceries rolls up to its parent category 'Food & Dining'
  assert.equal(outflows.length, 1);
  assert.equal(outflows[0].name, 'Food & Dining');
  assert.equal(outflows[0].value, 150);

  const alloc = buildAssetAllocationData({
    'Liquid Cash': { types: ['Checking', 'Savings'], value: 15000, color: 'var(--chart-1)', icon: 'wallet' },
  });
  assert.equal(alloc.length, 1);
  assert.equal(alloc[0].value, 15000);

  const gauges = computeKeyRatioGauges(mockAccounts, txs, 8, 25);
  assert.equal(gauges.runway.status, 'Healthy');
  assert.equal(gauges.saving.status, 'On track');
  assert.equal(gauges.owing.status, 'Low');
});
