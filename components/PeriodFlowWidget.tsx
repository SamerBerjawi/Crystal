import React from 'react';
import type { Currency } from '../types';
import { formatCurrency } from '../utils';
import { BarChart, Bar, Grid, BarXAxis, ChartTooltip } from '../src/components/charts';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';
import { useWidgetBox } from './ui/WidgetGrid';

export interface FlowBucket {
  name: string;
  'Money in': number;
  'Money out': number;
}

interface PeriodFlowWidgetProps {
  /** Money in and out for the period, in the display currency. */
  income: number;
  expenses: number;
  /** Change against the period before, like "+4.2%", or null. */
  incomeChange: string | null;
  expenseChange: string | null;
  buckets: FlowBucket[];
  currency: Currency;
}

const Change: React.FC<{ value: string | null; goodWhenUp: boolean }> = ({ value, goodWhenUp }) => {
  if (!value) return null;
  const up = value.startsWith('+');
  const good = up === goodWhenUp;
  return <Badge tone={good ? 'positive' : 'negative'} icon={up ? 'trending_up' : 'trending_down'}>{value}</Badge>;
};

/**
 * The period at a glance: what you kept, what came in and went out against the period before, and how each stretch of the
 * period compared. The bars pair money in (green) with money out (red); the figures above them say the same in words.
 */
const PeriodFlowWidget: React.FC<PeriodFlowWidgetProps> = ({ income, expenses, incomeChange, expenseChange, buckets, currency }) => {
  const box = useWidgetBox();
  const net = income - expenses;
  const isPositive = net >= 0;
  const savedRate = income > 0 ? (net / income) * 100 : 0;
  const spentShare = income > 0 ? (expenses / income) * 100 : expenses > 0 ? 100 : 0;
  const hasData = buckets.some(bucket => bucket['Money in'] > 0 || bucket['Money out'] > 0);

  // The headline and the two totals take about 150px. The bars need 110px more, the legend and spend bar 60px beyond that.
  const showChart = hasData && (box.height === 0 || box.height >= 300);
  const showSpendBar = box.height === 0 || box.height >= 190;
  const stackTotals = box.width > 0 && box.width < 360;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="type-label text-muted">{isPositive ? 'You kept' : 'You overspent by'}</p>
          <p className="type-figure-lg text-ink"><Amount value={Math.abs(net)} currency={currency} tone={isPositive ? 'plain' : 'loss'} /></p>
        </div>
        <Badge tone={isPositive ? 'positive' : 'negative'} icon={isPositive ? 'savings' : 'warning'} className="shrink-0">
          {Math.abs(savedRate).toFixed(0)}% {isPositive ? 'of income saved' : 'over income'}
        </Badge>
      </div>

      <dl className={`grid gap-2.5 ${stackTotals ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {[
          { label: 'Money in', value: income, change: incomeChange, goodWhenUp: true, color: 'var(--money-in)' },
          { label: 'Money out', value: expenses, change: expenseChange, goodWhenUp: false, color: 'var(--money-out)' },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-[var(--radius-md)] bg-inset p-3">
            <dt className="type-label flex items-center gap-2 text-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              {item.label}
            </dt>
            <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="type-figure-row text-ink"><Amount value={item.value} currency={currency} /></span>
              <Change value={item.change} goodWhenUp={item.goodWhenUp} />
            </dd>
          </div>
        ))}
      </dl>

      {showChart && (
        <div className="min-h-[80px] flex-1 overflow-hidden">
          <BarChart data={buckets as unknown as Record<string, unknown>[]} xDataKey="name" aspectRatio="auto" barGap={0.3} margin={{ top: 8, right: 8, left: 8, bottom: 22 }} className="h-full w-full">
            <Grid horizontal vertical={false} strokeOpacity={0.08} />
            <Bar dataKey="Money in" fill="var(--money-in)" stroke="var(--money-in)" lineCap="round" />
            <Bar dataKey="Money out" fill="var(--money-out)" stroke="var(--money-out)" lineCap="round" />
            <BarXAxis />
            <ChartTooltip valueFormatter={(value: number) => formatCurrency(value, currency)} />
          </BarChart>
        </div>
      )}

      {showSpendBar && (
        <div className="mt-auto">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="type-caption text-muted">Spent of what came in</span>
            <span className={`type-figure-row ${spentShare > 100 ? 'text-money-out' : 'text-ink'}`}>{spentShare.toFixed(0)}%</span>
          </div>
          <div role="progressbar" aria-label="Spent of what came in" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.round(spentShare), 100)} className="h-2 overflow-hidden rounded-full bg-inset">
            <div className={`h-full rounded-full ${spentShare > 100 ? 'bg-money-out' : spentShare > 85 ? 'bg-amber' : 'bg-primary'}`} style={{ width: `${Math.max(Math.min(spentShare, 100), spentShare > 0 ? 3 : 0)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodFlowWidget;
