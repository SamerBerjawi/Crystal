import { useState, useMemo } from 'react';
import { Transaction, Account } from '../types';
import { convertToEur, parseLocalDate, toLocalISOString } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { MatcherConfig, DEFAULT_MATCHER_CONFIG } from './useMatcherConfig';

export type Suggestion = {
  expenseTx: Transaction;
  incomeTx: Transaction;
  id: string; // [tx1.id, tx2.id].sort().join('|')
  matchScore: number; // 0 to 100
  daysDiff: number; // difference in days between expense and income
  amountDiff: number;
  amountDiffPercent: number;
};

export const useTransactionMatcher = (
  transactions: Transaction[],
  accounts: Account[],
  saveTransaction: (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void,
  config: MatcherConfig = DEFAULT_MATCHER_CONFIG
) => {
  const [ignoredSuggestionIds, setIgnoredSuggestionIds] = useState<string[]>([]);

  const suggestions = useMemo(() => {
    const potentialMatches: Suggestion[] = [];
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const lookbackLimit = config.lookbackDays || 7;
    const maxDaysDiff = config.dateVarianceDays ?? 3;

    let latestTxTime = 0;
    for (const tx of transactions) {
      const t = parseLocalDate(tx.date).getTime();
      if (t > latestTxTime) latestTxTime = t;
    }
    const refTime = Math.max(today.getTime(), latestTxTime);

    const candidates = transactions.filter(tx => {
      if (tx.transferId) return false;

      const txDate = parseLocalDate(tx.date);
      const daysOld = (refTime - txDate.getTime()) / ONE_DAY_MS;
      return daysOld <= lookbackLimit && daysOld >= -7;
    });

    const expenses = candidates.filter(tx => tx.type === 'expense');
    const incomes = candidates.filter(tx => tx.type === 'income');

    // Create a lookup map for incomes for faster searching
    const incomeMap = new Map<string, Transaction[]>();
    for (const income of incomes) {
      const amountKey = convertToEur(income.amount, income.currency).toFixed(2);
      const dateKey = income.date;
      const key = `${amountKey}|${dateKey}`;
      if (!incomeMap.has(key)) {
        incomeMap.set(key, []);
      }
      incomeMap.get(key)!.push(income);
    }

    for (const expense of expenses) {
      const expenseAmountKey = Math.abs(convertToEur(expense.amount, expense.currency)).toFixed(2);
      const expenseDate = parseLocalDate(expense.date);

      // Generate dates to check within maxDaysDiff
      const datesToCheck: { date: Date; offsetDays: number }[] = [];
      for (let offset = 0; offset <= maxDaysDiff; offset++) {
        if (offset === 0) {
          datesToCheck.push({ date: expenseDate, offsetDays: 0 });
        } else {
          datesToCheck.push({ date: new Date(expenseDate.getTime() - offset * ONE_DAY_MS), offsetDays: offset });
          datesToCheck.push({ date: new Date(expenseDate.getTime() + offset * ONE_DAY_MS), offsetDays: offset });
        }
      }

      let foundMatchForExpense = false;

      for (const { date, offsetDays } of datesToCheck) {
        if (foundMatchForExpense) break;

        const dateKey = toLocalISOString(date);
        const key = `${expenseAmountKey}|${dateKey}`;

        if (incomeMap.has(key)) {
          const potentialIncomes = incomeMap.get(key)!;

          for (let i = potentialIncomes.length - 1; i >= 0; i--) {
            const income = potentialIncomes[i];

            if (expense.accountId === income.accountId) continue;

            const suggestionId = [expense.id, income.id].sort().join('|');
            if (ignoredSuggestionIds.includes(suggestionId)) continue;

            // Calculate confidence score for transfer match (0-100)
            // Same date = 100%, 1 day diff = 85%, 2 days = 70%, 3+ days = 60%
            const dateScore = Math.max(50, 100 - offsetDays * 15);
            const score = Math.round(dateScore);

            potentialMatches.push({
              expenseTx: expense,
              incomeTx: income,
              id: suggestionId,
              matchScore: score,
              daysDiff: offsetDays,
              amountDiff: 0,
              amountDiffPercent: 0,
            });

            potentialIncomes.splice(i, 1);
            if (potentialIncomes.length === 0) {
              incomeMap.delete(key);
            }

            foundMatchForExpense = true;
            break;
          }
        }
      }
    }

    return potentialMatches;
  }, [transactions, ignoredSuggestionIds, config]);

  const confirmMatch = (suggestion: Suggestion) => {
    const transferId = `xfer-${uuidv4()}`;

    const expenseAccount = accounts.find(a => a.id === suggestion.expenseTx.accountId);
    const incomeAccount = accounts.find(a => a.id === suggestion.incomeTx.accountId);

    let fromAccount = expenseAccount;
    let toAccount = incomeAccount;

    if (expenseAccount && incomeAccount) {
      const toKeywords = ['to ', 'transfer to ', 'naar '];
      const expenseDescIndicatesItIsDestination = toKeywords.some(k =>
        suggestion.expenseTx.description.toLowerCase().includes(k + expenseAccount.name.toLowerCase())
      );

      if (expenseDescIndicatesItIsDestination) {
        fromAccount = incomeAccount;
        toAccount = expenseAccount;
      }
    }

    const expenseUpdate = {
      ...suggestion.expenseTx,
      category: 'Transfer',
      transferId,
      description: `Transfer to ${toAccount?.name || 'account'}`,
    };

    const incomeUpdate = {
      ...suggestion.incomeTx,
      category: 'Transfer',
      transferId,
      description: `Transfer from ${fromAccount?.name || 'account'}`,
    };

    saveTransaction([expenseUpdate, incomeUpdate]);
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const dismissSuggestion = (suggestion: Suggestion) => {
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const confirmSelectedMatches = (selectedList: Suggestion[]) => {
    const transactionsToUpdate: (Omit<Transaction, 'id'> & { id: string })[] = [];
    const suggestionIdsToIgnore: string[] = [];

    selectedList.forEach(suggestion => {
      const expenseAccount = accounts.find(a => a.id === suggestion.expenseTx.accountId);
      const incomeAccount = accounts.find(a => a.id === suggestion.incomeTx.accountId);

      let fromAccount = expenseAccount;
      let toAccount = incomeAccount;

      if (expenseAccount && incomeAccount) {
        const toKeywords = ['to ', 'transfer to ', 'naar '];
        const expenseDescIndicatesItIsDestination = toKeywords.some(k =>
          suggestion.expenseTx.description.toLowerCase().includes(k + expenseAccount.name.toLowerCase())
        );

        if (expenseDescIndicatesItIsDestination) {
          fromAccount = incomeAccount;
          toAccount = expenseAccount;
        }
      }

      const transferId = `xfer-${uuidv4()}`;

      transactionsToUpdate.push({
        ...suggestion.expenseTx,
        category: 'Transfer',
        transferId,
        description: `Transfer to ${toAccount?.name || 'account'}`,
      });
      transactionsToUpdate.push({
        ...suggestion.incomeTx,
        category: 'Transfer',
        transferId,
        description: `Transfer from ${fromAccount?.name || 'account'}`,
      });
      suggestionIdsToIgnore.push(suggestion.id);
    });

    if (transactionsToUpdate.length > 0) {
      saveTransaction(transactionsToUpdate);
    }

    setIgnoredSuggestionIds(prev => [...prev, ...suggestionIdsToIgnore]);
  };

  const dismissSelectedMatches = (selectedList: Suggestion[]) => {
    const idsToIgnore = selectedList.map(s => s.id);
    setIgnoredSuggestionIds(prev => [...prev, ...idsToIgnore]);
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
