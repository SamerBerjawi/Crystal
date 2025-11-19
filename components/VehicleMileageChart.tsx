
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { MileageLog } from '../types';
import Card from './Card';

interface VehicleMileageChartProps {
  logs: MileageLog[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
          <p className="label font-semibold text-light-text dark:text-dark-text mb-1">{label}</p>
          <p className="text-primary-500">{`Distance: ${payload[0].value} km`}</p>
        </div>
      );
    }
    return null;
};

const VehicleMileageChart: React.FC<VehicleMileageChartProps> = ({ logs }) => {
    // Sort logs by date
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate distance delta per month
    const monthlyDistance: { month: string, value: number }[] = [];
    
    for (let i = 1; i < sortedLogs.length; i++) {
        const prev = sortedLogs[i-1];
        const curr = sortedLogs[i];
        
        const distance = curr.reading - prev.reading;
        if (distance > 0) {
            const date = new Date(curr.date);
            const monthLabel = date.toLocaleString('default', { month: 'short', year: '2-digit' });
            
            // Simple aggregation if multiple logs in same month, 
            // though strictly this logic calculates delta from *previous entry* to *current entry*
            // and attributes it to the current month.
            const existingMonth = monthlyDistance.find(m => m.month === monthLabel);
            if (existingMonth) {
                existingMonth.value += distance;
            } else {
                monthlyDistance.push({ month: monthLabel, value: distance });
            }
        }
    }

  if (monthlyDistance.length === 0) {
    return (
        <Card>
             <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-4">Mileage History</h3>
            <div className="flex items-center justify-center h-40 text-light-text-secondary dark:text-dark-text-secondary">
                <p>Add at least two mileage logs to see distance charts.</p>
            </div>
        </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-4">Distance Traveled (km)</h3>
      <div className="flex-grow" style={{ width: '100%', height: '200px' }}>
        <ResponsiveContainer>
          <BarChart data={monthlyDistance} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="var(--light-separator, #E5E7EB)" opacity={0.5} vertical={false} />
            <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }}
            />
            <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }}
                width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <Bar dataKey="value" barSize={30} radius={[4, 4, 0, 0]} fill="#3B82F6">
                {monthlyDistance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#3B82F6" />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default VehicleMileageChart;
