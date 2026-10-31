import { useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Account, FinancialGoal } from '../types';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { normalizeCurrency, resolveAccountBalance, resolveRates } from '../utils';
import { computeAccount90dSparkline, isLiquidAccount } from '../utils/accountsModel';
import { buildOccurrences, iso, makeConverter } from '../utils/scheduleModel';
import {
  NO_ASSUMPTIONS, chartSeries, hasAssumptions, historyDays, horizonEnd, projectBalances, sumHistories, type Assumptions, type Horizon,
} from '../utils/forecastModel';
import { goalTree, moveGoal } from '../utils/goalsModel';

/**
 * Data and writes for ForecastingNew (docs/FORECASTING_NEW_PLAN.md §7). Goal writes return an `undo` (D6). The
 * account selection and horizon are remembered on this device; the scenario is per session (Q-F3).
 */

export type ForecastWrite = { ok: true; undo: () => void } | { ok: false; error: string };
export type AccountPreset = 'liquid' | 'primary' | 'cash-cards' | 'everything';

const ACCOUNTS_KEY = 'crystal-new.forecast-accounts';
const HORIZON_KEY = 'crystal-new.forecast-horizon';
const read = (key: string): string | null => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { window.localStorage.setItem(key, value); } catch { /* per-device convenience */ } };

/** Accounts a forecast can follow: open, not property or vehicles (their value does not move with payments). */
export const forecastableAccounts = (accounts: Account[]) =>
  accounts.filter(a => a.status !== 'closed' && a.type !== 'Property' && a.type !== 'Vehicle');

export const presetAccounts = (accounts: Account[], preset: AccountPreset): string[] => {
  const open = forecastableAccounts(accounts);
  switch (preset) {
    case 'primary': return open.filter(a => a.isPrimary).map(a => a.id);
    case 'cash-cards': return open.filter(a => isLiquidAccount(a) || a.type === 'Credit Card').map(a => a.id);
    case 'everything': return open.map(a => a.id);
    default: return open.filter(a => isLiquidAccount(a) && a.type !== 'Credit Card').map(a => a.id);
  }
};

