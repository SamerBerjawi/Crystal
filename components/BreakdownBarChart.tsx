
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Card from './Card';
import { formatCurrency } from '../utils';

interface BreakdownData {
  name: string;
  value: number;
  color: string;
}

interface BreakdownBarChartProps {
  data: BreakdownData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const color = payload?.[0]?.payload?.color || '#8884d8';
      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
          <p className="label font-semibold text-light-text dark:text-dark-text mb-1">{label}</p>
          <p style={{ color: color }}>{`Total: ${formatCurrency(payload[0].value, 'EUR')}`}</p>
        </div>
      );
    }
    return null;
};


const BreakdownBarChart: React.FC<BreakdownBarChartProps> = ({ data }) => {
  return (
    <Card>
      <div style={{ width: '100%', height: '162px' }}>
        <ResponsiveContainer minWidth={0} minHeight={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              axisLine={false} 
              tickLine={false}
              width={80}
              tick={{ fill: 'currentColor', opacity: 0.8, fontSize: 12 }}
            />
            <Tooltip content={(props) => CustomTooltip(props)} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}/>
            <Bar dataKey="value" barSize={15} radius={[0, 4, 4, 0]} cursor="pointer">
                {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default BreakdownBarChart;
