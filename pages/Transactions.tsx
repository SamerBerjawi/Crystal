
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
import VirtualizedList from '../components/VirtualizedList';
import { useDebounce } from '../hooks/useDebounce';
import { useThrottledCallback } from '../hooks/useThrottledCallback';

interface TransactionsProps {
  initialAccountFilter?: string | null;
  initialTagFilter?: string | null;
  onClearInitialFilters?: () => void;
}

const MetricCard = React.memo(function MetricCard({ label, value, colorClass = "text-light-text dark:text-dark-text", icon }: { label: string; value: string; colorClass?: string; icon: string }) {
    return (
        <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-black/5 dark:border-white/5 flex items-center gap-4 transition-transform hover:scale-[1.02] duration-200 h-full">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-light-bg dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0`}>
                <span className="material-symbols-outlined text-2xl">{icon}</span>
            </div>
            <div>
                <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-0.5">{label}</p>
                <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
            </div>
        </div>
    );
});

// Helper Component for Column Header
const ColumnHeader = React.memo(function ColumnHeader({
    label,
    sortKey,
    currentSort,
    onSort,
    isFilterActive,
    filterContent,
    className = "",
    alignRight = false
}: {
    label: string;
    sortKey?: string;
    currentSort: string;
    onSort: (key: string) => void;
    isFilterActive?: boolean;
    filterContent?: React.ReactNode;
    className?: string;
    alignRight?: boolean;
}) {
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isSorted = currentSort.startsWith(sortKey || '___');
    const isAsc = currentSort.endsWith('-asc');

    const handleSort = () => {
        if (!sortKey) return;
        // Default to desc for date/amount, asc for text
        const defaultDir = (sortKey === 'date' || sortKey === 'amount') ? 'desc' : 'asc';
        
        if (isSorted) {
            onSort(`${sortKey}-${isAsc ? 'desc' : 'asc'}`);
        } else {
            onSort(`${sortKey}-${defaultDir}`);
        }
    };

    return (
        <div className={`flex items-center gap-1 ${className} ${alignRight ? 'justify-end' : 'justify-start'}`} ref={filterRef}>
            <div 
                className={`flex items-center gap-1 select-none group/sort ${sortKey ? 'cursor-pointer hover:text-primary-500' : ''}`} 
                onClick={handleSort}
            >
                <span className="font-bold text-xs uppercase tracking-wider">{label}</span>
                {sortKey && (
                    <div className={`flex flex-col text-[8px] leading-[6px] ${isSorted ? 'opacity-100' : 'opacity-30 group-hover/sort:opacity-70'}`}>
                        <span className={isSorted && isAsc ? 'text-primary-500' : ''}>▲</span>
                        <span className={isSorted && !isAsc ? 'text-primary-500' : ''}>▼</span>
                    </div>
                )}
            </div>
            {filterContent && (
                <div className="relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
                        className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${isFilterActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-50 hover:opacity-100'}`}
                        title="Filter"
                    >
                        <span className="material-symbols-outlined text-[16px] filled-icon">filter_alt</span>
                    </button>
                    {isFilterOpen && (
                        <div className={`absolute top-full mt-2 ${alignRight ? 'right-0' : 'left-0'} z-50 w-64 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-black/5 dark:border-white/10 p-3 animate-fade-in-up cursor-default text-left normal-case font-normal text-light-text dark:text-dark-text`} onClick={e => e.stopPropagation()}>
                            {filterContent}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

const Transactions: React.FC<TransactionsProps> = ({ initialAccountFilter, initialTagFilter, onClearInitialFilters }) => {
  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { saveRecurringTransaction } = useScheduleContext();
  const [accountFilter, setAccountFilter] = useState<string | null>(initialAccountFilter ?? null);
  const [tagFilter, setTagFilter] = useState<string | null>(initialTagFilter ?? null);

  useEffect(() => {
    setAccountFilter(initialAccountFilter ?? null);
    setTagFilter(initialTagFilter ?? null);
    onClearInitialFilters?.();
  }, [initialAccountFilter, initialTagFilter, onClearInitialFilters]);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
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
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Virtualized list sizing
  const [listHeight, setListHeight] = useState(600);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const throttledUpdateHeight = useThrottledCallback(() => {
    if (!listContainerRef.current) return;
    const measuredHeight = listContainerRef.current.clientHeight;
    setListHeight(measuredHeight > 0 ? measuredHeight : 600);
  }, 150);

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

  useEffect(() => {
    throttledUpdateHeight();

    const resizeObserver = new ResizeObserver(throttledUpdateHeight);
    if (listContainerRef.current) {
      resizeObserver.observe(listContainerRef.current);
    }

    window.addEventListener('resize', throttledUpdateHeight);

    return () => {
      if (listContainerRef.current) {
        resizeObserver.unobserve(listContainerRef.current);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', throttledUpdateHeight);
    };
  }, [throttledUpdateHeight]);

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc; return map; }, {} as { [key: string]: Account }), [accounts]);
  const accountMapByName = useMemo(() => accounts.reduce((map, acc) => { map[acc.name] = acc; return map; }, {} as Record<string, Account>), [accounts]);

  const openContextMenu = useCallback((clientX: number, clientY: number, transaction: DisplayTransaction) => {
    const MENU_WIDTH = 240;
    const MENU_HEIGHT = 200;
    const padding = 12;
    const x = Math.min(clientX, window.innerWidth - MENU_WIDTH - padding);
    const y = Math.min(clientY, window.innerHeight - MENU_HEIGHT - padding);
    setContextMenu({
        x: Math.max(padding, x),
        y: Math.max(padding, y),
        transaction
    });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handleResize = () => {
      openContextMenu(contextMenu.x, contextMenu.y, contextMenu.transaction);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [contextMenu, openContextMenu]);

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

    const normalizeDescription = (description?: string, isTransfer?: boolean) =>
      (description?.trim() || (isTransfer ? 'transfer' : 'transaction')).toLowerCase();

    const getSpareChangeKey = (accountId: string, date: string, description?: string, isTransfer?: boolean) =>
      `${accountId}|${date}|${normalizeDescription(description, isTransfer)}`;

    const spareChangeLookup = sortedTransactions.reduce((map, tx) => {
        if (!tx.transferId?.startsWith('spare-') || tx.amount >= 0) return map;

        const baseDescription = tx.description?.replace(/^Spare change (for|from)\s*/i, '').trim();
        const key = getSpareChangeKey(tx.accountId, tx.date, baseDescription, tx.category === 'Transfer');
        const currentAmount = map.get(key) || 0;
        map.set(key, currentAmount + Math.abs(tx.amount));
        return map;
    }, new Map<string, number>());

    const transferLookup = sortedTransactions.reduce((map, tx) => {
        if (!tx.transferId || tx.transferId.startsWith('spare-')) return map;
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
        if (tx.transferId?.startsWith('spare-')) continue; // Spare change handled separately

        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) continue;

            const pair = transferLookup.get(tx.transferId);
            processedTransferIds.add(tx.transferId);

            if (pair?.expense && pair?.income) {
                const spareKey = getSpareChangeKey(pair.expense.accountId, pair.expense.date, pair.expense.description, true);
                const spareChangeAmount = spareChangeLookup.get(spareKey);

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
                    description: 'Account Transfer',
                    spareChangeAmount,
                });
            } else {
                const spareKey = getSpareChangeKey(tx.accountId, tx.date, tx.description, true);
                result.push({ ...tx, accountName: accountMap[tx.accountId]?.name, spareChangeAmount: spareChangeLookup.get(spareKey) });
            }
        } else {
            const spareKey = getSpareChangeKey(tx.accountId, tx.date, tx.description, false);
            result.push({ ...tx, accountName: accountMap[tx.accountId]?.name, spareChangeAmount: spareChangeLookup.get(spareKey) });
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

    const normalizedSearchTerm = debouncedSearchTerm.trim();

    const transactionList = displayTransactions.filter(tx => {
        const matchAccount = selectedAccountIds.length === 0 ||
            (tx.isTransfer
                ? selectedAccountIds.includes(accountMapByName[tx.fromAccountName!]?.id) || selectedAccountIds.includes(accountMapByName[tx.toAccountName!]?.id)
                : selectedAccountIds.includes(tx.accountId));

        const matchSearch = (
            !normalizedSearchTerm ||
            fuzzySearch(normalizedSearchTerm, tx.description) ||
            fuzzySearch(normalizedSearchTerm, tx.category) ||
            fuzzySearch(normalizedSearchTerm, tx.accountName || '') ||
            fuzzySearch(normalizedSearchTerm, tx.fromAccountName || '') ||
            fuzzySearch(normalizedSearchTerm, tx.toAccountName || '')
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
        case 'merchant-asc': return (a.merchant || '').localeCompare(b.merchant || '');
        case 'merchant-desc': return (b.merchant || '').localeCompare(a.merchant || '');
        case 'category-asc': return a.category.localeCompare(b.category);
        case 'category-desc': return b.category.localeCompare(a.category);
        case 'date-desc': default: return parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime();
      }
    });

  }, [debouncedSearchTerm, sortBy, typeFilter, startDate, endDate, displayTransactions, selectedAccountIds, selectedCategoryNames, selectedTagIds, minAmount, maxAmount, allCategories, accountMapByName, merchantFilter]);
  
  type VirtualRow = { type: 'header'; date: string; total: number } | { type: 'transaction'; transaction: DisplayTransaction };

  const virtualRows: VirtualRow[] = useMemo(() => {
    const transactionsByDate = new Map<string, DisplayTransaction[]>();
    const dateOrder: string[] = [];

    filteredTransactions.forEach((tx) => {
      if (!transactionsByDate.has(tx.date)) {
        dateOrder.push(tx.date);
        transactionsByDate.set(tx.date, []);
      }
      transactionsByDate.get(tx.date)!.push(tx);
    });

    const totalsByDate = new Map<string, number>();

    dateOrder.forEach((date) => {
      const txs = transactionsByDate.get(date) || [];
      let dailyTotal = 0;

      txs.forEach((tx) => {
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

      totalsByDate.set(date, dailyTotal);
    });

    const rows: VirtualRow[] = [];
    dateOrder.forEach((date) => {
      rows.push({ type: 'header', date, total: totalsByDate.get(date) || 0 });
      const txs = transactionsByDate.get(date) || [];
      txs.forEach((tx) => rows.push({ type: 'transaction', transaction: tx }));
    });

    return rows;
  }, [filteredTransactions, selectedAccountIds, accountMapByName]);

  const getRowSize = useCallback(
    (index: number) => {
      const row = virtualRows[index];
      if (!row) return 64;
      if (row.type === 'header') return 42;

      const tagCount = row.transaction.tagIds?.length || 0;
      const extraTagRows = tagCount > 0 ? Math.ceil(tagCount / 3) : 0;
      return 74 + extraTagRows * 16;
    },
    [virtualRows]
  );

  const getRowKey = useCallback(
    (index: number) => {
      const row = virtualRows[index];
      if (!row) return index;
      return row.type === 'header' ? `header-${row.date}` : row.transaction.id;
    },
    [virtualRows]
  );

  const { totalIncome, totalExpense, netFlow } = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach(tx => {
        if (tx.isTransfer) return; // Exclude transfers from totals for cleaner flow view
        const amount = convertToEur(tx.amount, tx.currency);
        if (tx.type === 'income') income += amount;
        else expense += Math.abs(amount);
    });
    return { totalIncome: income, totalExpense: expense, netFlow: income - expense };
  }, [filteredTransactions]);
  
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

      // Use recursive finder to handle sub-categories
      const categoryDetails = findCategoryByName(newCategoryName, allCategories);
      if (!categoryDetails) {
          console.error("Could not find details for new category:", newCategoryName);
          // Don't close if failed, maybe show an alert or just return
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
        
        transaction = expensePart; // Use expense part as base
        toAccountId = incomePart.accountId;
        type = 'transfer';
    } else {
        transaction = transactions.find(t => t.id === displayTx.id);
        if (!transaction) return;
        type = transaction.type;
    }

    const initialRecurringData: Omit<RecurringTransaction, 'id'> & { id?: string } = {
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
        nextDueDate: new Date().toISOString().split('T')[0], // For simplicity
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
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
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
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  const typeFilterOptions: { label: string; value: 'all' | 'income' | 'expense' | 'transfer' }[] = [
    { label: 'All Types', value: 'all' },
    { label: 'Expenses', value: 'expense' },
    { label: 'Income', value: 'income' },
    { label: 'Transfers', value: 'transfer' },
  ];

  const handleAccountToggle = useCallback((id: string) => {
      setSelectedAccountIds(prev =>
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  }, []);

  const handleCategoryToggle = useCallback((name: string) => {
      setSelectedCategoryNames(prev =>
          prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
      );
  }, []);

  const handleTagToggle = useCallback((id: string) => {
      setSelectedTagIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  }, []);

  const dateFilterContent = useMemo(() => (
      <div className="space-y-3 p-1">
          <div className="grid gap-2">
              <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_BASE_STYLE} />
          </div>
          <div className="grid gap-2">
              <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT_BASE_STYLE} />
          </div>
          {(startDate || endDate) && (
              <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-xs text-red-500 w-full text-center hover:underline">Clear Date Filter</button>
          )}
      </div>
  ), [endDate, startDate]);

  const accountFilterContent = useMemo(() => (
      <div className="space-y-2">
           <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {accounts.map(acc => (
                   <label key={acc.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                       <input type="checkbox" checked={selectedAccountIds.includes(acc.id)} onChange={() => handleAccountToggle(acc.id)} className={CHECKBOX_STYLE} />
                       <span className="truncate">{acc.name}</span>
                   </label>
              ))}
          </div>
          {selectedAccountIds.length > 0 && (
              <button onClick={() => setSelectedAccountIds([])} className="text-xs text-red-500 w-full text-center hover:underline pt-1 border-t border-black/5 dark:border-white/5">Clear Selection</button>
          )}
      </div>
  ), [accounts, handleAccountToggle, selectedAccountIds]);

  const merchantFilterContent = useMemo(() => (
      <div className="space-y-2 p-1">
          <input
              type="text"
              placeholder="Filter merchant..."
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
              className={INPUT_BASE_STYLE}
              autoFocus
          />
          {merchantFilter && <button onClick={() => setMerchantFilter('')} className="text-xs text-red-500 w-full text-center hover:underline">Clear</button>}
      </div>
  ), [merchantFilter]);

  const categoryFilterContent = useMemo(() => (
      <div className="space-y-2">
           <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {categoryOptions.map(cat => (
                   <label key={cat.value} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                       <input type="checkbox" checked={selectedCategoryNames.includes(cat.value)} onChange={() => handleCategoryToggle(cat.value)} className={CHECKBOX_STYLE} />
                       <span className="truncate" style={{ paddingLeft: cat.level * 12 }}>{cat.label}</span>
                   </label>
              ))}
          </div>
          {selectedCategoryNames.length > 0 && (
              <button onClick={() => setSelectedCategoryNames([])} className="text-xs text-red-500 w-full text-center hover:underline pt-1 border-t border-black/5 dark:border-white/5">Clear Selection</button>
          )}
      </div>
  ), [categoryOptions, handleCategoryToggle, selectedCategoryNames]);

  const tagFilterContent = useMemo(() => (
      <div className="space-y-2">
          {tagOptions.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {tagOptions.map(tag => (
                      <label key={tag.value} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                          <input type="checkbox" checked={selectedTagIds.includes(tag.value)} onChange={() => handleTagToggle(tag.value)} className={CHECKBOX_STYLE} />
                          <span className="truncate">{tag.label}</span>
                      </label>
                  ))}
              </div>
          ) : (
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary p-2 text-center">No tags found.</p>
          )}
          {selectedTagIds.length > 0 && (
              <button onClick={() => setSelectedTagIds([])} className="text-xs text-red-500 w-full text-center hover:underline pt-1 border-t border-black/5 dark:border-white/5">Clear Selection</button>
          )}
      </div>
  ), [handleTagToggle, selectedTagIds, setSelectedTagIds, tagOptions]);

  const amountFilterContent = useMemo(() => (
      <div className="space-y-3 p-1">
          <div className="grid gap-2">
              <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">Min</label>
              <input type="number" placeholder="0.00" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={INPUT_BASE_STYLE} />
          </div>
          <div className="grid gap-2">
              <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">Max</label>
              <input type="number" placeholder="1000.00" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className={INPUT_BASE_STYLE} />
          </div>
          {(minAmount || maxAmount) && (
              <button onClick={() => {setMinAmount(''); setMaxAmount('');}} className="text-xs text-red-500 w-full text-center hover:underline">Clear Amount Filter</button>
          )}
      </div>
  ), [maxAmount, minAmount]);


  return (
    <div className="space-y-6 flex flex-col h-full animate-fade-in-up">
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
                className="fixed z-50 w-56 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 py-2 animate-fade-in-up"
            >
                <ul className="text-sm">
                    <li>
                        <button onClick={() => { setEditingTransaction(transactions.find(t => t.id === (contextMenu.transaction.isTransfer ? contextMenu.transaction.originalId : contextMenu.transaction.id)) || null); setIsTransactionModalOpen(true); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
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

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">View and manage your financial activity.</p>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={handleExport} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
                <span className="material-symbols-outlined text-base">download</span>
                Export
            </button>
            <button onClick={handleOpenAddModal} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                <span className="material-symbols-outlined text-base">add</span>
                Add Transaction
            </button>
        </div>
      </header>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-none relative overflow-hidden p-5 flex flex-col justify-center h-full">
            <div className="relative z-10">
                <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Total Transactions</p>
                <p className="text-3xl font-extrabold mt-1">{filteredTransactions.length}</p>
                <p className="text-sm opacity-80 mt-1">in selected period</p>
            </div>
            <div className="absolute -right-4 -bottom-6 text-white opacity-10">
                <span className="material-symbols-outlined text-9xl">receipt_long</span>
            </div>
        </Card>
        <MetricCard label="Total Income" value={formatCurrency(totalIncome, 'EUR')} colorClass="text-green-600 dark:text-green-400" icon="arrow_downward" />
        <MetricCard label="Total Expenses" value={formatCurrency(totalExpense, 'EUR')} colorClass="text-red-600 dark:text-red-400" icon="arrow_upward" />
        <MetricCard label="Net Cash Flow" value={formatCurrency(netFlow, 'EUR', { showPlusSign: true })} colorClass={netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} icon="account_balance_wallet" />
      </div>
      
      {/* Filter Toolbar */}
      <div className={`p-4 bg-white dark:bg-dark-card rounded-2xl border border-black/5 dark:border-white/5 shadow-sm transition-all duration-300`}>
          <div className="flex flex-col gap-4">
              {/* Main Row */}
              <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-end">
                 <div className="flex-grow w-full xl:w-auto">
                      <label htmlFor="search" className={labelStyle}>Search</label>
                      <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">search</span>
                          <input ref={searchInputRef} type="text" id="search" placeholder="Description, category, account..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10`} />
                      </div>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full xl:w-auto">
                      <div>
                          <label htmlFor="type-filter" className={labelStyle}>Type</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                              <select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className={`${INPUT_BASE_STYLE} py-2 pr-10`}>
                                  {typeFilterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                          </div>
                      </div>
                      <div>
                          <label htmlFor="sort-by" className={labelStyle}>Sort By</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                              <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${INPUT_BASE_STYLE} py-2 pr-10`}>
                                <option value="date-desc">Date (Newest)</option>
                                <option value="date-asc">Date (Oldest)</option>
                                <option value="amount-desc">Amount (High)</option>
                                <option value="amount-asc">Amount (Low)</option>
                                <option value="merchant-asc">Merchant (A-Z)</option>
                                <option value="merchant-desc">Merchant (Z-A)</option>
                                <option value="category-asc">Category (A-Z)</option>
                                <option value="category-desc">Category (Z-A)</option>
                              </select>
                              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                          </div>
                      </div>
                      <div className="col-span-2 md:col-span-2 flex items-end">
                         <button 
                            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition-colors ${isFiltersExpanded ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-light-fill dark:bg-dark-fill text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                        >
                            <span className="material-symbols-outlined text-lg">tune</span>
                            {isFiltersExpanded ? 'Less Filters' : 'More Filters'}
                         </button>
                      </div>
                 </div>
              </div>
              
              {/* Expanded Filters */}
              {isFiltersExpanded && (
                <div className="pt-4 border-t border-black/5 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-fade-in-up">
                  <div>
                      <label className={labelStyle}>Account</label>
                      <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds}/>
                  </div>
                  <div>
                      <label className={labelStyle}>Category</label>
                      <MultiSelectFilter options={categoryOptions} selectedValues={selectedCategoryNames} onChange={setSelectedCategoryNames} placeholder="All Categories"/>
                  </div>
                  <div>
                      <label className={labelStyle}>Tags</label>
                      <MultiSelectFilter options={tagOptions} selectedValues={selectedTagIds} onChange={setSelectedTagIds} placeholder="All Tags"/>
                  </div>
                  <div>
                      <label htmlFor="merchant-filter" className={labelStyle}>Merchant</label>
                      <input id="merchant-filter" type="text" placeholder="e.g., Amazon" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} className={`${INPUT_BASE_STYLE}`} />
                  </div>

                  <div className="md:col-span-2 flex items-end gap-2">
                      <div className="flex-1"><label htmlFor="start-date" className={labelStyle}>From Date</label><input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE}`}/></div>
                      <div className="flex-1"><label htmlFor="end-date" className={labelStyle}>To Date</label><input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE}`}/></div>
                  </div>
                  <div className="md:col-span-2 flex items-end gap-2">
                      <div className="flex-1"><label htmlFor="min-amount" className={labelStyle}>Min Amount</label><input id="min-amount" type="number" placeholder="0.00" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={`${INPUT_BASE_STYLE}`}/></div>
                      <div className="flex-1"><label htmlFor="max-amount" className={labelStyle}>Max Amount</label><input id="max-amount" type="number" placeholder="1000.00" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className={`${INPUT_BASE_STYLE}`}/></div>
                  </div>
                  <div className="xl:col-span-4 flex justify-end">
                      <button onClick={clearFilters} className="text-sm text-primary-500 hover:underline font-medium">Clear All Filters</button>
                  </div>
                </div>
              )}
          </div>
      </div>
      
      {/* Transaction List Card */}
      <div className="flex-1 min-w-0 relative">
        <Card className="p-0 h-full flex flex-col relative overflow-hidden border border-black/5 dark:border-white/5 shadow-sm">
            {selectedIds.size > 0 ? (
                <div className="bg-primary-600 dark:bg-primary-800 text-white px-6 flex justify-between items-center h-[56px] z-30 relative shadow-md">
                     <div className="flex items-center gap-4">
                         <button 
                            onClick={() => setSelectedIds(new Set())} 
                            className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
                            aria-label="Deselect all"
                         >
                             <span className="material-symbols-outlined text-lg">close</span>
                         </button>
                         <span className="font-bold text-sm">{selectedIds.size} selected</span>
                     </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setBulkEditModalOpen(true)} className="bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm" disabled={containsTransfer}>Edit</button>
                        <button type="button" onClick={handleOpenCategorizeModal} className="bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm" disabled={containsTransfer}>Categorize</button>
                        <button type="button" onClick={() => handleMakeRecurring()} className="bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm" disabled={selectedIds.size !== 1}>Recurring</button>
                        <button type="button" onClick={handleOpenDeleteModal} className="bg-red-500/80 hover:bg-red-500 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm">Delete</button>
                    </div>
                </div>
            ) : (
                <div className="px-6 py-2.5 border-b border-black/5 dark:border-white/5 flex items-center gap-4 text-light-text dark:text-dark-text bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center justify-center w-5">
                         <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} className={CHECKBOX_STYLE} aria-label="Select all transactions"/>
                    </div>
                    <div className="flex-1 grid grid-cols-12 gap-3 ml-2 items-center">
                        <div className="col-span-7 md:col-span-4 lg:col-span-3">
                            <ColumnHeader
                                label="Transaction"
                                sortKey="date"
                                currentSort={sortBy}
                                onSort={setSortBy}
                                isFilterActive={!!startDate || !!endDate}
                                filterContent={dateFilterContent}
                            />
                        </div>
                        <div className="hidden md:block col-span-2">
                             <ColumnHeader
                                label="Account"
                                isFilterActive={selectedAccountIds.length > 0}
                                currentSort={sortBy}
                                onSort={setSortBy} // No sort key for account, just label
                                filterContent={accountFilterContent}
                             />
                        </div>
                        <div className="hidden lg:block col-span-2">
                            <ColumnHeader
                                label="Merchant"
                                sortKey="merchant"
                                currentSort={sortBy}
                                onSort={setSortBy}
                                isFilterActive={!!merchantFilter}
                                filterContent={merchantFilterContent}
                            />
                        </div>
                        <div className="hidden md:block col-span-1 text-center">
                            <ColumnHeader
                                label="Category"
                                sortKey="category"
                                currentSort={sortBy}
                                onSort={setSortBy}
                                isFilterActive={selectedCategoryNames.length > 0}
                                filterContent={categoryFilterContent}
                                className="justify-center"
                            />
                        </div>
                        <div className="hidden lg:block col-span-1 text-center">
                            <ColumnHeader
                                label="Tags"
                                currentSort={sortBy}
                                onSort={setSortBy}
                                isFilterActive={selectedTagIds.length > 0}
                                filterContent={tagFilterContent}
                                className="justify-center"
                            />
                        </div>
                        <div className="hidden md:block col-span-1 text-center">
                             <ColumnHeader
                                label="Spare"
                                currentSort={sortBy}
                                onSort={setSortBy}
                                className="justify-center"
                             />
                        </div>
                        <div className="col-span-4 md:col-span-3 lg:col-span-2 flex justify-center text-center">
                             <ColumnHeader
                                label="Amount"
                                sortKey="amount"
                                currentSort={sortBy}
                                onSort={setSortBy}
                                isFilterActive={!!minAmount || !!maxAmount}
                                filterContent={amountFilterContent}
                                className="justify-center"
                            />
                        </div>
                    </div>
                    <div className="w-8"></div>
                </div>
            )}
            

            <div
              ref={listContainerRef}
              className="flex-grow bg-white dark:bg-dark-card"
              style={{ height: '60vh', minHeight: '400px' }}
            >
              {virtualRows.length > 0 ? (
                <VirtualizedList
                  height={listHeight}
                  itemCount={virtualRows.length}
                  estimatedItemSize={80}
                  getItemSize={getRowSize}
                  itemKey={getRowKey}
                >
                  {({ index, style }) => {
                    const row = virtualRows[index];
                    if (!row) return null;

                    if (row.type === 'header') {
                      return (
                        <div
                          style={style}
                          className="px-6 py-2 border-b border-black/5 dark:border-white/5 bg-gray-50 dark:bg-black/20 flex justify-between items-center"
                        >
                          <span className="font-bold text-sm text-light-text dark:text-dark-text">{formatGroupDate(row.date)}</span>
                          <span className={`font-bold text-sm ${row.total > 0 ? 'text-green-600 dark:text-green-400' : row.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                            {formatCurrency(row.total, 'EUR', { showPlusSign: true })}
                          </span>
                        </div>
                      );
                    }

                    const tx = row.transaction;
                    const isStriped = index % 2 === 1;
                    let amount = tx.amount;
                    let amountColor = tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

                    if (tx.isTransfer) {
                      amountColor = 'text-light-text dark:text-dark-text';
                      if (selectedAccountIds.length > 0) {
                        const fromAcc = accountMapByName[tx.fromAccountName!];
                        const toAcc = accountMapByName[tx.toAccountName!];
                        if (selectedAccountIds.includes(fromAcc?.id) && !selectedAccountIds.includes(toAcc?.id)) { amount = -tx.amount; amountColor = 'text-red-600 dark:text-red-400'; }
                        else if (!selectedAccountIds.includes(fromAcc?.id) && selectedAccountIds.includes(toAcc?.id)) { amount = tx.amount; amountColor = 'text-green-600 dark:text-green-400'; }
                      }
                    }

                    const categoryDetails = getCategoryDetails(tx.category, allCategories);
                    const categoryColor = tx.isTransfer ? '#64748B' : (categoryDetails.color || '#A0AEC0');
                    const categoryIcon = tx.isTransfer ? 'swap_horiz' : (categoryDetails.icon || 'category');

                    return (
                      <div
                        key={tx.id}
                        style={style}
                        className={`flex items-center group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors px-5 py-2.5 cursor-default relative border-b border-black/5 dark:border-white/5 ${isStriped ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''}`}
                        onClick={() => { /* handle row click if needed */ }}
                        onContextMenu={(e) => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, tx); }}
                      >
                        <div className="flex items-center gap-4">
                          <input type="checkbox" className={CHECKBOX_STYLE} checked={selectedIds.has(tx.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(tx.id); }} onClick={e => e.stopPropagation()} aria-label={`Select transaction ${tx.description}`} />
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm shrink-0`} style={{ backgroundColor: categoryColor }}>
                            <span className="material-symbols-outlined text-[18px]">{categoryIcon}</span>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-12 gap-3 items-center ml-3 min-w-0">
                          {/* Description & Date (Mobile/Desktop) */}
                          <div className="col-span-7 md:col-span-4 lg:col-span-3 min-w-0">
                            <p className="font-bold text-light-text dark:text-dark-text truncate text-sm">{tx.description}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                              <span className="md:hidden truncate bg-gray-100 dark:bg-white/10 px-1.5 rounded">{tx.isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : tx.accountName}</span>
                              {tx.tagIds && tx.tagIds.length > 0 && (
                                <div className="lg:hidden flex flex-wrap gap-1">
                                  {tx.tagIds.map(tagId => {
                                    const tag = tags.find(t => t.id === tagId);
                                    if (!tag) return null;
                                    return (<span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>#{tag.name}</span>);
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Account */}
                          <div className="hidden md:flex col-span-2 text-sm text-light-text-secondary dark:text-dark-text-secondary items-center truncate">
                            {tx.isTransfer ? (
                              <div className="flex items-center gap-1 truncate bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-md">
                                <span className="truncate max-w-[80px]">{tx.fromAccountName}</span>
                                <span className="material-symbols-outlined text-xs opacity-60">arrow_forward</span>
                                <span className="truncate max-w-[80px]">{tx.toAccountName}</span>
                              </div>
                            ) : (
                              <span className="truncate">{tx.accountName}</span>
                            )}
                          </div>

                          {/* Merchant */}
                          <div className="hidden lg:block col-span-2 text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{tx.merchant || '—'}</div>

                          {/* Category */}
                          <div className="hidden md:flex col-span-1 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary truncate justify-center">
                            <span className="px-2 py-0.5 rounded-full border border-black/5 dark:border-white/10 bg-white dark:bg-black/20 text-center">{tx.category}</span>
                          </div>

                          {/* Tags */}
                          <div className="hidden lg:flex col-span-1 flex-wrap gap-1 justify-center text-center">
                            {tx.tagIds?.map(tagId => {
                              const tag = tags.find(t => t.id === tagId);
                              if (!tag) return null;
                              return (
                                <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold tracking-wide" style={{ backgroundColor: `${tag.color}20`, color: tag.color }} title={tag.name}>
                                  {tag.name}
                                </span>
                              );
                            })}
                          </div>

                          {/* Spare Change */}
                          <div className="hidden md:block col-span-1 text-sm font-mono text-center text-light-text-secondary dark:text-dark-text-secondary">
                            {tx.spareChangeAmount ? (
                              <span className="text-semantic-red">{formatCurrency(convertToEur(-Math.abs(tx.spareChangeAmount), tx.currency), 'EUR', { showPlusSign: true })}</span>
                            ) : (
                              '—'
                            )}
                          </div>

                          {/* Amount */}
                          <div className={`col-span-4 md:col-span-3 lg:col-span-2 font-mono font-bold text-center text-sm whitespace-nowrap ${amountColor}`}>
                            {tx.isTransfer && selectedAccountIds.length === 0
                              ? '-/+ ' + formatCurrency(convertToEur(Math.abs(amount), tx.currency), 'EUR')
                              : formatCurrency(convertToEur(amount, tx.currency), 'EUR', { showPlusSign: true })}
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openContextMenu(e.clientX, e.clientY, tx);
                            }}
                            aria-label="Actions"
                          >
                            <span className="material-symbols-outlined text-xl">more_vert</span>
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </VirtualizedList>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                  <span className="material-symbols-outlined text-5xl mb-2">search_off</span>
                  <p>No transactions match the current filters.</p>
                </div>
              )}
            </div>
          </Card>
      </div>
    </div>
  );
};

export default Transactions;
