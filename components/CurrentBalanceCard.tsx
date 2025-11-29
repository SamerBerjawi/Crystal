
import React from 'react';
import { formatCurrency } from '../utils';
import Card from './Card';
import { Currency } from '../types';

interface CurrentBalanceCardProps {
  balance: number;
  currency: Currency;
  title?: string;
}

const CurrentBalanceCard: React.FC<CurrentBalanceCardProps> = ({ balance, currency, title = "Current Balance" }) => {
  return (
    <Card className="flex flex-col justify-between h-full border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-black/20">
      <div>
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">{title}</h3>
          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
            <span className="material-symbols-outlined text-lg">
              savings
            </span>
          </div>
        </div>
        <p className="text-2xl font-extrabold text-light-text dark:text-dark-text tracking-tight">{formatCurrency(balance, currency)}</p>
      </div>
      <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Live Estimate
        </p>
      </div>
    </Card>
  );
};

export default CurrentBalanceCard;
