import React, { useMemo, useState } from 'react';
import type { Currency } from '../../types';
import { formatCurrency } from '../../utils';
import {
  AreaSparkline,
  Bar,
  BarChart,
  BarXAxis,
  ChartMarkers,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  LineSeriesTerminalMarker,
  PieCenter,
  PieChart,
  PieSlice,
  Ring,
  RingCenter,
  RingChart,
  XAxis,
  YAxis,
  type ChartMarker,
} from '../../src/components/charts';
import { Amount } from '../ui/Money';
import { cn } from '../../lib/utils';

/** Bklit wrappers for the account pages, in the app's tokens. Every chart with two or more series has a legend. */

export const compactTick = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${(value / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value));
};

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
  /** Dash the line from this point on (a forecast). */
  dashFromIndex?: number;
  dashed?: boolean;
  width?: number;
}

export const Legend: React.FC<{ items: { label: string; color: string; dashed?: boolean }[]; className?: string }> = ({ items, className }) => (
  <ul className={cn('flex flex-wrap gap-x-4 gap-y-1', className)}>
    {items.map(item => (
      <li key={item.label} className="type-caption flex items-center gap-1.5 text-muted">
        <span aria-hidden="true" className={cn('h-0.5 w-4 rounded-full', item.dashed && 'bg-transparent border-t-2 border-dashed')} style={item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }} />
        {item.label}
      </li>
    ))}
  </ul>
);

/** Lines over time. Data rows carry a `date` (Date) and one number per series key. */
export const TimeSeries: React.FC<{
  data: Record<string, unknown>[];
  series: SeriesSpec[];
  currency: Currency;
  markers?: ChartMarker[];
  height?: string;
  showLegend?: boolean;
  terminalKey?: string;
}> = ({ data, series, currency, markers, height = 'h-[220px] md:h-[280px]', showLegend = series.length > 1, terminalKey }) => {
  // Over about 15 months, ticks name the month and year; shorter spans name the day.
  const span = useMemo(() => {
    const times = data.map(row => (row.date instanceof Date ? row.date.getTime() : NaN)).filter(Number.isFinite);
    return times.length ? Math.max(...times) - Math.min(...times) : 0;
  }, [data]);
  const long = span > 450 * 86_400_000;
  const veryLong = span > 6 * 365 * 86_400_000;
  const formatTick = (value: Date | number) => {
    const date = value instanceof Date ? value : new Date(value);
    return veryLong ? String(date.getFullYear()) : long ? date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  return (
  <div className="space-y-3">
    {showLegend && <Legend items={series.map(item => ({ label: item.label, color: item.color, dashed: item.dashed }))} />}
    <LineChart data={data} xDataKey="date" yDomainTween aspectRatio="" className={cn('w-full', height)} margin={{ top: 16, right: 16, bottom: 24, left: 52 }}>
      <Grid horizontal stroke="var(--line)" />
      <XAxis tickFormatter={formatTick} />
      <YAxis tickFormatter={compactTick} />
      {series.map(item => (
        <Line
          key={item.key}
          dataKey={item.key}
          stroke={item.color}
          strokeWidth={item.width ?? 2}
          dashFromIndex={item.dashFromIndex}
          dashArray="6,4"
          strokeDasharray={item.dashed ? '4,4' : undefined}
          fadeEdges={item.dashFromIndex !== undefined}
        />
      ))}
      {terminalKey && <LineSeriesTerminalMarker dataKey={terminalKey} stroke={series.find(item => item.key === terminalKey)?.color ?? 'var(--chart-1)'} />}
      {markers && markers.length > 0 && <ChartMarkers items={markers} />}
      <ChartTooltip
        rows={point => series
          .filter(item => typeof point[item.key] === 'number')
          .map(item => ({ color: item.color, label: item.label, value: formatCurrency(point[item.key] as number, currency) }))}
      />
    </LineChart>
  </div>
  );
};

/** Bars by category (months, years). Two or more bar keys get a legend. */
export const Bars: React.FC<{
  data: Record<string, unknown>[];
  bars: { key: string; label: string; color: string }[];
  currency: Currency;
  stacked?: boolean;
  xKey?: string;
  height?: string;
  formatValue?: (value: number) => string;
}> = ({ data, bars, currency, stacked, xKey = 'name', height = 'h-[220px] md:h-[260px]', formatValue }) => (
  <div className="space-y-3">
    {bars.length > 1 && <Legend items={bars.map(bar => ({ label: bar.label, color: bar.color }))} />}
    <div className={height}>
      <BarChart data={data} xDataKey={xKey} stacked={stacked} aspectRatio="auto" margin={{ top: 12, right: 12, left: 12, bottom: 25 }}>
        <Grid horizontal vertical={false} strokeOpacity={0.06} />
        {bars.map(bar => <Bar key={bar.key} dataKey={bar.key} fill={bar.color} lineCap="round" />)}
        <BarXAxis />
        <ChartTooltip valueFormatter={(value: number) => (formatValue ? formatValue(value) : formatCurrency(value, currency))} />
      </BarChart>
    </div>
  </div>
);

export const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--muted)'];

