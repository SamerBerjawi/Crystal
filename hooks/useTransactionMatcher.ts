import { useState, useMemo } from 'react';
import { Transaction, Account } from '../types';
import { convertToEur, parseDateAsUTC } from '../utils';
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
        const expenseDate = parseDateAsUTC(expense.date);

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

    const expenseAccount = accounts.find(a => a.id === suggestion.expenseTx.accountId);
    const incomeAccount = accounts.find(a => a.id === suggestion.incomeTx.accountId);

    // Default direction: the account with the debit is the source.
    let fromAccount = expenseAccount;
    let toAccount = incomeAccount;

    // Heuristic: Check for confusing bank descriptions.
    if (expenseAccount && incomeAccount) {
        const toKeywords = ['to ', 'transfer to ', 'naar '];
        // If the debit transaction's description is "Transfer to [itself]",
        // it means this account is actually the destination.
        const expenseDescIndicatesItIsDestination = toKeywords.some(k => 
            suggestion.expenseTx.description.toLowerCase().includes(k + expenseAccount.name.toLowerCase())
        );
        
        if (expenseDescIndicatesItIsDestination) {
            // Swap the roles: the account with the credit becomes the source.
            fromAccount = incomeAccount;
            toAccount = expenseAccount;
        }
    }

    // Update the original transactions without changing their type or amount.
    // This correctly links them while preserving balance integrity.
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
    
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const dismissSuggestion = (suggestion: Suggestion) => {
    setIgnoredSuggestionIds(prev => [...prev, suggestion.id]);
  };

  const confirmAllMatches = () => {
    const transactionsToUpdate: (Omit<Transaction, 'id'> & { id: string })[] = [];
    const suggestionIdsToIgnore: string[] = [];

    suggestions.forEach(suggestion => {
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