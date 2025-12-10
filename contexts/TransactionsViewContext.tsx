import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';

type TransactionFilters = { accountName?: string | null; tagId?: string | null };

interface TransactionsViewContextValue {
  setPendingFilters: (filters?: TransactionFilters) => void;
  consumePendingFilters: () => TransactionFilters;
  clearPendingFilters: () => void;
  getPendingFilters: () => TransactionFilters;
}

const TransactionsViewContext = createContext<TransactionsViewContextValue | undefined>(undefined);

export const TransactionsViewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const pendingFiltersRef = useRef<TransactionFilters>({});

  const setPendingFilters = (filters?: TransactionFilters) => {
    pendingFiltersRef.current = {
      accountName: filters?.accountName ?? null,
      tagId: filters?.tagId ?? null,
    };
  };

  const consumePendingFilters = () => {
    const currentFilters = pendingFiltersRef.current;
    pendingFiltersRef.current = {};
    return currentFilters;
  };

  const clearPendingFilters = () => {
    pendingFiltersRef.current = {};
  };

  const getPendingFilters = () => pendingFiltersRef.current;

  const value = useMemo(
    () => ({ setPendingFilters, consumePendingFilters, clearPendingFilters, getPendingFilters }),
    []
  );

  return <TransactionsViewContext.Provider value={value}>{children}</TransactionsViewContext.Provider>;
};

export const useTransactionsNavigation = () => {
  const context = useContext(TransactionsViewContext);
  if (!context) throw new Error('useTransactionsNavigation must be used within a TransactionsViewProvider');
  return context;
};
