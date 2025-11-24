import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Account, AppPreferences, Transaction, Warrant } from '../types';

export interface TransactionsContextValue {
  transactions: Transaction[];
  digest: string;
  saveTransaction: (txs: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
  deleteTransactions: (transactionIds: string[]) => void;
}

export interface AccountsContextValue {
  accounts: Account[];
  accountOrder: string[];
  setAccountOrder: (order: string[]) => void;
  saveAccount: (accountData: Omit<Account, 'id'> & { id?: string }) => void;
}

export interface PreferencesContextValue {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
}

export interface WarrantsContextValue {
  warrants: Warrant[];
  prices: Record<string, number | null>;
}

const TransactionsContext = createContext<TransactionsContextValue | undefined>(undefined);
const AccountsContext = createContext<AccountsContextValue | undefined>(undefined);
const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);
const WarrantsContext = createContext<WarrantsContextValue | undefined>(undefined);

const createDigest = (transactions: Transaction[]) =>
  transactions
    .map((tx) => `${tx.id}:${tx.date}:${tx.amount}:${tx.accountId}:${tx.currency}:${tx.type}:${tx.latitude ?? ''}:${tx.longitude ?? ''}:${tx.city ?? ''}:${tx.country ?? ''}`)
    .join('|');

export const TransactionsProvider: React.FC<{
  children: ReactNode;
  value: Omit<TransactionsContextValue, 'digest'>;
}> = ({ children, value }) => {
  const digest = useMemo(() => createDigest(value.transactions), [value.transactions]);
  const memoValue = useMemo(
    () => ({ ...value, digest }),
    [value, digest]
  );

  return <TransactionsContext.Provider value={memoValue}>{children}</TransactionsContext.Provider>;
};

export const AccountsProvider: React.FC<{ children: ReactNode; value: AccountsContextValue }> = ({ children, value }) => {
  const memoValue = useMemo(() => value, [value]);
  return <AccountsContext.Provider value={memoValue}>{children}</AccountsContext.Provider>;
};

export const PreferencesProvider: React.FC<{ children: ReactNode; value: PreferencesContextValue }> = ({ children, value }) => {
  const memoValue = useMemo(() => value, [value]);
  return <PreferencesContext.Provider value={memoValue}>{children}</PreferencesContext.Provider>;
};

export const WarrantsProvider: React.FC<{ children: ReactNode; value: WarrantsContextValue }> = ({ children, value }) => {
  const memoValue = useMemo(() => value, [value]);
  return <WarrantsContext.Provider value={memoValue}>{children}</WarrantsContext.Provider>;
};

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

export const useWarrantsContext = () => {
  const context = useContext(WarrantsContext);
  if (!context) throw new Error('useWarrantsContext must be used within a WarrantsProvider');
  return context;
};

export const useTransactionSelector = <T,>(selector: (transactions: Transaction[]) => T) => {
  const { transactions } = useTransactionsContext();
  return useMemo(() => selector(transactions), [selector, transactions]);
};

export const useAccountSelector = <T,>(selector: (accounts: Account[]) => T) => {
  const { accounts } = useAccountsContext();
  return useMemo(() => selector(accounts), [selector, accounts]);
};

export const usePreferencesSelector = <T,>(selector: (preferences: AppPreferences) => T) => {
  const { preferences } = usePreferencesContext();
  return useMemo(() => selector(preferences), [selector, preferences]);
};

export const useWarrantSelector = <T,>(selector: (warrants: Warrant[]) => T) => {
  const { warrants } = useWarrantsContext();
  return useMemo(() => selector(warrants), [selector, warrants]);
};
