import React, { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { Account, Currency } from '../../../types';
import { formatCurrency } from '../../../utils';
import { niceMax, sparkPath, type PlaceCluster, type SparkPoint, type TxKind } from '../../../utils/transactionsModel';
import { AreaSparkline, Gauge, useSparklineHover, CRYSTAL_FLOW_GRADIENTS } from '../../bklit/charts';
import { useMediaQuery } from '../Drawer';
import { NvIcon, type NvIconName } from '../NvIcon';
import { useShellNew } from '../shellContext';
import { Card, IconButton, Money } from '../ui';
import { Bone } from '../Skeleton';

/*
 * The Transactions page's overview (UI_UX_DESIGN_REFERENCE.md §17): a balance card with account tiles, four KPI
 * tiles with gradient sparklines, and the hero card with spending by weekday beside a map of where you spent.
 * Gradients are only on data marks (R10).
 */

const LazyPlacesMap = lazy(() => import('./PlacesMap').then(m => ({ default: m.PlacesMap })));
export const LazySinglePlaceMap = lazy(() => import('./PlacesMap').then(m => ({ default: m.SinglePlaceMap })));

/* ----------------------------------------------------------- balance card */

export type StatId = 'count' | 'income' | 'expense' | 'net';

/**
 * The balance with the page's four statistics (the classic KPIs) under it: how many transactions at the top right,
 * then expenses, income and net. The statistics pick what the chart below draws. Compact on a phone.
 */
export const BalanceCard: React.FC<{
  total: number; count: number; currency: Currency; stats: { count: number; income: number; expense: number; net: number };
  deltas: { count: number | null; income: number | null; expense: number | null; net: number | null };
  metric: StatId; onMetric: (metric: StatId) => void; className?: string;
}> = ({ total, count, currency, stats, deltas, metric, onMetric, className }) => {
  const stat = (id: Exclude<StatId, 'count'>, label: string, dot: string, good: 'up' | 'down', value: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={metric === id}
      onClick={() => onMetric(id)}
      className={cn('min-w-0 rounded-nv-sub bg-nv-surface px-3 py-2.5 text-left transition-shadow sm:px-4 sm:py-3', metric === id && 'ring-[1.5px] ring-nv-ink')}
    >
      <span className="flex items-center gap-1.5 text-[12px] text-nv-muted sm:text-[13px]"><span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />{label}</span>
      <span className="mt-1 block truncate">{value}</span>
      <span className="mt-0.5 block h-4 text-[12px]"><Delta pct={deltas[id]} good={good} /></span>
    </button>
  );
  return (
    <Card className={cn('p-4 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-nv-muted sm:text-[15px]">Total balance</p>
          <div className="mt-1"><Money amount={total} currency={currency} size="hero" className="!text-4xl sm:!text-5xl" /></div>
          <p className="mt-1 text-[13px] text-nv-muted">Across {count} account{count === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          aria-pressed={metric === 'count'}
          onClick={() => onMetric('count')}
          aria-label={`${stats.count} transactions. Show them in the chart`}
          className={cn('flex shrink-0 flex-col items-end rounded-nv-sub bg-nv-surface px-3 py-2.5 text-right sm:px-4', metric === 'count' && 'ring-[1.5px] ring-nv-ink')}
        >
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="nv-tabular text-3xl font-semibold leading-none text-nv-ink sm:text-5xl">{stats.count.toLocaleString()}</span>
            <span className="text-[13px] text-nv-muted sm:text-[15px]">transactions</span>
          </span>
          <span className="mt-1 h-4 text-[12px]"><Delta pct={deltas.count} good="up" /></span>
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {stat('expense', 'Expenses', 'bg-nv-red', 'down', <Money amount={stats.expense} currency={currency} size="lg" className="!text-[15px] sm:!text-xl" />)}
        {stat('income', 'Income', 'bg-nv-green', 'up', <Money amount={stats.income} currency={currency} size="lg" signed={false} className="!text-[15px] sm:!text-xl" />)}
        {stat('net', 'Net', 'bg-nv-sky', 'up', <Money amount={stats.net} currency={currency} size="lg" signed={stats.net > 0} tone={stats.net > 0 ? 'income' : 'ink'} className="!text-[15px] sm:!text-xl" />)}
      </div>
    </Card>
  );
};

/* ---------------------------------------------------------------- KPI tile */

export const Sparkline: React.FC<{ values: number[]; className?: string }> = ({ values, className }) => {
  const id = useId();
  const w = 160, h = 64;
  const line = sparkPath(values, w, h, 4);
  if (!line) return null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-s`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" style={{ stopColor: 'var(--nv-grad-from)' }} /><stop offset="1" style={{ stopColor: 'var(--nv-grad-to)' }} /></linearGradient>
        <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--nv-grad-to)', stopOpacity: 0.28 }} /><stop offset="1" style={{ stopColor: 'var(--nv-grad-from)', stopOpacity: 0 }} /></linearGradient>
      </defs>
      <path d={`${line} L${w - 4},${h} L4,${h} Z`} fill={`url(#${id}-a)`} />
      <path d={line} fill="none" stroke={`url(#${id}-s)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** Change from the previous period. `good` says which direction is good news (less spending, more income). */
export const Delta: React.FC<{ pct: number | null; good: 'up' | 'down' }> = ({ pct, good }) => {
  if (pct === null) return null;
  const up = pct >= 0;
  const fine = pct === 0 || (up ? good === 'up' : good === 'down');
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[13px] font-medium', fine ? 'text-nv-green-text' : 'text-nv-red-text')}>
      <NvIcon name="arrowUpRight" size={14} className={up ? '' : 'rotate-90'} />
      {up ? '+' : ''}{pct}%
    </span>
  );
};

export const KpiTile: React.FC<{
  label: string; children: React.ReactNode; hint?: React.ReactNode; delta?: React.ReactNode; series?: number[]; onClick?: () => void; ariaLabel?: string; className?: string;
  /** A tile that picks what the chart below shows: it carries a ring and `aria-pressed` when picked. */
  selected?: boolean; icon?: NvIconName;
}> = ({ label, children, hint, delta, series, onClick, ariaLabel, className, selected, icon }) => {
  const body = (
    <>
      {/* The sparkline comes first in the DOM so the text, which is positioned after it, paints above it. */}
      {series && <Sparkline values={series} className="pointer-events-none absolute bottom-0 right-0 h-14 w-[52%]" />}
      <p className="relative flex items-center gap-1.5 text-[13px] text-nv-muted">{icon && <NvIcon name={icon} size={15} />}{label}</p>
      <div className="relative mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">{children}{delta}</div>
      {hint && <p className="relative mt-1 truncate text-[13px] text-nv-muted">{hint}</p>}
    </>
  );
  const cls = cn('relative flex min-h-[132px] min-w-0 flex-col overflow-hidden rounded-nv-card bg-nv-tile p-4 text-left sm:p-5', onClick && 'transition-opacity hover:opacity-90', selected && 'ring-[1.5px] ring-nv-ink', className);
  return onClick
    ? <button type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={selected} className={cls}>{body}</button>
    : <div className={cls}>{body}</div>;
};

export const useKpiSize = () => (useMediaQuery('(min-width: 640px)') ? 'xl' : 'lg') as 'xl' | 'lg';

/* ----------------------------------------------------------- weekday chart */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WeekdayChart: React.FC<{
  days: { total: number; count: number }[]; selected: number[]; onToggle: (day: number) => void; currency: Currency;
}> = ({ days, selected, onToggle, currency }) => {
  const max = niceMax(Math.max(...days.map(d => d.total), 0));
  const ticks = [max, max / 2, 0];
  const any = selected.length > 0;
  return (
    <div>
      <div className="flex gap-3">
        <div className="flex h-44 flex-col justify-between pb-0.5 text-right text-[11px] text-nv-faint nv-tabular sm:h-52" aria-hidden>
          {ticks.map(t => <span key={t}>{formatCurrency(t, currency, { compact: true })}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between sm:h-52" aria-hidden>
            {ticks.map(t => <span key={t} className="h-px w-full bg-nv-line/70" />)}
          </div>
          <div className="relative flex h-44 items-end gap-2 sm:h-52 sm:gap-3">
            {days.map((d, i) => {
              const on = selected.includes(i);
              const pct = d.total > 0 ? Math.max(5, (d.total / max) * 100) : 0;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onToggle(i)}
                  aria-pressed={on}
                  aria-label={`${DAY_NAMES[i]}: ${formatCurrency(d.total, currency)} in ${d.count} transaction${d.count === 1 ? '' : 's'}. ${on ? 'Remove from the filter' : 'Filter the list to this day'}`}
                  className="group relative flex h-full flex-1 items-end justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-nv-violet"
                >
                  <span className={cn('absolute left-1/2 z-dropdown -translate-x-1/2 whitespace-nowrap rounded-xl bg-nv-surface px-3 py-1.5 text-center text-[13px] shadow-nv-float transition-opacity', on ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')} style={{ bottom: `calc(${pct}% + 8px)` }}>
                    <span className="nv-tabular block font-semibold text-nv-ink privacy-blur">{formatCurrency(d.total, currency)}</span>
                    <span className="block text-[11px] text-nv-muted">{d.count} transaction{d.count === 1 ? '' : 's'}</span>
                  </span>
                  <span className={cn('w-full rounded-t-2xl rounded-b-lg transition-opacity', d.total > 0 ? 'nv-grad-v' : 'bg-nv-line', any && !on && 'opacity-35')} style={{ height: d.total > 0 ? `${pct}%` : '4px' }} />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2 sm:gap-3" aria-hidden>
            {DAYS.map(d => <span key={d} className="flex-1 text-center text-[12px] text-nv-muted">{d}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- hero */

export const SpendingHero: React.FC<{
  /** The chart (the expenses chart), drawn bare. */
  chart: React.ReactNode;
  clusters: PlaceCluster[]; selectedPlaces: string[]; onTogglePlace: (key: string) => void;
  /** Transactions that name a city but have no coordinates, so the map cannot place them. */
  unplaced: number;
}> = ({ chart, clusters, selectedPlaces, onTogglePlace, unplaced }) => {
  const { isDark } = useShellNew();
  const located = clusters.reduce((n, c) => n + c.count, 0);
  return (
    <Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">{chart}</div>
        <div className="flex flex-col">
          <p className="mb-3 flex items-center justify-between text-[13px] text-nv-muted">
            <span>Where you spent</span>
            <span>{clusters.length ? `${clusters.length} place${clusters.length === 1 ? '' : 's'} · ${located} transactions` : ''}</span>
          </p>
          <div className="relative h-60 overflow-hidden rounded-nv-sub bg-nv-surface sm:h-64 lg:h-auto lg:min-h-[17rem] lg:flex-1">
            {clusters.length > 0 ? (
              <Suspense fallback={<Bone className="h-full w-full rounded-nv-sub" />}>
                <LazyPlacesMap clusters={clusters} selected={selectedPlaces} onSelect={onTogglePlace} dark={isDark} />
              </Suspense>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-nv-violet-soft text-nv-violet-text"><NvIcon name="pin" size={22} /></span>
                <p className="text-[15px] font-medium text-nv-ink">No places yet</p>
                <p className="text-sm text-nv-muted">
                  {unplaced > 0
                    ? `${unplaced} transaction${unplaced === 1 ? ' names' : 's name'} a city but ${unplaced === 1 ? 'has' : 'have'} no coordinates, so the map cannot place ${unplaced === 1 ? 'it' : 'them'}. Choose the place from the location search when you edit one.`
                    : 'Add a location to a transaction, or import ones that have it, and they appear here.'}
                </p>
              </div>
            )}
          </div>
          {clusters.length > 0 && <p className="mt-2 text-[12px] text-nv-muted">Tap a place to filter the list; tap it again to clear.</p>}
        </div>
      </div>
    </Card>
  );
};

/* -------------------------------------------------------- unified hero card */

interface SparkKpiCardProps {
  label: string;
  dotColor: string;
  chartColor: string;
  data: SparkPoint[];
  total: number;
  delta: number | null;
  good: 'up' | 'down';
  currency: Currency;
  active?: boolean;
  onClick?: () => void;
  signed?: boolean;
  tone?: 'income' | 'ink';
}

const SparkKpiCard: React.FC<SparkKpiCardProps> = ({
  label,
  dotColor,
  chartColor,
  data,
  total,
  delta,
  good,
  currency,
  active,
  onClick,
  signed,
  tone,
}) => {
  const hover = useSparklineHover<SparkPoint>();
  const shown = hover.datum ?? data.at(-1);
  const displayValue = shown?.value ?? total;
  const isHovered = hover.datum !== null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group min-w-0 rounded-nv-sub border border-nv-line/50 bg-nv-surface p-2.5 sm:p-3 text-left transition-all',
        onClick && 'cursor-pointer hover:border-nv-line hover:shadow-nv-thumb',
        active && 'border-nv-ink/70 ring-[1.5px] ring-nv-ink'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-nv-muted sm:text-[12px]">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor)} aria-hidden />
          {label}
        </span>
        {isHovered ? (
          <span className="text-[10px] sm:text-[11px] text-nv-muted font-medium truncate max-w-[70px]">
            {shown?.day}
          </span>
        ) : (
          <span className="text-[11px] sm:text-[12px]">
            <Delta pct={delta} good={good} />
          </span>
        )}
      </div>

      <div className="mt-1 truncate">
        <Money
          amount={displayValue}
          currency={currency}
          size="lg"
          signed={signed}
          tone={tone}
          className="!text-[15px] sm:!text-lg font-semibold"
        />
      </div>

      <div className="mt-2 h-10 w-full overflow-hidden">
        {data && data.length > 1 ? (
          <AreaSparkline
            data={data}
            dataKey="value"
            color={chartColor}
            height={40}
            curve="monotone"
            fill="gradient"
            fillOpacity={0.32}
            strokeWidth={2}
            {...hover.sparklineProps}
          />
        ) : (
          <div className="h-full w-full rounded bg-nv-inset/40" />
        )}
      </div>
    </div>
  );
};

export interface TransactionsHeroCardProps {
  total: number;
  accountCount: number;
  currency: Currency;
  accounts?: Account[];
  selectedAccountIds?: string[];
  onToggleAccount?: (id: string) => void;
  stats: { count: number; income: number; expense: number; net: number };
  deltas: { count: number | null; income: number | null; expense: number | null; net: number | null };
  sparkSeries?: {
    income: SparkPoint[];
    expense: SparkPoint[];
    net: SparkPoint[];
  };
  activeKinds: TxKind[];
  onToggleKind: (kind: TxKind) => void;
  clusters: PlaceCluster[];
  selectedPlaces: string[];
  onTogglePlace: (key: string) => void;
  unplaced: number;
  className?: string;
}

/**
 * Unified Transactions Hero Card: merges total balance, accounts flyout, cash flow summary
 * with AreaSparklines, notched dual-gradient flow bar, and the interactive places map.
 */
export const TransactionsHeroCard: React.FC<TransactionsHeroCardProps> = ({
  total,
  accountCount,
  currency,
  accounts,
  selectedAccountIds,
  onToggleAccount,
  stats,
  deltas,
  sparkSeries,
  activeKinds,
  onToggleKind,
  clusters,
  selectedPlaces,
  onTogglePlace,
  unplaced,
  className,
}) => {
  const { isDark } = useShellNew();
  const located = clusters.reduce((n, c) => n + c.count, 0);

  // Accounts flyout state
  const [accountsOpen, setAccountsOpen] = useState(false);
  const accountsRef = useRef<HTMLDivElement>(null);

  // Map state: count vs spent metric, fullscreen dialog mode
  const [mapMetric, setMapMetric] = useState<'count' | 'spent'>('count');
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    if (!accountsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (accountsRef.current && !accountsRef.current.contains(e.target as Node)) {
        setAccountsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [accountsOpen]);

  const hasFlow = stats.income > 0 || stats.expense > 0;
  const totalFlow = stats.income + stats.expense;
  const incomePct = totalFlow > 0 ? (stats.income / totalFlow) * 100 : 0;
  const expensePct = totalFlow > 0 ? (stats.expense / totalFlow) * 100 : 0;

  const topClusters = useMemo(
    () => [...clusters].sort((a, b) => b.count - a.count).slice(0, 4),
    [clusters]
  );

  return (
    <>
      <Card className={cn('p-4 sm:p-5 lg:p-6', className)}>
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Left Column: Balance, accounts popover, period count, notched flow bar, and sparkline KPI cards */}
          <div className="flex min-w-0 flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-nv-muted">Total balance</p>
                    {/* Interactive Account Breakdown Flyout */}
                    <div className="relative inline-block" ref={accountsRef}>
                      <button
                        type="button"
                        onClick={() => setAccountsOpen(!accountsOpen)}
                        aria-expanded={accountsOpen}
                        className="inline-flex items-center gap-1.5 rounded-full border border-nv-line/60 bg-nv-surface px-2.5 py-0.5 text-[11px] font-medium text-nv-muted transition-colors hover:border-nv-line hover:text-nv-ink"
                      >
                        <span>Across {accountCount} {accountCount === 1 ? 'account' : 'accounts'}</span>
                        <NvIcon name="arrowDown" size={10} className={cn('transition-transform duration-200', accountsOpen && 'rotate-180')} />
                      </button>

                      {accountsOpen && accounts && accounts.length > 0 && (
                        <div className="absolute left-0 top-full mt-2 z-dropdown w-72 rounded-nv-sub border border-nv-line/70 bg-nv-surface p-2 shadow-nv-float">
                          <div className="flex items-center justify-between border-b border-nv-line/50 px-2 py-1.5 text-[11px] font-medium text-nv-muted">
                            <span>Your Accounts ({accounts.length})</span>
                            {selectedAccountIds && selectedAccountIds.length > 0 && onToggleAccount && (
                              <button
                                type="button"
                                onClick={() => selectedAccountIds.forEach(id => onToggleAccount(id))}
                                className="text-nv-violet-text hover:underline"
                              >
                                Clear filter
                              </button>
                            )}
                          </div>
                          <div className="mt-1 max-h-56 overflow-y-auto space-y-0.5">
                            {accounts.map(acc => {
                              const isSelected = selectedAccountIds?.includes(acc.id);
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => onToggleAccount?.(acc.id)}
                                  className={cn(
                                    'flex w-full items-center justify-between rounded-nv-sub px-2.5 py-2 text-left text-[12px] transition-colors',
                                    isSelected ? 'bg-nv-violet-soft text-nv-violet-text font-medium' : 'hover:bg-nv-tile text-nv-ink'
                                  )}
                                >
                                  <div className="min-w-0 pr-2">
                                    <p className="truncate font-medium">{acc.name}</p>
                                    <p className="text-[10px] text-nv-muted capitalize">{acc.type}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <Money amount={acc.balance} currency={acc.currency} className="text-[12px] font-semibold" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <Money amount={total} currency={currency} size="hero" className="!text-3xl sm:!text-4xl lg:!text-5xl tracking-tight" />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end rounded-nv-sub border border-nv-line/50 bg-nv-surface px-3 py-2 text-right">
                  <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="nv-tabular text-xl font-semibold leading-none text-nv-ink sm:text-2xl">{stats.count.toLocaleString()}</span>
                    <span className="text-[12px] text-nv-muted">txns</span>
                  </span>
                  {deltas.count !== null && (
                    <span className="mt-1 text-[11px]">
                      <Delta pct={deltas.count} good="up" />
                    </span>
                  )}
                </div>
              </div>

              {/* Notched Dual-Gradient Inflow vs Outflow Flow Bar */}
              {hasFlow && (
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-nv-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-nv-green" aria-hidden />
                      Inflow {incomePct.toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1.5">
                      Outflow {expensePct.toFixed(0)}%
                      <span className="h-1.5 w-1.5 rounded-full bg-nv-red" aria-hidden />
                    </span>
                  </div>
                  <Gauge
                    orientation="linear"
                    value={Math.round(incomePct)}
                    totalNotches={54}
                    spacing={0}
                    notchCornerRadius={2.5}
                    notchLengthPercent={38}
                    inactiveFillOpacity={0.85}
                    activeGradient={CRYSTAL_FLOW_GRADIENTS.active}
                    inactiveGradient={CRYSTAL_FLOW_GRADIENTS.inactive}
                    useGradient
                    linearHeight={14}
                    minWidth={0}
                  />
                </div>
              )}
            </div>

            {/* Cash Flow Summary Tiles with AreaSparklines */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <SparkKpiCard
                label="Income"
                dotColor="bg-nv-green"
                chartColor="var(--nv-green)"
                data={sparkSeries?.income ?? []}
                total={stats.income}
                delta={deltas.income}
                good="up"
                currency={currency}
                active={activeKinds.includes('income')}
                onClick={() => onToggleKind('income')}
                signed={false}
              />

              <SparkKpiCard
                label="Expenses"
                dotColor="bg-nv-red"
                chartColor="var(--nv-red)"
                data={sparkSeries?.expense ?? []}
                total={stats.expense}
                delta={deltas.expense}
                good="down"
                currency={currency}
                active={activeKinds.includes('expense')}
                onClick={() => onToggleKind('expense')}
                signed={false}
              />

              <SparkKpiCard
                label="Net"
                dotColor="bg-nv-grad-from"
                chartColor="var(--nv-grad-from)"
                data={sparkSeries?.net ?? []}
                total={stats.net}
                delta={deltas.net}
                good="up"
                currency={currency}
                signed={stats.net > 0}
                tone={stats.net > 0 ? 'income' : 'ink'}
              />
            </div>
          </div>

          {/* Right Column: Interactive Map with Quick-Chips, Txns/Spend Toggle & Expand */}
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between text-[13px] text-nv-muted">
              <span className="flex items-center gap-1.5 font-medium text-nv-ink">
                <NvIcon name="pin" size={15} className="text-nv-violet-text" />
                Where you spent
              </span>

              <div className="flex items-center gap-2">
                {/* Segmented Metric Toggle (Count vs Spend) */}
                <div className="inline-flex items-center rounded-full border border-nv-line/60 bg-nv-surface p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setMapMetric('count')}
                    className={cn(
                      'rounded-full px-2 py-0.5 font-medium transition-colors',
                      mapMetric === 'count' ? 'bg-nv-ink text-nv-on-ink' : 'text-nv-muted hover:text-nv-ink'
                    )}
                  >
                    Txns
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMetric('spent')}
                    className={cn(
                      'rounded-full px-2 py-0.5 font-medium transition-colors',
                      mapMetric === 'spent' ? 'bg-nv-ink text-nv-on-ink' : 'text-nv-muted hover:text-nv-ink'
                    )}
                  >
                    Spend
                  </button>
                </div>

                {clusters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsMapExpanded(true)}
                    title="Expand map view"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-nv-line/60 bg-nv-surface text-nv-muted hover:border-nv-line hover:text-nv-ink transition-colors"
                  >
                    <NvIcon name="arrowUpRight" size={14} />
                  </button>
                )}

                {selectedPlaces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selectedPlaces.forEach(p => onTogglePlace(p))}
                    className="rounded-full bg-nv-violet-soft px-2 py-0.5 text-[11px] font-medium text-nv-violet-text transition-opacity hover:opacity-80"
                  >
                    Clear ({selectedPlaces.length})
                  </button>
                )}
              </div>
            </div>

            {/* Top Location Quick-Chips */}
            {topClusters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2">
                {topClusters.map(c => {
                  const isSelected = selectedPlaces.includes(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => onTogglePlace(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all',
                        isSelected
                          ? 'bg-nv-ink text-nv-on-ink shadow-sm'
                          : 'border border-nv-line/60 bg-nv-surface text-nv-muted hover:border-nv-line hover:text-nv-ink'
                      )}
                    >
                      <NvIcon name="pin" size={10} className={isSelected ? 'text-nv-on-ink' : 'text-nv-violet-text'} />
                      <span className="truncate max-w-[85px]">{c.label}</span>
                      <span className="nv-tabular opacity-75">
                        {mapMetric === 'spent' ? formatCurrency(c.spent, currency, { compact: true }) : c.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="relative min-h-[190px] flex-1 overflow-hidden rounded-nv-sub border border-nv-line/50 bg-nv-surface sm:min-h-[210px] lg:min-h-[220px]">
              {clusters.length > 0 ? (
                <Suspense fallback={<Bone className="h-full w-full rounded-nv-sub" />}>
                  <LazyPlacesMap
                    clusters={clusters}
                    selected={selectedPlaces}
                    onSelect={onTogglePlace}
                    dark={isDark}
                    metric={mapMetric}
                    currency={currency}
                  />
                </Suspense>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-nv-violet-soft text-nv-violet-text">
                    <NvIcon name="pin" size={18} />
                  </span>
                  <p className="text-[14px] font-medium text-nv-ink">No places yet</p>
                  <p className="max-w-xs text-[12px] text-nv-muted">
                    {unplaced > 0
                      ? `${unplaced} transaction${unplaced === 1 ? ' has' : 's have'} no coordinates to place on map.`
                      : 'Add a location to transactions to see them here.'}
                  </p>
                </div>
              )}
            </div>

            {clusters.length > 0 && (
              <p className="mt-1.5 text-[11px] text-nv-muted">
                Tap a place to filter the list; tap again to clear.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Expanded Map Modal Dialog */}
      {isMapExpanded && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 sm:p-6 bg-nv-ink/60 backdrop-blur-sm">
          <div className="relative flex flex-col w-full max-w-4xl h-[75vh] rounded-nv-card bg-nv-surface p-4 sm:p-5 shadow-nv-float border border-nv-line">
            <div className="flex items-center justify-between pb-3 border-b border-nv-line/50">
              <div className="flex items-center gap-2">
                <NvIcon name="pin" size={18} className="text-nv-violet-text" />
                <h3 className="font-semibold text-nv-ink text-base">Where you spent</h3>
                <span className="text-xs text-nv-muted">
                  {clusters.length} {clusters.length === 1 ? 'place' : 'places'} · {located} transactions
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Metric Toggle */}
                <div className="inline-flex items-center rounded-full border border-nv-line/60 bg-nv-tile p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMapMetric('count')}
                    className={cn('rounded-full px-2.5 py-0.5 font-medium transition-colors', mapMetric === 'count' ? 'bg-nv-ink text-nv-on-ink' : 'text-nv-muted')}
                  >
                    Txns
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMetric('spent')}
                    className={cn('rounded-full px-2.5 py-0.5 font-medium transition-colors', mapMetric === 'spent' ? 'bg-nv-ink text-nv-on-ink' : 'text-nv-muted')}
                  >
                    Spend
                  </button>
                </div>
                <IconButton icon="close" label="Close expanded map" tone="chip" onClick={() => setIsMapExpanded(false)} />
              </div>
            </div>

            {/* Quick chips in expanded view */}
            {topClusters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 py-2.5">
                {clusters.map(c => {
                  const isSelected = selectedPlaces.includes(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => onTogglePlace(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                        isSelected
                          ? 'bg-nv-ink text-nv-on-ink shadow-sm'
                          : 'border border-nv-line/60 bg-nv-surface text-nv-muted hover:border-nv-line hover:text-nv-ink'
                      )}
                    >
                      <NvIcon name="pin" size={11} className={isSelected ? 'text-nv-on-ink' : 'text-nv-violet-text'} />
                      <span>{c.label}</span>
                      <span className="nv-tabular opacity-75">
                        {mapMetric === 'spent' ? formatCurrency(c.spent, currency, { compact: true }) : `${c.count} txns`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 relative overflow-hidden rounded-nv-sub mt-2 bg-nv-inset">
              <Suspense fallback={<Bone className="h-full w-full rounded-nv-sub" />}>
                <LazyPlacesMap
                  clusters={clusters}
                  selected={selectedPlaces}
                  onSelect={onTogglePlace}
                  dark={isDark}
                  metric={mapMetric}
                  currency={currency}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

