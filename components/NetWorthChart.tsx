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
import { formatCurrency, parseLocalDate, calculateTrendLine } from '../utils';
import { FinancialGoal } from '../types';
import Icon from './ui/Icon';

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
}

const yAxisTickFormatter = (value: number) => {
  if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
  return `€${value}`;
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
  lineColor = '#6366F1',
  showForecast = true,
  showGoals = true,
  goals = [],
  annotations = [],
}) => {
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

  const projectionColor = finalProjectedValue < currentActualValue ? '#F43F5E' : '#10B981';

  const markers = useMemo<ChartMarker[]>(() => {
    const items: ChartMarker[] = [];

    if (chartData.length > 0 && lastActualIndex >= 0 && lastActualIndex < chartData.length) {
      const todayDate = chartData[lastActualIndex].date;
      items.push({
        date: todayDate,
        title: 'Today',
        color: '#6366F1',
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
            description: `Target: ${formatCurrency(goal.amount, 'EUR')}`,
            color: '#F59E0B',
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
          color: '#3B82F6',
        });
      });
    }

    return items;
  }, [showGoals, goals, annotations, chartData]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-40 p-8 text-center min-h-[250px]">
        <Icon name="show_chart" className="text-3xl mb-2" />
        <p className="text-xs font-bold tracking-widest">No Net Worth Data Available</p>
      </div>
    );
  }

  const isDashedProjection = showForecast && lastActualIndex >= 0 && lastActualIndex < chartData.length - 1;

  return (
    <div className="flex-grow relative h-full w-full min-h-[250px]">
      <LineChart
        data={chartData}
        xDataKey="date"
        revealSignature={chartData.length.toString()}
        yDomainTween
        aspectRatio=""
        className="w-full h-full min-h-[250px]"
        margin={{ top: 25, right: 25, bottom: 30, left: 70 }}
      >
        <Grid horizontal stroke="rgba(255, 255, 255, 0.08)" />
        <XAxis />
        <YAxis tickFormatter={yAxisTickFormatter} />

        {/* Combined Historic & Projection Line */}
        <Line
          dataKey="netWorth"
          stroke="#10B981"
          dashStroke={projectionColor}
          strokeWidth={3}
          dashFromIndex={isDashedProjection ? lastActualIndex : undefined}
          dashArray="6,4"
          fadeEdges
        />

        <Line
          dataKey="trend"
          stroke="#8B5CF6"
          strokeWidth={2}
          strokeDasharray="4,4"
        />

        {isDashedProjection && (
          <LineSeriesTerminalMarker dataKey="netWorth" stroke={projectionColor} />
        )}

        {markers.length > 0 && <ChartMarkers items={markers} />}

        <ChartTooltip
          rows={(point) => {
            const isProjected = Boolean(point.isProjected);
            const label = isProjected ? 'Projected Net Worth' : 'Actual Net Worth';
            const val = typeof point.netWorth === 'number' ? point.netWorth : 0;
            const strokeColor = isProjected ? projectionColor : '#10B981';
            const rowsList = [
              {
                color: strokeColor,
                label,
                value: formatCurrency(val, 'EUR'),
              },
            ];
            if (typeof point.trend === 'number') {
              rowsList.push({
                color: '#8B5CF6',
                label: 'Trend Line',
                value: formatCurrency(point.trend, 'EUR'),
              });
            }
            return rowsList;
          }}
        >
          <CustomTooltipContent markers={markers} />
        </ChartTooltip>
      </LineChart>
    </div>
  );
};

export default NetWorthChart;
