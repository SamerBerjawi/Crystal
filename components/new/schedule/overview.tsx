import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { parseLocalDate } from '../../../utils';
import type { Summary, DayCommitted } from '../../../utils/scheduleModel';
import type { ScheduleData } from '../../../hooks/useScheduleData';
import { ComposedChart } from '../../bklit/charts/composed-chart';
import { SeriesBar } from '../../bklit/charts/series-bar';
import { ChartTooltip, Line, XAxis, curveMonotoneX } from '../../bklit/charts';
import { NvIcon, type NvIconName } from '../NvIcon';
import { ACCENT, Card, Money, type Accent } from '../ui';
import { relativeDay } from './parts';

/* The Schedule hero (docs/SCHEDULE_NEW_PLAN.md §4.1): the next 30 days' net, its meta line, the committed-cash chart (C1). */

const Figure: React.FC<{ icon: NvIconName; accent: Accent | 'red'; label: string; children: React.ReactNode; caption?: React.ReactNode; onClick?: () => void }> = ({
  icon, accent, label, children, caption, onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn('flex min-w-0 items-center gap-3 rounded-nv-sub text-left', onClick && 'min-h-11 hover:bg-nv-surface/60 focus-visible:outline-2')}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', accent === 'red' ? 'bg-nv-red-soft text-nv-red-text' : ACCENT[accent].icon)}>
        <NvIcon name={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-nv-muted">{label}</span>
        <span className="block truncate">{children}</span>
        {caption && <span className="block truncate text-xs text-nv-muted">{caption}</span>}
      </span>
    </Tag>
  );
};

/** C1: money out (orange) and in (green) per day, and the net so far (ink). Tap a day to jump to it. */
const CommittedChart: React.FC<{ days: DayCommitted[]; currency: string; onPickDay: (date: string) => void }> = ({ days, currency, onPickDay }) => {
  // The line is the net so far (money in minus money out since today); the bars grow from the zero line.
  const data = useMemo(() => days.map(d => ({ date: parseLocalDate(d.date), Out: d.out, In: d.in, netSoFar: d.cumulative })), [days]);
  const nothing = days.every(d => d.in === 0 && d.out === 0);
  if (nothing) {
    return <p className="flex h-full min-h-32 items-center justify-center text-sm text-nv-muted">Nothing due in the next 30 days</p>;
  }
  return (
    <div
      className="cursor-pointer"
      onClick={e => {
        // The chart has no click callback: map the pointer to a day by position.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const i = Math.min(days.length - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * days.length)));
        onPickDay(days[i].date);
      }}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 28, left: 8 }} aspectRatio="2.4 / 1" barGap={0.25}>
        <SeriesBar dataKey="Out" fill="var(--nv-orange)" radius={3} />
        <SeriesBar dataKey="In" fill="var(--nv-green)" radius={3} />
        <Line dataKey="netSoFar" stroke="var(--nv-ink)" strokeWidth={2} curve={curveMonotoneX} />
        <XAxis numTicks={4} />
        <ChartTooltip currency={currency} showDatePill />
      </ComposedChart>
    </div>
  );
};

export const ScheduleHero: React.FC<{
  data: ScheduleData;
  summary: Summary;
  days: DayCommitted[];
  onShowOverdue: () => void;
  onPickDay: (date: string) => void;
}> = ({ data, summary, days, onShowOverdue, onPickDay }) => {
  const cur = data.displayCurrency;
  const next = summary.next;
  const largest = summary.largestOut;
  return (
    <Card
      top={
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-nv-muted">Due in the next 30 days</p>
            <div className="mt-2"><Money amount={summary.net} currency={cur} signed size="hero" /></div>
            <p className="mt-3 text-sm text-nv-muted">
              <Money amount={summary.out} currency={cur} className="text-sm" /> out · <Money amount={summary.in} currency={cur} className="text-sm" /> in · {summary.count} {summary.count === 1 ? 'payment' : 'payments'}
              {next && <> · next: <span className="text-nv-ink">{next.merchant || next.description}</span>, {relativeDay(next.date, data.today)}</>}
            </p>
          </div>
          <CommittedChart days={days} currency={cur} onPickDay={onPickDay} />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
        <Figure icon="arrowUpRight" accent="orange" label="Out" caption={largest ? <>Largest: {largest.merchant || largest.description}</> : undefined}>
          <Money amount={summary.out} currency={cur} size="lg" />
        </Figure>
        <Figure icon="money" accent="green" label="In"><Money amount={summary.in} currency={cur} size="lg" /></Figure>
        {summary.moves > 0 && (
          <Figure icon="transfer" accent="sky" label="Between your accounts"><Money amount={summary.moves} currency={cur} size="lg" /></Figure>
        )}
        {summary.overdueCount > 0 && (
          <Figure icon="warning" accent="red" label="Overdue" onClick={onShowOverdue} caption={<Money amount={summary.overdueNet} currency={cur} signed className="text-xs" />}>
            <span className="nv-tabular text-xl font-semibold text-nv-red-text">{summary.overdueCount}</span>
          </Figure>
        )}
      </div>
    </Card>
  );
};
