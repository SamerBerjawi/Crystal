import React, { useMemo } from 'react';
import { curveLinear } from '@visx/curve';
import type { Currency } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from '../src/components/charts';
import { useChartStable, useYScale } from '../src/components/charts/chart-context';
import { SpotlightIndicator } from '../src/components/charts/spotlight-indicator';
import { HorizonArea, compact, labelWidth, shortDay } from './ForecastHorizonChart';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { useWidgetBox } from './ui/WidgetGrid';

export interface HorizonNext30 {
  days: { date: string; total: number }[];
  expectedIn: number;
  goingOut: number;
  lowest: { value: number; date: string } | null;
  /** The buffer to keep, in the same currency as the balances. 0 for none. */
  buffer: number;
}

interface CashHorizonWidgetProps {
  next30: HorizonNext30;
  /** The lowest balance over longer horizons, for the line under the chart. */
  forecasts: { period: string; lowestBalance: number; date: string }[];
  currency: Currency;
  /** Converts the longer horizons, which arrive in the main currency, to the display currency. */
  toDisplay: (eur: number) => number;
}

const Layer: React.FC<{ today: string; lowest: HorizonNext30['lowest']; buffer: number; compactLabels: boolean; currency: Currency }> = ({ today, lowest, buffer, compactLabels, currency }) => {
  const { xScale, innerWidth, innerHeight } = useChartStable();
  const yScale = useYScale();
  const todayX = xScale(parseLocalDate(today));
  const bufferY = buffer > 0 ? yScale(buffer) : undefined;
  return (
    <g>
      {yScale(0) >= 0 && yScale(0) <= innerHeight && <line x1={0} x2={innerWidth} y1={yScale(0)} y2={yScale(0)} stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.5} pointerEvents="none" />}
      {bufferY !== undefined && bufferY >= 0 && bufferY <= innerHeight && (
        <line x1={0} x2={innerWidth} y1={bufferY} y2={bufferY} stroke="var(--tomato)" strokeWidth={1.5} strokeDasharray="5,4" pointerEvents="none"><title>Your buffer</title></line>
      )}
      <line x1={todayX} x2={todayX} y1={0} y2={innerHeight} stroke="var(--ink)" strokeWidth={1.5} pointerEvents="none" />
      {lowest && (() => {
        const lx = xScale(parseLocalDate(lowest.date));
        const ly = yScale(lowest.value);
        const text = `${formatCurrency(lowest.value, currency)} low, ${shortDay(lowest.date)}`;
        const w = labelWidth(text) - 8;
        const flip = ly < 40;
        const left = Math.max(0, Math.min(lx - w / 2, innerWidth - w));
        return (
          <g pointerEvents="none">
            <circle cx={lx} cy={ly} r={5} fill="var(--money-out)" stroke="var(--solid)" strokeWidth={2} />
            {!compactLabels && (
              <g transform={`translate(${left},${flip ? ly + 12 : ly - 30})`}>
                <rect width={w} height={20} rx={10} fill="var(--money-out)" />
                <text x={w / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--on-danger)">{text}</text>
              </g>
            )}
          </g>
        );
      })()}
    </g>
  );
};
(Layer as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

/**
 * The next 30 days of your balance, with every planned payment applied: the line, the lowest point, and what comes in and
 * goes out. Below the line, the lowest point over longer horizons. It is the cash horizon, small.
 */
const CashHorizonWidget: React.FC<CashHorizonWidgetProps> = ({ next30, forecasts, currency, toDisplay }) => {
  const box = useWidgetBox();
  const { days, expectedIn, goingOut, lowest, buffer } = next30;
  const data = useMemo(() => days.map(day => ({ date: parseLocalDate(day.date), total: day.total })), [days]);

  const showChart = data.length > 1 && (box.height === 0 || box.height >= 210);
  const showLonger = forecasts.length > 0 && (box.height === 0 || box.height >= 360);
  const tight = box.height > 0 && (box.height < 260 || box.width < 360);
  const underBuffer = lowest && buffer > 0 && lowest.value < buffer ? buffer - lowest.value : 0;
  const isNegative = !!lowest && lowest.value < 0;
  const lowTone = isNegative ? 'bg-money-out-soft' : underBuffer > 0 ? 'bg-amber-soft' : 'bg-inset';
  const lowIcon = isNegative ? { name: 'alert-02', tone: 'text-money-out' } : underBuffer > 0 ? { name: 'alert-circle', tone: 'text-attention-text' } : { name: 'checkmark-circle-02', tone: 'text-money-in' };
  const columns = box.width > 0 && box.width < 420 ? 'grid-cols-1' : 'grid-cols-3';
  const lowestValue = lowest?.value ?? 0;

  return (
    <div className="flex h-full flex-col gap-3">
      {showChart && (
        <div className="min-h-[90px] flex-1">
          <LineChart data={data} xDataKey="date" aspectRatio="" className="h-full w-full" margin={{ top: 12, right: 12, bottom: 22, left: tight ? 40 : 52 }}>
            <Grid horizontal numTicksRows={3} />
            <SpotlightIndicator seriesKey="total" color="var(--primary)" />
            <HorizonArea seriesKey="total" color="var(--primary)" />
            <Line dataKey="total" label="Balance" stroke="var(--primary)" strokeWidth={2} curve={curveLinear} fadeEdges={false} />
            <XAxis numTicks={tight ? 3 : 5} />
            <YAxis numTicks={3} tickFormatter={compact} />
            <Layer today={days[0].date} lowest={lowest} buffer={buffer} compactLabels={tight} currency={currency} />
            <ChartTooltip showCrosshair={false} rows={point => [{ color: 'var(--primary)', label: 'Balance', value: formatCurrency(Number(point.total), currency) }]} />
          </LineChart>
        </div>
      )}

      <dl className={`grid gap-2.5 ${columns}`}>
        <div className="min-w-0 rounded-[var(--radius-md)] bg-inset p-3">
          <dt className="type-label flex items-center gap-1.5 text-muted"><Icon name="arrow_downward" size={14} className="text-money-in" />Expected in</dt>
          <dd className="type-figure-row mt-0.5 text-ink"><Amount value={expectedIn} currency={currency} /></dd>
        </div>
        <div className="min-w-0 rounded-[var(--radius-md)] bg-inset p-3">
          <dt className="type-label flex items-center gap-1.5 text-muted"><Icon name="arrow_upward" size={14} className="text-money-out" />Going out</dt>
          <dd className="type-figure-row mt-0.5 text-ink"><Amount value={goingOut} currency={currency} /></dd>
        </div>
        <div className={`min-w-0 rounded-[var(--radius-md)] p-3 ${lowTone}`}>
          <dt className="type-label flex items-center gap-1.5 text-muted"><Icon name={lowIcon.name} size={14} className={lowIcon.tone} />Lowest{lowest ? ` · ${shortDay(lowest.date)}` : ''}</dt>
          <dd className="type-figure-row mt-0.5 text-ink"><Amount value={lowestValue} currency={currency} tone="loss" /></dd>
          {(isNegative || underBuffer > 0) && (
            <dd className="type-caption mt-0.5 text-ink">{isNegative ? 'Below zero' : <><Amount value={underBuffer} currency={currency} className="text-ink" /> under your buffer</>}</dd>
          )}
        </div>
      </dl>

      {showLonger && (
        <p className="type-caption flex flex-wrap gap-x-4 gap-y-1 text-muted">
          <span>Lowest later:</span>
          {forecasts.filter(item => item.period !== forecasts[0].period).slice(0, 3).map(item => (
            <span key={item.period}>{item.period} <Amount value={toDisplay(item.lowestBalance)} currency={currency} tone="loss" className="text-ink" /></span>
          ))}
        </p>
      )}
    </div>
  );
};

export default CashHorizonWidget;
