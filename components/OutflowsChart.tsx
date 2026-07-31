import React from 'react';
import { CategorySpending } from '../types';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import { BarChart, Bar, Grid, BarXAxis, BarYAxis, ChartTooltip } from '@/src/components/charts';

interface OutflowsChartProps {
  data: CategorySpending[];
  onCategoryClick: (categoryName: string) => void;
}

const OutflowsChart: React.FC<OutflowsChartProps> = ({ data, onCategoryClick }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-60 flex-col gap-2">
        <Icon name="bar_chart_4_bars" className="text-3xl" />
        <p>No outflow data.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <BarChart
        data={data as unknown as Record<string, unknown>[]}
        xDataKey="name"
        orientation="horizontal"
        aspectRatio="auto"
        margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
        className="w-full h-full"
      >
        <Grid vertical horizontal={false} strokeOpacity={0.05} />
        <Bar
          dataKey="value"
          fill={(d) => (d.color as string) || '#3B82F6'}
          lineCap="round"
          onClick={(d) => onCategoryClick(d.name as string)}
        />
        <BarXAxis />
        <BarYAxis />
        <ChartTooltip
          valueFormatter={(val: number) => formatCurrency(val, 'EUR')}
        />
      </BarChart>
    </div>
  );
};

export default OutflowsChart;
