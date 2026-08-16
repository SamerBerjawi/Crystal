import React, { useState, useMemo, useCallback } from 'react';
import {
  ForecastDuration,
  Currency,
  Account,
  FinancialGoal,
  GoalCategory,
} from '../types';
import {
  formatCurrency,
  convertCurrency,
  parseLocalDate,
  toLocalISOString,
} from '../utils';
import { LIQUID_ACCOUNT_TYPES } from '../constants';
import Icon from './ui/Icon';
import PullToRefresh from './PullToRefresh';
import BottomSheet from './BottomSheet';
import ForecastChart from './ForecastChart';
import SwipeableRow from './SwipeableRow';

export type ForecastMobileTab = 'projection' | 'goals' | 'ledger';

export interface MobileForecastViewProps {
  // Accounts & Selection
  accounts: Account[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;

  // Horizon & Preferences
  forecastDuration: ForecastDuration;
  setForecastDuration: (dur: ForecastDuration) => void;
  preferredCurrency?: string;
  conversionRates?: any;

  // Projections & Metrics
  startBalance: number;
  endBalance: number;
  netChange: number;
  lowestPoint: { value: number; date: string };
  lowestBalanceForecasts: {
    period: string;
    lowestBalance: number;
    date: string;
  }[];
  combinedChartData: any[];
  showIndividualLines: boolean;
  setShowIndividualLines: (show: boolean) => void;
  showGoalLines: boolean;
  setShowGoalLines: (show: boolean) => void;
  onDataPointClick?: (date: string) => void;

  // Scenario Assumptions
  assumptions: {
    savingsRateAdjustment: number;
    marketReturn: number;
    inflationRate: number;
  };
  setAssumptions: React.Dispatch<
    React.SetStateAction<{
      savingsRateAdjustment: number;
      marketReturn: number;
      inflationRate: number;
    }>
  >;

  // Global Performance
  goalProgress: number;
  savingsProgress: number;
  incomeProgress: number;
  expenseProgress: number;
  globalIncomeGoalCurrent: number;
  globalIncomeGoalTarget: number;
  globalSavingsGoalCurrent: number;
  globalSavingsGoalTarget: number;
  globalExpenseGoalCurrent: number;
  globalExpenseGoalTarget: number;
  globalAccountBreakdown: any[];

  // Goals
  financialGoals: FinancialGoal[];
  topLevelGoals: FinancialGoal[];
  goalsByParentId: Map<string, FinancialGoal[]>;
  activeGoalIds: string[];
  setActiveGoalIds: (ids: string[]) => void;
  filterGoalsByAccount: boolean;
  setFilterGoalsByAccount: (b: boolean) => void;
  onAddGoal: (parentId?: string) => void;
  onEditGoal: (goal: FinancialGoal) => void;
  onDeleteGoal: (goal: FinancialGoal) => void;
  onToggleGoal: (goalId: string) => void;

  // Monthly Target Schedule
  monthlyPaymentBreakdown: any[];
  monthlyDateBreakdown: any[];
  scheduleMode: 'account' | 'date';
  setScheduleMode: (mode: 'account' | 'date') => void;

  // Ledger / Daily Projections
  groupedTableData: {
    monthKey: string;
    monthName: string;
    year: string;
    minBalance: number;
    rows: any[];
  }[];
  onEditForecastItem: (item: any) => void;
  onRefreshData?: () => Promise<void>;
}

const HORIZON_OPTIONS: { id: ForecastDuration; label: string }[] = [
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
  { id: 'EOY', label: 'EOY' },
  { id: '1Y', label: '1Y' },
];

const GOAL_CATEGORY_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  savings: { label: 'Savings', icon: 'savings', color: '#6366f1' },
  investment: { label: 'Investment', icon: 'trending_up', color: '#8b5cf6' },
  debt: { label: 'Debt Payoff', icon: 'credit_card', color: '#ef4444' },
  emergency_fund: { label: 'Emergency Fund', icon: 'health_and_safety', color: '#10b981' },
  property: { label: 'Property', icon: 'home', color: '#06b6d4' },
  vehicle: { label: 'Vehicle', icon: 'directions_car', color: '#f59e0b' },
  travel: { label: 'Travel & Vacation', icon: 'flight', color: '#ec4899' },
  purchase: { label: 'Major Purchase', icon: 'shopping_bag', color: '#14b8a6' },
  education: { label: 'Education', icon: 'school', color: '#3b82f6' },
  retirement: { label: 'Retirement', icon: 'elderly', color: '#64748b' },
  other: { label: 'General Goal', icon: 'flag', color: '#a855f7' },
};

