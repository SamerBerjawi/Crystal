import { useState, useMemo } from 'react';
import { Transaction, Account } from '../types';
import { convertToEur, parseLocalDate } from '../utils';
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

// Transfer-related keywords in common banking languages
const TRANSFER_KEYWORDS = [
  'transfer', 'transfers', 'transferred',
  'overboeken', 'overboeking', 'overschrijving',
  'virement', 'virer',
  'überweisung', 'überwiesen',
  'traspaso', 'transferencia',
  'bonifico',
  'internal', 'between accounts',
  'own account', 'my account',
  'naar eigen', 'to own',
];

/**
 * Returns 0-20 based on how many transfer keywords appear in either description.
 * Caps at 20 pts.
 */
function descriptionTransferScore(desc1: string, desc2: string): number {
  const combined = `${desc1} ${desc2}`.toLowerCase();
  let hits = 0;
  for (const kw of TRANSFER_KEYWORDS) {
    if (combined.includes(kw)) {
      hits++;
      if (hits >= 2) break; // cap contribution
    }
  }
  return Math.min(20, hits * 12);
}

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
    const maxAmountPercent = config.amountVariancePercent ?? 10;
    const minScore = config.minMatchScore ?? 50;

    let latestTxTime = 0;
    for (const tx of transactions) {
      const t = parseLocalDate(tx.date).getTime();
      if (t > latestTxTime) latestTxTime = t;
    }
    const refTime = Math.max(today.getTime(), latestTxTime);

    // Filter candidates: non-transfer, within lookback window
    const candidates = transactions.filter(tx => {
      if (tx.transferId) return false;

      const txDate = parseLocalDate(tx.date);
      const daysOld = (refTime - txDate.getTime()) / ONE_DAY_MS;
      return daysOld <= lookbackLimit && daysOld >= -7;
    });

    const expenses = candidates.filter(tx => tx.type === 'expense');
    const incomes = candidates.filter(tx => tx.type === 'income');

    // Track incomes that have already been matched to prevent double-matching
    const matchedIncomeIds = new Set<string>();

    for (const expense of expenses) {
      const expenseAmountEur = Math.abs(convertToEur(expense.amount, expense.currency));
      const expenseDate = parseLocalDate(expense.date);
      const expenseDesc = expense.merchant || expense.description || '';

      let bestScore = -1;
      let bestIncome: Transaction | null = null;
      let bestDaysDiff = 0;
      let bestAmountDiffPct = 0;
      let bestAmountDiff = 0;

      for (const income of incomes) {
        // Skip already matched incomes
        if (matchedIncomeIds.has(income.id)) continue;

        // Must be from a different account
        if (expense.accountId === income.accountId) continue;

        // Date gate
        const incomeDate = parseLocalDate(income.date);
        const daysDiff = Math.abs((expenseDate.getTime() - incomeDate.getTime()) / ONE_DAY_MS);
        if (daysDiff > maxDaysDiff + 0.5) continue;

        // Amount gate — fuzzy tolerance
        const incomeAmountEur = Math.abs(convertToEur(income.amount, income.currency));
        const amountDiff = Math.abs(expenseAmountEur - incomeAmountEur);
        const amountDiffPct = incomeAmountEur > 0 ? (amountDiff / incomeAmountEur) * 100 : 100;
        if (amountDiffPct > maxAmountPercent + 0.5 && amountDiff > 2.0) continue;

        // Compute suggestion ID first so we can check if already ignored
        const suggestionId = [expense.id, income.id].sort().join('|');
        if (ignoredSuggestionIds.includes(suggestionId)) continue;

        // 3-factor score
        // Date: 0–40 pts (exact = 40, maxDaysDiff = 0)
        const dateScore = Math.max(0, 40 * (1 - daysDiff / (maxDaysDiff + 1)));
        // Amount: 0–40 pts (exact = 40, maxAmountPercent = 0)
        const amountScore = Math.max(0, 40 * (1 - amountDiffPct / (maxAmountPercent + 1)));
        // Description keywords: 0–20 pts
        const incomeDesc = income.merchant || income.description || '';
        const descScore = descriptionTransferScore(expenseDesc, incomeDesc);

        const score = Math.round(dateScore + amountScore + descScore);

        if (score > bestScore) {
          bestScore = score;
          bestIncome = income;
          bestDaysDiff = Math.round(daysDiff);
          bestAmountDiffPct = amountDiffPct;
          bestAmountDiff = expenseAmountEur - incomeAmountEur;
        }
      }

      if (bestIncome && bestScore >= minScore) {
        const suggestionId = [expense.id, bestIncome.id].sort().join('|');
        potentialMatches.push({
          expenseTx: expense,
          incomeTx: bestIncome,
          id: suggestionId,
          matchScore: bestScore,
          daysDiff: bestDaysDiff,
          amountDiff: Math.round(bestAmountDiff * 100) / 100,
          amountDiffPercent: Math.round(bestAmountDiffPct * 10) / 10,
        });
        matchedIncomeIds.add(bestIncome.id);
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

