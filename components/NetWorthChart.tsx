import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  Grid,
  XAxis,
  YAxis,
  ChartTooltip,
  ChartMarkers,
  useActiveMarkers,
  MarkerTooltipContent,
  LineSeriesTerminalMarker,
  type ChartMarker,
} from '../src/components/charts';
import { formatCurrency, parseLocalDate, calculateTrendLine, getMainCurrency, currencySign } from '../utils';
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

const yAxisTickFormatter = (value: number) => {
  const sign = currencySign(getMainCurrency());
  if (Math.abs(value) >= 1000000) return `${sign}${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${sign}${(value / 1000).toFixed(0)}K`;
  return `${sign}${value}`;
};

const CustomTooltipContent: React.FC<{ markers: ChartMarker[] }> = ({ markers }) => {
  const activeMarkers = useActiveMarkers(markers);

  return (
    <div className="space-y-2">
      {activeMarkers.length > 0 && <MarkerTooltipContent markers={activeMarkers} />}
    </div>
  );
};

const NetWorthChart: React.FC<NetWorthChartProps> = ({
  data,
  lineColor = 'var(--money-in)',
  showForecast = true,
  showGoals = true,
  goals = [],
  annotations = [],
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

    const trendValues = calculateTrendLine(filtered, (item) => item.netWorth ?? 0);
    const finalData = filtered.map((p, idx) => ({
      ...p,
      trend: trendValues[idx],
    }));

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

  const markers = useMemo<ChartMarker[]>(() => {
    const items: ChartMarker[] = [];

    if (chartData.length > 0 && lastActualIndex >= 0 && lastActualIndex < chartData.length) {
      const todayDate = chartData[lastActualIndex].date;
      items.push({
        date: todayDate,
        title: 'Today',
        color: 'var(--chart-1)',
      });
    }

    if (showGoals && goals.length > 0 && chartData.length > 0) {
      const start = chartData[0].date.getTime();
      const end = chartData[chartData.length - 1].date.getTime();

      goals.forEach((goal) => {
        if (!goal.date) return;
        const gDate = parseLocalDate(goal.date);
        const gTime = gDate.getTime();
        if (gTime >= start && gTime <= end) {
          items.push({
            date: gDate,
            title: goal.name,
            description: `Target: ${formatCurrency(goal.amount, getMainCurrency())}`,
            color: 'var(--chart-4)',
          });
        }
      });
    }

    if (annotations && annotations.length > 0) {
      annotations.forEach((ann) => {
        if (!ann.date) return;
        items.push({
          date: parseLocalDate(ann.date),
          title: ann.label,
          color: 'var(--chart-2)',
        });
      });
    }

    return items;
  }, [showGoals, goals, annotations, chartData]);

  if (!chartData || chartData.length === 0) {
    return (
      <EmptyState icon="chart-line-data-01" title="No net worth to show yet" description="It appears once you have an account with a balance." className="h-full min-h-[120px]" />
    );
  }

  const isDashedProjection = showForecast && lastActualIndex >= 0 && lastActualIndex < chartData.length - 1;

  const legend = [
    { label: 'Net worth', color: lineColor, dashed: false },
    ...(isDashedProjection ? [{ label: 'Projected', color: projectionColor, dashed: true }] : []),
    { label: 'Trend', color: 'var(--chart-3)', dashed: true },
    ...(showGoals && goals.length > 0 ? [{ label: 'Goals', color: 'var(--chart-4)', dashed: false }] : []),
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
        <Grid
          horizontal
          highlightRowValues={[0]}
          highlightRowStrokeDasharray="6,4"
          highlightRowStrokeWidth={1.5}
          highlightRowStrokeOpacity={0.85}
        />
        <XAxis />
        <YAxis tickFormatter={yAxisTickFormatter} />

        {/* Combined Historic & Projection Line */}
        <Line
          dataKey="netWorth"
          stroke={lineColor}
          dashStroke={projectionColor}
          strokeWidth={3}
          dashFromIndex={isDashedProjection ? lastActualIndex : undefined}
          dashArray="6,4"
          fadeEdges
        />

        {!tight && (
          <Line
            dataKey="trend"
            stroke="var(--chart-3)"
            strokeWidth={2}
            strokeDasharray="4,4"
          />
        )}

        {isDashedProjection && (
          <LineSeriesTerminalMarker dataKey="netWorth" stroke={projectionColor} fill={projectionColor} />
        )}

        {!tight && markers.length > 0 && <ChartMarkers items={markers} />}

        <ChartTooltip
          rows={(point) => {
            const isProjected = Boolean(point.isProjected);
            const label = isProjected ? 'Projected Net Worth' : 'Actual Net Worth';
            const val = typeof point.netWorth === 'number' ? point.netWorth : 0;
            const strokeColor = isProjected ? projectionColor : lineColor;
            const rowsList = [
              {
                color: strokeColor,
                label,
                value: formatCurrency(val, getMainCurrency()),
              },
            ];
            if (typeof point.trend === 'number') {
              rowsList.push({
                color: 'var(--chart-3)',
                label: 'Trend Line',
                value: formatCurrency(point.trend, getMainCurrency()),
              });
            }
            return rowsList;
          }}
        >
          <CustomTooltipContent markers={markers} />
        </ChartTooltip>
      </LineChart>
    </div>
    {showLegend && (
      <ul className="type-caption flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-muted">
        {legend.map(item => (
          <li key={item.label} className="flex items-center gap-2">
            <span className={item.dashed ? 'w-4 border-t-2 border-dashed' : 'h-0.5 w-4 rounded-full'} style={item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
    )}
    </div>
  );
};

export default NetWorthChart;
