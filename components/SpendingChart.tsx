
import React from 'react';
import { formatCurrency } from '../utils';
import Card from './Card';

interface NetBalanceCardProps {
  netBalance: number;
  totalIncome: number;
  duration: string;
}

const NetBalanceCard: React.FC<NetBalanceCardProps> = ({ netBalance, totalIncome, duration }) => {
  const progress = totalIncome > 0 ? Math.max(0, Math.min(100, (netBalance / totalIncome) * 100)) : 0;
  const isPositive = netBalance >= 0;
  const barColor = isPositive ? 'bg-primary-500' : 'bg-red-500';

  return (
    <Card className="flex flex-col justify-between h-full min-h-[140px]">
      <div className="flex justify-between items-start">
        <div>
             <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Net Balance</p>
             <h3 className={`text-3xl font-bold mt-1 tracking-tight ${isPositive ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
                {formatCurrency(netBalance, 'EUR')}
            </h3>
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500">
            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1.5">
            <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">{duration} Saving Rate</span>
            <span className="font-bold text-light-text dark:text-dark-text">{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </Card>
  );
};

export default NetBalanceCard;
