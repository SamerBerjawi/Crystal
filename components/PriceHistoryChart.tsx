
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PriceHistoryEntry } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';

interface PriceHistoryChartProps {
  history: PriceHistoryEntry[];
}

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ history }) => {
    const sortedHistory = useMemo(() => {
        return [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [history]);

    if (sortedHistory.length < 2) {
        return (
            <div className="flex items-center justify-center h-40 text-light-text-secondary dark:text-dark-text-secondary">
                <p>Not enough history to display chart.</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const date = parseLocalDate(label);
            return (
                <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
                    <p className="label font-semibold text-light-text dark:text-dark-text mb-1">
                        {date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-primary-500 font-mono font-bold">
                        {formatCurrency(payload[0].value, 'EUR')}
                    </p>
                </div>
            );
        }
        return null;
    };

    const tickFormatter = (dateStr: string) => {
        const date = parseLocalDate(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex-grow" style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                <AreaChart data={sortedHistory} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--light-separator, #E5E7EB)" opacity={0.5} vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false}
                        tickFormatter={tickFormatter}
                        tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                        minTickGap={40}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false}
                        tickFormatter={(value) => formatCurrency(value, 'EUR').replace(/[^0-9.,]/g, '')}
                        tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                        domain={['auto', 'auto']}
                        width={50}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
                    <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#8B5CF6" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        activeDot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke: '#8B5CF6' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PriceHistoryChart;
