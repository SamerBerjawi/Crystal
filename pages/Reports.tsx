import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Page } from '../types';
import { toLocalISOString, getMainCurrency, formatCurrency, parseLocalDate } from '../utils';
import { formatShortDate } from '../utils/dateFormat';
import { sortAccountsByType } from '../utils/accountsModel';
import { automaticReports, buildReport, dailySpend, expensesIn, exportReportCsv, inScope, MAX_SAVED_VIEWS, NO_FILTERS, reportTiles, type GroupBy, type ReportFilters, type ReportId, type SavedReportView } from '../utils/reportsModel';
import { warnIgnored } from '../utils/logging';
import { useAccountSelector, usePreferencesContext, useTransactionSelector } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import PageHeader, { type PageStat } from '../components/PageHeader';
import ReportPanel from '../components/ReportPanel';
import { Button, IconButton } from '../components/ui/Actions';
import { CountPill } from '../components/ui/Display';
import { DateInput, TextInput } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { Amount } from '../components/ui/Money';
import { Dialog, SidePanel } from '../components/ui/Overlays';
import { Combobox, Select, type PickerOption } from '../components/ui/Pickers';
import CategoryPicker from '../components/CategoryPicker';
import { MerchantPicker } from '../components/MerchantPicker';
import { AccountLogo } from '../components/AccountCard';
import { EntityGlyph, LogoTile, MerchantLogo } from '../components/EntityIcon';
import { getCategoryDetails } from '../utils/categories';
import { buildEffectiveMerchantLogoOverrides, getAccountBrandfetchUrl, getMerchantLogoUrl } from '../utils/brandfetch';
import { AreaSparkline, useSparklineHover } from '../src/components/charts';
import { cn } from '../lib/utils';

const LEGACY_VIEWS_KEY = 'reports.savedViews.v1';

export interface ReportGroup {
  title: string;
  tiles: { id: ReportId; label: string; icon: string }[];
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    title: 'Overview & Cash Flow',
    tiles: [
      { id: 'summary', label: 'Summary', icon: 'analytics-01' },
      { id: 'spending', label: 'Spending pace', icon: 'chart-line-data-01' },
      { id: 'cashflow', label: 'Cash flow', icon: 'arrow-data-transfer-horizontal' },
      { id: 'forecast', label: 'Month-end forecast', icon: 'clock-01' },
    ],
  },
  {
    title: 'Categories & Outflows',
    tiles: [
      { id: 'categories', label: 'Categories', icon: 'pie-chart-01' },
      { id: 'categoryMonths', label: 'Category by month', icon: 'calendar-03' },
      { id: 'breakdown', label: 'Spend breakdown', icon: 'receipt' },
      { id: 'needs', label: 'Needs and wants', icon: 'balance-scale' },
    ],
  },
  {
    title: 'Income & Budgets',
    tiles: [
      { id: 'income', label: 'Income', icon: 'wallet-02' },
      { id: 'budget', label: 'Budget and actual', icon: 'sliders-horizontal' },
    ],
  },
  {
    title: 'Patterns & Outliers',
    tiles: [
      { id: 'usual', label: 'Compared with usual', icon: 'exchange-01' },
      { id: 'recurring', label: 'Repeat spending', icon: 'repeat-one-01' },
      { id: 'unusual', label: 'Unusual payments', icon: 'alert-circle' },
    ],
  },
];

const TILES: { id: ReportId; label: string; icon: string }[] = REPORT_GROUPS.flatMap(group => group.tiles);

const DATE_PRESETS = [
  { id: 'mtd', label: 'MTD' },
  { id: 'lastMonth', label: 'Last month' },
  { id: '3m', label: '3M' },
  { id: 'ytd', label: 'YTD' },
  { id: '12m', label: '12M' },
];

