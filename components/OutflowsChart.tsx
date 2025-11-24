
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { CategorySpending } from '../types';
import { formatCurrency } from '../utils';

interface OutflowsChartProps {
  data: CategorySpending[];
  onCategoryClick: (categoryName: string) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
          <p className="label font-semibold text-light-text dark:text-dark-text mb-1">{label}</p>
          <p style={{ color: payload[0].payload.color }}>{`Spent: ${formatCurrency(payload[0].value, 'EUR')}`}</p>
        </div>
      );
    }
    return null;
};

const OutflowsChart: React.FC<OutflowsChartProps> = ({ data, onCategoryClick }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">
        <p>No outflow data for this period.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={120}
            tick={{ fill: 'currentColor', opacity: 0.8, fontSize: 13 }}
            style={{ cursor: 'pointer' }}
            onClick={(payload) => onCategoryClick(payload.value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
          <Bar dataKey="value" barSize={20} radius={[0, 8, 8, 0]} onClick={(barData: any) => onCategoryClick(barData.name)}>
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.color} cursor="pointer" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OutflowsChart;
