
import React, { createContext, useContext } from 'react';
import { Account, Transaction, AppPreferences, Warrant, Invoice, FinancialGoal } from '../types';

export interface TransactionsContextValue {
  transactions: Transaction[];
  saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
  deleteTransactions: (ids: string[]) => void;
}

export interface AccountsContextValue {
  accounts: Account[];
  saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
  deleteAccount: (id: string) => void;
}

export interface PreferencesContextValue {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
}

export interface WarrantsContextValue {
  warrants: Warrant[];
  saveWarrant: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  deleteWarrant: (id: string) => void;
}

export interface InvoicesContextValue {
  invoices: Invoice[];
  saveInvoice: (invoice: Omit<Invoice, 'id'> & { id?: string }) => void;
  deleteInvoice: (id: string) => void;
}

export interface GoalsContextValue {
    financialGoals: FinancialGoal[];
    saveFinancialGoal: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
    deleteFinancialGoal: (goalId: string) => void;
    forecastSnapshots: Record<string, number>;
    saveForecastSnapshots: (snapshots: Record<string, number>) => void;
}

export const TransactionsContext = createContext<TransactionsContextValue | undefined>(undefined);
export const AccountsContext = createContext<AccountsContextValue | undefined>(undefined);
export const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);
export const WarrantsContext = createContext<WarrantsContextValue | undefined>(undefined);
export const InvoicesContext = createContext<InvoicesContextValue | undefined>(undefined);

export const useTransactionsContext = () => {
  const context = useContext(TransactionsContext);
  if (!context) throw new Error('useTransactionsContext must be used within a TransactionsProvider');
  return context;
};

export const useAccountsContext = () => {
  const context = useContext(AccountsContext);
  if (!context) throw new Error('useAccountsContext must be used within an AccountsProvider');
  return context;
};

export const usePreferencesContext = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferencesContext must be used within a PreferencesProvider');
  return context;
};

// Helper for selecting specific preferences
export const usePreferencesSelector = <T,>(selector: (prefs: AppPreferences) => T): T => {
    const { preferences } = usePreferencesContext();
    return selector(preferences);
};

export const useWarrantsContext = () => {
  const context = useContext(WarrantsContext);
  if (!context) throw new Error('useWarrantsContext must be used within a WarrantsProvider');
  return context;
};

export const useInvoicesContext = () => {
  const context = useContext(InvoicesContext);
  if (!context) throw new Error('useInvoicesContext must be used within an InvoicesProvider');
  return context;
};
