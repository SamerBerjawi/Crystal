import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Account, BillPayment, Currency, RecurringTransaction, RecurringTransactionOverride, Transaction } from '../types';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { normalizeCurrency, resolveRates, round2 } from '../utils';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { planSave, type TxDraft, emptyDraft } from '../utils/transactionsModel';
import {
  addDays, buildOccurrences, endSeriesAt, isOpen, makeConverter, nextDueAfterPaying, splitSeriesAt, syntheticSeries,
  type Occurrence,
} from '../utils/scheduleModel';

/**
 * Data and writes for ScheduleNew (docs/SCHEDULE_NEW_PLAN.md §7). Every write returns an `undo` the caller offers in
 * a toast (D6), except deleting a series, whose Undo toast the app shows itself.
 */

export type ScheduleWrite = { ok: true; undo: () => void } | { ok: false; error: string };

export interface CategoryChoice { name: string; color: string; icon?: string; parent?: string; classification: 'income' | 'expense' }

/** How far ahead the page lists payments. */
export const HORIZON_DAYS = 365;

/**
 * `upsertEntity` merges, so a field the change added would survive a plain restore. This sets every key of `next`
 * to undefined first, then puts `prev` back.
 */
const restoring = <T extends object>(prev: T, next: object): T =>
  ({ ...Object.fromEntries(Object.keys(next).map(k => [k, undefined])), ...prev }) as T;

