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

  const iconColor = 'text-white';
  const iconBgColor = isPositive ? 'bg-semantic-green' : 'bg-semantic-red';
  const sparklineStroke = isPositive ? '#34C759' : '#FF3B30';

  return (
    <Card className={`flex flex-col justify-between h-full`}>
      <div>
        <div className="flex items-start justify-between">
            <div>
                <h3 className={`text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary`}>{title}</h3>
                <p className={`text-2xl font-bold mt-1 text-light-text dark:text-dark-text`}>{formatCurrency(amount, 'EUR')}</p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBgColor}`}>
                <span className={`material-symbols-outlined text-2xl ${iconColor}`}>
                {isPositive ? 'north' : 'south'}
                </span>
            </div>
        </div>
         {change && (
              <p className={`text-sm font-medium mt-1 ${isPositive ? 'text-semantic-green' : 'text-semantic-red'}`}>
                {change} vs. last period
              </p>
        )}
      </div>
      <div className="h-16 -mb-6 -mx-6 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Line
              type="natural"
              dataKey="value"
              stroke={sparklineStroke}
              strokeOpacity={0.8}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default BalanceCard;