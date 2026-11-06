import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  Grid,
  XAxis,
  YAxis,
  ChartTooltip,
  LineSeriesTerminalMarker,
} from '../src/components/charts';
import { useChartStable, useYScale } from '../src/components/charts/chart-context';
import { SpotlightIndicator } from '../src/components/charts/spotlight-indicator';
import { curveNatural } from '@visx/curve';
import { HorizonArea, clip, compact, labelWidth, shortDay } from './ForecastHorizonChart';
import { iso } from '../utils/scheduleModel';
import { formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { FinancialGoal } from '../types';
import Icon from './ui/Icon';
import { EmptyState } from './ui/States';
import { useWidgetBox } from './ui/WidgetGrid';

interface ChartData {
  name: string;
  value?: number;
  actual?: number;
  forecast?: number;
}

export interface MilestoneAnnotation {
  date: string;
  label: string;
  type?: 'milestone' | 'event';
}

interface NetWorthChartProps {
  data: ChartData[];
  lineColor?: string;
  showForecast?: boolean;
  showGoals?: boolean;
  goals?: FinancialGoal[];
  annotations?: MilestoneAnnotation[];
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  minHeight?: string;
}

const GOAL_ROWS = 3;

/** Today, dated goals and the lowest point, drawn over the line the way the cash horizon draws them. */
const NetWorthLayer: React.FC<{ today?: Date; goals: { date: Date; label: string }[]; lowest: { value: number; date: Date } | null; compactLabels: boolean }> = ({ today, goals, lowest, compactLabels }) => {
  const { xScale, innerWidth, innerHeight } = useChartStable();
  const yScale = useYScale();
  const dayLabel = (date: Date) => shortDay(iso(date));

  const flags = useMemo(() => {
    const ends: number[] = [];
    return goals
      .map(goal => ({ goal, x: xScale(goal.date) }))
      .sort((a, b) => a.x - b.x)
      .map(({ goal, x }) => {
        const full = `${clip(goal.label, 22)}, ${dayLabel(goal.date)}`;
        const right = innerWidth - x - 6;
        const left = x - 6;
        const flip = labelWidth(full) > right && left > right;
        const text = clip(full, Math.max(6, Math.floor(((flip ? left : right) - 22) / 6.6)));
        const w = labelWidth(text);
        const start = Math.max(0, Math.min(flip ? x - 6 - w : x + 6, innerWidth - w));
        let row = ends.findIndex(end => start >= end + 6);
        if (row === -1) row = ends.length < GOAL_ROWS ? ends.length : -1;
        if (row >= 0) ends[row] = start + w;
        return { goal, x, text, w, start, row };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, xScale, innerWidth]);

  const todayX = today ? xScale(today) : undefined;
  const todayFlip = todayX !== undefined && todayX + 6 + 52 > innerWidth;

  return (
    <g>
      {yScale(0) >= 0 && yScale(0) <= innerHeight && <line x1={0} x2={innerWidth} y1={yScale(0)} y2={yScale(0)} stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.5} pointerEvents="none" />}

      {flags.map(({ goal, x, text, w, start, row }) => (
        <g key={`${goal.label}-${goal.date.getTime()}`}>
          <title>{`Goal: ${goal.label}, ${dayLabel(goal.date)}`}</title>
          <line x1={x} x2={x} y1={0} y2={innerHeight} stroke="var(--chart-4)" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />
          <path d={`M${x},0 l5,5 l-5,5 l-5,-5 z`} fill="var(--chart-4)" pointerEvents="none" />
          {row >= 0 && !compactLabels && (
            <g transform={`translate(${start},${8 + (row + 1) * 24})`} pointerEvents="none">
              <rect width={w} height={20} rx={10} fill="var(--solid)" stroke="var(--chart-4)" strokeWidth={1.5} />
              <path d="M10,5 v10 M10,5 h7 l-2,2.5 l2,2.5 h-7" fill="none" stroke="var(--chart-4)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              <text x={22} y={14} fontSize={11} fontWeight={700} fill="var(--ink)">{text}</text>
            </g>
          )}
        </g>
      ))}

      {todayX !== undefined && (
        <g aria-hidden="true" pointerEvents="none">
          <line x1={todayX} x2={todayX} y1={0} y2={innerHeight} stroke="var(--ink)" strokeWidth={1.5} />
          {!compactLabels && (
            <g transform={`translate(${todayFlip ? todayX - 6 - 52 : todayX + 6},8)`}>
              <rect width={52} height={20} rx={10} fill="var(--pill)" />
              <text x={26} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--on-pill)">Today</text>
            </g>
          )}
        </g>
      )}

      {lowest && (() => {
        const lx = xScale(lowest.date);
        const ly = yScale(lowest.value);
        const text = `${formatCurrency(lowest.value, getMainCurrency())} low, ${dayLabel(lowest.date)}`;
        const w = labelWidth(text) - 8;
        const flip = ly < 44;
        const left = Math.max(0, Math.min(lx - w / 2, innerWidth - w));
        return (
          <g pointerEvents="none">
            <circle cx={lx} cy={ly} r={5} fill="var(--money-out)" stroke="var(--solid)" strokeWidth={2} />
            {!compactLabels && (
              <g transform={`translate(${left},${flip ? ly + 12 : ly - 32})`}>
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
(NetWorthLayer as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

const NetWorthChart: React.FC<NetWorthChartProps> = ({
  data,
  lineColor = 'var(--money-in)',
  showForecast = true,
  showGoals = true,
  goals = [],
  margin,
  minHeight = 'min-h-[120px]',
}) => {
  const box = useWidgetBox();
  // Small widgets give the plot back its room: tighter margins, no trend line, no goal and event markers.
  const tight = box.height > 0 && (box.height < 200 || box.width < 340);
  const plotMargin = margin ?? (tight ? { top: 10, right: 10, bottom: 22, left: 46 } : { top: 15, right: 15, bottom: 25, left: 55 });

  const { chartData, lastActualIndex } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], lastActualIndex: -1 };
    }

    let lastActualIdx = -1;
    const rawPoints = data.map((point, idx) => {
      const actualVal = point.actual !== undefined ? point.actual : point.value;
      if (actualVal !== undefined) {
        lastActualIdx = idx;
      }
      const netWorthVal = actualVal !== undefined ? actualVal : point.forecast;
      return {
        ...point,
        date: parseLocalDate(point.name),
        netWorth: netWorthVal,
        isProjected: actualVal === undefined && point.forecast !== undefined,
      };
    });

    const filtered = showForecast
      ? rawPoints
      : rawPoints.filter((_, idx) => lastActualIdx === -1 || idx <= lastActualIdx);

    const finalData = filtered;

    return {
      chartData: finalData,
      lastActualIndex: lastActualIdx >= 0 && lastActualIdx < finalData.length ? lastActualIdx : finalData.length - 1,
    };
  }, [data, showForecast]);

  const { currentActualValue, finalProjectedValue } = useMemo(() => {
    if (chartData.length === 0) return { currentActualValue: 0, finalProjectedValue: 0 };
    const currentActual = chartData[lastActualIndex]?.netWorth ?? 0;
    const finalProjected = chartData[chartData.length - 1]?.netWorth ?? 0;
    return { currentActualValue: currentActual, finalProjectedValue: finalProjected };
  }, [chartData, lastActualIndex]);

  const projectionColor = useMemo(() => {
    const absToday = Math.abs(currentActualValue);
    const margin = absToday * 0.10;
    const minBound = currentActualValue - margin;
    const maxBound = currentActualValue + margin;

    if (finalProjectedValue >= minBound && finalProjectedValue <= maxBound) {
      return 'var(--money-in)'; // within 10% of today's value
    }
    if (finalProjectedValue > maxBound) {
      return 'var(--chart-1)'; // higher than today's value
    }
    return 'var(--money-out)'; // lower than today's value
  }, [currentActualValue, finalProjectedValue]);

  // Dated goals inside the chart's range, as flags. Transactions and events are not drawn here.
  const goalFlags = useMemo(() => {
    if (!showGoals || chartData.length === 0) return [];
    const start = chartData[0].date.getTime();
    const end = chartData[chartData.length - 1].date.getTime();
    return goals
      .filter(goal => goal.date)
      .map(goal => ({ date: parseLocalDate(goal.date!), label: goal.name }))
      .filter(flag => flag.date.getTime() >= start && flag.date.getTime() <= end);
  }, [showGoals, goals, chartData]);

  const lowest = useMemo(() => {
    let best: { value: number; date: Date } | null = null;
    for (const point of chartData) {
      if (typeof point.netWorth === 'number' && (!best || point.netWorth < best.value)) best = { value: point.netWorth, date: point.date };
    }
    return best;
  }, [chartData]);

  if (!chartData || chartData.length === 0) {
    return (
      <EmptyState icon="chart-line-data-01" title="No net worth to show yet" description="It appears once you have an account with a balance." className="h-full min-h-[120px]" />
    );
  }

  const isDashedProjection = showForecast && lastActualIndex >= 0 && lastActualIndex < chartData.length - 1;
  const todayDate = chartData[lastActualIndex]?.date;

  const legend = [
    { label: 'Net worth', color: lineColor, dashed: false },
    ...(isDashedProjection ? [{ label: 'Projected', color: projectionColor, dashed: true }] : []),
    ...(goalFlags.length > 0 ? [{ label: 'Goals', color: 'var(--chart-4)', dashed: true }] : []),
    { label: 'Lowest point', color: 'var(--money-out)', dashed: false, dot: true },
  ];
  const showLegend = !tight && (box.height === 0 || box.height >= 240);

  return (
    <div className="flex h-full w-full flex-col gap-2">
    <div className={`relative min-h-0 w-full flex-1 ${minHeight}`}>
      <LineChart
        data={chartData}
        xDataKey="date"
        revealSignature={chartData.length.toString()}
        yDomainTween
        aspectRatio=""
        className="h-full w-full"
        margin={plotMargin}
      >
        <Grid horizontal numTicksRows={3} />
        <SpotlightIndicator seriesKey="netWorth" color={lineColor} />
        <HorizonArea seriesKey="netWorth" color={lineColor} />
        <XAxis numTicks={tight ? 3 : 5} />
        <YAxis numTicks={3} tickFormatter={compact} />

        {/* One line: solid for what happened, dashed in the projection's colour for what is forecast. */}
        <Line
          dataKey="netWorth"
          stroke={lineColor}
          dashStroke={projectionColor}
          strokeWidth={2}
          dashFromIndex={isDashedProjection ? lastActualIndex : undefined}
          dashArray="6,4"
          curve={curveNatural}
          fadeEdges={false}
        />
        {isDashedProjection && <LineSeriesTerminalMarker dataKey="netWorth" stroke={projectionColor} fill={projectionColor} />}

        <NetWorthLayer today={todayDate} goals={goalFlags} lowest={lowest} compactLabels={tight} />

        <ChartTooltip
          showCrosshair={false}
          rows={(point) => {
            const isProjected = Boolean(point.isProjected);
            return [{
              color: isProjected ? projectionColor : lineColor,
              label: isProjected ? 'Projected net worth' : 'Net worth',
              value: formatCurrency(typeof point.netWorth === 'number' ? point.netWorth : 0, getMainCurrency()),
            }];
          }}
        />
      </LineChart>
    </div>
    {showLegend && (
      <ul className="type-caption flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-muted">
        {legend.map(item => (
          <li key={item.label} className="flex items-center gap-2">
            {'dot' in item
              ? <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              : <span className={item.dashed ? 'w-4 border-t-2 border-dashed' : 'h-0.5 w-4 rounded-full'} style={item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }} aria-hidden />}
            {item.label}
          </li>
        ))}
      </ul>
    )}
    </div>
  );
};

export default NetWorthChart;
