import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Account, Duration, FinancialGoal } from '../types';

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
  children: React.ReactNode;
}

const InsightsViewContext = createContext<InsightsViewContextValue | undefined>(undefined);

export const InsightsViewProvider: React.FC<InsightsViewProviderProps> = ({
  accounts,
  financialGoals,
  defaultDuration,
  children,
}) => {
  const [dashboardAccountIds, setDashboardAccountIds] = useState<string[]>([]);
  const [activeGoalIds, setActiveGoalIds] = useState<string[]>([]);
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
    const goalIds = financialGoals.map(g => g.id);
    const goalIdSet = new Set(goalIds);

    setActiveGoalIds(prev => {
      const preserved = prev.filter(id => goalIdSet.has(id));
      const missing = goalIds.filter(id => !preserved.includes(id));
      const next = [...preserved, ...missing];
      return next.length > 0 ? next : goalIds;
    });
  }, [financialGoals]);

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
    [dashboardAccountIds, dashboardDuration, activeGoalIds]
  );

  return <InsightsViewContext.Provider value={value}>{children}</InsightsViewContext.Provider>;
};

export const useInsightsView = () => {
  const ctx = useContext(InsightsViewContext);
  if (!ctx) throw new Error('useInsightsView must be used within an InsightsViewProvider');
  return ctx;
};
