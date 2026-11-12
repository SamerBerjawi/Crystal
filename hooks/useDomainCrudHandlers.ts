import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type {
  Account,
  AppPreferences,
  AssetClosureDetails,
  BillPayment,
  BillPaymentStatus,
  Budget,
  Category,
  EnableBankingConnection,
  FinancialData,
  FinancialGoal,
  ImportDataType,
  ImportExportHistoryItem,
  InvestmentTransaction,
  Invoice,
  LoanPaymentOverrides,
  Membership,
  Page,
  Prediction,
  LifeEvent,
  PriceHistoryEntry,
  RecurringTransaction,
  RecurringTransactionOverride,
  ScheduledPayment,
  Tag,
  Task,
  Transaction,
  UserStats,
  Warrant,
} from '../types';
import { convertCurrency, safeRound, toLocalDateTimeString, toLocalISOString } from '../utils';
import { applySavedRules, spareChangeFor } from '../utils/rules';
import { applyAssetLoanChoice, normalizeLoanAssetLinks } from '../utils/accountLinks';
import { upsertEntity, removeEntityById } from '../utils/collection';
import { withEditLocks } from '../utils/lockedFields';
import { forgetDeleted, rememberDeleted } from '../utils/deletedSync';
import { applyBalanceChanges, applyTransactionChanges, planTransactionChanges } from '../utils/transactionChanges';
import { collectCategorySubtreeNames, reassignDeletedCategoryAcrossEntities, renameCategoryAcrossEntities } from '../utils/categoryRefactor';
import { updateActivityStreak } from '../utils/challengesModel';

interface UseDomainCrudHandlersParams {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  investmentTransactions: InvestmentTransaction[];
  setInvestmentTransactions: React.Dispatch<React.SetStateAction<InvestmentTransaction[]>>;
  recurringTransactions: RecurringTransaction[];
  setRecurringTransactions: React.Dispatch<React.SetStateAction<RecurringTransaction[]>>;
  setRecurringTransactionOverrides: React.Dispatch<React.SetStateAction<RecurringTransactionOverride[]>>;
  setLoanPaymentOverrides: React.Dispatch<React.SetStateAction<LoanPaymentOverrides>>;
  setFinancialGoals: React.Dispatch<React.SetStateAction<FinancialGoal[]>>;
  setGoalOrderState: React.Dispatch<React.SetStateAction<string[]>>;
  budgets: Budget[];
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  warrants: Warrant[];
  setWarrants: React.Dispatch<React.SetStateAction<Warrant[]>>;
  setManualWarrantPrices: React.Dispatch<React.SetStateAction<Record<string, number | undefined>>>;
  setPriceHistory: React.Dispatch<React.SetStateAction<Record<string, PriceHistoryEntry[]>>>;
  setLastUpdated: React.Dispatch<React.SetStateAction<Date | null>>;
  assetPrices: Record<string, number | null>;
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  billsAndPayments: BillPayment[];
  setBillsAndPayments: React.Dispatch<React.SetStateAction<BillPayment[]>>;
  setMemberships: React.Dispatch<React.SetStateAction<Membership[]>>;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  setPredictions: React.Dispatch<React.SetStateAction<Prediction[]>>;
  setLifeEvents: React.Dispatch<React.SetStateAction<LifeEvent[]>>;
  incomeCategories: Category[];
  setIncomeCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  expenseCategories: Category[];
  setExpenseCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  setEnableBankingConnections: React.Dispatch<React.SetStateAction<EnableBankingConnection[]>>;
  setImportExportHistory: React.Dispatch<React.SetStateAction<ImportExportHistoryItem[]>>;
  setUserStats: React.Dispatch<React.SetStateAction<UserStats>>;
  viewingAccountId: string | null;
  setViewingAccountId: React.Dispatch<React.SetStateAction<string | null>>;
  viewingHoldingSymbol: string | null;
  setViewingHoldingSymbol: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentPage: (page: Page, tab?: string | null) => void;
  transactionsViewFilters: React.MutableRefObject<{ accountName?: string | null; tagId?: string | null }>;
  markSliceDirty: (slice?: keyof FinancialData) => void;
}

