import React, { Suspense, lazy, useId, useRef } from 'react';
import { cn } from '../../../lib/utils';
import type { Account, Currency } from '../../../types';
import { formatCurrency } from '../../../utils';
import { niceMax, sparkPath, type PlaceCluster } from '../../../utils/transactionsModel';
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
