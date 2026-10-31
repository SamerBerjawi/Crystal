
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Transaction, Account, DisplayTransaction, RecurringTransaction, Category, AccountType, MerchantRule, User } from '../types';
import { toast } from 'sonner';
import { formatCurrency, fuzzySearch, convertToEur, arrayToCSV, downloadCSV, parseLocalDate, toLocalISOString, CONVERSION_RATES, safeRound } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import BulkEditTransactionsModal from '../components/BulkEditTransactionsModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import SplitTransactionModal from '../components/SplitTransactionModal';
import CombineTransactionsModal from '../components/CombineTransactionsModal';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useDebounce } from '../hooks/useDebounce';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import PageHeader from '../components/PageHeader';
import { Button as AriaButton } from 'react-aria-components';
import Icon from '../components/ui/Icon';
import { Button, HoldButton, IconButton, SelectionBar } from '../components/ui/Actions';
import { CountPill, ShowMore } from '../components/ui/Display';
import { AmountInput, Checkbox, DateInput, Radio, RadioGroup, TextInput, controlStyles } from '../components/ui/Fields';
import { Menu, type MenuAction } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { Dialog, Popover } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import { EmptyState } from '../components/ui/States';
import SegmentedControl from '../components/ui/SegmentedControl';
import LedgerTable, { type LedgerItem, type LedgerSort } from '../components/LedgerTable';
import ReviewQueue from '../components/ReviewQueue';
import TransactionScatter from '../components/TransactionScatter';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useUrlTab } from '../hooks/useUrlTab';
import { cn } from '../lib/utils';
import type { SortDescriptor } from 'react-aria-components';
import { formatTransactionLocation } from '../utils/locationFormat';

interface TransactionsProps {
  user?: User;
  initialAccountFilter?: string | null;
  initialTagFilter?: string | null;
  onClearInitialFilters?: () => void;
  onSyncBanks?: () => void;
  isSyncingBanks?: boolean;
}



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
  }
  | {
    isGroupHeader: false;
    id: string;
    tx: DisplayTransaction;
  };

// Fallback empty object to preserve reference stability in selectors
const EMPTY_OBJECT = {};

const TYPE_FILTER_OPTIONS: { label: string; value: 'all' | 'income' | 'expense' | 'transfer' }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Expenses', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfers', value: 'transfer' },
];

const LEDGER_BATCH = 50;
const LEDGER_SORTS = [
  { id: 'date-desc', label: 'Newest first' },
  { id: 'date-asc', label: 'Oldest first' },
  { id: 'amount-desc', label: 'Largest first' },
  { id: 'amount-asc', label: 'Smallest first' },
  { id: 'merchant-asc', label: 'Merchant, A to Z' },
  { id: 'merchant-desc', label: 'Merchant, Z to A' },
  { id: 'category-asc', label: 'Category, A to Z' },
  { id: 'category-desc', label: 'Category, Z to A' },
];

