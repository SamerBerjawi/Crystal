import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Transaction, Account, DisplayTransaction, RecurringTransaction, MerchantRule, User } from '../types';
import { parseLocalDate, getMainCurrency } from '../utils';
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
import { buildEffectiveMerchantLogoOverrides, getAccountBrandfetchUrl, getMerchantLogoUrl, isCashAccount, normalizeMerchantKey } from '../utils/brandfetch';
import PageHeader from '../components/PageHeader';
import { Button as AriaButton } from 'react-aria-components';
import Icon from '../components/ui/Icon';
import { Button, HoldButton, IconButton, SelectionBar } from '../components/ui/Actions';
import { CountPill, ShowMore } from '../components/ui/Display';
import { controlStyles } from '../components/ui/Fields';
import { Menu, type MenuAction } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { Dialog, Popover } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import { EmptyState } from '../components/ui/States';
import SegmentedControl from '../components/ui/SegmentedControl';
import LedgerTable, { type LedgerSort, type TableCellFilter } from '../components/LedgerTable';
import ReviewQueue from '../components/ReviewQueue';
import TransactionScatter, { type ScatterBrush } from '../components/TransactionScatter';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useUrlTab } from '../hooks/useUrlTab';
import { cn } from '../lib/utils';
import type { SortDescriptor } from 'react-aria-components';
import { formatTransactionLocation } from '../utils/locationFormat';
import {
  buildCategoryColorMap,
  buildDisplayItemsWithSubs,
  buildDisplayTransactions,
  buildLedgerTableRenderItems,
  computeLedgerSummaryTotals,
  filterAndSortScatterTransactions,
  indexDisplayTransactions,
  sortLedgerTransactions,
} from '../utils/transactionsLedgerModel';
import { useTransactionLedgerActions } from '../hooks/useTransactionLedgerActions';
import { useTransactionFilterOptions } from '../hooks/useTransactionFilterOptions';

interface TransactionsProps {
  user?: User;
  initialAccountFilter?: string | null;
  initialTagFilter?: string | null;
  onClearInitialFilters?: () => void;
  onSyncBanks?: () => void;
  isSyncingBanks?: boolean;
}

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

const EMPTY_OBJECT = {};

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

