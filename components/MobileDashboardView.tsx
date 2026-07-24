import React, { Suspense, useState } from 'react';
import { Account, Transaction, FinancialGoal, ForecastDuration, Duration } from '../types';
import MultiAccountFilter from './MultiAccountFilter';
import DurationFilter from './DurationFilter';
import TransactionMatcherCard from './TransactionMatcherCard';
import SyncedBillMatcherCard from './SyncedBillMatcherCard';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Card from './Card';

export type DashboardTab = 'overview' | 'analysis' | 'activity';

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
  calculateAccountTotals,
  assetAllocationData,
  assetGroups,
  liabilityGroups,
  FORECAST_DURATION_OPTIONS,
  SELECT_WRAPPER_STYLE,
  SELECT_STYLE,
  SELECT_ARROW_STYLE
}) => {
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

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

  // Get current hour for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Recent 5 transactions for quick view on overview
  const recentTransactions = analyticsTransactions
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const activeWidgetsForTab = widgets.filter(w => WIDGET_TABS[activeTab]?.includes(w.id));

  return (
    <div className="space-y-5 pb-20 animate-fade-in">
      {/* 1. SwiftUI Header & Salutation */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
            {todayDateStr}
          </p>
          <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
            {greeting} ☀️
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrivacyMode(!isPrivacyMode)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-center text-light-text dark:text-white transition-all active:scale-95"
            aria-label="Toggle Privacy Mode"
          >
            <span className="material-symbols-outlined text-xl">
              {isPrivacyMode ? 'visibility_off' : 'visibility'}
            </span>
          </button>

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-sm border ${
              isEditMode
                ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/30'
                : 'bg-white/80 dark:bg-dark-card/80 border-black/5 dark:border-white/10 text-light-text dark:text-white'
            }`}
            aria-label="Customize Layout"
          >
            <span className="material-symbols-outlined text-xl">
              {isEditMode ? 'done' : 'dashboard_customize'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. SwiftUI Net Worth Hero Card */}
      <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-900 p-6 text-white shadow-xl border border-white/10">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between text-xs text-white/70 font-semibold tracking-wider uppercase">
            <span>Net Worth</span>
            <span className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white border border-white/10">
              {preferredCurrency}
            </span>
          </div>

          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white privacy-blur leading-none">
              {netWorthFormatted}
            </h2>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-emerald-400 text-xs font-bold flex-1 truncate">
              <span className="material-symbols-outlined text-sm">arrow_upward</span>
              <span className="opacity-75 text-[10px]">Assets:</span>
              <span className="privacy-blur truncate">{assetsFormatted}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/20 px-3 py-1.5 rounded-xl text-rose-400 text-xs font-bold flex-1 truncate">
              <span className="material-symbols-outlined text-sm">arrow_downward</span>
              <span className="opacity-75 text-[10px]">Debt:</span>
              <span className="privacy-blur truncate">{debtFormatted}</span>
            </div>
          </div>

          {/* Swift Quick Actions Grid */}
          <div className="pt-2 grid grid-cols-4 gap-2 border-t border-white/10 mt-4">
            <button
              onClick={handleOpenTransactionModal}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white text-gray-900 font-bold active:scale-95 transition-all min-h-[50px] shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span className="text-[10px] mt-0.5 font-bold">Transact</span>
            </button>

            <button
              onClick={() => {
                if (onSyncBanks) onSyncBanks();
                else {
                  const syncBtn = document.querySelector('[data-eb-sync-all]');
                  if (syncBtn) (syncBtn as HTMLElement).click();
                }
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold active:scale-95 transition-all min-h-[50px] border border-white/10"
            >
              <span className={`material-symbols-outlined text-lg ${isSyncingBanks ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span className="text-[10px] mt-0.5">{isSyncingBanks ? 'Syncing' : 'Sync'}</span>
            </button>

            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold active:scale-95 transition-all min-h-[50px] border border-white/10"
            >
              <span className="material-symbols-outlined text-lg">tune</span>
              <span className="text-[10px] mt-0.5">Filters</span>
            </button>

            <button
              onClick={() => {
                if (isEditMode) setIsAddWidgetModalOpen(true);
                else setIsEditMode(true);
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold active:scale-95 transition-all min-h-[50px] border border-white/10"
            >
              <span className="material-symbols-outlined text-lg">
                {isEditMode ? 'add_circle' : 'widgets'}
              </span>
              <span className="text-[10px] mt-0.5">{isEditMode ? 'Add' : 'Widgets'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Filter Drawer / Bottom Sheet Toggle (If Active) */}
      {showFilterDrawer && (
        <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-xl p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-lg space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
              Filter Options
            </span>
            <button
              onClick={() => setShowFilterDrawer(false)}
              className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <p className="text-[11px] font-semibold mb-1 text-light-text dark:text-dark-text">Accounts</p>
              <MultiAccountFilter
                accounts={accounts}
                selectedAccountIds={selectedAccountIds}
                setSelectedAccountIds={setSelectedAccountIds}
              />
            </div>

            <div>
              <p className="text-[11px] font-semibold mb-1 text-light-text dark:text-dark-text">Time Range</p>
              <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
            </div>

            {activeTab === 'overview' && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-medium text-light-text dark:text-dark-text">Forecast View</span>
                <div className="flex items-center gap-1.5">
                  <div className={`${SELECT_WRAPPER_STYLE} !w-auto !h-9`}>
                    <select
                      value={forecastDuration}
                      onChange={(e) => setForecastDuration(e.target.value as ForecastDuration)}
                      className={`${SELECT_STYLE} !bg-transparent !w-auto !h-full !py-0 !px-3 text-xs font-semibold`}
                    >
                      {FORECAST_DURATION_OPTIONS.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          className="bg-white dark:bg-dark-card text-light-text dark:text-dark-text"
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}>
                      <span className="material-symbols-outlined text-base">expand_more</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowForecast(!showForecast)}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                      showForecast
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">show_chart</span>
                  </button>

                  <button
                    onClick={() => setShowGoals(!showGoals)}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                      showGoals
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">flag</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Transaction Suggestions Banner */}
      {suggestions.length > 0 && (
        <TransactionMatcherCard
          suggestionsCount={suggestions.length}
          onReview={() => setIsMatcherModalOpen(true)}
          onDismiss={dismissAllSuggestions}
        />
      )}

      {billSuggestions.length > 0 && (
        <SyncedBillMatcherCard
          suggestionsCount={billSuggestions.length}
          onReview={() => setIsBillMatcherModalOpen && setIsBillMatcherModalOpen(true)}
          onDismiss={dismissAllBillMatches || (() => {})}
        />
      )}

      {/* 5. SwiftUI Segmented Picker Control */}
      <div className="bg-black/5 dark:bg-white/10 p-1 rounded-2xl flex items-center min-h-[48px]">
        {tabs.map((tab) => {
          const tabConfig = {
            overview: { icon: 'dashboard', label: 'Overview' },
            analysis: { icon: 'insights', label: 'Analysis' },
            activity: { icon: 'history', label: 'Activity' }
          }[tab] || { icon: 'circle', label: tab };

          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-98 ${
                isActive
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${isActive ? 'filled-icon' : 'opacity-70'}`}>
                {tabConfig.icon}
              </span>
              <span className="capitalize">{tabConfig.label}</span>
            </button>
          );
        })}
      </div>

      {/* 6. TAB CONTENT */}

      {/* ANALYSIS TAB */}
      {activeTab === 'analysis' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-lg">savings</span>
              </div>
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">
                Liquidity Ratio
              </p>
              <p className="text-lg font-bold text-light-text dark:text-white mt-0.5">
                {liquidityRatio.toFixed(1)} mo
              </p>
              <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Runway avg spend
              </p>
            </div>

            <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-lg">trending_up</span>
              </div>
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">
                Savings Rate
              </p>
              <p className="text-lg font-bold text-light-text dark:text-white mt-0.5">
                {savingsRate.toFixed(0)}%
              </p>
              <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                of total income
              </p>
            </div>

            <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-lg">pie_chart</span>
              </div>
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">
                Debt Ratio
              </p>
              <p className="text-lg font-bold text-light-text dark:text-white mt-0.5">
                {(
                  calculateAccountTotals(analyticsAccounts, analyticsTransactions).netWorth > 0
                    ? (Math.abs(calculateAccountTotals(analyticsAccounts, analyticsTransactions).totalDebt) /
                        calculateAccountTotals(analyticsAccounts, analyticsTransactions).totalAssets) *
                      100
                    : 0
                ).toFixed(1)}
                %
              </p>
              <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Debt / Assets
              </p>
            </div>

            <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-lg">payments</span>
              </div>
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">
                Net Flow
              </p>
              <p className="text-lg font-bold text-light-text dark:text-white mt-0.5 truncate">
                {formatCurrency(
                  calculateAccountTotals(analyticsAccounts, analyticsTransactions).netWorth -
                    calculateAccountTotals(analyticsAccounts, analyticsTransactions).netWorth,
                  'EUR'
                )}
              </p>
              <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Period change
              </p>
            </div>
          </div>

          {/* Asset Allocation SwiftUI Card */}
          <Card className="rounded-3xl p-5 bg-white/90 dark:bg-dark-card/90 backdrop-blur-md">
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-4">
              Asset Allocation
            </h3>
            <div className="h-48 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetAllocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {assetAllocationData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-semibold text-light-text-secondary dark:text-gray-400">
                  Net Worth
                </span>
                <span className="text-lg font-bold text-light-text dark:text-white privacy-blur">
                  {netWorthFormatted}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* OVERVIEW / ACTIVITY RECENT TRANSACTIONS QUICK INSET */}
      {activeTab === 'overview' && recentTransactions.length > 0 && (
        <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-3xl p-4 border border-black/5 dark:border-white/10 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-500 text-lg">history</span>
              <h3 className="text-xs font-bold text-light-text dark:text-white tracking-wide">
                Recent Transactions
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('activity')}
              className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline"
            >
              See All
            </button>
          </div>

          <div className="divide-y divide-black/5 dark:divide-white/5">
            {recentTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const amtFormatted = formatCurrency(
                convertCurrency(tx.amount, tx.currency || 'EUR', preferredCurrency, conversionRates),
                preferredCurrency
              );

              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-black/5 dark:bg-white/10 text-light-text dark:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {isIncome ? 'arrow_downward' : 'shopping_bag'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-light-text dark:text-white truncate">
                        {tx.merchant || tx.description || 'Transaction'}
                      </p>
                      <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate">
                        {tx.date} • {tx.category || 'General'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-extrabold privacy-blur shrink-0 ${
                      isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-light-text dark:text-white'
                    }`}
                  >
                    {isIncome ? '+' : ''}
                    {amtFormatted}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. WIDGETS STACK FOR MOBILE */}
      <div className="space-y-4">
        {activeWidgetsForTab.map((widget) => {
          const widgetDetails = allWidgets.find((w) => w.id === widget.id);
          if (!widgetDetails) return null;
          const WidgetComponent = widgetDetails.component;

          return (
            <div
              key={widget.id}
              className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-black/5 dark:border-white/10 shadow-sm relative overflow-hidden transition-all"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/5 dark:border-white/10">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {widgetDetails.icon && (
                    <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-base">{widgetDetails.icon}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-light-text dark:text-white truncate">
                      {widget.title}
                    </h4>
                    {widgetDetails.description && (
                      <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary truncate opacity-70">
                        {widgetDetails.description}
                      </p>
                    )}
                  </div>
                </div>

                {isEditMode && (
                  <button
                    onClick={() => removeWidget(widget.id)}
                    className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all shrink-0"
                    aria-label="Remove widget"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <Suspense
                  fallback={
                    <div className="p-4 text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                      Loading widget...
                    </div>
                  }
                >
                  <WidgetComponent {...(widgetDetails.props as any)} />
                </Suspense>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
