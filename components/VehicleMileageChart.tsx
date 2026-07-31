import React, { useMemo } from 'react';
import { MileageLog } from '../types';
import { parseLocalDate } from '../utils';
import { LineChart, Line, Grid, XAxis, ChartTooltip } from '../src/components/charts';

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
      <div className="flex flex-col items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-40 p-8 text-center">
        <span className="material-symbols-outlined text-3xl mb-2">analytics</span>
        <p className="text-xs font-bold tracking-widest">Awaiting Log Data</p>
      </div>
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
        <Line dataKey="reading" stroke="#3B82F6" strokeWidth={3} fadeEdges />
        <ChartTooltip />
      </LineChart>
    </div>
  );
};

export default VehicleMileageChart;
