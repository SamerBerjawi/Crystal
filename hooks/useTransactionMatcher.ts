import { useState, useMemo } from 'react';
import { Transaction, Account } from '../types';
import { convertToEur } from '../utils';
import { v4 as uuidv4 } from 'uuid';

export type Suggestion = {
  expenseTx: Transaction;
  incomeTx: Transaction;
  id: string; // [tx1.id, tx2.id].sort().join('|')
};

export const useTransactionMatcher = (
    transactions: Transaction[], 
    accounts: Account[], 
    saveTransaction: (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void
) => {
  const [ignoredSuggestionIds, setIgnoredSuggestionIds] = useState<string[]>([]);

  const suggestions = useMemo(() => {
    const potentialMatches: Suggestion[] = [];
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // 1. Get all non-transfer transactions
    const candidates = transactions.filter(tx => !tx.transferId);
    
    const expenses = candidates.filter(tx => tx.type === 'expense');
    const incomes = candidates.filter(tx => tx.type === 'income');

    // 2. Create a lookup map for incomes for faster searching.
    // Key: "amount|date" (e.g., "123.45|2023-10-27")
    // Amount is in EUR and positive.
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

    // 3. Iterate through expenses and check for matches in the map.
    for (const expense of expenses) {
        const expenseAmountKey = Math.abs(convertToEur(expense.amount, expense.currency)).toFixed(2);
        // Using replace for date string to avoid timezone issues.
        const expenseDate = new Date(expense.date.replace(/-/g, '/'));

        // Dates to check: same day, one day before, one day after.
        const datesToCheck = [
            expenseDate,
            new Date(expenseDate.getTime() - ONE_DAY_MS),
            new Date(expenseDate.getTime() + ONE_DAY_MS)
        ];

        let foundMatchForExpense = false;

        for (const date of datesToCheck) {
            if (foundMatchForExpense) break;

            const dateKey = date.toISOString().split('T')[0];
            const key = `${expenseAmountKey}|${dateKey}`;

            if (incomeMap.has(key)) {
                const potentialIncomes = incomeMap.get(key)!;
                
                // Iterate backwards because we might remove items from the array
                for (let i = potentialIncomes.length - 1; i >= 0; i--) {
                    const income = potentialIncomes[i];

                    // Final checks
                    if (expense.accountId === income.accountId) continue;

                    const suggestionId = [expense.id, income.id].sort().join('|');
                    if (ignoredSuggestionIds.includes(suggestionId)) continue;
                    
                    // We found a match
                    potentialMatches.push({
                        expenseTx: expense,
                        incomeTx: income,
                        id: suggestionId,
                    });
                    
                    // Remove this income from the map to prevent it from being matched again
                    potentialIncomes.splice(i, 1);
                    if(potentialIncomes.length === 0) {
                        incomeMap.delete(key);
                    }
                    
                    foundMatchForExpense = true;
                    break; // Move to the next expense
                }
            }
        }
    }

    return potentialMatches;
  }, [transactions, ignoredSuggestionIds]);

  const confirmMatch = (suggestion: Suggestion) => {
    const transferId = `xfer-${uuidv4()}`;
    const fromAccount = accounts.find(a => a.id === suggestion.expenseTx.accountId);
    const toAccount = accounts.find(a => a.id === suggestion.incomeTx.accountId);

    const expenseUpdate = {
      ...suggestion.expenseTx,
      category: 'Transfer',
      transferId,
      description: `Transfer to ${toAccount?.name || 'account'}`
    };
    const incomeUpdate = {
      ...suggestion.incomeTx,
      category: 'Transfer',
      transferId,
      description: `Transfer from ${fromAccount?.name || 'account'}`
    };
    
    saveTransaction([expenseUpdate, incomeUpdate]);
    
    // The suggestion will disappear on next render because the transactions now have a transferId
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const dismissSuggestion = (suggestion: Suggestion) => {
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const confirmAllMatches = () => {
    const transactionsToUpdate: (Omit<Transaction, 'id'> & { id: string })[] = [];
    const suggestionIdsToIgnore: string[] = [];

    suggestions.forEach(suggestion => {
        const transferId = `xfer-${uuidv4()}`;
        const fromAccount = accounts.find(a => a.id === suggestion.expenseTx.accountId);
        const toAccount = accounts.find(a => a.id === suggestion.incomeTx.accountId);

        transactionsToUpdate.push({
            ...suggestion.expenseTx,
            category: 'Transfer',
            transferId,
            description: `Transfer to ${toAccount?.name || 'account'}`
        });
        transactionsToUpdate.push({
            ...suggestion.incomeTx,
            category: 'Transfer',
            transferId,
            description: `Transfer from ${fromAccount?.name || 'account'}`
        });
        suggestionIdsToIgnore.push(suggestion.id);
    });
    
    if (transactionsToUpdate.length > 0) {
        saveTransaction(transactionsToUpdate);
    }
    
    setIgnoredSuggestionIds(prev => [...prev, ...suggestionIdsToIgnore]);
  };

  const dismissAllSuggestions = () => {
    const suggestionIdsToIgnore = suggestions.map(s => s.id);
    setIgnoredSuggestionIds(prev => [...prev, ...suggestionIdsToIgnore]);
  };


  return { suggestions, confirmMatch, dismissSuggestion, confirmAllMatches, dismissAllSuggestions };
};