import { useState, useCallback } from 'react';
import { Account, Transaction, Budget, Tag, Category } from '../types';
import { emptyFinancialData } from '../demoData';
import { upsertEntity, removeEntityById } from '../utils/collection';

export const useFinancialDataState = () => {
  const [accounts, setAccounts] = useState<Account[]>(emptyFinancialData.accounts || []);
  const [transactions, setTransactions] = useState<Transaction[]>(emptyFinancialData.transactions || []);
  const [budgets, setBudgets] = useState<Budget[]>(emptyFinancialData.budgets || []);
  const [tags, setTags] = useState<Tag[]>(emptyFinancialData.tags || []);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>(emptyFinancialData.incomeCategories || []);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>(emptyFinancialData.expenseCategories || []);

  const saveAccount = useCallback((accountData: Account | Account[]) => {
    setAccounts((prev) => {
      const items = Array.isArray(accountData) ? accountData : [accountData];
      let updated = [...prev];
      items.forEach((item) => {
        updated = upsertEntity(updated, item);
      });
      return updated;
    });
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setAccounts((prev) => removeEntityById(prev, id));
  }, []);

  const saveTransaction = useCallback((txData: Transaction | Transaction[]) => {
    setTransactions((prev) => {
      const items = Array.isArray(txData) ? txData : [txData];
      let updated = [...prev];
      items.forEach((item) => {
        updated = upsertEntity(updated, item);
      });
      return updated;
    });
  }, []);

  const deleteTransaction = useCallback((ids: string | string[]) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    setTransactions((prev) => prev.filter((t) => !idList.includes(t.id)));
  }, []);

  return {
    accounts,
    setAccounts,
    saveAccount,
    deleteAccount,
    transactions,
    setTransactions,
    saveTransaction,
    deleteTransaction,
    budgets,
    setBudgets,
    tags,
    setTags,
    incomeCategories,
    setIncomeCategories,
    expenseCategories,
    setExpenseCategories,
  };
};
