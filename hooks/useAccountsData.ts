import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Account, AssetClosureDetails, Currency, Transaction } from '../types';
import {
  useAccountsContext,
  usePreferencesContext,
  useTransactionsContext,
  useWarrantsContext,
} from '../contexts/DomainProviders';
import { useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { convertCurrency, downloadCSV, normalizeCurrency, resolveRates, safeRound, toLocalISOString } from '../utils';
import {
  accountsToCSV,
  computeAccount90dSparkline,
  computeAccountDisplayBalance,
  computeAccountsHeroModel,
  computeBalanceAdjustmentDelta,
  getCardWalletAccounts,
  getVisibleAccountsForAccountsPage,
  type AccountSparklineResult,
  type AccountsHeroModel,
} from '../utils/accountsModel';
import {
  findLinkedAssetForLoan,
  findLinkedLoanForAsset,
} from '../utils/accountDetailModel';

/*
 * Data and mutations for `/accounts-new` (UI_UX_DESIGN_REFERENCE.md D6, D13).
 * Reversible changes return an `undo` callback so the page can offer an Undo toast.
 */

export const useAccountsData = () => {
  const {
    accounts,
    accountOrder,
    setAccountOrder,
    saveAccount: rawSaveAccount,
    deleteAccount: rawDeleteAccount,
    toggleAccountStatus: rawToggleStatus,
    closeAsset: rawCloseAsset,
    revertClosure: rawRevertClosure,
    linkedEnableBankingAccountIds,
    enableBankingLinkMap,
    syncAllBanks,
    isSyncingBanks,
    triggerEnableBankingSync,
    navigateToTransactions,
  } = useAccountsContext();
  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { preferences } = usePreferencesContext();
  const { warrants } = useWarrantsContext();
  const { loanPaymentOverrides } = useScheduleContext();
  const { financialGoals } = useGoalsContext();

  const displayCurrency = normalizeCurrency(preferences.displayCurrency || preferences.currency || 'EUR');
  // One FX table for every figure on the page (Q1): defaults overridden by saved rates.
  const conversionRates = useMemo(() => resolveRates(preferences.conversionRates), [preferences.conversionRates]);

  const convert = useCallback(
    (amount: number, fromCurrency: Currency) =>
      convertCurrency(amount, fromCurrency, displayCurrency, conversionRates),
    [displayCurrency, conversionRates]
  );

  const visibleAccounts = useMemo(
    () => getVisibleAccountsForAccountsPage(accounts),
    [accounts]
  );

  const transactionsByAccountId = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const list = map.get(tx.accountId);
      if (list) list.push(tx);
      else map.set(tx.accountId, [tx]);
    }
    return map;
  }, [transactions]);

  const displayBalancesById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const acc of visibleAccounts) {
      const accTxs = transactionsByAccountId.get(acc.id) || [];
      map[acc.id] = computeAccountDisplayBalance(acc, accTxs, loanPaymentOverrides, { conversionRates });
    }
    return map;
  }, [visibleAccounts, transactionsByAccountId, loanPaymentOverrides, conversionRates]);

  // The display balance is already today's balance (future-dated items excluded).
  const realTodayBalancesById = displayBalancesById;

  const sparklinesById = useMemo(() => {
    const map: Record<string, AccountSparklineResult> = {};
    for (const acc of visibleAccounts) {
      const accTxs = transactionsByAccountId.get(acc.id) || [];
      map[acc.id] = computeAccount90dSparkline(acc, accTxs, displayBalancesById[acc.id], {
        conversionRates,
        loanPaymentOverrides,
      });
    }
    return map;
  }, [visibleAccounts, transactionsByAccountId, displayBalancesById, conversionRates, loanPaymentOverrides]);

  const heroModel: AccountsHeroModel = useMemo(
    () =>
      computeAccountsHeroModel(
        visibleAccounts,
        transactions,
        loanPaymentOverrides,
        displayCurrency,
        { conversionRates }
      ),
    [visibleAccounts, transactions, loanPaymentOverrides, displayCurrency, conversionRates]
  );

  const cardWalletAccounts = useMemo(
    () => getCardWalletAccounts(visibleAccounts, accountOrder),
    [visibleAccounts, accountOrder]
  );

  const linkedLoanByAssetId = useMemo(() => {
    const map: Record<string, Account | undefined> = {};
    for (const acc of visibleAccounts) {
      if (acc.type === 'Property' || acc.type === 'Vehicle') {
        map[acc.id] = findLinkedLoanForAsset(acc, accounts);
      }
    }
    return map;
  }, [visibleAccounts, accounts]);

  const linkedAssetByLoanId = useMemo(() => {
    const map: Record<string, Account | undefined> = {};
    for (const acc of visibleAccounts) {
      if (acc.type === 'Loan') {
        map[acc.id] = findLinkedAssetForLoan(acc, accounts);
      }
    }
    return map;
  }, [visibleAccounts, accounts]);

  const institutions = useMemo(() => {
    const set = new Set<string>();
    for (const acc of visibleAccounts) {
      if (acc.financialInstitution?.trim()) {
        set.add(acc.financialInstitution.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [visibleAccounts]);

  const currencies = useMemo(() => {
    const set = new Set<Currency>();
    for (const acc of visibleAccounts) {
      set.add(acc.currency);
    }
    return Array.from(set);
  }, [visibleAccounts]);

  /** Save or update an account, returning an undo callback if updating an existing account. */
  const saveAccount = useCallback(
    (
      draft: Omit<Account, 'id'> & { id?: string }
    ): { created: boolean; id: string; undo?: () => void } => {
      const existing = draft.id ? accounts.find((a) => a.id === draft.id) : undefined;
      if (existing) {
        rawSaveAccount({ ...existing, ...draft, id: existing.id });
        return {
          created: false,
          id: existing.id,
          undo: () => rawSaveAccount(existing),
        };
      }
      const newId = draft.id || `acc-${uuidv4()}`;
      rawSaveAccount({ ...draft, id: newId });
      return {
        created: true,
        id: newId,
        undo: rawDeleteAccount ? () => rawDeleteAccount(newId) : undefined,
      };
    },
    [accounts, rawSaveAccount, rawDeleteAccount]
  );

  /** Delete an account permanently. */
  const deleteAccount = useCallback(
    (accountId: string) => {
      rawDeleteAccount?.(accountId);
    },
    [rawDeleteAccount]
  );

  /** Toggle open/closed status with Undo support. */
  const toggleAccountStatus = useCallback(
    (accountId: string): { nextStatus: 'open' | 'closed'; undo: () => void } | null => {
      const target = accounts.find((a) => a.id === accountId);
      if (!target) return null;
      const prevStatus = target.status || 'open';
      const nextStatus: 'open' | 'closed' = prevStatus === 'closed' ? 'open' : 'closed';
      if (rawToggleStatus) {
        rawToggleStatus(accountId);
      } else {
        rawSaveAccount({ ...target, status: nextStatus, closureDetails: undefined });
      }
      return {
        nextStatus,
        undo: () => {
          if (rawToggleStatus) {
            rawToggleStatus(accountId);
          } else {
            rawSaveAccount(target);
          }
        },
      };
    },
    [accounts, rawToggleStatus, rawSaveAccount]
  );

  /** Reorder accounts with Undo support. */
  const reorderAccounts = useCallback(
    (nextOrder: string[]): { undo: () => void } => {
      const prevOrder = [...accountOrder];
      setAccountOrder(nextOrder);
      return {
        undo: () => setAccountOrder(prevOrder),
      };
    },
    [accountOrder, setAccountOrder]
  );

  /** Balance of `account` on `dateStr`, for the reconcile sheet; null for amortised loans. */
  const getBalanceOnDate = useCallback(
    (account: Account, dateStr: string): number | null => {
      const delta = computeBalanceAdjustmentDelta(account, transactionsByAccountId.get(account.id) || [], 0, dateStr, conversionRates);
      return delta === null ? null : -delta;
    },
    [transactionsByAccountId, conversionRates]
  );

  /** Record a Balance Adjustment transaction that reconciles an account to `targetBalance`. */
  const adjustBalance = useCallback(
    (
      account: Account,
      targetBalance: number,
      dateStr?: string,
      note?: string
    ): { delta: number; undo?: () => void; unsupported?: boolean } => {
      const delta = computeBalanceAdjustmentDelta(
        account,
        transactionsByAccountId.get(account.id) || [],
        targetBalance,
        dateStr,
        conversionRates
      );
      if (delta === null) return { delta: 0, unsupported: true };
      if (Math.abs(delta) < 0.000001) {
        return { delta: 0 };
      }
      const txId = `txn-adj-${uuidv4()}`;
      const effectiveDate = dateStr || toLocalISOString(new Date());
      saveTransaction(
        [
          {
            id: txId,
            accountId: account.id,
            date: effectiveDate,
            description: note?.trim() || 'Manual Balance Reconciliation',
            merchant: 'Balance Adjustment',
            amount: delta,
            category: 'Balance Adjustment',
            type: delta >= 0 ? 'income' : 'expense',
            currency: account.currency,
            isBalanceAdjustment: true,
          },
        ],
        [],
        { skipRules: true }
      );
      return {
        delta,
        undo: () => deleteTransactions([txId]),
      };
    },
    [saveTransaction, deleteTransactions, transactionsByAccountId, conversionRates]
  );

  /** Record a market valuation entry (`priceHistory` + `balance`) for a Property or Vehicle account. */
  const recordValuation = useCallback(
    (
      account: Account,
      newValuation: number,
      dateStr?: string
    ): { undo: () => void } => {
      const previousAccount = {
        ...account,
        priceHistory: account.priceHistory ? [...account.priceHistory] : undefined,
      };
      const targetDate = dateStr || toLocalISOString(new Date());
      const existingHistory = account.priceHistory ? [...account.priceHistory] : [];
      const idx = existingHistory.findIndex((entry) => entry.date === targetDate);
      if (idx >= 0) {
        existingHistory[idx] = { date: targetDate, price: newValuation };
      } else {
        existingHistory.push({ date: targetDate, price: newValuation });
      }
      existingHistory.sort((a, b) => a.date.localeCompare(b.date));
      const latestEntry = existingHistory[existingHistory.length - 1];
      rawSaveAccount({
        ...account,
        priceHistory: existingHistory,
        balance: latestEntry ? latestEntry.price : newValuation,
      });
      return {
        undo: () => rawSaveAccount(previousAccount),
      };
    },
    [rawSaveAccount]
  );

  const closeAsset = useCallback(
    (accountId: string, details: AssetClosureDetails) => {
      rawCloseAsset?.(accountId, details);
    },
    [rawCloseAsset]
  );

  const revertClosure = useCallback(
    (accountId: string) => {
      rawRevertClosure?.(accountId);
    },
    [rawRevertClosure]
  );

  const exportCsv = useCallback(
    (list: Account[]) => {
      const csv = accountsToCSV(list, displayBalancesById, displayCurrency, {
        conversionRates,
      });
      downloadCSV(csv, `crystal-accounts-${toLocalISOString(new Date())}.csv`);
    },
    [displayBalancesById, displayCurrency, conversionRates]
  );

  return {
    accounts,
    visibleAccounts,
    accountOrder,
    displayCurrency,
    conversionRates,
    convert,
    transactions,
    transactionsByAccountId,
    displayBalancesById,
    realTodayBalancesById,
    sparklinesById,
    heroModel,
    cardWalletAccounts,
    linkedLoanByAssetId,
    linkedAssetByLoanId,
    institutions,
    currencies,
    warrants,
    financialGoals,
    loanPaymentOverrides,
    linkedEnableBankingAccountIds: linkedEnableBankingAccountIds ?? new Set<string>(),
    enableBankingLinkMap: enableBankingLinkMap ?? new Map(),
    syncAllBanks,
    isSyncingBanks: !!isSyncingBanks,
    triggerEnableBankingSync,
    navigateToTransactions,
    brandfetchClientId: (preferences.brandfetchClientId || '').trim(),
    merchantLogoOverrides: preferences.merchantLogoOverrides || {},
    defaultSortBy: (preferences.defaultAccountOrder || 'manual') as
      | 'manual'
      | 'balance'
      | 'name'
      | 'change30d'
      | 'apy_apr',
    saveAccount,
    deleteAccount,
    toggleAccountStatus,
    reorderAccounts,
    adjustBalance,
    getBalanceOnDate,
    recordValuation,
    closeAsset,
    revertClosure,
    exportCsv,
  };
};

export type AccountsData = ReturnType<typeof useAccountsData>;
