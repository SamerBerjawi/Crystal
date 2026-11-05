import React, { useMemo } from 'react';
import { MileageLog } from '../types';
import { parseLocalDate } from '../utils';
import { LineChart, Line, Grid, XAxis, ChartTooltip } from '../src/components/charts';
import { EmptyState } from './ui/States';

interface VehicleMileageChartProps {
  logs: MileageLog[];
}

const VehicleMileageChart: React.FC<VehicleMileageChartProps> = ({ logs }) => {
  const sortedLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((log) => ({
        ...log,
        date: parseLocalDate(log.date),
      }));
  }, [logs]);

  if (sortedLogs.length < 2) {
    return (
      <EmptyState icon="chart-line-data-01" title="Not enough readings yet" description="Log at least two odometer readings to see the trend." />
    );
  }

  return (
    <div className="flex-grow w-full h-full min-h-[200px]">
      <LineChart
        data={sortedLogs}
        xDataKey="date"
        yDomainTween
        aspectRatio=""
        className="w-full h-full min-h-[200px]"
        margin={{ top: 20, right: 10, bottom: 20, left: 10 }}
      >
        <Grid horizontal stroke="rgba(255, 255, 255, 0.06)" />
        <XAxis />
        <Line dataKey="reading" stroke="var(--chart-1)" strokeWidth={3} fadeEdges />
        <ChartTooltip />
      </LineChart>
    </div>
  );
};

export default VehicleMileageChart;
