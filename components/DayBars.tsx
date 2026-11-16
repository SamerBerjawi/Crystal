import React, { useMemo, useState } from 'react';
import { formatCurrency, parseLocalDate, toLocalISOString, getMainCurrency } from '../utils';
import { heatLevelOf, type HeatColumn } from '../utils/activityModel';
import { addDays, type DayCommitted } from '../utils/scheduleModel';
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, TrendLine, YAxis } from '../src/components/charts';
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
import SegmentedControl from './ui/SegmentedControl';

const VIEWS = [{ id: 'bars', label: 'Next 30 days' }, { id: 'heatmap', label: 'Year heatmap' }];

const PickLayer: React.FC<{ onPick: (day: string) => void; children: React.ReactNode }> = ({ onPick, children }) => {
  const { tooltipData } = useHeatmapInteraction();
  return (
    <div
      className={tooltipData ? 'cursor-pointer' : undefined}
      onClick={() => { if (tooltipData) onPick(toLocalISOString(tooltipData.date)); }}
    >
      {children}
    </div>
  );
};

interface DayBarsProps {
  days: DayCommitted[];
  yearDays: DayCommitted[];
  onSelect: (date: string) => void;
}

/** When money moves: a bar for each of the next 30 days, with the year as a Bklit heatmap behind a toggle (D-033). */
const DayBars: React.FC<DayBarsProps> = ({ days, yearDays, onSelect }) => {
  const [view, setView] = useState('bars');

  const { heatmapData, byDate } = useMemo(() => {
    const byDate = new Map<string, DayCommitted>();
    yearDays.forEach(d => byDate.set(d.date, d));
    if (yearDays.length === 0) return { heatmapData: [] as HeatColumn[], byDate };

    const start = parseLocalDate(yearDays[0].date);
    const end = parseLocalDate(yearDays[yearDays.length - 1].date);
    const first = addDays(start, -start.getDay());
    const weeks = Math.round((addDays(end, -end.getDay()).getTime() - first.getTime()) / (7 * 86_400_000)) + 1;
    const levelOf = heatLevelOf(yearDays.map(d => d.in + d.out + d.moves));

    const heatmapData: HeatColumn[] = Array.from({ length: weeks }, (_, week) => ({
      bin: week,
      bins: Array.from({ length: 7 }, (__, row) => {
        const date = addDays(first, week * 7 + row);
        const iso = toLocalISOString(date);
        const inside = date >= start && date <= end;
        const item = inside ? byDate.get(iso) : undefined;
        const total = item ? item.in + item.out + item.moves : 0;
        return { bin: row, date, count: inside ? levelOf(total) : 0 };
      }),
    }));
    return { heatmapData, byDate };
  }, [yearDays]);

  const describe = (_level: number, date: Date) => {
    const day = byDate.get(toLocalISOString(date));
    if (!day) return 'Nothing';
    const currency = getMainCurrency();
    const parts = [
      day.in > 0 && `in ${formatCurrency(day.in, currency)}`,
      day.out > 0 && `out ${formatCurrency(day.out, currency)}`,
      day.moves > 0 && `moves ${formatCurrency(day.moves, currency)}`,
    ].filter(Boolean);
    return parts.join(', ') || 'Nothing';
  };

  return (
    <section aria-label="When money moves" className="surface-card rounded-[var(--radius-xl)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-card-title text-ink">When money moves</h2>
        <SegmentedControl items={VIEWS} activeId={view} onChange={setView} />
      </div>
      {view === 'bars' ? (
        <div className="h-52">
          <BarChart
            data={days.map(day => ({
              day: parseLocalDate(day.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
              rawDate: day.date,
              'Money in': day.in,
              'Money out': day.out + day.moves,
            }))}
            xDataKey="day"
            aspectRatio="auto"
            margin={{ top: 8, right: 8, bottom: 40, left: 56 }}
          >
            <Grid horizontal />
            <Bar dataKey="Money in" lineCap="round" onClick={d => onSelect(String(d.rawDate))} />
            <Bar dataKey="Money out" fill="var(--chart-3)" lineCap="round" onClick={d => onSelect(String(d.rawDate))} />
            <YAxis yAxisId="left" />
            <TrendLine dataKey="Money in" stroke="var(--chart-1)" />
            <BarXAxis />
            <ChartTooltip valueFormatter={(value: number) => formatCurrency(value, getMainCurrency())} />
          </BarChart>
        </div>
      ) : (
        <div className="pt-4">
          <HeatmapInteractionProvider>
            <HeatmapInteractionBoundary>
              <div className="flex w-full flex-col items-stretch gap-3">
                <PickLayer onPick={onSelect}>
                  <HeatmapChart data={heatmapData} gap={3} layout="fluid">
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
      )}
    </section>
  );
};

export default DayBars;
