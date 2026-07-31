import React, { useMemo } from 'react';
import { PriceHistoryEntry } from '../types';
import { formatCurrency, parseLocalDate, calculateTrendLine } from '../utils';
import { LineChart, Line, Grid, XAxis, YAxis, ChartTooltip } from '../src/components/charts';

interface PriceHistoryChartProps {
  history: PriceHistoryEntry[];
}

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ history }) => {
  const sortedHistory = useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const trendVals = calculateTrendLine(sorted, 'price');
    return sorted.map((item, idx) => ({
      ...item,
      date: parseLocalDate(item.date),
      trend: trendVals[idx],
    }));
  }, [history]);

  if (sortedHistory.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-light-text-secondary dark:text-dark-text-secondary">
        <p>Not enough history to display chart.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow w-full h-[240px]">
      <LineChart
        data={sortedHistory}
        xDataKey="date"
        yDomainTween
        aspectRatio=""
        className="w-full h-[240px]"
        margin={{ top: 20, right: 20, bottom: 20, left: 50 }}
      >
        <Grid horizontal stroke="rgba(255, 255, 255, 0.08)" />
        <XAxis />
        <YAxis tickFormatter={(value) => formatCurrency(value, 'EUR').replace(/[^0-9.,]/g, '')} />
        <Line dataKey="price" stroke="#8B5CF6" strokeWidth={2.5} fadeEdges />
        <Line dataKey="trend" stroke="#6366F1" strokeWidth={2} strokeDasharray="4,4" />
        <ChartTooltip valueFormatter={(val) => formatCurrency(val, 'EUR')} />
      </LineChart>
    </div>
  );
};

export default PriceHistoryChart;
