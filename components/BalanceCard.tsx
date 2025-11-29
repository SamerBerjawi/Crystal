
import React from 'react';
import { formatCurrency } from '../utils';
import Card from './Card';
import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface BalanceCardProps {
  title: string;
  amount: number;
  change?: string;
  changeType?: 'positive' | 'negative';
  sparklineData: { value: number }[];
}

const BalanceCard: React.FC<BalanceCardProps> = ({ title, amount, change, changeType, sparklineData }) => {
  const isPositive = changeType === 'positive';
  const chartColor = isPositive ? '#22C55E' : '#EF4444'; // Green or Red

  return (
    <Card className="relative overflow-hidden flex flex-col justify-between h-full border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">{title}</h3>
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                <span className="material-symbols-outlined text-lg">
                    {title === 'Expenses' ? 'arrow_upward' : 'arrow_downward'}
                </span>
            </div>
        </div>
        
        <div className="mb-auto">
            <p className="text-2xl font-extrabold text-light-text dark:text-dark-text tracking-tight">
                {formatCurrency(amount, 'EUR')}
            </p>
            
            {change && (
                <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                        {change}
                    </span>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">vs last period</span>
                </div>
            )}
        </div>
      </div>

      {/* Background Sparkline */}
      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
             <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.5}/>
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default BalanceCard;
