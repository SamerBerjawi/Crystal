

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
  if (progress > 100) {
    progressBarColor = 'bg-red-500';
  } else if (progress > 80) {
    progressBarColor = 'bg-yellow-500';
  }

  let remainingColor = 'text-green-600 dark:text-green-400';
  if (hasBudget && remaining < 0) {
    remainingColor = 'text-red-600 dark:text-red-400';
  } else if (remaining < budgeted * 0.2) {
    remainingColor = 'text-yellow-600 dark:text-yellow-400';
  }

  return (
    <Card className="flex flex-col gap-4 group transition-transform duration-200 hover:-translate-y-1">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-light-bg dark:bg-dark-bg shadow-neu-inset-light dark:shadow-neu-inset-dark flex items-center justify-center">
            <span
              className="material-symbols-outlined"
              style={{
                color: category.color,
                fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24"
              }}
            >
              {category.icon || 'category'}
            </span>
          </div>
          <h4 className="font-semibold text-lg text-light-text dark:text-dark-text">{category.name}</h4>
        </div>
        <button onClick={onEdit} className="p-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title={hasBudget ? 'Edit Budget' : 'Set Budget'}>
          <span className="material-symbols-outlined text-base">{hasBudget ? 'edit' : 'add'}</span>
        </button>
      </div>
      
      {/* Progress Bar and Amounts */}
      <div>
        {hasBudget ? (
          <>
            <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-3 shadow-neu-inset-light dark:shadow-neu-inset-dark">
              <div
                className={`${progressBarColor} h-3 rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm mt-2">
                <div>
                    <span className="font-semibold text-light-text dark:text-dark-text">{formatCurrency(spent, 'EUR')}</span>
                    <span className="text-light-text-secondary dark:text-dark-text-secondary"> of {formatCurrency(budgeted, 'EUR')}</span>
                </div>
                <span className={`font-semibold ${remainingColor}`}>{formatCurrency(remaining, 'EUR')} {remaining >= 0 ? 'left' : 'over'}</span>
            </div>
          </>
        ) : (
          <div className="text-center bg-light-bg dark:bg-dark-bg p-4 rounded-lg">
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Spent this month</p>
            <p className="font-semibold text-2xl text-light-text dark:text-dark-text mt-1">{formatCurrency(spent, 'EUR')}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BudgetProgressCard;