export const MobileForecastView: React.FC<MobileForecastViewProps> = ({
  accounts,
  selectedAccountIds,
  setSelectedAccountIds,
  forecastDuration,
  setForecastDuration,
  preferredCurrency = 'EUR',
  conversionRates,
  startBalance,
  endBalance,
  netChange,
  lowestPoint,
  lowestBalanceForecasts,
  combinedChartData,
  showIndividualLines,
  setShowIndividualLines,
  showGoalLines,
  setShowGoalLines,
  onDataPointClick,
  assumptions,
  setAssumptions,
  goalProgress,
  savingsProgress,
  incomeProgress,
  expenseProgress,
  globalIncomeGoalCurrent,
  globalIncomeGoalTarget,
  globalSavingsGoalCurrent,
  globalSavingsGoalTarget,
  globalExpenseGoalCurrent,
  globalExpenseGoalTarget,
  globalAccountBreakdown,
  financialGoals,
  topLevelGoals,
  goalsByParentId,
  activeGoalIds,
  setActiveGoalIds,
  filterGoalsByAccount,
  setFilterGoalsByAccount,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onToggleGoal,
  monthlyPaymentBreakdown,
  monthlyDateBreakdown,
  scheduleMode,
  setScheduleMode,
  groupedTableData,
  onEditForecastItem,
  onRefreshData,
}) => {
  const curr = preferredCurrency as Currency;
  const [activeTab, setActiveTab] = useState<ForecastMobileTab>('projection');
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [isPlaygroundSheetOpen, setIsPlaygroundSheetOpen] = useState(false);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());

  const handleRefresh = async () => {
    if (onRefreshData) {
      await onRefreshData();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds]
  );

  const isAssumptionsModified =
    assumptions.savingsRateAdjustment !== 0 ||
    assumptions.marketReturn !== 0 ||
    assumptions.inflationRate !== 0;

  const toggleExpandGoal = (goalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  // Estimate burn rate & runway
  const runwayMonths = useMemo(() => {
    if (endBalance <= 0) return 0;
    if (netChange >= 0) return 36;
    const monthlyBurn = Math.abs(netChange) / Math.max(1, HORIZON_OPTIONS.findIndex((h) => h.id === forecastDuration) + 1);
    if (monthlyBurn <= 0) return 36;
    return Math.min(36, startBalance / monthlyBurn);
  }, [startBalance, endBalance, netChange, forecastDuration]);

  // Account quick selection presets
  const selectLiquidOnly = () => {
    const liquid = accounts.filter((a) => LIQUID_ACCOUNT_TYPES.includes(a.type)).map((a) => a.id);
    setSelectedAccountIds(liquid.length > 0 ? liquid : accounts.map((a) => a.id));
  };

  const selectAllAccounts = () => {
    setSelectedAccountIds(accounts.map((a) => a.id));
  };

  const toggleAccount = (id: string) => {
    if (selectedAccountIds.includes(id)) {
      if (selectedAccountIds.length > 1) {
        setSelectedAccountIds(selectedAccountIds.filter((accId) => accId !== id));
      }
    } else {
      setSelectedAccountIds([...selectedAccountIds, id]);
    }
  };

  // Check if all displayed goals are selected
  const areAllGoalsActive = useMemo(() => {
    if (topLevelGoals.length === 0) return false;
    return topLevelGoals.every((g) => activeGoalIds.includes(g.id));
  }, [topLevelGoals, activeGoalIds]);

  const toggleAllGoals = () => {
    if (areAllGoalsActive) {
      setActiveGoalIds([]);
    } else {
      setActiveGoalIds(financialGoals.map((g) => g.id));
    }
  };

  // Calculate growth percentage
  const growthPercent = useMemo(() => {
    if (startBalance === 0) return 0;
    return ((endBalance - startBalance) / Math.abs(startBalance)) * 100;
  }, [startBalance, endBalance]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4 pb-28 animate-fade-in md:hidden font-sans select-none">
        {/* ================================================================= */}
        {/* 1. iOS Top Navigation Header */}
        {/* ================================================================= */}
        <div className="pt-2 px-1 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 leading-none mb-1">
              Forward Cash & Wealth
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-light-text dark:text-white tracking-tight leading-tight">
                Forecasting
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                AI Model
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scenario Playground trigger */}
            <button
              type="button"
              onClick={() => setIsPlaygroundSheetOpen(true)}
              aria-label="Scenario Playground"
              className={`relative h-9 px-3 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all border shadow-xs active:scale-95 ${
                isAssumptionsModified
                  ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20'
                  : 'bg-white/80 dark:bg-dark-card/80 border-black/10 dark:border-white/10 text-light-text dark:text-white hover:bg-black/5'
              }`}
            >
              <Icon name="sliders" className="text-sm" />
              <span>Playground</span>
              {isAssumptionsModified && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              )}
            </button>

            {/* Account Filter trigger */}
            <button
              type="button"
              onClick={() => setIsAccountSheetOpen(true)}
              aria-label="Filter Accounts"
              className="h-9 px-3 rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/10 dark:border-white/10 text-light-text dark:text-white flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95"
            >
              <Icon name="account_balance" className="text-sm text-primary-500" />
              <span>{selectedAccountIds.length} Accs</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. iOS Segmented Horizon Picker */}
        {/* ================================================================= */}
        <div className="p-1 rounded-2xl bg-black/5 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.04] flex items-center gap-1 overflow-x-auto no-scrollbar scroll-touch">
          {HORIZON_OPTIONS.map((h) => {
            const isActive = forecastDuration === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setForecastDuration(h.id)}
                className={`flex-1 min-w-[42px] py-1.5 rounded-xl text-xs font-extrabold transition-all text-center ${
                  isActive
                    ? 'bg-white dark:bg-[#2c2d30] text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary opacity-70 hover:opacity-100'
                }`}
              >
                {h.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* 3. iOS Main View Tabs (Projection / Goals / Ledger) */}
        {/* ================================================================= */}
        <div className="flex bg-black/5 dark:bg-white/[0.06] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.04]">
          <button
            type="button"
            onClick={() => setActiveTab('projection')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'projection'
                ? 'bg-white dark:bg-[#2c2d30] text-light-text dark:text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="line_chart_up" className="text-sm text-primary-500" />
            <span>Projection</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'goals'
                ? 'bg-white dark:bg-[#2c2d30] text-light-text dark:text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="flag" className="text-sm text-amber-500" />
            <span>Goals</span>
            {topLevelGoals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {topLevelGoals.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'ledger'
                ? 'bg-white dark:bg-[#2c2d30] text-light-text dark:text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="table_rows" className="text-sm text-emerald-500" />
            <span>Ledger</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: PROJECTION */}
        {/* ================================================================= */}
        {activeTab === 'projection' && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Wealth Projection Card */}
            <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-[#0c182a] via-[#12233c] to-[#1c1836] text-white p-5 shadow-xl border border-cyan-500/20">
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between text-xs text-cyan-200/80 font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Icon name="trending_up" className="text-sm text-cyan-400" />
                    <span>Projected Liquidity ({forecastDuration})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold">
                    {preferredCurrency}
                  </span>
                </div>

                <div>
                  <h2 className="text-3.5xl font-black tracking-tight text-white privacy-blur leading-none">
                    {formatCurrency(endBalance, curr)}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        netChange >= 0
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      <Icon name={netChange >= 0 ? 'trending_up' : 'trending_down'} className="text-xs" />
                      {growthPercent >= 0 ? '+' : ''}
                      {growthPercent.toFixed(1)}% ({formatCurrency(netChange, curr, { showPlusSign: true })})
                    </span>
                    <span className="text-xs text-white/60 font-medium">
                      from {formatCurrency(startBalance, curr)}
                    </span>
                  </div>
                </div>

                {/* Sub-Metrics Inset Grid */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-cyan-200/90 uppercase tracking-wider">
                        Lowest Point
                      </span>
                      <Icon name="warning" className="text-xs text-amber-400" />
                    </div>
                    <p className="text-sm font-bold text-white privacy-blur">
                      {formatCurrency(lowestPoint?.value || 0, curr)}
                    </p>
                    {lowestPoint?.date && (
                      <p className="text-xs text-white/60 font-medium mt-0.5">
                        on {parseLocalDate(lowestPoint.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>

                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-cyan-200/90 uppercase tracking-wider">
                        Cash Runway
                      </span>
                      <Icon name="hourglass_top" className="text-xs text-emerald-400" />
                    </div>
                    <p className="text-sm font-bold text-emerald-400">
                      {runwayMonths >= 36 ? '36+ Months' : `${runwayMonths.toFixed(1)} Months`}
                    </p>
                    <p className="text-xs text-white/60 font-medium mt-0.5">
                      at current trajectory
                    </p>
                  </div>
                </div>
              </div>

              {/* Ambient Glow mesh */}
              <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none -z-1" />
              <div className="absolute bottom-0 left-0 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-1" />
            </div>

            {/* Quick Scenario Tuning Bar */}
            {isAssumptionsModified && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                    <Icon name="sliders" className="text-base" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                      Active Scenario Adjustments
                    </p>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Savings +{assumptions.savingsRateAdjustment}% • Return {assumptions.marketReturn}% • Infl {assumptions.inflationRate}%
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAssumptions({
                      savingsRateAdjustment: 0,
                      marketReturn: 0,
                      inflationRate: 0,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold shadow-xs active:scale-95"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Interactive Forecast Chart Card */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-light-text dark:text-white tracking-tight">
                    Cash Flow Trajectory
                  </h3>
                  <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                    Tap any point on the curve to inspect daily events
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setShowIndividualLines(false)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                      !showIndividualLines
                        ? 'bg-white dark:bg-[#2c2d30] text-primary-600 dark:text-primary-400 shadow-xs'
                        : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60'
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIndividualLines(true)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                      showIndividualLines
                        ? 'bg-white dark:bg-[#2c2d30] text-primary-600 dark:text-primary-400 shadow-xs'
                        : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60'
                    }`}
                  >
                    Split
                  </button>
                </div>
              </div>

              {/* Chart container */}
              <div className="w-full pt-1">
                <ForecastChart
                  data={combinedChartData}
                  lowestPoint={lowestPoint}
                  oneTimeGoals={financialGoals.filter((g) => g.type === 'one-time')}
                  showIndividualLines={showIndividualLines}
                  accounts={selectedAccounts}
                  showGoalLines={showGoalLines}
                  onDataPointClick={onDataPointClick}
                />
              </div>

              {/* Chart Footer Toggles */}
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGoalLines}
                    onChange={(e) => setShowGoalLines(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Show Financial Goals</span>
                </label>

                <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-50">
                  {combinedChartData.length} timeline points
                </span>
              </div>
            </div>

            {/* Checkpoints / Period Lowest Outlook */}
            {lowestBalanceForecasts && lowestBalanceForecasts.length > 0 && (
              <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    Horizon Checkpoints
                  </h3>
                  <span className="text-xs font-bold text-primary-500">Min. Liquidity</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {lowestBalanceForecasts.map((item) => {
                    const isDeficit = item.lowestBalance < 0;
                    const isLow = item.lowestBalance < 1000;
                    return (
                      <div
                        key={item.period}
                        className={`p-3 rounded-2xl border transition-all ${
                          isDeficit
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                            : isLow
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                            {item.period}
                          </span>
                          <Icon
                            name={isDeficit ? 'error' : isLow ? 'warning' : 'check_circle'}
                            className="text-xs"
                          />
                        </div>
                        <p className="text-sm font-bold text-light-text dark:text-white privacy-blur">
                          {formatCurrency(item.lowestBalance, curr)}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60 mt-0.5">
                          {parseLocalDate(item.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Global Target Performance Overview */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center">
                    <Icon name="pie_chart" className="text-sm" />
                  </div>
                  <h3 className="text-sm font-bold text-light-text dark:text-white tracking-tight">
                    Target Allocation Progress
                  </h3>
                </div>
                <span className="text-xs font-black text-primary-500">{goalProgress.toFixed(0)}% Overall</span>
              </div>

              {/* Savings Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-primary-500 flex items-center gap-1">
                    <Icon name="savings" className="text-xs" /> Savings Target
                  </span>
                  <span className="text-light-text dark:text-white">
                    {formatCurrency(globalSavingsGoalCurrent, curr)} / {formatCurrency(globalSavingsGoalTarget, curr)}
                  </span>
                </div>
                <div className="w-full h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, savingsProgress)}%` }}
                  />
                </div>
              </div>

              {/* Income Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-emerald-500 flex items-center gap-1">
                    <Icon name="trending_up" className="text-xs" /> Income Target
                  </span>
                  <span className="text-light-text dark:text-white">
                    {formatCurrency(globalIncomeGoalCurrent, curr)} / {formatCurrency(globalIncomeGoalTarget, curr)}
                  </span>
                </div>
                <div className="w-full h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, incomeProgress)}%` }}
                  />
                </div>
              </div>

              {/* Expense Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-rose-500 flex items-center gap-1">
                    <Icon name="trending_down" className="text-xs" /> Expense Cap
                  </span>
                  <span className="text-light-text dark:text-white">
                    {formatCurrency(globalExpenseGoalCurrent, curr)} / {formatCurrency(globalExpenseGoalTarget, curr)}
                  </span>
                </div>
                <div className="w-full h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, expenseProgress)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: GOALS & TARGETS */}
        {/* ================================================================= */}
        {activeTab === 'goals' && (
          <div className="space-y-4 animate-fade-in">
            {/* Header Actions Bar */}
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary cursor-pointer bg-white dark:bg-dark-card px-3 py-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-xs">
                <input
                  type="checkbox"
                  checked={filterGoalsByAccount}
                  onChange={(e) => setFilterGoalsByAccount(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-primary-500 focus:ring-0 cursor-pointer"
                />
                <span>Filter by Account</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAllGoals}
                  className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline px-2 py-1"
                >
                  {areAllGoalsActive ? 'Deselect All' : 'Select All'}
                </button>

                <button
                  type="button"
                  onClick={() => onAddGoal()}
                  className="h-8 px-3 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95"
                >
                  <Icon name="add" className="text-sm" />
                  <span>New Goal</span>
                </button>
              </div>
            </div>

            {/* Goals List */}
            <div className="space-y-3">
              {topLevelGoals.length > 0 ? (
                topLevelGoals.map((goal) => {
                  const subGoals = goalsByParentId.get(goal.id) || [];
                  const isExpanded = expandedGoalIds.has(goal.id);
                  const isGoalActive = activeGoalIds.includes(goal.id);
                  const categoryMeta =
                    GOAL_CATEGORY_META[goal.goalCategory || 'savings'] ||
                    GOAL_CATEGORY_META.savings;

                  const progress =
                    goal.amount > 0
                      ? Math.min(100, (goal.currentAmount / goal.amount) * 100)
                      : 0;

                  return (
                    <div
                      key={goal.id}
                      className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3 overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => onEditGoal(goal)}
                        >
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: categoryMeta.color }}
                          >
                            <Icon name={categoryMeta.icon} className="text-lg" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-light-text dark:text-white truncate">
                                {goal.name}
                              </h4>
                              {goal.isBucket && (
                                <span className="px-1.5 py-0.5 rounded-md text-2xs font-semibold uppercase bg-primary-500/10 text-primary-500 border border-primary-500/20">
                                  Bucket ({subGoals.length})
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                              {categoryMeta.label}
                              {goal.date
                                ? ` • Target: ${parseLocalDate(goal.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                : ''}
                            </p>
                          </div>
                        </div>

                        {/* Goal Inclusion Toggle */}
                        <button
                          type="button"
                          onClick={() => onToggleGoal(goal.id)}
                          aria-label={isGoalActive ? 'Exclude goal' : 'Include goal'}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isGoalActive
                              ? 'bg-primary-500 text-white shadow-xs'
                              : 'border-2 border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isGoalActive && <Icon name="check" className="text-xs" />}
                        </button>
                      </div>

                      {/* Progress Bar & Amounts */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-light-text dark:text-white">
                            {formatCurrency(goal.currentAmount, goal.currency)}
                            <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-50 font-medium">
                              {' '}
                              / {formatCurrency(goal.amount, goal.currency)}
                            </span>
                          </span>
                          <span className="text-primary-500">{progress.toFixed(0)}%</span>
                        </div>

                        <div className="w-full h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: categoryMeta.color,
                            }}
                          />
                        </div>
                      </div>

                      {/* Card Action Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                        {goal.isBucket && subGoals.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => toggleExpandGoal(goal.id, e)}
                            className="text-primary-600 dark:text-primary-400 font-bold flex items-center gap-1"
                          >
                            <span>{subGoals.length} Sub-goals</span>
                            <Icon
                              name={isExpanded ? 'expand_less' : 'expand_more'}
                              className="text-sm"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                            {goal.type === 'one-time' ? 'One-time target' : 'Recurring target'}
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          {goal.isBucket && (
                            <button
                              type="button"
                              onClick={() => onAddGoal(goal.id)}
                              className="text-xs font-bold text-primary-500 hover:underline"
                            >
                              + Sub-goal
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditGoal(goal)}
                            className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteGoal(goal)}
                            className="text-xs font-bold text-rose-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Sub-goals Expanded List */}
                      {isExpanded && subGoals.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 space-y-2 pl-3 border-l-2 border-primary-500/30">
                          {subGoals.map((sub) => {
                            const subProgress =
                              sub.amount > 0
                                ? Math.min(100, (sub.currentAmount / sub.amount) * 100)
                                : 0;
                            return (
                              <div
                                key={sub.id}
                                onClick={() => onEditGoal(sub)}
                                className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="text-xs font-bold text-light-text dark:text-white truncate">
                                    {sub.name}
                                  </p>
                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    {formatCurrency(sub.currentAmount, sub.currency)} /{' '}
                                    {formatCurrency(sub.amount, sub.currency)} ({subProgress.toFixed(0)}%)
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteGoal(sub);
                                  }}
                                  className="text-light-text-secondary hover:text-rose-500 p-1"
                                >
                                  <Icon name="delete" className="text-xs" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-white dark:bg-dark-card rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-6">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                    <Icon name="flag" className="text-2xl" />
                  </div>
                  <h4 className="text-base font-bold text-light-text dark:text-white mb-1">
                    No Financial Goals
                  </h4>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-xs mb-4">
                    Set up future milestones and targets to simulate your savings path.
                  </p>
                  <button
                    type="button"
                    onClick={() => onAddGoal()}
                    className="px-4 py-2 rounded-full bg-primary-500 text-white text-xs font-bold shadow-sm"
                  >
                    Create Goal
                  </button>
                </div>
              )}
            </div>

            {/* Monthly Target Schedule Accordion */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-light-text dark:text-white">
                    Target Allocation Schedule
                  </h3>
                  <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                    Monthly breakdown of expected goal contributions
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setScheduleMode('account')}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                      scheduleMode === 'account'
                        ? 'bg-white dark:bg-[#2c2d30] text-primary-500 shadow-xs'
                        : 'text-light-text-secondary opacity-60'
                    }`}
                  >
                    Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleMode('date')}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                      scheduleMode === 'date'
                        ? 'bg-white dark:bg-[#2c2d30] text-primary-500 shadow-xs'
                        : 'text-light-text-secondary opacity-60'
                    }`}
                  >
                    Date
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {scheduleMode === 'account' ? (
                  monthlyPaymentBreakdown && monthlyPaymentBreakdown.length > 0 ? (
                    monthlyPaymentBreakdown.map((account) => (
                      <div
                        key={account.id}
                        className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary-500" />
                          <span className="text-xs font-bold text-light-text dark:text-white truncate">
                            {account.name}
                          </span>
                        </div>
                        <div className="space-y-1 pl-3 border-l border-primary-500/20">
                          {Object.entries(account.months).map(([monthKey, breakdown]: [string, any]) => {
                            const date = new Date(monthKey + '-02');
                            const monthName = date.toLocaleDateString('default', {
                              month: 'short',
                              year: 'numeric',
                            });
                            return (
                              <div key={monthKey} className="flex justify-between items-center text-xs">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">
                                  {monthName}
                                </span>
                                <div className="flex items-center gap-3">
                                  {breakdown.savings > 0 && (
                                    <span className="font-bold text-primary-500">
                                      {formatCurrency(breakdown.savings, account.currency)}
                                    </span>
                                  )}
                                  {breakdown.income > 0 && (
                                    <span className="font-bold text-emerald-500">
                                      +{formatCurrency(breakdown.income, account.currency)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center text-light-text-secondary py-4 opacity-50">
                      No upcoming goal target schedules.
                    </p>
                  )
                ) : monthlyDateBreakdown && monthlyDateBreakdown.length > 0 ? (
                  monthlyDateBreakdown.map((month: any) => (
                    <div
                      key={month.monthKey}
                      className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2"
                    >
                      <span className="text-xs font-bold text-primary-500">{month.monthName}</span>
                      <div className="space-y-1">
                        {month.accounts.map((acc: any) => (
                          <div key={acc.id} className="flex justify-between items-center text-xs">
                            <span className="text-light-text dark:text-white truncate max-w-[160px]">
                              {acc.name}
                            </span>
                            <span className="font-bold text-primary-500">
                              {formatCurrency(acc.savings || acc.income, acc.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center text-light-text-secondary py-4 opacity-50">
                    No upcoming goal target schedules.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: LEDGER (DAILY PROJECTION FEED) */}
        {/* ================================================================= */}
        {activeTab === 'ledger' && (
          <div className="space-y-4 animate-fade-in">
            {/* Timeline Summary Header */}
            <div className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  Forecast Timeline Ledger
                </h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Tap any entry to modify or inspect daily projections
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary-500/10 text-primary-500">
                {groupedTableData.reduce((sum, g) => sum + g.rows.length, 0)} Events
              </span>
            </div>

            {/* Monthly Accordion Sections */}
            <div className="space-y-3">
              {groupedTableData.length > 0 ? (
                groupedTableData.map((group) => (
                  <div
                    key={group.monthKey}
                    className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm overflow-hidden"
                  >
                    {/* Month Header Banner */}
                    <div className="px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                      <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                        {group.monthName} {group.year}
                      </span>
                      <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                        {group.rows.length} Events • Min: {formatCurrency(group.minBalance, curr)}
                      </span>
                    </div>

                    {/* Events List */}
                    <div className="divide-y divide-black/5 dark:divide-white/5">
                      {group.rows.map((row) => {
                        const isLowest =
                          lowestPoint?.value !== undefined &&
                          Math.abs(row.balance - lowestPoint.value) < 0.01;
                        const isMonthlyLowest =
                          Math.abs(row.balance - group.minBalance) < 0.01 && !isLowest;

                        const isPositive = row.amount >= 0;

                        return (
                          <div
                            key={row.id}
                            onClick={() => onEditForecastItem(row)}
                            className={`p-3 flex items-center justify-between gap-3 active:bg-black/5 transition-colors cursor-pointer relative ${
                              isLowest
                                ? 'bg-rose-500/[0.04]'
                                : isMonthlyLowest
                                ? 'bg-amber-500/[0.03]'
                                : ''
                            }`}
                          >
                            {/* Left indicator marker */}
                            {isLowest && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
                            )}
                            {isMonthlyLowest && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                            )}

                            {/* Date Badge */}
                            <div className="w-11 text-center shrink-0">
                              <span className="block text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                {parseLocalDate(row.date).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                              <span className="block text-sm font-bold text-light-text dark:text-white">
                                {parseLocalDate(row.date).getDate()}
                              </span>
                            </div>

                            {/* Center Event Details */}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-light-text dark:text-white truncate">
                                {row.description}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary truncate">
                                  {row.accountName}
                                </span>
                                <span className="text-xs opacity-40">•</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-2xs font-semibold uppercase tracking-wider ${
                                    row.type === 'Financial Goal'
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                      : row.type === 'Bill/Payment'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                                  }`}
                                >
                                  {row.type === 'Financial Goal'
                                    ? 'Goal'
                                    : row.type === 'Bill/Payment'
                                    ? 'Bill'
                                    : 'Recurring'}
                                </span>
                              </div>
                            </div>

                            {/* Right Amounts */}
                            <div className="text-right shrink-0">
                              <p
                                className={`text-xs font-bold ${
                                  isPositive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-light-text dark:text-white'
                                }`}
                              >
                                {formatCurrency(row.amount, curr, { showPlusSign: true })}
                              </p>
                              <p className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                Proj: {formatCurrency(row.balance, curr)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-light-text-secondary opacity-50 bg-white dark:bg-dark-card rounded-3xl p-6">
                  <Icon name="event_busy" className="text-3xl mb-2" />
                  <p className="text-xs font-bold">No projection events for this horizon.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. BottomSheet: Account Filter Selection */}
        {/* ================================================================= */}
        <BottomSheet
          isOpen={isAccountSheetOpen}
          onClose={() => setIsAccountSheetOpen(false)}
          title="Forecast Accounts"
          subtitle="Select accounts included in projection calculation"
        >
          <div className="space-y-4 p-4">
            {/* Quick Presets */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectLiquidOnly}
                className="flex-1 py-2 rounded-2xl bg-black/5 dark:bg-white/10 text-xs font-bold text-light-text dark:text-white shadow-xs active:scale-95"
              >
                Liquid Accounts Only
              </button>
              <button
                type="button"
                onClick={selectAllAccounts}
                className="flex-1 py-2 rounded-2xl bg-black/5 dark:bg-white/10 text-xs font-bold text-light-text dark:text-white shadow-xs active:scale-95"
              >
                Select All ({accounts.length})
              </button>
            </div>

            {/* Accounts List */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto no-scrollbar">
              {accounts.map((acc) => {
                const isSelected = selectedAccountIds.includes(acc.id);
                const convertedBal = formatCurrency(
                  convertCurrency(acc.balance, acc.currency, curr, conversionRates),
                  curr
                );
                return (
                  <div
                    key={acc.id}
                    onClick={() => toggleAccount(acc.id)}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-500/10 border-primary-500/30'
                        : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-primary-500 border-primary-500 text-white'
                            : 'border-gray-400 dark:border-gray-600'
                        }`}
                      >
                        {isSelected && <Icon name="check" className="text-xs" />}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-light-text dark:text-white truncate">
                          {acc.name}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {acc.type}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-light-text dark:text-white shrink-0">
                      {convertedBal}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsAccountSheetOpen(false)}
              className="w-full py-3 rounded-2xl bg-primary-500 text-white text-sm font-bold shadow-md active:scale-98"
            >
              Apply Selection ({selectedAccountIds.length})
            </button>
          </div>
        </BottomSheet>

        {/* ================================================================= */}
        {/* 5. BottomSheet: Scenario Playground Tuning */}
        {/* ================================================================= */}
        <BottomSheet
          isOpen={isPlaygroundSheetOpen}
          onClose={() => setIsPlaygroundSheetOpen(false)}
          title="Scenario Playground"
          subtitle="Adjust macro assumptions to test financial sensitivity"
        >
          <div className="space-y-5 p-4">
            {/* Savings Rate Adjustment Slider */}
            <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-light-text dark:text-white">
                  Savings Boost
                </span>
                <span className="text-xs font-bold text-primary-500">
                  +{assumptions.savingsRateAdjustment}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={assumptions.savingsRateAdjustment}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    savingsRateAdjustment: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-primary-500 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Increases all recurring monthly savings and investments.
              </p>
            </div>

            {/* Market Return Rate Slider */}
            <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-light-text dark:text-white">
                  Annual Market Return
                </span>
                <span className="text-xs font-bold text-emerald-500">
                  {assumptions.marketReturn}%
                </span>
              </div>
              <input
                type="range"
                min="-10"
                max="15"
                step="1"
                value={assumptions.marketReturn}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    marketReturn: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-emerald-500 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Estimated compounded return across investment accounts.
              </p>
            </div>

            {/* Inflation Rate Slider */}
            <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-light-text dark:text-white">
                  Annual Inflation
                </span>
                <span className="text-xs font-bold text-rose-500">
                  {assumptions.inflationRate}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={assumptions.inflationRate}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    inflationRate: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-rose-500 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Projects compounding increase on all recurring expenses.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setAssumptions({
                    savingsRateAdjustment: 0,
                    marketReturn: 0,
                    inflationRate: 0,
                  })
                }
                className="flex-1 py-3 rounded-2xl bg-black/5 dark:bg-white/10 text-xs font-bold text-light-text dark:text-white"
              >
                Reset to Baseline
              </button>
              <button
                type="button"
                onClick={() => setIsPlaygroundSheetOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-primary-500 text-white text-xs font-bold shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </BottomSheet>
      </div>
    </PullToRefresh>
  );
};
