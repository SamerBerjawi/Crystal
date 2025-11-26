
import React from 'react';
import { formatCurrency } from '../utils';
import Card from './Card';
import { Currency } from '../types';

interface CurrentBalanceCardProps {
  balance: number;
  currency: Currency;
  title?: string;
}

const CurrentBalanceCard: React.FC<CurrentBalanceCardProps> = ({ balance, currency, title = "Net Worth" }) => {
  return (
    <Card className="flex flex-col justify-between h-full min-h-[140px] relative overflow-hidden group">
       {/* Decorative subtle gradient background */}
       <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

      <div className="flex justify-between items-start relative z-10">
        <div>
           <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{title}</p>
           <h3 className="text-3xl font-bold text-light-text dark:text-dark-text mt-1 tracking-tight">{formatCurrency(balance, currency)}</h3>
        </div>
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <span className="material-symbols-outlined text-lg">savings</span>
        </div>
      </div>
      
      <div className="mt-4 relative z-10">
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
           <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
           Live calculation
        </p>
      </div>
    </Card>
  );
};

export default CurrentBalanceCard;
