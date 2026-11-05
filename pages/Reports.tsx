import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Page } from '../types';
import { toLocalISOString, getMainCurrency, formatCurrency } from '../utils';
import { sortAccountsByType } from '../utils/accountsModel';
import { categoryPickerOptions } from '../utils/categoryTree';
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
import { Select } from '../components/ui/Pickers';
import { AreaSparkline, useSparklineHover } from '../src/components/charts';
import { cn } from '../lib/utils';

const LEGACY_VIEWS_KEY = 'reports.savedViews.v1';

const TILES: { id: ReportId; label: string; icon: string }[] = [
  { id: 'summary', label: 'Summary', icon: 'analytics-01' },
  { id: 'spending', label: 'Spending pace', icon: 'chart-line-data-01' },
  { id: 'categories', label: 'Categories', icon: 'pie-chart-01' },
  { id: 'usual', label: 'Compared with usual', icon: 'exchange-01' },
  { id: 'needs', label: 'Needs and wants', icon: 'balance-scale' },
  { id: 'breakdown', label: 'Spend breakdown', icon: 'receipt' },
  { id: 'cashflow', label: 'Cash flow', icon: 'arrow-data-transfer-horizontal' },
  { id: 'budget', label: 'Budget and actual', icon: 'sliders-horizontal' },
  { id: 'recurring', label: 'Repeat spending', icon: 'repeat-one-01' },
  { id: 'unusual', label: 'Unusual payments', icon: 'alert-circle' },
  { id: 'forecast', label: 'Month-end forecast', icon: 'clock-01' },
];

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
          <nav aria-label="Reports" className="min-w-0">
            <ul className="space-y-1.5">
              {TILES.map(tile => {
                const isActive = !isPhone && tile.id === activeId;
                return (
                  <li key={tile.id}>
                    <button
                      type="button"
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => openTile(tile.id)}
                      className={cn('surface-card flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-left transition-colors duration-[var(--duration-fast)]', isActive && 'border-primary')}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-muted"><Icon name={tile.icon} size={18} /></span>
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
          </nav>
        )}

        {showReport && (
          <section aria-label={active.label} className="surface-card min-w-0 rounded-[var(--radius-xl)] p-6 max-md:p-5 md:self-start">
            {isPhone && <Button variant="ghost" size="sm" icon="arrow-left-01" className="-ml-2 mb-2" onPress={() => setPhoneReportOpen(false)}>All reports</Button>}
            <h2 className="type-card-title text-ink">{active.label}</h2>
            <p className="type-caption mb-4 mt-1 text-muted"><span className="font-semibold">What it says: </span>{tiles[activeId].says}</p>
            <ReportPanel id={activeId} report={report} cashflowTransactions={cashflowTransactions} groupBy={groupBy} onGroupBy={setGroupBy} isPhone={isPhone} setCurrentPage={setCurrentPage} />
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
          <Select
            label="Account"
            options={[
              { id: 'all', label: 'All accounts' },
              ...sortAccountsByType(accounts).map(account => ({
                id: account.id,
                label: account.name,
                group: account.status === 'closed' ? 'Closed' : account.type,
              })),
            ]}
            value={filters.accountId}
            onChange={accountId => update({ accountId })}
          />
          <Select
            label="Category"
            options={[
              { id: 'all', label: 'All categories' },
              ...categoryPickerOptions(expenseCategories, incomeCategories),
            ]}
            value={filters.category}
            onChange={category => update({ category })}
          />
          <TextInput label="Merchant" value={filters.merchant} onChange={merchant => update({ merchant })} />
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
