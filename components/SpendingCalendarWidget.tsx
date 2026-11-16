import React, { useMemo } from 'react';
import type { Currency, Transaction } from '../types';
import { convertToMain, formatCurrency, parseLocalDate, toLocalISOString } from '../utils';
import { heatColumns, heatStats, type DaySpend } from '../utils/activityModel';
import { addDays } from '../utils/scheduleModel';
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapSeparator,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  useHeatmapInteraction,
} from '../src/components/bklit';
import { Amount } from './ui/Money';
import { useWidgetBox } from './ui/WidgetGrid';

interface SpendingCalendarWidgetProps {
  /** Transactions to count, already limited to the accounts in view. */
  transactions: Transaction[];
  currency: Currency;
  toDisplay: (eur: number) => number;
  onDayClick?: (date: string) => void;
}

const PickLayer: React.FC<{ onPick?: (day: string) => void; children: React.ReactNode }> = ({ onPick, children }) => {
  const { tooltipData } = useHeatmapInteraction();
  return (
    <div
      className={onPick && tooltipData ? 'cursor-pointer' : undefined}
      onClick={() => { if (onPick && tooltipData) onPick(toLocalISOString(tooltipData.date)); }}
    >
      {children}
    </div>
  );
};

/**
 * A dot for every day over the last 52 weeks, grouped by quarter and coloured by how much went out.
 * Days with nothing spent sit quietly at level 0 so streaks remain visible.
 */
const SpendingCalendarWidget: React.FC<SpendingCalendarWidgetProps> = ({ transactions, currency, toDisplay, onDayClick }) => {
  const box = useWidgetBox();
  const showSummary = box.height === 0 || box.height >= 230;
  const showLegend = box.height === 0 || box.height >= 190;

  const { data, spend, stats } = useMemo(() => {
    const spend = new Map<string, DaySpend>();
    for (const tx of transactions) {
      if (tx.type !== 'expense' || tx.transferId || tx.isSplitParent || tx.isCombinedParent || tx.isBalanceAdjustment) continue;
      const prev = spend.get(tx.date) ?? { out: 0, count: 0 };
      prev.count += 1;
      prev.out += Math.abs(toDisplay(convertToMain(tx.amount, tx.currency)));
      spend.set(tx.date, prev);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = addDays(today, -364);
    const { columns } = heatColumns(spend, start, today);
    const stats = heatStats(spend, start, today);
    return { data: columns, spend, stats };
  }, [transactions, toDisplay]);

  const describe = (_level: number, date: Date) => {
    const day = spend.get(toLocalISOString(date));
    if (!day || day.out <= 0) return 'Nothing spent';
    return `${formatCurrency(day.out, currency)} spent · ${day.count} ${day.count === 1 ? 'transaction' : 'transactions'}`;
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {showSummary && (
        <dl className="grid grid-cols-3 gap-3">
          <div className="min-w-0">
            <dt className="type-caption text-muted">No-spend days</dt>
            <dd className="type-figure-row text-ink">{stats.quiet}<span className="type-caption ml-1 text-muted">of {stats.days}</span></dd>
          </div>
          <div className="min-w-0">
            <dt className="type-caption text-muted">Longest streak</dt>
            <dd className="type-figure-row text-ink">{stats.longestStreak}<span className="type-caption ml-1 text-muted">{stats.longestStreak === 1 ? 'day' : 'days'}</span></dd>
          </div>
          <div className="min-w-0">
            <dt className="type-caption text-muted">Average a day</dt>
            <dd className="type-figure-row truncate text-ink"><Amount value={stats.average} currency={currency} /></dd>
          </div>
        </dl>
      )}

      <div className="min-h-0 flex-1 pt-4">
        <HeatmapInteractionProvider>
          <HeatmapInteractionBoundary>
            <div className="flex w-full flex-col items-stretch gap-3">
              <PickLayer onPick={onDayClick}>
                <HeatmapChart data={data} gap={3} layout="fluid">
                  <HeatmapCells
                    cornerRadius={999}
                    inactiveOpacity={0.8}
                    inactiveScale={0.94}
                  />
                  <HeatmapSeparator
                    groupBy="quarter"
                    showLabels
                    labelClassName="text-[var(--chart-3)]"
                    spacing={12}
                    startOffset={14}
                    strokeOpacity={0.6}
                  />
                  <HeatmapXAxis />
                  <HeatmapYAxis tickFilter="all" labelFormat="initial" />
                  <HeatmapTooltip formatLabel={describe} />
                </HeatmapChart>
              </PickLayer>
              {showLegend && (
                <HeatmapLegend
                  align="center"
                  cornerRadius={999}
                  gap={3}
                  inactiveOpacity={0.8}
                  inactiveScale={0.94}
                />
              )}
            </div>
          </HeatmapInteractionBoundary>
        </HeatmapInteractionProvider>
      </div>

      {showLegend && (
        <p className="type-caption min-w-0 truncate text-muted">
          {stats.busiest ? <>Busiest day {parseLocalDate(stats.busiest.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, <Amount value={stats.busiest.value} currency={currency} className="text-ink" /></> : 'Nothing spent in this stretch'}
        </p>
      )}
    </div>
  );
};

export default SpendingCalendarWidget;
