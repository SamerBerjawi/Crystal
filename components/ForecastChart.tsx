import React, { useMemo } from 'react';
import { formatCurrency, parseLocalDate, calculateTrendLine } from '../utils';
import { FinancialGoal, Account } from '../types';
import Icon from './ui/Icon';
import {
  LineChart,
  Line,
  Grid,
  XAxis,
  YAxis,
  ChartTooltip,
  ChartMarkers,
  type ChartMarker,
} from '../src/components/charts';

const getColorForAccount = (account: Account, index: number) => {
  const palette = [
    '#6366F1', '#FBBF24', '#10B981', '#EF4444', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
  ];
  return palette[index % palette.length];
};

interface ChartData {
  date: string;
  value: number;
  isHistory?: boolean;
  [key: string]: number | string | boolean | { description: string; amount: number; type: string }[] | undefined;
}

interface ForecastChartProps {
  data: ChartData[];
  oneTimeGoals: FinancialGoal[];
  lowestPoint: {
    value: number;
    date: string;
  };
  showIndividualLines?: boolean;
  accounts?: Account[];
  showGoalLines?: boolean;
  onDataPointClick?: (date: string) => void;
}

const yAxisTickFormatter = (value: number) => {
  if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
  return `€${value}`;
};

const ForecastChart: React.FC<ForecastChartProps> = ({
  data,
  oneTimeGoals,
  lowestPoint,
  showIndividualLines = false,
  accounts = [],
  showGoalLines = true,
  onDataPointClick,
}) => {
  const chartDataWithTrend = useMemo(() => {
    if (!data || data.length === 0) return [];
    const trendValues = calculateTrendLine(data, 'value');
    return data.map((d, idx) => ({
      ...d,
      date: parseLocalDate(d.date),
      trend: trendValues[idx],
    }));
  }, [data]);

  const markers = useMemo<ChartMarker[]>(() => {
    const items: ChartMarker[] = [];

    if (chartDataWithTrend.length > 0) {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      // 1. Try to find the exact point matching today's date
      let todayPoint = chartDataWithTrend.find((d) => {
        if (!d.date) return false;
        const dt = d.date instanceof Date ? d.date : parseLocalDate(d.date as unknown as string);
        return (
          dt.getFullYear() === todayDate.getFullYear() &&
          dt.getMonth() === todayDate.getMonth() &&
          dt.getDate() === todayDate.getDate()
        );
      });

      // 2. If no exact date match, pick the LAST historical point before the forecast starts
      if (!todayPoint) {
        const historyPoints = chartDataWithTrend.filter((d) => d.isHistory);
        if (historyPoints.length > 0) {
          todayPoint = historyPoints[historyPoints.length - 1];
        } else {
          todayPoint = chartDataWithTrend[0];
        }
      }

      if (todayPoint && todayPoint.date) {
        items.push({
          date: todayPoint.date instanceof Date ? todayPoint.date : parseLocalDate(todayPoint.date as unknown as string),
          title: 'Today',
          color: '#6366F1',
        });
      }
    }

    if (showGoalLines && oneTimeGoals.length > 0) {
      oneTimeGoals.forEach((goal) => {
        if (!goal.date) return;
        items.push({
          date: parseLocalDate(goal.date),
          title: goal.name,
          description: `Target: ${formatCurrency(goal.amount, 'EUR')}`,
          color: '#F59E0B',
        });
      });
    }

    if (lowestPoint && lowestPoint.date) {
      items.push({
        date: parseLocalDate(lowestPoint.date),
        title: `Low Balance: ${formatCurrency(lowestPoint.value, 'EUR')}`,
        color: '#EF4444',
      });
    }

    return items;
  }, [showGoalLines, oneTimeGoals, lowestPoint]);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-black/20">
        <Icon name="query_stats" className="text-4xl mb-2" />
        <p className="text-sm font-medium">No forecast data available.</p>
        <p className="text-xs mt-1">Try selecting different accounts or adding recurring transactions.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px]">
      <LineChart
        data={chartDataWithTrend}
        xDataKey="date"
        yDomainTween
        aspectRatio=""
        className="w-full h-[400px]"
        margin={{ top: 20, right: 30, bottom: 30, left: 50 }}
      >
        <Grid horizontal />
        <XAxis />
        <YAxis tickFormatter={yAxisTickFormatter} />

        {showIndividualLines ? (
          accounts.map((acc, idx) => (
            <Line
              key={acc.id}
              dataKey={acc.id}
              stroke={getColorForAccount(acc, idx)}
              strokeWidth={2}
            />
          ))
        ) : (
          <>
            <Line dataKey="value" stroke="#6366F1" strokeWidth={3} fadeEdges />
            <Line dataKey="trend" stroke="#10B981" strokeWidth={2} strokeDasharray="4,4" />
          </>
        )}

        {markers.length > 0 && <ChartMarkers items={markers} />}
        <ChartTooltip valueFormatter={(val) => formatCurrency(val, 'EUR')} />
      </LineChart>
    </div>
  );
};

export default ForecastChart;
