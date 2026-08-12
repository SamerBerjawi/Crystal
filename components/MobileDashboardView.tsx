import React, { useState, useMemo } from 'react';
import { Account, Transaction, ForecastDuration, Duration, Currency } from '../types';
import MultiAccountFilter from './MultiAccountFilter';
import { TransactionMatcherCard } from './TransactionMatcherCard';
import { SyncedBillMatcherCard } from './SyncedBillMatcherCard';
import Icon from './ui/Icon';
import PullToRefresh from './PullToRefresh';
import FloatingActionButton from './FloatingActionButton';
import MobileFilterSheet from './MobileFilterSheet';
import SwipeableRow from './SwipeableRow';

export type DashboardTab = 'overview' | 'analysis' | 'activity' | 'pending_matches';

interface MobileDashboardViewProps {
  accounts: Account[];
  transactions: Transaction[];
  analyticsAccounts: Account[];
  analyticsTransactions: Transaction[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  duration: Duration;
  setDuration: (duration: Duration) => void;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  tabs: DashboardTab[];
  forecastDuration: ForecastDuration;
  setForecastDuration: (duration: ForecastDuration) => void;
  showForecast: boolean;
  setShowForecast: (show: boolean) => void;
  showGoals: boolean;
  setShowGoals: (show: boolean) => void;
  globalTotalAssets: number;
  globalTotalDebt: number;
  liquidityRatio: number;
  savingsRate: number;
  widgets: any[];
  allWidgets: any[];
  WIDGET_TABS: Record<DashboardTab, string[]>;
  removeWidget: (id: string) => void;
  updateWidgetWidth: (id: string, w: number) => void;
  isEditMode: boolean;
  setIsEditMode: (edit: boolean) => void;
  setIsAddWidgetModalOpen: (open: boolean) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (privacy: boolean) => void;
  formatCurrency: (amount: number, currency: string) => string;
  convertCurrency: (amount: number, from: string, to: string, rates?: any) => number;
  preferredCurrency: string;
  conversionRates?: any;
  handleOpenTransactionModal: () => void;
  isSyncingBanks?: boolean;
  onSyncBanks?: () => void;
  suggestions: any[];
  setIsMatcherModalOpen: (open: boolean) => void;
  dismissAllSuggestions: () => void;
  billSuggestions?: any[];
  setIsBillMatcherModalOpen?: (open: boolean) => void;
  dismissAllBillMatches?: () => void;
  calculateAccountTotals: (accounts: Account[], transactions: Transaction[]) => { totalAssets: number; totalDebt: number; netWorth: number };
  assetAllocationData: any[];
  assetGroups: any;
  liabilityGroups: any;
  FORECAST_DURATION_OPTIONS: { label: string; value: ForecastDuration }[];
  SELECT_WRAPPER_STYLE: string;
  SELECT_STYLE: string;
  SELECT_ARROW_STYLE: string;
}

export const MobileDashboardView: React.FC<MobileDashboardViewProps> = ({
  accounts,
  transactions,
  analyticsAccounts,
  analyticsTransactions,
  selectedAccountIds,
  setSelectedAccountIds,
  duration,
  setDuration,
  activeTab,
  setActiveTab,
  tabs,
  forecastDuration,
  setForecastDuration,
  showForecast,
  setShowForecast,
  showGoals,
  setShowGoals,
  globalTotalAssets,
  globalTotalDebt,
  liquidityRatio,
  savingsRate,
  widgets,
  allWidgets,
  WIDGET_TABS,
  removeWidget,
  isEditMode,
  setIsEditMode,
  setIsAddWidgetModalOpen,
  isPrivacyMode,
  setIsPrivacyMode,
  formatCurrency,
  convertCurrency,
  preferredCurrency,
  conversionRates,
  handleOpenTransactionModal,
  isSyncingBanks,
  onSyncBanks,
  suggestions,
  setIsMatcherModalOpen,
  dismissAllSuggestions,
  billSuggestions = [],
  setIsBillMatcherModalOpen,
  dismissAllBillMatches,
}) => {
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onSyncBanks) {
      await onSyncBanks();
    } else {
      await new Promise(res => setTimeout(res, 800));
    }
  };

  const netWorthEur = globalTotalAssets - Math.abs(globalTotalDebt);
  const netWorthFormatted = formatCurrency(
    convertCurrency(netWorthEur, 'EUR', preferredCurrency, conversionRates),
    preferredCurrency
  );

  const assetsFormatted = formatCurrency(
    convertCurrency(globalTotalAssets, 'EUR', preferredCurrency, conversionRates),
    preferredCurrency
  );

  const debtFormatted = formatCurrency(
    convertCurrency(Math.abs(globalTotalDebt), 'EUR', preferredCurrency, conversionRates),
    preferredCurrency
  );

  // Greeting & Date
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // 1. MoneyCoach Daily Safe-to-Spend & Monthly Cashflow Computation
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - today.getDate() + 1);

  const monthExpenses = useMemo(() => {
    return analyticsTransactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [analyticsTransactions]);

  const monthIncome = useMemo(() => {
    return analyticsTransactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'income' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [analyticsTransactions]);

  const estimatedBudget = monthIncome > 0 ? monthIncome : 3500;
  const remainingForMonth = Math.max(0, estimatedBudget - monthExpenses);
  const dailySafeSpend = remainingForMonth / daysRemaining;
  const budgetSpentPercent = Math.min(100, Math.round((monthExpenses / estimatedBudget) * 100));

  // 2. Top Spending Categories (MoneyCoach style)
  const topCategories = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    analyticsTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = t.category || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(t.amount);
      });

    return Object.entries(categoryTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [analyticsTransactions]);

  // 3. Recent 5 Transactions
  const recentTransactions = useMemo(() => {
    return analyticsTransactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [analyticsTransactions]);

  const activeWidgetsForTab = widgets.filter(w => WIDGET_TABS[activeTab]?.includes(w.id));
  const activeFilterCount = (selectedAccountIds.length > 0 ? 1 : 0) + (duration !== '30D' ? 1 : 0);
  const DURATION_OPTIONS: Duration[] = ['30D', '60D', '90D', '6M', 'YTD', '1Y', 'ALL'];

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-5 pb-24 animate-fade-in relative">
        {/* 1. iOS HIG Header & Salutation */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              {todayDateStr}
            </p>
            <h1 className="text-2xl font-black text-light-text dark:text-white tracking-tight">
              {greeting} ☀️
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-center text-light-text dark:text-white transition-all active:scale-95 touch-feedback"
              aria-label="Toggle Privacy Mode"
            >
              <Icon name={isPrivacyMode ? 'visibility_off' : 'visibility'} className="text-xl" />
            </button>

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center transition-all active:scale-95 touch-feedback shadow-sm border ${
                isEditMode
                  ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/30'
                  : 'bg-white/80 dark:bg-dark-card/80 border-black/5 dark:border-white/10 text-light-text dark:text-white'
              }`}
              aria-label="Customize Layout"
            >
              <Icon name={isEditMode ? 'CheckCircle' : 'Grid01'} className="text-xl" />
            </button>
          </div>
        </div>

        {/* 2. MoneyCoach Glassmorphic Hero Net Worth Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-900 p-6 text-white shadow-xl border border-white/10">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary-500/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -top-12 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between text-xs text-white/70 font-bold tracking-wider uppercase">
              <span className="flex items-center gap-1.5">
                <Icon name="account_balance_wallet" className="text-sm text-primary-400" />
                <span>Net Portfolio Value</span>
              </span>
              <span className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white border border-white/10">
                {preferredCurrency}
              </span>
            </div>

            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white privacy-blur leading-none">
                {netWorthFormatted}
              </h2>
            </div>

            {/* Cashflow Pills Stack */}
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center justify-between bg-emerald-500/15 border border-emerald-500/20 px-3.5 py-2 rounded-2xl text-emerald-400 text-xs font-bold flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon name="arrow_upward" className="text-sm" />
                  <span className="opacity-75 text-[10px]">Assets</span>
                </div>
                <span className="privacy-blur font-extrabold">{assetsFormatted}</span>
              </div>

              <div className="flex items-center justify-between bg-rose-500/15 border border-rose-500/20 px-3.5 py-2 rounded-2xl text-rose-400 text-xs font-bold flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon name="arrow_downward" className="text-sm" />
                  <span className="opacity-75 text-[10px]">Debt</span>
                </div>
                <span className="privacy-blur font-extrabold">{debtFormatted}</span>
              </div>
            </div>

            {/* MoneyCoach Swift Quick Actions Grid */}
            <div className="pt-2 grid grid-cols-4 gap-2 border-t border-white/10 mt-3">
              <button
                onClick={handleOpenTransactionModal}
                className="touch-feedback flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white text-gray-900 font-extrabold min-h-[46px] shadow-md"
              >
                <Icon name="PlusCircle" className="text-lg" />
                <span className="text-[10px] mt-0.5 font-extrabold">Transact</span>
              </button>

              <button
                onClick={() => {
                  if (onSyncBanks) onSyncBanks();
                  else {
                    const syncBtn = document.querySelector('[data-eb-sync-all]');
                    if (syncBtn) (syncBtn as HTMLElement).click();
                  }
                }}
                className="touch-feedback flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold min-h-[46px] border border-white/10"
              >
                <Icon name="sync" className={`text-lg ${isSyncingBanks ? 'animate-spin' : ''}`} />
                <span className="text-[10px] mt-0.5">{isSyncingBanks ? 'Syncing' : 'Sync'}</span>
              </button>

              <button
                onClick={() => setShowFilterSheet(true)}
                className="touch-feedback flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold min-h-[46px] border border-white/10 relative"
              >
                <Icon name="tune" className="text-lg" />
                <span className="text-[10px] mt-0.5">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary-400" />
                )}
              </button>

              <button
                onClick={() => {
                  if (isEditMode) setIsAddWidgetModalOpen(true);
                  else setIsEditMode(true);
                }}
                className="touch-feedback flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold min-h-[46px] border border-white/10"
              >
                <Icon name={isEditMode ? 'PlusSquare' : 'Grid01'} className="text-lg" />
                <span className="text-[10px] mt-0.5">{isEditMode ? 'Add' : 'Widgets'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. MoneyCoach "Daily Safe-to-Spend" & Smart Money Coach Widget */}
        <div className="p-4 rounded-[2rem] bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Icon name="zap" className="text-2xl animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Daily Safe Spend • {daysRemaining} days left
              </p>
              <p className="text-lg font-black text-light-text dark:text-white privacy-blur">
                {formatCurrency(dailySafeSpend, curr)} <span className="text-xs font-semibold opacity-60">/ day</span>
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {budgetSpentPercent}% Spent
            </span>
          </div>
        </div>

        {/* 4. Snap Accounts Horizon Carousel (MoneyCoach Style) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Linked Accounts ({accounts.length})
            </span>
            <span className="text-xs font-bold text-primary-500">Swipe →</span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar snap-scroll-x scroll-touch py-1">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="snap-start shrink-0 w-[170px] p-3.5 rounded-2xl bg-white/90 dark:bg-dark-card/90 border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-[0.98] touch-feedback cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                    <Icon name="account_balance_wallet" className="text-base" />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary">
                    {acc.type}
                  </span>
                </div>

                <p className="text-xs font-bold text-light-text dark:text-white truncate">
                  {acc.name}
                </p>
                <p className="text-xs font-black text-primary-600 dark:text-primary-400 privacy-blur mt-0.5">
                  {formatCurrency(acc.balance, (acc.currency || curr) as Currency)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Top Categories Spending Bar (MoneyCoach visual breakdown) */}
        {topCategories.length > 0 && (
          <div className="p-4 rounded-[2rem] bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                Top Spending Categories
              </span>
              <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                This Period
              </span>
            </div>

            <div className="space-y-2.5">
              {topCategories.map((cat) => {
                const catPercent = monthExpenses > 0 ? Math.round((cat.total / monthExpenses) * 100) : 0;
                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-light-text dark:text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary-500" />
                        <span>{cat.name}</span>
                      </span>
                      <span className="privacy-blur text-light-text-secondary dark:text-dark-text-secondary">
                        {formatCurrency(cat.total, curr)} ({catPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                        style={{ width: `${catPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Recent Activity Feed */}
        {recentTransactions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Recent Transactions
              </span>
            </div>

            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                return (
                  <SwipeableRow key={tx.id}>
                    <div
                      onClick={handleOpenTransactionModal}
                      className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-3 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 min-h-[58px] touch-feedback cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary-500/10 text-primary-500">
                        <Icon name={isExpense ? 'arrow_upward' : 'arrow_downward'} className="text-base" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-light-text dark:text-white truncate">
                          {tx.description}
                        </p>
                        <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate">
                          {tx.category || 'General'} • {tx.date}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs font-black privacy-blur ${
                            isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}{formatCurrency(Math.abs(tx.amount), (tx.currency || curr) as Currency)}
                        </p>
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. Segmented Tab Bar for Dashboard Sections */}
        <div className="flex items-center gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto no-scrollbar scroll-touch">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            const labels: Record<DashboardTab, string> = {
              overview: 'Overview',
              analysis: 'Analysis',
              activity: 'Activity',
              pending_matches: 'Matches',
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`touch-feedback flex-1 min-w-[75px] py-2 px-3 rounded-xl text-xs font-bold transition-all text-center min-h-[38px] whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm border border-black/5 dark:border-white/10'
                    : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60'
                }`}
              >
                {labels[tab] || tab}
              </button>
            );
          })}
        </div>

        {/* 8. Active Tab Content - Vertical Single Column Card Stack */}
        <div className="space-y-4">
          {/* Bank Sync Matcher Banners */}
          {suggestions.length > 0 && (
            <TransactionMatcherCard
              suggestionsCount={suggestions.length}
              onReview={() => setIsMatcherModalOpen(true)}
              onDismiss={dismissAllSuggestions}
            />
          )}

          {billSuggestions.length > 0 && setIsBillMatcherModalOpen && dismissAllBillMatches && (
            <SyncedBillMatcherCard
              suggestionsCount={billSuggestions.length}
              onReview={() => setIsBillMatcherModalOpen(true)}
              onDismiss={dismissAllBillMatches}
            />
          )}

          {/* Widgets Stack */}
          {activeWidgetsForTab.map((widget) => (
            <div key={widget.id} className="relative group">
              {isEditMode && (
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="absolute -top-2 -right-2 z-30 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg"
                  aria-label="Remove widget"
                >
                  <Icon name="close" className="text-sm" />
                </button>
              )}
              <div className="w-full">
                {widget.component}
              </div>
            </div>
          ))}

          {activeWidgetsForTab.length === 0 && (
            <div className="text-center py-10 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 p-6">
              <Icon name="widgets" className="text-3xl text-gray-400 mb-2" />
              <p className="text-sm font-bold text-light-text dark:text-dark-text">No active widgets</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 opacity-70">
                Tap the edit button to customize your dashboard layout.
              </p>
              <button
                onClick={() => setIsAddWidgetModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-primary-500 text-white text-xs font-bold shadow-md touch-feedback"
              >
                Add Widget
              </button>
            </div>
          )}
        </div>

        {/* 9. Mobile Filter Sheet */}
        <MobileFilterSheet
          isOpen={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          title="Dashboard Filters"
          activeCount={activeFilterCount}
          sections={[
            {
              title: 'Time Range',
              chips: DURATION_OPTIONS.map((dur) => ({
                id: dur,
                label: dur,
                isActive: duration === dur,
                onToggle: () => setDuration(dur),
              })),
            },
          ]}
          onReset={() => {
            setSelectedAccountIds([]);
            setDuration('30D');
          }}
        >
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/50">
              Selected Accounts
            </h4>
            <MultiAccountFilter
              accounts={accounts}
              selectedAccountIds={selectedAccountIds}
              setSelectedAccountIds={setSelectedAccountIds}
            />
          </div>
        </MobileFilterSheet>

        {/* 10. Floating Action Button for Adding Transactions */}
        <FloatingActionButton
          onClick={handleOpenTransactionModal}
          label="Add Transaction"
        />
      </div>
    </PullToRefresh>
  );
};
