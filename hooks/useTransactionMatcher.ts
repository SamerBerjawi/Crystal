import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, Account } from '../types';
import { MatcherConfig, DEFAULT_MATCHER_CONFIG } from './useMatcherConfig';
import {
  buildTransferPairUpdates,
  findTransferSuggestions,
  type TransferSuggestion,
} from '../utils/transferMatcher';

export type Suggestion = TransferSuggestion;

export const useTransactionMatcher = (
  transactions: Transaction[],
  accounts: Account[],
  saveTransaction: (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void,
  config: MatcherConfig = DEFAULT_MATCHER_CONFIG,
  externalIgnoredIds?: string[],
  saveIgnoredIds?: (ids: string[]) => void
) => {
  const [localIgnoredIds, setLocalIgnoredIds] = useState<string[]>([]);
  const ignoredSuggestionIds = externalIgnoredIds ?? localIgnoredIds;
  const appendIgnoredIds = (ids: string[]) => {
    const next = Array.from(new Set([...ignoredSuggestionIds, ...ids]));
    if (saveIgnoredIds) {
      saveIgnoredIds(next);
    } else {
      setLocalIgnoredIds(next);
    }
  };

  const suggestions = useMemo(
    () => findTransferSuggestions(transactions, config, ignoredSuggestionIds),
    [transactions, ignoredSuggestionIds, config]
  );

  const confirmMatch = (suggestion: Suggestion) => {
    const updates = buildTransferPairUpdates(
      suggestion.expenseTx,
      suggestion.incomeTx,
      accounts,
      `xfer-${uuidv4()}`
    );
    saveTransaction(updates);
    appendIgnoredIds([suggestion.id]);
  };

  const dismissSuggestion = (suggestion: Suggestion) => {
    appendIgnoredIds([suggestion.id]);
  };

  const confirmSelectedMatches = (selectedList: Suggestion[]) => {
    const transactionsToUpdate: (Omit<Transaction, 'id'> & { id: string })[] = [];
    const suggestionIdsToIgnore: string[] = [];

    selectedList.forEach(suggestion => {
      const updates = buildTransferPairUpdates(
        suggestion.expenseTx,
        suggestion.incomeTx,
        accounts,
        `xfer-${uuidv4()}`
      );
      transactionsToUpdate.push(...updates);
      suggestionIdsToIgnore.push(suggestion.id);
    });

    if (transactionsToUpdate.length > 0) {
      saveTransaction(transactionsToUpdate);
    }

    appendIgnoredIds(suggestionIdsToIgnore);
  };

  const dismissSelectedMatches = (selectedList: Suggestion[]) => {
    const idsToIgnore = selectedList.map(s => s.id);
    appendIgnoredIds(idsToIgnore);
  };

  const confirmAllMatches = () => {
    confirmSelectedMatches(suggestions);
  };

  const dismissAllSuggestions = () => {
    dismissSelectedMatches(suggestions);
  };

  return {
    suggestions,
    confirmMatch,
    dismissSuggestion,
    confirmSelectedMatches,
    dismissSelectedMatches,
    confirmAllMatches,
    dismissAllSuggestions,
  };
};
