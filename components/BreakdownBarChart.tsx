
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
        <div className="bg-white dark:bg-dark-card p-3 rounded-xl shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-md">
          <p className="font-black text-light-text-secondary dark:text-dark-text-secondary mb-2 uppercase tracking-widest text-[10px] opacity-60">{label}</p>
          <p className="font-black font-mono text-sm" style={{ color: color }}>{formatCurrency(payload[0].value, 'EUR')}</p>
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
