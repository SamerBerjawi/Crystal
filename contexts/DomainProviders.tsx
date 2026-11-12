
import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components';
import { Account, AppPreferences, Transaction, Warrant, Invoice, CleanupProposal } from '../types';

export const getLocaleForDateFormat = (format?: string): string => {
  const normalized = (format || 'DD/MM/YYYY').trim().toUpperCase();
  if (normalized.startsWith('MM')) return 'en-US';
  if (normalized.startsWith('YYYY')) return 'en-CA';
  if (normalized.includes('.')) return 'en-CH';
  return 'en-GB';
};

export interface TransactionsContextValue {
  transactions: Transaction[];
  saveTransaction: (
    txs: (Omit<Transaction, 'id'> & { id?: string })[],
    idsToDelete?: string[],
    options?: { autoSpareChange?: boolean; skipRules?: boolean; applyRules?: boolean }
  ) => void;
  deleteTransactions: (transactionIds: string[]) => void;
  /** Tidy-ups waiting for approval, and the ones already decided. See utils/cleanup.ts. */
  cleanupProposals: CleanupProposal[];
  setCleanupProposals: React.Dispatch<React.SetStateAction<CleanupProposal[]>>;
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
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
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

const TransactionsContext = createContext<TransactionsContextValue | undefined>(undefined);
const AccountsContext = createContext<AccountsContextValue | undefined>(undefined);
const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);
const WarrantsContext = createContext<WarrantsContextValue | undefined>(undefined);
const InvoicesContext = createContext<InvoicesContextValue | undefined>(undefined);

export const TransactionsProvider: React.FC<{
  children: ReactNode;
  value: TransactionsContextValue;
}> = ({ children, value }) => {
  const versionRef = useRef(0);
  const prevTxsRef = useRef(value.transactions);
  if (prevTxsRef.current !== value.transactions) {
    prevTxsRef.current = value.transactions;
    versionRef.current += 1;
  }
  const memoValue = useMemo(
    () => ({ ...value, digest: value.digest ?? `v${versionRef.current}-${value.transactions.length}` }),
    [value]
  );

  return <TransactionsContext.Provider value={memoValue}>{children}</TransactionsContext.Provider>;
};

export const AccountsProvider: React.FC<{ children: ReactNode; value: AccountsContextValue }> = ({ children, value }) => {
  const memoValue = useMemo(() => value, [value]);
  return <AccountsContext.Provider value={memoValue}>{children}</AccountsContext.Provider>;
};

export const PreferencesProvider: React.FC<{ children: ReactNode; value: PreferencesContextValue }> = ({ children, value }) => {
  const memoValue = useMemo(() => value, [value]);
  const racLocale = useMemo(() => getLocaleForDateFormat(value.preferences?.dateFormat), [value.preferences?.dateFormat]);
  return (
    <PreferencesContext.Provider value={memoValue}>
      <I18nProvider locale={racLocale}>
        {children}
      </I18nProvider>
    </PreferencesContext.Provider>
  );
};

export const WarrantsProvider: React.FC<{ children: ReactNode; value: WarrantsContextValue }> = ({ children, value }) => {
  const memoValue = useMemo(() => value, [value]);
  return <WarrantsContext.Provider value={memoValue}>{children}</WarrantsContext.Provider>;
};

export const InvoicesProvider: React.FC<{ children: ReactNode; value: InvoicesContextValue }> = ({ children, value }) => {
  const memoValue = useMemo(() => value, [value]);
  return <InvoicesContext.Provider value={memoValue}>{children}</InvoicesContext.Provider>;
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

export const useInvoicesContext = () => {
  const context = useContext(InvoicesContext);
  if (!context) throw new Error('useInvoicesContext must be used within an InvoicesProvider');
  return context;
};

const useSelector = <TInput, TOutput>(input: TInput, selector: (value: TInput) => TOutput) => {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  return useMemo(() => selectorRef.current(input), [input]);
};

export const useTransactionSelector = <T,>(selector: (transactions: Transaction[]) => T) => {
  const { transactions } = useTransactionsContext();
  return useSelector(transactions, selector);
};

export const useAccountSelector = <T,>(selector: (accounts: Account[]) => T) => {
  const { accounts } = useAccountsContext();
  return useSelector(accounts, selector);
};

export const usePreferencesSelector = <T,>(selector: (preferences: AppPreferences) => T) => {
  const { preferences } = usePreferencesContext();
  return useSelector(preferences, selector);
};

export const useWarrantSelector = <T,>(selector: (warrants: Warrant[]) => T) => {
  const { warrants } = useWarrantsContext();
  return useSelector(warrants, selector);
};
