
import React, { createContext, useContext, ReactNode } from 'react';
import { Account, AppPreferences, Transaction, Warrant, Invoice } from '../types';
import { DomainStore, useDomainSelector, useDomainStore } from './DomainStore';

export interface TransactionsContextValue {
  transactions: Transaction[];
  saveTransaction: (txs: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
  deleteTransactions: (transactionIds: string[]) => void;
  digest?: string;
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

export interface InvoicesContextValue {
  invoices: Invoice[];
  saveInvoice: (invoice: Omit<Invoice, 'id'> & { id?: string }) => void;
  deleteInvoice: (id: string) => void;
}

const TransactionsContext = createContext<DomainStore<TransactionsContextValue> | undefined>(undefined);
const AccountsContext = createContext<DomainStore<AccountsContextValue> | undefined>(undefined);
const PreferencesContext = createContext<DomainStore<PreferencesContextValue> | undefined>(undefined);
const WarrantsContext = createContext<DomainStore<WarrantsContextValue> | undefined>(undefined);
const InvoicesContext = createContext<DomainStore<InvoicesContextValue> | undefined>(undefined);

export const TransactionsProvider: React.FC<{
  children: ReactNode;
  value: TransactionsContextValue;
}> = ({ children, value }) => {
  const store = useDomainStore(value);
  return <TransactionsContext.Provider value={store}>{children}</TransactionsContext.Provider>;
};

export const AccountsProvider: React.FC<{ children: ReactNode; value: AccountsContextValue }> = ({ children, value }) => {
  const store = useDomainStore(value);
  return <AccountsContext.Provider value={store}>{children}</AccountsContext.Provider>;
};

export const PreferencesProvider: React.FC<{ children: ReactNode; value: PreferencesContextValue }> = ({ children, value }) => {
  const store = useDomainStore(value);
  return <PreferencesContext.Provider value={store}>{children}</PreferencesContext.Provider>;
};

export const WarrantsProvider: React.FC<{ children: ReactNode; value: WarrantsContextValue }> = ({ children, value }) => {
  const store = useDomainStore(value);
  return <WarrantsContext.Provider value={store}>{children}</WarrantsContext.Provider>;
};

export const InvoicesProvider: React.FC<{ children: ReactNode; value: InvoicesContextValue }> = ({ children, value }) => {
  const store = useDomainStore(value);
  return <InvoicesContext.Provider value={store}>{children}</InvoicesContext.Provider>;
};

export const useTransactionsContext = () => {
  const context = useContext(TransactionsContext);
  if (!context) throw new Error('useTransactionsContext must be used within a TransactionsProvider');
  return useDomainSelector(context, (state) => state);
};

export const useAccountsContext = () => {
  const context = useContext(AccountsContext);
  if (!context) throw new Error('useAccountsContext must be used within an AccountsProvider');
  return useDomainSelector(context, (state) => state);
};

export const usePreferencesContext = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferencesContext must be used within a PreferencesProvider');
  return useDomainSelector(context, (state) => state);
};

export const useWarrantsContext = () => {
  const context = useContext(WarrantsContext);
  if (!context) throw new Error('useWarrantsContext must be used within a WarrantsProvider');
  return useDomainSelector(context, (state) => state);
};

export const useInvoicesContext = () => {
  const context = useContext(InvoicesContext);
  if (!context) throw new Error('useInvoicesContext must be used within an InvoicesProvider');
  return useDomainSelector(context, (state) => state);
};

export const useTransactionSelector = <T,>(selector: (transactions: Transaction[]) => T) => {
  const store = useContext(TransactionsContext);
  return useDomainSelector(store, (state) => selector(state.transactions));
};

export const useAccountSelector = <T,>(selector: (accounts: Account[]) => T) => {
  const store = useContext(AccountsContext);
  return useDomainSelector(store, (state) => selector(state.accounts));
};

export const usePreferencesSelector = <T,>(selector: (preferences: AppPreferences) => T) => {
  const store = useContext(PreferencesContext);
  return useDomainSelector(store, (state) => selector(state.preferences));
};

export const useWarrantSelector = <T,>(selector: (warrants: Warrant[]) => T) => {
  const store = useContext(WarrantsContext);
  return useDomainSelector(store, (state) => selector(state.warrants));
};
