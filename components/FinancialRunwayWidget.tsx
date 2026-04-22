
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

    let runwayStatus = { label: 'Operational', color: 'blue', icon: 'shield' };
    if (months < 3) runwayStatus = { label: 'Critical', color: 'rose', icon: 'warning' };
    else if (months > 12) runwayStatus = { label: 'Infinity', color: 'emerald', icon: 'all_inclusive' };

    return { 
      runway: months, 
      monthlyBurn: burn, 
      liquidAssets: liquid,
      status: runwayStatus
    };
  }, [accounts, transactions]);

  return (
    <div className="flex flex-col h-full justify-between !bg-transparent !p-0">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-40">System Survival Runway</span>
          <h2 className="text-4xl font-black text-light-text dark:text-dark-text mt-2 font-mono tracking-tighter">
            {runway >= 99 ? '∞' : runway.toFixed(1)} <span className="text-base font-black opacity-20 uppercase tracking-widest ml-1">Cycles</span>
          </h2>
        </div>
        <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border bg-${status.color}-500/10 text-${status.color}-500 border-${status.color}-500/20 shadow-lg shadow-${status.color}-500/5`}>
          <span className="material-symbols-outlined text-[12px] filled-icon bg-transparent">{status.icon}</span>
          {status.label}
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-black/5 flex flex-col gap-1 transition-all duration-300 hover:bg-black/10">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Monthly Burn</span>
            <span className="text-sm font-black font-mono text-rose-500 tracking-tighter">{formatCurrency(monthlyBurn, 'EUR')}</span>
          </div>
          <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-black/5 flex flex-col gap-1 transition-all duration-300 hover:bg-black/10">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Liquid Nodes</span>
            <span className="text-sm font-black font-mono text-emerald-500 tracking-tighter">{formatCurrency(liquidAssets, 'EUR')}</span>
          </div>
        </div>

        <div className="relative pt-2 px-1">
          <div className="overflow-hidden h-1.5 mb-2 flex rounded-full bg-black/5 dark:bg-white/5 p-0.5 border border-black/5">
            <div 
              style={{ width: `${Math.min((runway / 12) * 100, 100)}%` }} 
              className="shadow-3xl flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-1000 rounded-full"
            ></div>
          </div>
          <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.2em] text-light-text-secondary opacity-30">
            <span>Terminal (0C)</span>
            <span>Sustainable (12C+)</span>
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex items-center gap-3 opacity-30 group-hover:opacity-60 transition-opacity">
         <span className="material-symbols-outlined text-sm">database</span>
         <p className="text-[9px] leading-tight font-medium uppercase tracking-widest text-light-text-secondary">
           Projected maintenance based on 90-cycle expenditure velocity
         </p>
      </div>
    </div>
  );
};

export default FinancialRunwayWidget;
