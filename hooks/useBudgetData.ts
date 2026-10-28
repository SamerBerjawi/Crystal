import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Budget, Category, Currency } from '../types';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext } from '../contexts/FinancialDataContext';
import { convertCurrency, normalizeCurrency } from '../utils';
import {
  autofillPlan, averageMonthlySpend, budgetAccountIds, budgetSuggestions, goalViews, monthBounds, spendByCategory,
  type BudgetDraft, type Month,
} from '../utils/budgetModel';

/*
 * Data and writes for BudgetNew (UI_UX_DESIGN_REFERENCE.md D13). Writes return an `undo` where one makes sense, so
 * the page can offer it in a toast (D6). Deleting goes through the app's own handler, which already toasts an Undo.
 */

export interface CategoryLook { color: string; icon?: string }

export const useBudgetData = () => {
  const { budgets, saveBudget, deleteBudget } = useBudgetsContext();
  const { financialGoals } = useGoalsContext();
  const { transactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { preferences } = usePreferencesContext();
  const { expenseCategories } = useCategoryContext();

  const displayCurrency = normalizeCurrency(preferences.displayCurrency || preferences.currency || 'EUR');
  const convert = useCallback((amount: number, currency: Currency) => convertCurrency(amount, currency, displayCurrency), [displayCurrency]);
  const accountIds = useMemo(() => budgetAccountIds(accounts), [accounts]);
  const options = useMemo(() => ({ accountIds, categories: expenseCategories, convert }), [accountIds, expenseCategories, convert]);

  /** Top-level expense categories: budgets are set on these. */
  const parents = useMemo<Category[]>(() => [...expenseCategories].sort((a, b) => a.name.localeCompare(b.name)), [expenseCategories]);
  const lookOf = useCallback((name: string): CategoryLook | undefined => {
    const c = expenseCategories.find(x => x.name === name);
    return c ? { color: c.color, icon: c.icon } : undefined;
  }, [expenseCategories]);

  const spendFor = useCallback((month: Month) => spendByCategory(transactions, monthBounds(month), options), [transactions, options]);
  const averageFor = useCallback((month: Month, months: number) => averageMonthlySpend(transactions, month, months, options), [transactions, options]);
  const suggestionsFor = useCallback((month: Month, months: number) => budgetSuggestions(averageFor(month, months), budgets, convert), [averageFor, budgets, convert]);
  const goals = useMemo(() => goalViews(financialGoals, convert), [financialGoals, convert]);

  /** Saves a budget. Editing returns an undo that puts the old one back; a new budget returns none (delete has its own undo). */
  const save = useCallback((draft: BudgetDraft): { created: boolean; undo?: () => void } => {
    const previous = draft.id ? budgets.find(b => b.id === draft.id) : budgets.find(b => b.categoryName === draft.categoryName);
    if (previous) {
      saveBudget({ ...draft, id: previous.id });
      return { created: false, undo: () => saveBudget(previous) };
    }
    saveBudget({ ...draft, id: `bud-${uuidv4()}` });
    return { created: true };
  }, [budgets, saveBudget]);

  const remove = useCallback((budget: Budget) => deleteBudget(budget.id), [deleteBudget]);

  /** Auto-fill from the last `months` full months. Returns how many budgets it wrote and an undo for the ones it changed. */
  const autofill = useCallback((month: Month, months: number) => {
    const plan = autofillPlan(averageFor(month, months), budgets, displayCurrency);
    const before = plan.map(p => budgets.find(b => b.id === p.id)).filter((b): b is Budget => !!b);
    plan.forEach(p => saveBudget(p.id ? p : { ...p, id: `bud-${uuidv4()}` }));
    return { count: plan.length, changed: before.length, undo: before.length ? () => before.forEach(b => saveBudget(b)) : undefined };
  }, [averageFor, budgets, displayCurrency, saveBudget]);

  return {
    budgets, parents, lookOf, displayCurrency, convert, spendFor, averageFor, suggestionsFor, goals, save, remove, autofill,
    defaultAutofill: String(preferences.defaultQuickCreatePeriod || 3) as '1' | '3' | '6' | '12',
    hasTransactions: transactions.length > 0,
  };
};

export type BudgetData = ReturnType<typeof useBudgetData>;
