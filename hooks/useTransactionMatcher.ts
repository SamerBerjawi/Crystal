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
                
                for (let i = potentialIncomes.length - 1; i >= 0; i--) {
                    const income = potentialIncomes[i];

                    if (expense.accountId === income.accountId) continue;

                    const suggestionId = [expense.id, income.id].sort().join('|');
                    if (ignoredSuggestionIds.includes(suggestionId)) continue;
                    
                    potentialMatches.push({
                        expenseTx: expense,
                        incomeTx: income,
                        id: suggestionId,
                    });
                    
                    potentialIncomes.splice(i, 1);
                    if(potentialIncomes.length === 0) {
                        incomeMap.delete(key);
                    }
                    
                    foundMatchForExpense = true;
                    break; 
                }
            }
        }
    }

    return potentialMatches;
  }, [transactions, ignoredSuggestionIds]);

  const confirmMatch = (suggestion: Suggestion) => {
    const transferId = `xfer-${uuidv4()}`;
    
    let { expenseTx, incomeTx } = suggestion;

    // Heuristic to detect reversed sign conventions by checking descriptions
    const incomeAccount = accounts.find(a => a.id === incomeTx.accountId);
    const expenseAccount = accounts.find(a => a.id === expenseTx.accountId);
    
    if (expenseAccount && incomeAccount) {
        const keywordsTo = ['to ', 'transfer to ', 'naar '];
        const keywordsFrom = ['from ', 'transfer from ', 'van '];

        // Check if the descriptions are the "wrong" way around for the types
        const expenseDescImpliesFrom = keywordsFrom.some(k => expenseTx.description.toLowerCase().includes(k + incomeAccount.name.toLowerCase()));
        const incomeDescImpliesTo = keywordsTo.some(k => incomeTx.description.toLowerCase().includes(k + expenseAccount.name.toLowerCase()));
        
        if (expenseDescImpliesFrom && incomeDescImpliesTo) {
            // The roles are reversed based on descriptions. Swap them.
            [expenseTx, incomeTx] = [incomeTx, expenseTx];
        }
    }
    
    // After potential swapping, `expenseTx` is the true outgoing transaction
    // and `incomeTx` is the true incoming transaction.
    const fromAccount = accounts.find(a => a.id === expenseTx.accountId);
    const toAccount = accounts.find(a => a.id === incomeTx.accountId);

    const expenseUpdate = {
      ...expenseTx,
      amount: -Math.abs(expenseTx.amount), // Ensure amount is negative
      type: 'expense' as 'expense',
      category: 'Transfer',
      transferId,
      description: `Transfer to ${toAccount?.name || 'account'}`
    };

    const incomeUpdate = {
      ...incomeTx,
      amount: Math.abs(incomeTx.amount), // Ensure amount is positive
      type: 'income' as 'income',
      category: 'Transfer',
      transferId,
      description: `Transfer from ${fromAccount?.name || 'account'}`
    };
    
    saveTransaction([expenseUpdate, incomeUpdate]);
    
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const dismissSuggestion = (suggestion: Suggestion) => {
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const confirmAllMatches = () => {
    const transactionsToUpdate: (Omit<Transaction, 'id'> & { id: string })[] = [];
    const suggestionIdsToIgnore: string[] = [];

    suggestions.forEach(suggestion => {
        let { expenseTx, incomeTx } = suggestion;

        // Same reversal logic as in `confirmMatch`
        const incomeAccount = accounts.find(a => a.id === incomeTx.accountId);
        const expenseAccount = accounts.find(a => a.id === expenseTx.accountId);
        
        if (expenseAccount && incomeAccount) {
            const keywordsTo = ['to ', 'transfer to ', 'naar '];
            const keywordsFrom = ['from ', 'transfer from ', 'van '];
            const expenseDescImpliesFrom = keywordsFrom.some(k => expenseTx.description.toLowerCase().includes(k + incomeAccount.name.toLowerCase()));
            const incomeDescImpliesTo = keywordsTo.some(k => incomeTx.description.toLowerCase().includes(k + expenseAccount.name.toLowerCase()));
            if (expenseDescImpliesFrom && incomeDescImpliesTo) {
                [expenseTx, incomeTx] = [incomeTx, expenseTx];
            }
        }

        const fromAccount = accounts.find(a => a.id === expenseTx.accountId);
        const toAccount = accounts.find(a => a.id === incomeTx.accountId);
        const transferId = `xfer-${uuidv4()}`;

        transactionsToUpdate.push({
            ...expenseTx,
            amount: -Math.abs(expenseTx.amount),
            type: 'expense',
            category: 'Transfer',
            transferId,
            description: `Transfer to ${toAccount?.name || 'account'}`
        });
        transactionsToUpdate.push({
            ...incomeTx,
            amount: Math.abs(incomeTx.amount),
            type: 'income',
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