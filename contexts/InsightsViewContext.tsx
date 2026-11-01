import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Account, AppPreferences, Duration, FinancialGoal } from '../types';
import { reconcileActiveGoals } from '../utils/syncedChoices';

interface InsightsViewContextValue {
  dashboardAccountIds: string[];
  setDashboardAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  dashboardDuration: Duration;
  setDashboardDuration: React.Dispatch<React.SetStateAction<Duration>>;
  activeGoalIds: string[];
  setActiveGoalIds: React.Dispatch<React.SetStateAction<string[]>>;
}

interface InsightsViewProviderProps {
  accounts: Account[];
  financialGoals: FinancialGoal[];
  defaultDuration: Duration;
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  children: React.ReactNode;
}

const InsightsViewContext = createContext<InsightsViewContextValue | undefined>(undefined);

export const InsightsViewProvider: React.FC<InsightsViewProviderProps> = ({
  accounts,
  financialGoals,
  defaultDuration,
  preferences,
  setPreferences,
  children,
}) => {
  const [dashboardAccountIds, setDashboardAccountIds] = useState<string[]>([]);
  const savedGoalIds = preferences.activeGoalIds;
  const knownGoalIds = preferences.knownGoalIds;
  const activeGoalIds = useMemo(() => savedGoalIds ?? [], [savedGoalIds]);
  const setActiveGoalIds = useCallback<React.Dispatch<React.SetStateAction<string[]>>>(action => {
    setPreferences(prev => ({ ...prev, activeGoalIds: typeof action === 'function' ? action(prev.activeGoalIds ?? []) : action }));
  }, [setPreferences]);
  const [dashboardDuration, setDashboardDuration] = useState<Duration>(defaultDuration);

  useEffect(() => {
    const accountIds = new Set(accounts.map(a => a.id));
    if (accountIds.size === 0) {
      setDashboardAccountIds([]);
      return;
    }

    setDashboardAccountIds(prev => prev.filter(id => accountIds.has(id)));
  }, [accounts]);

  useEffect(() => {
    if (accounts.length === 0 || dashboardAccountIds.length > 0) return;

    const primaryAccounts = accounts.filter(a => a.isPrimary);
    if (primaryAccounts.length > 0) {
      setDashboardAccountIds(primaryAccounts.map(a => a.id));
      return;
    }

    const openAccounts = accounts.filter(a => a.status !== 'closed');
    const fallbackAccount = (openAccounts.length > 0 ? openAccounts : accounts)[0];
    if (fallbackAccount) {
      setDashboardAccountIds([fallbackAccount.id]);
    }
  }, [accounts, dashboardAccountIds.length]);

  useEffect(() => {
    // Goals load with preferences, so an empty list here must not wipe the saved choice.
    if (financialGoals.length === 0) return;
    const next = reconcileActiveGoals(financialGoals, savedGoalIds, knownGoalIds);
    const isSame = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((id, index) => id === b[index]);
    if (savedGoalIds && isSame(next.activeGoalIds, savedGoalIds) && isSame(next.knownGoalIds, knownGoalIds)) return;
    setPreferences(prev => ({ ...prev, ...next }));
  }, [financialGoals, knownGoalIds, savedGoalIds, setPreferences]);

  useEffect(() => {
    setDashboardDuration(defaultDuration);
  }, [defaultDuration]);

  const value = useMemo(
    () => ({
      dashboardAccountIds,
      setDashboardAccountIds,
      dashboardDuration,
      setDashboardDuration,
      activeGoalIds,
      setActiveGoalIds,
    }),
    [dashboardAccountIds, dashboardDuration, activeGoalIds, setActiveGoalIds]
  );

  return <InsightsViewContext.Provider value={value}>{children}</InsightsViewContext.Provider>;
};

export const useInsightsView = () => {
  const ctx = useContext(InsightsViewContext);
  if (!ctx) throw new Error('useInsightsView must be used within an InsightsViewProvider');
  return ctx;
};
