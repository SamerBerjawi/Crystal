
import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { convertToEur, formatCurrency, parseLocalDate } from '../utils';
import { LIQUID_ACCOUNT_TYPES } from '../constants';

interface FinancialRunwayWidgetProps {
  accounts: Account[];
  transactions: Transaction[];
}

const FinancialRunwayWidget: React.FC<FinancialRunwayWidgetProps> = ({ accounts, transactions }) => {
  const { runway, monthlyBurn, liquidAssets, status } = useMemo(() => {
    // 1. Calculate Liquid Assets
    const liquid = accounts
      .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type) && a.status !== 'closed')
      .reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);

    // 2. Calculate Average Monthly Burn (Last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const expenses = transactions
      .filter(t => t.type === 'expense' && !t.transferId && parseLocalDate(t.date) >= ninetyDaysAgo)
      .reduce((sum, t) => sum + Math.abs(convertToEur(t.amount, t.currency)), 0);
    
    const burn = expenses / 3;
    const months = burn > 0 ? liquid / burn : 99; // 99 as infinity fallback

    let runwayStatus: { label: string; color: string; icon: string } = { label: 'Stable', color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', icon: 'check_circle' };
    if (months < 3) runwayStatus = { label: 'Critical', color: 'text-red-500 bg-red-100 dark:bg-red-900/30', icon: 'warning' };
    else if (months > 12) runwayStatus = { label: 'Anti-fragile', color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', icon: 'shield_with_heart' };

    return { 
      runway: months, 
      monthlyBurn: burn, 
      liquidAssets: liquid,
      status: runwayStatus
    };
  }, [accounts, transactions]);

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary opacity-60">Survival Runway</span>
          <h2 className="text-4xl font-black text-light-text dark:text-dark-text mt-1">
            {runway >= 99 ? '∞' : runway.toFixed(1)} <span className="text-lg font-bold opacity-40">Months</span>
          </h2>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${status.color}`}>
          <span className="material-symbols-outlined text-sm">{status.icon}</span>
          {status.label}
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-light-fill dark:bg-dark-fill rounded-2xl p-4 border border-black/5 dark:border-white/5">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-light-text-secondary">Avg. Monthly Burn</span>
            <span className="font-bold text-rose-500">{formatCurrency(monthlyBurn, 'EUR')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-light-text-secondary">Liquid Assets</span>
            <span className="font-bold text-emerald-500">{formatCurrency(liquidAssets, 'EUR')}</span>
          </div>
        </div>

        <div className="relative pt-1 px-1">
          <div className="overflow-hidden h-3 mb-1 text-xs flex rounded-full bg-gray-200 dark:bg-gray-800 shadow-inner">
            <div 
              style={{ width: `${Math.min((runway / 12) * 100, 100)}%` }} 
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-1000 rounded-full"
            ></div>
          </div>
          <div className="flex justify-between text-[9px] font-bold uppercase text-gray-400">
            <span>Critical (0m)</span>
            <span>Stable (12m+)</span>
          </div>
        </div>
      </div>
      
      <p className="text-[10px] leading-tight text-light-text-secondary opacity-60 mt-4">
        Based on your current burn rate, this is how long you can maintain your lifestyle without any new income.
      </p>
    </div>
  );
};

export default FinancialRunwayWidget;
