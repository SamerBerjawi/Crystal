import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Transaction, Account, Category, Tag, Currency, DisplayTransaction } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import MobileFilterSheet, { FilterTriggerButton } from './MobileFilterSheet';
import PullToRefresh from './PullToRefresh';
import BottomSheet from './BottomSheet';

interface MobileTransactionsViewProps {
  transactions: Transaction[] | DisplayTransaction[];
  filteredTransactions: (Transaction | DisplayTransaction)[];
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  tags: Tag[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  typeFilter: 'all' | 'income' | 'expense' | 'transfer';
  setTypeFilter: (type: 'all' | 'income' | 'expense' | 'transfer') => void;
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  selectedCategoryNames: string[];
  setSelectedCategoryNames: (cats: string[]) => void;
  selectedTagIds: string[];
  setSelectedTagIds: (tags: string[]) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  clearFilters: () => void;
  onAddTransaction: () => void;
  onEditTransaction: (tx: any) => void;
  onDeleteTransaction: (txId: string) => void;
  onCategorizeTransaction?: (tx: any) => void;
  onMakeRecurring?: (tx: any) => void;
  onSplitTransaction?: (tx: any) => void;
  onSyncBanks?: () => void;
  isSyncingBanks?: boolean;
  preferredCurrency?: string;
  conversionRates?: any;
  brandfetchClientId?: string;
  merchantLogoOverrides?: Record<string, string>;
}

const INITIAL_BATCH = 40;

export const MobileTransactionsView: React.FC<MobileTransactionsViewProps> = ({
  transactions,
  filteredTransactions,
  accounts,
  incomeCategories,
  expenseCategories,
  tags,
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
  selectedAccountIds,
  setSelectedAccountIds,
  selectedCategoryNames,
  setSelectedCategoryNames,
  selectedTagIds,
  setSelectedTagIds,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  clearFilters,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onCategorizeTransaction,
  onMakeRecurring,
  onSplitTransaction,
  onSyncBanks,
  isSyncingBanks,
  preferredCurrency = 'EUR',
  brandfetchClientId,
  merchantLogoOverrides,
}) => {
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [selectedDetailTx, setSelectedDetailTx] = useState<DisplayTransaction | null>(null);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});
  const [displayLimit, setDisplayLimit] = useState(INITIAL_BATCH);

  const curr = preferredCurrency as Currency;
  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Reset pagination limit whenever search or filter parameters change
  useEffect(() => {
    setDisplayLimit(INITIAL_BATCH);
  }, [searchTerm, typeFilter, selectedAccountIds, selectedCategoryNames, selectedTagIds, startDate, endDate]);

  // Handle logo error
  const handleLogoError = useCallback((logoUrl: string) => {
    setLogoLoadErrors((prev) => (prev[logoUrl] ? prev : { ...prev, [logoUrl]: true }));
  }, []);

  // Category lookup for icon and color
  const getCategoryMeta = useCallback(
    (catName?: string) => {
      if (!catName) return { icon: 'receipt', color: '#6366f1' };
      const findInList = (list: Category[]): { icon?: string; color?: string } | undefined => {
        for (const cat of list) {
          if (cat.name.toLowerCase() === catName.toLowerCase()) {
            return { icon: cat.icon, color: cat.color };
          }
          if (cat.subCategories && cat.subCategories.length > 0) {
            const sub = findInList(cat.subCategories);
            if (sub) return sub;
          }
        }
        return undefined;
      };

      const found = findInList(allCategories);
      return {
        icon: found?.icon || 'receipt',
        color: found?.color || '#6366f1',
      };
    },
    [allCategories]
  );

  // Active filter count
  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (selectedAccountIds.length > 0 ? 1 : 0) +
    (selectedCategoryNames.length > 0 ? 1 : 0) +
    (selectedTagIds.length > 0 ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  // Calculate overall totals for header metrics across all filtered transactions
  const totalIncome = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === 'income' && !(t as DisplayTransaction).isTransfer && !t.transferId)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [filteredTransactions]
  );

  const totalExpense = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === 'expense' && !(t as DisplayTransaction).isTransfer && !t.transferId)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [filteredTransactions]
  );

  const netFlow = totalIncome - totalExpense;

  const handleRefresh = async () => {
    if (onSyncBanks) {
      await onSyncBanks();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const toggleExpandParent = (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  // Slice transactions for progressive pagination rendering
  const visibleTransactions = useMemo(() => {
    return filteredTransactions.slice(0, displayLimit);
  }, [filteredTransactions, displayLimit]);

  // Group visible transactions by Date for iOS HIG date sections
  const groupedTransactions = useMemo(() => {
    const map: {
      [dateStr: string]: {
        dateStr: string;
        displayTitle: string;
        transactions: DisplayTransaction[];
        dayNet: number;
      };
    } = {};

    visibleTransactions.forEach((rawTx) => {
      const tx = rawTx as DisplayTransaction;
      const rawDate = tx.date;

      if (!map[rawDate]) {
        const parsed = parseLocalDate(rawDate);
        const now = new Date();
        const isToday = parsed.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = parsed.toDateString() === yesterday.toDateString();

        let displayTitle = '';
        if (isToday) {
          displayTitle = 'Today';
        } else if (isYesterday) {
          displayTitle = 'Yesterday';
        } else if (parsed.getFullYear() === now.getFullYear()) {
          displayTitle = parsed.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
        } else {
          displayTitle = parsed.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }

        map[rawDate] = {
          dateStr: rawDate,
          displayTitle,
          transactions: [],
          dayNet: 0,
        };
      }

      map[rawDate].transactions.push(tx);

      if (!tx.isTransfer && !tx.parentTransactionId) {
        if (tx.type === 'income') {
          map[rawDate].dayNet += Math.abs(tx.amount);
        } else if (tx.type === 'expense') {
          map[rawDate].dayNet -= Math.abs(tx.amount);
        }
      }
    });

    return Object.values(map);
  }, [visibleTransactions]);

  // Helper to render merchant avatar / squircle icon
  const renderMerchantAvatar = (tx: DisplayTransaction) => {
    const merchantName = tx.merchant || tx.description || 'Transaction';
    const logoUrl = getMerchantLogoUrl(tx.merchant || tx.description, brandfetchClientId, merchantLogoOverrides, {
      type: 'icon',
      fallback: 'lettermark',
      width: 96,
      height: 96,
    });

    const isLogoValid = logoUrl && !logoLoadErrors[logoUrl];
    const catMeta = getCategoryMeta(tx.category);
    const initial = merchantName.trim().charAt(0).toUpperCase();

    return (
      <div className="relative shrink-0">
        <div
          className="w-11 h-11 rounded-[16px] flex items-center justify-center overflow-hidden border shadow-xs transition-transform shrink-0"
          style={{
            backgroundColor: isLogoValid ? '#ffffff' : `${catMeta.color}18`,
            borderColor: isLogoValid ? 'rgba(255,255,255,0.1)' : `${catMeta.color}30`,
          }}
        >
          {isLogoValid ? (
            <img
              src={logoUrl}
              alt={merchantName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => handleLogoError(logoUrl)}
            />
          ) : catMeta.icon && catMeta.icon !== 'receipt' && catMeta.icon !== 'category' ? (
            <Icon name={catMeta.icon} className="text-xl" style={{ color: catMeta.color }} />
          ) : (
            <span
              className="text-base font-black tracking-wider"
              style={{ color: catMeta.color }}
            >
              {initial}
            </span>
          )}
        </div>

        {/* Badge overlay for special types */}
        {tx.isTransfer && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs border border-white dark:border-gray-900">
            <Icon name="sync" className="text-[10px]" />
          </div>
        )}
        {!tx.isTransfer && tx.recurringSourceId && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-xs border border-white dark:border-gray-900">
            <Icon name="repeat" className="text-[10px]" />
          </div>
        )}
      </div>
    );
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4 pb-20 animate-fade-in md:hidden relative font-sans">
        {/* 1. iOS Large Navigation Title Bar */}
        <div className="sticky top-0 z-20 pt-2 pb-3 bg-light-bg/85 dark:bg-dark-bg/85 backdrop-blur-xl -mx-4 px-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between transition-all">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-black text-light-text dark:text-white tracking-tight">
                Activity
              </h1>
              {isSyncingBanks && (
                <Icon name="sync" className="text-primary-500 animate-spin text-sm" />
              )}
            </div>
            <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <FilterTriggerButton
              onClick={() => setShowFilterSheet(true)}
              activeCount={activeFilterCount}
            />

            <button
              onClick={onAddTransaction}
              className="w-10 h-10 rounded-2xl bg-primary-500 hover:bg-primary-600 active:scale-95 text-white shadow-md shadow-primary-500/25 flex items-center justify-center touch-feedback transition-transform"
              aria-label="Add Transaction"
            >
              <Icon name="add" className="text-xl font-bold" />
            </button>
          </div>
        </div>

        {/* 2. Apple Wallet Style Financial Summary Card */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl rounded-[20px] p-3.5 border border-black/5 dark:border-white/10 shadow-xs relative overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-black/5 dark:divide-white/10 text-center">
            {/* Income */}
            <div className="pr-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                Income
              </p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 privacy-blur mt-0.5">
                +{formatCurrency(totalIncome, curr)}
              </p>
            </div>

            {/* Expenses */}
            <div className="px-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                Spent
              </p>
              <p className="text-sm font-black text-rose-600 dark:text-rose-400 privacy-blur mt-0.5">
                -{formatCurrency(totalExpense, curr)}
              </p>
            </div>

            {/* Net Flow */}
            <div className="pl-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                Net Cash
              </p>
              <p
                className={`text-sm font-black privacy-blur mt-0.5 ${
                  netFlow >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(netFlow, curr, { showPlusSign: true })}
              </p>
            </div>
          </div>
        </div>

        {/* 3. iOS Search Bar & Segmented Control */}
        <div className="space-y-2.5">
          {/* iOS Rounded Search Input */}
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search merchant, category, or note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-9 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/10 text-xs font-semibold text-light-text dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 shadow-xs transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full"
              >
                <Icon name="close" className="text-sm" />
              </button>
            )}
          </div>

          {/* iOS Segmented Pill Controller */}
          <div className="p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'expense', label: 'Expenses' },
              { id: 'income', label: 'Income' },
              { id: 'transfer', label: 'Transfers' },
            ].map((pill) => {
              const isActive = typeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setTypeFilter(pill.id as any)}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all text-center touch-feedback ${
                    isActive
                      ? 'bg-white dark:bg-gray-700 text-light-text dark:text-white shadow-xs font-black'
                      : 'text-light-text-secondary dark:text-dark-text-secondary opacity-70 hover:opacity-100'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Date-Grouped Transaction Cards (Apple HIG Inset Grouping Style) */}
        <div className="space-y-4 pt-1">
          {groupedTransactions.map((group) => {
            const hasGroupNet = group.dayNet !== 0;
            const isNegativeNet = group.dayNet < 0;

            return (
              <div key={group.dateStr} className="space-y-1.5">
                {/* Section Date Header */}
                <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                  <p className="text-[12px] font-bold tracking-tight text-gray-500 dark:text-gray-400">
                    {group.displayTitle}
                  </p>
                  {hasGroupNet && (
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                      {isNegativeNet ? '-' : '+'}
                      {formatCurrency(Math.abs(group.dayNet), curr)}
                    </p>
                  )}
                </div>

                {/* Inset Rounded Card Container */}
                <div className="bg-white dark:bg-dark-card rounded-[22px] border border-black/5 dark:border-white/10 shadow-xs divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
                  {group.transactions.map((tx) => {
                    const isExpense = tx.type === 'expense';
                    const isIncome = tx.type === 'income';
                    const accountObj = accountMap.get(tx.accountId);
                    const accountName =
                      accountObj?.name ||
                      (tx.isTransfer ? tx.fromAccountName || 'Account' : 'Account');
                    const catMeta = getCategoryMeta(tx.category);
                    const isExpanded = expandedParentIds.has(tx.id);

                    return (
                      <React.Fragment key={tx.id}>
                        <SwipeableRow
                          leftActions={
                            onCategorizeTransaction
                              ? [
                                  {
                                    icon: 'category',
                                    bgClass: 'bg-indigo-500',
                                    label: 'Category',
                                    onAction: () => onCategorizeTransaction(tx),
                                  },
                                ]
                              : []
                          }
                          rightActions={[
                            {
                              icon: 'edit',
                              bgClass: 'bg-amber-500',
                              label: 'Edit',
                              onAction: () => onEditTransaction(tx),
                            },
                            {
                              icon: 'delete',
                              bgClass: 'bg-rose-500',
                              label: 'Delete',
                              onAction: () => onDeleteTransaction(tx.id),
                            },
                          ]}
                        >
                          <div
                            onClick={() => onEditTransaction(tx)}
                            className="p-3.5 flex items-center justify-between gap-3 min-h-[64px] bg-white dark:bg-[#18181b] touch-feedback cursor-pointer active:bg-gray-100 dark:active:bg-gray-800/80 transition-colors"
                          >
                            {/* Merchant Avatar */}
                            {renderMerchantAvatar(tx)}

                            {/* Merchant & Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`size-1.5 rounded-full shrink-0 ${
                                    tx.isTransfer
                                      ? 'bg-slate-400 dark:bg-white/80 shadow-xs'
                                      : tx.type === 'income'
                                      ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                                      : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                                  }`}
                                  title={tx.isTransfer ? 'Internal Transfer' : tx.type === 'income' ? 'Income' : 'Expense'}
                                />
                                <p className="text-[14.5px] font-extrabold text-light-text dark:text-white truncate tracking-tight">
                                  {tx.merchant || tx.description}
                                </p>

                                {tx.isSplitParent && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-extrabold uppercase shrink-0 border border-amber-500/20">
                                    Split ({tx.subItemCount})
                                  </span>
                                )}

                                {tx.isCombinedParent && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-extrabold uppercase shrink-0 border border-indigo-500/20">
                                    Combined ({tx.subItemCount})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-75 truncate">
                                <span className="truncate max-w-[90px]">{accountName}</span>
                                <span>•</span>
                                <div className="inline-flex items-center gap-1 truncate max-w-[110px]">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: catMeta.color }}
                                  />
                                  <span className="truncate">{tx.category || 'Uncategorized'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Amount & Sub-toggle */}
                            <div className="text-right shrink-0 flex flex-col items-end">
                              <p
                                className={`text-[14.5px] font-black privacy-blur tracking-tight ${
                                  tx.isTransfer
                                    ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                                    : isExpense
                                    ? 'text-light-text dark:text-white font-extrabold'
                                    : 'text-emerald-600 dark:text-emerald-400 font-black'
                                }`}
                              >
                                {tx.isTransfer ? '' : isExpense ? '-' : isIncome ? '+' : ''}
                                {formatCurrency(Math.abs(tx.amount), (tx.currency || curr) as Currency)}
                              </p>

                              {tx.spareChangeAmount ? (
                                <span className="mt-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                                  <Icon name="savings" className="text-[10px]" />
                                  +{formatCurrency(Math.abs(tx.spareChangeAmount), curr)}
                                </span>
                              ) : tx.subItemCount ? (
                                <button
                                  onClick={(e) => toggleExpandParent(tx.id, e)}
                                  className="mt-0.5 text-[10px] font-bold text-primary-500 inline-flex items-center gap-0.5 hover:underline"
                                >
                                  <span>{isExpanded ? 'Hide' : 'Show'} items</span>
                                  <Icon
                                    name={isExpanded ? 'expand_less' : 'expand_more'}
                                    className="text-xs"
                                  />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </SwipeableRow>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Progressive Pagination Load Button */}
          {filteredTransactions.length > displayLimit && (
            <div className="pt-3 pb-2 text-center">
              <button
                onClick={() => setDisplayLimit((prev) => prev + 40)}
                className="w-full py-3 rounded-2xl bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/10 text-xs font-extrabold text-primary-600 dark:text-primary-400 shadow-xs touch-feedback active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Icon name="expand_more" className="text-base" />
                <span>Show More Activity ({filteredTransactions.length - displayLimit} remaining)</span>
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredTransactions.length === 0 && (
            <div className="text-center py-14 bg-white/70 dark:bg-dark-card/70 backdrop-blur-md rounded-[28px] border border-black/5 dark:border-white/5 p-6 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-gray-400">
                <Icon name="receipt" className="text-2xl" />
              </div>
              <p className="text-sm font-extrabold text-light-text dark:text-white">
                No activity found
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto opacity-70">
                Try adjusting your search criteria or resetting active filters.
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-3 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold touch-feedback active:scale-95 transition-transform"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Apple HIG Filter Sheet */}
        <MobileFilterSheet
          isOpen={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          title="Filter Activity"
          activeCount={activeFilterCount}
          onReset={clearFilters}
          sections={[
            {
              title: 'Transaction Type',
              chips: [
                { id: 'all', label: 'All Types', isActive: typeFilter === 'all', onToggle: () => setTypeFilter('all') },
                { id: 'expense', label: 'Expenses', isActive: typeFilter === 'expense', onToggle: () => setTypeFilter('expense') },
                { id: 'income', label: 'Income', isActive: typeFilter === 'income', onToggle: () => setTypeFilter('income') },
                { id: 'transfer', label: 'Transfers', isActive: typeFilter === 'transfer', onToggle: () => setTypeFilter('transfer') },
              ],
            },
            {
              title: 'Accounts',
              chips: accounts.map((acc) => ({
                id: acc.id,
                label: acc.name,
                isActive: selectedAccountIds.includes(acc.id),
                onToggle: () => {
                  if (selectedAccountIds.includes(acc.id)) {
                    setSelectedAccountIds(selectedAccountIds.filter((id) => id !== acc.id));
                  } else {
                    setSelectedAccountIds([...selectedAccountIds, acc.id]);
                  }
                },
              })),
            },
            {
              title: 'Categories',
              chips: allCategories.slice(0, 16).map((cat) => ({
                id: cat.name,
                label: cat.name,
                isActive: selectedCategoryNames.includes(cat.name),
                onToggle: () => {
                  if (selectedCategoryNames.includes(cat.name)) {
                    setSelectedCategoryNames(selectedCategoryNames.filter((c) => c !== cat.name));
                  } else {
                    setSelectedCategoryNames([...selectedCategoryNames, cat.name]);
                  }
                },
              })),
            },
          ]}
        >
          {/* Custom Date Range Picker */}
          <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/50 font-mono">
              Date Interval
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold opacity-70 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold border border-black/5 dark:border-white/10"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold opacity-70 block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold border border-black/5 dark:border-white/10"
                />
              </div>
            </div>
          </div>
        </MobileFilterSheet>

        {/* 6. Apple HIG Transaction Detail Bottom Sheet */}
        <BottomSheet
          isOpen={!!selectedDetailTx}
          onClose={() => setSelectedDetailTx(null)}
          title="Transaction Details"
        >
          {selectedDetailTx && (
            <div className="p-5 space-y-5">
              {/* Header Visual Hero */}
              <div className="text-center py-2 space-y-2">
                <div className="flex justify-center">{renderMerchantAvatar(selectedDetailTx)}</div>
                <div className="pt-2">
                  <h3 className="text-lg font-black text-light-text dark:text-white tracking-tight">
                    {selectedDetailTx.merchant || selectedDetailTx.description}
                  </h3>
                  <p
                    className={`text-2xl font-black privacy-blur mt-1 tracking-tight ${
                      selectedDetailTx.type === 'income'
                        ? 'text-emerald-500'
                        : selectedDetailTx.isTransfer
                        ? 'text-blue-500'
                        : 'text-light-text dark:text-white'
                    }`}
                  >
                    {selectedDetailTx.isTransfer
                      ? ''
                      : selectedDetailTx.type === 'expense'
                      ? '-'
                      : selectedDetailTx.type === 'income'
                      ? '+'
                      : ''}
                    {formatCurrency(Math.abs(selectedDetailTx.amount), (selectedDetailTx.currency || curr) as Currency)}
                  </p>
                </div>
              </div>

              {/* Information Grid */}
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 divide-y divide-black/5 dark:divide-white/5 space-y-2.5 text-xs font-semibold">
                <div className="flex items-center justify-between pb-2.5">
                  <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    Date & Time
                  </span>
                  <span className="font-extrabold text-light-text dark:text-white">
                    {parseLocalDate(selectedDetailTx.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    Account
                  </span>
                  <span className="font-extrabold text-light-text dark:text-white">
                    {accountMap.get(selectedDetailTx.accountId)?.name || selectedDetailTx.fromAccountName || 'Account'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    Category
                  </span>
                  <div className="inline-flex items-center gap-1.5 font-extrabold text-light-text dark:text-white">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getCategoryMeta(selectedDetailTx.category).color }}
                    />
                    <span>{selectedDetailTx.category || 'Uncategorized'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    Type
                  </span>
                  <span className="capitalize font-extrabold text-light-text dark:text-white">
                    {selectedDetailTx.isTransfer ? 'Account Transfer' : selectedDetailTx.type}
                  </span>
                </div>

                {selectedDetailTx.notes && (
                  <div className="pt-2.5">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-70 block mb-1">
                      Notes
                    </span>
                    <p className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-black/5 dark:border-white/10 font-normal text-xs text-light-text dark:text-white">
                      {selectedDetailTx.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const tx = selectedDetailTx;
                    setSelectedDetailTx(null);
                    setTimeout(() => {
                      onEditTransaction(tx);
                    }, 100);
                  }}
                  className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-light-text dark:text-white text-xs font-bold flex items-center justify-center gap-2 touch-feedback"
                >
                  <Icon name="edit" className="text-base" />
                  <span>Edit</span>
                </button>

                {onCategorizeTransaction && (
                  <button
                    onClick={() => {
                      const tx = selectedDetailTx;
                      setSelectedDetailTx(null);
                      onCategorizeTransaction(tx);
                    }}
                    className="w-full py-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-2 touch-feedback"
                  >
                    <Icon name="category" className="text-base" />
                    <span>Categorize</span>
                  </button>
                )}

                {onMakeRecurring && (
                  <button
                    onClick={() => {
                      const tx = selectedDetailTx;
                      setSelectedDetailTx(null);
                      onMakeRecurring(tx);
                    }}
                    className="w-full py-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center justify-center gap-2 touch-feedback"
                  >
                    <Icon name="repeat" className="text-base" />
                    <span>Make Recurring</span>
                  </button>
                )}

                {onSplitTransaction && !selectedDetailTx.isTransfer && (
                  <button
                    onClick={() => {
                      const tx = selectedDetailTx;
                      setSelectedDetailTx(null);
                      onSplitTransaction(tx);
                    }}
                    className="w-full py-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-2 touch-feedback"
                  >
                    <Icon name="call_split" className="text-base" />
                    <span>Split</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const txId = selectedDetailTx.id;
                    setSelectedDetailTx(null);
                    onDeleteTransaction(txId);
                  }}
                  className="col-span-2 w-full py-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-2 touch-feedback"
                >
                  <Icon name="delete" className="text-base" />
                  <span>Delete Transaction</span>
                </button>
              </div>
            </div>
          )}
        </BottomSheet>
      </div>
    </PullToRefresh>
  );
};