export const useForecastData = () => {
  const { accounts } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const { financialGoals, goalOrder, saveFinancialGoal, deleteFinancialGoal, setGoalOrder } = useGoalsContext();
  const schedule = useScheduleContext();
  const { activeGoalIds, setActiveGoalIds } = useInsightsView();

  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }, []);
  const displayCurrency = normalizeCurrency(preferences.displayCurrency || preferences.currency || 'EUR');
  const rates = useMemo(() => resolveRates(preferences.conversionRates), [preferences.conversionRates]);
  const convert = useMemo(() => makeConverter(displayCurrency, rates), [displayCurrency, rates]);
  const accountsById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const accountName = useCallback((id?: string) => (id ? accountsById.get(id)?.name ?? '' : ''), [accountsById]);
  const candidates = useMemo(() => forecastableAccounts(accounts), [accounts]);

  // ---- selection, horizon, scenario, cushion ----------------------------------------------------------------

  const [selectedIds, setSelectedState] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(read(ACCOUNTS_KEY) || 'null') as string[] | null;
      if (Array.isArray(stored) && stored.length) return stored;
    } catch { /* fall through */ }
    return [];
  });
  // Ids of closed or deleted accounts drop out; an empty choice means the Liquid cash preset (F-09).
  const selection = useMemo(() => {
    const valid = selectedIds.filter(id => candidates.some(a => a.id === id));
    return valid.length ? valid : presetAccounts(accounts, 'liquid');
  }, [selectedIds, candidates, accounts]);
  const setSelection = useCallback((ids: string[]) => { setSelectedState(ids); write(ACCOUNTS_KEY, JSON.stringify(ids)); }, []);
  const selectedAccounts = useMemo(() => candidates.filter(a => selection.includes(a.id)), [candidates, selection]);

  const [horizon, setHorizonState] = useState<Horizon>(() => (read(HORIZON_KEY) as Horizon | null) || (preferences.defaultForecastPeriod as Horizon | undefined) || '1Y');
  const setHorizon = useCallback((h: Horizon) => { setHorizonState(h); write(HORIZON_KEY, h); }, []);
  const end = useMemo(() => horizonEnd(horizon, today), [horizon, today]);

  const [assumptions, setAssumptions] = useState<Assumptions>(NO_ASSUMPTIONS);
  const cushion = preferences.forecastCushion;
  const setCushion = useCallback((value: number | undefined) => setPreferences(prev => ({ ...prev, forecastCushion: value })), [setPreferences]);

  // ---- projection -----------------------------------------------------------------------------------------

  const startBalances = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of selectedAccounts) out[a.id] = convert(resolveAccountBalance(a, transactions, schedule.loanPaymentOverrides, { rates }), a.currency);
    return out;
  }, [selectedAccounts, transactions, schedule.loanPaymentOverrides, rates, convert]);

  const occurrences = useMemo(() => buildOccurrences({
    recurring: schedule.recurringTransactions,
    overrides: schedule.recurringTransactionOverrides,
    bills: schedule.billsAndPayments,
    accounts,
    transactions,
    loanPaymentOverrides: schedule.loanPaymentOverrides,
    from: today,
    to: end,
    today,
  }), [schedule.recurringTransactions, schedule.recurringTransactionOverrides, schedule.billsAndPayments, schedule.loanPaymentOverrides, accounts, transactions, today, end]);

  const projectionInput = useMemo(() => ({
    accounts: selectedAccounts, startBalances, occurrences, goals: financialGoals, activeGoalIds, today, end, convert,
  }), [selectedAccounts, startBalances, occurrences, financialGoals, activeGoalIds, today, end, convert]);
  const projection = useMemo(() => projectBalances(projectionInput), [projectionInput]);
  const scenario = useMemo(() => (hasAssumptions(assumptions) ? projectBalances({ ...projectionInput, assumptions }) : undefined), [projectionInput, assumptions]);

  const history = useMemo(() => {
    const n = historyDays(horizon);
    const from = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
    const perAccount = selectedAccounts.map(a => computeAccount90dSparkline(a, transactions, undefined, { conversionRates: rates, loanPaymentOverrides: schedule.loanPaymentOverrides, referenceDate: today })
      .sparklineData.map(p => ({ date: iso(p.date), value: convert(p.value, a.currency) }))
      .filter(p => p.date >= from));
    return sumHistories(perAccount);
  }, [selectedAccounts, transactions, rates, schedule.loanPaymentOverrides, today, horizon, convert]);

  const chart = useMemo(() => chartSeries(history, projection, scenario), [history, projection, scenario]);

  // ---- goals ----------------------------------------------------------------------------------------------

  const tree = useMemo(() => goalTree(financialGoals, goalOrder), [financialGoals, goalOrder]);
  // The app's delete handler finds the goal in the list it rendered with; an Undo runs later, so it must call the
  // latest handler or it would not see a goal created after the toast was shown.
  const latest = useRef({ deleteFinancialGoal });
  latest.current = { deleteFinancialGoal };

  const saveGoal = useCallback((goal: Omit<FinancialGoal, 'id'> & { id?: string }): ForecastWrite => {
    const prev = goal.id ? financialGoals.find(g => g.id === goal.id) : undefined;
    const id = goal.id ?? `goal-${uuidv4()}`;
    const next = { ...goal, id };
    // upsert merges: reset keys the edit removed.
    saveFinancialGoal(prev ? { ...Object.fromEntries(Object.keys(prev).map(k => [k, undefined])), ...next } as FinancialGoal : next);
    if (!prev) setActiveGoalIds(ids => (ids.includes(id) ? ids : [...ids, id]));
    return {
      ok: true,
      undo: () => (prev ? saveFinancialGoal({ ...Object.fromEntries(Object.keys(next).map(k => [k, undefined])), ...prev } as FinancialGoal) : latest.current.deleteFinancialGoal(id)),
    };
  }, [financialGoals, saveFinancialGoal, deleteFinancialGoal, setActiveGoalIds]);

  /** Permanent (asked first with Hold); Undo puts the goal and its items back. */
  const deleteGoal = useCallback((goal: FinancialGoal): ForecastWrite => {
    const removed = [goal, ...financialGoals.filter(g => g.parentId === goal.id)];
    deleteFinancialGoal(goal.id);
    // The app deletes a bucket's items; a parent that is not a bucket keeps its items, which become top-level.
    return { ok: true, undo: () => removed.forEach(g => saveFinancialGoal(g)) };
  }, [deleteFinancialGoal, financialGoals, saveFinancialGoal]);

  const duplicateGoal = useCallback((goal: FinancialGoal): ForecastWrite => {
    const { id: _id, ...rest } = goal;
    return saveGoal({ ...rest, name: `${goal.name} (copy)` });
  }, [saveGoal]);

  const toggleDone = useCallback((goal: FinancialGoal): ForecastWrite => {
    saveFinancialGoal({ ...goal, completed: !goal.completed });
    return { ok: true, undo: () => saveFinancialGoal(goal) };
  }, [saveFinancialGoal]);

  const setActive = useCallback((ids: string[], active: boolean): ForecastWrite => {
    const before = activeGoalIds;
    setActiveGoalIds(prev => (active ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id))));
    return { ok: true, undo: () => setActiveGoalIds(before) };
  }, [activeGoalIds, setActiveGoalIds]);

  const move = useCallback((id: string, direction: -1 | 1): ForecastWrite => {
    const before = goalOrder;
    setGoalOrder(moveGoal(tree, id, direction));
    return { ok: true, undo: () => setGoalOrder(before) };
  }, [goalOrder, setGoalOrder, tree]);

  const reorder = useCallback((ids: string[]): ForecastWrite => {
    const before = goalOrder;
    setGoalOrder(ids);
    return { ok: true, undo: () => setGoalOrder(before) };
  }, [goalOrder, setGoalOrder]);

  return {
    today, displayCurrency, rates, convert, accounts, accountsById, accountName, candidates,
    selection, setSelection, selectedAccounts, horizon, setHorizon, end,
    assumptions, setAssumptions, cushion, setCushion,
    startBalances, occurrences, projection, scenario, history, chart,
    goals: financialGoals, goalOrder, tree, activeGoalIds,
    saveGoal, deleteGoal, duplicateGoal, toggleDone, setActive, move, reorder,
  };
};

export type ForecastData = ReturnType<typeof useForecastData>;
