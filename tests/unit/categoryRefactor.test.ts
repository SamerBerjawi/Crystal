import test from 'node:test';
import assert from 'node:assert/strict';
import type { Budget, Category, MerchantRule, RecurringTransaction, Transaction, TransactionRule } from '../../types';
import {
  collectCategorySubtreeNames,
  findCategoryWithParent,
  reassignDeletedCategoryAcrossEntities,
  renameCategoryAcrossEntities,
} from '../../utils/categoryRefactor';

const sampleTree: Category[] = [
  {
    id: 'cat-food',
    name: 'Food & Dining',
    color: '#ef4444',
    icon: 'restaurant',
    classification: 'expense',
    subCategories: [
      {
        id: 'cat-coffee',
        name: 'Coffee Shops',
        color: '#ef4444',
        icon: 'coffee',
        classification: 'expense',
        subCategories: [],
      },
    ],
  },
];

test('findCategoryWithParent locates nested subcategory and its parent', () => {
  const found = findCategoryWithParent(sampleTree, 'cat-coffee');
  assert.ok(found);
  assert.equal(found.category.name, 'Coffee Shops');
  assert.equal(found.parent?.name, 'Food & Dining');
  assert.deepEqual([...collectCategorySubtreeNames(sampleTree[0])], ['Food & Dining', 'Coffee Shops']);
});

test('renameCategoryAcrossEntities cascades category rename across all financial entities', () => {
  const transactions: Transaction[] = [
    {
      id: 't1',
      accountId: 'a1',
      date: '2026-05-01',
      description: 'Latte',
      amount: -4.5,
      category: 'Coffee Shops',
      type: 'expense',
      currency: 'EUR',
    },
    {
      id: 's1',
      accountId: 'a1',
      date: '2026-05-01',
      description: 'Espresso split child',
      amount: -2.5,
      category: 'Coffee Shops',
      type: 'expense',
      currency: 'EUR',
      parentTransactionId: 't1',
    },
  ];
  const recurringTransactions: RecurringTransaction[] = [
    {
      id: 'r1',
      accountId: 'a1',
      description: 'Coffee Bean Sub',
      amount: 19,
      category: 'Coffee Shops',
      type: 'expense',
      currency: 'EUR',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextDueDate: '2026-06-01',
      weekendAdjustment: 'on',
    },
  ];
  const budgets: Budget[] = [
    { id: 'b1', categoryName: 'Coffee Shops', amount: 50, currency: 'EUR', period: 'monthly' },
  ];
  const merchantRules: Record<string, MerchantRule> = {
    starbucks: { category: 'Coffee Shops' },
  };
  const transactionRules: TransactionRule[] = [
    {
      id: 'rule-1',
      name: 'Coffee rule',
      isActive: true,
      conditionLogic: 'AND',
      conditions: [{ field: 'category', operator: 'equals', value: 'Coffee Shops' }],
      actions: [{ field: 'category', value: 'Coffee Shops' }],
    },
  ];

  const updated = renameCategoryAcrossEntities('Coffee Shops', 'Cafés', {
    transactions,
    recurringTransactions,
    budgets,
    merchantRules,
    transactionRules,
  });

  assert.equal(updated.transactions[0].category, 'Cafés');
  assert.equal(updated.transactions[1].category, 'Cafés');
  assert.equal(updated.recurringTransactions[0].category, 'Cafés');
  assert.equal(updated.budgets[0].categoryName, 'Cafés');
  assert.equal(updated.merchantRules?.starbucks.category, 'Cafés');
  assert.equal(updated.transactionRules?.[0].conditions[0].value, 'Cafés');
  assert.equal(updated.transactionRules?.[0].actions[0].value, 'Cafés');
});

test('reassignDeletedCategoryAcrossEntities reassigns subtree categories to fallback and removes orphaned budgets', () => {
  const transactions: Transaction[] = [
    {
      id: 't1',
      accountId: 'a1',
      date: '2026-05-01',
      description: 'Dinner',
      amount: -45,
      category: 'Food & Dining',
      type: 'expense',
      currency: 'EUR',
    },
    {
      id: 't2',
      accountId: 'a1',
      date: '2026-05-02',
      description: 'Latte',
      amount: -4.5,
      category: 'Coffee Shops',
      type: 'expense',
      currency: 'EUR',
    },
  ];
  const budgets: Budget[] = [
    { id: 'b1', categoryName: 'Food & Dining', amount: 400, currency: 'EUR', period: 'monthly' },
    { id: 'b2', categoryName: 'Housing', amount: 1200, currency: 'EUR', period: 'monthly' },
  ];

  const updated = reassignDeletedCategoryAcrossEntities(sampleTree[0], 'Uncategorized', {
    transactions,
    recurringTransactions: [],
    budgets,
  });

  assert.equal(updated.transactions[0].category, 'Uncategorized');
  assert.equal(updated.transactions[1].category, 'Uncategorized');
  assert.deepEqual(updated.budgets.map(b => b.categoryName), ['Housing']);
});
