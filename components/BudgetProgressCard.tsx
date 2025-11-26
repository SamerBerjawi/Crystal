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

  let progressBarColor = 'bg-emerald-500';
  let statusColor = 'text-emerald-600 dark:text-emerald-400';
  
  if (progress > 100) {
    progressBarColor = 'bg-rose-500';
    statusColor = 'text-rose-600 dark:text-rose-400';
  } else if (progress > 85) {
    progressBarColor = 'bg-yellow-500';
    statusColor = 'text-yellow-600 dark:text-yellow-400';
  }

  return (
    <Card className="flex flex-col gap-3 group transition-all duration-200 hover:shadow-lg border border-transparent hover:border-black/5 dark:hover:border-white/10 p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-light-bg dark:bg-dark-bg shadow-sm flex items-center justify-center border border-black/5 dark:border-white/5">
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: category.color }}
            >
              {category.icon || 'category'}
            </span>
          </div>
          <h4 className="font-semibold text-sm text-light-text dark:text-dark-text truncate">{category.name}</h4>
        </div>
        
        <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-opacity-10 dark:bg-opacity-20 ${statusColor.replace('text-', 'bg-')} ${statusColor}`}>
                {progress.toFixed(0)}%
            </span>
            <button 
                onClick={onEdit} 
                className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                title="Edit Budget"
            >
                <span className="material-symbols-outlined text-sm">edit</span>
            </button>
        </div>
      </div>
      
      {/* Progress Bar and Amounts */}
      <div className="space-y-2">
          <div className="flex justify-between items-baseline">
              <span className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(spent, 'EUR')}</span>
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">of {formatCurrency(budgeted, 'EUR')}</span>
          </div>

          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`${progressBarColor} h-1.5 rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs font-medium pt-1">
               <span className="text-light-text-secondary dark:text-dark-text-secondary">
                   {progress > 100 ? 'Over budget by' : 'Remaining'}
               </span>
               <span className={statusColor}>
                   {formatCurrency(Math.abs(remaining), 'EUR')}
               </span>
          </div>
      </div>
    </Card>
  );
};

export default BudgetProgressCard;