const LedgerView: React.FC<TransactionsProps> = ({ user, initialAccountFilter, initialTagFilter, onClearInitialFilters }) => {
  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { saveRecurringTransaction } = useScheduleContext();
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || EMPTY_OBJECT);
  const merchantRules = usePreferencesSelector(p => p.merchantRules || EMPTY_OBJECT) as Record<string, MerchantRule>;
  const showBalanceAdjustments = usePreferencesSelector(p => p.showBalanceAdjustments ?? true);
  const appliedInitialFiltersRef = useRef<{ account: string | null; tag: string | null } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [sortBy, setSortBy] = useState('date-desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('');

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isSelecting, setSelecting] = useState(false);

  useEffect(() => {
    const nextAccount = initialAccountFilter ?? null;
    const nextTag = initialTagFilter ?? null;
    if (!nextAccount && !nextTag) return;

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

  const activeFilterCount = useMemo(() => (
    (selectedAccountIds.length > 0 ? 1 : 0) +
    (selectedCategoryNames.length > 0 ? 1 : 0) +
    (selectedTagIds.length > 0 ? 1 : 0) +
    (selectedLocations.length > 0 ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (startDate || endDate ? 1 : 0) +
    (minAmount || maxAmount ? 1 : 0) +
    (merchantFilter ? 1 : 0)
  ), [
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
  const [duplicateData, setDuplicateData] = useState<any>(null);
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc; return map; }, {} as Record<string, Account>), [accounts]);
  const accountMapByName = useMemo(() => accounts.reduce((map, acc) => { map[acc.name] = acc; return map; }, {} as Record<string, Account>), [accounts]);

  const { transactionById, transactionsByTransferId, childrenByParentId } = useMemo(() => {
    const byId = new Map<string, Transaction>();
    const byTransferId = new Map<string, Transaction[]>();
    const byParentId = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      byId.set(tx.id, tx);
      if (tx.transferId) {
        const list = byTransferId.get(tx.transferId);
        if (list) list.push(tx);
        else byTransferId.set(tx.transferId, [tx]);
      }
      if (tx.parentTransactionId) {
        const children = byParentId.get(tx.parentTransactionId);
        if (children) children.push(tx);
        else byParentId.set(tx.parentTransactionId, [tx]);
      }
    }
    return { transactionById: byId, transactionsByTransferId: byTransferId, childrenByParentId: byParentId };
  }, [transactions]);

  const parentCategoryByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const parent of allCategories) {
      map.set(parent.name, parent.name);
      for (const sub of parent.subCategories ?? []) {
        map.set(sub.name, parent.name);
      }
    }
    return map;
  }, [allCategories]);

  const effectiveMerchantLogoOverrides = useMemo(
    () => buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules),
    [merchantLogoOverrides, merchantRules],
  );

  const merchantLogoUrls = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      const rawName = (tx.merchant && tx.merchant.toLowerCase() !== 'internal transfer' ? tx.merchant : '')
        || (tx as DisplayTransaction).toAccountName
        || (tx as DisplayTransaction).fromAccountName
        || tx.merchant
        || tx.description
        || '';
      const cleanName = rawName.replace(/^Transfer\s+(to|from)\s+/i, '').trim();
      const key = normalizeMerchantKey(cleanName);
      if (!key || acc[key]) return acc;
      const url = getMerchantLogoUrl(cleanName, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 96, height: 96 });
      if (url) acc[key] = url;
      return acc;
    }, {} as Record<string, string>);
  }, [brandfetchClientId, effectiveMerchantLogoOverrides, transactions]);

  const displayTransactions = useMemo(
    () => buildDisplayTransactions(transactions, accountMap, accounts),
    [transactions, accountMap, accounts],
  );

  const indexedTransactions = useMemo(
    () => indexDisplayTransactions(displayTransactions),
    [displayTransactions],
  );

  const scatterTransactions = useMemo(
    () => filterAndSortScatterTransactions({
      indexedTransactions,
      debouncedSearchTerm,
      merchantFilter,
      minAmount,
      maxAmount,
      selectedAccountIds,
      accountMapByName,
      typeFilter,
      startDate,
      endDate,
      selectedTagIds,
      selectedCategoryNames,
      parentCategoryByName,
      selectedLocations,
      user,
      showBalanceAdjustments,
      sortBy,
    }),
    [
      debouncedSearchTerm, sortBy, typeFilter, startDate, endDate, indexedTransactions,
      selectedAccountIds, selectedCategoryNames, selectedTagIds, selectedLocations,
      minAmount, maxAmount, parentCategoryByName, accountMapByName, merchantFilter,
      showBalanceAdjustments, user,
    ],
  );

  const [brush, setBrush] = useState<ScatterBrush | null>(null);
  const filteredTransactions = useMemo(
    () => (brush ? scatterTransactions.filter(tx => tx.date.slice(0, 10) >= brush.from && tx.date.slice(0, 10) <= brush.to) : scatterTransactions),
    [scatterTransactions, brush],
  );

  const categoryColors = useMemo(() => buildCategoryColorMap(allCategories), [allCategories]);

  const toggleExpandParent = useCallback((parentId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedParentIds(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  const { totalIncome, totalExpense, netFlow, topCategories } = useMemo(
    () => computeLedgerSummaryTotals(filteredTransactions),
    [filteredTransactions],
  );

  const resolveTransferDisplay = useCallback((tx: DisplayTransaction) => {
    if (!tx.isTransfer) {
      return { amount: tx.amount, currency: tx.currency };
    }
    const expenseAmount = tx.transferExpenseAmount ?? Math.abs(tx.amount);
    const expenseCurrency = tx.transferExpenseCurrency ?? tx.currency;
    const incomeAmount = tx.transferIncomeAmount ?? expenseAmount;
    const incomeCurrency = tx.transferIncomeCurrency ?? expenseCurrency;

    const fromAccId = tx.fromAccountId || accountMapByName[tx.fromAccountName || '']?.id;
    const toAccId = tx.toAccountId || accountMapByName[tx.toAccountName || '']?.id;
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

  const {
    selectedTransactions,
    canCombine,
    canSplit,
    canUnsplit,
    canUncombine,
    handleOpenCategorizeModal,
    handleOpenCombineModal,
    handleOpenSplitModal,
    handleSaveSplits,
    handleSaveCombine,
    handleUnsplit,
    handleUncombine,
    handleSaveBulkCategory,
    handleSaveBulkEdits,
    handleOpenDeleteModal,
    handleConfirmBulkDelete,
    handleOpenAddModal,
    handleCloseModal,
    handleDuplicate,
    handleOpenOverview,
    handleMakeRecurring,
    handleExport,
    menuFor,
  } = useTransactionLedgerActions({
    transactions,
    displayTransactions,
    filteredTransactions,
    allCategories,
    tags,
    selectedIds,
    setSelectedIds,
    transactionById,
    transactionsByTransferId,
    childrenByParentId,
    saveTransaction,
    deleteTransactions,
    resolveTransferDisplay,
    setExpandedParentIds,
    setIsSplitModalOpen,
    setTransactionToSplit,
    setIsCombineModalOpen,
    setTransactionsToCombine,
    setIsCategorizeModalOpen,
    setBulkEditModalOpen,
    setIsDeleteConfirmOpen,
    setEditingTransaction,
    setDuplicateData,
    setTransactionModalOpen,
    setOverviewTransactions,
    setIsOverviewModalOpen,
    setTransactionToMakeRecurring,
    setIsRecurringModalOpen,
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAccountIds([]);
    setSelectedCategoryNames([]);
    setSelectedTagIds([]);
    setSelectedLocations([]);
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date-desc');
    setMerchantFilter('');
  };

  const handleAccountToggle = useCallback((id: string) => {
    setSelectedAccountIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const handleCategoryToggle = useCallback((name: string) => {
    setSelectedCategoryNames(prev => (prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]));
  }, []);

  const handleLocationToggle = useCallback((city: string) => {
    setSelectedLocations(prev => (prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]));
  }, []);

  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'date',
    direction: 'descending',
  });
  const [visibleCount, setVisibleCount] = useState(LEDGER_BATCH);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(LEDGER_BATCH);
  }, [debouncedSearchTerm, typeFilter, startDate, endDate, minAmount, maxAmount, merchantFilter, selectedAccountIds, selectedCategoryNames, selectedTagIds, selectedLocations]);

  const sortedTransactions = useMemo(
    () => sortLedgerTransactions(filteredTransactions, sortDescriptor, accountMap, accountMapByName, user),
    [filteredTransactions, sortDescriptor, accountMap, accountMapByName, user],
  );

  const isFilterActive = Boolean(debouncedSearchTerm || merchantFilter || minAmount || maxAmount || selectedLocations.length > 0);
  const displayItemsWithSubs = useMemo(
    () => buildDisplayItemsWithSubs(sortedTransactions, expandedParentIds, isFilterActive),
    [sortedTransactions, expandedParentIds, isFilterActive],
  );

  const paginatedItems = useMemo(() => displayItemsWithSubs.slice(0, visibleCount), [displayItemsWithSubs, visibleCount]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || visibleCount >= displayItemsWithSubs.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(count => Math.min(displayItemsWithSubs.length, count + LEDGER_BATCH));
        }
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, displayItemsWithSubs.length]);

  const tableRenderItems = useMemo(
    () => buildLedgerTableRenderItems(paginatedItems, selectedAccountIds, resolveTransferDisplay),
    [paginatedItems, selectedAccountIds, resolveTransferDisplay],
  );

  const handleHeaderSort = useCallback((column: string) => {
    setSortDescriptor(prev => {
      const isSameCol = prev.column === column;
      if (column === 'amount') {
        if (!isSameCol) return { column: 'amount', direction: 'descending' };
        if (prev.direction === 'descending') return { column: 'amount', direction: 'ascending' };
        return { column: 'date', direction: 'descending' };
      }
      if (!isSameCol) return { column, direction: 'ascending' };
      if (prev.direction === 'ascending') return { column, direction: 'descending' };
      return { column: 'date', direction: 'descending' };
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

  const accountOf = useCallback((tx: DisplayTransaction) => {
    if (tx.isTransfer) {
      const fromAcc = (tx.fromAccountId ? accountMap[tx.fromAccountId] : undefined) || (tx.fromAccountName ? accountMapByName[tx.fromAccountName] : undefined);
      const toAcc = (tx.toAccountId ? accountMap[tx.toAccountId] : undefined) || (tx.toAccountName ? accountMapByName[tx.toAccountName] : undefined);
      const fromName = fromAcc?.name || tx.fromAccountName || 'Unknown';
      const toName = toAcc?.name || tx.toAccountName || '?';
      const logoUrl = fromAcc?.imageUrl
        || (fromAcc ? getAccountBrandfetchUrl(fromAcc, brandfetchClientId, effectiveMerchantLogoOverrides) : null)
        || (fromAcc?.financialInstitution ? getMerchantLogoUrl(fromAcc.financialInstitution, brandfetchClientId, effectiveMerchantLogoOverrides) : null);
      return {
        name: `${fromName} → ${toName}`,
        detail: tx.transferLabel ? tx.transferLabel : fromAcc?.type ? `Transfer • ${fromAcc.type}` : 'Transfer',
        logoUrl: logoUrl ?? null,
        isTransfer: true,
        account: fromAcc || toAcc,
      };
    }

    const account = accountMap[tx.accountId] || accountMapByName[tx.accountName || ''];
    const isCash = isCashAccount(account);
    const logoUrl = !isCash ? (account?.imageUrl
      || (account ? getAccountBrandfetchUrl(account, brandfetchClientId, effectiveMerchantLogoOverrides) : null)
      || (account?.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, effectiveMerchantLogoOverrides) : null)) : null;

    return {
      name: account?.name || tx.accountName || 'Unknown',
      detail: account ? (account.last4 ? `•••• ${account.last4}` : account.type) : undefined,
      logoUrl: logoUrl ?? null,
      isTransfer: false,
      account,
    };
  }, [accountMap, accountMapByName, brandfetchClientId, effectiveMerchantLogoOverrides]);

  const filtersFor = useCallback((tx: DisplayTransaction): TableCellFilter[] => {
    const filters: TableCellFilter[] = [];
    if (tx.isTransfer) {
      if (tx.fromAccountName) {
        const acc = accountMapByName[tx.fromAccountName];
        const accId = acc?.id || tx.fromAccountName;
        const isActive = acc ? selectedAccountIds.includes(acc.id) : false;
        filters.push({ kind: 'account', value: accId, label: tx.fromAccountName, icon: 'bank', isActive });
      }
      if (tx.toAccountName && tx.toAccountName !== tx.fromAccountName) {
        const acc = accountMapByName[tx.toAccountName];
        const accId = acc?.id || tx.toAccountName;
        const isActive = acc ? selectedAccountIds.includes(acc.id) : false;
        filters.push({ kind: 'account', value: accId, label: tx.toAccountName, icon: 'bank', isActive });
      }
    } else {
      const acc = accountMapByName[tx.accountName || ''] || accountMap[tx.accountId];
      const accName = acc?.name || tx.accountName;
      if (accName) {
        const accId = acc?.id || accName;
        const isActive = acc ? selectedAccountIds.includes(acc.id) : false;
        filters.push({ kind: 'account', value: accId, label: accName, icon: 'bank', isActive });
      }
    }

    if (!tx.isTransfer && tx.category && tx.category !== 'Uncategorised') {
      const isActive = selectedCategoryNames.includes(tx.category);
      filters.push({ kind: 'category', value: tx.category, label: tx.category, icon: 'pie-chart-01', isActive });
    }

    if (tx.merchant && tx.merchant.trim()) {
      const isActive = merchantFilter.trim().toLowerCase() === tx.merchant.trim().toLowerCase();
      filters.push({ kind: 'merchant', value: tx.merchant.trim(), label: tx.merchant.trim(), icon: 'store-01', isActive });
    }

    const loc = formatTransactionLocation(tx, user);
    if (loc.hasLocation && loc.city) {
      const isActive = selectedLocations.includes(loc.city);
      filters.push({ kind: 'location', value: loc.city, label: loc.city, icon: 'location-01', isActive });
    }

    return filters;
  }, [accountMap, accountMapByName, merchantFilter, selectedAccountIds, selectedCategoryNames, selectedLocations, user]);

  const handleFilterTo = useCallback((filter: TableCellFilter) => {
    switch (filter.kind) {
      case 'account':
        handleAccountToggle(filter.value);
        break;
      case 'category':
        handleCategoryToggle(filter.value);
        break;
      case 'merchant':
        setMerchantFilter(prev => (prev.trim().toLowerCase() === filter.value.toLowerCase() ? '' : filter.value));
        break;
      case 'location':
        handleLocationToggle(filter.value);
        break;
    }
  }, [handleAccountToggle, handleCategoryToggle, handleLocationToggle]);

  const locationOf = (tx: DisplayTransaction) => {
    const location = formatTransactionLocation(tx, user);
    return location.hasLocation && location.city ? `${location.flag} ${location.city}` : null;
  };

  const logoOf = (tx: DisplayTransaction) => {
    const rawName = (tx.merchant && tx.merchant.toLowerCase() !== 'internal transfer' ? tx.merchant : '')
      || tx.toAccountName
      || tx.fromAccountName
      || tx.merchant
      || tx.description
      || '';
    const cleanName = rawName.replace(/^Transfer\s+(to|from)\s+/i, '').trim();
    const key = normalizeMerchantKey(cleanName);
    if (key && merchantLogoUrls[key]) return merchantLogoUrls[key];
    if (key) {
      const directUrl = getMerchantLogoUrl(cleanName, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 96, height: 96 });
      if (directUrl) return directUrl;
    }
    if (tx.isTransfer) {
      const fromAcc = tx.fromAccountName ? accountMapByName[tx.fromAccountName] : undefined;
      const toAcc = tx.toAccountName ? accountMapByName[tx.toAccountName] : undefined;
      const targetAcc = tx.type === 'expense' ? (toAcc || fromAcc) : (fromAcc || toAcc);
      const logoUrl = targetAcc?.imageUrl
        || (targetAcc ? getAccountBrandfetchUrl(targetAcc, brandfetchClientId, effectiveMerchantLogoOverrides) : null)
        || (targetAcc?.financialInstitution ? getMerchantLogoUrl(targetAcc.financialInstitution, brandfetchClientId, effectiveMerchantLogoOverrides) : null);
      if (logoUrl) return logoUrl;
    }
    return null;
  };

  const money = (value: number, tone: 'flow' | 'plain' = 'plain') => <Amount value={value} currency={getMainCurrency()} tone={tone} />;

  const { columnFilters, filterSections } = useTransactionFilterOptions({
    accounts,
    transactions,
    expenseCategories,
    incomeCategories,
    tags,
    user,
    brandfetchClientId,
    effectiveMerchantLogoOverrides,
    searchTerm,
    setSearchTerm,
    merchantFilter,
    setMerchantFilter,
    selectedAccountIds,
    setSelectedAccountIds,
    selectedCategoryNames,
    setSelectedCategoryNames,
    selectedLocations,
    setSelectedLocations,
    selectedTagIds,
    setSelectedTagIds,
    typeFilter,
    setTypeFilter,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  });

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
    { id: 'combine', label: 'Combine', icon: 'git-merge', isDisabled: !canCombine, onAction: handleOpenCombineModal },
    { id: 'split', label: 'Split', icon: 'split', isDisabled: !canSplit, onAction: handleOpenSplitModal },
    { id: 'unsplit', label: 'Unsplit', icon: 'git-merge', isDisabled: !canUnsplit, onAction: () => handleUnsplit() },
    { id: 'uncombine', label: 'Uncombine', icon: 'split', isDisabled: !canUncombine, onAction: () => handleUncombine() },
    { id: 'recurring', label: 'Make recurring', icon: 'repeat-one-01', isDisabled: selectedIds.size !== 1, onAction: () => handleMakeRecurring() },
    ...(isMobile ? [{ id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: handleOpenDeleteModal }] : []),
  ];
  const deleteLabel = `Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'transaction' : 'transactions'}`;
  const clearSelection = () => { setSelectedIds(new Set()); setSelecting(false); };

  const summary = (
    <aside aria-label="This view at a glance" className="flex flex-col justify-between space-y-4 rounded-[var(--radius-xl)] surface-card p-5 h-full">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-card-title text-ink">{brush ? 'Picked days' : 'This view'}</h2>
          {brush && (
            <button type="button" onClick={() => setBrush(null)} className="type-caption inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)]" aria-label="Clear the picked days">
              {brush.from === brush.to ? parseLocalDate(brush.from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : `${parseLocalDate(brush.from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${parseLocalDate(brush.to).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
        <dl className="space-y-2">
          <div className="flex justify-between gap-3"><dt className="type-body text-muted">Transactions</dt><dd className="type-figure-row text-ink">{filteredTransactions.length.toLocaleString()}</dd></div>
          <div className="flex justify-between gap-3"><dt className="type-body text-muted">Income</dt><dd className="type-figure-row text-ink">{money(totalIncome, 'flow')}</dd></div>
          <div className="flex justify-between gap-3"><dt className="type-body text-muted">Spending</dt><dd className="type-figure-row text-ink">{money(-Math.abs(totalExpense))}</dd></div>
          <div className="flex justify-between gap-3 border-t border-line pt-2"><dt className="type-body-strong text-ink">Net</dt><dd className="type-figure-row text-ink">{money(netFlow, 'flow')}</dd></div>
        </dl>
      </div>
      {topCategories.length > 0 && (
        <div className="border-t border-line pt-3">
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
      <TransactionDetailModal
        isOpen={isOverviewModalOpen}
        onClose={() => setIsOverviewModalOpen(false)}
        transactions={overviewTransactions}
        accounts={accounts}
        tags={tags}
        onEdit={tx => { setIsOverviewModalOpen(false); setEditingTransaction(tx); setTransactionModalOpen(true); }}
        onDelete={ids => {
          setIsOverviewModalOpen(false);
          const allIds = new Set(ids);
          ids.forEach(id => {
            (childrenByParentId.get(id) ?? []).forEach(child => allIds.add(child.id));
          });
          deleteTransactions(Array.from(allIds));
        }}
        onDuplicate={tx => {
          setIsOverviewModalOpen(false);
          handleDuplicate(tx as unknown as DisplayTransaction);
        }}
        onMakeRecurring={tx => {
          setIsOverviewModalOpen(false);
          handleMakeRecurring(tx as unknown as DisplayTransaction);
        }}
        onSplit={tx => {
          setIsOverviewModalOpen(false);
          setTransactionToSplit(tx);
          setIsSplitModalOpen(true);
        }}
        onRecategorize={(tx, cat) => {
          saveTransaction([{ ...tx, category: cat }], []);
        }}
        onRemoveLocation={tx => {
          saveTransaction([{
            ...tx,
            latitude: undefined,
            longitude: undefined,
            address: undefined,
            placeName: undefined,
            locationLabel: undefined,
            city: undefined,
            country: undefined,
          }], []);
        }}
      />
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
      {isBulkEditModalOpen && <BulkEditTransactionsModal onClose={() => setBulkEditModalOpen(false)} onSave={handleSaveBulkEdits} transactionsToEdit={selectedTransactions} allTransactions={transactions} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} tags={tags} />}
      <Dialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title={`${deleteLabel}?`} description="You can undo this right after.">
        <HoldButton block label={deleteLabel} onConfirm={handleConfirmBulkDelete} />
      </Dialog>

      <PageHeader
        title="Transactions"
        stats={[
          { label: 'Transactions shown', icon: 'logs', value: filteredTransactions.length },
          { label: 'Money in', icon: 'arrow-down-left-01', value: totalIncome, format: 'money' },
          { label: 'Money out', icon: 'arrow-up-right-01', value: totalExpense, format: 'money' },
        ]}
        actions={!isMobile ? (
          <>
            <Button variant="secondary" icon="download-04" onPress={handleExport}>Export</Button>
            <Button icon="add-01" onPress={handleOpenAddModal}>Add transaction</Button>
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
            <TransactionScatter transactions={scatterTransactions} onOpen={handleOpenOverview} categoryColors={categoryColors} brush={brush} onBrushChange={setBrush} hasDateFilter={!!(startDate || endDate)} />
            {summary}
          </div>
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

      <div className="w-full min-w-0">
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
            filtersFor={filtersFor}
            onFilterTo={handleFilterTo}
            columnFilters={columnFilters}
            categories={allCategories}
            tags={tags}
          />
        ) : (
          <EmptyState
            icon="search-01"
            title={transactions.length ? 'Nothing matches' : 'No transactions yet'}
            description={transactions.length ? 'Try fewer filters.' : 'Add one, or connect a bank in Settings.'}
            actionLabel={transactions.length ? 'Clear filters' : 'Add transaction'}
            onAction={transactions.length ? clearFilters : handleOpenAddModal}
          />
        )}
        <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-px w-full" />
        <ShowMore remaining={displayItemsWithSubs.length - visibleCount} onPress={() => setVisibleCount(count => count + LEDGER_BATCH)} />
      </div>

      {selectedIds.size > 0 && !isCategorizeModalOpen && (
        <SelectionBar count={selectedIds.size} onClear={clearSelection}>
          <Button size="sm" variant="ghost" onPress={handleOpenCategorizeModal}>Categorise</Button>
          <Button size="sm" variant="ghost" onPress={() => setBulkEditModalOpen(true)}>Edit</Button>
          <Menu title="More actions" placement="top" trigger={<IconButton icon="more-horizontal" label="More actions" />} items={selectionMore} />
          {!isMobile && <HoldButton label={deleteLabel} onConfirm={handleConfirmBulkDelete} />}
        </SelectionBar>
      )}
    </div>
  );
};

const Transactions: React.FC<TransactionsProps> = props => {
  const urlTab = useUrlTab();

  if (urlTab === 'review') {
    return <ReviewQueue />;
  }

  return <LedgerView {...props} />;
};

export default Transactions;
