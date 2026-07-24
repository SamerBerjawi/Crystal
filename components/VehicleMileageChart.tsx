
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label } from 'recharts';
import { MileageLog } from '../types';
import { parseLocalDate } from '../utils';

interface VehicleMileageChartProps {
  logs: MileageLog[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = parseLocalDate(label);
      return (
        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800/80 backdrop-blur-md">
          <p className="font-bold text-neutral-500 dark:text-neutral-400 mb-2  tracking-widest text-[10px]">
            {date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            <p className="text-neutral-850 dark:text-neutral-100 font-black font-mono text-sm">{payload[0].value.toLocaleString()} km</p>
          </div>
        </div>
      );
    }
    return null;
};

const VehicleMileageChart: React.FC<VehicleMileageChartProps> = ({ logs }) => {
    const sortedLogs = useMemo(() => {
        return [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [logs]);
    
  if (sortedLogs.length < 2) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-40 p-8 text-center">
             <span className="material-symbols-outlined text-3xl mb-2">analytics</span>
            <p className="text-xs font-bold  tracking-widest">Awaiting Log Data</p>
        </div>
    );
  }

  const tickFormatter = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
      <div className="flex-grow w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sortedLogs} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
            <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false}
                tickFormatter={tickFormatter}
                tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 10, fontWeight: 700 }}
                dy={10}
            />
            <YAxis 
                hide
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(59, 130, 246, 0.2)', strokeWidth: 2 }} />
            <Line 
                type="monotone" 
                dataKey="reading" 
                stroke="#3B82F6" 
                strokeWidth={4} 
                dot={false} 
                activeDot={{ r: 6, fill: '#3B82F6', strokeWidth: 0 }}
                animationDuration={2000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
  );
};

export default VehicleMileageChart;
