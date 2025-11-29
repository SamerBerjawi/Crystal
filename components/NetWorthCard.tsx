
import React from 'react';
import { formatCurrency } from '../utils';
import { Currency } from '../types';
import Card from './Card';

interface NetWorthCardProps {
  amount: number;
  currency: Currency;
}

const NetWorthCard: React.FC<NetWorthCardProps> = ({ amount, currency }) => {
  return (
    <Card className="relative overflow-hidden h-full flex flex-col justify-center items-center text-center bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-dark-card border border-primary-100 dark:border-primary-900/30">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary-200 dark:bg-primary-800/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-200 dark:bg-blue-800/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-white/5 border border-primary-100 dark:border-white/10 backdrop-blur-sm mb-4 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary-700 dark:text-primary-300">Total Net Worth</span>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-light-text dark:text-dark-text drop-shadow-sm">
                {formatCurrency(amount, currency)}
            </h2>
            
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-3 font-medium">
                Across all accounts
            </p>
        </div>
    </Card>
  );
};

export default NetWorthCard;
