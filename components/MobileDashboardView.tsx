import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Account, Transaction, ForecastDuration, Duration, Currency, User, Category } from '../types';
import { formatCurrency, parseLocalDate, convertCurrency, toLocalISOString } from '../utils';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import {
  PieChart as BklitPieChart,
  PieSlice,
  PieCenter,
  type PieData,
} from '../src/components/charts';
import NetWorthChart from './NetWorthChart';
import Icon from './ui/Icon';
import PullToRefresh from './PullToRefresh';
import MobileFilterSheet from './MobileFilterSheet';
import SwipeableRow from './SwipeableRow';

export type DashboardTab = 'overview' | 'analysis' | 'activity' | 'pending_matches';

interface MobileDashboardViewProps {
  userProfile?: User;
  categories?: Category[];
  accounts: Account[];
  transactions: Transaction[];
  analyticsAccounts: Account[];
  analyticsTransactions: Transaction[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  netWorthData?: { name: string; value?: number; actual?: number; forecast?: number }[];
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
  updateWidgetWidth?: (id: string, w: number) => void;
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
  calculateAccountTotals?: (accounts: Account[], transactions: Transaction[]) => { totalAssets: number; totalDebt: number; netWorth: number };
  assetAllocationData?: any[];
  assetGroups?: any;
  liabilityGroups?: any;
  FORECAST_DURATION_OPTIONS?: { label: string; value: ForecastDuration }[];
  SELECT_WRAPPER_STYLE?: string;
  SELECT_STYLE?: string;
  SELECT_ARROW_STYLE?: string;
  brandfetchClientId?: string;
}

const CATEGORY_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6'];

export const MobileDashboardView: React.FC<MobileDashboardViewProps> = ({
  userProfile,
  categories = [],
  accounts,
  transactions,
  analyticsAccounts,
  analyticsTransactions,
  selectedAccountIds,
  setSelectedAccountIds,
  netWorthData = [],
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
  brandfetchClientId,
}) => {
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onSyncBanks) {
      await onSyncBanks();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const handleLogoError = useCallback((url: string) => {
    setLogoErrors((prev) => ({ ...prev, [url]: true }));
  }, []);

  // 1. Identify Primary / Main Account
  const primaryAccount = useMemo(() => {
    return (
      accounts.find((a) => a.isPrimary) ||
      accounts.find((a) => a.type === 'Checking') ||
      accounts[0]
    );
  }, [accounts]);

  // Default selectedAccountIds to ONLY the main account if unselected
  useEffect(() => {
    if (selectedAccountIds.length === 0 && primaryAccount) {
      setSelectedAccountIds([primaryAccount.id]);
    }
  }, [primaryAccount, selectedAccountIds, setSelectedAccountIds]);

  // Active Account Set for Filtering Widgets
  const activeAccountSet = useMemo(() => {
    if (selectedAccountIds.length > 0) return new Set(selectedAccountIds);
    return new Set(accounts.map((a) => a.id));
  }, [selectedAccountIds, accounts]);

  // Transactions filtered by selected accounts
  const dashboardFilteredTransactions = useMemo(() => {
    return analyticsTransactions.filter((tx) => activeAccountSet.has(tx.accountId));
  }, [analyticsTransactions, activeAccountSet]);

  // Header Greeting with User Name
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const userName = userProfile
    ? ((userProfile as any).firstName ||
       (userProfile as any).name ||
       (userProfile as any).displayName ||
       (userProfile.email ? userProfile.email.split('@')[0] : ''))
    : '';
  const greeting = userName ? `${timeGreeting}, ${userName}` : timeGreeting;
  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Main Account Balance
  const primaryBalanceFormatted = useMemo(() => {
    if (!primaryAccount) return formatCurrency(0, curr);
    const converted = convertCurrency(primaryAccount.balance, primaryAccount.currency || 'EUR', curr, conversionRates);
    return formatCurrency(converted, curr);
  }, [primaryAccount, convertCurrency, formatCurrency, curr, conversionRates]);

  // 2. Net Portfolio Value Hero Card (ALWAYS TOTAL OF ALL ACCOUNTS)
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

  // 3. Slice netWorthData to Past 30 Days Actuals + Next 30 Days Forecast
  const netWorth30DSlicedData = useMemo(() => {
    if (!netWorthData || netWorthData.length === 0) return [];

    const todayISO = toLocalISOString(new Date()).split('T')[0];
    let todayIdx = netWorthData.findIndex((d) => d.name === todayISO);
    
    if (todayIdx === -1) {
      for (let i = netWorthData.length - 1; i >= 0; i--) {
        if (netWorthData[i].value !== undefined) {
          todayIdx = i;
          break;
        }
      }
    }

    if (todayIdx !== -1) {
      const startIdx = Math.max(0, todayIdx - 30);
      const endIdx = Math.min(netWorthData.length, todayIdx + 31);
      return netWorthData.slice(startIdx, endIdx);
    }

    return netWorthData;
  }, [netWorthData]);

  // Precise Net Change over past 30 days & projected 30D value calculation
  const { projected30DVal, change30DVal } = useMemo(() => {
    if (netWorth30DSlicedData.length === 0) return { projected30DVal: 0, change30DVal: 0 };

    const histPoints = netWorth30DSlicedData.filter((d) => d.value !== undefined);
    if (histPoints.length === 0) return { projected30DVal: 0, change30DVal: 0 };

    const firstHistVal = histPoints[0].value ?? 0;
    const todayHistVal = histPoints[histPoints.length - 1].value ?? 0;
    const changeVal = todayHistVal - firstHistVal;

    const forecastPoints = netWorth30DSlicedData.filter((d) => d.forecast !== undefined);
    const lastForecastVal = forecastPoints.length > 0 ? (forecastPoints[forecastPoints.length - 1].forecast ?? todayHistVal) : todayHistVal;

    return {
      projected30DVal: lastForecastVal,
      change30DVal: changeVal,
    };
  }, [netWorth30DSlicedData]);

  // 4. Monthly Cashflow & Budget Allowance (Filtered)
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - today.getDate() + 1);

