
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
  const isOverBudget = remaining < 0;

  let progressBarColor = 'bg-emerald-500';
  if (progress > 100) {
    progressBarColor = 'bg-rose-500';
  } else if (progress > 85) {
    progressBarColor = 'bg-amber-500';
  } else if (!hasBudget) {
    progressBarColor = 'bg-gray-400';
  }

  let statusColor = 'text-emerald-600 dark:text-emerald-400';
  if (isOverBudget) {
      statusColor = 'text-rose-600 dark:text-rose-400';
  } else if (progress > 85) {
      statusColor = 'text-amber-600 dark:text-amber-400';
  } else if (!hasBudget) {
      statusColor = 'text-light-text-secondary dark:text-dark-text-secondary';
  }

  return (
    <div className="group relative bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col h-full">
      {/* Edit Action (Hover) */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600" title={hasBudget ? 'Edit Budget' : 'Set Budget'}>
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-white/5">
            <span
              className="material-symbols-outlined"
              style={{
                color: category.color,
                fontSize: '20px'
              }}
            >
              {category.icon || 'category'}
            </span>
          </div>
          <div className="min-w-0">
             <h4 className="font-bold text-base text-gray-900 dark:text-white truncate">{category.name}</h4>
             {hasBudget ? (
                 <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Budget: {formatCurrency(budgeted, 'EUR')}</p>
             ) : (
                 <p className="text-xs text-gray-400 dark:text-gray-500 italic">No budget set</p>
             )}
          </div>
      </div>
      
      {/* Stats */}
      <div className="mt-auto">
        <div className="flex justify-between items-end mb-1.5">
             <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-wide font-bold text-gray-400 dark:text-gray-500">Spent</span>
                 <span className={`text-lg font-bold ${isOverBudget ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                     {formatCurrency(spent, 'EUR')}
                 </span>
             </div>
             
             <div className="text-right">
                 <span className={`text-sm font-bold ${statusColor}`}>
                     {hasBudget ? (
                         isOverBudget 
                            ? `${formatCurrency(Math.abs(remaining), 'EUR')} over` 
                            : `${formatCurrency(remaining, 'EUR')} left`
                     ) : (
                         '—'
                     )}
                 </span>
             </div>
        </div>

        {/* Progress Bar */}
        {hasBudget ? (
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
        ) : (
             <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5"></div>
        )}
      </div>
    </div>
  );
};

export default BudgetProgressCard;
