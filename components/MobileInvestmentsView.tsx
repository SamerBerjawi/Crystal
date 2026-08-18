import React, { useState, useMemo, useCallback } from 'react';
import {
  Account,
  InvestmentTransaction,
  Warrant,
  HoldingsOverview,
  Currency,
  InvestmentSubType,
  Transaction,
} from '../types';
import {
  formatCurrency,
  convertCurrency,
  parseLocalDate,
  toLocalISOString,
} from '../utils';
import { INVESTMENT_SUB_TYPE_STYLES } from '../constants';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

export type InvestmentMobileTab = 'holdings' | 'accounts' | 'performance' | 'activity';
export type InvestmentSegment =
  | 'all'
  | 'Stock'
  | 'ETF'
  | 'Crypto'
  | 'Warrant'
  | 'Spare Change'
  | 'Pension Fund'
  | 'Other';

export interface MobileInvestmentsViewProps {
  accounts: Account[];
  cashAccounts: Account[];
  investmentTransactions: InvestmentTransaction[];
  warrants: Warrant[];
  transactions: Transaction[];
  prices: Record<string, number | null>;
  manualPrices: Record<string, number | undefined>;

  holdingsOverview?: HoldingsOverview;
  globalOverview: HoldingsOverview;
  activeOverview: HoldingsOverview;
  displayHoldings: any[];
  holdingsByType: [string, any[]][];
  segmentValues: Record<string, number>;
  segmentMetrics: { totalValue: number; details: any[] };
  recentActivity: any[];
  realizedPerformance: {
    realizedSales: any[];
    totalRealizedGain: number;
    winsCount: number;
    lossesCount: number;
    biggestWin: { symbol: string; gain: number; gainPercent: number };
    biggestLoss: { symbol: string; gain: number; gainPercent: number };
  };

  activeSegment: InvestmentSegment;
  setActiveSegment: (seg: InvestmentSegment) => void;
  segments: { id: InvestmentSegment; label: string; icon: string; color: string }[];
  showInactiveHoldings: boolean;
  setShowInactiveHoldings: (show: boolean) => void;

  onOpenHoldingDetail: (symbol: string) => void;
  onAddTransaction: (tx?: InvestmentTransaction) => void;
  onAddWarrant: (w?: Warrant) => void;
  onEditAccount: (account: Account) => void;
  onAdjustBalance: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  onDeleteActivity: (id: string, isWarrant: boolean) => void;
  onOpenPriceModal: (symbol: string, name: string, currentPrice: number | null) => void;
  onUpdateAllPrices: () => Promise<void>;
  isUpdatingPrices: boolean;
  onViewAccount?: (accountId: string) => void;
  onOverviewClick?: (account: Account) => void;
  preferredCurrency?: string;
  conversionRates?: any;
}

const ASSET_TYPE_COLORS: Record<string, string> = {
  Stock: '#3b82f6',
  ETF: '#0d9488',
  Crypto: '#f59e0b',
  Warrant: '#f43f5e',
  'Spare Change': '#10b981',
  'Pension Fund': '#8b5cf6',
  Other: '#64748b',
};

