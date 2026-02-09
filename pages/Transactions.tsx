
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { Transaction, Account, DisplayTransaction, RecurringTransaction, Category, AccountType } from '../types';
import Card from '../components/Card';
import { formatCurrency, fuzzySearch, convertToEur, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectFilter from '../components/MultiSelectFilter';
import MultiAccountFilter from '../components/MultiAccountFilter';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import VirtualizedList from '../components/VirtualizedList';
import { useDebounce } from '../hooks/useDebounce';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import PageHeader from '../components/PageHeader';

interface TransactionsProps {
  initialAccountFilter?: string | null;
  initialTagFilter?: string | null;
  onClearInitialFilters?: () => void;
}

const MetricCard = React.memo(function MetricCard({ label, value, colorClass = "text-light-text dark:text-dark-text", icon }: { label: string; value: string; colorClass?: string; icon: string }) {
    return (
        <div className="bg-gray-50 dark:bg-dark-card p-4 rounded-xl shadow-sm border border-black/5 dark:border-white/5 flex items-center gap-4 transition-transform hover:scale-[1.02] duration-200 h-full">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0`}>
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
        <div className={`flex items-center gap-2 ${className} ${alignRight ? 'justify-end' : 'justify-start'}`} ref={filterRef}>
            <div 
                className={`flex items-center gap-1.5 select-none cursor-pointer group/sort py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200`} 
                onClick={handleSort}
            >
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${isSorted ? 'text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary group-hover/sort:text-light-text dark:group-hover/sort:text-dark-text'}`}>
                    {label}
                </span>
                
                {sortKey && (
                    <div className={`flex flex-col gap-[1px] ${isSorted ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-40'} transition-opacity duration-200`}>
                        <span className={`material-symbols-outlined text-[10px] leading-none ${isSorted && isAsc ? 'text-primary-500' : 'text-gray-400'}`}>arrow_drop_up</span>
                        <span className={`material-symbols-outlined text--[10px] leading-none -mt-1 ${isSorted && !isAsc ? 'text-primary-500' : 'text-gray-400'}`}>arrow_drop_down</span>
                    </div>
                )}
            </div>
            {filterContent && (
                <div className="relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-all duration-200 ${isFilterActive || isFilterOpen ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10'}`}
                        title="Filter"
                    >
                        <span className={`material-symbols-outlined text-[14px] ${isFilterActive ? 'filled-icon' : ''}`}>filter_alt</span>
                    </button>
                    {isFilterOpen && (
                        <div className={`absolute top-full mt-2 ${alignRight ? 'right-0' : 'left-0'} z-50 w-64 bg-white/90 dark:bg-dark-card/90 backdrop-blur-xl rounded-xl shadow-xl border border-black/5 dark:border-white/10 p-3 animate-fade-in-up cursor-default text-left normal-case font-normal text-light-text dark:text-dark-text`} onClick={e => e.stopPropagation()}>
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
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {});
  const hiddenMerchants = usePreferencesSelector(p => p.hiddenMerchants || []);
  const [accountFilter, setAccountFilter] = useState<string | null>(initialAccountFilter ?? null);
  const [tagFilter, setTagFilter] = useState<string | null>(initialTagFilter ?? null);
  const appliedInitialFiltersRef = useRef<{ account: string | null; tag: string | null } | null>(null);

  useEffect(() => {
    const nextAccount = initialAccountFilter ?? null;
    const nextTag = initialTagFilter ?? null;
    const hasInitialFilters = Boolean(nextAccount || nextTag);
    if (!hasInitialFilters) return;

    const lastApplied = appliedInitialFiltersRef.current;
    if (!lastApplied || lastApplied.account !== nextAccount || lastApplied.tag !== nextTag) {
      setAccountFilter(nextAccount);
      setTagFilter(nextTag);
      appliedInitialFiltersRef.current = { account: nextAccount, tag: nextTag };
      onClearInitialFilters?.();
    }
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

  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null); // For duplication
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
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});

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
    } else {
      setSelectedAccountIds([]);
    }
  }, [accountFilter, accounts]);

  useEffect(() => {
    if (tagFilter) {
      setSelectedTagIds([tagFilter]);
    } else {
      setSelectedTagIds([]);
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

  const openContextMenu = useCallback((event: React.MouseEvent, transaction: DisplayTransaction) => {
    event.preventDefault();
    const menuWidth = 224; // w-56
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const desiredX = event.clientX - menuWidth - padding;
    const x = Math.max(padding, Math.min(desiredX, viewportWidth - menuWidth - padding));
    const y = Math.min(event.clientY, viewportHeight - 200);
    setContextMenu({ x, y, transaction });
  }, []);

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

  const effectiveMerchantLogoOverrides = useMemo(() => {
    const ruleLogoOverrides = Object.entries(merchantRules).reduce((acc, [merchantKey, rule]) => {
      if (rule?.logo) acc[merchantKey] = rule.logo;
      return acc;
    }, {} as Record<string, string>);

    return {
      ...merchantLogoOverrides,
      ...ruleLogoOverrides,
    };
  }, [merchantLogoOverrides, merchantRules]);

  const hiddenMerchantKeys = useMemo(() => {
    const fromRules = Object.entries(merchantRules)
      .filter(([, rule]) => rule?.isHidden)
      .map(([merchantKey]) => merchantKey);

    const fromLegacy = hiddenMerchants
      .map(merchantName => normalizeMerchantKey(merchantName))
      .filter((merchantKey): merchantKey is string => Boolean(merchantKey));

    return new Set([...fromRules, ...fromLegacy]);
  }, [merchantRules, hiddenMerchants]);

  const merchantLogoUrls = useMemo(() => {
    if (!brandfetchClientId) return {} as Record<string, string>;
    return transactions.reduce((acc, tx) => {
      const key = normalizeMerchantKey(tx.merchant);
      if (!key || acc[key]) return acc;
      const url = getMerchantLogoUrl(tx.merchant, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 96, height: 96 });
      if (url) acc[key] = url;
      return acc;
    }, {} as Record<string, string>);
  }, [brandfetchClientId, effectiveMerchantLogoOverrides, transactions]);

  const handleLogoError = useCallback((logoUrl: string) => {
    setLogoLoadErrors(prev => (prev[logoUrl] ? prev : { ...prev, [logoUrl]: true }));
  }, []);

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

    const sortedTransactions = [...transactions].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

    const normalizeDescription = (description?: string, isTransfer?: boolean) =>
      (description?.trim() || (isTransfer ? 'transfer' : 'transaction')).toLowerCase();

    const getSpareChangeKey = (accountId: string, date: string, description?: string, isTransfer?: boolean) =>
      `${accountId}|${date}|${normalizeDescription(description, isTransfer)}`;

    // Store array of amounts for each key to handle multiple transactions with same description/date
    const spareChangeLookup = sortedTransactions.reduce((map, tx) => {
        if (!tx.transferId?.startsWith('spare-') || tx.amount >= 0) return map;

        const baseDescription = tx.description?.replace(/^Spare change (for|from)\s*/i, '').trim();
        const key = getSpareChangeKey(tx.accountId, tx.date, baseDescription, false);
        
        const currentAmounts = map.get(key) || [];
        currentAmounts.push(Math.abs(tx.amount));
        map.set(key, currentAmounts);
        return map;
    }, new Map<string, number[]>());

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

    const consumeSpareChange = (accountId: string, date: string, description?: string, isTransfer?: boolean, txAmount?: number) => {
         const key = getSpareChangeKey(accountId, date, description, isTransfer);
         const amounts = spareChangeLookup.get(key);
         
         if (!amounts || amounts.length === 0) return undefined;
         
         // Try to find a logical match based on standard round up
         let bestIndex = 0;
         if (txAmount !== undefined) {
             const absAmt = Math.abs(txAmount);
             const remainder = absAmt % 1;
             // Default logic: 1.0 - remainder. If remainder 0, checking for 1.0 (unit)
             const expected = parseFloat((remainder === 0 ? 1.00 : (1.00 - remainder)).toFixed(2));
             
             // Look for exact match to expected
             const idx = amounts.findIndex(a => Math.abs(a - expected) < 0.005);
             if (idx !== -1) bestIndex = idx;
         }
         
         const amount = amounts[bestIndex];
         amounts.splice(bestIndex, 1);
         if (amounts.length === 0) spareChangeLookup.delete(key);
         return amount;
    };

    for (const tx of sortedTransactions) {
        if (tx.transferId?.startsWith('spare-')) continue; // Spare change handled separately

        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) continue;

            const pair = transferLookup.get(tx.transferId);
            processedTransferIds.add(tx.transferId);

            if (pair?.expense && pair?.income) {
                const spareChangeAmount = consumeSpareChange(pair.expense.accountId, pair.expense.date, pair.expense.description, true, pair.expense.amount);

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
                    transferExpenseAmount: Math.abs(pair.expense.amount),
                    transferExpenseCurrency: pair.expense.currency,
                    transferIncomeAmount: Math.abs(pair.income.amount),
                    transferIncomeCurrency: pair.income.currency,
                });
            } else {
                const spareChangeAmount = consumeSpareChange(tx.accountId, tx.date, tx.description, false, tx.amount);
                result.push({ ...tx, accountName: accountMap[tx.accountId]?.name, spareChangeAmount });
            }
        } else {
            const spareChangeAmount = consumeSpareChange(tx.accountId, tx.date, tx.description, false, tx.amount);
            result.push({ ...tx, accountName: accountMap[tx.accountId]?.name, spareChangeAmount });
        }
    }
    return result;
  }, [transactions, accountMap]);

  const indexedTransactions = useMemo(() => {
    return displayTransactions.map(tx => {
      const amountEur = convertToEur(tx.amount, tx.currency);
      const amountAbsEur = Math.abs(amountEur);
      const searchText = [
        tx.description,
        tx.category,
        tx.accountName,
        tx.fromAccountName,
        tx.toAccountName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const merchantText = (tx.merchant || '').toLowerCase();
      return { tx, amountEur, amountAbsEur, searchText, merchantText };
    });
  }, [displayTransactions]);

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

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const normalizedMerchantFilter = merchantFilter.trim().toLowerCase();

    const transactionList = indexedTransactions.filter(({ tx, amountAbsEur, searchText, merchantText }) => {
        const matchAccount = selectedAccountIds.length === 0 ||
            (tx.isTransfer
                ? selectedAccountIds.includes(accountMapByName[tx.fromAccountName!]?.id) || selectedAccountIds.includes(accountMapByName[tx.toAccountName!]?.id)
                : selectedAccountIds.includes(tx.accountId));

        const matchSearch = (
            !normalizedSearchTerm ||
            fuzzySearch(normalizedSearchTerm, searchText)
        );
        
        const matchMerchant = !normalizedMerchantFilter || fuzzySearch(normalizedMerchantFilter, merchantText);

        const merchantKey = normalizeMerchantKey(tx.merchant);
        const isHiddenMerchant = merchantKey ? hiddenMerchantKeys.has(merchantKey) : false;

        let matchType = true;
        if (typeFilter === 'expense') matchType = !tx.isTransfer && tx.type === 'expense';
        else if (typeFilter === 'income') matchType = !tx.isTransfer && tx.type === 'income';
        else if (typeFilter === 'transfer') matchType = !!tx.isTransfer;
        
        const txDateTime = parseLocalDate(tx.date).getTime();
        const matchStartDate = !startDateTime || txDateTime >= startDateTime.getTime();
        const matchEndDate = !endDateTime || txDateTime <= endDateTime.getTime();

        const matchTag = selectedTagIds.length === 0 || (tx.tagIds && tx.tagIds.some(tagId => selectedTagIds.includes(tagId)));
        
        const matchCategory = selectedCategoryNames.length === 0 || selectedCategoryNames.includes(tx.category) || selectedCategoryNames.includes(getParentCategoryName(tx.category) || '');

        const min = parseFloat(minAmount);
        const max = parseFloat(maxAmount);
        const matchMinAmount = isNaN(min) || amountAbsEur >= min;
        const matchMaxAmount = isNaN(max) || amountAbsEur <= max;

        return !isHiddenMerchant && matchAccount && matchTag && matchSearch && matchType && matchStartDate && matchEndDate && matchCategory && matchMinAmount && matchMaxAmount && matchMerchant;
      }).map(({ tx }) => tx);
    
    return transactionList.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
        case 'amount-desc': return Math.abs(b.amount) - Math.abs(a.amount);
        case 'amount-asc': return Math.abs(a.amount) - Math.abs(b.amount);
        case 'merchant-asc': return (a.merchant || '').localeCompare(b.merchant || '');
        case 'merchant-desc': return (b.merchant || '').localeCompare(a.merchant || '');
        case 'category-asc': return a.category.localeCompare(b.category);
        case 'category-desc': return b.category.localeCompare(a.category);
        case 'date-desc': default: return parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime();
      }
    });

  }, [debouncedSearchTerm, sortBy, typeFilter, startDate, endDate, indexedTransactions, selectedAccountIds, selectedCategoryNames, selectedTagIds, minAmount, maxAmount, allCategories, accountMapByName, merchantFilter, hiddenMerchantKeys]);
  
  type VirtualRow = { type: 'header'; date: string; total: number } | { type: 'transaction'; transaction: DisplayTransaction };

  const virtualRows: VirtualRow[] = useMemo(() => {
    const rows: VirtualRow[] = [];
    
    // Group by date if sorted by date
    if (sortBy === 'date-desc' || sortBy === 'date-asc') {
        let lastDate = '';
        filteredTransactions.forEach(tx => {
            const dateStr = tx.date; // ISO string YYYY-MM-DD
            if (dateStr !== lastDate) {
                rows.push({ type: 'header', date: dateStr, total: 0 }); // Total calculated later if needed or skipped
                lastDate = dateStr;
            }
            rows.push({ type: 'transaction', transaction: tx });
        });
    } else {
        // Flat list for other sorts
        filteredTransactions.forEach(tx => {
            rows.push({ type: 'transaction', transaction: tx });
        });
    }
    return rows;
  }, [filteredTransactions, sortBy]);

  const getRowSize = useCallback(
    (index: number) => {
        const row = virtualRows[index];
        if (row && row.type === 'header') return 40; // Smaller height for date headers
        return 80;
    },
    [virtualRows]
  );

  const getRowKey = useCallback(
    (index: number) => {
      const row = virtualRows[index];
      if (!row) return index;
      if (row.type === 'header') return `header-${row.date}`;
      return (row as any).transaction.id;
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
  
  const isAllSelected = useMemo(() => {
      if (filteredTransactions.length === 0) return false;
      return filteredTransactions.every(tx => selectedIds.has(tx.id));
  }, [filteredTransactions, selectedIds]);
  
    const selectedTransactions = useMemo(() => {
        const resolvedIds = new Set<string>();
        selectedIds.forEach(id => {
            if (id.startsWith('transfer-')) {
                 const transferId = id.replace('transfer-', '');
                 // Find the expense side transaction for this transfer (typically what is displayed)
                 const tx = transactions.find(t => t.transferId === transferId && t.type === 'expense');
                 if (tx) resolvedIds.add(tx.id);
            } else {
                 resolvedIds.add(id);
            }
        });
        return transactions.filter(t => resolvedIds.has(t.id));
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
    setIsCategorizeModalOpen(true);
  };

  const handleSaveBulkCategory = (newCategoryName: string) => {
      const transactionUpdates: (Omit<Transaction, 'id'> & { id: string })[] = [];
      const idsToDelete: string[] = [];

      // Use recursive finder to handle sub-categories
      const categoryDetails = findCategoryByName(newCategoryName, allCategories);
      if (!categoryDetails) {
          console.error("Could not find details for new category:", newCategoryName);
          // Don't close if failed, maybe show an alert or just return
          return;
      }
      
      const newType = categoryDetails.classification || 'expense';

      // Iterate through raw selectedIds to handle transfers properly
      for (const selectedId of selectedIds) {
          let originalTx: Transaction | undefined;
          
          if (selectedId.startsWith('transfer-')) {
               const transferId = selectedId.replace('transfer-', '');
               originalTx = transactions.find(t => t.transferId === transferId && t.type === 'expense');
               
               // If we are converting a transfer to a category, we need to delete the income side counterpart
               if (originalTx) {
                   const counterpart = transactions.find(t => t.transferId === transferId && t.id !== originalTx.id);
                   if (counterpart) idsToDelete.push(counterpart.id);
               }
          } else {
               originalTx = transactions.find(t => t.id === selectedId);
          }

          if (originalTx) {
              const newAmount = newType === 'income' ? Math.abs(originalTx.amount) : -Math.abs(originalTx.amount);
              transactionUpdates.push({ 
                  ...originalTx, 
                  category: newCategoryName,
                  type: newType,
                  amount: newAmount,
                  transferId: undefined // Remove transfer link if it was one
              });
          }
      }
      
      if (transactionUpdates.length > 0) {
          saveTransaction(transactionUpdates, idsToDelete);
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
    setDuplicateData(null);
    setTransactionModalOpen(true);
  };

  const handleDuplicate = (tx: DisplayTransaction) => {
    const original = transactions.find(t => t.id === (tx.isTransfer ? tx.originalId : tx.id));
    if (!original) return;

    setDuplicateData({
        initialType: original.type,
        initialFromAccountId: original.accountId,
        initialCategory: original.category,
        initialDetails: {
            date: original.date,
            amount: String(Math.abs(original.amount)),
            description: original.description,
            merchant: original.merchant
        }
    });
    setEditingTransaction(null);
    setTransactionModalOpen(true);
  };

  const handleCloseModal = () => {
    setTransactionModalOpen(false);
    setEditingTransaction(null);
    setDuplicateData(null);
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
        startDate: toLocalISOString(new Date()),
        nextDueDate: toLocalISOString(new Date()), // For simplicity
        weekendAdjustment: 'on',
    };

    setTransactionToMakeRecurring(initialRecurringData);
    setIsRecurringModalOpen(true);
  };

  const resolveTransferDisplay = useCallback((tx: DisplayTransaction) => {
    if (!tx.isTransfer) {
      return { amount: tx.amount, currency: tx.currency };
    }
    const expenseAmount = tx.transferExpenseAmount ?? Math.abs(tx.amount);
    const expenseCurrency = tx.transferExpenseCurrency ?? tx.currency;
    const incomeAmount = tx.transferIncomeAmount ?? expenseAmount;
    const incomeCurrency = tx.transferIncomeCurrency ?? expenseCurrency;

    const fromAccId = accountMapByName[tx.fromAccountName || '']?.id;
    const toAccId = accountMapByName[tx.toAccountName || '']?.id;
    const fromSelected = fromAccId ? selectedAccountIds.includes(fromAccId) : false;
    const toSelected = toAccId ? selectedAccountIds.includes(toAccId) : false;

    if (selectedAccountIds.length > 0) {
      if (fromSelected && !toSelected) {
        return { amount: -Math.abs(expenseAmount), currency: expenseCurrency };
      }
      if (!fromSelected && toSelected) {
        return { amount: Math.abs(incomeAmount), currency: incomeCurrency };
      }
    }

    return { amount: Math.abs(expenseAmount), currency: expenseCurrency };
  }, [accountMapByName, selectedAccountIds]);

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
        alert("No transactions to export.");
        return;
    }
    const dataForExport = filteredTransactions.map(tx => {
        const { id, originalId, accountId, transferId, recurringSourceId, importId, sureId, ...rest } = tx;
        const resolved = resolveTransferDisplay(tx);
        return {
            date: rest.date,
            description: rest.description,
            merchant: rest.merchant,
            amount: resolved.amount,
            currency: resolved.currency,
            category: rest.category,
            type: rest.isTransfer ? 'transfer' : rest.type,
            account: rest.accountName || (rest.isTransfer ? `${rest.fromAccountName} → ${rest.toAccountName}` : 'N/A'),
            tags: rest.tagIds?.map(tid => tags.find(t=>t.id === tid)?.name).join(' | ') || ''
        };
    });
    const csv = arrayToCSV(dataForExport);
    downloadCSV(csv, `crystal-transactions-${toLocalISOString(new Date())}.csv`);
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

  const accountFilterContent = useMemo(() => {
    const open = accounts.filter(acc => acc.status !== 'closed');
    const closed = accounts.filter(acc => acc.status === 'closed');
    const groupedOpen: Record<string, Account[]> = {};
    open.forEach(acc => {
        if (!groupedOpen[acc.type]) groupedOpen[acc.type] = [];
        groupedOpen[acc.type].push(acc);
    });

    return (
      <div className="space-y-2">
           <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {ALL_ACCOUNT_TYPES.map(type => {
                  const group = groupedOpen[type];
                  if (!group || group.length === 0) return null;
                  return (
                      <div key={type} className="mb-2">
                          <h4 className="px-1.5 py-1 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">{type}</h4>
                          {group.map(acc => (
                              <label key={acc.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                  <input type="checkbox" checked={selectedAccountIds.includes(acc.id)} onChange={() => handleAccountToggle(acc.id)} className={CHECKBOX_STYLE} />
                                  <span className="truncate">{acc.name}</span>
                              </label>
                          ))}
                      </div>
                  );
              })}
              {closed.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                      <h4 className="px-1.5 py-1 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Closed</h4>
                      {closed.map(acc => (
                          <label key={acc.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                              <input type="checkbox" checked={selectedAccountIds.includes(acc.id)} onChange={() => handleAccountToggle(acc.id)} className={CHECKBOX_STYLE} />
                              <span className="truncate">{acc.name}</span>
                          </label>
                      ))}
                  </div>
              )}
          </div>
          {selectedAccountIds.length > 0 && (
              <button onClick={() => setSelectedAccountIds([])} className="text-xs text-red-500 w-full text-center hover:underline pt-1 border-t border-black/5 dark:border-white/5">Clear Selection</button>
          )}
      </div>
    );
  }, [accounts, handleAccountToggle, selectedAccountIds]);

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
                      <label key={tag.value} className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded-md">
                          <input type="checkbox" checked={selectedTagIds.includes(tag.value)} onChange={() => handleTagToggle(tag.value)} className={CHECKBOX_STYLE} />
                          <span className="text-sm font-medium">{tag.label}</span>
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

  const getCardIcon = (cardNetwork: string) => {
    const network = (cardNetwork || '').toLowerCase();
    if (network.includes('visa')) return <span className="font-bold italic text-lg text-blue-600 dark:text-blue-400">VISA</span>;
    if (network.includes('master')) return (
        <div className="flex -space-x-1">
            <div className="w-4 h-4 rounded-full bg-red-500/80"></div>
            <div className="w-4 h-4 rounded-full bg-yellow-500/80"></div>
        </div>
    );
    if (network.includes('amex')) return <span className="font-bold text-xs text-blue-500 border border-blue-500 px-0.5 rounded">AMEX</span>;
    return <span className="material-symbols-outlined text-gray-400 text-sm">credit_card</span>;
  };

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
          {...duplicateData}
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
                className="fixed z-50 w-56 bg-light-card/90 dark:bg-dark-card/90 backdrop-blur-xl rounded-xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 animate-fade-in-up overflow-hidden"
            >
                <button onClick={() => { setEditingTransaction(transactions.find(t => t.id === (contextMenu.transaction.isTransfer ? contextMenu.transaction.originalId : contextMenu.transaction.id)) || null); setTransactionModalOpen(true); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-lg text-blue-500">edit</span>
                    <span>Edit Transaction</span>
                </button>
                <button onClick={() => { handleDuplicate(contextMenu.transaction); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-lg text-green-500">content_copy</span>
                    <span>Duplicate</span>
                </button>
                <button 
                    onClick={() => { handleMakeRecurring(contextMenu.transaction); setContextMenu(null); }} 
                    disabled={contextMenu.transaction.isTransfer}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <span className="material-symbols-outlined text-lg text-purple-500">repeat</span>
                    <span>Make Recurring</span>
                </button>
                <div className="my-1 h-px bg-light-separator dark:bg-dark-separator"></div>
                <button onClick={() => { 
                    setSelectedIds(new Set([contextMenu.transaction.id]));
                    setIsDeleteConfirmOpen(true);
                    setContextMenu(null);
                }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <span className="material-symbols-outlined text-lg">delete</span>
                    <span>Delete Transaction</span>
                </button>
            </div>
        )}

      <PageHeader
        markerIcon="receipt_long"
        markerLabel="Activity Feed"
        title="Transactions"
        subtitle="Every inflow and outflow with filters, splits, and tagging to keep your history audit-ready."
        actions={
          <>
            <button onClick={handleExport} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}>
              <span className="material-symbols-outlined text-lg">download</span>
              Export
            </button>
            <button onClick={handleOpenAddModal} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
              <span className="material-symbols-outlined text-lg">add</span>
              Add Transaction
            </button>
          </>
        }
      />

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
      <div className={`p-4 bg-gray-50 dark:bg-dark-card rounded-2xl border border-black/5 dark:border-white/5 shadow-sm transition-all duration-300`}>
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
        <Card className="!p-0 h-full flex flex-col relative overflow-hidden border border-black/5 dark:border-white/5 shadow-sm rounded-2xl bg-gray-50 dark:bg-dark-card">
            <div className="overflow-x-auto">
              <div className="min-w-[900px] flex flex-col">
                {selectedIds.size > 0 ? (
                    <div className="bg-primary-600 dark:bg-primary-800 text-white px-6 flex justify-between items-center h-[60px] z-[40] relative shadow-md pointer-events-auto">
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
                            <button type="button" onClick={() => setBulkEditModalOpen(true)} className="bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm">Edit</button>
                            <button type="button" onClick={handleOpenCategorizeModal} className="bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm">Categorize</button>
                            <button type="button" onClick={() => handleMakeRecurring()} className="bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm" disabled={selectedIds.size !== 1}>Recurring</button>
                            <button type="button" onClick={handleOpenDeleteModal} className="bg-red-500/80 hover:bg-red-500 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm">Delete</button>
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-gray-50/50 dark:bg-white/[0.02] sticky top-0 z-[30] backdrop-blur-md">
                        <div className="flex items-center justify-center w-5">
                             <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} className={CHECKBOX_STYLE} aria-label="Select all transactions"/>
                        </div>
                        <div className="flex-1 grid grid-cols-12 gap-3 ml-3 items-center">
                            <div className="col-span-5">
                                <ColumnHeader
                                    label="Description & Merchant"
                                    currentSort={sortBy}
                                    onSort={setSortBy}
                                    isFilterActive={!!merchantFilter}
                                    filterContent={merchantFilterContent}
                                />
                            </div>
                            <div className="col-span-2">
                                 <ColumnHeader
                                    label="Account"
                                    isFilterActive={selectedAccountIds.length > 0}
                                    currentSort={sortBy}
                                    onSort={setSortBy}
                                    filterContent={accountFilterContent}
                                 />
                            </div>
                            <div className="col-span-2">
                                <ColumnHeader
                                    label="Category"
                                    sortKey="category"
                                    currentSort={sortBy}
                                    onSort={setSortBy}
                                    isFilterActive={selectedCategoryNames.length > 0}
                                    filterContent={categoryFilterContent}
                                />
                            </div>
                            <div className="col-span-2">
                                <ColumnHeader
                                    label="Context Tags"
                                    currentSort={sortBy}
                                    onSort={setSortBy}
                                    isFilterActive={selectedTagIds.length > 0}
                                    filterContent={tagFilterContent}
                                />
                            </div>
                            <div className="col-span-1 text-right flex justify-end">
                                 <ColumnHeader
                                    label="Value"
                                    sortKey="amount"
                                    currentSort={sortBy}
                                    onSort={setSortBy}
                                    alignRight
                                    isFilterActive={!!minAmount || !!maxAmount}
                                    filterContent={amountFilterContent}
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
                        
                        if (row.type === 'header') {
                            return (
                                <div key={`header-${row.date}`} style={style} className="flex items-center px-4 py-2 bg-gray-50/80 dark:bg-black/20 border-y border-black/5 dark:border-white/5 sticky top-0 z-10 backdrop-blur-sm">
                                    <span className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">
                                        {parseLocalDate(row.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                </div>
                            );
                        }

                    const tx = row.transaction;
                    let amountColor = tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

                    const fromAcc = accountMapByName[tx.fromAccountName!];
                    const toAcc = accountMapByName[tx.toAccountName!];
                    
                    if (tx.isTransfer) {
                      amountColor = 'text-light-text dark:text-dark-text';
                      if (selectedAccountIds.length > 0) {
                        if (selectedAccountIds.includes(fromAcc?.id) && !selectedAccountIds.includes(toAcc?.id)) { amountColor = 'text-red-600 dark:text-red-400'; }
                        else if (!selectedAccountIds.includes(fromAcc?.id) && selectedAccountIds.includes(toAcc?.id)) { amountColor = 'text-green-600 dark:text-green-400'; }
                      }
                    }

                    const categoryDetails = getCategoryDetails(tx.category, allCategories);
                    const categoryColor = tx.isTransfer ? '#64748B' : (categoryDetails.color || '#A0AEC0');
                    const categoryIcon = tx.isTransfer ? 'swap_horiz' : (categoryDetails.icon || 'category');
                    const merchantKey = normalizeMerchantKey(tx.merchant);
                    const merchantLogoUrl = merchantKey ? merchantLogoUrls[merchantKey] : null;
                    const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors[merchantLogoUrl]);
                    const merchantInitial = tx.merchant?.trim().charAt(0)?.toUpperCase();

                    // Account Info
                    const account = accountMapByName[tx.accountName || ''] || accountMap[tx.accountId];
                    const cardNetwork = account?.cardNetwork;
                    const accountName = account?.name || tx.accountName || (tx.isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : 'Unknown');
                    const accountSub = account ? (account.last4 ? `•••• ${account.last4}` : (account.type === 'Credit Card' ? 'Credit' : account.type)) : 'Manual';
                    
                    const resolvedDisplay = resolveTransferDisplay(tx);
                    const displayAmount = tx.isTransfer && selectedAccountIds.length === 0
                        ? formatCurrency(convertToEur(Math.abs(resolvedDisplay.amount), resolvedDisplay.currency), 'EUR')
                        : formatCurrency(convertToEur(resolvedDisplay.amount, resolvedDisplay.currency), 'EUR', { showPlusSign: true });

                    const institutionLogoUrl = account?.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 }) : null;
                    const showInstitutionLogo = Boolean(institutionLogoUrl && !logoLoadErrors[institutionLogoUrl]);

                    return (
                      <div
                        key={tx.id}
                        style={style}
                        className="flex items-center group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors px-4 py-3 cursor-default relative border-b border-black/5 dark:border-white/5"
                        onClick={() => { /* handle row click if needed */ }}
                        onContextMenu={(e) => openContextMenu(e, tx)}
                      >
                        <div className="flex items-center gap-4">
                          <input type="checkbox" className={CHECKBOX_STYLE} checked={selectedIds.has(tx.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(tx.id); }} onClick={e => e.stopPropagation()} aria-label={`Select transaction ${tx.description}`} />
                        </div>

                        <div className="flex-1 grid grid-cols-12 gap-3 items-center ml-3 min-w-0">
                          
                          {/* Column 1: Description (Expanded) */}
                            <div className="col-span-5 flex items-center gap-3 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 overflow-hidden ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : ''}`}
                                style={showMerchantLogo ? undefined : { backgroundColor: categoryColor }}
                              >
                                {showMerchantLogo && merchantLogoUrl ? (
                                  <img
                                    src={merchantLogoUrl}
                                    alt={tx.merchant ? `${tx.merchant} logo` : 'Merchant logo'}
                                    className="w-full h-full object-cover"
                                    onError={() => handleLogoError(merchantLogoUrl)}
                                  />
                                ) : merchantInitial ? (
                                  <span className="text-sm font-semibold tracking-wide">{merchantInitial}</span>
                                ) : (
                                  <span className="material-symbols-outlined text-[20px]">{categoryIcon}</span>
                                )}
                              </div>
                            <div className="min-w-0">
                              <p className="font-bold text-base text-light-text dark:text-dark-text truncate max-w-[30ch] lg:max-w-[40ch]">{tx.description}</p>
                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{tx.merchant || (tx.isTransfer ? 'Transfer' : '—')}</p>
                            </div>
                          </div>

                          {/* Column 2: Account */}
                          <div className="col-span-2 flex items-center gap-3 min-w-0">
                                <div className="shrink-0">
                                   {showInstitutionLogo ? (
                                        <img 
                                            src={institutionLogoUrl!} 
                                            alt={account?.financialInstitution || 'Bank'} 
                                            className="w-10 h-10 object-contain rounded-xl shadow-sm bg-white dark:bg-white/10" 
                                            onError={() => handleLogoError(institutionLogoUrl!)}
                                        />
                                   ) : (
                                        <div className="w-10 h-7 flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded overflow-hidden shadow-sm shrink-0 border border-black/5 dark:border-white/10">
                                            {account ? getCardIcon(cardNetwork || '') : <span className="material-symbols-outlined text-xs text-gray-400">account_balance</span>}
                                        </div>
                                   )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-base font-bold text-light-text dark:text-dark-text truncate">{accountName}</p>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-mono truncate">{accountSub}</p>
                                </div>
                          </div>

                          {/* Column 3: Category */}
                          <div className="col-span-2">
                             <span 
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium border border-transparent truncate max-w-full"
                                style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}
                             >
                                 <span className="material-symbols-outlined text-[16px] shrink-0">{categoryIcon}</span>
                                 <span className="truncate">{tx.category}</span>
                             </span>
                          </div>

                          {/* Column 4: Tag */}
                          <div className="col-span-2">
                            {tx.tagIds && tx.tagIds.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {tx.tagIds.slice(0, 1).map(tagId => {
                                        const tag = tags.find(t => t.id === tagId);
                                        if (!tag) return null;
                                        return (
                                            <span key={tag.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                                                {tag.name}
                                            </span>
                                        );
                                    })}
                                    {tx.tagIds.length > 1 && (
                                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">+{tx.tagIds.length - 1}</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">—</span>
                            )}
                          </div>

                          {/* Column 5: Amount */}
                          <div className="col-span-1 text-right min-w-0">
                            <p className={`font-mono font-bold text-base whitespace-nowrap ${amountColor}`}>
                                {displayAmount}
                            </p>
                            {tx.spareChangeAmount ? (
                                <p className="text-[11px] font-mono font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1 flex items-center justify-end gap-1">
                                    <span className="material-symbols-outlined text-[12px] opacity-70">savings</span>
                                    {formatCurrency(convertToEur(Math.abs(tx.spareChangeAmount), tx.currency), 'EUR')}
                                </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openContextMenu(e, tx);
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
              </div>
            </div>
          </Card>
      </div>
    </div>
  );
};

export default Transactions;
