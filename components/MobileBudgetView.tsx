import React, { useState, useMemo } from 'react';
import {
  Budget,
  Category,
  Transaction,
  Currency,
  Account,
} from '../types';
import {
  formatCurrency,
  convertToEur,
} from '../utils';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import PullToRefresh from './PullToRefresh';
import BottomSheet from './BottomSheet';
import {
  PieChart as BklitPieChart,
  PieSlice,
  PieCenter,
  type PieData,
} from '../src/components/charts';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';

export type BudgetMobileTab = 'envelopes' | 'allocation' | 'assistant';
export type BudgetFilter = 'all' | 'warning' | 'over' | 'healthy';

export interface MobileBudgetViewProps {
  budgets: Budget[];
  transactions: Transaction[];
  expenseCategories: Category[];
  totalBudgeted: number;
  totalSpent: number;
  spendingByCategory: Record<string, number>;
  currentDate: Date;
  onMonthChange: (offset: number) => void;
  onAddBudget: (categoryName?: string) => void;
  onEditBudget: (budget: Budget) => void;
  onDeleteBudget: (id: string) => void;
  onApplyQuickBudget: (months: number) => void;
  onQuickCreateDefault: () => void;
  preferredCurrency?: string;
  onRefreshData?: () => Promise<void>;
}

