
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { Transaction, Account, DisplayTransaction, RecurringTransaction, Category, AccountType, MerchantRule, User } from '../types';
import { motion } from 'motion/react';
import Card from '../components/Card';
import { formatCurrency, fuzzySearch, convertToEur, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString, CONVERSION_RATES } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import SplitTransactionModal from '../components/SplitTransactionModal';
import CombineTransactionsModal from '../components/CombineTransactionsModal';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectFilter from '../components/MultiSelectFilter';
import MultiAccountFilter from '../components/MultiAccountFilter';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useDebounce } from '../hooks/useDebounce';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import PageHeader from '../components/PageHeader';
import HeaderButton from '../components/HeaderButton';
import Icon from '../components/ui/Icon';
import { MobileTransactionsView } from '../components/MobileTransactionsView';
import { Edit01, Trash01, DotsVertical } from '@untitledui/icons';
import type { SortDescriptor } from 'react-aria-components';
import { PaginationPageMinimalCenter } from '@/components/application/pagination/pagination';
import { Table, TableCard } from '@/components/application/table/table';
import { Avatar } from '@/components/base/avatar/avatar';
import { Badge } from '@/components/base/badges/badges';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { DropdownIconSimple } from '@/components/base/dropdown/dropdown-icon-simple';
import { formatTransactionLocation } from '../utils/locationFormat';
import { Checkbox, CheckboxBase } from '@/components/base/checkbox/checkbox';
import { cx } from '@/lib/utils/cx';

interface TransactionsProps {
  user?: User;
  initialAccountFilter?: string | null;
  initialTagFilter?: string | null;
  onClearInitialFilters?: () => void;
  onSyncBanks?: () => void;
  isSyncingBanks?: boolean;
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
                        <Icon name={icon} className="text-lg" />
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
                <Icon name={icon} className="text-8xl" />
            </div>
        </div>
    );
});

// Column Header Filter Popover
export type TableRenderItem =
  | {
      isGroupHeader: true;
      id: string;
      date: string;
      formattedDate: string;
      count: number;
      totalEur: number;
      groupTxIds: string[];
      isAllGroupSelected: boolean;
      isSomeGroupSelected: boolean;
    }
  | {
      isGroupHeader: false;
      id: string;
      tx: DisplayTransaction;
    };

const ColumnHeaderFilter: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isActive: boolean;
  activeCount?: number;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onToggle, onClose, isActive, activeCount, title, children }) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative inline-flex items-center ml-1" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cx(
          "size-6 rounded-md flex items-center justify-center transition-all cursor-pointer",
          isActive || isOpen
            ? "bg-primary-500 text-white shadow-xs"
            : "text-fg-quaternary hover:text-fg-quaternary_hover hover:bg-black/5 dark:hover:bg-white/10"
        )}
        title={`Filter by ${title}`}
      >
        <Icon name="filter_alt" className="text-xs" />
        {activeCount && activeCount > 0 ? (
          <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary-600 text-[8px] font-bold text-white flex items-center justify-center leading-none">
            {activeCount}
          </span>
        ) : null}
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full mt-2 -left-2 z-50 w-72 rounded-xl border border-secondary bg-primary p-4 shadow-xl backdrop-blur-xl text-left font-normal text-secondary normal-case"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-secondary">
            <span className="text-sm font-semibold text-primary">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-tertiary hover:text-primary cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  );
};

