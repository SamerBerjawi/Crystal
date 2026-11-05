import type { Budget, Category, MerchantRule, RecurringTransaction, Transaction, TransactionRule } from '../types';

export interface CategoryRefactorScope {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  budgets: Budget[];
  merchantRules?: Record<string, MerchantRule>;
  transactionRules?: TransactionRule[];
}

export const findCategoryWithParent = (
  categories: Category[],
  id: string,
  parent?: Category,
): { category: Category; parent?: Category } | null => {
  for (const cat of categories) {
    if (cat.id === id) return { category: cat, parent };
    const found = findCategoryWithParent(cat.subCategories ?? [], id, cat);
    if (found) return found;
  }
  return null;
};

export const collectCategorySubtreeNames = (category: Category): Set<string> => {
  const names = new Set<string>([category.name]);
  const walk = (items: Category[]) => {
    items.forEach(item => {
      names.add(item.name);
      if (item.subCategories?.length) walk(item.subCategories);
    });
  };
  walk(category.subCategories ?? []);
  return names;
};

/**
 * Cascades a category rename (`oldName -> newName`) across transactions,
 * recurring transactions, budgets, merchant rules, and transaction rules.
 */
export const renameCategoryAcrossEntities = (
  oldName: string,
  newName: string,
  scope: CategoryRefactorScope,
): CategoryRefactorScope => {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();
  if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return scope;

  const transactions = scope.transactions.map(tx =>
    tx.category === trimmedOld ? { ...tx, category: trimmedNew } : tx
  );

  const recurringTransactions = scope.recurringTransactions.map(rt =>
    rt.category === trimmedOld ? { ...rt, category: trimmedNew } : rt
  );

  const budgets = scope.budgets.map(budget =>
    budget.categoryName === trimmedOld ? { ...budget, categoryName: trimmedNew } : budget
  );

  let merchantRules = scope.merchantRules;
  if (merchantRules) {
    const updatedRules: Record<string, MerchantRule> = {};
    let changed = false;
    for (const [key, rule] of Object.entries(merchantRules)) {
      if (rule.category === trimmedOld) {
        updatedRules[key] = { ...rule, category: trimmedNew };
        changed = true;
      } else {
        updatedRules[key] = rule;
      }
    }
    if (changed) merchantRules = updatedRules;
  }

  let transactionRules = scope.transactionRules;
  if (transactionRules) {
    transactionRules = transactionRules.map(rule => {
      const hasActionMatch = rule.actions.some(a => a.field === 'category' && a.value === trimmedOld);
      const hasConditionMatch = rule.conditions.some(c => c.field === 'category' && c.value === trimmedOld);
      if (!hasActionMatch && !hasConditionMatch) return rule;
      return {
        ...rule,
        conditions: rule.conditions.map(c =>
          c.field === 'category' && c.value === trimmedOld ? { ...c, value: trimmedNew } : c
        ),
        actions: rule.actions.map(a =>
          a.field === 'category' && a.value === trimmedOld ? { ...a, value: trimmedNew } : a
        ),
      };
    });
  }

  return {
    transactions,
    recurringTransactions,
    budgets,
    merchantRules,
    transactionRules,
  };
};

/**
 * Reassigns all transactions, recurring items, and rules that reference a deleted
 * category (or any of its descendant subcategories) to `fallbackCategory` (e.g., parent category name or `'Uncategorized'`).
 */
export const reassignDeletedCategoryAcrossEntities = (
  deletedCategory: Category,
  fallbackCategory: string,
  scope: CategoryRefactorScope,
): CategoryRefactorScope => {
  const deletedNames = collectCategorySubtreeNames(deletedCategory);
  const fallback = fallbackCategory.trim() || 'Uncategorized';

  const transactions = scope.transactions.map(tx =>
    deletedNames.has(tx.category) ? { ...tx, category: fallback } : tx
  );

  const recurringTransactions = scope.recurringTransactions.map(rt =>
    rt.category && deletedNames.has(rt.category) ? { ...rt, category: fallback } : rt
  );

  const budgets = scope.budgets.filter(budget => !deletedNames.has(budget.categoryName));

  let merchantRules = scope.merchantRules;
  if (merchantRules) {
    const updatedRules: Record<string, MerchantRule> = {};
    let changed = false;
    for (const [key, rule] of Object.entries(merchantRules)) {
      if (rule.category && deletedNames.has(rule.category)) {
        updatedRules[key] = { ...rule, category: fallback === 'Uncategorized' ? undefined : fallback };
        changed = true;
      } else {
        updatedRules[key] = rule;
      }
    }
    if (changed) merchantRules = updatedRules;
  }

  let transactionRules = scope.transactionRules;
  if (transactionRules) {
    transactionRules = transactionRules.map(rule => {
      const hasActionMatch = rule.actions.some(a => a.field === 'category' && deletedNames.has(a.value));
      if (!hasActionMatch) return rule;
      return {
        ...rule,
        actions: rule.actions.map(a =>
          a.field === 'category' && deletedNames.has(a.value) ? { ...a, value: fallback } : a
        ),
      };
    });
  }

  return {
    transactions,
    recurringTransactions,
    budgets,
    merchantRules,
    transactionRules,
  };
};
