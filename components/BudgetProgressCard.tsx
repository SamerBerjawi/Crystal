
import React from 'react';
import { Category } from '../types';
import { formatCurrency } from '../utils';
import Card from './Card';

interface BudgetProgressCardProps {
  category: Category;
  budgeted: number;
  spent: number;
  onEdit: () => void;
}

const BudgetProgressCard: React.FC<BudgetProgressCardProps> = ({ category, budgeted, spent, onEdit }) => {
  const hasBudget = budgeted > 0;
  const remaining = hasBudget ? budgeted - spent : 0;
  const progress = hasBudget ? (spent / budgeted) * 100 : 0;

  let progressBarColor = 'bg-primary-500';
  let accentColor = 'rgba(79, 70, 229, 0.2)'; // Default primary-500/20
  
  if (progress > 100) {
    progressBarColor = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]';
    accentColor = 'rgba(244, 63, 94, 0.1)';
  } else if (progress > 80) {
    progressBarColor = 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
    accentColor = 'rgba(245, 158, 11, 0.1)';
  } else {
    progressBarColor = 'bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]';
  }

  return (
    <Card className="flex flex-col gap-4 group transition-all duration-300 hover:-translate-y-1 !p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
      
      {/* Header */}
      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500" style={{ backgroundColor: `${category.color}15` }}>
            <span
              className="material-symbols-outlined text-xl"
              style={{
                color: category.color,
                fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24"
              }}
            >
              {category.icon || 'category'}
            </span>
          </div>
          <div>
            <h4 className="font-black text-[13px] tracking-tight text-light-text dark:text-dark-text leading-none mb-1">{category.name}</h4>
            <div className="flex items-center gap-1.5 opacity-40">
                <span className="text-[9px] font-bold tracking-wider leading-none">Spending Plan</span>
            </div>
          </div>
        </div>
        <button 
            onClick={onEdit} 
            className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black dark:hover:bg-white text-light-text dark:text-dark-text hover:text-white dark:hover:text-black rounded-lg transition-all active:scale-90" 
            title={hasBudget ? 'Edit Budget' : 'Set Budget'}
        >
          <span className="material-symbols-outlined text-base leading-none">{hasBudget ? 'edit' : 'add'}</span>
        </button>
      </div>
      
      {/* Progress Bar and Amounts */}
      <div className="relative z-10">
        {hasBudget ? (
          <div className="space-y-4">
             <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                    <p className="text-[8px] font-bold tracking-wider opacity-50 dark:opacity-70 leading-none">Utilization</p>
                    <div className="flex items-baseline gap-1">
                       <span className="text-lg font-black tracking-tighter privacy-blur leading-none">{progress.toFixed(0)}</span>
                       <span className="text-[9px] font-black opacity-30 tracking-widest leading-none">%</span>
                    </div>
                </div>
                <div className="text-right space-y-0.5">
                    <p className="text-[8px] font-bold tracking-wider opacity-50 dark:opacity-70 leading-none">{remaining >= 0 ? 'Residual' : 'Exceeded'}</p>
                    <p className={`text-lg font-black tracking-tighter privacy-blur leading-none ${remaining >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        €{Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-2 overflow-hidden border border-black/5 dark:border-white/5 p-[1px]">
              <div
                className={`${progressBarColor} h-full rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-[9px] font-bold tracking-wider">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <span className="opacity-50 dark:opacity-70">Limit:</span>
                    <span className="privacy-blur text-primary-500 font-bold">€{budgeted.toLocaleString()}</span>
                </div>
                <div className="text-light-text-secondary/60 dark:text-dark-text-secondary/80 privacy-blur bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg border border-black/5 dark:border-white/5 uppercase font-bold tracking-tight">
                    {spent.toLocaleString()} spent
                </div>
            </div>
          </div>
        ) : (
          <div className="text-center bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 group-hover:bg-white dark:group-hover:bg-neutral-800 transition-colors">
            <p className="text-[9px] font-bold tracking-wider opacity-50 dark:opacity-70 mb-2 leading-none">Unscheduled Spending</p>
            <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-black tracking-tighter text-light-text dark:text-dark-text privacy-blur leading-none">€{spent.toLocaleString()}</span>
            </div>
            <button 
                onClick={onEdit}
                className="mt-3 text-[8px] font-bold tracking-wider text-primary-500 hover:text-primary-600 transition-colors"
            >
                + Set Budget Guide
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BudgetProgressCard;
