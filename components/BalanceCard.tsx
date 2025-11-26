
import React from 'react';
import { formatCurrency } from '../utils';
import Card from './Card';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface BalanceCardProps {
  title: string;
  amount: number;
  change?: string;
  changeType?: 'positive' | 'negative';
  sparklineData: { value: number }[];
}

const BalanceCard: React.FC<BalanceCardProps> = ({ title, amount, change, changeType, sparklineData }) => {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  // Dynamic colors based on trend
  const iconBg = isPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10';
  const iconColor = isPositive ? 'text-emerald-500' : 'text-rose-500';
  const trendColor = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const strokeColor = isPositive ? '#10B981' : '#F43F5E';

  return (
    <Card className="relative overflow-hidden flex flex-col justify-between h-full min-h-[140px] !p-0">
      <div className="p-5 relative z-10">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{title}</p>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg} backdrop-blur-sm`}>
            <span className={`material-symbols-outlined text-lg ${iconColor}`}>
              {isPositive ? 'trending_up' : 'trending_down'}
            </span>
          </div>
        </div>
        
        <div>
          <h3 className="text-3xl font-bold text-light-text dark:text-dark-text tracking-tight">
            {formatCurrency(amount, 'EUR')}
          </h3>
          {change && (
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-xs font-bold ${trendColor} bg-light-bg dark:bg-white/5 px-1.5 py-0.5 rounded`}>
                {change}
              </span>
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">vs last period</span>
            </div>
          )}
        </div>
      </div>

      {/* Background Sparkline */}
      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default BalanceCard;
