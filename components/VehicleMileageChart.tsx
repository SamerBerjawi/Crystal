import React, { useMemo } from 'react';
import { curveNatural } from '@visx/curve';
import { MileageLog } from '../types';
import { parseLocalDate } from '../utils';
import { LineChart, Line, Grid, XAxis, YAxis, ChartTooltip, LineSeriesTerminalMarker } from '../src/components/charts';
import { SpotlightIndicator } from '../src/components/charts/spotlight-indicator';
import { HorizonArea } from './ForecastHorizonChart';
import { spanTick } from './investments/PortfolioHero';
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
  const tick = useMemo(() => spanTick(sortedLogs), [sortedLogs]);

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
        margin={{ top: 16, right: 16, bottom: 24, left: 52 }}
      >
        <Grid horizontal numTicksRows={4} stroke="var(--line)" />
        <SpotlightIndicator seriesKey="reading" color="var(--chart-1)" />
        <HorizonArea seriesKey="reading" color="var(--chart-1)" curve={curveNatural} />
        <XAxis numTicks={5} tickMode="domain" tickFormatter={tick} />
        <YAxis numTicks={4} tickFormatter={v => v.toLocaleString()} />
        <Line dataKey="reading" label="Odometer" stroke="var(--chart-1)" strokeWidth={2.25} curve={curveNatural} fadeEdges={false} />
        <LineSeriesTerminalMarker dataKey="reading" stroke="var(--chart-1)" fill="var(--chart-1)" />
        <ChartTooltip
          showCrosshair
          rows={point => [{ color: 'var(--chart-1)', label: 'Odometer', value: Number(point.reading ?? 0).toLocaleString() }]}
        />
      </LineChart>
    </div>
  );
};

export default VehicleMileageChart;
