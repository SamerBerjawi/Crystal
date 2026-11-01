import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { Transaction } from '../types';
import { useAccountsContext, useTransactionsContext } from './DomainProviders';
import { useScheduleContext } from './FinancialDataContext';
import { useMatcherConfig, type MatcherConfig } from '../hooks/useMatcherConfig';
import { useTransactionMatcher, type Suggestion } from '../hooks/useTransactionMatcher';
import { useSyncedBillMatcher, type SyncedBillMatchSuggestion } from '../hooks/useSyncedBillMatcher';
import { isUncategorised } from '../utils/overviewSummary';

const HIGH_CONFIDENCE = 80;

interface ReviewContextValue {
  transfers: Suggestion[];
  billMatches: SyncedBillMatchSuggestion[];
  toCategorise: Transaction[];
  likelyCount: number;
  confirmTransfer: (suggestion: Suggestion) => void;
  dismissTransfer: (suggestion: Suggestion) => void;
  confirmBill: (suggestion: SyncedBillMatchSuggestion) => void;
  dismissBill: (suggestion: SyncedBillMatchSuggestion) => void;
  confirmMatches: (transfers: Suggestion[], bills: SyncedBillMatchSuggestion[]) => void;
  dismissMatches: (transfers: Suggestion[], bills: SyncedBillMatchSuggestion[]) => void;
  confirmLikely: () => void;
  dismissAll: () => void;
  config: MatcherConfig;
  updateConfig: (updates: Partial<MatcherConfig>) => void;
  resetConfig: () => void;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

/**
 * One source for what's waiting (D-008), shared by Overview and the Review queue. It sits above the pages because
 * dismissed transfer matches live in memory, and would come back each time a page opened its own copy.
 */
export const ReviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { recurringTransactions, billsAndPayments, saveRecurringTransaction, saveBillPayment } = useScheduleContext();
  const { config, updateConfig, resetConfig } = useMatcherConfig();

  const { suggestions, confirmMatch, dismissSuggestion, confirmSelectedMatches, dismissSelectedMatches, dismissAllSuggestions } =
    useTransactionMatcher(transactions, accounts, saveTransaction, config);
  const { billSuggestions, confirmBillMatch, dismissBillMatch, confirmSelectedBillMatches, dismissSelectedBillMatches, dismissAllBillMatches } =
    useSyncedBillMatcher(transactions, recurringTransactions, billsAndPayments, accounts, saveTransaction, saveRecurringTransaction, saveBillPayment, config);

  // A transaction in both lists goes to whichever matcher is more confident, so it never gets two conflicting prompts.
  const { transfers, billMatches } = useMemo(() => {
    const billByTx = new Map(billSuggestions.map(bill => [bill.transaction.id, bill]));
    const hiddenTransfers = new Set<string>();
    const hiddenBills = new Set<string>();
    suggestions.forEach(transfer => {
      const conflict = billByTx.get(transfer.expenseTx.id) || billByTx.get(transfer.incomeTx.id);
      if (!conflict) return;
      if (transfer.matchScore >= conflict.matchScore) hiddenBills.add(conflict.id);
      else hiddenTransfers.add(transfer.id);
    });
    return {
      transfers: suggestions.filter(item => !hiddenTransfers.has(item.id)),
      billMatches: billSuggestions.filter(item => !hiddenBills.has(item.id)),
    };
  }, [suggestions, billSuggestions]);

  const toCategorise = useMemo(
    () => transactions.filter(isUncategorised).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const confirmMatches = useCallback((selectedTransfers: Suggestion[], bills: SyncedBillMatchSuggestion[]) => {
    if (selectedTransfers.length) confirmSelectedMatches(selectedTransfers);
    if (bills.length) confirmSelectedBillMatches(bills);
  }, [confirmSelectedMatches, confirmSelectedBillMatches]);

  const dismissMatches = useCallback((selectedTransfers: Suggestion[], bills: SyncedBillMatchSuggestion[]) => {
    if (selectedTransfers.length) dismissSelectedMatches(selectedTransfers);
    if (bills.length) dismissSelectedBillMatches(bills);
  }, [dismissSelectedMatches, dismissSelectedBillMatches]);

  const value = useMemo<ReviewContextValue>(() => {
    const likelyTransfers = transfers.filter(item => item.matchScore >= HIGH_CONFIDENCE);
    const likelyBills = billMatches.filter(item => item.matchScore >= HIGH_CONFIDENCE);
    return {
      transfers,
      billMatches,
      toCategorise,
      likelyCount: likelyTransfers.length + likelyBills.length,
      confirmTransfer: confirmMatch,
      dismissTransfer: dismissSuggestion,
      confirmBill: confirmBillMatch,
      dismissBill: dismissBillMatch,
      confirmMatches,
      dismissMatches,
      confirmLikely: () => confirmMatches(likelyTransfers, likelyBills),
      dismissAll: () => { dismissAllSuggestions(); dismissAllBillMatches(); },
      config,
      updateConfig,
      resetConfig,
    };
  }, [transfers, billMatches, toCategorise, confirmMatch, dismissSuggestion, confirmBillMatch, dismissBillMatch, confirmMatches, dismissMatches, dismissAllSuggestions, dismissAllBillMatches, config, updateConfig, resetConfig]);

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
};

export const useReview = () => {
  const context = useContext(ReviewContext);
  if (!context) throw new Error('useReview must be used within ReviewProvider');
  return context;
};
