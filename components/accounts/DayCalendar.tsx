import React, { useMemo } from 'react';
import type { Account, Transaction } from '../../types';
import { formatCurrency } from '../../utils';
import { heatColumns, heatStart, heatStats, spendByDay, type ActivityRange, type ActivityRow } from '../../utils/activityModel';
import { isoDay, parseDay } from '../../utils/accountPagesModel';
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
} from '../../src/components/bklit';
import { Amount } from '../ui/Money';

/** Turns a click on the chart into the day under the pointer, which the heatmap itself only tracks for hover. */
const PickLayer: React.FC<{ onPick: (day: string) => void; children: React.ReactNode }> = ({ onPick, children }) => {
  const { tooltipData } = useHeatmapInteraction();
  return (
    <div className={tooltipData ? 'cursor-pointer' : undefined} onClick={() => { if (tooltipData) onPick(isoDay(tooltipData.date)); }}>
      {children}
    </div>
  );
};

/**
 * A square for every day, in weeks, grouped by calendar quarter and coloured by how much went out. It shows the stretch
 * the time filter is on. Pick a day to see only its transactions.
 */
const DayCalendar: React.FC<{ rows: ActivityRow<Transaction>[]; account: Account; range: ActivityRange; onPick: (day: string) => void; /** Hug the squares instead of stretching across the card, so something can sit beside it. */ compact?: boolean }> = ({ rows, account, range, onPick, compact }) => {
  const todayKey = isoDay(new Date());
  const earliest = useMemo(() => rows.reduce<string | undefined>((first, row) => (!first || row.date < first ? row.date : first), undefined), [rows]);
  const spend = useMemo(() => spendByDay(rows), [rows]);

  const { columns: data, stats } = useMemo(() => {
    const end = parseDay(todayKey);
    const start = heatStart(range, earliest, end);
    return { ...heatColumns(spend, start, end), stats: heatStats(spend, start, end) };
  }, [spend, range, earliest, todayKey]);

  const describe = (_level: number, date: Date) => {
    const day = spend.get(isoDay(date));
    if (!day || day.count === 0) return 'Nothing';
    return `${day.out > 0 ? `${formatCurrency(day.out, account.currency)} out` : 'Nothing spent'} · ${day.count} ${day.count === 1 ? 'transaction' : 'transactions'}`;
  };

  return (
    <div className={compact ? 'flex w-fit max-w-full flex-col gap-3' : 'flex flex-col gap-3'}>
      <dl className="grid grid-cols-3 gap-3">
        <div className="min-w-0"><dt className="type-caption text-muted">Quiet days</dt><dd className="type-figure-row text-ink">{stats.quiet}<span className="type-caption ml-1 text-muted">of {stats.days}</span></dd></div>
        <div className="min-w-0"><dt className="type-caption text-muted">Longest streak</dt><dd className="type-figure-row text-ink">{stats.longestStreak}<span className="type-caption ml-1 text-muted">{stats.longestStreak === 1 ? 'day' : 'days'}</span></dd></div>
        <div className="min-w-0"><dt className="type-caption text-muted">Average a day</dt><dd className="type-figure-row truncate text-ink"><Amount value={stats.average} currency={account.currency} /></dd></div>
      </dl>

      <div className="pt-6">
        <HeatmapInteractionProvider>
          <HeatmapInteractionBoundary>
            <div className="flex w-full flex-col items-stretch gap-3">
              <PickLayer onPick={onPick}>
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
              <HeatmapLegend
                align="center"
                cornerRadius={999}
                gap={3}
                inactiveOpacity={0.8}
                inactiveScale={0.94}
              />
            </div>
          </HeatmapInteractionBoundary>
        </HeatmapInteractionProvider>
      </div>

      <p className="type-caption min-w-0 truncate text-muted">
        {stats.busiest ? <>Busiest day {parseDay(stats.busiest.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, <Amount value={stats.busiest.value} currency={account.currency} className="text-ink" /></> : 'Nothing spent in this stretch'}
      </p>
    </div>
  );
};

export default DayCalendar;
