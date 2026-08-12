import React, { useState } from 'react';
import { Transaction, Account, Category, Tag, Currency, DisplayTransaction } from '../types';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import MobileFilterSheet, { FilterTriggerButton } from './MobileFilterSheet';
import FloatingActionButton from './FloatingActionButton';
import PullToRefresh from './PullToRefresh';

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
  onSyncBanks?: () => void;
  isSyncingBanks?: boolean;
  preferredCurrency?: string;
  conversionRates?: any;
}

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
  onSyncBanks,
  isSyncingBanks,
  preferredCurrency = 'EUR',
}) => {
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const curr = preferredCurrency as Currency;

  // Active filter count
  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (selectedAccountIds.length > 0 ? 1 : 0) +
    (selectedCategoryNames.length > 0 ? 1 : 0) +
    (selectedTagIds.length > 0 ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  // Calculate totals
  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const netFlow = totalIncome - totalExpense;

  const handleRefresh = async () => {
    if (onSyncBanks) {
      await onSyncBanks();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const allCategories = [...incomeCategories, ...expenseCategories];
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4 pb-24 animate-fade-in md:hidden relative">
        {/* 1. Mobile Header & Actions */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Financial Registry
            </p>
            <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
              Activity & Transactions
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <FilterTriggerButton
              onClick={() => setShowFilterSheet(true)}
              activeCount={activeFilterCount}
            />

            <button
              onClick={onAddTransaction}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25 flex items-center justify-center active:scale-95 touch-feedback transition-all"
              aria-label="Add Transaction"
            >
              <Icon name="add" className="text-2xl" />
            </button>
          </div>
        </div>

        {/* 2. Quick Net Summary Strip */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md rounded-2xl border border-black/5 dark:border-white/10 shadow-sm text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
              Income
            </p>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 privacy-blur mt-0.5">
              +{formatCurrency(totalIncome, curr)}
            </p>
          </div>

          <div className="border-x border-black/5 dark:border-white/10 px-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
              Expenses
            </p>
            <p className="text-xs font-black text-rose-600 dark:text-rose-400 privacy-blur mt-0.5">
              -{formatCurrency(totalExpense, curr)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
              Net Flow
            </p>
            <p
              className={`text-xs font-black privacy-blur mt-0.5 ${
                netFlow >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(netFlow, curr, { showPlusSign: true })}
            </p>
          </div>
        </div>

        {/* 3. Search Bar & Type Quick Pills */}
        <div className="space-y-2">
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary opacity-50 text-lg pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search merchant, category, note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/10 text-xs font-semibold text-light-text dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
              >
                <Icon name="close" className="text-sm" />
              </button>
            )}
          </div>

          {/* Quick type filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-touch py-0.5">
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
                  className={`touch-feedback px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[34px] border ${
                    isActive
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white/80 dark:bg-dark-card/80 border-black/5 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Transactions Card List (Wrapped in SwipeableRow) */}
        <div className="space-y-2">
          {filteredTransactions.map((tx) => {
            const isExpense = tx.type === 'expense';
            const isIncome = tx.type === 'income';
            const accountName = accountMap.get(tx.accountId) || 'Account';
            const txCurrency = (tx.currency || curr) as Currency;

            return (
              <SwipeableRow
                key={tx.id}
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
                  className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-3.5 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 min-h-[64px] touch-feedback cursor-pointer"
                >
                  {/* Category / Type Icon */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10 ${
                      isExpense
                        ? 'bg-rose-500/10 text-rose-500'
                        : isIncome
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-blue-500/10 text-blue-500'
                    }`}
                  >
                    <Icon
                      name={
                        isExpense
                          ? 'arrow_upward'
                          : isIncome
                          ? 'arrow_downward'
                          : 'sync'
                      }
                      className="text-lg"
                    />
                  </div>

                  {/* Merchant & Details */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-light-text dark:text-white truncate">
                      {tx.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate">
                      <span>{accountName}</span>
                      {tx.category && (
                        <>
                          <span>•</span>
                          <span className="truncate">{tx.category}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{tx.date}</span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <p
                      className={`text-xs font-extrabold privacy-blur ${
                        isExpense
                          ? 'text-rose-600 dark:text-rose-400'
                          : isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {isExpense ? '-' : isIncome ? '+' : ''}
                      {formatCurrency(Math.abs(tx.amount), txCurrency)}
                    </p>
                  </div>
                </div>
              </SwipeableRow>
            );
          })}

          {filteredTransactions.length === 0 && (
            <div className="text-center py-12 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 p-6">
              <Icon name="receipt" className="text-4xl text-gray-400 mb-2" />
              <p className="text-sm font-bold text-light-text dark:text-white">
                No transactions found
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                Try adjusting your search query or filters.
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-3 px-3.5 py-1.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-xs font-bold touch-feedback"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Filter Bottom Sheet */}
        <MobileFilterSheet
          isOpen={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          title="Filter Transactions"
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
              chips: allCategories.slice(0, 12).map((cat) => ({
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
          <div className="space-y-2 pt-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/50">
              Date Range
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold opacity-70 block mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold border border-black/5 dark:border-white/10"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold opacity-70 block mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold border border-black/5 dark:border-white/10"
                />
              </div>
            </div>
          </div>
        </MobileFilterSheet>

        {/* 6. Floating Action Button */}
        <FloatingActionButton onClick={onAddTransaction} label="Add Transaction" />
      </div>
    </PullToRefresh>
  );
};
