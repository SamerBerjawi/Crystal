import React, { useState, useMemo, useRef, useEffect } from 'react';
import { INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, CHECKBOX_STYLE } from '../constants';
import { Transaction, Category, Account, DisplayTransaction, Tag, RecurringTransaction } from '../types';
import Card from '../components/Card';
import { formatCurrency, fuzzySearch, convertToEur, arrayToCSV, downloadCSV } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import ConfirmationModal from '../components/ConfirmationModal';

interface TransactionsProps {
  transactions: Transaction[];
  saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
  deleteTransactions: (transactionIds: string[]) => void;
  accounts: Account[];
  accountFilter: string | null;
  setAccountFilter: (accountName: string | null) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  tags: Tag[];
  tagFilter: string | null;
  setTagFilter: (tagId: string | null) => void;
  saveRecurringTransaction: (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
}

const CategoryOptions: React.FC<{ categories: Category[], label: string }> = ({ categories, label }) => (
    <optgroup label={label}>
        {categories.map(parentCat => (
            <React.Fragment key={parentCat.id}>
                <option value={parentCat.name}>{parentCat.name}</option>
                {parentCat.subCategories.map(subCat => (
                    <option key={subCat.id} value={subCat.name}>
                        &nbsp;&nbsp;{subCat.name}
                    </option>
                ))}
            </React.Fragment>
        ))}
    </optgroup>
);


const Transactions: React.FC<TransactionsProps> = ({ transactions, saveTransaction, deleteTransactions, accounts, accountFilter, setAccountFilter, incomeCategories, expenseCategories, tags, tagFilter, setTagFilter, saveRecurringTransaction }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCategorizeModalOpen, setIsCategorizeModalOpen] = useState(false);
  const [isBulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [transactionToMakeRecurring, setTransactionToMakeRecurring] = useState<RecurringTransaction | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, transaction: DisplayTransaction } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

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

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);

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

  const accountMap = useMemo(() => 
    accounts.reduce((acc, current) => {
      acc[current.id] = current.name;
      return acc;
    }, {} as { [key: string]: string }), 
  [accounts]);

  const displayTransactions = useMemo(() => {
    const processedTransferIds = new Set<string>();
    const result: DisplayTransaction[] = [];
    
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const tx of sortedTransactions) {
        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) continue;
            
            const pair = sortedTransactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
            processedTransferIds.add(tx.transferId);

            if (pair) {
                const expensePart = tx.amount < 0 ? tx : pair;
                const incomePart = tx.amount > 0 ? tx : pair;
                result.push({
                    ...expensePart,
                    id: `transfer-${expensePart.transferId}`,
                    originalId: expensePart.id,
                    amount: Math.abs(expensePart.amount),
                    isTransfer: true,
                    type: 'expense',
                    fromAccountName: accountMap[expensePart.accountId],
                    toAccountName: accountMap[incomePart.accountId],
                    category: 'Transfer',
                    description: 'Account Transfer'
                });
            } else {
                result.push({ ...tx, accountName: accountMap[tx.accountId] });
            }
        } else {
            result.push({ ...tx, accountName: accountMap[tx.accountId] });
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
        const matchAccount = !accountFilter || (tx.isTransfer ? tx.fromAccountName === accountFilter || tx.toAccountName === accountFilter : tx.accountName === accountFilter);
        
        const matchSearch = (
            !searchTerm ||
            fuzzySearch(searchTerm, tx.description) ||
            fuzzySearch(searchTerm, tx.category) ||
            fuzzySearch(searchTerm, tx.accountName || '') ||
            fuzzySearch(searchTerm, tx.fromAccountName || '') ||
            fuzzySearch(searchTerm, tx.toAccountName || '') ||
            fuzzySearch(searchTerm, tx.merchant || '')
        );

        let matchType = true;
        if (typeFilter === 'expense') {
            matchType = !tx.isTransfer && tx.type === 'expense';
        } else if (typeFilter === 'income') {
            matchType = !tx.isTransfer && tx.type === 'income';
        } else if (typeFilter === 'transfer') {
            matchType = !!tx.isTransfer;
        }
        
        const txDateTime = new Date(tx.date.replace(/-/g, '/')).getTime();
        const matchStartDate = !startDateTime || txDateTime >= startDateTime.getTime();
        const matchEndDate = !endDateTime || txDateTime <= endDateTime.getTime();

        const matchTag = !tagFilter || (tx.tagIds && tx.tagIds.includes(tagFilter));

        const matchCategory = !categoryFilter || tx.category === categoryFilter || getParentCategoryName(tx.category) === categoryFilter;

        const txAbsAmount = Math.abs(convertToEur(tx.amount, tx.currency));
        const min = parseFloat(minAmount);
        const max = parseFloat(maxAmount);
        const matchMinAmount = isNaN(min) || txAbsAmount >= min;
        const matchMaxAmount = isNaN(max) || txAbsAmount <= max;

        return matchAccount && matchTag && matchSearch && matchType && matchStartDate && matchEndDate && matchCategory && matchMinAmount && matchMaxAmount;
      });
    
    return transactionList.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.date.replace(/-/g, '/')).getTime() - new Date(b.date.replace(/-/g, '/')).getTime();
        case 'amount-desc':
          return Math.abs(b.amount) - Math.abs(a.amount);
        case 'amount-asc':
          return Math.abs(a.amount) - Math.abs(b.amount);
        case 'date-desc':
        default:
          return new Date(b.date.replace(/-/g, '/')).getTime() - new Date(a.date.replace(/-/g, '/')).getTime();
      }
    });

  }, [searchTerm, accountFilter, sortBy, typeFilter, startDate, endDate, displayTransactions, tagFilter, categoryFilter, minAmount, maxAmount, allCategories]);
  
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, { transactions: DisplayTransaction[]; total: number }> = {};

        filteredTransactions.forEach(tx => {
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
                    if (accountFilter) {
                        const fromAccount = accounts.find(a => a.name === tx.fromAccountName);
                        const toAccount = accounts.find(a => a.name === tx.toAccountName);

                        if (accountFilter === tx.fromAccountName) {
                            amount = -tx.amount;
                            if (fromAccount) currency = fromAccount.currency;
                        } else if (accountFilter === tx.toAccountName) {
                            amount = tx.amount;
                            if (toAccount) currency = toAccount.currency;
                        } else {
                            amount = 0;
                        }
                    } else {
                        amount = 0;
                    }
                }
                dailyTotal += convertToEur(amount, currency);
            });
            groups[date].total = dailyTotal;
        }

        return groups;
    }, [filteredTransactions, accountFilter, accounts]);
  
  const containsTransfer = useMemo(() => {
    return Array.from(selectedIds).some((id: string) => id.startsWith('transfer-'));
  }, [selectedIds]);

  const isAllSelected = useMemo(() => {
      if (filteredTransactions.length === 0) return false;
      return filteredTransactions.every(tx => selectedIds.has(tx.id));
  }, [filteredTransactions, selectedIds]);
  
    const selectedTransactions = useMemo(() => {
        const regularTxIds = Array.from(selectedIds).filter((id: string) => !id.startsWith('transfer-'));
        return transactions.filter(t => regularTxIds.includes(t.id));
    }, [selectedIds, transactions]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        const allIds = new Set(filteredTransactions.map(tx => tx.id));
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

      const categoryDetails = getCategoryDetails(newCategoryName, allCategories);
      if (!categoryDetails) {
          console.error("Could not find details for new category:", newCategoryName);
          setIsCategorizeModalOpen(false);
          setSelectedIds(new Set());
          return;
      }
      
      const newType = allCategories.find(c => c.name === newCategoryName)?.classification || 'expense';

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
    setTransactionModalOpen(true);
  };

  const handleOpenEditModal = (transaction: DisplayTransaction) => {
    const idToFind = transaction.isTransfer ? transaction.originalId : transaction.id;
    const originalTransaction = transactions.find(t => t.id === idToFind);
    if (originalTransaction) {
        setEditingTransaction(originalTransaction);
        setTransactionModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setTransactionModalOpen(false);
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
        
        transaction = expensePart; // Use expense part as base
        toAccountId = incomePart.accountId;
        type = 'transfer';
    } else {
        transaction = transactions.find(t => t.id === displayTx.id);
        if (!transaction) return;
        type = transaction.type;
    }

    const initialRecurringData: RecurringTransaction = {
        id: '', // No ID, so modal knows it's a new entry
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
    setCategoryFilter(null);
    setTagFilter(null);
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date-desc');
  };

  const formatGroupDate = (dateString: string) => {
    const date = new Date(dateString.replace(/-/g, '/'));
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }
  
  const labelStyle = "block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  const newTypeFilterOptions: { label: string; value: 'all' | 'income' | 'expense' | 'transfer' }[] = [
    { label: 'All transactions', value: 'all' },
    { label: 'Expenses', value: 'expense' },
    { label: 'Income', value: 'income' },
    { label: 'Transfers', value: 'transfer' },
  ];

  const activeTag = useMemo(() => {
    if (!tagFilter) return null;
    return tags.find(t => t.id === tagFilter);
  }, [tagFilter, tags]);

  return (
    <div className="space-y-6 flex flex-col h-full">
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
      {isRecurringModalOpen && (
        <RecurringTransactionModal
            onClose={() => setIsRecurringModalOpen(false)}
            onSave={(data) => {
                saveRecurringTransaction(data);
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

      <header className="flex justify-between items-start">
        <div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">View and manage your transaction history.</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleExport} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
                <span className="material-symbols-outlined text-base">download</span>
                Export
            </button>
            <button onClick={handleOpenAddModal} className={BTN_PRIMARY_STYLE}>
                Add Transaction
            </button>
        </div>
      </header>
      
      <div>
        <div className="border-b border-light-separator dark:border-dark-separator">
            <nav className="-mb-px flex space-x-6">
                {newTypeFilterOptions.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => setTypeFilter(opt.value)}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                            typeFilter === opt.value
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </nav>
        </div>
        
        <Card className="mt-4 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2 lg:col-span-4">
                    <label htmlFor="search" className={labelStyle}>Search</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">search</span>
                        <input ref={searchInputRef} type="text" id="search" placeholder="Search description, merchant, category..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10`} />
                    </div>
                </div>
                <div><label htmlFor="account-filter" className={labelStyle}>Account</label><div className={SELECT_WRAPPER_STYLE}><select id="account-filter" value={accountFilter || ''} onChange={(e) => setAccountFilter(e.target.value || null)} className={INPUT_BASE_STYLE}><option value="">All Accounts</option>{accounts.map(acc => (<option key={acc.id} value={acc.name}>{acc.name}</option>))}</select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
                <div><label htmlFor="category-filter" className={labelStyle}>Category</label><div className={SELECT_WRAPPER_STYLE}><select id="category-filter" value={categoryFilter || ''} onChange={(e) => setCategoryFilter(e.target.value || null)} className={INPUT_BASE_STYLE}><option value="">All Categories</option><CategoryOptions categories={expenseCategories} label="--- EXPENSES ---" /><CategoryOptions categories={incomeCategories} label="--- INCOME ---" /></select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
                <div><label htmlFor="tag-filter" className={labelStyle}>Tag</label><div className={SELECT_WRAPPER_STYLE}><select id="tag-filter" value={tagFilter || ''} onChange={(e) => setTagFilter(e.target.value || null)} className={INPUT_BASE_STYLE}><option value="">All Tags</option>{tags.map(tag => (<option key={tag.id} value={tag.id}>{tag.name}</option>))}</select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
                <div><label htmlFor="sort-by" className={labelStyle}>Sort By</label><div className={SELECT_WRAPPER_STYLE}><select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={INPUT_BASE_STYLE}><option value="date-desc">Date (Newest)</option><option value="date-asc">Date (Oldest)</option><option value="amount-desc">Amount (High-Low)</option><option value="amount-asc">Amount (Low-High)</option></select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
                <div className="flex items-end gap-2">
                    <div><label htmlFor="start-date" className={labelStyle}>From Date</label><input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_BASE_STYLE}/></div>
                    <div><label htmlFor="end-date" className={labelStyle}>To Date</label><input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT_BASE_STYLE}/></div>
                </div>
                <div className="flex items-end gap-2">
                    <div><label htmlFor="min-amount" className={labelStyle}>Min Amount</label><input id="min-amount" type="number" placeholder="0.00" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={INPUT_BASE_STYLE}/></div>
                    <div><label htmlFor="max-amount" className={labelStyle}>Max Amount</label><input id="max-amount" type="number" placeholder="1000.00" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className={INPUT_BASE_STYLE}/></div>
                </div>
                <div className="col-span-full flex justify-end items-center gap-4 pt-2">
                    {activeTag && <div className="flex items-center gap-2 text-sm mr-auto"><span className="text-light-text-secondary dark:text-dark-text-secondary">Filtering by tag:</span><span className="font-semibold px-2 py-1 rounded-full text-xs" style={{backgroundColor: `${activeTag.color}30`, color: activeTag.color}}>{activeTag.name}</span></div>}
                    <button onClick={clearFilters} className={BTN_SECONDARY_STYLE}>Clear All Filters</button>
                </div>
            </div>
        </Card>
      </div>
      
      <div className="flex-1 min-h-0 relative">
        <Card className="p-0 h-full flex flex-col">
            <div className="px-6 py-3 border-b border-light-separator dark:border-dark-separator flex items-center gap-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">
                <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} className={CHECKBOX_STYLE} aria-label="Select all transactions"/>
                <div className="flex-1 grid grid-cols-12 gap-4 ml-3 items-center">
                    <span className="col-span-12 md:col-span-4 lg:col-span-3">Transaction</span>
                    <span className="hidden md:block col-span-2">Account</span>
                    <span className="hidden lg:block col-span-2">Merchant</span>
                    <span className="hidden md:block col-span-2">Category</span>
                    <span className="hidden lg:block col-span-1">Tags</span>
                    <span className="col-span-2 text-right">Amount</span>
                </div>
                <div className="w-10"></div> {/* Spacer for actions */}
            </div>
            <div className="overflow-y-auto flex-grow">
                 {Object.keys(groupedTransactions).length > 0 ? Object.entries(groupedTransactions).map(([date, group]) => {
                    const typedGroup = group as { transactions: DisplayTransaction[]; total: number };
                    return (
                    <div key={date}>
                        <div className="px-6 py-3 border-b border-t border-light-separator dark:border-dark-separator bg-light-bg dark:bg-dark-bg/50">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-base text-light-text dark:text-dark-text">{formatGroupDate(date)}</span>
                                <span className={`font-semibold text-base ${typedGroup.total > 0 ? 'text-semantic-green' : typedGroup.total < 0 ? 'text-semantic-red' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{formatCurrency(typedGroup.total, 'EUR', { showPlusSign: true })}</span>
                            </div>
                        </div>
                        <div className="divide-y divide-light-separator/50 dark:divide-dark-separator/50">
                            {typedGroup.transactions.map(tx => {
                                let amount = tx.amount;
                                let amountColor = tx.type === 'income' ? 'text-semantic-green' : 'text-semantic-red';

                                if (tx.isTransfer) {
                                    amountColor = 'text-light-text dark:text-dark-text';
                                    if (accountFilter) {
                                        if (accountFilter === tx.fromAccountName) { amount = -tx.amount; amountColor = 'text-semantic-red'; } 
                                        else if (accountFilter === tx.toAccountName) { amount = tx.amount; amountColor = 'text-semantic-green'; }
                                    }
                                }
                                
                                const categoryDetails = getCategoryDetails(tx.category, allCategories);
                                const categoryColor = tx.isTransfer ? '#64748B' : (categoryDetails.color || '#A0AEC0');
                                
                                return (
                                <div key={tx.id} className="flex items-center group hover:bg-light-fill dark:hover:bg-dark-fill cursor-pointer px-6" onClick={() => handleOpenEditModal(tx)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, transaction: tx }); }}>
                                  <div className="flex items-center gap-3">
                                      <input type="checkbox" className={CHECKBOX_STYLE} checked={selectedIds.has(tx.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(tx.id); }} onClick={e => e.stopPropagation()} aria-label={`Select transaction ${tx.description}`}/>
                                      <div className="w-1.5 h-10 flex-shrink-0 rounded-full" style={{backgroundColor: categoryColor}}></div>
                                  </div>
                                  <div className="flex-1 grid grid-cols-12 gap-4 py-4 items-center ml-3">
                                    <div className="col-span-12 md:col-span-4 lg:col-span-3 min-w-0">
                                      <p className="font-semibold text-light-text dark:text-dark-text truncate">{tx.description}</p>
                                      <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                          <p className="md:hidden truncate">{tx.isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : tx.accountName}</p>
                                          <p className="lg:hidden truncate">{tx.merchant}</p>
                                          {tx.tagIds && tx.tagIds.length > 0 && <div className="lg:hidden flex flex-wrap gap-1 mt-1">{tx.tagIds.map(tagId => { const tag = tags.find(t => t.id === tagId); if (!tag) return null; return (<span key={tag.id} className="text-xs px-2 py-1 rounded-full inline-flex items-center justify-center text-center" style={{ backgroundColor: `${tag.color}30`, color: tag.color }}>{tag.name}</span>);})}</div>}
                                      </div>
                                    </div>
                                    <div className="hidden md:block col-span-2 text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{tx.isTransfer ? ( <div className="flex items-center gap-1 truncate"><span className="truncate">{tx.fromAccountName}</span><span className="material-symbols-outlined text-base">arrow_forward</span><span className="truncate">{tx.toAccountName}</span></div>) : tx.accountName}</div>
                                    <div className="hidden lg:block col-span-2 text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{tx.merchant}</div>
                                    <div className="hidden md:block col-span-2 text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{tx.category}</div>
                                    <div className="hidden lg:flex col-span-1 text-sm text-light-text-secondary dark:text-dark-text-secondary flex-wrap gap-1">{tx.tagIds?.map(tagId => { const tag = tags.find(t => t.id === tagId); if (!tag) return null; return (<span key={tag.id} className="text-xs px-2 py-1 rounded-full inline-flex items-center justify-center text-center" style={{ backgroundColor: `${tag.color}30`, color: tag.color }} title={tag.name}>{tag.name}</span>);})}</div>
                                    <div className={`col-span-12 md:col-span-2 font-mono font-semibold text-right text-base whitespace-nowrap ${amountColor}`}>{tx.isTransfer && !accountFilter ? '-/+ ' + formatCurrency(convertToEur(Math.abs(amount), tx.currency), 'EUR') : formatCurrency(convertToEur(amount, tx.currency), 'EUR', { showPlusSign: true })}</div>
                                  </div>
                                  <div className="text-right"><button onClick={(e) => {e.stopPropagation(); handleOpenEditModal(tx)}} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-base">edit</span></button></div>
                                </div>
                                )
                            })}
                        </div>
                    </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                        <p className="font-semibold text-lg">No Transactions Found</p>
                        <p>Try adjusting your search or filters.</p>
                    </div>
                )}
            </div>
        </Card>
        {selectedIds.size > 0 && (
            <div className="absolute bottom-4 inset-x-4 mx-auto max-w-2xl z-20">
                <div className="bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-sm p-3 rounded-xl shadow-lg flex items-center justify-between">
                    <p className="font-semibold">{selectedIds.size} selected</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleMakeRecurring()} disabled={selectedIds.size !== 1} className="flex items-center gap-1 p-2 rounded-lg text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed" title={selectedIds.size !== 1 ? "Select exactly one transaction" : "Make Recurring"}>
                            <span className="material-symbols-outlined text-base">repeat</span>Make Recurring
                        </button>
                        <button onClick={handleOpenCategorizeModal} disabled={containsTransfer} className="flex items-center gap-1 p-2 rounded-lg text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed" title={containsTransfer ? "Cannot categorize transfers" : "Categorize"}><span className="material-symbols-outlined text-base">sell</span>Categorize</button>
                        <button onClick={() => setBulkEditModalOpen(true)} disabled={containsTransfer} className="flex items-center gap-1 p-2 rounded-lg text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed" title={containsTransfer ? "Cannot bulk edit transfers" : "Edit"}><span className="material-symbols-outlined text-base">edit</span>Edit</button>
                        <button onClick={handleOpenDeleteModal} className="flex items-center gap-1 p-2 rounded-lg text-sm font-semibold text-semantic-red hover:bg-semantic-red/10"><span className="material-symbols-outlined text-base">delete</span>Delete</button>
                        <button onClick={() => setSelectedIds(new Set())} className="p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5" title="Clear selection"><span className="material-symbols-outlined text-base">close</span></button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;