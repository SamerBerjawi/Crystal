
import React, { useState, useMemo } from 'react';
import { INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE } from '../constants';
import { Transaction, Category, Account, DisplayTransaction, Tag } from '../types';
import Card from '../components/Card';
import { formatCurrency, fuzzySearch, convertToEur } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import Modal from '../components/Modal';

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
}

const Transactions: React.FC<TransactionsProps> = ({ transactions, saveTransaction, deleteTransactions, accounts, accountFilter, setAccountFilter, incomeCategories, expenseCategories, tags, tagFilter, setTagFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [merchantSearchTerm, setMerchantSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCategorizeModalOpen, setIsCategorizeModalOpen] = useState(false);
  const [isBulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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
    
    const transactionList = displayTransactions.filter(tx => {
        const matchAccount = !accountFilter || (tx.isTransfer ? tx.fromAccountName === accountFilter || tx.toAccountName === accountFilter : tx.accountName === accountFilter);
        
        const matchSearch = (
            fuzzySearch(searchTerm, tx.description) ||
            fuzzySearch(searchTerm, tx.category) ||
            fuzzySearch(searchTerm, tx.accountName || '') ||
            fuzzySearch(searchTerm, tx.fromAccountName || '') ||
            fuzzySearch(searchTerm, tx.toAccountName || '')
        );

        const matchMerchant = !merchantSearchTerm || fuzzySearch(merchantSearchTerm, tx.merchant || '');

        let matchType = true;
        if (typeFilter !== 'all') {
            if (tx.isTransfer) {
                matchType = typeFilter === 'transfer';
            } else {
                matchType = tx.type === typeFilter;
            }
        }
        
        const txDateTime = new Date(tx.date.replace(/-/g, '/')).getTime();
        const matchStartDate = !startDateTime || txDateTime >= startDateTime.getTime();
        const matchEndDate = !endDateTime || txDateTime <= endDateTime.getTime();

        const matchTag = !tagFilter || (tx.tagIds && tx.tagIds.includes(tagFilter));

        return matchAccount && matchTag && matchSearch && matchMerchant && matchType && matchStartDate && matchEndDate;
      });
    
    return transactionList.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.date.replace(/-/g, '/')).getTime() - new Date(b.date.replace(/-/g, '/')).getTime();
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        case 'date-desc':
        default:
          return new Date(b.date.replace(/-/g, '/')).getTime() - new Date(a.date.replace(/-/g, '/')).getTime();
      }
    });

  }, [searchTerm, merchantSearchTerm, accountFilter, sortBy, typeFilter, startDate, endDate, displayTransactions, tagFilter]);
  
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
          saveTransaction(transactionUpdates);
      }
      
      setIsCategorizeModalOpen(false);
      setSelectedIds(new Set());
  };
  
    const handleSaveBulkEdits = (updatedTransactions: Transaction[]) => {
        saveTransaction(updatedTransactions);
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
  
  const formatGroupDate = (dateString: string) => {
    const date = new Date(dateString.replace(/-/g, '/'));
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  const typeFilterOptions: { label: string; value: 'all' | 'income' | 'expense' | 'transfer' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
    { label: 'Transfer', value: 'transfer' },
  ];

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
          />
      )}
      {isDeleteConfirmOpen && (
          <Modal onClose={() => setIsDeleteConfirmOpen(false)} title="Confirm Deletion">
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Are you sure you want to delete {selectedIds.size} transaction(s)? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-4 pt-6">
                  <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} className={BTN_SECONDARY_STYLE}>
                      Cancel
                  </button>
                  <button type="button" onClick={handleConfirmBulkDelete} className="bg-semantic-red text-white font-semibold py-2 px-4 rounded-lg shadow-card hover:bg-red-600 transition-all duration-200">
                      Delete
                  </button>
              </div>
          </Modal>
      )}
      <header className="flex justify-between items-center flex-shrink-0">
        <div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">View and manage all your transactions.</p>
        </div>
        <button onClick={handleOpenAddModal} className={BTN_PRIMARY_STYLE}>
            Add Transaction
        </button>
      </header>

      <div className="bg-light-card dark:bg-dark-card rounded-xl shadow-sm p-4 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-3">
                <label htmlFor="search-input" className={labelStyle}>Search Description</label>
                <input id="search-input" type="text" placeholder="e.g., Groceries, Netflix..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={INPUT_BASE_STYLE}/>
            </div>
            <div className="lg:col-span-3">
                <label htmlFor="merchant-search" className={labelStyle}>Merchant</label>
                <input id="merchant-search" type="text" placeholder="e.g., Amazon, Starbucks..." value={merchantSearchTerm} onChange={(e) => setMerchantSearchTerm(e.target.value)} className={INPUT_BASE_STYLE}/>
            </div>
            <div className="lg:col-span-3">
                <label htmlFor="account-filter" className={labelStyle}>Account</label>
                <div className={SELECT_WRAPPER_STYLE}>
                    <select id="account-filter" value={accountFilter || ''} onChange={(e) => setAccountFilter(e.target.value || null)} className={SELECT_STYLE}>
                        <option value="">All Accounts</option>
                        {accounts.map(acc => (<option key={acc.id} value={acc.name}>{acc.name}</option>))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
            </div>
             <div className="lg:col-span-3">
                <label htmlFor="sort-by" className={labelStyle}>Sort By</label>
                <div className={SELECT_WRAPPER_STYLE}>
                    <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={SELECT_STYLE}>
                        <option value="date-desc">Date (Newest)</option>
                        <option value="date-asc">Date (Oldest)</option>
                        <option value="amount-desc">Amount (High-Low)</option>
                        <option value="amount-asc">Amount (Low-High)</option>
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
            </div>

            <div className="lg:col-span-5">
                <label className={labelStyle}>Type</label>
                <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg h-10">
                    {typeFilterOptions.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setTypeFilter(opt.value)} className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all duration-200 ${typeFilter === opt.value ? 'bg-light-card dark:bg-dark-card shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} aria-pressed={typeFilter === opt.value}>{opt.label}</button>
                    ))}
                </div>
            </div>
            
             <div className="lg:col-span-7">
                <label className={labelStyle}>Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                    <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_BASE_STYLE} placeholder="From"/>
                    <input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT_BASE_STYLE} placeholder="To"/>
                </div>
            </div>

             {tagFilter && (
                <div className="lg:col-span-12 flex items-center gap-2 p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
                    <span className="font-semibold text-sm text-primary-700 dark:text-primary-200">Filtered by tag:</span>
                    <span className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded text-xs text-primary-800 dark:text-primary-100">{tags.find(t => t.id === tagFilter)?.name || 'Unknown Tag'}</span>
                    <button onClick={() => setTagFilter(null)} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-primary-700 dark:text-primary-200">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}
        </div>
      </div>
      
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto space-y-6">
            {Object.keys(groupedTransactions).length > 0 ? Object.entries(groupedTransactions).map(([date, group]) => {
                const typedGroup = group as { transactions: DisplayTransaction[]; total: number };
                return (
                <Card key={date} className="p-0 overflow-hidden">
                    <div className="px-6 py-3 border-b border-light-separator dark:border-dark-separator">
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
                            <div key={tx.id} className="grid grid-cols-[auto_minmax(0,1fr)_150px_120px_auto] items-center gap-x-4 group hover:bg-light-fill dark:hover:bg-dark-fill cursor-pointer" onClick={() => handleOpenEditModal(tx)}>
                                <div className="flex items-center gap-3 px-4">
                                    <input type="checkbox" className="w-4 h-4 rounded text-primary-500 bg-transparent border-gray-400 focus:ring-primary-500" checked={selectedIds.has(tx.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(tx.id); }} onClick={e => e.stopPropagation()} aria-label={`Select transaction ${tx.description}`}/>
                                    <div className="w-1.5 h-10 flex-shrink-0 rounded-full" style={{backgroundColor: categoryColor}}></div>
                                </div>
                                <div className="py-3 min-w-0">
                                    <p className="font-semibold text-light-text dark:text-dark-text truncate">{tx.description}</p>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{tx.merchant}</p>
                                    {tx.tagIds && tx.tagIds.length > 0 && (<div className="flex flex-wrap gap-1 mt-1.5">{tx.tagIds.map(tagId => { const tag = tags.find(t => t.id === tagId); if (!tag) return null; return (<span key={tag.id} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tag.color}30`, color: tag.color }}>{tag.name}</span>);})}</div>)}
                                </div>
                                <div className="text-sm text-right text-light-text-secondary dark:text-dark-text-secondary truncate">
                                    {tx.isTransfer ? ( <div className="flex items-center justify-end gap-1 truncate"><span className="truncate">{tx.fromAccountName}</span><span className="material-symbols-outlined text-base">arrow_forward</span><span className="truncate">{tx.toAccountName}</span></div>) : tx.accountName}
                                </div>
                                <div className={`font-mono font-semibold text-right text-base ${amountColor}`}>
                                    {tx.isTransfer && !accountFilter ? '-/+ ' + formatCurrency(convertToEur(Math.abs(amount), tx.currency), 'EUR') : formatCurrency(convertToEur(amount, tx.currency), 'EUR', { showPlusSign: true })}
                                </div>
                                <div className="px-4 text-right">
                                    <button onClick={(e) => {e.stopPropagation(); handleOpenEditModal(tx)}} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-base">edit</span></button>
                                </div>
                            </div>
                            )})}
                    </div>
                </Card>
                );
            }) : (
                <div className="flex flex-col items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">
                    <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                    <p className="font-semibold text-lg">No Transactions Found</p>
                    <p>Try adjusting your search or filters.</p>
                </div>
            )}
        </div>
        {selectedIds.size > 0 && (
            <div className="absolute bottom-4 inset-x-4 mx-auto max-w-2xl z-20">
                <div className="bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-black/10 dark:border-white/10 flex items-center justify-between">
                    <p className="font-semibold">{selectedIds.size} selected</p>
                    <div className="flex items-center gap-2">
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