export const MobileBudgetView: React.FC<MobileBudgetViewProps> = ({
  budgets,
  transactions,
  expenseCategories,
  totalBudgeted,
  totalSpent,
  spendingByCategory,
  currentDate,
  onMonthChange,
  onAddBudget,
  onEditBudget,
  onDeleteBudget,
  onApplyQuickBudget,
  onQuickCreateDefault,
  preferredCurrency = 'EUR',
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<BudgetMobileTab>('envelopes');
  const [activeFilter, setActiveFilter] = useState<BudgetFilter>('all');
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);
  const [isQuickBudgetSheetOpen, setIsQuickBudgetSheetOpen] = useState(false);

  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onRefreshData) {
      await onRefreshData();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const totalRemaining = totalBudgeted - totalSpent;
  const overallProgress = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const today = new Date();
  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();
  let daysRemaining = daysInMonth;

  if (
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getFullYear() === today.getFullYear()
  ) {
    daysRemaining = Math.max(1, daysInMonth - today.getDate());
  } else if (currentDate < today) {
    daysRemaining = 0;
  }

  const dailySafeSpend =
    daysRemaining > 0 ? Math.max(0, totalRemaining / daysRemaining) : 0;

  // Process category budget items
  const processedBudgets = useMemo(() => {
    return budgets.map((b) => {
      const cat = expenseCategories.find((c) => c.name === b.categoryName) || {
        id: b.id,
        name: b.categoryName,
        color: '#6366f1',
        icon: 'pie_chart',
        classification: 'expense',
        subCategories: [],
      };

      const spent = spendingByCategory[b.categoryName] || 0;
      const remaining = b.amount - spent;
      const progress = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const isOver = spent > b.amount;
      const isWarning = !isOver && progress >= 80;
      const isHealthy = !isOver && !isWarning;

      return {
        budget: b,
        category: cat,
        budgeted: b.amount,
        spent,
        remaining,
        progress,
        isOver,
        isWarning,
        isHealthy,
      };
    });
  }, [budgets, expenseCategories, spendingByCategory]);

  // Filter budgets based on active filter pill
  const filteredBudgets = useMemo(() => {
    return processedBudgets.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'warning') return item.isWarning;
      if (activeFilter === 'over') return item.isOver;
      if (activeFilter === 'healthy') return item.isHealthy;
      return true;
    });
  }, [processedBudgets, activeFilter]);

  // Allocation pie chart data
  const allocationPieData: PieData[] = useMemo(() => {
    return budgets
      .map((b) => {
        const cat = expenseCategories.find((c) => c.name === b.categoryName);
        return {
          label: b.categoryName,
          value: b.amount,
          color: cat?.color || '#6366f1',
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [budgets, expenseCategories]);

  // Daily Spending Pace Trajectory Data (Linear Pace vs Actual Spend)
  const trajectoryChartData = useMemo(() => {
    const data = [];
    const isCurrentMonth =
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;

    const dailyBudgetRate = totalBudgeted / daysInMonth;
    let accumulatedActual = 0;
    const dailyActualRate = currentDay > 0 ? totalSpent / currentDay : 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const targetPace = d * dailyBudgetRate;
      let actualVal: number | null = null;

      if (d <= currentDay) {
        // Accumulate linearly up to current totalSpent
        accumulatedActual = Math.min(d * dailyActualRate, totalSpent);
        actualVal = accumulatedActual;
      }

      data.push({
        day: `D${d}`,
        targetPace,
        actualSpend: actualVal,
      });
    }

    return data;
  }, [currentDate, today, daysInMonth, totalBudgeted, totalSpent]);

  // Category Comparison Chart Data (Budget vs Spent)
  const categoryComparisonChartData = useMemo(() => {
    return processedBudgets.slice(0, 6).map((item) => ({
      name: item.category.name.length > 8 ? `${item.category.name.slice(0, 8)}...` : item.category.name,
      Budget: item.budgeted,
      Spent: item.spent,
      color: item.category.color || '#a855f7',
    }));
  }, [processedBudgets]);

  // Unbudgeted spending categories
  const unbudgetedCategories = useMemo(() => {
    const budgetedNames = new Set(budgets.map((b) => b.categoryName));
    return Object.entries(spendingByCategory)
      .filter(([catName, spent]) => !budgetedNames.has(catName) && spent > 0)
      .map(([catName, spent]) => ({
        name: catName,
        spent,
        category: expenseCategories.find((c) => c.name === catName),
      }))
      .sort((a, b) => b.spent - a.spent);
  }, [budgets, spendingByCategory, expenseCategories]);

  const overCount = processedBudgets.filter((b) => b.isOver).length;
  const warningCount = processedBudgets.filter((b) => b.isWarning).length;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4 pb-28 animate-fade-in md:hidden font-sans select-none">
        {/* ================================================================= */}
        {/* 1. iOS Top Navigation Header */}
        {/* ================================================================= */}
        <div className="pt-2 px-1 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 leading-none mb-1">
              Monthly Guardrails
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-light-text dark:text-white tracking-tight leading-tight">
                Budgeting
              </h1>
              {overCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  {overCount} Over Limit
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Auto-Budget Trigger */}
            <button
              type="button"
              onClick={() => setIsQuickBudgetSheetOpen(true)}
              className="h-9 px-3 rounded-2xl bg-white/80 dark:bg-dark-card/80 border border-black/10 dark:border-white/10 text-light-text dark:text-white flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Icon name="zap" className="text-sm text-purple-500" />
              <span>Auto</span>
            </button>

            {/* Quick Action Button */}
            <button
              type="button"
              onClick={() => onAddBudget()}
              className="h-9 w-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/25 active:scale-95 transition-all"
            >
              <Icon name="add" className="text-xl" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. iOS Month Navigation Pills */}
        {/* ================================================================= */}
        <div className="p-1 rounded-2xl bg-black/5 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
          <button
            type="button"
            onClick={() => onMonthChange(-1)}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all"
          >
            <Icon name="chevron_left" className="text-lg" />
          </button>

          <div className="flex items-center gap-2">
            <Icon name="calendar" className="text-xs text-purple-500" />
            <span className="text-xs font-extrabold text-light-text dark:text-white tracking-wide">
              {monthName}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onMonthChange(1)}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all"
          >
            <Icon name="chevron_right" className="text-lg" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* 3. Hero Liquidity & Budget Progress Card */}
        {/* ================================================================= */}
        <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-[#1b0d2e] via-[#241240] to-[#120a22] text-white p-5 shadow-xl border border-purple-500/25">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between text-xs text-purple-200/80 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Icon name="pie_chart" className="text-sm text-purple-400" />
                <span>Available Liquidity</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold">
                {preferredCurrency}
              </span>
            </div>

            <div>
              <h2 className="text-3.5xl font-black tracking-tight text-white privacy-blur leading-none">
                {formatCurrency(totalRemaining, curr)}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    totalRemaining >= 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <Icon
                    name={totalRemaining >= 0 ? 'check_circle' : 'warning'}
                    className="text-xs"
                  />
                  {totalRemaining >= 0 ? 'Surplus Projection' : 'Deficit Expected'}
                </span>
                {daysRemaining > 0 && totalRemaining > 0 && (
                  <span className="text-xs text-purple-200/60 font-medium">
                    ~{formatCurrency(dailySafeSpend, curr)}/day safe
                  </span>
                )}
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    overallProgress > 100
                      ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                      : overallProgress > 80
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(overallProgress, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs font-bold text-white/70">
                <span>
                  Spent: <span className="text-white privacy-blur">{formatCurrency(totalSpent, curr)}</span> (
                  {overallProgress.toFixed(0)}%)
                </span>
                <span>
                  Cap: <span className="text-white privacy-blur">{formatCurrency(totalBudgeted, curr)}</span>
                </span>
              </div>
            </div>

            {/* Inset Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Envelopes
                </span>
                <span className="text-xs font-bold text-white">{budgets.length} Active</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Attention
                </span>
                <span
                  className={`text-xs font-bold ${
                    overCount + warningCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {overCount + warningCount} Items
                </span>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Days Left
                </span>
                <span className="text-xs font-bold text-purple-300">
                  {daysRemaining} Days
                </span>
              </div>
            </div>
          </div>

          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-purple-500/20 rounded-full blur-3xl pointer-events-none -z-1" />
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none -z-1" />
        </div>

        {/* ================================================================= */}
        {/* 4. Sub-View Tab Switcher */}
        {/* ================================================================= */}
        <div className="flex bg-black/5 dark:bg-white/[0.06] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.04]">
          <button
            type="button"
            onClick={() => setActiveTab('envelopes')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'envelopes'
                ? 'bg-white dark:bg-[#2c2d30] text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="pie_chart" className="text-sm text-purple-500" />
            <span>Envelopes ({budgets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'allocation'
                ? 'bg-white dark:bg-[#2c2d30] text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="donut_large" className="text-sm text-indigo-500" />
            <span>Charts & Pace</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'assistant'
                ? 'bg-white dark:bg-[#2c2d30] text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="zap" className="text-sm text-amber-500" />
            <span>Smart Auto</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: ENVELOPES / CATEGORY BUDGETS */}
        {/* ================================================================= */}
        {activeTab === 'envelopes' && (
          <div className="space-y-3.5 animate-fade-in">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-touch py-0.5">
              {[
                { id: 'all', label: `All (${processedBudgets.length})` },
                { id: 'warning', label: `Near Cap (${warningCount})` },
                { id: 'over', label: `Over (${overCount})` },
                { id: 'healthy', label: `Healthy` },
              ].map((f) => {
                const isActive = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id as BudgetFilter)}
                    className={`touch-feedback px-3 py-1.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap min-h-[34px] border ${
                      isActive
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white/80 dark:bg-dark-card/80 border-black/5 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Envelopes Stack */}
            <div className="space-y-3">
              {filteredBudgets.map((item) => {
                const { budget, category, budgeted, spent, remaining, progress, isOver, isWarning } =
                  item;

                const color = category.color || '#a855f7';
                const progressColor = isOver
                  ? 'bg-rose-500'
                  : isWarning
                  ? 'bg-amber-500'
                  : 'bg-emerald-400';

                return (
                  <SwipeableRow
                    key={budget.id}
                    rightActions={[
                      {
                        icon: 'edit',
                        bgClass: 'bg-indigo-500',
                        label: 'Edit',
                        onAction: () => onEditBudget(budget),
                      },
                      {
                        icon: 'delete',
                        bgClass: 'bg-rose-500',
                        label: 'Delete',
                        onAction: () => onDeleteBudget(budget.id),
                      },
                    ]}
                  >
                    <div
                      onClick={() => onEditBudget(budget)}
                      className="bg-white dark:bg-dark-card rounded-3xl p-4 border border-black/5 dark:border-white/5 shadow-sm space-y-3 active:bg-black/5 transition-colors cursor-pointer"
                    >
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: color }}
                          >
                            <Icon name={category.icon || 'pie_chart'} className="text-xl" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-light-text dark:text-white truncate">
                              {category.name}
                            </p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 mt-0.5">
                              Budget: {formatCurrency(budgeted, curr)} • {progress.toFixed(0)}% used
                            </p>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div className="text-right shrink-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              isOver
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : isWarning
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isOver ? 'Over Limit' : isWarning ? 'Near Limit' : 'On Track'}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                          <span>
                            Spent: <span className="privacy-blur font-bold text-light-text dark:text-white">{formatCurrency(spent, curr)}</span>
                          </span>
                          <span className={remaining < 0 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                            {remaining < 0 ? 'Over: ' : 'Left: '}
                            <span className="privacy-blur">{formatCurrency(Math.abs(remaining), curr)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })}

              {filteredBudgets.length === 0 && (
                <div className="py-12 text-center text-light-text-secondary opacity-50 bg-white dark:bg-dark-card rounded-3xl p-6">
                  <Icon name="pie_chart" className="text-4xl mb-2 text-purple-500" />
                  <p className="text-sm font-bold text-light-text dark:text-white">
                    No matching envelopes found
                  </p>
                </div>
              )}
            </div>

            {/* Unbudgeted Active Expenses Section */}
            {unbudgetedCategories.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-light-text dark:text-white">
                    Unbudgeted Spending This Month
                  </h3>
                  <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {unbudgetedCategories.length} categories
                  </span>
                </div>

                <div className="space-y-2">
                  {unbudgetedCategories.map((item) => (
                    <div
                      key={item.name}
                      onClick={() => onAddBudget(item.name)}
                      className="p-3.5 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between gap-3 active:bg-black/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                          <Icon name={item.category?.icon || 'folder'} className="text-sm" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-light-text dark:text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                            Spent: {formatCurrency(item.spent, curr)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddBudget(item.name);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs"
                      >
                        + Budget
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ALLOCATION & SPENDING PACE TRAJECTORY */}
        {/* ================================================================= */}
        {activeTab === 'allocation' && (
          <div className="space-y-4 animate-fade-in">
            {/* Daily Spending Pace Chart */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-light-text dark:text-white">
                    Cumulative Spending Velocity
                  </h3>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    Actual spend vs linear target pace
                  </p>
                </div>
                <span className="text-xs font-bold text-purple-500">
                  {formatCurrency(totalSpent, curr)}
                </span>
              </div>

              <div className="h-44 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trajectoryChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="budgetActualGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="budgetIdealGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val, curr)]}
                      contentStyle={{
                        borderRadius: '1rem',
                        backgroundColor: 'var(--tooltip-bg, #ffffff)',
                        border: '1px solid var(--tooltip-border, rgba(0, 0, 0, 0.08))',
                        color: 'var(--tooltip-text, #0f172a)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                        fontSize: '11px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ideal"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="url(#budgetIdealGradient)"
                      dot={false}
                      name="Ideal Linear"
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#a855f7"
                      strokeWidth={2.5}
                      fill="url(#budgetActualGradient)"
                      dot={false}
                      name="Actual Spent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-6 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-purple-500 rounded-full" />
                  <span>Actual Cumulative</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-b border-dashed border-gray-400" />
                  <span>Linear Pace Target</span>
                </div>
              </div>
            </div>

            {/* Category Budget vs Actual Bar Chart */}
            {categoryComparisonChartData.length > 0 && (
              <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-light-text dark:text-white">
                    Category Comparison (Budget vs Spent)
                  </h3>
                  <span className="text-xs font-semibold text-light-text-secondary">Top Envelopes</span>
                </div>

                <div className="h-48 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryComparisonChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val, curr)]}
                        contentStyle={{
                          borderRadius: '1rem',
                          backgroundColor: 'var(--tooltip-bg, #ffffff)',
                          border: '1px solid var(--tooltip-border, rgba(0, 0, 0, 0.08))',
                          color: 'var(--tooltip-text, #0f172a)',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                          fontSize: '11px',
                        }}
                      />
                      <Bar dataKey="Budget" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Spent" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Allocation Donut Chart Card */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  Budget Envelope Breakdown
                </h3>
                <span className="text-xs font-bold text-purple-500">
                  {formatCurrency(totalBudgeted, curr)}
                </span>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                <BklitPieChart
                  data={allocationPieData}
                  className="w-full h-full"
                  innerRadius={68}
                  padAngle={0.03}
                >
                  {allocationPieData.map((_, index) => (
                    <PieSlice key={index} index={index} />
                  ))}
                  <PieCenter defaultLabel="Monthly Cap">
                    {({ label }) => (
                      <div className="text-center">
                        <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block opacity-70">
                          {label}
                        </span>
                        <span className="text-sm font-bold text-light-text dark:text-white privacy-blur">
                          {formatCurrency(totalBudgeted, curr)}
                        </span>
                      </div>
                    )}
                  </PieCenter>
                </BklitPieChart>
              </div>

              {/* Allocation Legend List */}
              <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                {allocationPieData.map((item) => {
                  const pct = totalBudgeted > 0 ? (item.value / totalBudgeted) * 100 : 0;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-xs font-bold"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-light-text dark:text-white">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-light-text dark:text-white privacy-blur">
                          {formatCurrency(item.value, curr)}
                        </span>
                        <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-60 text-xs w-10 text-right font-medium">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SMART AUTO-BUDGET ASSISTANT */}
        {/* ================================================================= */}
        {activeTab === 'assistant' && (
          <div className="space-y-3.5 animate-fade-in">
            <div className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Icon name="zap" className="text-base" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-light-text dark:text-white">
                    Auto-Generate Budgets
                  </h3>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    Calculate envelopes from past actual spending
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { months: 1, title: 'Past 1 Month', desc: 'Based on immediate last month actuals' },
                { months: 3, title: 'Past 3 Months (Recommended)', desc: 'Balanced monthly average' },
                { months: 6, title: 'Past 6 Months', desc: 'Smoothed historical seasonal spending' },
              ].map((opt) => (
                <div
                  key={opt.months}
                  onClick={() => onApplyQuickBudget(opt.months)}
                  className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between gap-3 active:bg-purple-500/5 transition-all cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-light-text dark:text-white">
                      {opt.title}
                    </p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 mt-0.5">
                      {opt.desc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyQuickBudget(opt.months);
                    }}
                    className="h-8 px-3 rounded-xl bg-purple-600 text-white text-xs font-bold shrink-0 shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 5. BottomSheet: Quick Auto-Budget Selection */}
        {/* ================================================================= */}
        <BottomSheet
          isOpen={isQuickBudgetSheetOpen}
          onClose={() => setIsQuickBudgetSheetOpen(false)}
          title="Quick Budget Generator"
          subtitle="Generate category budgets automatically based on historical cash flow"
        >
          <div className="space-y-2.5 p-4">
            {[1, 3, 6].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setIsQuickBudgetSheetOpen(false);
                  onApplyQuickBudget(m);
                }}
                className="w-full p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between text-left active:bg-black/5 transition-all"
              >
                <div>
                  <p className="text-sm font-bold text-light-text dark:text-white">
                    Last {m} Month{m > 1 ? 's' : ''} Average
                  </p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    Populate budget targets based on actual {m}-month spending history
                  </p>
                </div>
                <Icon name="chevron_right" className="text-light-text-secondary text-lg" />
              </button>
            ))}
          </div>
        </BottomSheet>
      </div>
    </PullToRefresh>
  );
};
