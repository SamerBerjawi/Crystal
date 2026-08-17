import React, { useState, useMemo, useCallback } from 'react';
import {
  ScheduledItem,
  Currency,
  RecurringTransaction,
  BillPayment,
  Account,
  Category,
} from '../types';
import {
  formatCurrency,
  parseLocalDate,
  toLocalISOString,
} from '../utils';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import PullToRefresh from './PullToRefresh';
import BottomSheet from './BottomSheet';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

export type ScheduleMobileTab = 'timeline' | 'rules' | 'analytics' | 'overdue';

export interface MobileScheduleViewProps {
  scheduledItems: ScheduledItem[];
  groupedItems: Record<string, ScheduledItem[]>;
  sortedGroupKeys: string[];
  recurringList: any[];
  summaryMetrics: {
    income: number;
    expense: number;
    net: number;
    incCount: number;
    expCount: number;
  };
  categoryBreakdown: { name: string; value: number }[];
  majorInflow?: ScheduledItem | null;
  majorOutflow?: ScheduledItem | null;
  accounts: Account[];
  incomeCategories?: Category[];
  expenseCategories?: Category[];
  brandfetchClientId?: string;
  merchantLogoOverrides?: Record<string, string>;

  onProcessItem: (item: ScheduledItem) => void;
  onEditItem: (item: ScheduledItem) => void;
  onDeleteItem: (id: string, isRecurring: boolean) => void;
  onAddRecurring: () => void;
  onAddBill: () => void;
  onEndSeries?: (recurringId: string) => void;
  onExpireBill?: (billId: string) => void;

  preferredCurrency?: string;
  onRefreshData?: () => Promise<void>;
}

const PIE_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];