export const useScheduleData = () => {
  const schedule = useScheduleContext();
  const { recurringTransactions, recurringTransactionOverrides, billsAndPayments, loanPaymentOverrides } = schedule;
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { preferences } = usePreferencesContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();

  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }, []);
  const displayCurrency = normalizeCurrency(preferences.displayCurrency || preferences.currency || 'EUR');
  const rates = useMemo(() => resolveRates(preferences.conversionRates), [preferences.conversionRates]);
  const convert = useMemo(() => makeConverter(displayCurrency, rates), [displayCurrency, rates]);

  const accountsById = useMemo(() => new Map<string, Account>(accounts.map(a => [a.id, a])), [accounts]);
  const openAccounts = useMemo(() => accounts.filter(a => a.status !== 'closed'), [accounts]);
  const accountName = useCallback((id?: string) => (id ? accountsById.get(id)?.name ?? '' : ''), [accountsById]);

  const categories = useMemo(() => {
    const flatten = (cats: typeof expenseCategories, parent?: string): CategoryChoice[] =>
      cats.flatMap(c => [{ name: c.name, color: c.color, icon: c.icon, parent, classification: c.classification }, ...flatten(c.subCategories ?? [], c.name)]);
    return { expense: flatten(expenseCategories), income: flatten(incomeCategories) };
  }, [expenseCategories, incomeCategories]);
  const categoryByName = useMemo(() => {
    const map = new Map<string, CategoryChoice>();
    for (const c of [...categories.expense, ...categories.income]) if (!map.has(c.name)) map.set(c.name, c);
    return map;
  }, [categories]);

  const brandfetchId = (preferences.brandfetchClientId || '').trim();
  const logoOverrides = preferences.merchantLogoOverrides;
  const logoFor = useCallback((name?: string) =>
    (name ? getMerchantLogoUrl(name, brandfetchId, logoOverrides ?? {}, { fallback: '404', type: 'icon', width: 96, height: 96 }) : null), [brandfetchId, logoOverrides]);

  const synthetic = useMemo(() => syntheticSeries(accounts, transactions, loanPaymentOverrides), [accounts, transactions, loanPaymentOverrides]);

  // S-10: built from the data only; search and filters narrow the result in the page.
  const occurrences = useMemo(() => buildOccurrences({
    recurring: recurringTransactions,
    overrides: recurringTransactionOverrides,
    bills: billsAndPayments,
    accounts,
    transactions,
    loanPaymentOverrides,
    from: today,
    to: addDays(today, HORIZON_DAYS),
    today,
  }), [recurringTransactions, recurringTransactionOverrides, billsAndPayments, accounts, transactions, loanPaymentOverrides, today]);

  const seriesById = useMemo(() => new Map(recurringTransactions.map(r => [r.id, r])), [recurringTransactions]);

  // ---- occurrence writes -----------------------------------------------------------------------------------

  const existingOverride = useCallback((o: Occurrence) =>
    recurringTransactionOverrides.find(x => x.recurringTransactionId === o.sourceId && x.originalDate === o.originalDate), [recurringTransactionOverrides]);

  const restoreOverride = useCallback((o: Occurrence, prev?: RecurringTransactionOverride) => () => {
    schedule.deleteRecurringOverride(o.sourceId, o.originalDate);
    if (prev) schedule.saveRecurringOverride(prev);
  }, [schedule]);

  /** Skip or bring back one payment of a series. */
  const setSkipped = useCallback((o: Occurrence, skipped: boolean): ScheduleWrite => {
    if (o.source !== 'recurring') return { ok: false, error: 'Change this payment on its account' };
    const prev = existingOverride(o);
    schedule.saveRecurringOverride({ ...(prev ?? { recurringTransactionId: o.sourceId, originalDate: o.originalDate }), isSkipped: skipped });
    return { ok: true, undo: restoreOverride(o, prev) };
  }, [existingOverride, restoreOverride, schedule]);

  /** Change one payment: its date, amount or name (F14). */
  const changeOccurrence = useCallback((o: Occurrence, change: { date: string; amount: number; description: string }): ScheduleWrite => {
    if (o.source !== 'recurring') return { ok: false, error: 'Change this payment on its account' };
    if (!(change.amount > 0)) return { ok: false, error: 'Enter an amount' };
    if (!change.date) return { ok: false, error: 'Choose a date' };
    const rt = seriesById.get(o.sourceId);
    const prev = existingOverride(o);
    // Overrides store a signed amount: negative for money that goes out (as the classic override modal).
    const signed = rt?.type === 'income' ? round2(change.amount) : -round2(change.amount);
    const override: RecurringTransactionOverride = {
      recurringTransactionId: o.sourceId,
      originalDate: o.originalDate,
      isSkipped: prev?.isSkipped,
      date: change.date !== o.originalDate ? change.date : undefined,
      amount: rt && round2(change.amount) === round2(Math.abs(rt.amount)) ? undefined : signed,
      description: rt && change.description.trim() && change.description.trim() !== rt.description ? change.description.trim() : undefined,
    };
    schedule.deleteRecurringOverride(o.sourceId, o.originalDate);
    if (override.date || override.amount !== undefined || override.description || override.isSkipped) schedule.saveRecurringOverride(override);
    return { ok: true, undo: restoreOverride(o, prev) };
  }, [existingOverride, restoreOverride, schedule, seriesById]);

  /** Undo every change to one payment. */
  const clearChanges = useCallback((o: Occurrence): ScheduleWrite => {
    const prev = existingOverride(o);
    if (!prev) return { ok: false, error: 'Nothing to undo' };
    schedule.deleteRecurringOverride(o.sourceId, o.originalDate);
    return { ok: true, undo: () => schedule.saveRecurringOverride(prev) };
  }, [existingOverride, schedule]);

  /** A transaction draft for paying `o`, pre-filled from the occurrence. */
  const draftFor = useCallback((o: Occurrence): TxDraft => {
    const fallbackAccount = (openAccounts.find(a => a.type === 'Checking') ?? openAccounts[0])?.id ?? '';
    const kind = o.type === 'transfer' ? 'transfer' : o.flow === 'in' ? 'income' : 'expense';
    const account = o.accountId && accountsById.has(o.accountId) ? o.accountId : fallbackAccount;
    return {
      ...emptyDraft(kind, account, today),
      amount: String(o.amount),
      toAccountId: o.toAccountId ?? '',
      category: kind === 'transfer' ? '' : (o.category && categoryByName.has(o.category) ? o.category : ''),
      date: o.date < iso(today) ? iso(today) : o.date,
      merchant: o.merchant ?? '',
      description: o.description,
    };
  }, [accountsById, categoryByName, openAccounts, today]);

  /**
   * Mark paid (F15): saves the transaction linked to the occurrence, then moves `nextDueDate` (E-09) or marks the
   * bill paid, keeping its due date (E-10). Undo removes the transaction and puts the series or bill back.
   */
  const pay = useCallback((o: Occurrence, draft: TxDraft): ScheduleWrite => {
    const plan = planSave(draft, { accounts, transactions, newId: uuidv4 });
    if ('error' in plan) return { ok: false, error: plan.error };
    const link = o.source === 'bill' ? {} : { recurringSourceId: o.sourceId, recurringOccurrenceDate: o.originalDate };
    const saved = (plan.save as (Omit<Transaction, 'id'> & { id: string })[]).map(t => ({ ...t, ...link }));
    saveTransaction(saved, plan.remove.length ? plan.remove : undefined);
    const createdIds = saved.map(t => t.id);
    let restoreSource = () => {};
    if (o.source === 'recurring') {
      const rt = seriesById.get(o.sourceId);
      if (rt) {
        const mine = occurrences.filter(x => x.sourceId === rt.id && x.key !== o.key);
        const nextDue = nextDueAfterPaying(rt, o.originalDate, mine.filter(isOpen).map(x => x.originalDate), mine.filter(x => x.status === 'paid').map(x => x.originalDate));
        if (nextDue !== rt.nextDueDate) {
          schedule.saveRecurringTransaction({ ...rt, nextDueDate: nextDue });
          restoreSource = () => schedule.saveRecurringTransaction(rt);
        }
      }
    } else if (o.source === 'bill' && o.bill) {
      const bill = o.bill;
      const next: BillPayment = { ...bill, status: 'paid', accountId: draft.accountId, paidDate: draft.date };
      schedule.saveBillPayment(next);
      restoreSource = () => schedule.saveBillPayment(restoring(bill, next));
    }
    return {
      ok: true,
      undo: () => {
        saveTransaction([], createdIds);
        restoreSource();
      },
    };
  }, [accounts, occurrences, saveTransaction, schedule, seriesById, transactions]);

  // ---- series and bill writes ------------------------------------------------------------------------------

  /** Create or replace a series. */
  const saveSeries = useCallback((series: Omit<RecurringTransaction, 'id'> & { id?: string }): ScheduleWrite & { id?: string } => {
    const prev = series.id ? seriesById.get(series.id) : undefined;
    const id = series.id ?? `rec-${uuidv4()}`;
    const next = { ...series, id };
    schedule.saveRecurringTransaction(prev ? restoring({ ...prev, ...next }, prev) : next);
    return {
      ok: true,
      id,
      undo: () => (prev ? schedule.saveRecurringTransaction(restoring(prev, next)) : schedule.deleteRecurringTransaction(id)),
    };
  }, [schedule, seriesById]);

  /** "This and future": the old series ends before `originalDate`, a new one starts there with `changes`. */
  const splitSeries = useCallback((rt: RecurringTransaction, originalDate: string, changes: Omit<RecurringTransaction, 'id'>): ScheduleWrite => {
    const { ended, started } = splitSeriesAt(rt, originalDate, changes);
    const newId = `rec-${uuidv4()}`;
    schedule.saveRecurringTransaction(ended);
    schedule.saveRecurringTransaction({ ...started, id: newId });
    return { ok: true, undo: () => { schedule.saveRecurringTransaction(restoring(rt, ended)); schedule.deleteRecurringTransaction(newId); } };
  }, [schedule]);

  /** End a series at an occurrence (F16). */
  const endSeries = useCallback((rt: RecurringTransaction, originalDate: string): ScheduleWrite => {
    const next = endSeriesAt(rt, originalDate);
    schedule.saveRecurringTransaction(next);
    return { ok: true, undo: () => schedule.saveRecurringTransaction(restoring(rt, next)) };
  }, [schedule]);

  /** Permanent (asked first with Hold). The app's own toast offers Undo. */
  const deleteSeries = useCallback((rt: RecurringTransaction) => schedule.deleteRecurringTransaction(rt.id), [schedule]);

  const saveBill = useCallback((bill: Omit<BillPayment, 'id'> & { id?: string }): ScheduleWrite => {
    const prev = bill.id ? billsAndPayments.find(b => b.id === bill.id) : undefined;
    const id = bill.id ?? `bill-${uuidv4()}`;
    const next = { ...bill, id };
    schedule.saveBillPayment(next);
    return { ok: true, undo: () => (prev ? schedule.saveBillPayment(restoring(prev, next)) : schedule.deleteBillPayment(id)) };
  }, [billsAndPayments, schedule]);

  /** Expire (F7) or restore bills; one Undo for all of them (S-03). */
  const setBillStatus = useCallback((bills: BillPayment[], status: BillPayment['status']): ScheduleWrite => {
    if (!bills.length) return { ok: false, error: 'No bills' };
    const before = bills.map(b => ({ ...b }));
    for (const b of bills) schedule.saveBillPayment({ ...b, status });
    return { ok: true, undo: () => before.forEach(b => schedule.saveBillPayment(b)) };
  }, [schedule]);

  /** Permanent (asked first with Hold); Undo puts it back. */
  const deleteBill = useCallback((bill: BillPayment): ScheduleWrite => {
    schedule.deleteBillPayment(bill.id);
    return { ok: true, undo: () => schedule.saveBillPayment(bill) };
  }, [schedule]);

  return {
    today, displayCurrency, rates, convert,
    accounts, openAccounts, accountsById, accountName, categories, categoryByName, logoFor,
    recurring: recurringTransactions, synthetic, bills: billsAndPayments, transactions, occurrences, seriesById,
    setSkipped, changeOccurrence, clearChanges, draftFor, pay,
    saveSeries, splitSeries, endSeries, deleteSeries, saveBill, setBillStatus, deleteBill,
  };
};

export type ScheduleData = ReturnType<typeof useScheduleData>;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The currency a new series starts in: the account's. */
export const currencyOf = (data: ScheduleData, accountId: string): Currency => data.accountsById.get(accountId)?.currency ?? data.displayCurrency;