const getPresetRange = (presetId: string, todayStr: string, fyStartMonth = 1) => {
  const now = parseLocalDate(todayStr);
  switch (presetId) {
    case 'mtd':
      return {
        startDate: toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: todayStr,
      };
    case 'lastMonth':
      return {
        startDate: toLocalISOString(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        endDate: toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case '3m':
      return {
        startDate: toLocalISOString(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
        endDate: todayStr,
      };
    case 'ytd': {
      const yearStart = new Date(
        now.getMonth() + 1 >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1,
        fyStartMonth - 1,
        1
      );
      return {
        startDate: toLocalISOString(yearStart),
        endDate: todayStr,
      };
    }
    case '12m':
      return {
        startDate: toLocalISOString(new Date(now.getFullYear(), now.getMonth() - 11, 1)),
        endDate: todayStr,
      };
    default:
      return null;
  }
};

export type Point = {
  day?: string;
  value: number;
};

const defaultKpiData: Point[] = [
  { day: 'Day 1', value: 0 },
  { day: 'Day 2', value: 0 },
];

export interface KpiCardProps {
  label?: string;
  name?: string;
  data?: Point[];
  trend?: { value: number }[];
  amount?: number;
  isActive?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function KpiCard({
  label,
  name,
  data = defaultKpiData,
  trend,
  amount,
  isActive = false,
  onOpen,
  onDelete,
  className,
}: KpiCardProps) {
  const cardLabel = label ?? name ?? '';
  const cardData = useMemo(() => {
    if (trend && trend.length > 0) {
      return trend.map((p, i) => ({ day: `Day ${i + 1}`, value: p.value }));
    }
    return data && data.length > 0 ? data : defaultKpiData;
  }, [data, trend]);

  const hover = useSparklineHover<Point>();
  const fallback = amount !== undefined ? { value: amount } : cardData.at(-1);
  const shown = hover.datum ?? fallback;
  const currency = getMainCurrency();
  const formatter = useMemo(
    () => ({
      format: (val: number) => formatCurrency(val, currency),
    }),
    [currency]
  );

  return (
    <div
      className={cn(
        'surface-card relative w-48 shrink-0 rounded-xl border p-4 transition-colors duration-[var(--duration-fast)]',
        isActive && 'border-primary',
        className
      )}
    >
      <button
        type="button"
        aria-pressed={isActive}
        onClick={onOpen}
        className="block w-full cursor-pointer text-left focus:outline-none"
      >
        <span className="type-label block truncate pr-6 text-muted">{cardLabel}</span>
        <span className="type-figure-row mt-0.5 block text-ink">
          {shown && shown.value != null ? formatter.format(shown.value) : '—'}
        </span>
      </button>
      <div className="mt-2 h-10 w-full cursor-pointer" onClick={onOpen}>
        <AreaSparkline
          data={cardData}
          dataKey="value"
          height={40}
          {...hover.sparklineProps}
        />
      </div>
      {onDelete && (
        <span className="absolute right-1 top-1 z-10">
          <IconButton
            icon="close"
            label={`Delete ${cardLabel}`}
            tooltipPlacement="left"
            onPress={onDelete}
          />
        </span>
      )}
    </div>
  );
}

interface ReportsProps {
  setCurrentPage?: (page: Page) => void;
}

/** Orvel's tiles and "What it says", Talvo's library and Rivolo's comparison with usual (D-027). */
const Reports: React.FC<ReportsProps> = ({ setCurrentPage }) => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(acc => acc);
  const { preferences, setPreferences } = usePreferencesContext();
  const logoOverrides = useMemo(
    () => buildEffectiveMerchantLogoOverrides(preferences.merchantLogoOverrides, preferences.merchantRules),
    [preferences.merchantLogoOverrides, preferences.merchantRules],
  );
  const { budgets } = useBudgetsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const isPhone = useIsMobile();
  const showAdjustments = preferences.showBalanceAdjustments ?? true;
  const today = toLocalISOString(new Date());
  const automatic = useMemo(() => automaticReports(today, preferences.financialYearStartMonth), [today, preferences.financialYearStartMonth]);
  const savedViews: SavedReportView[] = preferences.savedReportViews ?? [];

  const [filters, setFilters] = useState<ReportFilters>({ startDate: automatic[1].startDate, endDate: automatic[1].endDate, ...NO_FILTERS });
  const [groupBy, setGroupBy] = useState<GroupBy>('merchant');
  const [activeId, setActiveId] = useState<ReportId>('summary');
  const [isPhoneReportOpen, setPhoneReportOpen] = useState(false);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [viewName, setViewName] = useState('');

  // Saved views used to live in this browser only (S-002).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LEGACY_VIEWS_KEY);
      if (!stored) return;
      const local = JSON.parse(stored) as (Omit<SavedReportView, 'merchant' | 'category' | 'accountId'> & { merchantFilter?: string; categoryFilter?: string; accountFilter?: string })[];
      const moved = (Array.isArray(local) ? local : []).map(({ merchantFilter, categoryFilter, accountFilter, ...view }) => ({ ...view, merchant: merchantFilter ?? '', category: categoryFilter ?? 'all', accountId: accountFilter ?? 'all' }));
      setPreferences(prev => ({ ...prev, savedReportViews: [...(prev.savedReportViews ?? []), ...moved.filter(view => !prev.savedReportViews?.some(saved => saved.id === view.id))].slice(0, MAX_SAVED_VIEWS) }));
      localStorage.removeItem(LEGACY_VIEWS_KEY);
    } catch (error) {
      warnIgnored('moving saved report views', error);
    }
  }, [setPreferences]);

  const allCategories = useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);
  const analyticsAccountIds = useMemo(
    () => new Set(accounts.filter(acc => acc.includeInAnalytics ?? true).map(acc => acc.id)),
    [accounts]
  );
  const scopedTransactions = useMemo(
    () => transactions.filter(tx => filters.accountId !== 'all' || analyticsAccountIds.size === 0 || analyticsAccountIds.has(tx.accountId)),
    [transactions, filters.accountId, analyticsAccountIds]
  );

  const report = useMemo(
    () => buildReport(scopedTransactions, budgets, filters, showAdjustments, groupBy, today, allCategories),
    [scopedTransactions, budgets, filters, showAdjustments, groupBy, today, allCategories]
  );
  const tiles = useMemo(() => reportTiles(report), [report]);
  const cashflowTransactions = useMemo(
    () => scopedTransactions.filter(tx =>
      !tx.isSplitParent &&
      !tx.isCombinedParent &&
      tx.date >= filters.startDate &&
      tx.date <= filters.endDate &&
      (showAdjustments || !tx.isBalanceAdjustment) &&
      inScope(tx, filters, allCategories)
    ),
    [scopedTransactions, filters, showAdjustments, allCategories]
  );

  const library = useMemo(() => {
    const summarise = (scope: ReportFilters) => {
      const rows = expensesIn(scopedTransactions, scope, showAdjustments, scope.startDate, scope.endDate, allCategories);
      const trend = dailySpend(rows, scope.startDate, scope.endDate);
      return { amount: trend.reduce((sum, point) => sum + point.value, 0), trend };
    };
    return {
      automatic: automatic.map(item => ({ ...item, ...summarise({ ...item, ...NO_FILTERS }) })),
      saved: savedViews.map(view => ({ view, ...summarise(view) })),
    };
  }, [automatic, savedViews, scopedTransactions, showAdjustments, allCategories]);

  const handleExportCsv = () => {
    const csv = exportReportCsv(report, filters);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crystal-report-${filters.startDate}-to-${filters.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Report exported to CSV');
  };

  const isSame = (scope: ReportFilters) => scope.startDate === filters.startDate && scope.endDate === filters.endDate && scope.merchant === filters.merchant && scope.category === filters.category && scope.accountId === filters.accountId;
  const activeFilters = [filters.merchant.trim(), filters.category !== 'all', filters.accountId !== 'all'].filter(Boolean).length;
  const update = (patch: Partial<ReportFilters>) => setFilters(prev => ({ ...prev, ...patch }));

  const accountOptions = useMemo<PickerOption[]>(() => {
    const sorted = sortAccountsByType(accounts);
    const openCount = accounts.filter(a => a.status !== 'closed').length;

    const allOption: PickerOption = {
      id: 'all',
      label: 'All accounts',
      description: `${openCount} active accounts`,
      visual: <LogoTile label="All" size={24} fallbackIcon="account_balance" />,
    };

    const items = sorted.map(item => {
      const logoUrl = item.imageUrl
        || getAccountBrandfetchUrl(item, preferences.brandfetchClientId, logoOverrides)
        || (item.financialInstitution ? getMerchantLogoUrl(item.financialInstitution, preferences.brandfetchClientId, logoOverrides) : null);
      return {
        id: item.id,
        label: item.name,
        description: `${item.financialInstitution || item.type}, ${formatCurrency(item.balance, item.currency)}`,
        group: item.status === 'closed' ? 'Closed' : item.type,
        visual: <LogoTile url={logoUrl} label={item.name} size={24} fallbackIcon="account_balance" />,
      };
    });

    return [allOption, ...items];
  }, [accounts, preferences.brandfetchClientId, logoOverrides]);

  const categorySuggestions = useMemo(() => {
    const top = report.categories.slice(0, 3).map(c => c.category);
    return ['all', ...top];
  }, [report.categories]);

  const saveView = () => {
    const name = viewName.trim();
    if (!name) {
      toast.error('Name this view');
      return;
    }
    setPreferences(prev => ({ ...prev, savedReportViews: [{ id: `${Date.now()}`, name, groupBy, ...filters }, ...(prev.savedReportViews ?? [])].slice(0, MAX_SAVED_VIEWS) }));
    setViewName('');
    setSaving(false);
    toast.success('View saved');
  };

  const stats: PageStat[] = [
    { label: 'Total spend', icon: 'credit-card', value: report.totalSpend, format: 'money', currency: getMainCurrency(), ...(report.changePct === null ? {} : { badge: `${report.changePct >= 0 ? '+' : '−'}${Math.abs(report.changePct).toFixed(1)}%`, badgeTone: report.changePct > 0 ? 'tomato' as const : 'pine' as const }) },
    { label: 'Savings rate', icon: 'piggy-bank', value: report.savingsRate, format: 'percent' },
    { label: 'Transactions', icon: 'receipt', value: report.count, format: 'number' },
  ];

  const reportOptions: PickerOption[] = useMemo(
    () =>
      REPORT_GROUPS.flatMap(group =>
        group.tiles.map(tile => ({
          id: tile.id,
          label: tile.label,
          group: group.title,
        }))
      ),
    []
  );

  const activePresetId = useMemo(() => {
    if (filters.merchant.trim() || filters.category !== 'all' || filters.accountId !== 'all') {
      return 'custom';
    }
    for (const preset of ['mtd', 'lastMonth', '3m', 'ytd', '12m'] as const) {
      const range = getPresetRange(preset, today, preferences.financialYearStartMonth);
      if (range && range.startDate === filters.startDate && range.endDate === filters.endDate) {
        return preset;
      }
    }
    return 'custom';
  }, [filters, today, preferences.financialYearStartMonth]);

  const handleSelectPreset = (presetId: string) => {
    const range = getPresetRange(presetId, today, preferences.financialYearStartMonth);
    if (!range) return;
    setFilters(prev => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
  };

  const openTile = (id: ReportId) => {
    setActiveId(id);
    setPhoneReportOpen(true);
  };
  const active = TILES.find(tile => tile.id === activeId)!;
  const showPicker = !isPhone || !isPhoneReportOpen;
  const showReport = !isPhone || isPhoneReportOpen;

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Reports"
        stats={stats}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="sliders-horizontal" onPress={() => setFilterOpen(true)}>
              <span className="flex items-center gap-1.5">Filters{activeFilters > 0 && <CountPill count={activeFilters} />}</span>
            </Button>
            <Button variant="secondary" onPress={() => setSaving(true)}>Save view</Button>
            <Button variant="secondary" icon="download" onPress={handleExportCsv}>Export CSV</Button>
          </div>
        }
      />

      <section aria-label="Ready-made reports and saved views" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:px-0">
        {library.automatic.map(item => (
          <KpiCard key={item.id} label={item.name} amount={item.amount} trend={item.trend} isActive={isSame({ ...item, ...NO_FILTERS })} onOpen={() => setFilters({ startDate: item.startDate, endDate: item.endDate, ...NO_FILTERS })} />
        ))}
        {library.saved.map(({ view, amount, trend }) => (
          <KpiCard
            key={view.id}
            label={view.name}
            amount={amount}
            trend={trend}
            isActive={isSame(view)}
            onOpen={() => { setFilters({ startDate: view.startDate, endDate: view.endDate, merchant: view.merchant, category: view.category, accountId: view.accountId }); setGroupBy(view.groupBy); }}
            onDelete={() => setPreferences(prev => ({ ...prev, savedReportViews: (prev.savedReportViews ?? []).filter(saved => saved.id !== view.id) }))}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_minmax(0,1fr)] min-[1100px]:grid-cols-[300px_minmax(0,1fr)]">
        {showPicker && (
          <nav aria-label="Reports" className="min-w-0 space-y-4">
            {REPORT_GROUPS.map(group => (
              <div key={group.title} className="space-y-1.5">
                <h3 className="type-label px-1 text-muted uppercase tracking-wider text-[0.6875rem] font-semibold">
                  {group.title}
                </h3>
                <ul className="space-y-1.5">
                  {group.tiles.map(tile => {
                    const isActive = !isPhone && tile.id === activeId;
                    return (
                      <li key={tile.id}>
                        <button
                          type="button"
                          aria-current={isActive ? 'true' : undefined}
                          onClick={() => openTile(tile.id)}
                          className={cn(
                            'surface-card flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-left transition-colors duration-[var(--duration-fast)]',
                            isActive && 'border-primary'
                          )}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-muted">
                            <Icon name={tile.icon} size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="type-body-strong block truncate text-ink">{tile.label}</span>
                            <span className="type-caption block truncate text-muted">{tiles[tile.id].value}</span>
                          </span>
                          {isPhone && <Icon name="chevron_right" size={18} className="shrink-0 text-muted" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}

        {showReport && (
          <section aria-label={active.label} className="surface-card min-w-0 rounded-[var(--radius-xl)] p-6 max-md:p-5 md:self-start space-y-5">
            {isPhone && (
              <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="arrow-left-01"
                  className="-ml-2"
                  onPress={() => setPhoneReportOpen(false)}
                >
                  All reports
                </Button>
                <div className="min-w-0 flex-1 max-w-[200px]">
                  <Select
                    label="Switch report"
                    variant="chip"
                    options={reportOptions}
                    value={activeId}
                    onChange={id => setActiveId(id as ReportId)}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3.5 border-b border-line/60 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-inset text-muted">
                      <Icon name={active.icon} size={18} />
                    </span>
                    <h2 className="type-card-title text-ink">{active.label}</h2>
                  </div>
                  <p className="type-caption mt-1.5 text-muted">
                    <span className="font-semibold text-ink">What it says: </span>
                    {tiles[activeId].says}
                  </p>
                </div>
              </div>

              {/* Date Presets Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-line/50 bg-inset/40 p-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {DATE_PRESETS.map(preset => {
                    const isSelected = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className={cn(
                          'cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-fast',
                          isSelected
                            ? 'bg-surface text-ink shadow-xs border border-line/60'
                            : 'text-muted hover:text-ink hover:bg-surface/50'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  {activePresetId === 'custom' && (
                    <span className="rounded-md border border-primary/30 bg-primary-soft/50 px-2 py-1 text-xs font-semibold text-primary">
                      Custom range
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 px-2 text-xs text-muted">
                  <Icon name="calendar-03" size={14} className="shrink-0" />
                  <span className="font-medium tabular-nums text-ink">
                    {formatShortDate(filters.startDate)} – {formatShortDate(filters.endDate)}
                  </span>
                </div>
              </div>

              {(filters.category !== 'all' || filters.merchant.trim() || filters.accountId !== 'all') && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="type-caption text-xs text-muted">Filtered by:</span>
                  {filters.accountId !== 'all' && (() => {
                    const acc = accounts.find(a => a.id === filters.accountId);
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-1.5 pr-2 text-xs font-medium text-ink shadow-2xs">
                        {acc ? <AccountLogo account={acc} size={16} /> : <Icon name="bank" size={14} className="text-muted" />}
                        <span className="max-w-[120px] truncate">{acc?.name || 'Account'}</span>
                        <button type="button" onClick={() => update({ accountId: 'all' })} className="cursor-pointer text-muted hover:text-ink" aria-label="Remove account filter">
                          <Icon name="x" size={12} />
                        </button>
                      </span>
                    );
                  })()}
                  {filters.category !== 'all' && (() => {
                    const cat = getCategoryDetails(filters.category, allCategories);
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-1.5 pr-2 text-xs font-medium text-ink shadow-2xs">
                        <EntityGlyph icon={cat?.icon} label={filters.category} color={cat?.color} size={14} />
                        <span className="max-w-[120px] truncate">{filters.category}</span>
                        <button type="button" onClick={() => update({ category: 'all' })} className="cursor-pointer text-muted hover:text-ink" aria-label="Remove category filter">
                          <Icon name="x" size={12} />
                        </button>
                      </span>
                    );
                  })()}
                  {filters.merchant.trim() && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-1.5 pr-2 text-xs font-medium text-ink shadow-2xs">
                      <MerchantLogo merchant={filters.merchant} size={16} />
                      <span className="max-w-[120px] truncate">{filters.merchant}</span>
                      <button type="button" onClick={() => update({ merchant: '' })} className="cursor-pointer text-muted hover:text-ink" aria-label="Remove merchant filter">
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  )}
                  <button type="button" onClick={() => update({ accountId: 'all', category: 'all', merchant: '' })} className="type-caption ml-1 cursor-pointer text-xs text-muted hover:text-ink hover:underline">
                    Reset
                  </button>
                </div>
              )}
            </div>

            <ReportPanel
              id={activeId}
              report={report}
              cashflowTransactions={cashflowTransactions}
              groupBy={groupBy}
              onGroupBy={setGroupBy}
              isPhone={isPhone}
              setCurrentPage={setCurrentPage}
            />
          </section>
        )}
      </div>

      <SidePanel
        isOpen={isFilterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filters"
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onPress={() => update(NO_FILTERS)}>Clear</Button>
            <Button onPress={() => setFilterOpen(false)}>Done</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <DateInput label="From" value={filters.startDate} onChange={startDate => update({ startDate })} />
            <DateInput label="To" value={filters.endDate} onChange={endDate => update({ endDate })} />
          </div>
          <Combobox
            label="Account"
            placeholder="Search accounts"
            options={accountOptions}
            value={filters.accountId || 'all'}
            onChange={id => update({ accountId: id || 'all' })}
          />
          <CategoryPicker
            categories={allCategories}
            suggestions={categorySuggestions}
            value={filters.category}
            onChange={category => update({ category })}
            allowAll
          />
          <MerchantPicker
            label="Merchant"
            value={filters.merchant}
            onChange={merchant => update({ merchant })}
            placeholder="Shop, company or person"
            transactions={transactions}
            rules={preferences.merchantRules}
            brandfetchClientId={preferences.brandfetchClientId}
            logoOverrides={logoOverrides}
          />
        </div>
      </SidePanel>

      <Dialog
        isOpen={isSaving}
        onClose={() => setSaving(false)}
        title="Save this view"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onPress={() => setSaving(false)}>Cancel</Button>
            <Button onPress={saveView}>Save</Button>
          </div>
        }
      >
        <TextInput label="Name" value={viewName} onChange={setViewName} autoFocus help="It keeps these dates and filters, on all your devices." />
      </Dialog>
    </div>
  );
};

export default Reports;