export const MobileScheduleView: React.FC<MobileScheduleViewProps> = ({
  scheduledItems,
  groupedItems,
  sortedGroupKeys,
  recurringList,
  summaryMetrics,
  categoryBreakdown,
  majorInflow,
  majorOutflow,
  accounts,
  incomeCategories = [],
  expenseCategories = [],
  brandfetchClientId,
  merchantLogoOverrides = {},
  onProcessItem,
  onEditItem,
  onDeleteItem,
  onAddRecurring,
  onAddBill,
  onEndSeries,
  onExpireBill,
  preferredCurrency = 'EUR',
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<ScheduleMobileTab>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});

  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onRefreshData) {
      await onRefreshData();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const accountMap = useMemo(() => {
    return accounts.reduce((acc, a) => {
      acc[a.id] = a.name;
      return acc;
    }, {} as Record<string, string>);
  }, [accounts]);

  const allCategories = useMemo(
    () => [...incomeCategories, ...expenseCategories],
    [incomeCategories, expenseCategories]
  );

  // Map user-configured categories by name (exact & lowercase)
  const categoryMap = useMemo(() => {
    const map = new Map<string, { icon?: string; color?: string; name: string }>();
    const walk = (nodes: Category[], parentColor?: string) => {
      nodes.forEach((n) => {
        map.set(n.name.toLowerCase(), {
          name: n.name,
          icon: n.icon,
          color: n.color || parentColor || '#6366f1',
        });
        if (n.subCategories && n.subCategories.length > 0) {
          walk(n.subCategories, n.color || parentColor);
        }
      });
    };
    walk(allCategories);
    return map;
  }, [allCategories]);

  // Logo load error handler
  const handleLogoError = useCallback((url: string) => {
    setLogoLoadErrors((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }, []);

  // Visual helper per scheduled item using configured properties directly
  const getItemVisuals = useCallback(
    (item: ScheduledItem) => {
      const isIncome = item.type === 'income' || item.type === 'deposit';
      const isTransfer = item.type === 'transfer' || item.isTransfer;

      // 1. Configured Category from Scheduled Transaction
      const configuredCategory =
        item.category || (item.originalItem as any)?.category || '';

      let categoryName = configuredCategory || (isIncome ? 'Income' : isTransfer ? 'Transfer' : 'Scheduled');
      let categoryIcon = isIncome ? 'arrow_downward' : isTransfer ? 'sync' : 'schedule';
      let categoryColor = isIncome ? '#10b981' : isTransfer ? '#64748b' : '#6366f1';

      if (configuredCategory) {
        const foundCat = categoryMap.get(configuredCategory.toLowerCase());
        if (foundCat) {
          categoryName = foundCat.name;
          categoryIcon = foundCat.icon || categoryIcon;
          categoryColor = foundCat.color || categoryColor;
        }
      }

      // 2. Configured Merchant from Scheduled Transaction
      const configuredMerchant =
        item.merchant ||
        (item.originalItem as any)?.merchant ||
        (item.originalItem as any)?.biller ||
        item.description;

      const logoUrl = getMerchantLogoUrl(
        configuredMerchant,
        brandfetchClientId,
        merchantLogoOverrides,
        { fallback: 'lettermark', type: 'icon', width: 80, height: 80 }
      );

      const showLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl]);

      // 3. Relative date calculation
      const todayStr = toLocalISOString(new Date());
      const isOverdue = item.date < todayStr && !item.isSkipped;
      const isToday = item.date === todayStr;

      let dateRelative = '';
      if (isToday) {
        dateRelative = 'Today';
      } else if (isOverdue) {
        const diffDays = Math.max(
          1,
          Math.round((new Date().getTime() - parseLocalDate(item.date).getTime()) / 86400000)
        );
        dateRelative = `${diffDays}d overdue`;
      } else {
        const diffDays = Math.round(
          (parseLocalDate(item.date).getTime() - new Date().getTime()) / 86400000
        );
        if (diffDays === 1) {
          dateRelative = 'Tomorrow';
        } else if (diffDays > 1 && diffDays <= 7) {
          dateRelative = `In ${diffDays} days`;
        } else {
          dateRelative = parseLocalDate(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
        }
      }

      return {
        categoryName,
        categoryIcon,
        categoryColor,
        logoUrl,
        showLogo,
        isOverdue,
        isToday,
        dateRelative,
      };
    },
    [brandfetchClientId, categoryMap, logoLoadErrors, merchantLogoOverrides]
  );

  // Commitment ratio calculation
  const commitmentRatio =
    summaryMetrics.income > 0
      ? (summaryMetrics.expense / summaryMetrics.income) * 100
      : summaryMetrics.expense > 0
      ? 100
      : 0;

  let commitmentColor = 'text-emerald-400';
  let commitmentBg = 'bg-emerald-500/20 border-emerald-500/30';
  let commitmentText = 'Optimal (Low Load)';

  if (commitmentRatio >= 70) {
    commitmentColor = 'text-rose-400';
    commitmentBg = 'bg-rose-500/20 border-rose-500/30';
    commitmentText = 'High Commitment';
  } else if (commitmentRatio >= 50) {
    commitmentColor = 'text-amber-400';
    commitmentBg = 'bg-amber-500/20 border-amber-500/30';
    commitmentText = 'Moderate Commitment';
  }

  const overdueItems = groupedItems['Overdue'] || [];
  const overdueTotal = overdueItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);

  // 30-Day Cashflow Daily Bar Chart data
  const cashflowChartData = useMemo(() => {
    const today = new Date();
    const map: Record<
      string,
      { dateStr: string; label: string; income: number; expense: number; net: number }
    > = {};

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
      map[iso] = { dateStr: iso, label: dayLabel, income: 0, expense: 0, net: 0 };
    }

    scheduledItems.forEach((item) => {
      if (map[item.date]) {
        const isIncome = item.type === 'income' || item.type === 'deposit';
        const amt = Math.abs(item.amount);
        if (isIncome) {
          map[item.date].income += amt;
          map[item.date].net += amt;
        } else {
          map[item.date].expense += amt;
          map[item.date].net -= amt;
        }
      }
    });

    return Object.values(map);
  }, [scheduledItems]);

  // Filter scheduled items if search query is present
  const filterBySearch = (items: ScheduledItem[]) => {
    if (!searchQuery.trim()) return items;
    return items.filter((item) => {
      const q = searchQuery.toLowerCase();
      return (
        item.description.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.merchant && item.merchant.toLowerCase().includes(q)) ||
        (item.accountId && (accountMap[item.accountId] || '').toLowerCase().includes(q))
      );
    });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4 pb-28 animate-fade-in md:hidden font-sans select-none">
        {/* ================================================================= */}
        {/* 1. iOS Top Navigation Header */}
        {/* ================================================================= */}
        <div className="pt-2 px-1 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 leading-none mb-1">
              Cashflow & Commitments
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-light-text dark:text-white tracking-tight leading-tight">
                Schedule & Bills
              </h1>
              {overdueItems.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  {overdueItems.length} Overdue
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action Button */}
            <button
              type="button"
              onClick={() => setIsActionsSheetOpen(true)}
              className="h-9 w-9 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/25 active:scale-95 transition-all"
            >
              <Icon name="add" className="text-xl" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. Quick Search Bar */}
        {/* ================================================================= */}
        <div className="relative">
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary text-base"
          />
          <input
            type="text"
            placeholder="Search upcoming bills, salaries, rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-xs placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50 text-light-text dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary hover:text-light-text"
            >
              <Icon name="cancel" className="text-base" />
            </button>
          )}
        </div>

        {/* ================================================================= */}
        {/* 3. Hero Commitment & 30-Day Outflow Card */}
        {/* ================================================================= */}
        <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-[#2a1306] via-[#3a1b08] to-[#1a0c04] text-white p-5 shadow-xl border border-orange-500/25">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between text-xs text-orange-200/80 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Icon name="credit_card" className="text-sm text-orange-400" />
                <span>Next 30 Days Outflow</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold">
                {preferredCurrency}
              </span>
            </div>

            <div>
              <h2 className="text-3.5xl font-black tracking-tight text-white privacy-blur leading-none">
                {formatCurrency(summaryMetrics.expense, curr)}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${commitmentBg} ${commitmentColor}`}
                >
                  <Icon name="donut_large" className="text-xs" />
                  {Math.round(commitmentRatio)}% Commitment ({commitmentText})
                </span>
              </div>
            </div>

            {/* Inset Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Income
                </span>
                <span className="text-xs font-bold text-emerald-400 privacy-blur">
                  +{formatCurrency(summaryMetrics.income, curr)}
                </span>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Net Expected
                </span>
                <span
                  className={`text-xs font-bold privacy-blur ${
                    summaryMetrics.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(summaryMetrics.net, curr, { showPlusSign: true })}
                </span>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/70 block">
                  Pending
                </span>
                <span className="text-xs font-bold text-orange-300">
                  {summaryMetrics.expCount} Payments
                </span>
              </div>
            </div>
          </div>

          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-orange-500/20 rounded-full blur-3xl pointer-events-none -z-1" />
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-rose-500/20 rounded-full blur-3xl pointer-events-none -z-1" />
        </div>

        {/* ================================================================= */}
        {/* 4. Sub-View Tab Switcher */}
        {/* ================================================================= */}
        <div className="flex bg-black/5 dark:bg-white/[0.06] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.04]">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'timeline'
                ? 'bg-white dark:bg-[#2c2d30] text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="calendar" className="text-sm text-orange-500" />
            <span>Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'rules'
                ? 'bg-white dark:bg-[#2c2d30] text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="repeat" className="text-sm text-indigo-500" />
            <span>Rules ({recurringList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-[#2c2d30] text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            <Icon name="analytics" className="text-sm text-amber-500" />
            <span>Charts</span>
          </button>

          {overdueItems.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('overdue')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'overdue'
                  ? 'bg-white dark:bg-[#2c2d30] text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-rose-500'
              }`}
            >
              <Icon name="warning" className="text-sm text-rose-500" />
              <span>Overdue ({overdueItems.length})</span>
            </button>
          )}
        </div>

        {/* ================================================================= */}
        {/* TAB 1: TIMELINE (CHRONOLOGICAL GROUPS WITH COLLAPSIBLE OVERDUE) */}
        {/* ================================================================= */}
        {activeTab === 'timeline' && (
          <div className="space-y-4 animate-fade-in">
            {/* COLLAPSIBLE OVERDUE ACCORDION BANNER (COLLAPSED BY DEFAULT) */}
            {overdueItems.length > 0 && (
              <div className="rounded-3xl bg-rose-500/10 border border-rose-500/25 overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setIsOverdueExpanded((prev) => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left active:bg-rose-500/15 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                      <Icon name="warning" className="text-xl animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                          Overdue Obligations
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300">
                          {overdueItems.length}
                        </span>
                      </div>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 mt-0.5">
                        Tap to {isOverdueExpanded ? 'collapse' : 'view overdue items & settle'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 privacy-blur">
                      -{formatCurrency(overdueTotal, curr)}
                    </span>
                    <Icon
                      name={isOverdueExpanded ? 'expand_less' : 'expand_more'}
                      className="text-lg text-rose-500"
                    />
                  </div>
                </button>

                {/* Overdue Items List (Animates open when expanded) */}
                <AnimatePresence initial={false}>
                  {isOverdueExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="divide-y divide-rose-500/20 border-t border-rose-500/20 bg-white/60 dark:bg-dark-card/60 backdrop-blur-md"
                    >
                      {filterBySearch(overdueItems).map((item) => {
                        const {
                          categoryName,
                          categoryIcon,
                          categoryColor,
                          logoUrl,
                          showLogo,
                          dateRelative,
                        } = getItemVisuals(item);

                        const frequency = item.isRecurring
                          ? (item.originalItem as RecurringTransaction).frequency
                          : 'One-time Bill';
                        const accountName = item.accountId ? accountMap[item.accountId] : item.accountName;

                        return (
                          <SwipeableRow
                            key={item.id}
                            leftActions={[
                              {
                                icon: 'check',
                                bgClass: 'bg-emerald-500',
                                label: 'Pay Now',
                                onAction: () => onProcessItem(item),
                              },
                            ]}
                            rightActions={[
                              {
                                icon: 'edit',
                                bgClass: 'bg-amber-500',
                                label: 'Edit',
                                onAction: () => onEditItem(item),
                              },
                              {
                                icon: 'delete',
                                bgClass: 'bg-rose-500',
                                label: 'Delete',
                                onAction: () => onDeleteItem(item.id, item.isRecurring),
                              },
                            ]}
                          >
                            <div
                              onClick={() => onEditItem(item)}
                              className="p-3.5 flex items-center justify-between gap-3 active:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Squircle Logo or Category Icon */}
                                <div className="relative shrink-0">
                                  <div
                                    className={`w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden border shadow-xs ${
                                      showLogo
                                        ? 'bg-white dark:bg-white/10 border-black/10 dark:border-white/10'
                                        : 'text-white border-transparent'
                                    }`}
                                    style={showLogo ? undefined : { backgroundColor: categoryColor }}
                                  >
                                    {showLogo && logoUrl ? (
                                      <img
                                        src={logoUrl}
                                        alt={item.description}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={() => handleLogoError(logoUrl)}
                                      />
                                    ) : (
                                      <Icon name={categoryIcon} className="text-xl" />
                                    )}
                                  </div>
                                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-2xs shadow-xs">
                                    <Icon name={item.isRecurring ? 'refresh' : 'receipt'} className="text-2xs" />
                                  </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-light-text dark:text-white truncate">
                                    {item.description}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {categoryName && (
                                      <span
                                        className="px-1.5 py-0.5 rounded text-2xs font-semibold uppercase text-white"
                                        style={{ backgroundColor: categoryColor }}
                                      >
                                        {categoryName}
                                      </span>
                                    )}
                                    <span className="text-xs font-semibold text-rose-500">
                                      {dateRelative}
                                    </span>
                                    {accountName && (
                                      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60 truncate">
                                        • {accountName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 privacy-blur">
                                  -{formatCurrency(Math.abs(item.amount), curr)}
                                </p>
                                <span className="text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 inline-block mt-0.5">
                                  {frequency}
                                </span>
                              </div>
                            </div>
                          </SwipeableRow>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* UPCOMING TIMELINE GROUPS (Excluding Overdue since handled above) */}
            {sortedGroupKeys
              .filter((k) => k !== 'Overdue')
              .map((groupKey) => {
                const itemsInGroup = filterBySearch(groupedItems[groupKey] || []);
                if (itemsInGroup.length === 0) return null;

                return (
                  <div
                    key={groupKey}
                    className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm overflow-hidden"
                  >
                    {/* Group Header */}
                    <div className="px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                        <span className="text-xs font-bold text-light-text dark:text-white">
                          {groupKey}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                        {itemsInGroup.length} item{itemsInGroup.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Scheduled Items List with Configured Categories and Merchant Logos */}
                    <div className="divide-y divide-black/5 dark:divide-white/5">
                      {itemsInGroup.map((item) => {
                        const isIncome = item.type === 'income' || item.type === 'deposit';
                        const {
                          categoryName,
                          categoryIcon,
                          categoryColor,
                          logoUrl,
                          showLogo,
                          dateRelative,
                        } = getItemVisuals(item);

                        const frequency = item.isRecurring
                          ? (item.originalItem as RecurringTransaction).frequency
                          : 'One-Time Bill';
                        const accountName = item.accountId ? accountMap[item.accountId] : item.accountName;

                        return (
                          <SwipeableRow
                            key={item.id}
                            leftActions={[
                              {
                                icon: 'check',
                                bgClass: 'bg-emerald-500',
                                label: 'Mark Done',
                                onAction: () => onProcessItem(item),
                              },
                            ]}
                            rightActions={[
                              {
                                icon: 'edit',
                                bgClass: 'bg-amber-500',
                                label: 'Edit',
                                onAction: () => onEditItem(item),
                              },
                              {
                                icon: 'delete',
                                bgClass: 'bg-rose-500',
                                label: 'Delete',
                                onAction: () => onDeleteItem(item.id, item.isRecurring),
                              },
                            ]}
                          >
                            <div
                              onClick={() => onEditItem(item)}
                              className="p-3.5 flex items-center justify-between gap-3 active:bg-black/5 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Squircle Logo or Category Icon */}
                                <div className="relative shrink-0">
                                  <div
                                    className={`w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden border shadow-xs ${
                                      showLogo
                                        ? 'bg-white dark:bg-white/10 border-black/10 dark:border-white/10'
                                        : 'text-white border-transparent'
                                    }`}
                                    style={showLogo ? undefined : { backgroundColor: categoryColor }}
                                  >
                                    {showLogo && logoUrl ? (
                                      <img
                                        src={logoUrl}
                                        alt={item.description}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={() => handleLogoError(logoUrl)}
                                      />
                                    ) : (
                                      <Icon
                                        name={categoryIcon}
                                        className="text-xl"
                                      />
                                    )}
                                  </div>
                                  <div
                                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-2xs shadow-xs text-white ${
                                      isIncome ? 'bg-emerald-500' : 'bg-orange-500'
                                    }`}
                                  >
                                    <Icon
                                      name={item.isRecurring ? 'refresh' : 'receipt'}
                                      className="text-2xs"
                                    />
                                  </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-light-text dark:text-white truncate">
                                    {item.description}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {categoryName && (
                                      <span
                                        className="px-1.5 py-0.5 rounded text-2xs font-semibold uppercase text-white"
                                        style={{ backgroundColor: categoryColor }}
                                      >
                                        {categoryName}
                                      </span>
                                    )}
                                    <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-80">
                                      {dateRelative}
                                    </span>
                                    {accountName && (
                                      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60 truncate">
                                        • {accountName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <p
                                  className={`text-xs font-bold privacy-blur ${
                                    isIncome
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-light-text dark:text-white'
                                  }`}
                                >
                                  {isIncome ? '+' : '-'}
                                  {formatCurrency(Math.abs(item.amount), curr)}
                                </p>
                                <span className="text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary inline-block mt-0.5">
                                  {frequency}
                                </span>
                              </div>
                            </div>
                          </SwipeableRow>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {scheduledItems.length === 0 && (
              <div className="py-12 text-center text-light-text-secondary opacity-50 bg-white dark:bg-dark-card rounded-3xl p-6">
                <Icon name="event_available" className="text-4xl mb-2 text-orange-500" />
                <p className="text-sm font-bold text-light-text dark:text-white">
                  No scheduled payments
                </p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  Tap the + button to add bills or recurring transactions.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: RULES / RECURRING SERIES */}
        {/* ================================================================= */}
        {activeTab === 'rules' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  Active Recurring Rules
                </h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Salaries, subscriptions, and standing loan orders
                </p>
              </div>
              <button
                type="button"
                onClick={onAddRecurring}
                className="h-8 px-3 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                <Icon name="add" className="text-sm" />
                <span>Add Rule</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {recurringList.map((rule) => {
                const isIncome = rule.type === 'income' || rule.type === 'deposit';
                const { categoryName, categoryIcon, categoryColor, logoUrl, showLogo } =
                  getItemVisuals({
                    id: rule.id,
                    description: rule.description,
                    amount: rule.amount,
                    type: rule.type,
                    category: rule.category,
                    merchant: rule.merchant,
                    accountId: rule.accountId,
                    date: rule.startDate || '',
                    isRecurring: true,
                    originalItem: rule,
                    accountName: rule.accountName || '',
                  } as ScheduledItem);

                return (
                  <div
                    key={rule.id}
                    className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden border shrink-0 shadow-xs ${
                          showLogo
                            ? 'bg-white dark:bg-white/10 border-black/10 dark:border-white/10'
                            : 'text-white border-transparent'
                        }`}
                        style={showLogo ? undefined : { backgroundColor: categoryColor }}
                      >
                        {showLogo && logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={rule.description}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={() => handleLogoError(logoUrl)}
                          />
                        ) : (
                          <Icon name={categoryIcon} className="text-xl" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-light-text dark:text-white truncate">
                            {rule.description}
                          </p>
                          {rule.isSynthetic && (
                            <span className="px-1.5 py-0.5 rounded text-2xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              Auto-Sync
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {categoryName && (
                            <span
                              className="px-1.5 py-0.5 rounded text-2xs font-semibold uppercase text-white"
                              style={{ backgroundColor: categoryColor }}
                            >
                              {categoryName}
                            </span>
                          )}
                          <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate">
                            {rule.frequency}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-bold privacy-blur ${
                          isIncome ? 'text-emerald-500' : 'text-light-text dark:text-white'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(Math.abs(rule.amount), curr)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: CHARTS & COMMITMENT INSIGHTS */}
        {/* ================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 animate-fade-in">
            {/* 30-Day Daily Cashflow Forecast Bar Chart */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-light-text dark:text-white">
                    30-Day Cashflow Timeline
                  </h3>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    Upcoming inflows (+) and outflows (-)
                  </p>
                </div>
                <span className="text-xs font-bold text-orange-500">
                  {formatCurrency(summaryMetrics.net, curr, { showPlusSign: true })}
                </span>
              </div>

              <div className="h-44 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflowChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#888' }} interval={4} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val, curr), 'Net Flow']}
                      contentStyle={{
                        borderRadius: '1rem',
                        background: 'rgba(20,20,25,0.95)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11px',
                      }}
                    />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={0.7} />
                    <Bar dataKey="net" radius={[4, 4, 4, 4]}>
                      {cashflowChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.net >= 0 ? '#10b981' : '#f97316'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-6 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span>Incoming (+ Inflow)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-orange-500 rounded-full" />
                  <span>Scheduled Outflow (-)</span>
                </div>
              </div>
            </div>

            {/* Category Breakdown Card */}
            <div className="rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-light-text dark:text-white">
                  30-Day Expense Commitments
                </h3>
                <span className="text-xs font-bold text-orange-500">
                  {formatCurrency(summaryMetrics.expense, curr)}
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {categoryBreakdown.length > 0 ? (
                  categoryBreakdown.map((cat, idx) => {
                    const percent =
                      summaryMetrics.expense > 0
                        ? (cat.value / summaryMetrics.expense) * 100
                        : 0;
                    const color = PIE_COLORS[idx % PIE_COLORS.length];

                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-light-text dark:text-white">{cat.name}</span>
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">
                            {formatCurrency(cat.value, curr)} ({percent.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-light-text-secondary py-4 text-center">
                    No scheduled expenses detected.
                  </p>
                )}
              </div>
            </div>

            {/* Dominant Inflow Card */}
            {majorInflow && (
              <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/20 p-4 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                    Dominant Inflow
                  </span>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{formatCurrency(majorInflow.amount, curr)}
                  </p>
                  <p className="text-xs text-light-text dark:text-white font-bold truncate mt-0.5">
                    {majorInflow.description}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <Icon name="savings" className="text-2xl" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: OVERDUE QUEUE */}
        {/* ================================================================= */}
        {activeTab === 'overdue' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  Overdue Obligations ({overdueItems.length})
                </h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Bills and recurring entries past their scheduled due dates
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {overdueItems.map((item) => {
                const { categoryName, categoryColor, logoUrl, showLogo } = getItemVisuals(item);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-3xl bg-white dark:bg-dark-card border border-rose-500/20 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden border shrink-0 ${
                          showLogo
                            ? 'bg-white dark:bg-white/10 border-black/10 dark:border-white/10'
                            : 'text-white border-transparent'
                        }`}
                        style={showLogo ? undefined : { backgroundColor: categoryColor }}
                      >
                        {showLogo && logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={item.description}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={() => handleLogoError(logoUrl)}
                          />
                        ) : (
                          <Icon name="warning" className="text-lg" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-light-text dark:text-white truncate">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {categoryName && (
                            <span
                              className="px-1.5 py-0.5 rounded text-2xs font-semibold uppercase text-white"
                              style={{ backgroundColor: categoryColor }}
                            >
                              {categoryName}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-rose-500">
                            Due: {item.date}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400 privacy-blur">
                        -{formatCurrency(Math.abs(item.amount), curr)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onProcessItem(item)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs active:scale-95"
                      >
                        Pay Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 5. BottomSheet: Quick Actions Menu */}
        {/* ================================================================= */}
        <BottomSheet
          isOpen={isActionsSheetOpen}
          onClose={() => setIsActionsSheetOpen(false)}
          title="Add Schedule Event"
          subtitle="Schedule future bills, standing orders, or recurring income"
        >
          <div className="space-y-2.5 p-4">
            <button
              type="button"
              onClick={() => {
                setIsActionsSheetOpen(false);
                onAddBill();
              }}
              className="w-full p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center gap-3.5 text-left active:bg-black/5 transition-all"
            >
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
                <Icon name="receipt_long" className="text-xl" />
              </div>
              <div>
                <p className="text-sm font-bold text-light-text dark:text-white">
                  One-Time Bill / Payment
                </p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Schedule invoices, taxes, utility bills, or one-off payments
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsActionsSheetOpen(false);
                onAddRecurring();
              }}
              className="w-full p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center gap-3.5 text-left active:bg-black/5 transition-all"
            >
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <Icon name="repeat" className="text-xl" />
              </div>
              <div>
                <p className="text-sm font-bold text-light-text dark:text-white">
                  Recurring Rule / Salary
                </p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Set up regular salaries, rent, subscriptions, or transfers
                </p>
              </div>
            </button>
          </div>
        </BottomSheet>
      </div>
    </PullToRefresh>
  );
};
