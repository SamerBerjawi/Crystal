import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { BarChart, Bar, Grid, BarXAxis, BarYAxis, ChartTooltip } from '@/src/components/charts';

interface BreakdownData {
  name: string;
  value: number;
  color: string;
}

interface BreakdownBarChartProps {
  data: BreakdownData[];
}

const BreakdownBarChart: React.FC<BreakdownBarChartProps> = ({ data }) => {
  return (
    <Card>
      <div style={{ width: '100%', height: '162px' }}>
        <BarChart
          data={data as unknown as Record<string, unknown>[]}
          xDataKey="name"
          orientation="horizontal"
          aspectRatio="auto"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
          className="w-full h-full"
        >
          <Grid vertical horizontal={false} strokeOpacity={0.05} />
          <Bar
            dataKey="value"
            fill={(d) => (d.color as string) || '#8884d8'}
            lineCap="round"
          />
          <BarYAxis />
          <ChartTooltip
            valueFormatter={(val: number) => formatCurrency(val, 'EUR')}
          />
        </BarChart>
      </div>
    </Card>
  );
};

export default BreakdownBarChart;
