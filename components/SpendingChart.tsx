
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

  return (
    <Card className="flex flex-col justify-between h-full border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200">
      <div>
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Net Balance</h3>
          <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'}`}>
            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
          </div>
        </div>
        <p className={`text-2xl font-extrabold tracking-tight ${isPositive ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
            {formatCurrency(netBalance, 'EUR')}
        </p>
      </div>

      <div className="mt-4">
         <div className="flex justify-between text-xs font-medium mb-1.5">
             <span className="text-light-text dark:text-dark-text">Savings Rate</span>
             <span className={isPositive ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}>{progress.toFixed(0)}%</span>
         </div>
         <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-blue-500' : 'bg-orange-500'}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-2 font-medium text-right uppercase tracking-wide opacity-70">{duration}</p>
      </div>
    </Card>
  );
};

export default NetBalanceCard;
