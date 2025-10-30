import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../utils';

interface ChartData {
  name: string;
  value: number;
}

interface NetWorthChartProps {
  data: ChartData[];
  lineColor?: string;
}

const yAxisTickFormatter = (value: number) => {
    if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
};

const NetWorthChart: React.FC<NetWorthChartProps> = ({ data, lineColor = '#6366F1' }) => {

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-xl shadow-lg border border-black/5 dark:border-white/10">
            <p className="label font-semibold text-light-text-secondary dark:text-dark-text-secondary text-sm">{new Date(label.replace(/-/g, '/')).toLocaleDateString()}</p>
            <p className="font-bold text-lg" style={{ color: lineColor }}>{formatCurrency(payload[0].value, 'EUR')}</p>
          </div>
        );
      }
      return null;
  };

  const tickFormatter = (dateStr: string) => {
    const date = new Date(dateStr.replace(/-/g, '/'));

    if (data.length <= 1) return '';

    const startDate = new Date(data[0].name.replace(/-/g, '/'));
    const endDate = new Date(data[data.length - 1].name.replace(/-/g, '/'));
    const rangeInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

    // If range is a month or less, show day and month.
    if (rangeInDays <= 31) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    // If range is within the same calendar year, just show the month.
    if (startDate.getFullYear() === endDate.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    
    // Otherwise (spanning multiple years), show month and year to avoid ambiguity.
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
  
  const gradientId = `colorNetWorth-${lineColor.replace('#', '')}`;

  return (
    <div className="flex-grow" style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
          <XAxis dataKey="name" stroke="currentColor" opacity={0.6} fontSize={12} tickFormatter={tickFormatter} minTickGap={40} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" opacity={0.6} fontSize={12} tickFormatter={yAxisTickFormatter} axisLine={false} tickLine={false} width={80} />
          <Tooltip 
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<CustomTooltip />} 
           />
          <Area 
            type="natural" 
            dataKey="value" 
            name="Net Worth" 
            stroke={lineColor} 
            fill={`url(#${gradientId})`} 
            strokeWidth={3}
            activeDot={{ r: 5, fill: 'white', stroke: lineColor, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;