export function useDomainCrudHandlers({
  accounts,
  setAccounts,
  transactions,
  setTransactions,
  investmentTransactions,
  setInvestmentTransactions,
  recurringTransactions,
  setRecurringTransactions,
  setRecurringTransactionOverrides,
  setLoanPaymentOverrides,
  setFinancialGoals,
  setGoalOrderState,
  budgets,
  setBudgets,
  tasks,
  setTasks,
  warrants,
  setWarrants,
  setManualWarrantPrices,
  setPriceHistory,
  setLastUpdated,
  assetPrices,
  setTags,
  billsAndPayments,
  setBillsAndPayments,
  setMemberships,
  setInvoices,
  setPredictions,
  setLifeEvents,
  incomeCategories,
  setIncomeCategories,
  expenseCategories,
  setExpenseCategories,
  preferences,
  setPreferences,
  setEnableBankingConnections,
  setImportExportHistory,
  setUserStats,
  viewingAccountId,
  setViewingAccountId,
  viewingHoldingSymbol,
  setViewingHoldingSymbol,
  setCurrentPage,
  transactionsViewFilters,
  markSliceDirty,
}: UseDomainCrudHandlersParams) {
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  const recurringTransactionsRef = useRef(recurringTransactions);
  recurringTransactionsRef.current = recurringTransactions;

  const budgetsRef = useRef(budgets);
  budgetsRef.current = budgets;

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const warrantsRef = useRef(warrants);
  warrantsRef.current = warrants;

  const investmentTransactionsRef = useRef(investmentTransactions);
  investmentTransactionsRef.current = investmentTransactions;

  const billsAndPaymentsRef = useRef(billsAndPayments);
  billsAndPaymentsRef.current = billsAndPayments;

  const incomeCategoriesRef = useRef(incomeCategories);
  incomeCategoriesRef.current = incomeCategories;

  const expenseCategoriesRef = useRef(expenseCategories);
  expenseCategoriesRef.current = expenseCategories;

  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const assetPricesRef = useRef(assetPrices);
  assetPricesRef.current = assetPrices;

  const viewingAccountIdRef = useRef(viewingAccountId);
  viewingAccountIdRef.current = viewingAccountId;

  const viewingHoldingSymbolRef = useRef(viewingHoldingSymbol);
  viewingHoldingSymbolRef.current = viewingHoldingSymbol;

  const handleSaveAccount = useCallback((accountData: Omit<Account, 'id'> & { id?: string }) => {
    const accountWithDefaults = { ...accountData, includeInAnalytics: accountData.includeInAnalytics ?? true } as Omit<Account, 'id'> & { id?: string };
    const finalAccountId = accountData.id || `acc-${uuidv4()}`;
    const savedAccount = { ...accountWithDefaults, id: finalAccountId } as Account;

    setAccounts(prev => {
      const isNew = !prev.some(acc => acc.id === finalAccountId);
      if (isNew) savedAccount.status = 'open';

      let nextAccounts: Account[];
      if (isNew) {
        nextAccounts = [...prev, savedAccount];
      } else {
        nextAccounts = prev.map(acc => acc.id === finalAccountId ? savedAccount : acc);
      }

      if (savedAccount.isPrimary) {
        nextAccounts = nextAccounts.map(acc => {
          if (acc.type === savedAccount.type && acc.id !== savedAccount.id && acc.isPrimary) {
            return { ...acc, isPrimary: false };
          }
          return acc;
        });
      }

      if (savedAccount.type === 'Property' && 'linkedLoanId' in savedAccount) {
        nextAccounts = applyAssetLoanChoice(nextAccounts, savedAccount.id, savedAccount.linkedLoanId || undefined);
      }
      nextAccounts = normalizeLoanAssetLinks(nextAccounts);

      return nextAccounts;
    });
  }, [setAccounts]);

  const handleToggleAccountStatus = useCallback((accountId: string) => {
    setAccounts(prev => prev.map(acc => acc.id === accountId ? { ...acc, status: acc.status === 'closed' ? 'open' : 'closed', closureDetails: undefined } : acc));
  }, [setAccounts]);

  const handleCloseAsset = useCallback((accountId: string, details: AssetClosureDetails) => {
    const account = accountsRef.current.find(a => a.id === accountId);
    if (!account) return;

    let incomeTx: Transaction | undefined;
    if (details.closureType === 'Sold' && details.incomeAccountId) {
      incomeTx = {
        id: `tx-${uuidv4()}`,
        accountId: details.incomeAccountId,
        date: details.date,
        description: `Sale of ${account.name}`,
        amount: details.value,
        category: 'Other Income',
        type: 'income',
        currency: account.currency
      };

      setTransactions(txs => [incomeTx!, ...txs]);
    }

    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === accountId) {
          return {
            ...acc,
            status: 'closed' as const,
            closureDetails: incomeTx ? { ...details, transactionId: incomeTx.id } : details,
            balance: 0
          };
        }
        if (incomeTx && acc.id === details.incomeAccountId) {
          const convertedSaleProceeds = convertCurrency(
            details.value,
            account.currency,
            acc.currency,
            preferencesRef.current.conversionRates
          );
          return { ...acc, balance: safeRound(acc.balance + convertedSaleProceeds) };
        }
        return acc;
      });
    });

    setViewingAccountId(null);
    setCurrentPage('Accounts');
  }, [setCurrentPage, setAccounts, setTransactions, setViewingAccountId]);

  const handleRevertAccountClosure = useCallback((accountId: string) => {
    const account = accountsRef.current.find(a => a.id === accountId);
    if (!account || !account.closureDetails) return;

    const details = account.closureDetails;
    const transactionId = details.transactionId;

    if (transactionId) {
      setTransactions(txs => txs.filter(tx => tx.id !== transactionId));
    }

    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === accountId) {
          return {
            ...acc,
            status: 'open' as const,
            closureDetails: undefined,
            balance: details.value
          };
        }
        if (details.closureType === 'Sold' && details.incomeAccountId && acc.id === details.incomeAccountId) {
          const convertedSaleProceeds = convertCurrency(
            details.value,
            account.currency,
            acc.currency,
            preferencesRef.current.conversionRates
          );
          return { ...acc, balance: safeRound(acc.balance - convertedSaleProceeds) };
        }
        return acc;
      });
    });
  }, [setAccounts, setTransactions]);

  const handleDeleteAccount = useCallback((accountId: string) => {
    const accountToDelete = accountsRef.current.find(acc => acc.id === accountId);
    if (!accountToDelete) return;
    const impactedRecurringIds = new Set(recurringTransactionsRef.current.filter(rt => rt.accountId === accountId || rt.toAccountId === accountId).map(rt => rt.id));
    setAccounts(prev => prev.filter(acc => acc.id !== accountId).map(acc => {
      if (acc.linkedAssetId === accountId) return { ...acc, linkedAssetId: undefined };
      return acc;
    }));
    setTransactions(prev => prev.filter(tx => tx.accountId !== accountId));
    setInvestmentTransactions(prev => prev.filter(tx => tx.symbol !== accountToDelete.symbol));
    setWarrants(prev => prev.filter(w => w.isin !== accountToDelete.symbol));
    setManualWarrantPrices(prev => { const { [accountToDelete.symbol || '']: _, ...rest } = prev; return rest; });
    setRecurringTransactions(prev => prev.filter(rt => rt.accountId !== accountId && rt.toAccountId !== accountId));
    if (impactedRecurringIds.size > 0) { setRecurringTransactionOverrides(prev => prev.filter(override => !impactedRecurringIds.has(override.recurringTransactionId))); }
    setBillsAndPayments(prev => prev.filter(bill => bill.accountId !== accountId));
    if (viewingAccountIdRef.current === accountId) { setViewingAccountId(null); setCurrentPage('Accounts'); }
    if (viewingHoldingSymbolRef.current === accountToDelete.symbol) { setViewingHoldingSymbol(null); setCurrentPage('Investments'); }
  }, [setCurrentPage, setAccounts, setBillsAndPayments, setInvestmentTransactions, setManualWarrantPrices, setRecurringTransactionOverrides, setRecurringTransactions, setTransactions, setViewingAccountId, setViewingHoldingSymbol, setWarrants]);

  const handleSaveTransaction = useCallback((
    transactionDataArray: (Omit<Transaction, 'id'> & { id?: string })[],
    transactionIdsToDelete: string[] = [],
    options?: { autoSpareChange?: boolean; skipRules?: boolean; applyRules?: boolean; isNew?: boolean; fromSync?: boolean; resyncable?: boolean }
  ) => {
    const isNewRecord = (tx: { id?: string }) => !tx.id || options?.isNew;
    const finalTxArray = [...transactionDataArray];
    const currentPrefs = preferencesRef.current;
    const currentAccounts = accountsRef.current;

    if (!options?.skipRules) {
      finalTxArray.forEach((tx, index) => {
        if (isNewRecord(tx) || options?.applyRules) finalTxArray[index] = applySavedRules(tx, currentPrefs);
      });
    }

    if (options?.autoSpareChange) {
      finalTxArray.slice().forEach(tx => {
        if (!isNewRecord(tx)) return;
        if (tx.transferId?.startsWith('spare-')) return;
        if (tx.type !== 'expense') return;

        const linkedSpareChangeAccount = currentAccounts.find(a =>
          a.type === 'Investment' &&
          a.subType === 'Spare Change' &&
          a.linkedAccountId === tx.accountId
        );

        if (linkedSpareChangeAccount) {
          const spareAmount = spareChangeFor(tx.amount);

          if (spareAmount > 0) {
            const newTxId = tx.id || uuidv4();
            tx.id = newTxId;
            const spareTransferId = `spare-${newTxId}`;
            const sourceAcc = currentAccounts.find(a => a.id === tx.accountId);
            if (sourceAcc) {
              finalTxArray.push({
                accountId: tx.accountId,
                date: tx.date,
                description: `Spare change for ${tx.description || 'Synced Transaction'}`,
                merchant: 'Round Up',
                amount: -spareAmount,
                category: 'Transfer',
                type: 'expense',
                currency: sourceAcc.currency,
                transferId: spareTransferId,
              });
              finalTxArray.push({
                accountId: linkedSpareChangeAccount.id,
                date: tx.date,
                description: `Spare change from ${tx.description || 'Synced Transaction'}`,
                merchant: 'Round Up',
                amount: spareAmount,
                category: 'Transfer',
                type: 'income',
                currency: linkedSpareChangeAccount.currency,
                transferId: spareTransferId,
              });
            }
          }
        }
      });
    }

    if (!options?.fromSync && !options?.isNew) {
      finalTxArray.forEach((tx, index) => {
        if (!tx.id) return;
        finalTxArray[index] = withEditLocks(transactionsRef.current.find(existing => existing.id === tx.id), tx);
      });
    }

    if (!options?.fromSync) {
      const removed = transactionsRef.current.filter(tx => transactionIdsToDelete.includes(tx.id));
      if (removed.length > 0 && !options?.resyncable) setEnableBankingConnections(prev => rememberDeleted(prev, removed));
      if (!options?.isNew) {
        const restored = finalTxArray.filter(tx => tx.id && !transactionsRef.current.some(existing => existing.id === tx.id)) as Transaction[];
        if (restored.length > 0) setEnableBankingConnections(prev => forgetDeleted(prev, restored));
      }
    }

    const changes = planTransactionChanges(transactionsRef.current, finalTxArray, transactionIdsToDelete, currentAccounts);
    transactionsRef.current = applyTransactionChanges(transactionsRef.current, changes);
    setTransactions(prev => applyTransactionChanges(prev, changes));
    if (Object.keys(changes.balanceChanges).length > 0) setAccounts(prev => applyBalanceChanges(prev, changes.balanceChanges));
  }, [setAccounts, setEnableBankingConnections, setTransactions]);

  const handleDeleteTransactions = useCallback((transactionIds: string[], options?: { resyncable?: boolean }) => {
    if (transactionIds.length === 0) return;
    const deletedTxs = transactionsRef.current.filter(t => transactionIds.includes(t.id));
    handleSaveTransaction([], transactionIds, { resyncable: options?.resyncable });
    toast.success(
      deletedTxs.length === 1 
        ? `Deleted "${deletedTxs[0].description}"`
        : `Deleted ${deletedTxs.length} transactions`,
      {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => {
            handleSaveTransaction(deletedTxs);
            toast.info('Restored transaction(s)');
          }
        }
      }
    );
  }, [handleSaveTransaction]);

  const handleSaveInvestmentTransaction = useCallback((invTxData: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTxData?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => {
    const symbol = invTxData.symbol.toUpperCase();
    const type = invTxData.type?.toLowerCase();

    let currentHoldingQty = 0;
    investmentTransactionsRef.current.forEach(t => {
      if (t.symbol?.toUpperCase() === symbol && t.id !== invTxData.id) {
        const q = Number(t.quantity) || 0;
        if (t.type?.toLowerCase() === 'buy') {
          currentHoldingQty += q;
        } else if (t.type?.toLowerCase() === 'sell') {
          currentHoldingQty -= q;
        }
      }
    });
    warrantsRef.current.forEach(w => {
      if (w.isin?.toUpperCase() === symbol) {
        currentHoldingQty += Number(w.quantity) || 0;
      }
    });

    if (type === 'sell') {
      const sellQty = Number(invTxData.quantity) || 0;
      if (sellQty > currentHoldingQty) {
        toast.error(`Cannot process sale of ${sellQty} shares. You only hold ${currentHoldingQty} shares of ${symbol}.`);
        return;
      }
    }

    let nextTxList: InvestmentTransaction[];
    if (invTxData.id) {
      nextTxList = investmentTransactionsRef.current.map(t => t.id === invTxData.id ? { ...t, ...invTxData } as InvestmentTransaction : t);
      setInvestmentTransactions(nextTxList);
    } else {
      const newTx = { ...invTxData, id: `inv-txn-${uuidv4()}` } as InvestmentTransaction;
      nextTxList = [...investmentTransactionsRef.current, newTx];
      setInvestmentTransactions(nextTxList);
      if (cashTxData) handleSaveTransaction([cashTxData]);
    }

    let remainingQtyForSymbol = 0;
    nextTxList.forEach(t => {
      if (t.symbol?.toUpperCase() === symbol) {
        const q = Number(t.quantity) || 0;
        if (t.type?.toLowerCase() === 'buy') {
          remainingQtyForSymbol += q;
        } else if (t.type?.toLowerCase() === 'sell') {
          remainingQtyForSymbol -= q;
        }
      }
    });
    warrantsRef.current.forEach(w => {
      if (w.isin?.toUpperCase() === symbol) {
        remainingQtyForSymbol += Number(w.quantity) || 0;
      }
    });

    const price = assetPricesRef.current[symbol] ?? invTxData.price;
    const finalBalance = remainingQtyForSymbol * price;

    if (newAccount) {
      const accountWithBalance = { ...newAccount, balance: finalBalance };
      handleSaveAccount(accountWithBalance);
    }

    setAccounts(prevAccounts => prevAccounts.map(account => {
      if (account.symbol?.toUpperCase() === symbol && account.type === 'Investment') {
        return {
          ...account,
          balance: parseFloat(finalBalance.toFixed(account.currency === 'BTC' ? 8 : 2))
        };
      }
      return account;
    }));
  }, [handleSaveAccount, handleSaveTransaction, setAccounts, setInvestmentTransactions]);

  const handleDeleteInvestmentTransaction = useCallback((id: string) => {
    setInvestmentTransactions(prev => prev.filter(t => t.id !== id));
  }, [setInvestmentTransactions]);

  const handleSaveRecurringTransaction = useCallback((recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => {
    setRecurringTransactions(prev => upsertEntity(prev, recurringData, () => `rec-${uuidv4()}`));
  }, [setRecurringTransactions]);

  const handleDeleteRecurringTransaction = useCallback((id: string) => {
    const item = recurringTransactionsRef.current.find(r => r.id === id);
    setRecurringTransactions(prev => removeEntityById(prev, id));
    if (item) {
      toast.success(`Removed subscription "${item.description || item.merchant}"`, {
        action: {
          label: 'Undo',
          onClick: () => {
            setRecurringTransactions(prev => [...prev, item]);
            toast.info('Restored subscription');
          }
        }
      });
    }
  }, [setRecurringTransactions]);

  const handleSaveLoanPaymentOverrides = useCallback((accountId: string, overrides: Record<number, Partial<ScheduledPayment>>) => {
    setLoanPaymentOverrides(prev => ({ ...prev, [accountId]: overrides }));
  }, [setLoanPaymentOverrides]);

  const handleSaveRecurringOverride = useCallback((override: RecurringTransactionOverride) => {
    setRecurringTransactionOverrides(prev => {
      const existingIndex = prev.findIndex(o => o.recurringTransactionId === override.recurringTransactionId && o.originalDate === override.originalDate);
      if (existingIndex > -1) { const newOverrides = [...prev]; newOverrides[existingIndex] = { ...newOverrides[existingIndex], ...override }; return newOverrides; }
      return [...prev, override];
    });
  }, [setRecurringTransactionOverrides]);

  const handleDeleteRecurringOverride = useCallback((recurringTransactionId: string, originalDate: string) => {
    setRecurringTransactionOverrides(prev => prev.filter(o => !(o.recurringTransactionId === recurringTransactionId && o.originalDate === originalDate)));
  }, [setRecurringTransactionOverrides]);

  const handleSaveFinancialGoal = useCallback((goalData: Omit<FinancialGoal, 'id'> & { id?: string }) => {
    setFinancialGoals(prev => upsertEntity(prev, goalData, () => `goal-${uuidv4()}`));
  }, [setFinancialGoals]);

  const handleDeleteFinancialGoal = useCallback((id: string) => {
    setFinancialGoals((prev) => {
      const goalToDelete = prev.find((g) => g.id === id);
      if (!goalToDelete) return prev;
      const idsToDelete = [id];
      if (goalToDelete.isBucket) { idsToDelete.push(...prev.filter((g) => g.parentId === id).map((g) => g.id)); }
      return prev.filter((g) => !idsToDelete.includes(g.id));
    });
  }, [setFinancialGoals]);

  const handleSetGoalOrder = useCallback((order: string[]) => {
    setGoalOrderState(order);
    markSliceDirty('goalOrder');
  }, [markSliceDirty, setGoalOrderState]);

  const handleSaveBudget = useCallback((budgetData: Omit<Budget, 'id'> & { id?: string }) => {
    setBudgets(prev => upsertEntity(prev, budgetData, () => `bud-${uuidv4()}`));
  }, [setBudgets]);

  const handleDeleteBudget = useCallback((id: string) => {
    const item = budgetsRef.current.find(b => b.id === id);
    setBudgets(prev => removeEntityById(prev, id));
    if (item) {
      toast.success(`Deleted budget for "${item.categoryName}"`, {
        action: {
          label: 'Undo',
          onClick: () => {
            setBudgets(prev => prev.some(b => b.id === item.id) ? prev : [...prev, item]);
            toast.info('Restored budget');
          }
        }
      });
    }
  }, [setBudgets]);

  const handleSaveTask = useCallback((taskData: Omit<Task, 'id'> & { id?: string }) => {
    setTasks(prev => upsertEntity(prev, taskData, () => `task-${uuidv4()}`));
  }, [setTasks]);

  const handleDeleteTask = useCallback((taskId: string) => {
    const item = tasksRef.current.find(t => t.id === taskId);
    setTasks(prev => removeEntityById(prev, taskId));
    if (item) {
      toast.success(`Deleted task "${item.title}"`, {
        action: {
          label: 'Undo',
          onClick: () => {
            setTasks(prev => [...prev, item]);
            toast.info('Restored task');
          }
        }
      });
    }
  }, [setTasks]);

  const handleSaveWarrant = useCallback((warrantData: Omit<Warrant, 'id'> & { id?: string }) => {
    let warrantId = warrantData.id;
    if (warrantData.id) {
      setWarrants(prev => prev.map(w => w.id === warrantData.id ? { ...w, ...warrantData } as Warrant : w));
    } else {
      warrantId = `warr-${uuidv4()}`;
      setWarrants(prev => [...prev, { ...warrantData, id: warrantId } as Warrant]);
      if (warrantData.isin && !accountsRef.current.some(acc => acc.type === 'Investment' && acc.symbol?.toUpperCase() === warrantData.isin.toUpperCase())) {
        handleSaveAccount({ name: warrantData.name || 'Warrant', type: 'Investment', subType: 'Warrant', symbol: warrantData.isin.toUpperCase(), balance: 0, currency: 'EUR' });
      }
    }

    if (warrantId) {
      setBillsAndPayments(prev => {
        const otherBills = prev.filter(b => b.warrantId !== warrantId);
        const newBills: BillPayment[] = (warrantData.taxPayments || []).map((tp, index) => ({
          id: `bill-tax-${warrantId}-${index}`,
          description: `Tax Payment: ${warrantData.name} (${warrantData.isin})`,
          amount: -tp.amount,
          type: 'payment',
          currency: 'EUR',
          dueDate: tp.dueDate,
          status: 'unpaid',
          warrantId: warrantId
        }));
        return [...otherBills, ...newBills];
      });
    }
  }, [handleSaveAccount, setBillsAndPayments, setWarrants]);

  const handleDeleteWarrant = useCallback((warrantId: string) => {
    const warrantToDelete = warrantsRef.current.find(w => w.id === warrantId);
    setWarrants(prev => prev.filter(w => w.id !== warrantId));
    setBillsAndPayments(prev => prev.filter(b => b.warrantId !== warrantId));
    if (warrantToDelete) {
      setManualWarrantPrices(prev => { const updated = { ...prev }; delete updated[warrantToDelete.isin]; return updated; });
    }
  }, [setBillsAndPayments, setManualWarrantPrices, setWarrants]);

  const handleManualWarrantPrice = useCallback((isin: string, priceOrEntries: number | null | { date: string, price: number }[], date?: string) => {
    if (Array.isArray(priceOrEntries)) {
      setPriceHistory((prev: Record<string, PriceHistoryEntry[]>) => {
        const historyMap = new Map<string, PriceHistoryEntry>((prev[isin] || []).map((item: PriceHistoryEntry) => [item.date, item]));
        priceOrEntries.forEach((entry: { date: string, price: number }) => historyMap.set(entry.date, entry as PriceHistoryEntry));
        const newList = Array.from(historyMap.values()).sort((a: PriceHistoryEntry, b: PriceHistoryEntry) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = newList.length > 0 ? newList[newList.length - 1] : null;
        setManualWarrantPrices(cp => { const np = { ...cp }; if (latest) np[isin] = latest.price; else if (newList.length === 0) delete np[isin]; return np; });
        return { ...prev, [isin]: newList };
      });
      setLastUpdated(new Date());
      return;
    }
    setPriceHistory((prev: Record<string, PriceHistoryEntry[]>) => {
      let newList = prev[isin] ? [...prev[isin]] : [];
      const targetDate = date || toLocalISOString(new Date());
      if (priceOrEntries === null) {
        newList = newList.filter((item: PriceHistoryEntry) => item.date !== targetDate);
      } else {
        const index = newList.findIndex((item: PriceHistoryEntry) => item.date === targetDate);
        if (index > -1) newList[index] = { date: targetDate, price: priceOrEntries };
        else newList.push({ date: targetDate, price: priceOrEntries });
      }
      newList.sort((a: PriceHistoryEntry, b: PriceHistoryEntry) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const latest = newList.length > 0 ? newList[newList.length - 1] : null;
      setManualWarrantPrices(cp => { const np = { ...cp }; if (latest) np[isin] = latest.price; else if (priceOrEntries === null && newList.length === 0) delete np[isin]; return np; });
      return { ...prev, [isin]: newList };
    });
    setLastUpdated(new Date());
  }, [setLastUpdated, setManualWarrantPrices, setPriceHistory]);

  const handleSaveTag = useCallback((tagData: Omit<Tag, 'id'> & { id?: string }) => {
    setTags(prev => upsertEntity(prev, tagData, () => `tag-${uuidv4()}`));
  }, [setTags]);

  const handleDeleteTag = useCallback((tagId: string) => {
    setTags(prev => prev.filter(t => t.id !== tagId));
    setTransactions(prev => prev.map(tx => tx.tagIds?.includes(tagId) ? { ...tx, tagIds: tx.tagIds.filter(id => id !== tagId) } : tx));
    if (transactionsViewFilters.current.tagId === tagId) transactionsViewFilters.current.tagId = null;
  }, [setTags, setTransactions, transactionsViewFilters]);

  const handleSaveBillPayment = useCallback((billData: Omit<BillPayment, 'id'> & { id?: string }) => {
    setBillsAndPayments(prev => upsertEntity(prev, billData, () => `bill-${uuidv4()}`));
  }, [setBillsAndPayments]);

  const handleDeleteBillPayment = useCallback((billId: string) => {
    setBillsAndPayments(prev => removeEntityById(prev, billId));
  }, [setBillsAndPayments]);

  const handleMarkBillAsPaid = useCallback((billId: string, paymentAccountId: string, paymentDate: string) => {
    const bill = billsAndPaymentsRef.current.find(b => b.id === billId);
    if (!bill) return;
    setBillsAndPayments(prev => prev.map(b => b.id === billId ? { ...b, status: 'paid' as BillPaymentStatus, accountId: paymentAccountId, dueDate: paymentDate } : b));
    const paymentAccount = accountsRef.current.find(a => a.id === paymentAccountId);
    if (paymentAccount) { handleSaveTransaction([{ accountId: paymentAccountId, date: paymentDate, description: bill.description, amount: bill.amount, category: bill.amount >= 0 ? 'Income' : 'Bills & Utilities', type: bill.amount >= 0 ? 'income' : 'expense', currency: paymentAccount.currency, }]); }
  }, [handleSaveTransaction, setBillsAndPayments]);

  const handleSaveMembership = useCallback((membershipData: Omit<Membership, 'id'> & { id?: string }) => {
    setMemberships(prev => upsertEntity(prev, membershipData, () => `mem-${uuidv4()}`));
  }, [setMemberships]);

  const handleDeleteMembership = useCallback((membershipId: string) => {
    setMemberships(prev => removeEntityById(prev, membershipId));
  }, [setMemberships]);

  const handleSaveInvoice = useCallback((invoiceData: Omit<Invoice, 'id'> & { id?: string }) => {
    setInvoices(prev => upsertEntity(prev, invoiceData, () => `inv-${uuidv4()}`));
  }, [setInvoices]);

  const handleDeleteInvoice = useCallback((id: string) => {
    setInvoices(prev => removeEntityById(prev, id));
  }, [setInvoices]);

  const handleSavePrediction = useCallback((predictionData: Omit<Prediction, 'id'> & { id?: string }) => {
    setPredictions(prev => upsertEntity(prev, predictionData, () => `pred-${uuidv4()}`));
  }, [setPredictions]);

  const handleSaveLifeEvent = useCallback((eventData: Omit<LifeEvent, 'id'> & { id?: string }) => {
    setLifeEvents(prev => upsertEntity(prev, eventData, () => `event-${uuidv4()}`));
  }, [setLifeEvents]);

  const handleDeleteLifeEvent = useCallback((id: string) => {
    setLifeEvents(prev => removeEntityById(prev, id));
  }, [setLifeEvents]);

  const handleDeletePrediction = useCallback((id: string) => {
    setPredictions(prev => removeEntityById(prev, id));
  }, [setPredictions]);

  const handleRenameCategory = useCallback((oldName: string, newName: string) => {
    const currentPrefs = preferencesRef.current;
    const updated = renameCategoryAcrossEntities(oldName, newName, {
      transactions: transactionsRef.current,
      recurringTransactions: recurringTransactionsRef.current,
      budgets: budgetsRef.current,
      merchantRules: currentPrefs.merchantRules,
      transactionRules: currentPrefs.transactionRules,
    });
    setTransactions(updated.transactions);
    setRecurringTransactions(updated.recurringTransactions);
    setBudgets(updated.budgets);
    if (updated.merchantRules !== currentPrefs.merchantRules || updated.transactionRules !== currentPrefs.transactionRules) {
      setPreferences(prev => ({
        ...prev,
        ...(updated.merchantRules ? { merchantRules: updated.merchantRules } : {}),
        ...(updated.transactionRules ? { transactionRules: updated.transactionRules } : {}),
      }));
    }
  }, [setBudgets, setPreferences, setRecurringTransactions, setTransactions]);

  const handleDeleteCategoryCascade = useCallback((deletedCategory: Category, fallbackName: string) => {
    const currentPrefs = preferencesRef.current;
    const updated = reassignDeletedCategoryAcrossEntities(deletedCategory, fallbackName, {
      transactions: transactionsRef.current,
      recurringTransactions: recurringTransactionsRef.current,
      budgets: budgetsRef.current,
      merchantRules: currentPrefs.merchantRules,
      transactionRules: currentPrefs.transactionRules,
    });
    setTransactions(updated.transactions);
    setRecurringTransactions(updated.recurringTransactions);
    setBudgets(updated.budgets);
    if (updated.merchantRules !== currentPrefs.merchantRules || updated.transactionRules !== currentPrefs.transactionRules) {
      setPreferences(prev => ({
        ...prev,
        ...(updated.merchantRules ? { merchantRules: updated.merchantRules } : {}),
        ...(updated.transactionRules ? { transactionRules: updated.transactionRules } : {}),
      }));
    }
  }, [setBudgets, setPreferences, setRecurringTransactions, setTransactions]);

  const handlePublishImport = useCallback(async (items: any[], dataType: ImportDataType, fileName: string, originalData: Record<string, any>[], errors: Record<number, Record<string, string>>, newAccountsArg?: Account[]) => {
    const importId = `imp-${uuidv4()}`;
    if (newAccountsArg && newAccountsArg.length > 0) {
      newAccountsArg.forEach(acc => {
        const netForAccount = dataType === 'transactions'
          ? items
              .filter(t => t.accountId === acc.id)
              .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
          : 0;
        handleSaveAccount({ ...acc, balance: safeRound((acc.balance || 0) + netForAccount, 2) });
      });
    }
    if (dataType === 'accounts') { items.forEach(acc => handleSaveAccount(acc)); }
    else if (dataType === 'transactions') {
      const existingNames = new Set<string>(['Uncategorized', 'Transfer']);
      [...incomeCategoriesRef.current, ...expenseCategoriesRef.current].forEach(cat => {
        collectCategorySubtreeNames(cat).forEach(name => existingNames.add(name));
      });
      const newIncomeCats: Category[] = [];
      const newExpenseCats: Category[] = [];
      items.forEach(t => {
        const catName = (t.category || '').trim();
        if (catName && !existingNames.has(catName)) {
          existingNames.add(catName);
          const newCat: Category = {
            id: `cat-${uuidv4()}`,
            name: catName,
            color: '#6366f1',
            icon: t.type === 'income' ? 'arrow-down-left-01' : 'receipt',
            classification: t.type === 'income' ? 'income' : 'expense',
            subCategories: [],
          };
          if (t.type === 'income') newIncomeCats.push(newCat);
          else newExpenseCats.push(newCat);
        }
      });
      if (newIncomeCats.length > 0) setIncomeCategories(prev => [...prev, ...newIncomeCats]);
      if (newExpenseCats.length > 0) setExpenseCategories(prev => [...prev, ...newExpenseCats]);

      const txsWithImportId = items.map(t => ({ ...t, importId }));
      handleSaveTransaction(txsWithImportId, [], { autoSpareChange: true });
    }
    setUserStats(prev => updateActivityStreak(prev, toLocalISOString(new Date())));

    const details = `Imported ${items.length} ${dataType}${newAccountsArg?.length ? ` and created ${newAccountsArg.length} new accounts` : ''}.`;

    setImportExportHistory(prev => [{
      id: importId,
      type: 'import',
      dataType,
      fileName,
      date: toLocalDateTimeString(new Date()),
      status: Object.keys(errors).length > 0 ? 'Failed' : 'Complete',
      itemCount: items.length,
      details,
      importedData: originalData,
      errors,
    }, ...prev]);
  }, [expenseCategories, handleSaveAccount, handleSaveTransaction, incomeCategories, setExpenseCategories, setImportExportHistory, setIncomeCategories, setUserStats]);

  const handleLogExport = useCallback((dataType: ImportDataType, format: 'csv' | 'json', itemCount: number) => {
    const exportId = `exp-${uuidv4()}`;
    setImportExportHistory(prev => [{
      id: exportId,
      type: 'export',
      dataType,
      fileName: `Export (${format.toUpperCase()})`,
      date: new Date().toISOString(),
      status: 'Complete',
      itemCount,
      details: `Exported ${itemCount} items as ${format.toUpperCase()}.`
    }, ...prev]);
  }, [setImportExportHistory]);

  const handleDeleteHistoryItem = useCallback((id: string) => {
    setImportExportHistory(prev => prev.filter(item => item.id !== id));
  }, [setImportExportHistory]);

  const handleDeleteImportedTransactions = useCallback((importId: string) => {
    const idsToDelete = transactionsRef.current.filter(t => t.importId === importId).map(t => t.id);
    if (idsToDelete.length > 0) handleDeleteTransactions(idsToDelete, { resyncable: true });
  }, [handleDeleteTransactions]);

  return {
    transactionsRef,
    handleSaveAccount,
    handleToggleAccountStatus,
    handleCloseAsset,
    handleRevertAccountClosure,
    handleDeleteAccount,
    handleSaveTransaction,
    handleDeleteTransactions,
    handleSaveInvestmentTransaction,
    handleDeleteInvestmentTransaction,
    handleSaveRecurringTransaction,
    handleDeleteRecurringTransaction,
    handleSaveLoanPaymentOverrides,
    handleSaveRecurringOverride,
    handleDeleteRecurringOverride,
    handleSaveFinancialGoal,
    handleDeleteFinancialGoal,
    handleSetGoalOrder,
    handleSaveBudget,
    handleDeleteBudget,
    handleSaveTask,
    handleDeleteTask,
    handleSaveWarrant,
    handleDeleteWarrant,
    handleManualWarrantPrice,
    handleSaveTag,
    handleDeleteTag,
    handleSaveBillPayment,
    handleDeleteBillPayment,
    handleMarkBillAsPaid,
    handleSaveMembership,
    handleDeleteMembership,
    handleSaveInvoice,
    handleDeleteInvoice,
    handleSavePrediction,
    handleSaveLifeEvent,
    handleDeleteLifeEvent,
    handleDeletePrediction,
    handleRenameCategory,
    handleDeleteCategoryCascade,
    handlePublishImport,
    handleLogExport,
    handleDeleteHistoryItem,
    handleDeleteImportedTransactions,
  };
}
