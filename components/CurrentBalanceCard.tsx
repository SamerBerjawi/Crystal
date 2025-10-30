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
    <Card className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">{title}</h3>
            <p className="text-2xl font-bold mt-1 text-light-text dark:text-dark-text">{formatCurrency(balance, currency)}</p>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary-500/10">
            <span className="material-symbols-outlined text-2xl text-primary-500">
              wallet
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs text-right mt-1 text-light-text-secondary dark:text-dark-text-secondary">As of today</p>
      </div>
    </Card>
  );
};

export default CurrentBalanceCard;