const Transactions: React.FC<TransactionsProps> = ({ user, initialAccountFilter, initialTagFilter, onClearInitialFilters, onSyncBanks, isSyncingBanks }) => {
  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { saveRecurringTransaction } = useScheduleContext();
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const preferredCurrency = usePreferencesSelector(p => p.currency || 'EUR');
  const conversionRates = usePreferencesSelector(p => p.conversionRates || CONVERSION_RATES);
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
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [openFilterCol, setOpenFilterCol] = useState<'description' | 'account' | 'category' | 'location' | 'tags' | 'amount' | null>(null);

  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null); // For duplication
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCategorizeModalOpen, setIsCategorizeModalOpen] = useState(false);
  const [isBulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [transactionToSplit, setTransactionToSplit] = useState<Transaction | null>(null);
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false);
  const [transactionsToCombine, setTransactionsToCombine] = useState<Transaction[]>([]);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
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

    const spareChangeByParentId = new Map<string, number>();
    const legacySpareChangeLookup = new Map<string, number[]>();

    sortedTransactions.forEach(tx => {
        if (!tx.transferId?.startsWith('spare-') || tx.amount >= 0) return;

        const match = tx.transferId.match(/^spare-(.+)$/);
        const embeddedId = match ? match[1] : null;

        const isBoundToTx = embeddedId && sortedTransactions.some(t => t.id === embeddedId || (t.transferId && t.transferId === embeddedId));

        if (isBoundToTx && embeddedId) {
            spareChangeByParentId.set(embeddedId, Math.abs(tx.amount));
        } else {
            const baseDescription = tx.description?.replace(/^Spare change (for|from)\s*/i, '').trim();
            const key = getSpareChangeKey(tx.accountId, tx.date, baseDescription, false);
            const currentAmounts = legacySpareChangeLookup.get(key) || [];
            currentAmounts.push(Math.abs(tx.amount));
            legacySpareChangeLookup.set(key, currentAmounts);
        }
    });

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

    const getSpareChangeForTx = (txId?: string, accountId?: string, date?: string, description?: string, isTransfer?: boolean, txAmount?: number) => {
         if (txId && spareChangeByParentId.has(txId)) {
             return spareChangeByParentId.get(txId);
         }
         if (!accountId || !date) return undefined;

         const key = getSpareChangeKey(accountId, date, description, isTransfer);
         const amounts = legacySpareChangeLookup.get(key);
         
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
         if (amounts.length === 0) legacySpareChangeLookup.delete(key);
         return amount;
    };

    for (const tx of sortedTransactions) {
        if (tx.transferId?.startsWith('spare-')) continue; // Spare change handled separately

        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) continue;

            const pair = transferLookup.get(tx.transferId);
            processedTransferIds.add(tx.transferId);

            if (pair?.expense && pair?.income) {
                const spareChangeAmount = getSpareChangeForTx(pair.expense.id || pair.expense.transferId, pair.expense.accountId, pair.expense.date, pair.expense.description, true, pair.expense.amount);

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
                const spareChangeAmount = getSpareChangeForTx(tx.id, tx.accountId, tx.date, tx.description, false, tx.amount);
                result.push({ ...tx, accountName: accountMap[tx.accountId]?.name, spareChangeAmount });
            }
        } else {
            const spareChangeAmount = getSpareChangeForTx(tx.id, tx.accountId, tx.date, tx.description, false, tx.amount);
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

        const matchLocation = selectedLocations.length === 0 || (() => {
            const loc = formatTransactionLocation(tx, user);
            return selectedLocations.includes(loc.city) || selectedLocations.includes(loc.country);
        })();

        const matchBalanceAdjustment = showBalanceAdjustments || !tx.isBalanceAdjustment;

        return matchAccount && matchTag && matchSearch && matchType && matchStartDate && matchEndDate && matchCategory && matchMinAmount && matchMaxAmount && matchMerchant && matchLocation && matchBalanceAdjustment;
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

  }, [debouncedSearchTerm, sortBy, typeFilter, startDate, endDate, indexedTransactions, selectedAccountIds, selectedCategoryNames, selectedTagIds, selectedLocations, minAmount, maxAmount, allCategories, accountMapByName, merchantFilter, showBalanceAdjustments, user]);
  
  const toggleExpandParent = useCallback((parentId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedParentIds(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  type VirtualRow = { type: 'header'; date: string; total: number } | { type: 'transaction'; transaction: DisplayTransaction };

  const virtualRows: VirtualRow[] = useMemo(() => {
    const rows: VirtualRow[] = [];
    
    const subTxMap = new Map<string, DisplayTransaction[]>();
    const topLevelList: DisplayTransaction[] = [];

    filteredTransactions.forEach(tx => {
      if (tx.parentTransactionId) {
        const list = subTxMap.get(tx.parentTransactionId) || [];
        list.push({ ...tx, isSubTransaction: true });
        subTxMap.set(tx.parentTransactionId, list);
      } else {
        topLevelList.push(tx);
      }
    });

    const addTxWithSub = (tx: DisplayTransaction) => {
      const subTxs = subTxMap.get(tx.id) || [];
      const txWithCount: DisplayTransaction = {
        ...tx,
        subItemCount: subTxs.length,
        isExpanded: expandedParentIds.has(tx.id),
      };
      rows.push({ type: 'transaction', transaction: txWithCount });

      const isFilterActive = Boolean(debouncedSearchTerm || merchantFilter || minAmount || maxAmount);
      const shouldExpand = expandedParentIds.has(tx.id) || isFilterActive;
      if (shouldExpand && subTxs.length > 0) {
        subTxs.forEach(subTx => {
          rows.push({ type: 'transaction', transaction: subTx });
        });
      }
    };

    if (sortBy === 'date-desc' || sortBy === 'date-asc') {
        let lastDate = '';
        topLevelList.forEach(tx => {
            const dateStr = tx.date;
            if (dateStr !== lastDate) {
                rows.push({ type: 'header', date: dateStr, total: 0 });
                lastDate = dateStr;
            }
            addTxWithSub(tx);
        });
    } else {
        topLevelList.forEach(tx => {
            addTxWithSub(tx);
        });
    }
    return rows;
  }, [filteredTransactions, sortBy, expandedParentIds, debouncedSearchTerm, merchantFilter, minAmount, maxAmount]);

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
        if (tx.isTransfer) return;
        if (tx.isSplitParent || tx.isCombinedParent) return; // Exclude parent containers from totals to prevent double-counting
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
               const tx = transactions.find(t => t.transferId === transferId && t.type === 'expense');
               if (tx) resolvedIds.add(tx.id);
          } else {
               resolvedIds.add(id);
          }
      });
      return transactions.filter(t => resolvedIds.has(t.id));
  }, [selectedIds, transactions]);

  const canCombine = useMemo(() => {
    return selectedTransactions.length >= 2 && !selectedTransactions.some(t => t.transferId);
  }, [selectedTransactions]);

  const canSplit = useMemo(() => {
    if (selectedTransactions.length !== 1) return false;
    const tx = selectedTransactions[0];
    return !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.parentTransactionId;
  }, [selectedTransactions]);

  const canUnsplit = useMemo(() => {
    if (selectedTransactions.length !== 1) return false;
    const tx = selectedTransactions[0];
    if (tx.isSplitParent) return true;
    if (tx.parentTransactionId) {
      const parent = transactions.find(t => t.id === tx.parentTransactionId);
      return Boolean(parent?.isSplitParent);
    }
    return false;
  }, [selectedTransactions, transactions]);

  const canUncombine = useMemo(() => {
    if (selectedTransactions.length !== 1) return false;
    const tx = selectedTransactions[0];
    if (tx.isCombinedParent) return true;
    if (tx.parentTransactionId) {
      const parent = transactions.find(t => t.id === tx.parentTransactionId);
      return Boolean(parent?.isCombinedParent);
    }
    return false;
  }, [selectedTransactions, transactions]);

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

  const handleOpenCombineModal = () => {
    if (!canCombine) return;
    setTransactionsToCombine(selectedTransactions);
    setIsCombineModalOpen(true);
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

  const handleSaveSplits = (updatedParent: Transaction, subTransactions: Transaction[]) => {
    saveTransaction([updatedParent, ...subTransactions], []);
    setExpandedParentIds(prev => new Set(prev).add(updatedParent.id));
    setIsSplitModalOpen(false);
    setTransactionToSplit(null);
    setSelectedIds(new Set());
  };

  const handleSaveCombine = (combinedParent: Transaction, updatedSubTransactions: Transaction[]) => {
    saveTransaction([combinedParent, ...updatedSubTransactions], []);
    setExpandedParentIds(prev => new Set(prev).add(combinedParent.id));
    setIsCombineModalOpen(false);
    setTransactionsToCombine([]);
    setSelectedIds(new Set());
  };

  const handleUnsplit = (targetTx?: DisplayTransaction) => {
    let tx = targetTx;
    if (!tx) {
      if (selectedIds.size !== 1) return;
      const selectedId = Array.from(selectedIds)[0];
      tx = displayTransactions.find(t => t.id === selectedId);
    }
    if (!tx) return;

    const parentId = tx.parentTransactionId || tx.id;
    const parentObj = transactions.find(t => t.id === parentId);
    if (!parentObj || !parentObj.isSplitParent) return;

    const childSubTxs = transactions.filter(t => t.parentTransactionId === parentId);
    const childIds = childSubTxs.map(t => t.id);

    const updatedParent: Transaction = {
      ...parentObj,
      isSplitParent: false,
    };

    saveTransaction([updatedParent], childIds);
    setSelectedIds(new Set());
  };

  const handleUncombine = (targetTx?: DisplayTransaction) => {
    let tx = targetTx;
    if (!tx) {
      if (selectedIds.size !== 1) return;
      const selectedId = Array.from(selectedIds)[0];
      tx = displayTransactions.find(t => t.id === selectedId);
    }
    if (!tx) return;

    const parentId = tx.parentTransactionId || tx.id;
    const parentObj = transactions.find(t => t.id === parentId);
    if (!parentObj || !parentObj.isCombinedParent) return;

    const childSubTxs = transactions.filter(t => t.parentTransactionId === parentId);
    const updatedChildren: Transaction[] = childSubTxs.map(c => ({
      ...c,
      parentTransactionId: undefined,
    }));

    saveTransaction(updatedChildren, [parentId]);
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
    setSelectedLocations([]);
    setLocationSearch('');
    setOpenFilterCol(null);
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

  const handleLocationToggle = useCallback((city: string) => {
      setSelectedLocations(prev =>
        prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
      );
  }, []);

  const uniqueLocations = useMemo(() => {
    const map = new Map<string, { flag: string; city: string; country: string; count: number }>();
    transactions.forEach(tx => {
        const loc = formatTransactionLocation(tx, user);
        const existing = map.get(loc.city);
        if (existing) {
            existing.count += 1;
        } else {
            map.set(loc.city, { ...loc, count: 1 });
        }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [transactions, user]);

  const filteredLocationOptions = useMemo(() => {
    if (!locationSearch.trim()) return uniqueLocations;
    const query = locationSearch.toLowerCase();
    return uniqueLocations.filter(loc => 
        loc.city.toLowerCase().includes(query) || 
        loc.country.toLowerCase().includes(query)
    );
  }, [uniqueLocations, locationSearch]);

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
          <div>
              <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1 block">Search Text</label>
              <input
                  type="text"
                  placeholder="Search description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={INPUT_BASE_STYLE}
              />
          </div>
          <div>
              <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1 block">Merchant</label>
              <input
                  type="text"
                  placeholder="Filter merchant..."
                  value={merchantFilter}
                  onChange={(e) => setMerchantFilter(e.target.value)}
                  className={INPUT_BASE_STYLE}
              />
          </div>
          {(searchTerm || merchantFilter) && (
              <button onClick={() => { setSearchTerm(''); setMerchantFilter(''); }} className="text-xs text-red-500 w-full text-center hover:underline pt-1">Clear</button>
          )}
      </div>
  ), [merchantFilter, searchTerm]);

  const categoryFilterContent = useMemo(() => (
      <div className="space-y-2">
           <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {categoryOptions.map(cat => (
                   <label key={cat.value} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                       <input type="checkbox" checked={selectedCategoryNames.includes(cat.value)} onChange={() => handleCategoryToggle(cat.value)} className={CHECKBOX_STYLE} />
                       <span className="truncate text-xs font-medium" style={{ paddingLeft: cat.level * 12 }}>{cat.label}</span>
                   </label>
              ))}
          </div>
          {selectedCategoryNames.length > 0 && (
              <button onClick={() => setSelectedCategoryNames([])} className="text-xs text-red-500 w-full text-center hover:underline pt-1 border-t border-black/5 dark:border-white/5">Clear Selection</button>
          )}
      </div>
  ), [categoryOptions, handleCategoryToggle, selectedCategoryNames]);

  const locationFilterContent = useMemo(() => (
      <div className="space-y-2 p-1">
          <input
              type="text"
              placeholder="Search location..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className={INPUT_BASE_STYLE}
          />
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredLocationOptions.map(loc => (
                  <label key={loc.city} className="flex items-center justify-between gap-2 text-sm p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                      <div className="flex items-center gap-2 min-w-0">
                          <input
                              type="checkbox"
                              checked={selectedLocations.includes(loc.city)}
                              onChange={() => handleLocationToggle(loc.city)}
                              className={CHECKBOX_STYLE}
                          />
                          <span className="text-base leading-none">{loc.flag}</span>
                          <span className="truncate text-xs font-semibold text-primary">{loc.city}</span>
                          <span className="text-[10px] text-tertiary truncate">({loc.country})</span>
                      </div>
                      <span className="text-[10px] font-medium text-quaternary shrink-0">
                          {loc.count}
                      </span>
                  </label>
              ))}
          </div>
          {selectedLocations.length > 0 && (
              <button onClick={() => setSelectedLocations([])} className="text-xs text-red-500 w-full text-center hover:underline pt-1 border-t border-black/5 dark:border-white/5">
                  Clear Location Filters ({selectedLocations.length})
              </button>
          )}
      </div>
  ), [filteredLocationOptions, handleLocationToggle, locationSearch, selectedLocations]);

  const tagFilterContent = useMemo(() => (
      <div className="space-y-2">
          {tagOptions.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
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
          <div>
              <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1 block">Type</label>
              <div className="grid grid-cols-2 gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg">
                  {typeFilterOptions.map(opt => (
                      <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTypeFilter(opt.value)}
                          className={cx(
                              "px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer",
                              typeFilter === opt.value
                                  ? "bg-white dark:bg-dark-card shadow-xs text-primary font-bold"
                                  : "text-tertiary hover:text-primary"
                          )}
                      >
                          {opt.label}
                      </button>
                  ))}
              </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
              <div>
                  <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">Min (€)</label>
                  <input type="number" placeholder="0.00" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={INPUT_BASE_STYLE} />
              </div>
              <div>
                  <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">Max (€)</label>
                  <input type="number" placeholder="1000.00" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className={INPUT_BASE_STYLE} />
              </div>
          </div>
          {(minAmount || maxAmount || typeFilter !== 'all') && (
              <button onClick={() => {setMinAmount(''); setMaxAmount(''); setTypeFilter('all');}} className="text-xs text-red-500 w-full text-center hover:underline pt-1">Clear Filters</button>
          )}
      </div>
  ), [maxAmount, minAmount, typeFilter, typeFilterOptions]);

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
    return <Icon name="credit_card" className="text-gray-400 text-sm" />;
  };

  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, typeFilter, startDate, endDate, minAmount, maxAmount, merchantFilter, selectedAccountIds, selectedCategoryNames, selectedTagIds, selectedLocations]);

  const formatDateHeader = useCallback((dateString: string) => {
    if (!dateString) return 'No Date';
    const date = parseLocalDate(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (isToday) return `Today • ${weekday}, ${formattedDate}`;
    if (isYesterday) return `Yesterday • ${weekday}, ${formattedDate}`;
    return `${weekday}, ${formattedDate}`;
  }, []);

  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];
    const col = String(sortDescriptor.column || 'date');
    const isDesc = sortDescriptor.direction === 'descending';

    return list.sort((a, b) => {
      let cmp = 0;
      if (col === 'date') {
        cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
      } else if (col === 'amount') {
        cmp = Math.abs(a.amount) - Math.abs(b.amount);
      } else if (col === 'description') {
        cmp = (a.description || '').localeCompare(b.description || '');
      } else if (col === 'account') {
        const nameA = accountMapByName[a.accountName || '']?.name || a.accountName || '';
        const nameB = accountMapByName[b.accountName || '']?.name || b.accountName || '';
        cmp = nameA.localeCompare(nameB);
      } else if (col === 'category') {
        cmp = (a.category || '').localeCompare(b.category || '');
      } else if (col === 'location') {
        const locA = formatTransactionLocation(a, user).city;
        const locB = formatTransactionLocation(b, user).city;
        cmp = locA.localeCompare(locB);
      } else {
        cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
      }
      return isDesc ? -cmp : cmp;
    });
  }, [filteredTransactions, sortDescriptor, accountMapByName, user]);

  const displayItemsWithSubs = useMemo(() => {
    const subTxMap = new Map<string, DisplayTransaction[]>();
    const topLevelList: DisplayTransaction[] = [];

    sortedTransactions.forEach(tx => {
      if (tx.parentTransactionId) {
        const list = subTxMap.get(tx.parentTransactionId) || [];
        list.push({ ...tx, isSubTransaction: true });
        subTxMap.set(tx.parentTransactionId, list);
      } else {
        topLevelList.push(tx);
      }
    });

    const isFilterActive = Boolean(debouncedSearchTerm || merchantFilter || minAmount || maxAmount || selectedLocations.length > 0);

    const result: DisplayTransaction[] = [];
    topLevelList.forEach(tx => {
      const subTxs = subTxMap.get(tx.id) || [];
      result.push({
        ...tx,
        subItemCount: subTxs.length,
        isExpanded: expandedParentIds.has(tx.id),
      });

      const shouldExpand = expandedParentIds.has(tx.id) || isFilterActive;
      if (shouldExpand && subTxs.length > 0) {
        subTxs.forEach(sub => result.push(sub));
      }
    });

    return result;
  }, [sortedTransactions, expandedParentIds, debouncedSearchTerm, merchantFilter, minAmount, maxAmount, selectedLocations]);

  const totalPages = Math.max(1, Math.ceil(displayItemsWithSubs.length / itemsPerPage));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return displayItemsWithSubs.slice(start, start + itemsPerPage);
  }, [displayItemsWithSubs, currentPage, itemsPerPage]);

  // Group current page items by date
  const tableRenderItems = useMemo<TableRenderItem[]>(() => {
    const items: TableRenderItem[] = [];
    let currentDate = '';
    let currentGroupTxs: DisplayTransaction[] = [];

    const flushGroup = () => {
      if (currentDate && currentGroupTxs.length > 0) {
        let totalEur = 0;
        const groupTxIds: string[] = [];
        currentGroupTxs.forEach(t => {
          const resolved = resolveTransferDisplay(t);
          totalEur += convertToEur(resolved.amount, resolved.currency);
          groupTxIds.push(t.id);
        });

        const isAllGroupSelected = groupTxIds.length > 0 && groupTxIds.every(id => selectedIds.has(id));
        const isSomeGroupSelected = groupTxIds.some(id => selectedIds.has(id)) && !isAllGroupSelected;

        items.push({
          isGroupHeader: true,
          id: `group-hdr-${currentDate}`,
          date: currentDate,
          formattedDate: formatDateHeader(currentDate),
          count: currentGroupTxs.length,
          totalEur,
          groupTxIds,
          isAllGroupSelected,
          isSomeGroupSelected,
        });

        currentGroupTxs.forEach(t => {
          items.push({
            isGroupHeader: false,
            id: t.id,
            tx: t,
          });
        });
      }
    };

    paginatedItems.forEach(tx => {
      const d = tx.date || 'No Date';
      if (d !== currentDate) {
        flushGroup();
        currentDate = d;
        currentGroupTxs = [tx];
      } else {
        currentGroupTxs.push(tx);
      }
    });
    flushGroup();

    return items;
  }, [paginatedItems, selectedIds, formatDateHeader, resolveTransferDisplay]);

  const selectedKeys = useMemo(() => {
    if (isAllSelected && filteredTransactions.length > 0) return 'all' as const;
    return selectedIds;
  }, [isAllSelected, filteredTransactions.length, selectedIds]);

  const disabledGroupHeaderKeys = useMemo(() => {
    return new Set(tableRenderItems.filter(i => i.isGroupHeader).map(i => i.id));
  }, [tableRenderItems]);

  const handleSelectionChange = useCallback((keys: 'all' | Set<React.Key>) => {
    if (keys === 'all') {
      setSelectedIds(prev => {
        if (prev.size === filteredTransactions.length && filteredTransactions.every(t => prev.has(t.id))) {
          return prev;
        }
        return new Set(filteredTransactions.map(t => t.id));
      });
    } else {
      const validIds = Array.from(keys).map(String).filter(id => !id.startsWith('group-hdr-'));
      setSelectedIds(prev => {
        if (prev.size === validIds.length && validIds.every(id => prev.has(id))) {
          return prev;
        }
        return new Set(validIds);
      });
    }
  }, [filteredTransactions]);

  const handleSortBySelect = (newSortBy: string) => {
    setSortBy(newSortBy);
    if (newSortBy === 'date-desc') setSortDescriptor({ column: 'date', direction: 'descending' });
    else if (newSortBy === 'date-asc') setSortDescriptor({ column: 'date', direction: 'ascending' });
    else if (newSortBy === 'amount-desc') setSortDescriptor({ column: 'amount', direction: 'descending' });
    else if (newSortBy === 'amount-asc') setSortDescriptor({ column: 'amount', direction: 'ascending' });
    else if (newSortBy === 'merchant-asc') setSortDescriptor({ column: 'description', direction: 'ascending' });
    else if (newSortBy === 'merchant-desc') setSortDescriptor({ column: 'description', direction: 'descending' });
    else if (newSortBy === 'category-asc') setSortDescriptor({ column: 'category', direction: 'ascending' });
    else if (newSortBy === 'category-desc') setSortDescriptor({ column: 'category', direction: 'descending' });
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
          userProfile={user}
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
      {isCombineModalOpen && (
          <CombineTransactionsModal
              onClose={() => { setIsCombineModalOpen(false); setTransactionsToCombine([]); }}
              onSave={handleSaveCombine}
              transactionsToCombine={transactionsToCombine}
              incomeCategories={incomeCategories}
              expenseCategories={expenseCategories}
              accounts={accounts}
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
                    <Icon name="edit" className="text-lg text-primary-500" />
                    <span>Edit Transaction</span>
                </button>
                {(contextMenu.transaction.isSplitParent || contextMenu.transaction.parentTransactionId) && (
                    <button onClick={() => { handleUnsplit(contextMenu.transaction); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <Icon name="call_merge" className="text-lg text-amber-500" />
                        <span>Unsplit Transaction</span>
                    </button>
                )}
                {(contextMenu.transaction.isCombinedParent || (contextMenu.transaction.parentTransactionId && transactions.find(t => t.id === contextMenu.transaction.parentTransactionId)?.isCombinedParent)) && (
                    <button onClick={() => { handleUncombine(contextMenu.transaction); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <Icon name="call_split" className="text-lg text-indigo-500" />
                        <span>Uncombine Transaction</span>
                    </button>
                )}
                {!contextMenu.transaction.isSplitParent && !contextMenu.transaction.isCombinedParent && !contextMenu.transaction.parentTransactionId && !contextMenu.transaction.isTransfer && (
                    <button onClick={() => { setTransactionToSplit(transactions.find(t => t.id === contextMenu.transaction.id) || null); setIsSplitModalOpen(true); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <Icon name="splitscreen" className="text-lg text-amber-500" />
                        <span>Split Transaction</span>
                    </button>
                )}
                <button onClick={() => { handleDuplicate(contextMenu.transaction); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <Icon name="content_copy" className="text-lg text-green-500" />
                    <span>Duplicate</span>
                </button>
                <button 
                    onClick={() => { handleMakeRecurring(contextMenu.transaction); setContextMenu(null); }} 
                    disabled={contextMenu.transaction.isTransfer}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Icon name="repeat" className="text-lg text-purple-500" />
                    <span>Make Recurring</span>
                </button>
                <div className="my-1 h-px bg-light-separator dark:bg-dark-separator"></div>
                <button onClick={() => { 
                    setSelectedIds(new Set([contextMenu.transaction.id]));
                    setIsDeleteConfirmOpen(true);
                    setContextMenu(null);
                }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Icon name="delete" className="text-lg" />
                    <span>Delete Transaction</span>
                </button>
            </div>
        )}

      {/* Mobile Transactions Feed */}
      <div className="block md:hidden">
        <MobileTransactionsView
          transactions={transactions}
          filteredTransactions={filteredTransactions}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          tags={tags}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          selectedAccountIds={selectedAccountIds}
          setSelectedAccountIds={setSelectedAccountIds}
          selectedCategoryNames={selectedCategoryNames}
          setSelectedCategoryNames={setSelectedCategoryNames}
          selectedTagIds={selectedTagIds}
          setSelectedTagIds={setSelectedTagIds}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          clearFilters={clearFilters}
          onAddTransaction={handleOpenAddModal}
          onEditTransaction={(tx) => {
            const targetId = tx.originalId || tx.id;
            const found = transactions.find(
              (t) =>
                t.id === targetId ||
                t.id === tx.id ||
                (tx.transferId && t.transferId === tx.transferId)
            );

            const fallbackTx: Transaction = {
              id: tx.id,
              accountId: tx.accountId || (accounts[0]?.id || ''),
              description: tx.description,
              amount: Math.abs(tx.amount),
              type: (tx.type as any) || 'expense',
              category: tx.category || '',
              date: tx.date,
              currency: tx.currency || 'EUR',
              notes: tx.notes,
              merchant: tx.merchant,
              tagIds: tx.tagIds,
            };

            setEditingTransaction(found || fallbackTx);
            setTransactionModalOpen(true);
          }}
          onDeleteTransaction={(txId) => {
            deleteTransactions([txId]);
          }}
          onCategorizeTransaction={(tx) => {
            setSelectedIds(new Set([tx.id]));
            setIsCategorizeModalOpen(true);
          }}
          onMakeRecurring={(tx) => {
            setTransactionToMakeRecurring({
              description: tx.description,
              amount: Math.abs(tx.amount),
              type: tx.type as any,
              category: tx.category,
              accountId: tx.accountId,
              frequency: 'monthly',
              startDate: tx.date,
              nextDueDate: tx.date,
              currency: tx.currency || 'EUR',
              weekendAdjustment: 'on',
            });
            setIsRecurringModalOpen(true);
          }}
          onSplitTransaction={(tx) => {
            const original = transactions.find((t) => t.id === tx.id);
            if (original) {
              setTransactionToSplit(original);
              setIsSplitModalOpen(true);
            }
          }}
          onSyncBanks={onSyncBanks}
          isSyncingBanks={isSyncingBanks}
          preferredCurrency={preferredCurrency}
          conversionRates={conversionRates}
          brandfetchClientId={brandfetchClientId}
          merchantLogoOverrides={effectiveMerchantLogoOverrides}
        />
      </div>

      <div className="hidden md:block space-y-6">
        <PageHeader
        markerIcon="receipt"
        markerLabel="Activity Feed"
        title="Transactions"
        subtitle="Every inflow and outflow with filters, splits, and tagging to keep your history audit-ready."
        actions={
          <div className="flex items-center gap-2">
            <HeaderButton
              variant="emerald"
              icon="sync"
              isLoading={isSyncingBanks}
              onClick={() => {
                if (onSyncBanks) onSyncBanks();
                else {
                  const syncBtn = document.querySelector('[data-eb-sync-all]');
                  if (syncBtn) (syncBtn as HTMLElement).click();
                }
              }}
              title="Sync Connected Banking Accounts"
            >
              {isSyncingBanks ? 'Syncing...' : 'Sync Banks'}
            </HeaderButton>

            <HeaderButton
              variant="secondary"
              icon="download"
              onClick={handleExport}
            >
              Export
            </HeaderButton>

            <HeaderButton
              variant="primary"
              icon="PlusCircle"
              onClick={handleOpenAddModal}
            >
              Add Transaction
            </HeaderButton>
          </div>
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
                        <Icon name="receipt" className="text-base sm:text-lg" />
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-semibold text-white/80">Total transactions</p>
                </div>
                
                <div className="flex flex-col">
                    <p className="text-xl sm:text-2xl font-black tracking-tight">{filteredTransactions.length}</p>
                    <p className="text-[9px] sm:text-[10px] text-white/70 mt-0.5 sm:mt-1 font-semibold">in selected period</p>
                </div>
            </div>
            
            <div className="absolute -right-4 -bottom-4 text-white opacity-10 transition-transform group-hover:scale-110 duration-500 hidden sm:block">
                <Icon name="receipt" className="text-8xl" />
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
            icon="wallet" 
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
                          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none opacity-50" />
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
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
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
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                      </div>
                      <div className="col-span-2 md:col-span-2 flex items-end">
                         <button 
                            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                            className={`w-full h-[42px] flex items-center justify-center gap-2 rounded-2xl font-semibold text-[11px] tracking-wider transition-all ${isFiltersExpanded ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10'}`}
                        >
                            <Icon name={isFiltersExpanded ? 'keyboard_double_arrow_up' : 'tune'} className="text-lg" />
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
      {/* Untitled UI Table Card with Alternating Fills */}
      <div className="flex-1 min-w-0 relative">
        <TableCard.Root className="shadow-sm border border-secondary rounded-2xl bg-primary">
            <TableCard.Header
                title="Transactions"
                badge={`${filteredTransactions.length} records`}
                description="Every inflow and outflow with location, categories, tags, and audit-ready history."
                contentTrailing={
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedIds(new Set())}
                                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline px-2 cursor-pointer"
                            >
                                Clear selection ({selectedIds.size})
                            </button>
                        )}
                        <DropdownIconSimple />
                    </div>
                }
            />

            {/* Bulk Action Header Banner */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${selectedIds.size > 0 ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                <div className="bg-primary-600 dark:bg-primary-900 text-white px-6 py-3 flex justify-between items-center z-20 relative">
                    <div className="flex items-center gap-4">
                        <span className="font-semibold text-sm tracking-tight">{selectedIds.size} records selected</span>
                        <button 
                            type="button"
                            onClick={() => setSelectedIds(new Set())} 
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                            aria-label="Deselect all"
                        >
                            <Icon name="close" className="text-sm" />
                        </button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {[
                            { label: 'Edit', icon: 'edit', onClick: () => setBulkEditModalOpen(true), disabled: selectedIds.size === 0 },
                            { label: 'Categorize', icon: 'category', onClick: handleOpenCategorizeModal, disabled: selectedIds.size === 0 },
                            { label: 'Combine', icon: 'merge_type', onClick: handleOpenCombineModal, disabled: !canCombine },
                            { label: 'Split', icon: 'splitscreen', onClick: handleOpenSplitModal, disabled: !canSplit },
                            { label: 'Unsplit', icon: 'call_merge', onClick: () => handleUnsplit(), disabled: !canUnsplit },
                            { label: 'Uncombine', icon: 'call_split', onClick: () => handleUncombine(), disabled: !canUncombine },
                            { label: 'Recurring', icon: 'repeat', onClick: () => handleMakeRecurring(), disabled: selectedIds.size !== 1 },
                            { label: 'Delete', icon: 'delete', onClick: handleOpenDeleteModal, disabled: selectedIds.size === 0, danger: true }
                        ].map((btn) => (
                            <button 
                                key={btn.label}
                                type="button" 
                                onClick={btn.onClick} 
                                disabled={btn.disabled}
                                className={`
                                    h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold tracking-wide transition-all cursor-pointer
                                    ${btn.disabled 
                                        ? 'opacity-40 cursor-not-allowed grayscale' 
                                        : btn.danger
                                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm' 
                                            : 'bg-white/15 hover:bg-white/25 text-white'
                                    }
                                `}
                            >
                                <Icon name={btn.icon} className="text-sm" />
                                <span>{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {tableRenderItems.length > 0 ? (
                <Table
                    aria-label="Transactions"
                    selectionMode="multiple"
                    selectionBehavior="toggle"
                    selectedKeys={selectedKeys}
                    disabledKeys={disabledGroupHeaderKeys}
                    disabledBehavior="selection"
                    onSelectionChange={handleSelectionChange}
                    sortDescriptor={sortDescriptor}
                    onSortChange={setSortDescriptor}
                >
                    <Table.Header className="bg-primary">
                        <Table.Head id="description" label="Transaction Details" isRowHeader allowsSorting className="w-full max-w-[280px] xl:max-w-xs">
                            <ColumnHeaderFilter
                                isOpen={openFilterCol === 'description'}
                                onToggle={() => setOpenFilterCol(prev => prev === 'description' ? null : 'description')}
                                onClose={() => setOpenFilterCol(null)}
                                isActive={Boolean(debouncedSearchTerm || merchantFilter)}
                                title="Details & Merchant"
                            >
                                {merchantFilterContent}
                            </ColumnHeaderFilter>
                        </Table.Head>

                        <Table.Head id="account" label="Account" allowsSorting>
                            <ColumnHeaderFilter
                                isOpen={openFilterCol === 'account'}
                                onToggle={() => setOpenFilterCol(prev => prev === 'account' ? null : 'account')}
                                onClose={() => setOpenFilterCol(null)}
                                isActive={selectedAccountIds.length > 0}
                                activeCount={selectedAccountIds.length}
                                title="Accounts"
                            >
                                {accountFilterContent}
                            </ColumnHeaderFilter>
                        </Table.Head>

                        <Table.Head id="category" label="Category" allowsSorting>
                            <ColumnHeaderFilter
                                isOpen={openFilterCol === 'category'}
                                onToggle={() => setOpenFilterCol(prev => prev === 'category' ? null : 'category')}
                                onClose={() => setOpenFilterCol(null)}
                                isActive={selectedCategoryNames.length > 0}
                                activeCount={selectedCategoryNames.length}
                                title="Categories"
                            >
                                {categoryFilterContent}
                            </ColumnHeaderFilter>
                        </Table.Head>

                        <Table.Head id="location" label="Location" allowsSorting>
                            <ColumnHeaderFilter
                                isOpen={openFilterCol === 'location'}
                                onToggle={() => setOpenFilterCol(prev => prev === 'location' ? null : 'location')}
                                onClose={() => setOpenFilterCol(null)}
                                isActive={selectedLocations.length > 0}
                                activeCount={selectedLocations.length}
                                title="Locations"
                            >
                                {locationFilterContent}
                            </ColumnHeaderFilter>
                        </Table.Head>

                        <Table.Head id="tags" label="Tags">
                            <ColumnHeaderFilter
                                isOpen={openFilterCol === 'tags'}
                                onToggle={() => setOpenFilterCol(prev => prev === 'tags' ? null : 'tags')}
                                onClose={() => setOpenFilterCol(null)}
                                isActive={selectedTagIds.length > 0}
                                activeCount={selectedTagIds.length}
                                title="Tags"
                            >
                                {tagFilterContent}
                            </ColumnHeaderFilter>
                        </Table.Head>

                        <Table.Head id="amount" label="Value" allowsSorting className="text-right">
                            <ColumnHeaderFilter
                                isOpen={openFilterCol === 'amount'}
                                onToggle={() => setOpenFilterCol(prev => prev === 'amount' ? null : 'amount')}
                                onClose={() => setOpenFilterCol(null)}
                                isActive={Boolean(minAmount || maxAmount || typeFilter !== 'all')}
                                title="Value & Type"
                            >
                            {amountFilterContent}
                            </ColumnHeaderFilter>
                        </Table.Head>

                        <Table.Head id="actions" className="w-16 text-right" />
                    </Table.Header>
                    <Table.Body items={tableRenderItems} dependencies={[selectedIds]}>
                        {(item: TableRenderItem) => {
                            if (item.isGroupHeader) {
                                const handleToggleGroup = (e?: React.MouseEvent) => {
                                    e?.stopPropagation();
                                    e?.preventDefault();
                                    setSelectedIds(prev => {
                                        const next = new Set(prev);
                                        if (item.isAllGroupSelected) {
                                            item.groupTxIds.forEach(id => next.delete(id));
                                        } else {
                                            item.groupTxIds.forEach(id => next.add(id));
                                        }
                                        return next;
                                    });
                                };

                                return (
                                    <Table.Row
                                        id={item.id}
                                        size="xs"
                                        customSelectionSlot={
                                            <button
                                                type="button"
                                                aria-label={`Select all ${item.formattedDate} transactions`}
                                                onClick={handleToggleGroup}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onPointerUp={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onMouseUp={(e) => e.stopPropagation()}
                                                className="cursor-pointer p-0.5 rounded focus:outline-hidden"
                                            >
                                                <CheckboxBase
                                                    size="sm"
                                                    isSelected={item.isAllGroupSelected}
                                                    isIndeterminate={item.isSomeGroupSelected}
                                                />
                                            </button>
                                        }
                                        className="bg-secondary/90 dark:bg-white/[0.04] border-y border-secondary select-none font-medium hover:bg-secondary cursor-default"
                                    >
                                        {/* 1. Details (Date Banner) */}
                                        <Table.Cell size="xs" className="!py-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-primary tracking-tight">
                                                    {item.formattedDate}
                                                </span>
                                                <span className="text-xs font-medium text-tertiary px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 shrink-0">
                                                    {item.count}
                                                </span>
                                            </div>
                                        </Table.Cell>

                                        {/* 2. Account */}
                                        <Table.Cell size="xs" className="!py-1">
                                            <span className="sr-only">Account</span>
                                        </Table.Cell>

                                        {/* 3. Category */}
                                        <Table.Cell size="xs" className="!py-1">
                                            <span className="sr-only">Category</span>
                                        </Table.Cell>

                                        {/* 4. Location */}
                                        <Table.Cell size="xs" className="!py-1">
                                            <span className="sr-only">Location</span>
                                        </Table.Cell>

                                        {/* 5. Tags */}
                                        <Table.Cell size="xs" className="!py-1">
                                            <span className="sr-only">Tags</span>
                                        </Table.Cell>

                                        {/* 6. Amount (Daily Net Sum) */}
                                        <Table.Cell size="xs" className="!py-1 text-right whitespace-nowrap">
                                            <span className={cx(
                                                "text-sm font-semibold tracking-tight",
                                                item.totalEur > 0 ? "text-green-600 dark:text-green-400" : item.totalEur < 0 ? "text-light-text dark:text-dark-text" : "text-tertiary"
                                            )}>
                                                {item.totalEur > 0 ? `+${formatCurrency(item.totalEur, 'EUR')}` : formatCurrency(item.totalEur, 'EUR')}
                                            </span>
                                        </Table.Cell>

                                        {/* 7. Actions */}
                                        <Table.Cell size="xs" className="!py-1 px-4 text-right">
                                            <span className="sr-only">Actions</span>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            } else {
                                const tx = (item as { isGroupHeader: false; id: string; tx: DisplayTransaction }).tx;
                                let amountColor = tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

                                const fromAcc = accountMapByName[tx.fromAccountName!];
                                const toAcc = accountMapByName[tx.toAccountName!];
                                
                                if (tx.isTransfer) {
                                  amountColor = 'text-primary';
                                  if (selectedAccountIds.length > 0) {
                                    if (selectedAccountIds.includes(fromAcc?.id) && !selectedAccountIds.includes(toAcc?.id)) { amountColor = 'text-red-600 dark:text-red-400'; }
                                    else if (!selectedAccountIds.includes(fromAcc?.id) && selectedAccountIds.includes(toAcc?.id)) { amountColor = 'text-green-600 dark:text-green-400'; }
                                  }
                                }

                                const txType = tx.isTransfer ? 'transfer' : tx.type;
                                const typeIndicator = txType === 'income'
                                  ? {
                                      dot: "bg-emerald-500 shadow-xs shadow-emerald-500/50",
                                      label: "Income"
                                    }
                                  : txType === 'expense'
                                  ? {
                                      dot: "bg-rose-500 shadow-xs shadow-rose-500/50",
                                      label: "Expense"
                                    }
                                  : {
                                      dot: "bg-slate-400 dark:bg-white/80 shadow-xs",
                                      label: "Internal Transfer"
                                    };

                                const categoryDetails = getCategoryDetails(tx.category, allCategories);
                                const categoryColor = (tx.isTransfer && (!tx.category || tx.category === 'Transfer')) ? '#64748B' : (categoryDetails.color || '#A0AEC0');
                                const categoryIcon = (tx.isTransfer && (!tx.category || tx.category === 'Transfer')) ? 'swap_horiz' : (categoryDetails.icon || 'category');
                                const merchantKey = normalizeMerchantKey(tx.merchant);
                                const merchantLogoUrl = merchantKey ? merchantLogoUrls[merchantKey] : null;
                                const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors[merchantLogoUrl]);
                                const merchantInitial = tx.merchant?.trim().charAt(0)?.toUpperCase();

                                const account = accountMapByName[tx.accountName || ''] || accountMap[tx.accountId];
                                const accountName = account?.name || tx.accountName || (tx.isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : 'Unknown');
                                const accountSub = account ? (account.last4 ? `•••• ${account.last4}` : (account.type === 'Credit Card' ? 'Credit' : account.type)) : 'Manual';
                                
                                const resolvedDisplay = resolveTransferDisplay(tx);
                                const displayAmount = tx.isTransfer && selectedAccountIds.length === 0
                                    ? formatCurrency(convertToEur(Math.abs(resolvedDisplay.amount), resolvedDisplay.currency), 'EUR')
                                    : formatCurrency(convertToEur(resolvedDisplay.amount, resolvedDisplay.currency), 'EUR', { showPlusSign: true });

                                const institutionLogoUrl = account?.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 }) : null;
                                const showInstitutionLogo = Boolean(institutionLogoUrl && !logoLoadErrors[institutionLogoUrl]);
                                const loc = formatTransactionLocation(tx, user);

                                return (
                                    <Table.Row
                                        id={tx.id}
                                        className={cx(
                                            "odd:bg-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group",
                                            tx.parentTransactionId && "bg-primary-500/[0.03] dark:bg-primary-500/[0.05]"
                                        )}
                                        onDoubleClick={() => {
                                          setEditingTransaction(transactions.find(t => t.id === (tx.isTransfer ? tx.originalId : tx.id)) || null);
                                          setTransactionModalOpen(true);
                                        }}
                                        onContextMenu={(e) => openContextMenu(e, tx)}
                                    >
                                        {/* 1. Details */}
                                        <Table.Cell>
                                            <div className={cx("flex items-center gap-3 min-w-0 py-0.5", tx.parentTransactionId && "pl-6 border-l-2 border-primary-500/40 ml-1")}>
                                                {tx.parentTransactionId && (
                                                    <Icon name="subdirectory_arrow_right" className="size-3.5 text-primary-500 shrink-0 opacity-70" />
                                                )}
                                                {(tx.isSplitParent || tx.isCombinedParent) && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => toggleExpandParent(tx.id, e)}
                                                        className="size-6 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-secondary transition-all shrink-0 cursor-pointer"
                                                        title={tx.isExpanded ? "Collapse sub-transactions" : "Expand sub-transactions"}
                                                    >
                                                        <Icon name={tx.isExpanded ? "expand_more" : "chevron_right"} className="text-sm" />
                                                    </button>
                                                )}
                                                {showMerchantLogo && merchantLogoUrl ? (
                                                    <div className="size-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-black/[0.03] dark:bg-white/[0.04]">
                                                        <img src={merchantLogoUrl} alt={tx.merchant || tx.description} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : merchantInitial ? (
                                                    <div className="size-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-sm shadow-xs" style={{ backgroundColor: categoryColor }}>
                                                        {merchantInitial}
                                                    </div>
                                                ) : (
                                                    <div className="size-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs" style={{ backgroundColor: categoryColor }}>
                                                        <Icon name={categoryIcon} className="text-lg" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="text-base font-semibold text-primary truncate max-w-[220px] xl:max-w-xs">{tx.description}</p>
                                                        {tx.isSplitParent && (
                                                            <Badge color="warning" size="sm">Split ({tx.subItemCount || 0})</Badge>
                                                        )}
                                                        {tx.isCombinedParent && (
                                                            <Badge color="indigo" size="sm">Combined ({tx.subItemCount || 0})</Badge>
                                                        )}
                                                        {tx.recurringSourceId && <Icon name="repeat" className="text-xs text-primary-500 shrink-0" />}
                                                        {tx.notes && <Icon name="notes" className="text-xs text-primary-500/50 shrink-0" />}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-sm text-tertiary truncate">
                                                        <span className={cx("size-1.5 rounded-full shrink-0", typeIndicator.dot)} title={typeIndicator.label} />
                                                        <span className="truncate">{tx.merchant || (tx.isTransfer ? 'Transfer' : 'Activity record')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Table.Cell>

                                        {/* 2. Account */}
                                        <Table.Cell className="whitespace-nowrap">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {showInstitutionLogo ? (
                                                    <div className="size-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-black/[0.03] dark:bg-white/[0.04]">
                                                        <img src={institutionLogoUrl} alt={accountName} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="size-8 rounded-lg flex items-center justify-center bg-black/5 dark:bg-white/5 text-tertiary shrink-0">
                                                        <Icon name="account_balance" className="text-sm opacity-50" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-base font-medium text-primary truncate max-w-[150px]">{accountName}</p>
                                                    <p className="text-sm text-tertiary truncate">{accountSub}</p>
                                                </div>
                                            </div>
                                        </Table.Cell>

                                        {/* 3. Category */}
                                        <Table.Cell className="whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([tx.id])); setIsCategorizeModalOpen(true); }}
                                                className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-2xs group/cat"
                                                style={{ backgroundColor: `${categoryColor}18`, color: categoryColor }}
                                                title={`Category: ${tx.category || 'Uncategorized'}`}
                                            >
                                                <Icon name={categoryIcon} className="text-sm shrink-0" />
                                                <span className="truncate max-w-[120px]">{tx.category || 'Uncategorized'}</span>
                                            </button>
                                        </Table.Cell>

                                        {/* 4. Location */}
                                        <Table.Cell className="whitespace-nowrap">
                                            <div
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10 transition-all select-none group/loc"
                                                title={loc.fullDisplay}
                                            >
                                                <span className="text-base leading-none shrink-0 drop-shadow-2xs select-none">{loc.flag}</span>
                                                <span className="text-xs font-semibold text-primary truncate max-w-[120px]">{loc.city}</span>
                                            </div>
                                        </Table.Cell>

                                        {/* 5. Tags */}
                                        <Table.Cell className="whitespace-nowrap">
                                            <div className="flex items-center gap-1">
                                                {tx.tagIds && tx.tagIds.length > 0 ? (
                                                    <>
                                                        {tx.tagIds.slice(0, 1).map(tagId => {
                                                            const tag = tags.find(t => t.id === tagId);
                                                            if (!tag) return null;
                                                            return (
                                                                <span key={tag.id} className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: `${tag.color}18`, color: tag.color }}>
                                                                    {tag.name}
                                                                </span>
                                                            );
                                                        })}
                                                        {tx.tagIds.length > 1 && (
                                                            <Badge color="gray" size="sm">+{tx.tagIds.length - 1}</Badge>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-quaternary opacity-40">—</span>
                                                )}
                                            </div>
                                        </Table.Cell>

                                        {/* 6. Amount */}
                                        <Table.Cell className="whitespace-nowrap text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={`text-base font-semibold tracking-tight ${amountColor}`}>
                                                    {displayAmount}
                                                </span>
                                                {tx.spareChangeAmount ? (
                                                    <div className="flex items-center justify-end gap-1 px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-500 text-xs font-semibold animate-pulse">
                                                        <Icon name="savings" className="text-xs" />
                                                        <span>{formatCurrency(convertToEur(Math.abs(tx.spareChangeAmount), tx.currency), 'EUR')}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </Table.Cell>

                                        {/* 7. Actions */}
                                        <Table.Cell className="px-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                                                <ButtonUtility
                                                    size="sm"
                                                    color="tertiary"
                                                    tooltip="Options"
                                                    icon={DotsVertical}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openContextMenu(e, tx);
                                                    }}
                                                />
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }
                        }}
                    </Table.Body>
                </Table>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-tertiary">
                    <Icon name="search_off" className="text-5xl mb-2 opacity-50" />
                    <p className="text-sm font-medium">No transactions match the current filters.</p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-3 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 cursor-pointer"
                    >
                        Reset all filters
                    </button>
                </div>
            )}

            <PaginationPageMinimalCenter
                page={currentPage}
                total={totalPages}
                onPageChange={setCurrentPage}
                totalItems={displayItemsWithSubs.length}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                className="px-4 py-3 md:px-6 md:pt-3 md:pb-4"
            />
        </TableCard.Root>
      </div>
    </div>
    </div>
  );
};

export default Transactions;
