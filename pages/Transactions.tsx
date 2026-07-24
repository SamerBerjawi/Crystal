
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { Transaction, Account, DisplayTransaction, RecurringTransaction, Category, AccountType, MerchantRule } from '../types';
import { motion } from 'motion/react';
import Card from '../components/Card';
import { formatCurrency, fuzzySearch, convertToEur, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import SplitTransactionModal from '../components/SplitTransactionModal';
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

const MetricCard = React.memo(function MetricCard({ label, value, colorClass = "text-light-text dark:text-dark-text", icon, subtitle, glowColor = "rgba(var(--primary-500-rgb), 0.15)" }: { label: string; value: string; colorClass?: string; icon: string; subtitle?: string; glowColor?: string }) {
    return (
        <div className="group relative bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 overflow-hidden h-full shadow-sm"
             style={{ boxShadow: `0 8px 30px -10px ${glowColor}` }}>
            {/* Inner Glow Effect */}
            <div 
                className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
                style={{ 
                    background: `radial-gradient(circle at 0% 0%, ${glowColor} 0%, transparent 50%)`,
                    opacity: 0.6
                }}
            />
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5 transition-transform group-hover:scale-110">
                        <span className="material-symbols-outlined text-lg">{icon}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                </div>
                
                <div className="flex flex-col">
                    <p className={`text-xl font-semibold tracking-tight ${colorClass}`}>{value}</p>
                    {subtitle && <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1 font-medium opacity-60">{subtitle}</p>}
                </div>
            </div>
            
            {/* Background Icon Accent */}
            <div className="absolute -right-4 -bottom-4 text-current opacity-[0.03] dark:opacity-[0.05] transition-transform group-hover:scale-110 duration-500 pointer-events-none">
                <span className="material-symbols-outlined text-8xl">{icon}</span>
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
                className={`flex items-center gap-2 select-none cursor-pointer group/sort py-1.5 px-2.5 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-300`} 
                onClick={handleSort}
            >
                <span className={`text-[10px] font-semibold transition-colors ${isSorted ? 'text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary group-hover/sort:text-light-text dark:group-hover/sort:text-dark-text'}`}>
                    {label}
                </span>
                
                {sortKey && (
                    <div className={`flex flex-col gap-[1px] ${isSorted ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-40'} transition-opacity duration-300`}>
                        <span className={`material-symbols-outlined text-[10px] leading-none ${isSorted && isAsc ? 'text-primary-500' : 'text-gray-400'}`}>arrow_drop_up</span>
                        <span className={`material-symbols-outlined text-[10px] leading-none -mt-1 ${isSorted && !isAsc ? 'text-primary-500' : 'text-gray-400'}`}>arrow_drop_down</span>
                    </div>
                )}
            </div>
            {filterContent && (
                <div className="relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
                        className={`w-6 h-6 flex items-center justify-center rounded-xl transition-all duration-300 ${isFilterActive || isFilterOpen ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/5'}`}
                        title="Filter"
                    >
                        <span className={`material-symbols-outlined text-[14px] ${isFilterActive ? 'filled-icon' : ''}`}>filter_alt</span>
                    </button>
                    {isFilterOpen && (
                        <div className={`absolute top-full mt-3 ${alignRight ? 'right-0' : 'left-0'} z-50 w-72 bg-white/95 dark:bg-dark-card/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 p-5 animate-fade-in-up cursor-default text-left normal-case font-normal text-light-text dark:text-dark-text overflow-hidden`} onClick={e => e.stopPropagation()}>
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-primary-500/5 to-transparent"></div>
                            <div className="relative z-10">
                                {filterContent}
                            </div>
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
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, MerchantRule>;
  const showBalanceAdjustments = usePreferencesSelector(p => p.showBalanceAdjustments ?? true);
  const appliedInitialFiltersRef = useRef<{ account: string | null; tag: string | null } | null>(null);

  useEffect(() => {
    const nextAccount = initialAccountFilter ?? null;
    const nextTag = initialTagFilter ?? null;
    const hasInitialFilters = Boolean(nextAccount || nextTag);
    if (!hasInitialFilters) return;

    const lastApplied = appliedInitialFiltersRef.current;
    if (!lastApplied || lastApplied.account !== nextAccount || lastApplied.tag !== nextTag) {
      if (nextAccount) {
        const account = accounts.find(a => a.name === nextAccount);
        if (account) setSelectedAccountIds([account.id]);
      }
      if (nextTag) {
        setSelectedTagIds([nextTag]);
      }

      appliedInitialFiltersRef.current = { account: nextAccount, tag: nextTag };
      onClearInitialFilters?.();
    }
  }, [accounts, initialAccountFilter, initialTagFilter, onClearInitialFilters]);

  const [searchTerm, setSearchTerm] = useState('');
  const formatDate = (dateString: string) => {
    const d = parseLocalDate(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
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
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [transactionToSplit, setTransactionToSplit] = useState<Transaction | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [transactionToMakeRecurring, setTransactionToMakeRecurring] = useState<(Omit<RecurringTransaction, 'id'> & { id?: string }) | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [density, setDensity] = useState<'default' | 'high'>('default');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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



  const merchantLogoUrls = useMemo(() => {
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
                    description: pair.expense.description || 'Account Transfer',
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

        const matchBalanceAdjustment = showBalanceAdjustments || !tx.isBalanceAdjustment;

        return matchAccount && matchTag && matchSearch && matchType && matchStartDate && matchEndDate && matchCategory && matchMinAmount && matchMaxAmount && matchMerchant && matchBalanceAdjustment;
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

  }, [debouncedSearchTerm, sortBy, typeFilter, startDate, endDate, indexedTransactions, selectedAccountIds, selectedCategoryNames, selectedTagIds, minAmount, maxAmount, allCategories, accountMapByName, merchantFilter, showBalanceAdjustments]);
  
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
        if (row && row.type === 'header') return 40; 
        if (isMobile) return density === 'high' ? 110 : 130;
        return density === 'high' ? 68 : 72;
    },
    [virtualRows, isMobile, density]
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
  
  const handleOpenSplitModal = () => {
    if (selectedIds.size !== 1) return;
    const selectedId = Array.from(selectedIds)[0];
    const displayTx = displayTransactions.find(tx => tx.id === selectedId);
    if (!displayTx || displayTx.isTransfer) return;
    
    const original = transactions.find(t => t.id === displayTx.id);
    if (original) {
      setTransactionToSplit(original);
      setIsSplitModalOpen(true);
    }
  };

  const handleSaveSplits = (splits: Partial<Transaction>[]) => {
    if (!transactionToSplit) return;
    
    // We want to delete the original and add the new ones
    saveTransaction(splits as any, [transactionToSplit.id]);
    
    setIsSplitModalOpen(false);
    setTransactionToSplit(null);
    setSelectedIds(new Set());
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
          if (selectedId.startsWith('transfer-')) {
               const transferId = selectedId.replace('transfer-', '');
               const pairExpense = transactions.find(t => t.transferId === transferId && t.type === 'expense');
               const pairIncome = transactions.find(t => t.transferId === transferId && t.type === 'income');
               
               if (pairExpense) {
                   transactionUpdates.push({
                       ...pairExpense,
                       category: newCategoryName
                   });
               }
               if (pairIncome) {
                   transactionUpdates.push({
                       ...pairIncome,
                       category: newCategoryName
                   });
               }
          } else {
               const originalTx = transactions.find(t => t.id === selectedId);
               if (originalTx) {
                   if (originalTx.transferId) {
                       const transferId = originalTx.transferId;
                       const pairExpense = transactions.find(t => t.transferId === transferId && t.type === 'expense');
                       const pairIncome = transactions.find(t => t.transferId === transferId && t.type === 'income');
                       
                       if (pairExpense && !transactionUpdates.some(ut => ut.id === pairExpense.id)) {
                           transactionUpdates.push({
                               ...pairExpense,
                               category: newCategoryName
                           });
                       }
                       if (pairIncome && !transactionUpdates.some(ut => ut.id === pairIncome.id)) {
                           transactionUpdates.push({
                               ...pairIncome,
                               category: newCategoryName
                           });
                       }
                   } else {
                       const newAmount = newType === 'income' ? Math.abs(originalTx.amount) : -Math.abs(originalTx.amount);
                       transactionUpdates.push({ 
                           ...originalTx, 
                           category: newCategoryName,
                           type: newType,
                           amount: newAmount
                       });
                   }
               }
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

    let initialFromAccountId: string | undefined = original.accountId;
    let initialToAccountId: string | undefined = undefined;
    let initialType: 'expense' | 'income' | 'transfer' = original.type as any;

    if (tx.isTransfer) {
        initialType = 'transfer';
        const incomePart = transactions.find(t => t.transferId === original.transferId && t.id !== original.id);
        if (incomePart) {
            initialToAccountId = incomePart.accountId;
        }
    } else if (original.type === 'income') {
        initialToAccountId = original.accountId;
        initialFromAccountId = undefined;
    }

    setDuplicateData({
        initialType,
        initialFromAccountId,
        initialToAccountId,
        initialCategory: original.category,
        initialDetails: {
            date: original.date,
            amount: String(Math.abs(original.amount)),
            description: original.description,
            merchant: original.merchant,
            tagIds: original.tagIds,
            locationString: [original.city, original.country].filter(Boolean).join(', '),
            locationData: {
                city: original.city,
                country: original.country,
                lat: original.latitude,
                lon: original.longitude
            }
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
    setSelectedAccountIds([]);
    setSelectedCategoryNames([]);
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
                          <h4 className="px-1.5 py-1 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-tight">{type}</h4>
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
                      <h4 className="px-1.5 py-1 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-tight">Closed</h4>
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
      {isSplitModalOpen && transactionToSplit && (
          <SplitTransactionModal
              onClose={() => { setIsSplitModalOpen(false); setTransactionToSplit(null); }}
              onSave={handleSaveSplits}
              transaction={transactionToSplit}
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
                    <span className="material-symbols-outlined text-lg text-primary-500">edit</span>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div 
            className="group relative bg-primary-600 dark:bg-primary-700 p-4 sm:p-5 rounded-2xl shadow-lg shadow-primary-500/20 border-none text-white overflow-hidden flex flex-col justify-between h-full transition-all duration-300 hover:-translate-y-0.5"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
            
            {/* Inner Glow */}
            <div 
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ 
                    background: `radial-gradient(circle at 0% 0%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
                    opacity: 0.8
                }}
            />

            <div className="relative z-10">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center text-white border border-white/10 transition-transform group-hover:scale-110">
                        <span className="material-symbols-outlined text-base sm:text-lg">receipt_long</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-semibold text-white/80">Total transactions</p>
                </div>
                
                <div className="flex flex-col">
                    <p className="text-xl sm:text-2xl font-black tracking-tight">{filteredTransactions.length}</p>
                    <p className="text-[9px] sm:text-[10px] text-white/70 mt-0.5 sm:mt-1 font-semibold">in selected period</p>
                </div>
            </div>
            
            <div className="absolute -right-4 -bottom-4 text-white opacity-10 transition-transform group-hover:scale-110 duration-500 hidden sm:block">
                <span className="material-symbols-outlined text-8xl">receipt_long</span>
            </div>
        </div>
        <MetricCard 
            label="Total Income" 
            value={formatCurrency(totalIncome, 'EUR')} 
            colorClass="text-green-600 dark:text-green-400" 
            icon="arrow_downward" 
            subtitle="Cash inflows"
            glowColor="rgba(16, 185, 129, 0.15)"
        />
        <MetricCard 
            label="Total Expenses" 
            value={formatCurrency(totalExpense, 'EUR')} 
            colorClass="text-red-600 dark:text-red-400" 
            icon="arrow_upward" 
            subtitle="Cash outflows"
            glowColor="rgba(244, 63, 94, 0.15)"
        />
        <MetricCard 
            label="Net Cash Flow" 
            value={formatCurrency(netFlow, 'EUR', { showPlusSign: true })} 
            colorClass={netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} 
            icon="account_balance_wallet" 
            subtitle="Net difference"
            glowColor={netFlow >= 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)"}
        />
      </div>
      
      {/* Filter Toolbar */}
      <div className={`p-4 sm:p-6 bg-white dark:bg-dark-card rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm transition-all duration-300 relative`}>
          {/* Subtle Glow */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(var(--primary-500-rgb), 0.05) 0%, transparent 40%)' }}></div>
          
          <div className="relative z-10 flex flex-col gap-6">
              {/* Main Row */}
              <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-end">
                 <div className="flex-grow w-full xl:w-auto">
                      <label htmlFor="search" className={labelStyle}>Search registry</label>
                      <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none opacity-50">search</span>
                          <input ref={searchInputRef} type="text" id="search" placeholder="Type to search transactions, merchants, categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${INPUT_BASE_STYLE} pl-10`} />
                      </div>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full xl:w-auto">
                      <div>
                          <label htmlFor="type-filter" className={labelStyle}>Transfer type</label>
                          <div className={`${SELECT_WRAPPER_STYLE} !rounded-2xl`}>
                              <select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className={`${SELECT_STYLE} !rounded-2xl pr-10`}>
                                  {typeFilterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                          </div>
                      </div>
                      <div>
                          <label htmlFor="sort-by" className={labelStyle}>Display order</label>
                          <div className={`${SELECT_WRAPPER_STYLE} !rounded-2xl`}>
                              <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${SELECT_STYLE} !rounded-2xl pr-10`}>
                                <option value="date-desc">Date (Newest First)</option>
                                <option value="date-asc">Date (Oldest First)</option>
                                <option value="amount-desc">Value (Highest First)</option>
                                <option value="amount-asc">Value (Lowest First)</option>
                                <option value="merchant-asc">Merchant (Alphabetical)</option>
                                <option value="merchant-desc">Merchant (Reverse)</option>
                                <option value="category-asc">Category (A-Z)</option>
                                <option value="category-desc">Category (Z-A)</option>
                              </select>
                              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                          </div>
                      </div>
                      <div className="col-span-2 md:col-span-2 flex items-end">
                         <button 
                            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                            className={`w-full h-[42px] flex items-center justify-center gap-2 rounded-2xl font-semibold text-[11px] tracking-wider transition-all ${isFiltersExpanded ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10'}`}
                        >
                            <span className="material-symbols-outlined text-lg">{isFiltersExpanded ? 'keyboard_double_arrow_up' : 'tune'}</span>
                            {isFiltersExpanded ? 'Collapse filters' : 'Advanced filters'}
                         </button>
                      </div>
                 </div>
              </div>
              
              {/* Expanded Filters */}
              {isFiltersExpanded && (
                <div className="pt-6 border-t border-black/5 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-fade-in-up">
                  <div>
                      <label className={labelStyle}>Source account</label>
                      <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds}/>
                  </div>
                  <div>
                      <label className={labelStyle}>Accounting category</label>
                      <MultiSelectFilter options={categoryOptions} selectedValues={selectedCategoryNames} onChange={setSelectedCategoryNames} placeholder="All Categories"/>
                  </div>
                  <div>
                      <label className={labelStyle}>Organization tags</label>
                      <MultiSelectFilter options={tagOptions} selectedValues={selectedTagIds} onChange={setSelectedTagIds} placeholder="All Tags"/>
                  </div>
                  <div>
                      <label htmlFor="merchant-filter" className={labelStyle}>Merchant entity</label>
                      <input id="merchant-filter" type="text" placeholder="Search by merchant name..." value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} className={`${INPUT_BASE_STYLE} !rounded-2xl`} />
                  </div>

                  <div className="md:col-span-2 flex items-end gap-3">
                      <div className="flex-1"><label htmlFor="start-date" className={labelStyle}>From date</label><input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} !rounded-2xl`}/></div>
                      <div className="flex-1"><label htmlFor="end-date" className={labelStyle}>To date</label><input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} !rounded-2xl`}/></div>
                  </div>
                  <div className="md:col-span-2 flex items-end gap-3">
                      <div className="flex-1"><label htmlFor="min-amount" className={labelStyle}>Min threshold</label><input id="min-amount" type="number" placeholder="0.00" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={`${INPUT_BASE_STYLE} !rounded-2xl`}/></div>
                      <div className="flex-1"><label htmlFor="max-amount" className={labelStyle}>Max threshold</label><input id="max-amount" type="number" placeholder="No limit" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className={`${INPUT_BASE_STYLE} !rounded-2xl`}/></div>
                  </div>
                  <div className="xl:col-span-4 flex justify-between items-center py-2">
                      <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-40 tracking-wider">Fine-tune your activity feed</p>
                      <button onClick={clearFilters} className="text-[10px] font-semibold tracking-wider text-primary-500 hover:text-primary-600 transition-colors">Reset all parameters</button>
                  </div>
                </div>
              )}
          </div>
      </div>
      
      {/* Transaction List Card */}
      <div className="flex-1 min-w-0 relative">
        <Card className="!p-0 h-full flex flex-col relative border border-black/5 dark:border-white/5 shadow-sm rounded-[2rem] bg-white dark:bg-dark-card">
            <div className="flex flex-col h-full"> {/* Container to avoid inner overflow-x issue */}
                <div className={`transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${selectedIds.size > 0 ? 'h-[72px] opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
                  <div className={`${selectedIds.size > 0 ? 'bg-primary-600 dark:bg-primary-900 text-white' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary'} px-8 flex justify-between items-center h-[72px] z-[40] relative transition-colors duration-500`}>
                     <div className="flex items-center gap-6">
                         <div className="flex items-center gap-4">
                             <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} className={`${CHECKBOX_STYLE} border-white/30 checked:bg-white checked:text-primary-600`} aria-label="Select all transactions"/>
                             <div className="flex flex-col">
                                <span className="font-semibold text-lg tracking-tight leading-none">{selectedIds.size}</span>
                                <span className="text-[10px] font-semibold tracking-widest opacity-70">records selected</span>
                             </div>
                         </div>
                         {selectedIds.size > 0 && (
                             <button 
                                onClick={() => setSelectedIds(new Set())} 
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                                aria-label="Deselect all"
                             >
                                 <span className="material-symbols-outlined text-lg">close</span>
                             </button>
                         )}
                     </div>
                    <div className="flex gap-2">
                        {[
                            { label: 'Edit', icon: 'edit', onClick: () => setBulkEditModalOpen(true), disabled: selectedIds.size === 0 },
                            { label: 'Categorize', icon: 'category', onClick: handleOpenCategorizeModal, disabled: selectedIds.size === 0 },
                            { label: 'Split', icon: 'splitscreen', onClick: handleOpenSplitModal, disabled: selectedIds.size !== 1 },
                            { label: 'Recurring', icon: 'repeat', onClick: () => handleMakeRecurring(), disabled: selectedIds.size !== 1 },
                            { label: 'Delete', icon: 'delete', onClick: handleOpenDeleteModal, disabled: selectedIds.size === 0, danger: true }
                        ].map((btn) => (
                            <button 
                                key={btn.label}
                                type="button" 
                                onClick={btn.onClick} 
                                disabled={btn.disabled}
                                className={`
                                    h-10 px-4 rounded-2xl flex items-center gap-2 text-[11px] font-semibold tracking-wider transition-all
                                    ${btn.disabled 
                                        ? 'opacity-40 cursor-not-allowed grayscale' 
                                        : btn.danger
                                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                                            : 'bg-white/10 hover:bg-white/20 text-white'
                                    }
                                `}
                            >
                                <span className="material-symbols-outlined text-base">{btn.icon}</span>
                                <span className="hidden md:inline">{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
              </div>
                
                <div className="hidden lg:flex px-8 py-4 border-b border-black/5 dark:border-white/5 items-center gap-4 bg-white/50 dark:bg-dark-card/50 sticky top-0 z-[30] backdrop-blur-xl">
                    <div className="flex items-center justify-center w-6">
                         <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} className={CHECKBOX_STYLE} aria-label="Select all visible transactions"/>
                    </div>
                    <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-4">
                            <ColumnHeader
                                label="Transaction Details"
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
                        <div className="col-span-3">
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
                                label="Tags"
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
                <div
                  ref={listContainerRef}
                  className="flex-grow bg-white dark:bg-dark-card"
                  style={{ height: '75vh', minHeight: '600px' }}
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
                            const dateTransactions = virtualRows.filter(r => r.type === 'transaction' && (r as {type: 'transaction', transaction: DisplayTransaction}).transaction.date === row.date);
                            const allSelected = dateTransactions.length > 0 && dateTransactions.every(r => selectedIds.has((r as {type: 'transaction', transaction: DisplayTransaction}).transaction.id));
                            const handleSelectDay = (e: React.ChangeEvent<HTMLInputElement>) => {
                                 e.stopPropagation();
                                 const nextIds = new Set(selectedIds);
                                 if (allSelected) {
                                     dateTransactions.forEach(r => nextIds.delete((r as {type: 'transaction', transaction: DisplayTransaction}).transaction.id));
                                 } else {
                                     dateTransactions.forEach(r => nextIds.add((r as {type: 'transaction', transaction: DisplayTransaction}).transaction.id));
                                 }
                                 setSelectedIds(nextIds);
                            };

                            return (
                                <div key={`header-${row.date}`} style={style} className="flex items-center px-4 py-2 bg-gray-50/80 dark:bg-black/20 border-y border-black/5 dark:border-white/5 sticky top-0 z-10 backdrop-blur-sm">
                                    <div className="flex items-center justify-center w-5">
                                        <input type="checkbox" className={CHECKBOX_STYLE} checked={allSelected} onChange={handleSelectDay} aria-label={`Select all for ${row.date}`} onClick={e => e.stopPropagation()} />
                                    </div>
                                    <span className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary tracking-[0.2em] ml-3">
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
                    const categoryColor = (tx.isTransfer && (!tx.category || tx.category === 'Transfer')) ? '#64748B' : (categoryDetails.color || '#A0AEC0');
                    const categoryIcon = (tx.isTransfer && (!tx.category || tx.category === 'Transfer')) ? 'swap_horiz' : (categoryDetails.icon || 'category');
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
                    
                    const accentColor = tx.isTransfer 
                        ? 'rgba(59, 130, 246, 0.4)' 
                        : (tx.type === 'income' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)');

                    return (
                      <div
                        key={tx.id}
                        style={style}
                        className="px-1 py-1"
                      >
                        <motion.div
                            initial={false}
                            whileHover={{ y: -1 }}
                            className={`
                                group relative h-full flex items-center gap-2 px-3 rounded-[1.5rem] border transition-all duration-300 cursor-default
                                ${selectedIds.has(tx.id)
                                    ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/30 shadow-lg shadow-primary-500/5'
                                    : 'bg-white dark:bg-dark-card border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 shadow-sm'
                                }
                            `}
                            style={{
                                boxShadow: selectedIds.has(tx.id) ? `0 10px 30px -10px ${accentColor.replace('0.4', '0.15')}` : undefined
                            }}
                            onDoubleClick={() => {
                              setEditingTransaction(transactions.find(t => t.id === (tx.isTransfer ? tx.originalId : tx.id)) || null);
                              setTransactionModalOpen(true);
                            }}
                            onContextMenu={(e) => openContextMenu(e, tx)}
                         >
                            {/* Inner Glow Effect */}
                            <div className="absolute inset-0 pointer-events-none rounded-[1.5rem] overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                <div 
                                    className="absolute inset-0"
                                    style={{ 
                                        background: `radial-gradient(circle at 100% 50%, ${accentColor.replace('0.4', '0.08')} 0%, transparent 60%)`,
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-center w-6 z-10 shrink-0">
                                <input 
                                    type="checkbox" 
                                    className={`${CHECKBOX_STYLE} !rounded-lg border-black/10 dark:border-white/10`} 
                                    checked={selectedIds.has(tx.id)} 
                                    onChange={(e) => { e.stopPropagation(); handleSelectOne(tx.id); }} 
                                    onClick={e => e.stopPropagation()} 
                                    aria-label={`Select transaction ${tx.description}`} 
                                />
                            </div>

                            <div className="flex-1 flex lg:grid lg:grid-cols-12 gap-4 items-center min-w-0 z-10">
                                {/* Column 1: Description */}
                                <div className="flex-1 lg:col-span-4 flex items-center gap-3.5 min-w-0">
                                    <div className="shrink-0">
                                        <div
                                            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-white overflow-hidden shrink-0 ${showMerchantLogo ? 'bg-white dark:bg-white/10' : ''}`}
                                            style={showMerchantLogo ? undefined : { backgroundColor: categoryColor }}
                                        >
                                            {showMerchantLogo && merchantLogoUrl ? (
                                                <img
                                                    src={merchantLogoUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    referrerPolicy="no-referrer"
                                                    onError={() => handleLogoError(merchantLogoUrl)}
                                                />
                                            ) : merchantInitial ? (
                                                <span className="text-sm font-black tracking-widest">{merchantInitial}</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-xl">{categoryIcon}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="font-semibold text-[14px] sm:text-[15px] text-light-text dark:text-dark-text truncate tracking-tight">{tx.description}</p>
                                            {tx.recurringSourceId && <span className="material-symbols-outlined text-[13px] text-primary-500 shrink-0">repeat</span>}
                                            {tx.notes && <span className="material-symbols-outlined text-[13px] text-primary-500/40 shrink-0">notes</span>}
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-x-2">
                                            <span className="text-[11px] sm:text-[12px] font-medium text-light-text-secondary dark:text-dark-text-secondary tracking-tight opacity-60 truncate max-w-[150px]">
                                                {tx.merchant || (tx.isTransfer ? 'Transfer' : 'Activity record')}
                                            </span>
                                            {/* Mobile Secondary Info - Balanced Polish */}
                                            <div className="lg:hidden flex flex-wrap items-center gap-1 mt-1">
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded-lg opacity-60">
                                                    <span className="material-symbols-outlined text-[9px]">account_balance_wallet</span>
                                                    <span className="text-[8px] sm:text-[9px] font-medium truncate max-w-[50px] sm:max-w-[80px]">{accountName}</span>
                                                </div>
                                                <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-lg font-bold tracking-wider flex items-center gap-1" style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}>
                                                    <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: categoryColor }}></span>
                                                    <span className="truncate max-w-[60px] sm:max-w-[70px]">{tx.category || 'Unset'}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Account */}
                                <div className="hidden lg:flex col-span-2 items-center gap-3 min-w-0">
                                    <div className="shrink-0">
                                        {showInstitutionLogo ? (
                                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden shrink-0 bg-white dark:bg-white/10 flex items-center justify-center">
                                                <img 
                                                    src={institutionLogoUrl!} 
                                                    alt="" 
                                                    className="w-full h-full object-cover" 
                                                    referrerPolicy="no-referrer"
                                                    onError={() => handleLogoError(institutionLogoUrl!)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-2xl shrink-0">
                                                <span className="material-symbols-outlined text-xl text-light-text-secondary dark:text-dark-text-secondary opacity-40">account_balance</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-semibold text-light-text dark:text-dark-text truncate tracking-tight leading-tight">{accountName}</p>
                                        <p className="text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-40 leading-tight tracking-tighter">{accountSub}</p>
                                    </div>
                                </div>

                                {/* Column 3: Category */}
                                <div className="hidden lg:block col-span-3 overflow-hidden">
                                    <div 
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors duration-300 max-w-full cursor-pointer overflow-hidden font-bold text-[12px]"
                                        style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([tx.id])); setIsCategorizeModalOpen(true); }}
                                    >
                                        <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: categoryColor }}>{categoryIcon}</span>
                                        <span className="truncate">
                                            {tx.category || 'Uncategorized'}
                                        </span>
                                    </div>
                                </div>

                                {/* Column 4: Tags */}
                                <div className="hidden lg:block col-span-2 overflow-hidden">
                                    {tx.tagIds && tx.tagIds.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {tx.tagIds.slice(0, 1).map(tagId => {
                                                const tag = tags.find(t => t.id === tagId);
                                                if (!tag) return null;
                                                return (
                                                    <span key={tag.id} className="px-2.5 py-1 rounded-lg text-[12px] font-bold" style={{ backgroundColor: `${tag.color}15`, color: tag.color }}>
                                                        {tag.name}
                                                    </span>
                                                );
                                            })}
                                            {tx.tagIds.length > 1 && (
                                                <span className="text-[12px] font-black text-primary-500">+{tx.tagIds.length - 1}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[12px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-30">No tags</span>
                                    )}
                                </div>

                                {/* Column 5: Amount */}
                                <div className="sm:col-span-1 lg:col-span-1 text-right flex flex-col items-end shrink-0">
                                    <span className={`text-[15px] sm:text-base font-semibold tracking-tighter ${amountColor}`}>
                                        {displayAmount}
                                    </span>
                                    {tx.spareChangeAmount ? (
                                        <div className="flex items-center justify-end gap-1 px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-500 animate-pulse">
                                            <span className="material-symbols-outlined text-[12px]">savings</span>
                                            <span className="text-[11px] font-semibold tracking-widest">{formatCurrency(convertToEur(Math.abs(tx.spareChangeAmount), tx.currency), 'EUR')}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-60 transition-opacity">
                                            <span className="text-[8px] font-semibold tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Verified</span>
                                            <span className="material-symbols-outlined text-[10px] text-green-500">verified</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 duration-300 z-20">
                                <button
                                    className="w-8 h-8 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary flex items-center justify-center transition-colors"
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
                         </motion.div>
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
          </Card>
      </div>
    </div>
  );
};

export default Transactions;
