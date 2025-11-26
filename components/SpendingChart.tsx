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
  
  return (
    <Card className={`flex flex-col justify-between h-full`}>
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">Net Balance</h3>
            <p className="text-2xl font-bold mt-1 text-light-text dark:text-dark-text">{formatCurrency(netBalance, 'EUR')}</p>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary-500/10">
            <span className="material-symbols-outlined text-2xl text-primary-500">
              account_balance
            </span>
          </div>
        </div>
         <p className="text-sm font-medium mt-1 text-light-text-secondary dark:text-dark-text-secondary">
              {duration} Period
          </p>
      </div>
      <div className="mt-4">
         <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-xs text-right mt-1.5 text-light-text-secondary dark:text-dark-text-secondary">{progress.toFixed(0)}% of income remaining</p>
      </div>
    </Card>
  );
};

export default NetBalanceCard;