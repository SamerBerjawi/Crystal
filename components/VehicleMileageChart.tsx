import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label } from 'recharts';
import { MileageLog } from '../types';
import Card from './Card';
import { parseDateAsUTC } from '../utils';

interface VehicleMileageChartProps {
  logs: MileageLog[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = parseDateAsUTC(label);
      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
          <p className="label font-semibold text-light-text dark:text-dark-text mb-1">{date.toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="text-primary-500">{`Odometer: ${payload[0].value.toLocaleString()} km`}</p>
        </div>
      );
    }
    return null;
};

const VehicleMileageChart: React.FC<VehicleMileageChartProps> = ({ logs }) => {
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
  if (sortedLogs.length < 2) {
    return (
        <Card>
             <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-4">Mileage History</h3>
            <div className="flex items-center justify-center h-40 text-light-text-secondary dark:text-dark-text-secondary">
                <p>Add at least two mileage logs to see a history chart.</p>
            </div>
        </Card>
    );
  }

  const tickFormatter = (dateStr: string) => {
    const date = parseDateAsUTC(dateStr);
    return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' });
  };

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-4">Mileage History</h3>
      <div className="flex-grow" style={{ width: '100%', height: '200px' }}>
        <ResponsiveContainer>
          <LineChart data={sortedLogs} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="var(--light-separator, #E5E7EB)" opacity={0.5} vertical={false} />
            <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false}
                tickFormatter={tickFormatter}
                tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }}
            />
            <YAxis 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }}
                width={40}
            >
                <Label value="km" offset={-5} position="insideTopLeft" style={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
            </YAxis>
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <Line type="monotone" dataKey="reading" stroke="#3B82F6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default VehicleMileageChart;