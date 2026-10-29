import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Account, Category, Currency, Tag, Transaction } from '../types';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { convertCurrency, normalizeCurrency } from '../utils';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import {
  buildRows, merchantOptions, nextTagColor, placeOptions, planBulkEdit, planCombine, planRecurring, planSave, planSplit, planUncombine, planUnsplit,
  type BulkFields, type CombineFields, type Plan, type RecurringDraft, type SplitPart, type TxDraft, type TxRow,
} from '../utils/transactionsModel';

/**
 * Data and writes for TransactionsNew and the quick-add sheet (UI_UX_DESIGN_REFERENCE.md D13). Neutral: it
 * returns plain functions, and each write returns an `undo` the caller can offer in a toast (D6).
 */

export interface CategoryOption { name: string; color: string; icon?: string; parent?: string; classification: 'income' | 'expense' }

const flatten = (cats: Category[], parent?: string): CategoryOption[] =>
  cats.flatMap(c => [{ name: c.name, color: c.color, icon: c.icon, parent, classification: c.classification }, ...flatten(c.subCategories ?? [], c.name)]);

export type WriteResult = { ok: true; undo: () => void } | { ok: false; error: string };

export const useTransactionsData = () => {
  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { preferences } = usePreferencesContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags, saveTag } = useTagsContext();
  const { saveRecurringTransaction, deleteRecurringTransaction } = useScheduleContext();

  const showBalanceAdjustments = preferences.showBalanceAdjustments ?? true;
  const rows = useMemo(() => buildRows(transactions, { showBalanceAdjustments }), [transactions, showBalanceAdjustments]);
  const displayCurrency = normalizeCurrency(preferences.displayCurrency || preferences.currency || 'EUR');
  const convert = useCallback((amount: number, currency: Currency) => convertCurrency(amount, currency, displayCurrency), [displayCurrency]);

  const openAccounts = useMemo(() => accounts.filter(a => a.status !== 'closed'), [accounts]);
  const accountsById = useMemo(() => new Map<string, Account>(accounts.map(a => [a.id, a])), [accounts]);
  const tagsById = useMemo(() => new Map<string, Tag>(tags.map(t => [t.id, t])), [tags]);
  const categories = useMemo(() => ({ expense: flatten(expenseCategories), income: flatten(incomeCategories) }), [expenseCategories, incomeCategories]);
  const categoryByName = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    for (const c of [...categories.income, ...categories.expense]) if (!map.has(c.name)) map.set(c.name, c);
    return map;
  }, [categories]);
  /** Every place that appears on a transaction (city, or a coordinate cell), most used first (for the Locations filter). */
  const places = useMemo(() => placeOptions(rows), [rows]);
  /** Every merchant on a transaction, most used first (for the Merchant filter). */
  const merchants = useMemo(() => merchantOptions(rows), [rows]);

  const logoOverrides = useMemo(() => {
    const fromRules = Object.entries(preferences.merchantRules ?? {}).reduce<Record<string, string>>((acc, [key, rule]) => {
      if (rule?.logo) acc[key] = rule.logo;
      return acc;
    }, {});
    return { ...(preferences.merchantLogoOverrides ?? {}), ...fromRules };
  }, [preferences.merchantLogoOverrides, preferences.merchantRules]);
  const brandfetchId = (preferences.brandfetchClientId || '').trim();
  /** Everything saved on the Merchants page, by normalized name. */
  const merchantRules = useMemo(() => preferences.merchantRules ?? {}, [preferences.merchantRules]);
  /** What is saved about a merchant on the Merchants page (its branches, website, notes), if anything. */
  const merchantInfo = useCallback((name?: string) => (name ? preferences.merchantRules?.[normalizeMerchantKey(name) ?? ''] : undefined), [preferences.merchantRules]);

  /** A logo URL for a merchant or bank name (D12), or null when none can be resolved. */
  const logoFor = useCallback((name?: string) => (name ? getMerchantLogoUrl(name, brandfetchId, logoOverrides, { fallback: '404', type: 'icon', width: 96, height: 96 }) : null), [brandfetchId, logoOverrides]);

  const txById = useMemo(() => new Map(transactions.map(t => [t.id, t])), [transactions]);
  const originalsOf = useCallback((ids: string[]) => [...new Set(ids)].map(id => txById.get(id)).filter((t): t is Transaction => !!t), [txById]);
  /** The parts behind a split or combined parent. */
  const partsOf = useCallback((parentId: string) => transactions.filter(t => t.parentTransactionId === parentId), [transactions]);
  const storedOf = useCallback((row: TxRow) => originalsOf(row.txIds), [originalsOf]);

  /**
   * Applies a plan: saves, deletes, and returns an undo that restores everything it touched (records it created
   * are removed, records it changed or deleted are put back as they were).
   */
  const commit = useCallback((save: (Omit<Transaction, 'id'> & { id: string })[], remove: string[], options?: { skipRules?: boolean }): WriteResult => {
    const touched = [...save.map(t => t.id), ...remove];
    const before = originalsOf(touched);
    const created = save.map(t => t.id).filter(id => !txById.has(id));
    saveTransaction(save, remove.length ? remove : undefined, options);
    return { ok: true, undo: () => saveTransaction(before, created.length ? created : undefined, { skipRules: true }) };
  }, [originalsOf, saveTransaction, txById]);

  const fromPlan = useCallback((plan: Plan | ReturnType<typeof planSave>, options?: { skipRules?: boolean }): WriteResult =>
    'error' in plan ? { ok: false, error: plan.error } : commit(plan.save as (Omit<Transaction, 'id'> & { id: string })[], plan.remove, options), [commit]);

  /** Saves a draft (new, or an edit of `editing`). */
  const save = useCallback((draft: TxDraft, editing?: TxRow): WriteResult =>
    fromPlan(planSave(draft, { accounts, transactions, editing, newId: uuidv4 })), [accounts, transactions, fromPlan]);

  /** Deletes rows (every transaction behind them, and a split or combined parent's parts). */
  const remove = useCallback((targets: TxRow[]): WriteResult => {
    const ids = targets.flatMap(r => [...r.txIds, ...(r.spare?.txIds ?? []), ...(r.split || r.combined ? partsOf(r.id).map(p => p.id) : [])]);
    const before = originalsOf(ids);
    deleteTransactions(ids);
    return { ok: true, undo: () => saveTransaction(before, undefined, { skipRules: true }) };
  }, [deleteTransactions, originalsOf, partsOf, saveTransaction]);

  const bulkEdit = useCallback((targets: TxRow[], fields: BulkFields): WriteResult =>
    fromPlan(planBulkEdit(targets, transactions, fields), { skipRules: true }), [fromPlan, transactions]);

  /** Sets one category on the rows. A category of the other kind changes the type, and a transfer becomes an ordinary transaction. */
  const recategorize = useCallback((targets: TxRow[], category: string): WriteResult => {
    const option = categoryByName.get(category);
    if (!option) return { ok: false, error: `Category "${category}" was not found` };
    return bulkEdit(targets, { category: { name: option.name, classification: option.classification } });
  }, [bulkEdit, categoryByName]);

  const clearLocation = useCallback((targets: TxRow[]): WriteResult => bulkEdit(targets, { location: null }), [bulkEdit]);

  /** A copy of a row dated today, saved at once. */
  const duplicate = useCallback((row: TxRow, today: string): WriteResult => {
    const transferId = row.kind === 'transfer' ? `xfer-${uuidv4()}` : undefined;
    const copies = storedOf(row).map(t => {
      const { id: _id, importId: _i, sureId: _s, recurringSourceId: _r, parentTransactionId: _p, isSplitParent: _sp, isCombinedParent: _cp, ...rest } = t;
      return { ...rest, id: uuidv4(), date: today, ...(transferId ? { transferId } : {}) };
    });
    return commit(copies, [], { skipRules: true });
  }, [commit, storedOf]);

  const split = useCallback((row: TxRow, parts: SplitPart[]): WriteResult => {
    const parent = txById.get(row.id);
    if (!parent) return { ok: false, error: 'Transaction not found' };
    return fromPlan(planSplit(parent, parts, parent.isSplitParent ? partsOf(parent.id) : [], uuidv4), { skipRules: true });
  }, [fromPlan, partsOf, txById]);

  const unsplit = useCallback((row: TxRow): WriteResult => {
    const parent = txById.get(row.id);
    return parent ? fromPlan(planUnsplit(parent, partsOf(parent.id)), { skipRules: true }) : { ok: false, error: 'Transaction not found' };
  }, [fromPlan, partsOf, txById]);

  const combine = useCallback((targets: TxRow[], fields: CombineFields): WriteResult =>
    fromPlan(planCombine(targets.flatMap(storedOf), fields, accounts, uuidv4), { skipRules: true }), [accounts, fromPlan, storedOf]);

  const uncombine = useCallback((row: TxRow): WriteResult => {
    const parent = txById.get(row.id);
    return parent ? fromPlan(planUncombine(parent, partsOf(parent.id)), { skipRules: true }) : { ok: false, error: 'Transaction not found' };
  }, [fromPlan, partsOf, txById]);

  /** The id of the tag called `name` (case-insensitive), creating it when there is none. */
  const tagIdFor = useCallback((name: string): string | null => {
    const clean = name.trim().replace(/^#/, '');
    if (!clean) return null;
    const existing = tags.find(t => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;
    const id = uuidv4();
    saveTag({ id, name: clean, color: nextTagColor(tags), icon: 'tag' });
    return id;
  }, [tags, saveTag]);

  /** Creates a recurring transaction; the undo deletes it again. */
  const makeRecurring = useCallback((draft: RecurringDraft): WriteResult => {
    const plan = planRecurring(draft, accounts);
    if ('error' in plan) return { ok: false, error: plan.error };
    const id = uuidv4();
    saveRecurringTransaction({ ...plan.data, id });
    return { ok: true, undo: () => deleteRecurringTransaction(id) };
  }, [accounts, saveRecurringTransaction, deleteRecurringTransaction]);

  return {
    transactions, rows, accounts, openAccounts, accountsById, tags, tagsById, categories, categoryByName, places, merchants,
    displayCurrency, convert, logoFor, merchantInfo, merchantRules, partsOf, storedOf,
    save, remove, bulkEdit, tagIdFor, recategorize, clearLocation, duplicate, split, unsplit, combine, uncombine, makeRecurring,
  };
};

export type TransactionsData = ReturnType<typeof useTransactionsData>;
