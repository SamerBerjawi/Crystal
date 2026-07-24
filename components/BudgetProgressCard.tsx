
import React from 'react';
import { Category } from '../types';
import Card from './Card';
import BudgetProgressBar from './BudgetProgressBar';

interface BudgetProgressCardProps {
  category: Category;
  budgeted: number;
  spent: number;
  onEdit: () => void;
}

const BudgetProgressCard: React.FC<BudgetProgressCardProps> = ({ category, budgeted, spent, onEdit }) => {
  const hasBudget = budgeted > 0;

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
            <h4 className="font-bold text-[13px] tracking-tight text-light-text dark:text-dark-text leading-none mb-1">{category.name}</h4>
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
      
      {/* Visual Budget Progress Bar */}
      <div className="relative z-10 pt-1">
        {hasBudget ? (
          <BudgetProgressBar
            spent={spent}
            budgeted={budgeted}
            currency="EUR"
            categoryName={category.name}
            categoryColor={category.color}
            showLabels={true}
            showValues={true}
            showPercentage={true}
            showThresholdTicks={true}
          />
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
