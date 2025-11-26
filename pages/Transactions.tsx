
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, CHECKBOX_STYLE } from '../constants';
import { Transaction, Account, DisplayTransaction, RecurringTransaction, Category } from '../types';
import Card from '../components/Card';
import { formatCurrency, fuzzySearch, convertToEur, arrayToCSV, downloadCSV, parseDateAsUTC } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectFilter from '../components/MultiSelectFilter';
import MultiAccountFilter from '../components/MultiAccountFilter';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { BarChart, Bar, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis, Cell } from 'recharts';

interface TransactionsProps {
  accountFilter: string | null;
  setAccountFilter: (accountName: string | null) => void;
  tagFilter: string | null;
  setTagFilter: (tagId: string | null) => void;
}

const Transactions: React.FC<TransactionsProps> = ({ accountFilter, setAccountFilter, tagFilter, setTagFilter }) => {
  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { saveRecurringTransaction } = useScheduleContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('');

  // Local state for multi-select filters
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCategorizeModalOpen, setIsCategorizeModalOpen] = useState(false);
  const [isBulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [transactionToMakeRecurring, setTransactionToMakeRecurring] = useState<(Omit<RecurringTransaction, 'id'> & { id?: string }) | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, transaction: DisplayTransaction } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Sync with global filters from props
  useEffect(() => {
    if (accountFilter) {
      const account = accounts.find(a => a.name === accountFilter);
      if (account) setSelectedAccountIds([account.id]);
    }
  }, [accountFilter, accounts]);

  useEffect(() => {
    if (tagFilter) {
      setSelectedTagIds([tagFilter]);
    }
  }, [tagFilter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
            event.preventDefault();
            searchInputRef.current?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
            setContextMenu(null);
        }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
        document.removeEventListener('mousedown', handleClick);
    };
  }, []);

  // Reset to first page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, typeFilter, startDate, endDate, selectedAccountIds, selectedCategoryNames, selectedTagIds, minAmount, maxAmount, merchantFilter]);


  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc; return map; }, {} as { [key: string]: Account }), [accounts]);
  const accountMapByName = useMemo(() => accounts.reduce((map, acc) => { map[acc.name] = acc; return map; }, {} as Record<string, Account>), [accounts]);
  
  const getCategoryDetails = (name: string, categories: Category[]): { icon?: string; color?: string } => {
    for (const cat of categories) {
        if (cat.name === name) return { icon: cat.icon, color: cat.color };
        if (cat.subCategories.length > 0) {
            const found = getCategoryDetails(name, cat.subCategories);
            if (found.icon) return found;
        }
    }
    return {};
  };

  // Recursive function to find a category by name in a tree
  const findCategoryByName = (name: string, categories: Category[]): Category | undefined => {
    for (const cat of categories) {
        if (cat.name === name) return cat;
        if (cat.subCategories && cat.subCategories.length > 0) {
            const found = findCategoryByName(name, cat.subCategories);
            if (found) return found;
        }
    }
    return undefined;
  };

  const displayTransactions = useMemo(() => {
    const processedTransferIds = new Set<string>();
    const result: DisplayTransaction[] = [];

    const sortedTransactions = [...transactions].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());

    const transferLookup = sortedTransactions.reduce((map, tx) => {
        if (!tx.transferId) return map;
        const current = map.get(tx.transferId) || { income: undefined as Transaction | undefined, expense: undefined as Transaction | undefined };
        if (tx.amount >= 0) {
            current.income = tx;
        } else {
            current.expense = tx;
        }
        map.set(tx.transferId, current);
        return map;
    }, new Map<string, { income?: Transaction; expense?: Transaction }>());

    for (const tx of sortedTransactions) {
        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) continue;

            const pair = transferLookup.get(tx.transferId);
            processedTransferIds.add(tx.transferId);

            if (pair?.expense && pair?.income) {
                result.push({
                    ...pair.expense,
                    id: `transfer-${pair.expense.transferId}`,
                    originalId: pair.expense.id,
                    amount: Math.abs(pair.expense.amount),
                    isTransfer: true,
                    type: 'expense',
                    fromAccountName: accountMap[pair.expense.accountId]?.name,
                    toAccountName: accountMap[pair.income.accountId]?.name,
                    category: 'Transfer',
                    description: 'Account Transfer'
                });
            } else {
                result.push({ ...tx, accountName: accountMap[tx.accountId]?.name });
            }
        } else {
            result.push({ ...tx, accountName: accountMap[tx.accountId]?.name });
        }
    }
    return result;
  }, [transactions, accountMap]);

  const filteredTransactions = useMemo(() => {
    const startDateTime = startDate ? new Date(startDate) : null;
    if (startDateTime) startDateTime.setHours(0, 0, 0, 0);

    const endDateTime = endDate ? new Date(endDate) : null;
    if (endDateTime) endDateTime.setHours(23, 59, 59, 999);
    
    const getParentCategoryName = (categoryName: string): string | undefined => {
        const findParent = (categories: Category[]): string | undefined => {
            for (const parent of categories) {
                if (parent.name === categoryName) return parent.name; // It's a parent
                if (parent.subCategories.some(sub => sub.name === categoryName)) return parent.name;
            }
            return undefined;
        };
        return findParent(allCategories);
    };

    const transactionList = displayTransactions.filter(tx => {
        const matchAccount = selectedAccountIds.length === 0 || 
            (tx.isTransfer 
                ? selectedAccountIds.includes(accountMapByName[tx.fromAccountName!].id) || selectedAccountIds.includes(accountMapByName[tx.toAccountName!].id) 
                : selectedAccountIds.includes(tx.accountId));
        
        const matchSearch = (
            !searchTerm ||
            fuzzySearch(searchTerm, tx.description) ||
            fuzzySearch(searchTerm, tx.category) ||
            fuzzySearch(searchTerm, tx.accountName || '') ||
            fuzzySearch(searchTerm, tx.fromAccountName || '') ||
            fuzzySearch(searchTerm, tx.toAccountName || '')
        );
        
        const matchMerchant = !merchantFilter || fuzzySearch(merchantFilter, tx.merchant || '');

        let matchType = true;
        if (typeFilter === 'expense') matchType = !tx.isTransfer && tx.type === 'expense';
        else if (typeFilter === 'income') matchType = !tx.isTransfer && tx.type === 'income';
        else if (typeFilter === 'transfer') matchType = !!tx.isTransfer;
        
        const txDateTime = parseDateAsUTC(tx.date).getTime();
        const matchStartDate = !startDateTime || txDateTime >= startDateTime.getTime();
        const matchEndDate = !endDateTime || txDateTime <= endDateTime.getTime();

        const matchTag = selectedTagIds.length === 0 || (tx.tagIds && tx.tagIds.some(tagId => selectedTagIds.includes(tagId)));
        
        const matchCategory = selectedCategoryNames.length === 0 || selectedCategoryNames.includes(tx.category) || selectedCategoryNames.includes(getParentCategoryName(tx.category) || '');

        const txAbsAmount = Math.abs(convertToEur(tx.amount, tx.currency));
        const min = parseFloat(minAmount);
        const max = parseFloat(maxAmount);
        const matchMinAmount = isNaN(min) || txAbsAmount >= min;
        const matchMaxAmount = isNaN(max) || txAbsAmount <= max;

        return matchAccount && matchTag && matchSearch && matchType && matchStartDate && matchEndDate && matchCategory && matchMinAmount && matchMaxAmount && matchMerchant;
      });
    
    return transactionList.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime();
        case 'amount-desc': return Math.abs(b.amount) - Math.abs(a.amount);
        case 'amount-asc': return Math.abs(a.amount) - Math.abs(b.amount);
        case 'date-desc': default: return parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime();
      }
    });

  }, [searchTerm, sortBy, typeFilter, startDate, endDate, displayTransactions, selectedAccountIds, selectedCategoryNames, selectedTagIds, minAmount, maxAmount, allCategories, accountMapByName, merchantFilter]);
  
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(1, page), Math.max(1, totalPages)));
  }, [totalPages]);

    const groupedTransactions = useMemo(() => {
        const groups: Record<string, { transactions: DisplayTransaction[]; total: number }> = {};

        paginatedTransactions.forEach(tx => {
            const date = tx.date;
            if (!groups[date]) {
                groups[date] = { transactions: [], total: 0 };
            }
            groups[date].transactions.push(tx);
        });

        for (const date in groups) {
            let dailyTotal = 0;
            groups[date].transactions.forEach(tx => {
                let amount = tx.amount;
                let currency = tx.currency;

                if (tx.isTransfer) {
                    const fromAccount = accountMapByName[tx.fromAccountName!];
                    const toAccount = accountMapByName[tx.toAccountName!];
                    
                    if (selectedAccountIds.length === 0) {
                        amount = 0;
                    } else if (selectedAccountIds.includes(fromAccount?.id) && !selectedAccountIds.includes(toAccount?.id)) {
                        amount = -tx.amount;
                        if (fromAccount) currency = fromAccount.currency;
                    } else if (!selectedAccountIds.includes(fromAccount?.id) && selectedAccountIds.includes(toAccount?.id)) {
                        amount = tx.amount;
                         if (toAccount) currency = toAccount.currency;
                    } else {
                        amount = 0;
                    }
                }
                dailyTotal += convertToEur(amount, currency);
            });
            groups[date].total = dailyTotal;
        }

        return groups;
    }, [paginatedTransactions, selectedAccountIds, accounts, accountMapByName]);
  
    // Calculate Summaries
    const { totalIncome, totalExpenses, netChange, txCount, chartData } = useMemo(() => {
        let inc = 0;
        let exp = 0;
        
        const dailyMap = new Map<string, number>();

        filteredTransactions.forEach(tx => {
            let amount = tx.amount;
            let currency = tx.currency;

            if (tx.isTransfer) {
                const fromAccount = accountMapByName[tx.fromAccountName!];
                const toAccount = accountMapByName[tx.toAccountName!];
                
                if (selectedAccountIds.length > 0) {
                    if (selectedAccountIds.includes(fromAccount?.id) && !selectedAccountIds.includes(toAccount?.id)) {
                        amount = -tx.amount;
                        if(fromAccount) currency = fromAccount.currency;
                        exp += Math.abs(convertToEur(amount, currency));
                    } else if (!selectedAccountIds.includes(fromAccount?.id) && selectedAccountIds.includes(toAccount?.id)) {
                        amount = tx.amount;
                        if(toAccount) currency = toAccount.currency;
                        inc += Math.abs(convertToEur(amount, currency));
                    }
                    // Internal transfer or external transfer ignored for summary totals if both outside or both inside
                }
            } else {
                if (tx.type === 'income') inc += Math.abs(convertToEur(amount, currency));
                else exp += Math.abs(convertToEur(amount, currency));
            }

            // Chart data prep - signed amount
            const signedAmount = convertToEur(amount, currency) * (tx.type === 'expense' && !tx.isTransfer ? -1 : 1);
            // For transfers, only count if it's crossing the filter boundary
            let chartAmount = 0;
            if (!tx.isTransfer) {
                chartAmount = signedAmount;
            } else {
                 // Logic similar to summary above
                 const fromAccount = accountMapByName[tx.fromAccountName!];
                 const toAccount = accountMapByName[tx.toAccountName!];
                 if (selectedAccountIds.length > 0) {
                     if (selectedAccountIds.includes(fromAccount?.id) && !selectedAccountIds.includes(toAccount?.id)) {
                        chartAmount = -Math.abs(convertToEur(tx.amount, fromAccount?.currency || 'EUR'));
                     } else if (!selectedAccountIds.includes(fromAccount?.id) && selectedAccountIds.includes(toAccount?.id)) {
                        chartAmount = Math.abs(convertToEur(tx.amount, toAccount?.currency || 'EUR'));
                     }
                 }
            }
            
            dailyMap.set(tx.date, (dailyMap.get(tx.date) || 0) + chartAmount);
        });

        const sortedDates = Array.from(dailyMap.keys()).sort();
        const chartData = sortedDates.map(date => ({
            date,
            amount: dailyMap.get(date) || 0,
            timestamp: parseDateAsUTC(date).getTime()
        }));

        return {
            totalIncome: inc,
            totalExpenses: exp,
            netChange: inc - exp,
            txCount: filteredTransactions.length,
            chartData
        };
    }, [filteredTransactions, selectedAccountIds, accountMapByName]);


  const containsTransfer = useMemo(() => {
    return Array.from(selectedIds).some((id: string) => id.startsWith('transfer-'));
  }, [selectedIds]);

  const isAllSelected = useMemo(() => {
      if (paginatedTransactions.length === 0) return false;
      return paginatedTransactions.every(tx => selectedIds.has(tx.id));
  }, [paginatedTransactions, selectedIds]);
  
    const selectedTransactions = useMemo(() => {
        const regularTxIds = Array.from(selectedIds).filter((id: string) => !id.startsWith('transfer-'));
        return transactions.filter(t => regularTxIds.includes(t.id));
    }, [selectedIds, transactions]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        const allIds = new Set(paginatedTransactions.map(tx => tx.id));
        setSelectedIds(allIds);
    } else {
        setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (transactionId: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(transactionId)) {
          newSelection.delete(transactionId);
      } else {
          newSelection.add(transactionId);
      }
      setSelectedIds(newSelection);
  };
  
  const handleOpenCategorizeModal = () => {
    if (containsTransfer) return;
    setIsCategorizeModalOpen(true);
  };

  const handleSaveBulkCategory = (newCategoryName: string) => {
      const transactionUpdates: (Omit<Transaction, 'id'> & { id: string })[] = [];
      const selectedRegularTxIds = Array.from(selectedIds).filter((id: string) => !id.startsWith('transfer-'));

      // Use recursive finder to handle sub-categories
      const categoryDetails = findCategoryByName(newCategoryName, allCategories);
      if (!categoryDetails) {
          console.error("Could not find details for new category:", newCategoryName);
          return;
      }
      
      const newType = categoryDetails.classification || 'expense';

      for (const txId of selectedRegularTxIds) {
          const originalTx = transactions.find(t => t.id === txId);
          if (originalTx) {
              const newAmount = newType === 'income' ? Math.abs(originalTx.amount) : -Math.abs(originalTx.amount);
              transactionUpdates.push({ 
                  ...originalTx, 
                  category: newCategoryName,
                  type: newType,
                  amount: newAmount,
              });
          }
      }
      
      if (transactionUpdates.length > 0) {
          saveTransaction(transactionUpdates, []);
      }
      
      setIsCategorizeModalOpen(false);
      setSelectedIds(new Set());
  };
  
    const handleSaveBulkEdits = (updatedTransactions: Transaction[]) => {
        saveTransaction(updatedTransactions, []);
        setBulkEditModalOpen(false);
        setSelectedIds(new Set());
    };

  const handleOpenDeleteModal = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmBulkDelete = () => {
    const idsToDelete: string[] = [];
    selectedIds.forEach((id: string) => {
        if (id.startsWith('transfer-')) {
            const transferId = id.replace('transfer-', '');
            const pair = transactions.filter(t => t.transferId === transferId);
            pair.forEach(p => idsToDelete.push(p.id));
        } else {
            idsToDelete.push(id);
        }
    });

    if (idsToDelete.length > 0) {
        deleteTransactions(idsToDelete);
    }
    
    setIsDeleteConfirmOpen(false);
    setSelectedIds(new Set());
  };

  const handleOpenAddModal = () => {
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleOpenEditModal = (transaction: DisplayTransaction) => {
    const idToFind = transaction.isTransfer ? transaction.originalId : transaction.id;
    const originalTransaction = transactions.find(t => t.id === idToFind);
    if (originalTransaction) {
        setEditingTransaction(originalTransaction);
        setIsTransactionModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsTransactionModalOpen(false);
    setEditingTransaction(null);
  };
  
  const handleMakeRecurring = (txToConvert?: DisplayTransaction) => {
    let displayTx: DisplayTransaction | undefined = txToConvert;

    if (!displayTx) {
      if (selectedIds.size !== 1) return;
      const selectedId = Array.from(selectedIds)[0];
      displayTx = displayTransactions.find(tx => tx.id === selectedId);
    }
    
    if (!displayTx) return;

    let transaction: Transaction | undefined;
    let toAccountId: string | undefined;
    let type: 'income' | 'expense' | 'transfer';

    if (displayTx.isTransfer) {
        const transferId = displayTx.transferId;
        const expensePart = transactions.find(t => t.transferId === transferId && t.type === 'expense');
        const incomePart = transactions.find(t => t.transferId === transferId && t.type === 'income');
        
        if (!expensePart || !incomePart) return;
        
        transaction = expensePart;
        toAccountId = incomePart.accountId;
        type = 'transfer';
    } else {
        transaction = transactions.find(t => t.id === displayTx.id);
        if (!transaction) return;
        type = transaction.type;
    }

    const initialRecurringData: Omit<RecurringTransaction, 'id'> & { id?: string } = {
        id: '',
        accountId: transaction.accountId,
        toAccountId: toAccountId,
        description: transaction.description,
        amount: Math.abs(transaction.amount),
        category: transaction.category,
        type: type,
        currency: transaction.currency,
        frequency: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
        nextDueDate: new Date().toISOString().split('T')[0],
        weekendAdjustment: 'on',
    };

    setTransactionToMakeRecurring(initialRecurringData);
    setIsRecurringModalOpen(true);
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
        alert("No transactions to export.");
        return;
    }
    const dataForExport = filteredTransactions.map(tx => {
        const { id, originalId, accountId, transferId, recurringSourceId, importId, sureId, ...rest } = tx;
        return {
            date: rest.date,
            description: rest.description,
            merchant: rest.merchant,
            amount: rest.amount,
            currency: rest.currency,
            category: rest.category,
            type: rest.isTransfer ? 'transfer' : rest.type,
            account: rest.accountName || (rest.isTransfer ? `${rest.fromAccountName} -> ${rest.toAccountName}` : 'N/A'),
            tags: rest.tagIds?.map(tid => tags.find(t=>t.id === tid)?.name).join(' | ') || ''
        };
    });
    const csv = arrayToCSV(dataForExport);
    downloadCSV(csv, `crystal-transactions-${new Date().toISOString().split('T')[0]}.csv`);
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setAccountFilter(null);
    setSelectedAccountIds([]);
    setSelectedCategoryNames([]);
    setTagFilter(null);
    setSelectedTagIds([]);
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date-desc');
    setMerchantFilter('');
  };

  const formatGroupDate = (dateString: string) => {
    const date = parseDateAsUTC(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  const generateCategoryOptions = (categories: Category[], level = 0): { value: string, label: string, level: number }[] => {
    let options: { value: string, label: string, level: number }[] = [];
    for (const cat of categories) {
        options.push({ value: cat.name, label: cat.name, level });
        if (cat.subCategories && cat.subCategories.length > 0) {
            options = [...options, ...generateCategoryOptions(cat.subCategories, level + 1)];
        }
    }
    return options;
  };

  const categoryOptions = useMemo(() => {
    const incomeOpts = generateCategoryOptions(incomeCategories);
    const expenseOpts = generateCategoryOptions(expenseCategories);
    return [...expenseOpts, ...incomeOpts];
  }, [incomeCategories, expenseCategories]);

  const tagOptions = useMemo(() => tags.map(t => ({ value: t.id, label: t.name })), [tags]);
  
  const labelStyle = "block text-xs font-bold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary mb-2";
  const typeFilterOptions: { label: string; value: 'all' | 'income' | 'expense' | 'transfer' }[] = [
    { label: 'All Types', value: 'all' },
    { label: 'Expenses', value: 'expense' },
    { label: 'Income', value: 'income' },
    { label: 'Transfers', value: 'transfer' },
  ];

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Hidden Modals */}
      {isTransactionModalOpen && (
        <AddTransactionModal 
          onClose={handleCloseModal}
          onSave={(toSave, toDelete) => {
            saveTransaction(toSave, toDelete);
            handleCloseModal();
          }}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transactionToEdit={editingTransaction}
          transactions={transactions}
          tags={tags}
        />
      )}
      {isRecurringModalOpen && saveRecurringTransaction && (
        <RecurringTransactionModal
            onClose={() => setIsRecurringModalOpen(false)}
            onSave={(data) => {
                if(saveRecurringTransaction) saveRecurringTransaction(data);
                setIsRecurringModalOpen(false);
                setSelectedIds(new Set()); // Clear selection
            }}
            accounts={accounts}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            recurringTransactionToEdit={transactionToMakeRecurring}
        />
      )}
      {isCategorizeModalOpen && (
          <BulkCategorizeModal
              onClose={() => setIsCategorizeModalOpen(false)}
              onSave={handleSaveBulkCategory}
              incomeCategories={incomeCategories}
              expenseCategories={expenseCategories}
          />
      )}
       {isBulkEditModalOpen && (
          <BulkEditTransactionsModal
            isOpen={isBulkEditModalOpen}
            onClose={() => setBulkEditModalOpen(false)}
            onSave={handleSaveBulkEdits}
            transactionsToEdit={selectedTransactions}
            accounts={accounts}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            tags={tags}
          />
      )}
      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete ${selectedIds.size} transaction(s)? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonVariant="danger"
      />
       {contextMenu && (
            <div
                ref={contextMenuRef}
                style={{ top: contextMenu.y, left: contextMenu.x }}
                className="absolute z-30 w-56 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 py-2 animate-fade-in-up"
            >
                <ul className="text-sm">
                    <li>
                        <button onClick={() => { handleOpenEditModal(contextMenu.transaction); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                            <span className="material-symbols-outlined text-base">edit</span>
                            <span>Edit Transaction</span>
                        </button>
                    </li>
                    <li>
                        <button 
                            onClick={() => { handleMakeRecurring(contextMenu.transaction); setContextMenu(null); }} 
                            disabled={contextMenu.transaction.isTransfer}
                            className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-base">repeat</span>
                            <span>Make Recurring</span>
                        </button>
                    </li>
                    <div className="my-1 h-px bg-light-separator dark:bg-dark-separator"></div>
                    <li>
                        <button onClick={() => { 
                            setSelectedIds(new Set([contextMenu.transaction.id]));
                            setIsDeleteConfirmOpen(true);
                            setContextMenu(null);
                        }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-semantic-red hover:bg-semantic-red/10">
                            <span className="material-symbols-outlined text-base">delete</span>
                            <span>Delete Transaction</span>
                        </button>
                    </li>
                </ul>
            </div>
        )}

      {/* --- New Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in-up">
         <div>
             {/* <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">Transactions</h1> */}
             <p className="text-light-text-secondary dark:text-dark-text-secondary">Manage and analyze your spending.</p>
         </div>
         <div className="flex items-center gap-2 w-full md:w-auto">
             <button onClick={handleExport} className={`${BTN_SECONDARY_STYLE} flex-1 md:flex-none flex items-center justify-center gap-2`}>
                 <span className="material-symbols-outlined text-lg">download</span>
                 Export
             </button>
             <button onClick={handleOpenAddModal} className={`${BTN_PRIMARY_STYLE} flex-1 md:flex-none flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20`}>
                 <span className="material-symbols-outlined text-lg">add</span>
                 Add Transaction
             </button>
         </div>
      </div>

      {/* --- Summary Cards & Chart --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-fade-in-up">
          <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
             <Card className="p-4 flex flex-col justify-between bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-dark-bg border border-black/5 dark:border-white/5">
                 <div className="flex justify-between items-start mb-2">
                     <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Income</p>
                     <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><span className="material-symbols-outlined text-sm">arrow_downward</span></div>
                 </div>
                 <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalIncome, 'EUR')}</p>
             </Card>
             <Card className="p-4 flex flex-col justify-between bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-dark-bg border border-black/5 dark:border-white/5">
                 <div className="flex justify-between items-start mb-2">
                     <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Expense</p>
                     <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><span className="material-symbols-outlined text-sm">arrow_upward</span></div>
                 </div>
                 <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpenses, 'EUR')}</p>
             </Card>
             <div className="hidden lg:block">
                <Card className="p-4 flex flex-col justify-between bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-dark-bg border border-black/5 dark:border-white/5">
                     <div className="flex justify-between items-start mb-2">
                         <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Net</p>
                         <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><span className="material-symbols-outlined text-sm">functions</span></div>
                     </div>
                     <p className={`text-xl font-bold ${netChange >= 0 ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>{formatCurrency(netChange, 'EUR')}</p>
                 </Card>
             </div>
          </div>
          
          <Card className="lg:col-span-3 p-4 relative min-h-[200px]">
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text mb-2 absolute top-4 left-4 z-10">Activity Timeline</h3>
                <div className="h-full w-full pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                             <XAxis 
                                dataKey="date" 
                                hide 
                            />
                             <RechartsTooltip 
                                cursor={{fill: 'transparent'}}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-light-card dark:bg-dark-card p-2 rounded shadow-lg text-xs border border-black/10 dark:border-white/10">
                                                <p className="font-bold mb-1">{parseDateAsUTC(data.date).toLocaleDateString()}</p>
                                                <p className={data.amount >= 0 ? 'text-green-500' : 'text-red-500'}>
                                                    {formatCurrency(data.amount, 'EUR', { showPlusSign: true })}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="amount" radius={[2, 2, 2, 2]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.amount >= 0 ? '#34D399' : '#F87171'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
          </Card>
      </div>

      {/* --- Filter Bar --- */}
      <Card className="p-4 sticky top-0 z-20 backdrop-blur-md bg-light-card/90 dark:bg-dark-card/90 border-b border-black/5 dark:border-white/5 transition-all">
          <div className="flex flex-col gap-4">
              {/* Main Search Row */}
              <div className="flex flex-col md:flex-row gap-3">
                   <div className="relative flex-grow">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">search</span>
                      <input 
                        ref={searchInputRef} 
                        type="text" 
                        placeholder="Search transactions..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className={`${INPUT_BASE_STYLE} pl-10 h-11 bg-light-bg dark:bg-dark-bg border-transparent focus:bg-white dark:focus:bg-black`} 
                      />
                  </div>
                  <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`px-4 h-11 rounded-lg font-medium flex items-center gap-2 border transition-colors ${showFilters ? 'bg-primary-500 text-white border-primary-500' : 'bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                      <span className="material-symbols-outlined">tune</span>
                      Filters
                  </button>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 animate-fade-in-up">
                      <div>
                          <label className={labelStyle}>Type</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className={INPUT_BASE_STYLE}>
                                  {typeFilterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                          </div>
                      </div>
                      <div>
                          <label className={labelStyle}>Date Range</label>
                          <div className="flex gap-2">
                               <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} text-xs px-2`} />
                               <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} text-xs px-2`} />
                          </div>
                      </div>
                      <div>
                           <label className={labelStyle}>Account</label>
                           <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds}/>
                      </div>
                      <div>
                           <label className={labelStyle}>Sort</label>
                           <div className={SELECT_WRAPPER_STYLE}>
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={INPUT_BASE_STYLE}>
                                    <option value="date-desc">Newest First</option>
                                    <option value="date-asc">Oldest First</option>
                                    <option value="amount-desc">Highest Amount</option>
                                    <option value="amount-asc">Lowest Amount</option>
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                            <label className={labelStyle}>Category</label>
                            <MultiSelectFilter options={categoryOptions} selectedValues={selectedCategoryNames} onChange={setSelectedCategoryNames} placeholder="All Categories"/>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                             <label className={labelStyle}>Tags</label>
                             <MultiSelectFilter options={tagOptions} selectedValues={selectedTagIds} onChange={setSelectedTagIds} placeholder="All Tags"/>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-2 flex justify-end items-end">
                           <button onClick={clearFilters} className="text-sm text-primary-500 hover:underline font-medium px-2 py-2">Reset Filters</button>
                      </div>
                  </div>
              )}
          </div>
      </Card>

      {/* --- Main List --- */}
      <div className="flex-1 min-w-0 relative pb-10">
        <Card className="p-0 h-full flex flex-col relative overflow-hidden">
            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                 <div className="sticky top-0 z-30 bg-primary-600 text-white px-4 py-3 flex justify-between items-center shadow-md animate-fade-in-up">
                     <div className="flex items-center gap-3">
                         <button onClick={() => setSelectedIds(new Set())} className="p-1 rounded-full hover:bg-white/20 transition-colors"><span className="material-symbols-outlined">close</span></button>
                         <span className="font-semibold">{selectedIds.size} selected</span>
                     </div>
                    <div className="flex gap-2">
                        <button onClick={() => setBulkEditModalOpen(true)} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50" disabled={containsTransfer}>Edit</button>
                        <button onClick={handleOpenCategorizeModal} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50" disabled={containsTransfer}>Categorize</button>
                        <button onClick={handleOpenDeleteModal} className="bg-white/20 hover:bg-red-500 px-3 py-1.5 rounded text-sm font-medium transition-colors">Delete</button>
                    </div>
                </div>
            )}

            {/* List Content */}
            <div className="overflow-x-auto">
                {Object.keys(groupedTransactions).length > 0 ? (
                    <div className="min-w-[600px]"> 
                         {/* Header */}
                         <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-black/5 dark:border-white/5 text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">
                             <div className="w-8 flex justify-center"><input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} className={CHECKBOX_STYLE} /></div>
                             <div>Transaction Details</div>
                             <div>Category & Tags</div>
                             <div className="text-right">Amount</div>
                         </div>

                         {Object.entries(groupedTransactions).map(([date, group]) => {
                             const typedGroup = group as { transactions: DisplayTransaction[]; total: number };
                             return (
                                 <div key={date}>
                                     {/* Date Sticky Header */}
                                     <div className="sticky top-0 z-10 px-6 py-2 bg-light-bg/95 dark:bg-dark-card/95 backdrop-blur-sm border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                                         <span className="font-bold text-sm text-light-text dark:text-dark-text">{formatGroupDate(date)}</span>
                                         <span className={`font-mono text-sm font-medium ${typedGroup.total > 0 ? 'text-green-600' : typedGroup.total < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                             {formatCurrency(typedGroup.total, 'EUR', { showPlusSign: true })}
                                         </span>
                                     </div>
                                     
                                     {/* Rows */}
                                     <div>
                                         {typedGroup.transactions.map(tx => {
                                             let amount = tx.amount;
                                             let amountColor = tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-light-text dark:text-dark-text';
                                             
                                             // Logic to handle transfer display amounts based on selected accounts
                                             if (tx.isTransfer) {
                                                amountColor = 'text-gray-500';
                                                if (selectedAccountIds.length > 0) {
                                                    const fromAcc = accountMapByName[tx.fromAccountName!];
                                                    const toAcc = accountMapByName[tx.toAccountName!];
                                                    if (selectedAccountIds.includes(fromAcc?.id) && !selectedAccountIds.includes(toAcc?.id)) { 
                                                        amount = -tx.amount; 
                                                        amountColor = 'text-light-text dark:text-dark-text'; 
                                                    } else if (!selectedAccountIds.includes(fromAcc?.id) && selectedAccountIds.includes(toAcc?.id)) { 
                                                        amount = tx.amount; 
                                                        amountColor = 'text-green-600 dark:text-green-400'; 
                                                    }
                                                }
                                            }

                                             const categoryDetails = getCategoryDetails(tx.category, allCategories);
                                             
                                             return (
                                                 <div 
                                                    key={tx.id} 
                                                    className={`grid grid-cols-[auto_1fr_1fr_auto] gap-4 items-center px-6 py-4 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group ${selectedIds.has(tx.id) ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
                                                    onClick={() => handleOpenEditModal(tx)}
                                                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, transaction: tx }); }}
                                                 >
                                                     <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                         <input type="checkbox" className={CHECKBOX_STYLE} checked={selectedIds.has(tx.id)} onChange={() => handleSelectOne(tx.id)} />
                                                     </div>
                                                     
                                                     <div className="flex items-center gap-3 overflow-hidden">
                                                         <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.isTransfer ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-light-fill dark:bg-dark-fill'}`} style={!tx.isTransfer && categoryDetails.color ? { backgroundColor: `${categoryDetails.color}20`, color: categoryDetails.color } : {}}>
                                                             <span className="material-symbols-outlined text-[20px]">
                                                                 {tx.isTransfer ? 'swap_horiz' : (categoryDetails.icon || 'receipt')}
                                                             </span>
                                                         </div>
                                                         <div className="min-w-0">
                                                             <p className="font-semibold text-sm text-light-text dark:text-dark-text truncate">{tx.description}</p>
                                                             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                                                                 {tx.isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : tx.accountName}
                                                             </p>
                                                         </div>
                                                     </div>

                                                     <div className="min-w-0">
                                                         <div className="flex flex-wrap gap-2 items-center">
                                                             <span className="text-sm text-light-text dark:text-dark-text truncate">{tx.category}</span>
                                                             {tx.tagIds && tx.tagIds.length > 0 && (
                                                                 <div className="flex gap-1">
                                                                     {tx.tagIds.map(tagId => {
                                                                         const tag = tags.find(t => t.id === tagId);
                                                                         if (!tag) return null;
                                                                         return <span key={tagId} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name}></span>
                                                                     })}
                                                                 </div>
                                                             )}
                                                         </div>
                                                         {tx.merchant && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{tx.merchant}</p>}
                                                     </div>

                                                     <div className="text-right">
                                                         <p className={`font-mono font-bold text-sm ${amountColor}`}>
                                                             {tx.isTransfer && selectedAccountIds.length === 0 
                                                                ? '-/+ ' + formatCurrency(convertToEur(Math.abs(amount), tx.currency), 'EUR')
                                                                : formatCurrency(convertToEur(amount, tx.currency), 'EUR', { showPlusSign: true })
                                                             }
                                                         </p>
                                                         <button 
                                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary transition-opacity"
                                                            onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, transaction: tx }); }}
                                                         >
                                                             <span className="material-symbols-outlined text-lg">more_horiz</span>
                                                         </button>
                                                     </div>
                                                 </div>
                                             );
                                         })}
                                     </div>
                                 </div>
                             );
                         })}
                    </div>
                ) : (
                     <div className="flex flex-col items-center justify-center py-20 text-light-text-secondary dark:text-dark-text-secondary">
                         <span className="material-symbols-outlined text-6xl mb-4 opacity-20">search_off</span>
                         <p className="text-lg font-medium">No transactions found</p>
                         <p className="text-sm">Try adjusting your filters or search term.</p>
                         <button onClick={clearFilters} className="mt-4 text-primary-500 font-semibold hover:underline">Clear all filters</button>
                     </div>
                )}
            </div>
             
             {/* Pagination Footer */}
             {filteredTransactions.length > 0 && (
                <div className="px-6 py-4 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center bg-light-bg/50 dark:bg-dark-bg/50 gap-4">
                    <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <span>Show:</span>
                        <div className={`${SELECT_WRAPPER_STYLE} !w-auto`}>
                            <select 
                                value={itemsPerPage === Number.MAX_SAFE_INTEGER ? 'all' : itemsPerPage}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setItemsPerPage(val === 'all' ? Number.MAX_SAFE_INTEGER : Number(val));
                                    setCurrentPage(1);
                                }}
                                className={`${SELECT_STYLE} !py-1 !pl-2 !pr-8 !text-sm !h-8 bg-transparent`}
                            >
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">All</option>
                            </select>
                            <div className={`${SELECT_ARROW_STYLE} right-1`}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        <span className="text-sm font-medium text-light-text dark:text-dark-text mx-2">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
                        >
                             <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