const Transactions: React.FC<TransactionsProps> = ({ user, initialAccountFilter, initialTagFilter, onClearInitialFilters, onSyncBanks, isSyncingBanks }) => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  useEffect(() => {
    const timer = setTimeout(() => { renderCountRef.current = 0; }, 100);
    return () => clearTimeout(timer);
  });
  if (renderCountRef.current > 25) {
    console.error('[DIAGNOSTIC] Infinite loop in Transactions! Render count exceeded 25 in 100ms window.');
  }

  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { saveRecurringTransaction } = useScheduleContext();
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const preferredCurrency = usePreferencesSelector(p => p.currency || 'EUR');
  const conversionRates = usePreferencesSelector(p => p.conversionRates || CONVERSION_RATES);
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || EMPTY_OBJECT);
  const merchantRules = usePreferencesSelector(p => p.merchantRules || EMPTY_OBJECT) as Record<string, MerchantRule>;
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
  const urlTab = useUrlTab();
  const [isSelecting, setSelecting] = useState(false);

  const activeFilterCount = useMemo(() => {
    return (
      (selectedAccountIds.length > 0 ? 1 : 0) +
      (selectedCategoryNames.length > 0 ? 1 : 0) +
      (selectedTagIds.length > 0 ? 1 : 0) +
      (selectedLocations.length > 0 ? 1 : 0) +
      (typeFilter !== 'all' ? 1 : 0) +
      (startDate || endDate ? 1 : 0) +
      (minAmount || maxAmount ? 1 : 0) +
      (merchantFilter ? 1 : 0)
    );
  }, [
    selectedAccountIds.length,
    selectedCategoryNames.length,
    selectedTagIds.length,
    selectedLocations.length,
    typeFilter,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    merchantFilter,
  ]);

  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [overviewTransactions, setOverviewTransactions] = useState<Transaction[]>([]);
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
  const isMobile = useIsMobile();
  const [density, setDensity] = useLocalStorage<'default' | 'high'>('crystal_ledger_density', 'default');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});

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


  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc; return map; }, {} as { [key: string]: Account }), [accounts]);
  const accountMapByName = useMemo(() => accounts.reduce((map, acc) => { map[acc.name] = acc; return map; }, {} as Record<string, Account>), [accounts]);

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

    const txIdSet = new Set<string>();
    const transferIdSet = new Set<string>();
    sortedTransactions.forEach(t => {
      txIdSet.add(t.id);
      if (t.transferId) transferIdSet.add(t.transferId);
    });

    sortedTransactions.forEach(tx => {
      if (!tx.transferId?.startsWith('spare-') || tx.amount >= 0) return;

      const match = tx.transferId.match(/^spare-(.+)$/);
      const embeddedId = match ? match[1] : null;

      const isBoundToTx = embeddedId ? (txIdSet.has(embeddedId) || transferIdSet.has(embeddedId)) : false;

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
        if (!loc.hasLocation) return false;
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
    return { 
      totalIncome: safeRound(income, 2), 
      totalExpense: safeRound(expense, 2), 
      netFlow: safeRound(income - expense, 2) 
    };
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
      toast.error(`Category "${newCategoryName}" could not be found.`);
      return;
    }

    const newType = categoryDetails.classification || 'expense';

    // Iterate through raw selectedIds to handle transfers properly
    for (const selectedId of selectedIds) {
      if (selectedId.startsWith('transfer-')) {
        const transferId = selectedId.replace('transfer-', '');
        const pairExpense = transactions.find(t => t.transferId === transferId && t.type === 'expense');
        const pairIncome = transactions.find(t => t.transferId === transferId && t.type === 'income');

        if (newType === 'income' && pairIncome) {
          transactionUpdates.push({
            ...pairIncome,
            category: newCategoryName,
            type: 'income',
            amount: Math.abs(pairIncome.amount),
            transferId: undefined
          });
          if (pairExpense) idsToDelete.push(pairExpense.id);
        } else if (pairExpense) {
          transactionUpdates.push({
            ...pairExpense,
            category: newCategoryName,
            type: 'expense',
            amount: -Math.abs(pairExpense.amount),
            transferId: undefined
          });
          if (pairIncome) idsToDelete.push(pairIncome.id);
        }
      } else {
        const originalTx = transactions.find(t => t.id === selectedId);
        if (originalTx) {
          if (originalTx.transferId) {
            const transferId = originalTx.transferId;
            const pairExpense = transactions.find(t => t.transferId === transferId && t.type === 'expense');
            const pairIncome = transactions.find(t => t.transferId === transferId && t.type === 'income');

            if (newType === 'income' && pairIncome) {
              transactionUpdates.push({
                ...pairIncome,
                category: newCategoryName,
                type: 'income',
                amount: Math.abs(pairIncome.amount),
                transferId: undefined
              });
              if (pairExpense && !idsToDelete.includes(pairExpense.id)) idsToDelete.push(pairExpense.id);
            } else if (pairExpense) {
              transactionUpdates.push({
                ...pairExpense,
                category: newCategoryName,
                type: 'expense',
                amount: -Math.abs(pairExpense.amount),
                transferId: undefined
              });
              if (pairIncome && !idsToDelete.includes(pairIncome.id)) idsToDelete.push(pairIncome.id);
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
      saveTransaction(transactionUpdates, idsToDelete, { skipRules: true });
      toast.success(`Updated category for ${transactionUpdates.length} transaction${transactionUpdates.length !== 1 ? 's' : ''}`);
    }

    setIsCategorizeModalOpen(false);
    setSelectedIds(new Set());
  };

  const handleSaveBulkEdits = (updatedTransactions: Transaction[], idsToDelete: string[] = []) => {
    saveTransaction(updatedTransactions, idsToDelete, { skipRules: true });
    setBulkEditModalOpen(false);
    setSelectedIds(new Set());
    toast.success(`Updated ${updatedTransactions.length} transaction${updatedTransactions.length !== 1 ? 's' : ''}`);
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
        amount: safeRound(Math.abs(original.amount), 2).toFixed(2),
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

  const handleOpenOverview = useCallback((tx: DisplayTransaction | Transaction) => {
    const targetId = ('isTransfer' in tx && tx.isTransfer) ? ((tx as any).originalId || tx.id) : tx.id;
    const originalTx = transactions.find(t => t.id === targetId) || (tx as Transaction);
    if (originalTx?.transferId) {
      const pair = transactions.filter(t => t.transferId === originalTx.transferId);
      setOverviewTransactions(pair.length > 0 ? pair : [originalTx]);
    } else if (originalTx) {
      setOverviewTransactions([originalTx]);
    }
    setIsOverviewModalOpen(true);
  }, [transactions]);

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

  const handleClearLocation = useCallback((tx: DisplayTransaction) => {
    const original = transactions.find(t => t.id === (tx.isTransfer ? tx.originalId : tx.id));
    if (!original) return;

    const clearedFields = {
      address: undefined,
      placeName: undefined,
      street: undefined,
      city: undefined,
      postalCode: undefined,
      state: undefined,
      country: undefined,
      latitude: undefined,
      longitude: undefined,
      locationLabel: undefined,
    };

    if (tx.isTransfer && original.transferId) {
      const pair = transactions.filter(t => t.transferId === original.transferId);
      const updates = pair.map(p => ({
        ...p,
        ...clearedFields
      }));
      saveTransaction(updates, []);
    } else {
      saveTransaction([{
        ...original,
        ...clearedFields
      }], []);
    }
  }, [transactions, saveTransaction]);

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
      toast.info("No transactions to export.");
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
        tags: rest.tagIds?.map(tid => tags.find(t => t.id === tid)?.name).join(' | ') || ''
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
      if (!loc.hasLocation || !loc.city) return;
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

  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });
  const [visibleCount, setVisibleCount] = useState(LEDGER_BATCH);

  useEffect(() => {
    setVisibleCount(LEDGER_BATCH);
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
        const locA = formatTransactionLocation(a, user);
        const locB = formatTransactionLocation(b, user);
        const cityA = locA.hasLocation ? locA.city : '';
        const cityB = locB.hasLocation ? locB.city : '';
        cmp = cityA.localeCompare(cityB);
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

  const paginatedItems = useMemo(() => displayItemsWithSubs.slice(0, visibleCount), [displayItemsWithSubs, visibleCount]);

  // Group current page items by date
  const tableRenderItems = useMemo<LedgerItem[]>(() => {
    const items: LedgerItem[] = [];
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

        items.push({
          isGroupHeader: true,
          id: `group-hdr-${currentDate}`,
          date: currentDate,
          formattedDate: formatDateHeader(currentDate),
          count: currentGroupTxs.length,
          totalEur,
          groupTxIds,
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
  }, [paginatedItems, formatDateHeader, resolveTransferDisplay]);

  const handleHeaderSort = useCallback((column: string) => {
    setSortDescriptor(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
      }
      return { column, direction: 'ascending' };
    });
  }, []);

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

  const menuFor = (tx: DisplayTransaction): MenuAction[] => {
    const original = transactions.find(t => t.id === (tx.isTransfer ? tx.originalId : tx.id)) ?? null;
    const isPart = !!tx.parentTransactionId;
    const parent = isPart ? transactions.find(t => t.id === tx.parentTransactionId) : undefined;
    const items: MenuAction[] = [{ id: 'edit', label: 'Edit', icon: 'edit', onAction: () => { setEditingTransaction(original); setTransactionModalOpen(true); } }];
    if (tx.isSplitParent || (isPart && parent?.isSplitParent)) items.push({ id: 'unsplit', label: 'Unsplit', icon: 'call_merge', onAction: () => handleUnsplit(tx) });
    if (tx.isCombinedParent || (isPart && parent?.isCombinedParent)) items.push({ id: 'uncombine', label: 'Uncombine', icon: 'call_split', onAction: () => handleUncombine(tx) });
    if (!tx.isSplitParent && !tx.isCombinedParent && !isPart && !tx.isTransfer) items.push({ id: 'split', label: 'Split', icon: 'splitscreen', onAction: () => { setTransactionToSplit(original); setIsSplitModalOpen(true); } });
    items.push(
      { id: 'duplicate', label: 'Duplicate', icon: 'content_copy', onAction: () => handleDuplicate(tx) },
      { id: 'recurring', label: 'Make recurring', icon: 'repeat', isDisabled: tx.isTransfer, onAction: () => handleMakeRecurring(tx) },
    );
    if (tx.city || tx.country) items.push({ id: 'location', label: 'Remove location', icon: 'location_off', onAction: () => handleClearLocation(tx) });
    items.push({ id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => { setSelectedIds(new Set([tx.id])); setIsDeleteConfirmOpen(true); } });
    return items;
  };

  const toggleOne = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleGroup = (ids: string[]) => setSelectedIds(prev => {
    const next = new Set(prev);
    const isAll = ids.every(id => prev.has(id));
    ids.forEach(id => { if (isAll) next.delete(id); else next.add(id); });
    return next;
  });

  const accountOf = (tx: DisplayTransaction) => {
    const account = accountMapByName[tx.accountName || ''] || accountMap[tx.accountId];
    return {
      name: account?.name || tx.accountName || (tx.isTransfer ? `${tx.fromAccountName} to ${tx.toAccountName}` : 'Unknown'),
      detail: account ? (account.last4 ? `•••• ${account.last4}` : account.type) : undefined,
    };
  };

  const locationOf = (tx: DisplayTransaction) => {
    const location = formatTransactionLocation(tx, user);
    return location.hasLocation && location.city ? `${location.flag} ${location.city}` : null;
  };

  const logoOf = (tx: DisplayTransaction) => {
    const key = normalizeMerchantKey(tx.merchant);
    return key ? merchantLogoUrls[key] ?? null : null;
  };

  const topCategories = useMemo(() => {
    const totals = new Map<string, number>();
    filteredTransactions.forEach(tx => {
      if (tx.isTransfer || tx.type !== 'expense') return;
      totals.set(tx.category || 'Uncategorised', (totals.get(tx.category || 'Uncategorised') ?? 0) + Math.abs(convertToEur(tx.amount, tx.currency)));
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredTransactions]);

  if (urlTab === 'review') return <ReviewQueue />;

  const money = (value: number, tone: 'flow' | 'plain' = 'plain') => <Amount value={value} currency="EUR" tone={tone} />;
  const checkList = (options: { value: string; label: string }[], selected: string[], onToggle: (value: string) => void) => (
    <div className="flex max-h-64 min-w-48 flex-col gap-1 overflow-y-auto">
      {options.length === 0 && <p className="type-body text-muted">Nothing to choose from yet.</p>}
      {options.map(option => <Checkbox key={option.value} isSelected={selected.includes(option.value)} onChange={() => onToggle(option.value)}>{option.label}</Checkbox>)}
    </div>
  );

  const filterSections = [
    {
      id: 'type', label: 'Type', count: typeFilter !== 'all' ? 1 : 0,
      content: (
        <RadioGroup label="Show" value={typeFilter} onChange={value => setTypeFilter(value as typeof typeFilter)}>
          {TYPE_FILTER_OPTIONS.map(option => <Radio key={option.value} value={option.value}>{option.label}</Radio>)}
        </RadioGroup>
      ),
    },
    { id: 'accounts', label: 'Accounts', count: selectedAccountIds.length, content: checkList(accounts.map(account => ({ value: account.id, label: account.name })), selectedAccountIds, handleAccountToggle) },
    { id: 'categories', label: 'Categories', count: selectedCategoryNames.length, content: checkList(categoryOptions, selectedCategoryNames, handleCategoryToggle) },
    { id: 'tags', label: 'Tags', count: selectedTagIds.length, content: checkList(tagOptions, selectedTagIds, handleTagToggle) },
    {
      id: 'merchant', label: 'Merchant', count: merchantFilter ? 1 : 0,
      content: <TextInput label="Merchant" value={merchantFilter} onChange={setMerchantFilter} className="w-56 max-md:w-full" />,
    },
    {
      id: 'location', label: 'Location', count: selectedLocations.length,
      content: (
        <div className="space-y-2">
          <TextInput label="Find a place" value={locationSearch} onChange={setLocationSearch} className="w-56 max-md:w-full" />
          {checkList(filteredLocationOptions.map(option => ({ value: option.city, label: `${option.flag} ${option.city}` })), selectedLocations, handleLocationToggle)}
        </div>
      ),
    },
    {
      id: 'dates', label: 'Dates', count: (startDate ? 1 : 0) + (endDate ? 1 : 0),
      content: (
        <div className="grid w-64 gap-3 max-md:w-full">
          <DateInput label="From" value={startDate} onChange={setStartDate} />
          <DateInput label="To" value={endDate} onChange={setEndDate} />
        </div>
      ),
    },
    {
      id: 'amount', label: 'Amount', count: (minAmount ? 1 : 0) + (maxAmount ? 1 : 0),
      content: (
        <div className="grid w-56 gap-3 max-md:w-full">
          <AmountInput label="At least" currency="EUR" value={minAmount} onChange={setMinAmount} />
          <AmountInput label="At most" currency="EUR" value={maxAmount} onChange={setMaxAmount} />
        </div>
      ),
    },
  ];

  const search = (
    <div className="relative min-w-0 flex-1 md:max-w-xs">
      <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={searchInputRef}
        type="search"
        aria-label="Search transactions"
        placeholder="Search"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className={cn(controlStyles, 'h-10 pl-10 pr-3 text-[.9375rem] max-md:h-12 max-md:text-base')}
      />
    </div>
  );

  const filterChip = (label: string, count: number) => (
    <AriaButton className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[.8125rem] font-bold text-ink pointer-coarse:h-11', count ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface hover:bg-inset')}>
      {label}
      {count > 0 && <CountPill count={count} />}
    </AriaButton>
  );

  const selectionMore: MenuAction[] = [
    { id: 'combine', label: 'Combine', icon: 'merge_type', isDisabled: !canCombine, onAction: handleOpenCombineModal },
    { id: 'split', label: 'Split', icon: 'splitscreen', isDisabled: !canSplit, onAction: handleOpenSplitModal },
    { id: 'unsplit', label: 'Unsplit', icon: 'call_merge', isDisabled: !canUnsplit, onAction: () => handleUnsplit() },
    { id: 'uncombine', label: 'Uncombine', icon: 'call_split', isDisabled: !canUncombine, onAction: () => handleUncombine() },
    { id: 'recurring', label: 'Make recurring', icon: 'repeat', isDisabled: selectedIds.size !== 1, onAction: () => handleMakeRecurring() },
    ...(isMobile ? [{ id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: handleOpenDeleteModal }] : []),
  ];
  const deleteLabel = `Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'transaction' : 'transactions'}`;
  const clearSelection = () => { setSelectedIds(new Set()); setSelecting(false); };

  const summary = (
    <aside aria-label="This view at a glance" className="space-y-4 rounded-[var(--radius-xl)] border border-line bg-surface p-5">
      <h2 className="type-card-title text-ink">This view</h2>
      <dl className="space-y-2">
        <div className="flex justify-between gap-3"><dt className="type-body text-muted">Transactions</dt><dd className="type-figure-row text-ink">{filteredTransactions.length.toLocaleString()}</dd></div>
        <div className="flex justify-between gap-3"><dt className="type-body text-muted">Income</dt><dd className="type-figure-row text-ink">{money(totalIncome, 'flow')}</dd></div>
        <div className="flex justify-between gap-3"><dt className="type-body text-muted">Spending</dt><dd className="type-figure-row text-ink">{money(-Math.abs(totalExpense))}</dd></div>
        <div className="flex justify-between gap-3 border-t border-line pt-2"><dt className="type-body-strong text-ink">Net</dt><dd className="type-figure-row text-ink">{money(netFlow, 'flow')}</dd></div>
      </dl>
      {topCategories.length > 0 && (
        <div>
          <h3 className="type-label mb-1.5 text-muted">Most spent on</h3>
          <ul className="space-y-1">
            {topCategories.map(([name, value]) => (
              <li key={name} className="type-body flex justify-between gap-3 text-ink">
                <span className="min-w-0 truncate">{name}</span>
                <span className="type-figure-row shrink-0">{money(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );

  return (
    <div className="space-y-4">
      {isTransactionModalOpen && (
        <AddTransactionModal
          onClose={handleCloseModal}
          onSave={(toSave, toDelete) => { saveTransaction(toSave, toDelete); handleCloseModal(); }}
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
      {isOverviewModalOpen && (
        <TransactionDetailModal
          isOpen={isOverviewModalOpen}
          onClose={() => setIsOverviewModalOpen(false)}
          transactions={overviewTransactions}
          accounts={accounts}
          tags={tags}
          allCategories={allCategories}
          onEdit={tx => { setIsOverviewModalOpen(false); setEditingTransaction(tx); setTransactionModalOpen(true); }}
          onDelete={tx => { setIsOverviewModalOpen(false); deleteTransactions([tx.id]); }}
        />
      )}
      {isRecurringModalOpen && saveRecurringTransaction && (
        <RecurringTransactionModal
          onClose={() => setIsRecurringModalOpen(false)}
          onSave={data => { saveRecurringTransaction(data); setIsRecurringModalOpen(false); setSelectedIds(new Set()); }}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          recurringTransactionToEdit={transactionToMakeRecurring}
        />
      )}
      {isCategorizeModalOpen && <BulkCategorizeModal onClose={() => setIsCategorizeModalOpen(false)} onSave={handleSaveBulkCategory} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />}
      {isSplitModalOpen && transactionToSplit && <SplitTransactionModal onClose={() => { setIsSplitModalOpen(false); setTransactionToSplit(null); }} onSave={handleSaveSplits} transaction={transactionToSplit} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />}
      {isCombineModalOpen && <CombineTransactionsModal onClose={() => { setIsCombineModalOpen(false); setTransactionsToCombine([]); }} onSave={handleSaveCombine} transactionsToCombine={transactionsToCombine} incomeCategories={incomeCategories} expenseCategories={expenseCategories} accounts={accounts} />}
      {isBulkEditModalOpen && <BulkEditTransactionsModal isOpen={isBulkEditModalOpen} onClose={() => setBulkEditModalOpen(false)} onSave={handleSaveBulkEdits} transactionsToEdit={selectedTransactions} allTransactions={transactions} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} tags={tags} />}
      <Dialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title={`${deleteLabel}?`} description="You can undo this right after.">
        <HoldButton block label={deleteLabel} onConfirm={handleConfirmBulkDelete} />
      </Dialog>

      <PageHeader
        title="Transactions"
        subtitle={isMobile ? undefined : `${filteredTransactions.length.toLocaleString()} shown`}
        actions={!isMobile ? (
          <>
            <Button variant="secondary" icon="download" onPress={handleExport}>Export</Button>
            <Button icon="add" onPress={handleOpenAddModal}>Add transaction</Button>
          </>
        ) : isSelecting
          ? <Button variant="ghost" onPress={clearSelection}>Done</Button>
          : <Button variant="ghost" onPress={() => setSelecting(true)}>Select</Button>}
      />

      {isMobile ? (
        <>
          <div className="flex items-center gap-2">
            {search}
            <Popover title="Filters" trigger={filterChip('Filter', activeFilterCount)}>
              <div className="space-y-5">
                {filterSections.map(section => (
                  <section key={section.id}>
                    {section.id !== 'type' && section.id !== 'merchant' && <h3 className="type-label mb-1.5 text-ink">{section.label}</h3>}
                    {section.content}
                  </section>
                ))}
                <Select label="Sort by" options={LEDGER_SORTS} value={sortBy} onChange={handleSortBySelect} />
                {activeFilterCount > 0 && <Button variant="ghost" block onPress={clearFilters}>Clear filters</Button>}
              </div>
            </Popover>
          </div>
          <p className="type-body text-muted">In {money(totalIncome, 'flow')}, out {money(-Math.abs(totalExpense))}</p>
        </>
      ) : (
        <>
          <TransactionScatter transactions={filteredTransactions} onOpen={handleOpenOverview} />
          <div className="flex flex-wrap items-center gap-2">
            {search}
            {filterSections.map(section => (
              <Popover key={section.id} title={section.label} trigger={filterChip(section.label, section.count)}>
                {section.content}
              </Popover>
            ))}
            {activeFilterCount > 0 && <Button variant="ghost" size="sm" onPress={clearFilters}>Clear</Button>}
            <div className="ml-auto">
              <SegmentedControl items={[{ id: 'default', label: 'Comfortable' }, { id: 'high', label: 'Compact' }]} activeId={density} onChange={id => setDensity(id as typeof density)} />
            </div>
          </div>
        </>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {tableRenderItems.length > 0 ? (
            <LedgerTable
              items={tableRenderItems}
              isPhone={isMobile}
              isCompact={density === 'high'}
              selectedIds={selectedIds}
              isSelecting={isSelecting || selectedIds.size > 0}
              sort={sortDescriptor as LedgerSort}
              onSort={handleHeaderSort}
              onToggle={toggleOne}
              onToggleGroup={toggleGroup}
              onOpen={handleOpenOverview}
              onCategorise={tx => { setSelectedIds(new Set([tx.id])); setIsCategorizeModalOpen(true); }}
              onExpand={id => toggleExpandParent(id)}
              onStartSelecting={id => { setSelecting(true); toggleOne(id); }}
              amountOf={resolveTransferDisplay}
              accountOf={accountOf}
              locationOf={locationOf}
              logoOf={logoOf}
              menuFor={menuFor}
              categories={allCategories}
              tags={tags}
            />
          ) : (
            <EmptyState
              icon="search"
              title={transactions.length ? 'Nothing matches' : 'No transactions yet'}
              description={transactions.length ? 'Try fewer filters.' : 'Add one, or connect a bank in Settings.'}
              actionLabel={transactions.length ? 'Clear filters' : 'Add transaction'}
              onAction={transactions.length ? clearFilters : handleOpenAddModal}
            />
          )}
          <ShowMore remaining={displayItemsWithSubs.length - visibleCount} onPress={() => setVisibleCount(count => count + LEDGER_BATCH)} />
        </div>
        {!isMobile && <div className="xl:sticky xl:top-0">{summary}</div>}
      </div>

      {selectedIds.size > 0 && !isCategorizeModalOpen && (
        <SelectionBar count={selectedIds.size} onClear={clearSelection}>
          <Button size="sm" variant="ghost" onPress={handleOpenCategorizeModal}>Categorise</Button>
          <Button size="sm" variant="ghost" onPress={() => setBulkEditModalOpen(true)}>Edit</Button>
          <Menu title="More actions" placement="top" trigger={<IconButton icon="more_horiz" label="More actions" />} items={selectionMore} />
          {!isMobile && <HoldButton label={deleteLabel} onConfirm={handleConfirmBulkDelete} />}
        </SelectionBar>
      )}
    </div>
  );
};

export default Transactions;