  const monthExpensesEur = useMemo(() => {
    return dashboardFilteredTransactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((sum, t) => sum + convertCurrency(Math.abs(t.amount), t.currency || 'EUR', 'EUR', conversionRates), 0);
  }, [dashboardFilteredTransactions, conversionRates, convertCurrency]);

  const monthIncomeEur = useMemo(() => {
    return dashboardFilteredTransactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === 'income' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((sum, t) => sum + convertCurrency(Math.abs(t.amount), t.currency || 'EUR', 'EUR', conversionRates), 0);
  }, [dashboardFilteredTransactions, conversionRates, convertCurrency]);

  const estimatedBudgetEur = monthIncomeEur > 0 ? monthIncomeEur : 3500;
  const remainingForMonthEur = Math.max(0, estimatedBudgetEur - monthExpensesEur);
  const dailySafeSpendEur = remainingForMonthEur / daysRemaining;
  const budgetSpentPercent = Math.min(100, Math.round((monthExpensesEur / estimatedBudgetEur) * 100));

  // 5. Category Breakdown Pie Chart Data (bklit PieChart - LAST 30 DAYS EXPENSES & ORIGINAL CONFIGURED COLORS)
  const bklitPieData = useMemo<PieData[]>(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Map category names to their original configured colors
    const categoryColorMap = new Map<string, string>();
    if (categories && categories.length > 0) {
      const walk = (nodes: Category[], parentColor?: string) => {
        nodes.forEach((node) => {
          const resolvedColor = node.color || parentColor;
          if (resolvedColor) {
            categoryColorMap.set(node.name, resolvedColor);
          }
          if (node.subCategories && node.subCategories.length > 0) {
            walk(node.subCategories, resolvedColor);
          }
        });
      };
      walk(categories);
    }

    const categoryTotals: Record<string, number> = {};
    dashboardFilteredTransactions
      .filter((t) => {
        if (t.type !== 'expense') return false;
        const txDate = parseLocalDate(t.date);
        return txDate >= thirtyDaysAgo;
      })
      .forEach((t) => {
        const cat = t.category || 'Uncategorized';
        const amtEur = convertCurrency(Math.abs(t.amount), t.currency || 'EUR', 'EUR', conversionRates);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amtEur;
      });

    return Object.entries(categoryTotals)
      .map(([name, totalEur], idx) => {
        const originalColor = categoryColorMap.get(name) || CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        return {
          label: name,
          value: convertCurrency(totalEur, 'EUR', preferredCurrency, conversionRates),
          color: originalColor,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [dashboardFilteredTransactions, categories, preferredCurrency, conversionRates, convertCurrency]);

  // 6. Recent Activity Feed (Filtered)
  const recentTransactions = useMemo(() => {
    return dashboardFilteredTransactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [dashboardFilteredTransactions]);

  // Group accounts by type for MobileFilterSheet
  const filterAccountSections = useMemo(() => {
    const map: Record<string, Account[]> = {};
    accounts.forEach((acc) => {
      const typeStr = acc.type || 'Other';
      if (!map[typeStr]) map[typeStr] = [];
      map[typeStr].push(acc);
    });

    const getIconForType = (t: string) => {
      switch (t) {
        case 'Checking':
        case 'Savings':
          return 'wallet';
        case 'Credit Card':
          return 'credit_card';
        case 'Investment':
        case 'Crypto':
          return 'trending_up';
        case 'Loan':
        case 'Mortgage':
          return 'receipt_long';
        case 'Property':
          return 'home';
        case 'Vehicle':
          return 'directions_car';
        default:
          return 'account_balance';
      }
    };

    return Object.entries(map).map(([typeStr, accs]) => {
      const accIds = accs.map((a) => a.id);
      return {
        title: typeStr,
        icon: getIconForType(typeStr),
        searchable: accs.length > 5,
        searchPlaceholder: `Search ${typeStr.toLowerCase()} accounts...`,
        onSelectAll: () => {
          const merged = Array.from(new Set([...selectedAccountIds, ...accIds]));
          setSelectedAccountIds(merged);
        },
        onClearAll: () => {
          setSelectedAccountIds(selectedAccountIds.filter((id) => !accIds.includes(id)));
        },
        chips: accs.map((acc) => ({
          id: acc.id,
          label: acc.name,
          icon: getIconForType(acc.type || typeStr),
          isActive: selectedAccountIds.includes(acc.id),
          onToggle: () => {
            if (selectedAccountIds.includes(acc.id)) {
              const next = selectedAccountIds.filter((id) => id !== acc.id);
              setSelectedAccountIds(next);
            } else {
              setSelectedAccountIds([...selectedAccountIds, acc.id]);
            }
          },
        })),
      };
    });
  }, [accounts, selectedAccountIds, setSelectedAccountIds]);

  const activeFilterCount = selectedAccountIds.length;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-3.5 pb-20 animate-fade-in md:hidden relative font-sans px-0.5">
        {/* 1. iOS Large Title Navigation Header with Funnel Filter Button */}
        <div className="sticky top-0 z-20 pt-2 pb-2.5 bg-light-bg/85 dark:bg-dark-bg/85 backdrop-blur-xl -mx-4 px-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between transition-all">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              {todayDateStr}
            </p>
            <h1 className="text-2xl font-bold text-light-text dark:text-white tracking-tight flex items-center gap-1.5">
              <span>{greeting}</span>
              {isSyncingBanks && <Icon name="sync" className="text-primary-500 animate-spin text-sm" />}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className="w-9 h-9 rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-xs flex items-center justify-center text-light-text dark:text-white active:scale-95 touch-feedback transition-transform"
              aria-label="Toggle Privacy Mode"
            >
              <Icon name={isPrivacyMode ? 'visibility_off' : 'visibility'} className="text-lg" />
            </button>

            {/* Filter Funnel Button in Top Right Header */}
            <button
              onClick={() => setShowFilterSheet(true)}
              className="w-9 h-9 rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/5 dark:border-white/10 shadow-xs flex items-center justify-center text-light-text dark:text-white active:scale-95 touch-feedback transition-transform relative"
              aria-label="Account Filters"
            >
              <Icon name="filter_alt" className="text-lg" />
              {selectedAccountIds.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-gray-900 text-2xs font-bold flex items-center justify-center border border-white dark:border-dark-card">
                  {selectedAccountIds.length}
                </span>
              )}
            </button>

            <button
              onClick={handleOpenTransactionModal}
              className="w-9 h-9 rounded-2xl bg-primary-500 hover:bg-primary-600 active:scale-95 text-white shadow-md shadow-primary-500/25 flex items-center justify-center touch-feedback transition-transform"
              aria-label="Add Transaction"
            >
              <Icon name="add" className="text-xl font-bold" />
            </button>
          </div>
        </div>

        {/* 2. Unified Hero Card: Main Account Highlighted (Primary) & Net Portfolio Value (Secondary) */}
        <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 text-white rounded-[24px] p-4 shadow-lg border border-white/15 relative overflow-hidden space-y-3.5">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          {/* PRIMARY HIGHLIGHT: Main Account Balance */}
          {primaryAccount && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shrink-0">
                    <Icon name="star" className="text-xs text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/70 block">
                      Main Account
                    </span>
                    <p className="text-xs font-bold text-white truncate max-w-[180px]">
                      {primaryAccount.name}
                    </p>
                  </div>
                </div>

                {/* GREEN Sync Button Replacing Currency Label */}
                <button
                  onClick={() => {
                    if (onSyncBanks) onSyncBanks();
                  }}
                  className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 border border-emerald-400/30 flex items-center gap-1.5 touch-feedback transition-all shrink-0"
                  aria-label="Sync Banks"
                >
                  <Icon name="sync" className={`text-xs ${isSyncingBanks ? 'animate-spin' : ''}`} />
                  <span>{isSyncingBanks ? 'Syncing...' : 'Sync'}</span>
                </button>
              </div>

              <p className="text-3xl font-black text-white tracking-tight privacy-blur leading-none pt-1">
                {primaryBalanceFormatted}
              </p>
            </div>
          )}

          {/* SECONDARY SECTION: Net Portfolio Value & Assets/Liabilities Breakdown */}
          <div className="pt-2.5 border-t border-white/15 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Net Portfolio Value (All Accounts)
              </span>
              <span className="text-base font-bold text-white privacy-blur">
                {netWorthFormatted}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-semibold pt-0.5">
              <div className="bg-emerald-500/15 rounded-xl p-2 border border-emerald-500/25 flex items-center justify-between">
                <div>
                  <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-300 block">
                    Total Assets
                  </span>
                  <span className="text-xs font-bold text-emerald-400 privacy-blur truncate block mt-0.5">
                    {assetsFormatted}
                  </span>
                </div>
                <Icon name="arrow_upward" className="text-emerald-400 text-sm shrink-0" />
              </div>

              <div className="bg-rose-500/15 rounded-xl p-2 border border-rose-500/25 flex items-center justify-between">
                <div>
                  <span className="text-2xs font-semibold uppercase tracking-wider text-rose-300 block">
                    Total Liabilities
                  </span>
                  <span className="text-xs font-bold text-rose-400 privacy-blur truncate block mt-0.5">
                    {debtFormatted}
                  </span>
                </div>
                <Icon name="arrow_downward" className="text-rose-400 text-sm shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. NetWorthChart (100% IDENTICAL TO WEB VIEW CHART WITH PROPER AXIS ALIGNMENT) */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl rounded-[22px] p-3.5 sm:p-4 border border-black/5 dark:border-white/10 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70 block">
                30D Trend & 30D Forecast
              </span>
              <p className="text-xs font-bold text-light-text dark:text-white mt-0.5 privacy-blur">
                Projected 30D: {formatCurrency(projected30DVal, curr)}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`text-xs font-bold privacy-blur inline-flex items-center gap-0.5 ${
                  change30DVal >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                <Icon
                  name={change30DVal >= 0 ? 'arrow_upward' : 'arrow_downward'}
                  className="text-xs"
                />
                {formatCurrency(Math.abs(change30DVal), curr)}
              </span>
            </div>
          </div>

          {/* Web View NetWorthChart Component Sliced to 30D Window */}
          <div className="h-44 sm:h-52 w-full pt-0.5 overflow-hidden">
            <NetWorthChart
              data={netWorth30DSlicedData}
              showForecast={true}
              showGoals={false}
              margin={{ top: 10, right: 15, bottom: 28, left: 56 }}
              minHeight="min-h-[170px]"
            />
          </div>
        </div>

        {/* 4. Daily Safe-to-Spend Allowance Widget */}
        <div className="p-3.5 rounded-[22px] bg-amber-500/10 border border-amber-500/20 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Icon name="zap" className="text-lg" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Daily Safe Spend • {daysRemaining} days left
              </p>
              <p className="text-base sm:text-lg font-bold text-light-text dark:text-white privacy-blur">
                {formatCurrency(convertCurrency(dailySafeSpendEur, 'EUR', preferredCurrency, conversionRates), curr)}{' '}
                <span className="text-xs font-semibold opacity-60">/ day</span>
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              {budgetSpentPercent}% Spent
            </span>
          </div>
        </div>

        {/* 5. Category Spending Breakdown Donut Chart (bklit PieChart with Theme Border - Last 30 Days) */}
        {bklitPieData.length > 0 && (
          <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl rounded-[22px] p-3.5 sm:p-4 border border-black/5 dark:border-white/10 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Category Spending (Last 30D)
              </span>
              <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                Selected Accounts
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div className="h-32 w-32 shrink-0 relative flex items-center justify-center">
                <BklitPieChart
                  data={bklitPieData}
                  innerRadius={40}
                  cornerRadius={6}
                  padAngle={bklitPieData.length > 1 ? 0.05 : 0}
                  className="w-full h-full max-h-[140px]"
                >
                  {bklitPieData.map((cat, index) => (
                    <PieSlice
                      key={index}
                      index={index}
                      color={cat.color}
                      fill={cat.color}
                      showGlow
                      className="stroke-white dark:stroke-[#18181b] stroke-2"
                    />
                  ))}
                  <PieCenter defaultLabel="Total Spent">
                    {({ value, label, isHovered }) => (
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="text-light-text-secondary dark:text-gray-300 text-2xs tracking-wider font-semibold uppercase">
                          {label}
                        </span>
                        <span className="text-xs font-bold text-light-text dark:text-white tracking-tight privacy-blur">
                          {formatCurrency(value, curr)}
                        </span>
                      </div>
                    )}
                  </PieCenter>
                </BklitPieChart>
              </div>

              <div className="flex-1 space-y-1.5 text-xs font-bold min-w-0">
                {bklitPieData.map((cat) => (
                  <div key={cat.label} className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-light-text dark:text-white truncate min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 dark:border-white/10"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate">{cat.label}</span>
                    </span>
                    <span className="privacy-blur text-light-text-secondary dark:text-dark-text-secondary text-xs shrink-0 font-medium">
                      {formatCurrency(cat.value, curr)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. Linked Accounts Horizontal Carousel */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Accounts ({accounts.length})
            </span>
            <span className="text-xs font-bold text-primary-500">Swipe →</span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar snap-scroll-x scroll-touch py-0.5">
            {accounts.map((acc) => {
              const isSelected = activeAccountSet.has(acc.id);
              const formattedBal = formatCurrency(
                convertCurrency(acc.balance, acc.currency || 'EUR', curr, conversionRates),
                curr
              );
              const logoUrl = getMerchantLogoUrl(
                (acc as any).institutionName || (acc as any).institutionId || acc.name,
                brandfetchClientId,
                {},
                { type: 'icon', fallback: 'lettermark', width: 64, height: 64 }
              );
              const isValidLogo = logoUrl && !logoErrors[logoUrl];

              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    if (selectedAccountIds.includes(acc.id)) {
                      if (selectedAccountIds.length > 1) {
                        setSelectedAccountIds(selectedAccountIds.filter((id) => id !== acc.id));
                      }
                    } else {
                      setSelectedAccountIds([...selectedAccountIds, acc.id]);
                    }
                  }}
                  className={`snap-start shrink-0 w-[165px] p-3 rounded-[18px] bg-white dark:bg-dark-card border transition-all active:scale-[0.98] touch-feedback cursor-pointer ${
                    isSelected
                      ? 'border-primary-500 shadow-md shadow-primary-500/15 ring-2 ring-primary-500/20'
                      : 'border-black/5 dark:border-white/10 shadow-xs opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center overflow-hidden">
                      {isValidLogo ? (
                        <img
                          src={logoUrl}
                          alt={acc.name}
                          className="w-full h-full object-cover p-0 border-0"
                          referrerPolicy="no-referrer"
                          onError={() => handleLogoError(logoUrl)}
                        />
                      ) : (
                        <Icon name="account_balance_wallet" className="text-sm" />
                      )}
                    </div>
                    <span
                      className={`text-2xs font-semibold uppercase px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                      }`}
                    >
                      {acc.type}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-light-text dark:text-white truncate">
                    {acc.name}
                  </p>
                  <p className="text-xs font-bold text-primary-600 dark:text-primary-400 privacy-blur mt-0.5">
                    {formattedBal}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. Recent Activity Feed (Filtered) */}
        {recentTransactions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Recent Activity
              </span>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-[22px] border border-black/5 dark:border-white/10 shadow-xs divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
              {recentTransactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                const isIncome = tx.type === 'income';
                return (
                  <SwipeableRow key={tx.id}>
                    <div
                      onClick={handleOpenTransactionModal}
                      className="p-3 flex items-center justify-between gap-3 min-h-[54px] bg-white dark:bg-[#18181b] touch-feedback cursor-pointer active:bg-gray-100 dark:active:bg-gray-800/80 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-primary-500/10 text-primary-500 border border-primary-500/20">
                        <Icon name={isExpense ? 'arrow_upward' : 'arrow_downward'} className="text-sm" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-light-text dark:text-white truncate">
                          {tx.merchant || tx.description}
                        </p>
                        <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                          {tx.category || 'Uncategorized'} • {tx.date}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs font-bold privacy-blur ${
                            isExpense
                              ? 'text-light-text dark:text-white'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : isIncome ? '+' : ''}
                          {formatCurrency(
                            convertCurrency(Math.abs(tx.amount), tx.currency || 'EUR', curr, conversionRates),
                            curr
                          )}
                        </p>
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })}
            </div>
          </div>
        )}

        {/* 8. Apple iOS HIG Mobile Filter Sheet (Accounts Grouped by Type) */}
        <MobileFilterSheet
          isOpen={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          title="Account View Options"
          subtitle="Select accounts to include in your dashboard balance and metrics"
          activeCount={activeFilterCount}
          onReset={() => {
            if (primaryAccount) setSelectedAccountIds([primaryAccount.id]);
            else setSelectedAccountIds([]);
          }}
          onApply={() => setShowFilterSheet(false)}
          sections={filterAccountSections}
        />
      </div>
    </PullToRefresh>
  );
};