/** A donut with its total in the middle and a legend beside it. Hovering a slice shows its share. */
export const Donut: React.FC<{ items: { label: string; value: number; color?: string }[]; currency: Currency; centerLabel: string; size?: number; onPick?: (label: string) => void }> = ({ items, currency, centerLabel, size = 180, onPick }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const data = items.map((item, index) => ({ label: item.label, value: item.value, color: item.color ?? PALETTE[index % PALETTE.length] }));
  if (total <= 0) return <p className="type-body text-muted">Nothing here yet.</p>;
  return (
    <div className="flex items-center gap-6 max-sm:flex-col">
      <div className="shrink-0" style={{ width: size }}>
        <PieChart data={data} size={size} innerRadius={Math.round(size * 0.32)} cornerRadius={6} padAngle={data.length > 1 ? 0.04 : 0}>
          {data.map((_, index) => <PieSlice key={index} index={index} />)}
          <PieCenter defaultLabel={centerLabel}>
            {({ value, label }) => (
              <div className="flex flex-col items-center text-center">
                <span className="type-caption text-muted">{label}</span>
                <span className="type-figure-row text-ink"><Amount value={value} currency={currency} /></span>
              </div>
            )}
          </PieCenter>
        </PieChart>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {data.map(item => {
          const body = (
            <>
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="type-body min-w-0 flex-1 truncate text-ink">{item.label}</span>
              <span className="type-caption text-muted">{Math.round((item.value / total) * 100)}%</span>
              <span className="type-figure-row text-ink"><Amount value={item.value} currency={currency} /></span>
            </>
          );
          return (
            <li key={item.label}>
              {onPick
                ? <button type="button" onClick={() => onPick(item.label)} className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 text-left hover:bg-inset">{body}</button>
                : <div className="flex items-center gap-2 px-1 py-1">{body}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** Concentric progress rings, such as goals held in an account. */
export const ProgressRings: React.FC<{ items: { label: string; value: number; max: number }[]; currency: Currency; size?: number }> = ({ items, currency, size = 170 }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const data = items.slice(0, 5).map((item, index) => ({ label: item.label, value: Math.max(0, item.value), maxValue: Math.max(1, item.max), color: PALETTE[index] }));
  const stroke = Math.max(8, Math.round(size / 14));
  return (
    <div className="flex items-center gap-6 max-sm:flex-col">
      <RingChart data={data} size={size} strokeWidth={stroke} ringGap={Math.round(stroke / 2)} baseInnerRadius={Math.round(size * 0.2)} hoveredIndex={hovered} onHoverChange={setHovered}>
        {data.map((_, index) => <Ring key={index} index={index} />)}
        <RingCenter defaultLabel="Saved" formatOptions={{ style: 'currency', currency: currency === 'BTC' ? 'EUR' : currency, notation: 'compact', maximumFractionDigits: 1 }} />
      </RingChart>
      <ul className="w-full min-w-0 space-y-2">
        {items.slice(0, 5).map((item, index) => (
          <li key={item.label} className="flex items-center gap-2" onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[index] }} />
            <span className="type-body min-w-0 flex-1 truncate text-ink">{item.label}</span>
            <span className="type-caption text-muted">{item.max > 0 ? Math.min(100, Math.round((item.value / item.max) * 100)) : 0}%</span>
            <span className="type-figure-row text-ink"><Amount value={item.value} currency={currency} /> <span className="type-caption text-muted">of <Amount value={item.max} currency={currency} /></span></span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** A small area sparkline, for figures on the coloured hero. */
export const HeroSpark: React.FC<{ values: number[] }> = ({ values }) => (
  values.length > 1
    ? <AreaSparkline data={values.map((value, index) => ({ index, value }))} dataKey="value" height={28} curve="natural" color="var(--on-pine)" animationDuration={900} />
    : null
);

/** A thin bar for a share of something, on the hero or a card. */
export const ShareBar: React.FC<{ value: number; label: string; onHero?: boolean; tone?: 'ok' | 'warn' | 'bad' }> = ({ value, label, onHero, tone = 'ok' }) => (
  <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={cn('h-1.5 overflow-hidden rounded-full', onHero ? 'bg-on-pine/25' : 'bg-inset')}>
    <div
      className={cn('h-full rounded-full transition-[width] duration-700', onHero ? 'bg-on-pine' : tone === 'bad' ? 'bg-money-out' : tone === 'warn' ? 'bg-amber' : 'bg-pill')}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

/** A card section on the Overview grid. */
export const Section: React.FC<{ title: string; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, subtitle, action, className, children }) => (
  <section className={cn('min-w-0 rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5', className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="type-card-title text-ink">{title}</h3>
        {subtitle && <p className="type-caption text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

/** Two or three figures side by side inside a section. */
export const Figures: React.FC<{ items: { label: string; value: React.ReactNode; note?: React.ReactNode }[]; className?: string }> = ({ items, className }) => (
  <dl className={cn('grid gap-4', items.length >= 3 ? 'grid-cols-3 max-sm:grid-cols-2' : 'grid-cols-2', className)}>
    {items.map(item => (
      <div key={item.label} className="min-w-0">
        <dt className="type-label truncate text-muted">{item.label}</dt>
        <dd className="type-figure-row mt-0.5 truncate text-ink">{item.value}</dd>
        {item.note && <dd className="type-caption truncate text-muted">{item.note}</dd>}
      </div>
    ))}
  </dl>
);
