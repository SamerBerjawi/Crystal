
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
        <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 text-sm animate-in fade-in zoom-in duration-200">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/5 dark:border-white/5">
            <span className="material-symbols-outlined text-[10px] opacity-40">category</span>
            <p className="font-black text-light-text dark:text-dark-text uppercase tracking-[0.2em] text-[9px] opacity-60 leading-none">{label}</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }}></div>
             <p className="text-lg font-black font-mono tracking-tighter" style={{ color: payload[0].payload.color }}>
                {formatCurrency(payload[0].value, 'EUR')}
             </p>
          </div>
          <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mt-2 opacity-40">System Allocated Data</p>
        </div>
      );
    }
    return null;
};

const OutflowsChart: React.FC<OutflowsChartProps> = ({ data, onCategoryClick }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full flex-col gap-4 py-12">
        <div className="w-16 h-16 rounded-[2rem] bg-black/5 dark:bg-white/5 flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-3xl opacity-20">bar_chart_4_bars</span>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">No outflow data detected</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: -20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="4 4" stroke="currentColor" opacity={0.03} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={100}
            tick={(props) => {
                const { x, y, payload } = props;
                return (
                    <g transform={`translate(${x},${y})`}>
                        <text 
                            x={0} 
                            y={0} 
                            dy={4} 
                            textAnchor="start" 
                            fill="currentColor" 
                            className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                            onClick={() => onCategoryClick(payload.value)}
                        >
                            {payload.value}
                        </text>
                    </g>
                );
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.03)', radius: 12 }} />
          <Bar 
            dataKey="value" 
            barSize={16} 
            radius={[0, 8, 8, 0]} 
            onClick={(barData: any) => onCategoryClick(barData.name)}
            background={{ fill: 'rgba(0,0,0,0.02)', radius: 8 }}
          >
            {data.map((entry) => (
              <Cell 
                key={`cell-${entry.name}`} 
                fill={entry.color} 
                cursor="pointer" 
                className="hover:opacity-80 transition-opacity duration-300"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OutflowsChart;
