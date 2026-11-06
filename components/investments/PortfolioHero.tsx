import React, { useEffect, useMemo, useState } from 'react';
import { curveMonotoneX } from '@visx/curve';
import type { Currency } from '../../types';
import { formatCurrency, parseLocalDate } from '../../utils';
import { ChartTooltip, Grid, Line, LineChart, LineSeriesTerminalMarker, XAxis, YAxis } from '../../src/components/charts';
import { useChartHover } from '../../src/components/charts/chart-context';
import { SpotlightIndicator } from '../../src/components/charts/spotlight-indicator';
import { HorizonArea } from '../ForecastHorizonChart';
import { Legend } from '../accounts/charts';
import { Badge } from '../ui/Display';
import { Amount } from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { cn } from '../../lib/utils';

export interface HeroPoint { date: string; value: number; invested?: number }

interface PortfolioHeroProps {
  points: HeroPoint[];
  currency: Currency;
  /** Today's value, shown when the pointer is off the chart. */
  value: number;
  /** Unrealised gain on what is priced, and its share of cost. */
  gain: number;
  gainPct: number;
  ranges: { id: string; label: string }[];
  range: string;
  onRangeChange: (id: string) => void;
  rangeWords: string;
  figures: { label: string; value: React.ReactNode; note?: React.ReactNode }[];
  className?: string;
}

const longDay = (date: string) => parseLocalDate(date.slice(0, 10)).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
/** Value ticks for a fitted axis: four significant digits, so a narrow range still reads as distinct steps. */
const fitFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumSignificantDigits: 4 });
export const fitTick = (value: number) => fitFormat.format(value);

/** Ticks name the day over short spans, the month and year past about 15 months, and the year past six. */
export const spanTick = (rows: { date: Date }[]) => {
  const span = rows.length > 1 ? rows[rows.length - 1].date.getTime() - rows[0].date.getTime() : 0;
  const long = span > 450 * 86_400_000;
  const veryLong = span > 6 * 365 * 86_400_000;
  return (value: Date | number) => {
    const date = value instanceof Date ? value : new Date(value);
    return veryLong ? String(date.getFullYear()) : long ? date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
};
const signedPct = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`;

/** Passes the point under the pointer up to the hero, so the big figure follows it. */
const ScrubSync: React.FC<{ onChange: (index: number | null) => void }> = ({ onChange }) => {
  const { tooltipData } = useChartHover();
  const index = tooltipData ? tooltipData.index : null;
  useEffect(() => { onChange(index); }, [index, onChange]);
  return null;
};

/**
 * The portfolio's headline: its value, what changed over the range, and the value line with what you put in beside
 * it. Moving across the chart scrubs the headline to that day.
 */
const PortfolioHero: React.FC<PortfolioHeroProps> = ({ points, currency, value, gain, gainPct, ranges, range, onRangeChange, rangeWords, figures, className }) => {
  const [scrub, setScrub] = useState<number | null>(null);
  const rows = useMemo(() => points.map(point => ({ ...point, date: parseLocalDate(point.date.slice(0, 10)) })), [points]);
  const tick = useMemo(() => spanTick(rows), [rows]);
  const hasChart = rows.length > 1;
  const hasInvested = hasChart && points.some(point => typeof point.invested === 'number' && point.invested !== 0);
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? value;
  const shown = scrub !== null && points[scrub] ? points[scrub] : null;
  const headline = shown ? shown.value : value;
  const change = (shown ? shown.value : last) - first;
  const changePct = first > 0 ? (change / first) * 100 : null;
  const rising = change >= 0;
  const lineColor = rising ? 'var(--money-in)' : 'var(--money-out)';
  const invested = shown?.invested;

  return (
    <section aria-label="Portfolio value" className={cn('min-w-0 rounded-[var(--radius-xl)] surface-card flex flex-col p-6 max-md:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label text-muted">{shown ? longDay(shown.date) : 'Portfolio value'}</p>
          <p className="type-figure-hero mt-1 text-ink" aria-live="polite"><Amount value={headline} currency={currency} /></p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hasChart && (
              <Badge tone={rising ? 'positive' : 'negative'} icon={rising ? 'chart-line-data-01' : 'chart-decrease'}>
                <Amount value={change} currency={currency} tone="flow" />{changePct !== null && <span>&nbsp;{signedPct(changePct)}</span>}
              </Badge>
            )}
            <span className="type-caption text-muted">{shown ? 'from the start of the range' : rangeWords}</span>
            {invested !== undefined && <span className="type-caption text-muted">· invested <Amount value={invested} currency={currency} /></span>}
          </div>
        </div>
        <SegmentedControl items={ranges} activeId={range} onChange={onRangeChange} />
      </div>

      <div className="mt-4 min-h-[220px] flex-1 md:min-h-[280px]">
        {hasChart ? (
          <LineChart data={rows} xDataKey="date" revealSignature={`${range}-${rows.length}`} yDomainTween fitYDomain aspectRatio="" className="h-full min-h-[220px] w-full md:min-h-[280px]" margin={{ top: 12, right: 12, bottom: 24, left: 48 }}>
            <Grid horizontal numTicksRows={4} stroke="var(--line)" />
            <SpotlightIndicator seriesKey="value" color={lineColor} />
            <HorizonArea seriesKey="value" color={lineColor} curve={curveMonotoneX} />
            <XAxis numTicks={5} tickMode="domain" tickFormatter={tick} />
            <YAxis numTicks={4} tickFormatter={fitTick} />
            {hasInvested && <Line dataKey="invested" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5,5" curve={curveMonotoneX} fadeEdges={false} />}
            <Line dataKey="value" stroke={lineColor} strokeWidth={2.25} curve={curveMonotoneX} fadeEdges={false} />
            <LineSeriesTerminalMarker dataKey="value" stroke={lineColor} fill={lineColor} />
            <ScrubSync onChange={setScrub} />
            <ChartTooltip
              showCrosshair
              rows={point => [
                { color: lineColor, label: 'Value', value: formatCurrency(Number(point.value) || 0, currency) },
                ...(hasInvested && typeof point.invested === 'number' ? [
                  { color: 'var(--muted)', label: 'Net invested', value: formatCurrency(point.invested, currency) },
                  { color: Number(point.value) >= point.invested ? 'var(--money-in)' : 'var(--money-out)', label: 'Return', value: formatCurrency(Number(point.value) - point.invested, currency) },
                ] : []),
              ]}
            />
          </LineChart>
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-[var(--radius-lg)] bg-inset">
            <p className="type-body text-muted">Log prices or add trades to see this over time.</p>
          </div>
        )}
      </div>
      {hasInvested && <Legend className="mt-2" items={[{ label: 'Value', color: lineColor }, { label: 'Net invested', color: 'var(--muted)', dashed: true }]} />}

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="type-label truncate text-muted">Unrealised</dt>
          <dd className={cn('type-figure-row mt-0.5 truncate', gain >= 0 ? 'text-money-in' : 'text-money-out')}><Amount value={gain} currency={currency} tone="flow" /></dd>
          <dd className="type-caption text-muted">{signedPct(gainPct)} on cost</dd>
        </div>
        {figures.map(item => (
          <div key={item.label} className="min-w-0">
            <dt className="type-label truncate text-muted">{item.label}</dt>
            <dd className="type-figure-row mt-0.5 truncate text-ink">{item.value}</dd>
            {item.note && <dd className="type-caption truncate text-muted">{item.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
};

export default PortfolioHero;
