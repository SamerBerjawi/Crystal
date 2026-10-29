import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Budget, Category, Currency } from '../types';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { convertCurrency, expandRecurringOccurrences, normalizeCurrency, resolveRates, safeAdd, toLocalISOString } from '../utils';
import {
  autofillPlan, averageMonthlySpend, budgetAccountIds, budgetSuggestions, goalViews, monthBounds, parentCategoryName, spendByCategory,
  type BudgetDraft, type Month, type Suggestion,
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
  const { recurringTransactions, recurringTransactionOverrides } = useScheduleContext();

  const displayCurrency = normalizeCurrency(preferences.displayCurrency || preferences.currency || 'EUR');
  // Same FX table as the Accounts pages (Q1): defaults overridden by saved rates.
  const rates = useMemo(() => resolveRates(preferences.conversionRates), [preferences.conversionRates]);
  const convert = useCallback((amount: number, currency: Currency) => convertCurrency(amount, currency, displayCurrency, rates), [displayCurrency, rates]);
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

  /**
   * Recurring expenses in budgeted categories for `month`, split at `today` into already paid and still due
   * (display currency). Feeds the month-end forecast so fixed bills are counted once, not extrapolated.
   */
  const recurringFor = useCallback((month: Month, today: Date) => {
    const { from, to } = monthBounds(month);
    const todayStr = toLocalISOString(today);
    const budgeted = new Set(budgets.map(b => b.categoryName));
    let paid = 0;
    let due = 0;
    for (const rt of recurringTransactions) {
      if (rt.type !== 'expense' || !accountIds.has(rt.accountId)) continue;
      const parent = rt.category ? parentCategoryName(rt.category, expenseCategories) : undefined;
      if (!parent || !budgeted.has(parent)) continue;
      const occurrences = expandRecurringOccurrences(rt, new Date(`${from}T00:00:00`), new Date(`${to}T00:00:00`), recurringTransactionOverrides);
      for (const occ of occurrences) {
        const amount = convert(occ.amount, rt.currency);
        if (occ.date <= todayStr) paid = safeAdd(paid, amount);
        else due = safeAdd(due, amount);
      }
    }
    return { paid, due };
  }, [budgets, recurringTransactions, recurringTransactionOverrides, accountIds, expenseCategories, convert]);
  const goals = useMemo(() => goalViews(financialGoals, convert), [financialGoals, convert]);

  /** Saves a budget. Editing returns an undo that puts the old one back; a new budget returns none (delete has its own undo). */
  const categoryIdOf = useCallback((name: string) => expenseCategories.find(c => c.name === name)?.id, [expenseCategories]);

  /**
   * Writes several drafts and returns one undo for all of them: changed budgets go back to
   * what they were, new ones are removed. Deletes go through `deleteBudget` with no toast of their own here.
   */
  const writeAll = useCallback((drafts: BudgetDraft[]) => {
    const previous: Budget[] = [];
    const createdIds: string[] = [];
    for (const draft of drafts) {
      const existing = draft.id ? budgets.find(b => b.id === draft.id) : budgets.find(b => b.categoryName === draft.categoryName);
      const categoryId = draft.categoryId ?? existing?.categoryId ?? categoryIdOf(draft.categoryName);
      if (existing) {
        previous.push(existing);
        saveBudget({ ...draft, categoryId, id: existing.id });
      } else {
        const id = `bud-${uuidv4()}`;
        createdIds.push(id);
        saveBudget({ ...draft, categoryId, id });
      }
    }
    const undo = () => {
      previous.forEach(b => saveBudget(b));
      createdIds.forEach(id => deleteBudget(id, { silent: true }));
    };
    return { created: createdIds.length, changed: previous.length, undo };
  }, [budgets, saveBudget, deleteBudget, categoryIdOf]);

  /** Saves a budget. Editing returns an undo that puts the old one back; a new budget returns none (delete has its own undo). */
  const save = useCallback((draft: BudgetDraft): { created: boolean; undo?: () => void } => {
    const res = writeAll([draft]);
    return res.changed > 0 ? { created: false, undo: res.undo } : { created: true };
  }, [writeAll]);

  const remove = useCallback((budget: Budget) => deleteBudget(budget.id), [deleteBudget]);

  /** The auto-fill plan; the sheet previews exactly what `autofill` writes. */
  const autofillPreview = useCallback(
    (month: Month, months: number, keepExisting: boolean) =>
      autofillPlan(averageFor(month, months), budgets, displayCurrency, { keepExisting, categories: expenseCategories }),
    [averageFor, budgets, displayCurrency, expenseCategories],
  );

  /** Auto-fill from the last `months` full months. The undo restores changed budgets and removes created ones. */
  const autofill = useCallback((month: Month, months: number, keepExisting = true) => {
    const plan = autofillPreview(month, months, keepExisting);
    const res = writeAll(plan);
    return { count: plan.length, changed: res.changed, undo: plan.length ? res.undo : undefined };
  }, [autofillPreview, writeAll]);

  /** Applies recommendations at their suggested amount, each in its budget's own currency when it has one. */
  const applySuggestions = useCallback((list: Suggestion[]) => {
    const drafts: BudgetDraft[] = list.map(sg => ({
      id: sg.budget?.id,
      categoryName: sg.categoryName,
      // Suggested amounts are in the display currency; keep an existing budget's currency by converting back.
      amount: sg.budget && sg.budget.currency !== displayCurrency
        ? Math.round(convertCurrency(sg.suggested, displayCurrency, sg.budget.currency, rates))
        : sg.suggested,
      period: 'monthly',
      currency: sg.budget?.currency ?? displayCurrency,
    }));
    return writeAll(drafts);
  }, [writeAll, displayCurrency, rates]);

  return {
    budgets, parents, lookOf, displayCurrency, convert, spendFor, averageFor, suggestionsFor, recurringFor, goals, save, remove,
    autofill, autofillPreview, applySuggestions,
    defaultAutofill: String(preferences.defaultQuickCreatePeriod || 3) as '1' | '3' | '6' | '12',
    /** History window for recommendations, from the quick-create preference (L-B7). */
    suggestionMonths: preferences.defaultQuickCreatePeriod || 3,
    hasTransactions: transactions.length > 0,
  };
};

export type BudgetData = ReturnType<typeof useBudgetData>;