export const MobileInvestmentsView: React.FC<MobileInvestmentsViewProps> = ({
  accounts,
  cashAccounts,
  investmentTransactions,
  warrants,
  transactions,
  prices,
  manualPrices,
  holdingsOverview,
  globalOverview,
  activeOverview,
  displayHoldings,
  holdingsByType,
  segmentValues,
  segmentMetrics,
  recentActivity,
  realizedPerformance,
  activeSegment,
  setActiveSegment,
  segments,
  showInactiveHoldings,
  setShowInactiveHoldings,
  onOpenHoldingDetail,
  onAddTransaction,
  onAddWarrant,
  onEditAccount,
  onAdjustBalance,
  onDeleteAccount,
  onDeleteActivity,
  onOpenPriceModal,
  onUpdateAllPrices,
  isUpdatingPrices,
  onViewAccount,
  onOverviewClick,
  preferredCurrency = 'EUR',
  conversionRates,
}) => {
  const [activeTab, setActiveTab] = useState<InvestmentMobileTab>('holdings');
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);

  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onUpdateAllPrices) {
      await onUpdateAllPrices();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const investmentAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'Investment' && a.status !== 'closed'),
    [accounts]
  );

  const currentSegmentTotal = segmentValues[activeSegment] ?? segmentValues.all ?? 0;
  const { totalCostBasis, totalValue } = activeOverview;
  const totalUnrealizedGain = totalValue - totalCostBasis;
  const totalGainPercent = totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : 0;

  // Pie chart data for allocation
  const allocationPieData: PieData[] = useMemo(() => {
    const list = Object.entries(segmentValues)
      .filter(([k, val]) => k !== 'all' && val > 0)
      .map(([k, val]) => ({
        label: k,
        value: val,
        color: ASSET_TYPE_COLORS[k] || '#6366f1',
      }));

    return list.sort((a, b) => b.value - a.value);
  }, [segmentValues]);

  // Synthetic 14-day growth sparkline for the hero card
  const sparklineData = useMemo(() => {
    const points = [];
    const base = currentSegmentTotal > 0 ? currentSegmentTotal : 1000;
    const isPositive = totalUnrealizedGain >= 0;
    const numPoints = 14;
    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);
      const curve = Math.sin(progress * Math.PI * 1.5) * 0.05;
      const noise = ((i % 3) - 1) * 0.015;
      const factor = isPositive ? 0.92 + progress * 0.08 + curve + noise : 1.08 - progress * 0.08 + curve + noise;
      points.push({
        day: `D${i + 1}`,
        value: base * factor,
      });
    }
    // Anchor last point exactly to currentSegmentTotal
    if (points.length > 0) {
      points[points.length - 1].value = currentSegmentTotal;
    }
    return points;
  }, [currentSegmentTotal, totalUnrealizedGain]);

  // Top 5 Holdings for comparison chart
  const topHoldingsChartData = useMemo(() => {
    return displayHoldings
      .filter((h) => (h.currentValue || 0) > 0)
      .slice(0, 5)
      .map((h) => ({
        name: h.symbol || h.name,
        value: h.currentValue || 0,
        cost: h.totalCost || 0,
        gain: (h.currentValue || 0) - (h.totalCost || 0),
        color: ASSET_TYPE_COLORS[h.subType || (h.type === 'Warrant' ? 'Warrant' : 'Stock')] || '#0d9488',
      }));
  }, [displayHoldings]);

  // Segment Hero Gradient
  const heroGradient = useMemo(() => {
    switch (activeSegment) {
      case 'Stock':
        return 'from-[#0b1b36] via-[#10274e] to-[#1c183d] border-blue-500/20';
      case 'ETF':
        return 'from-[#062424] via-[#0b3838] to-[#182a35] border-teal-500/20';
      case 'Crypto':
        return 'from-[#2e1d05] via-[#432906] to-[#25152b] border-amber-500/20';
      case 'Warrant':
        return 'from-[#2d0915] via-[#440e20] to-[#241334] border-rose-500/20';
      case 'Spare Change':
        return 'from-[#06241b] via-[#0d3b2c] to-[#142337] border-emerald-500/20';
      case 'Pension Fund':
        return 'from-[#1c0c32] via-[#2d1252] to-[#1d1639] border-purple-500/20';
      default:
        return 'from-[#0d172e] via-[#132347] to-[#1d1438] border-indigo-500/20';
    }
  }, [activeSegment]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4 pb-28 animate-fade-in md:hidden font-sans select-none">
        {/* ================================================================= */}
        {/* 1. iOS Top Navigation Header */}
        {/* ================================================================= */}
        <div className="pt-2 px-1 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 leading-none mb-1">
              Portfolio & Wealth
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-light-text dark:text-white tracking-tight leading-tight">
                Investments
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Live Tracking
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Update Prices Trigger */}
            <button
              type="button"
              onClick={onUpdateAllPrices}
              disabled={isUpdatingPrices}
              aria-label="Update Live Prices"
              className={`h-9 px-3 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all border shadow-xs active:scale-95 ${
                isUpdatingPrices
                  ? 'bg-teal-500 text-white border-teal-600 opacity-80'
                  : 'bg-white/80 dark:bg-dark-card/80 border-black/10 dark:border-white/10 text-light-text dark:text-white hover:bg-black/5'
              }`}
            >
              <Icon
                name="refresh"
                className={`text-sm ${isUpdatingPrices ? 'animate-spin text-white' : 'text-teal-500'}`}
              />
              <span>{isUpdatingPrices ? 'Syncing...' : 'Prices'}</span>
            </button>

            {/* Quick Action Button */}
            <button
              type="button"
              onClick={() => onAddTransaction()}
              aria-label="Add Investment Action"
              className="h-9 w-9 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-md shadow-teal-500/25 active:scale-95 cursor-pointer"
            >
              <Icon name="add" className="text-xl" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. iOS Segmented Asset Class Filter */}
        {/* ================================================================= */}
        <div className="p-1 rounded-2xl bg-black/5 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.04] flex items-center gap-1 overflow-x-auto no-scrollbar scroll-touch">
          {segments.map((seg) => {
            const isActive = activeSegment === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => setActiveSegment(seg.id)}
                className={`flex-1 min-w-[58px] py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all text-center whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-[#2c2d30] text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary opacity-70 hover:opacity-100'
                }`}
              >
                {seg.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* 3. Hero Investment Portfolio Card with Interactive Sparkline */}
        {/* ================================================================= */}
        <div
          className={`relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br ${heroGradient} text-white p-5 shadow-xl border`}
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between text-xs text-white/80 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Icon name="candlestick_chart" className="text-sm text-teal-400" />
                <span>
                  {activeSegment === 'all' ? 'Total Portfolio Value' : `${activeSegment} Value`}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold">
                {preferredCurrency}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-3.5xl font-black tracking-tight text-white privacy-blur leading-none">
                  {formatCurrency(currentSegmentTotal, curr)}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      totalUnrealizedGain >= 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    <Icon
                      name={totalUnrealizedGain >= 0 ? 'trending_up' : 'trending_down'}
                      className="text-xs"
                    />
                    {totalUnrealizedGain >= 0 ? '+' : ''}
                    {formatCurrency(totalUnrealizedGain, curr)} ({totalGainPercent.toFixed(1)}%)
                  </span>
                  <span className="text-xs text-white/60 font-medium">
                    Basis: {formatCurrency(totalCostBasis, curr)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sparkline Graph Area */}
            <div className="h-16 w-full -mx-1 pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="invHeroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#14b8a6"
                    strokeWidth={2.5}
                    fill="url(#invHeroGradient)"
                    dot={false}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Inset Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Holdings
                </span>
                <span className="text-xs font-bold text-white">
                  {displayHoldings.length} Positions
                </span>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Realized P&L
                </span>
                <span
                  className={`text-xs font-bold ${
                    realizedPerformance.totalRealizedGain >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {realizedPerformance.totalRealizedGain >= 0 ? '+' : ''}
                  {formatCurrency(realizedPerformance.totalRealizedGain, curr)}
                </span>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Win Rate
                </span>
                <span className="text-xs font-bold text-teal-400">
                  {realizedPerformance.winsCount + realizedPerformance.lossesCount > 0
                    ? `${Math.round(
                        (realizedPerformance.winsCount /
                          (realizedPerformance.winsCount + realizedPerformance.lossesCount)) *
                          100
                      )}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Ambient Glow mesh */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-teal-500/15 rounded-full blur-3xl pointer-events-none -z-1" />
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-1" />
        </div>

        {/* ================================================================= */}
        {/* 4. Main Sub-View Tabs */}
        {/* ================================================================= */}
        <div className="flex bg-black/5 dark:bg-white/[0.06] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.04]">
          <button
            type="button"
            onClick={() => setActiveTab('holdings')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'holdings'
                ? 'bg-white dark:bg-[#2c2d30] text-light-text dark:text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="candlestick_chart" className="text-sm text-teal-500" />
            <span>Holdings ({displayHoldings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'accounts'
                ? 'bg-white dark:bg-[#2c2d30] text-light-text dark:text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="account_balance" className="text-sm text-blue-500" />
            <span>Accounts ({investmentAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'performance'
                ? 'bg-white dark:bg-[#2c2d30] text-light-text dark:text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="pie_chart" className="text-sm text-amber-500" />
            <span>Charts & P&L</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'activity'
                ? 'bg-white dark:bg-[#2c2d30] text-light-text dark:text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="history" className="text-sm text-indigo-500" />
            <span>Trades</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: HOLDINGS */}
        {/* ================================================================= */}
        {activeTab === 'holdings' && (
          <div className="space-y-4 animate-fade-in">
            {/* Holdings Controls Bar */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary cursor-pointer bg-white dark:bg-dark-card px-3 py-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-xs">
                <input
                  type="checkbox"
                  checked={showInactiveHoldings}
                  onChange={(e) => setShowInactiveHoldings(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-teal-500 focus:ring-0 cursor-pointer"
                />
                <span>Include Closed (0 Qty)</span>
              </label>

              <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                Swipe left for quick actions
              </span>
            </div>

            {/* Holdings Grouped Sections */}
            <div className="space-y-4">
              {holdingsByType.length > 0 ? (
                holdingsByType.map(([groupName, groupHoldings]) => (
                  <div
                    key={groupName}
                    className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm overflow-hidden"
                  >
                    {/* Inset Section Header */}
                    <div className="px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              ASSET_TYPE_COLORS[groupName] || ASSET_TYPE_COLORS.Stock,
                          }}
                        />
                        <span className="text-xs font-bold text-light-text dark:text-white">
                          {groupName}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                        {groupHoldings.length} item{groupHoldings.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Holdings Items */}
                    <div className="divide-y divide-black/5 dark:divide-white/5">
                      {groupHoldings.map((h) => {
                        const isWarrant = h.type === 'Warrant';
                        const isCustom = h.isCustomAccount;
                        const valueEur = h.currentValue || 0;
                        const gainEur = h.currentValue - (h.totalCost || 0);
                        const gainPct =
                          h.totalCost > 0 ? (gainEur / h.totalCost) * 100 : 0;

                        const color =
                          ASSET_TYPE_COLORS[h.subType || (isWarrant ? 'Warrant' : 'Stock')] ||
                          '#0d9488';

                        return (
                          <SwipeableRow
                            key={h.symbol || h.account?.id}
                            rightActions={[
                              {
                                icon: 'analytics',
                                bgClass: 'bg-teal-500',
                                label: 'Detail',
                                onAction: () => {
                                  if (isCustom && h.account) {
                                    if (onViewAccount) onViewAccount(h.account.id);
                                  } else {
                                    onOpenHoldingDetail(h.symbol);
                                  }
                                },
                              },
                              {
                                icon: 'edit',
                                bgClass: 'bg-indigo-500',
                                label: 'Price',
                                onAction: () =>
                                  onOpenPriceModal(
                                    h.symbol,
                                    h.name || h.symbol,
                                    h.currentPrice
                                  ),
                              },
                            ]}
                          >
                            <div
                              onClick={() => {
                                if (isCustom && h.account) {
                                  if (onOverviewClick) onOverviewClick(h.account);
                                  else if (onViewAccount) onViewAccount(h.account.id);
                                } else {
                                  onOpenHoldingDetail(h.symbol);
                                }
                              }}
                              className="p-3.5 flex items-center justify-between gap-3 active:bg-black/5 transition-colors cursor-pointer"
                            >
                              {/* Left Squircle & Ticker */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs"
                                  style={{ backgroundColor: color }}
                                >
                                  {h.symbol ? h.symbol.slice(0, 3).toUpperCase() : 'ACC'}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-light-text dark:text-white truncate">
                                      {h.name || h.symbol}
                                    </p>
                                  </div>
                                  <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                                    {isCustom
                                      ? h.qtyLabel || `${h.quantity} items`
                                      : `${h.quantity} shares • Avg: ${formatCurrency(h.averageCost || 0, curr)}`}
                                  </p>
                                </div>
                              </div>

                              {/* Right Amount & Gain % */}
                              <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-light-text dark:text-white privacy-blur">
                                  {formatCurrency(valueEur, curr)}
                                </p>
                                {!isCustom && (
                                  <p
                                    className={`text-xs font-semibold privacy-blur mt-0.5 ${
                                      gainEur >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                    }`}
                                  >
                                    {gainEur >= 0 ? '+' : ''}
                                    {gainPct.toFixed(1)}%
                                  </p>
                                )}
                              </div>
                            </div>
                          </SwipeableRow>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-light-text-secondary opacity-50 bg-white dark:bg-dark-card rounded-3xl p-6">
                  <Icon name="candlestick_chart" className="text-4xl mb-2 text-teal-500" />
                  <p className="text-sm font-bold text-light-text dark:text-white">
                    No active positions
                  </p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    Tap the + button above to add an investment or warrant.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ACCOUNTS */}
        {/* ================================================================= */}
        {activeTab === 'accounts' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  Investment Accounts
                </h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Brokerages, crypto wallets, and pension accounts
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAddTransaction()}
                className="h-8 px-3 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                <Icon name="add" className="text-sm" />
                <span>Add Position</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {investmentAccounts.map((acc) => {
                const convertedBal = formatCurrency(
                  convertCurrency(acc.balance, acc.currency, curr, conversionRates),
                  curr
                );
                return (
                  <SwipeableRow
                    key={acc.id}
                    rightActions={[
                      {
                        icon: 'tune',
                        bgClass: 'bg-amber-500',
                        label: 'Adjust',
                        onAction: () => onAdjustBalance(acc),
                      },
                      {
                        icon: 'edit',
                        bgClass: 'bg-indigo-500',
                        label: 'Edit',
                        onAction: () => onEditAccount(acc),
                      },
                    ]}
                  >
                    <div
                      onClick={() => onOverviewClick ? onOverviewClick(acc) : (onViewAccount && onViewAccount(acc.id))}
                      className="bg-white dark:bg-dark-card rounded-2xl p-4 border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between gap-3 min-h-[64px] active:bg-black/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center shrink-0 border border-teal-500/20">
                          <Icon name="account_balance" className="text-xl" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-light-text dark:text-white truncate">
                            {acc.name}
                          </p>
                          <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                            {acc.subType || acc.type}
                            {acc.financialInstitution ? ` • ${acc.financialInstitution}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-light-text dark:text-white privacy-blur">
                          {convertedBal}
                        </p>
                        <span className="text-xs font-semibold text-teal-500">Active</span>
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: PERFORMANCE, ALLOCATION & VISUAL CHARTS */}
        {/* ================================================================= */}
        {activeTab === 'performance' && (
          <div className="space-y-4 animate-fade-in">
            {/* Asset Allocation Donut Chart Card */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  Asset Class Allocation
                </h3>
                <span className="text-xs font-bold text-teal-500">
                  {formatCurrency(segmentValues.all, curr)}
                </span>
              </div>

              {/* BklitPieChart container */}
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
                  <PieCenter defaultLabel="Total">
                    {({ label }) => (
                      <div className="text-center">
                        <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block opacity-70">
                          {label}
                        </span>
                        <span className="text-sm font-black text-light-text dark:text-white privacy-blur">
                          {formatCurrency(segmentValues.all, curr)}
                        </span>
                      </div>
                    )}
                  </PieCenter>
                </BklitPieChart>
              </div>

              {/* Allocation Legend List */}
              <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                {allocationPieData.map((item) => {
                  const pct =
                    segmentValues.all > 0 ? (item.value / segmentValues.all) * 100 : 0;
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
                        <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-60 text-xs font-medium w-10 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Holdings Bar Chart Card */}
            {topHoldingsChartData.length > 0 && (
              <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-light-text dark:text-white">
                    Top Holdings by Valuation
                  </h3>
                  <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold">
                    Top {topHoldingsChartData.length}
                  </span>
                </div>

                <div className="h-44 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topHoldingsChartData}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fontWeight: 700, fill: '#888' }}
                        width={45}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val, curr), 'Value']}
                        contentStyle={{
                          borderRadius: '1rem',
                          background: 'rgba(20,20,25,0.95)',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {topHoldingsChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Realized Gains & Losses Card */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  Realized Trade Performance
                </h3>
                <span
                  className={`text-xs font-black ${
                    realizedPerformance.totalRealizedGain >= 0
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }`}
                >
                  {realizedPerformance.totalRealizedGain >= 0 ? '+' : ''}
                  {formatCurrency(realizedPerformance.totalRealizedGain, curr)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                    Biggest Win
                  </span>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                    {realizedPerformance.biggestWin.symbol || 'None'}
                  </p>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    +{formatCurrency(realizedPerformance.biggestWin.gain, curr)}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                    Biggest Loss
                  </span>
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 truncate mt-0.5">
                    {realizedPerformance.biggestLoss.symbol || 'None'}
                  </p>
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    {formatCurrency(realizedPerformance.biggestLoss.gain, curr)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ACTIVITY / TRADES */}
        {/* ================================================================= */}
        {activeTab === 'activity' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  Trade Activity Feed
                </h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Recent buy, sell, and warrant grant records
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-500">
                {recentActivity.length} Events
              </span>
            </div>

            <div className="space-y-2">
              {recentActivity.length > 0 ? (
                recentActivity.map((act) => {
                  const isBuy = act.type === 'BUY';
                  const isGrant = act.type === 'GRANT';
                  const totalAmt = (act.quantity || 0) * (act.price || 0);

                  return (
                    <SwipeableRow
                      key={act.id}
                      rightActions={[
                        {
                          icon: 'delete',
                          bgClass: 'bg-rose-500',
                          label: 'Delete',
                          onAction: () => onDeleteActivity(act.id, act.isWarrant),
                        },
                      ]}
                    >
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              isBuy
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : isGrant
                                ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            <Icon
                              name={isBuy ? 'add' : isGrant ? 'award' : 'remove'}
                              className="text-base"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-light-text dark:text-white truncate">
                                {act.symbol}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-2xs font-semibold uppercase tracking-wider ${
                                  isBuy
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : isGrant
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {act.type}
                              </span>
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 mt-0.5">
                              {parseLocalDate(act.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}{' '}
                              • {act.quantity} @ {formatCurrency(act.price, curr)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-light-text dark:text-white privacy-blur">
                            {formatCurrency(totalAmt, curr)}
                          </p>
                        </div>
                      </div>
                    </SwipeableRow>
                  );
                })
              ) : (
                <div className="py-12 text-center text-light-text-secondary opacity-50 bg-white dark:bg-dark-card rounded-3xl p-6">
                  <Icon name="history" className="text-3xl mb-2" />
                  <p className="text-xs font-bold">No investment trade records.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
};
