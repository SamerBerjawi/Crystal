
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
        <div className="bg-light-card/90 dark:bg-dark-card/90 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-white/10 text-sm">
          <p className="label font-bold text-light-text dark:text-dark-text mb-1">{label}</p>
          <p style={{ color: payload[0].payload.color }} className="font-mono">{`Spent: ${formatCurrency(payload[0].value, 'EUR')}`}</p>
        </div>
      );
    }
    return null;
};

const OutflowsChart: React.FC<OutflowsChartProps> = ({ data, onCategoryClick }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-60 flex-col gap-2">
        <span className="material-symbols-outlined text-3xl">bar_chart_4_bars</span>
        <p>No outflow data.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={120}
            tick={{ fill: 'currentColor', opacity: 0.7, fontSize: 12, fontWeight: 500 }}
            style={{ cursor: 'pointer' }}
            onClick={(payload) => onCategoryClick(payload.value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.05)', radius: 8 }} />
          <Bar dataKey="value" barSize={12} radius={[0, 6, 6, 0]} onClick={(barData: any) => onCategoryClick(barData.name)}>
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.color} cursor="pointer" style={{ transition: 'all 0.3s ease' }} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OutflowsChart;
