import React from 'react';
import { Budget, Category, Transaction, Currency } from '../types';
import { formatCurrency, convertToEur } from '../utils';
import Icon from './ui/Icon';
import BudgetProgressCard from './BudgetProgressCard';
import PullToRefresh from './PullToRefresh';
import FloatingActionButton from './FloatingActionButton';

interface MobileBudgetViewProps {
  budgets: Budget[];
  transactions: Transaction[];
  expenseCategories: Category[];
  totalBudgeted: number;
  totalSpent: number;
  onAddBudget: () => void;
  onEditBudget: (budget: Budget) => void;
  onDeleteBudget: (id: string) => void;
  preferredCurrency?: string;
  onRefreshData?: () => Promise<void>;
}

export const MobileBudgetView: React.FC<MobileBudgetViewProps> = ({
  budgets,
  transactions,
  expenseCategories,
  totalBudgeted,
  totalSpent,
  onAddBudget,
  onEditBudget,
  onDeleteBudget,
  preferredCurrency = 'EUR',
  onRefreshData,
}) => {
  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onRefreshData) {
      await onRefreshData();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const spentPercent = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;
  const remaining = totalBudgeted - totalSpent;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-5 pb-24 animate-fade-in md:hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Spending Limits
            </p>
            <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
              Budgets
            </h1>
          </div>

          <button
            onClick={onAddBudget}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/25 flex items-center justify-center active:scale-95 touch-feedback transition-all"
            aria-label="Add Budget"
          >
            <Icon name="add" className="text-2xl" />
          </button>
        </div>

        {/* Hero Budget Card */}
        <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl border border-purple-500/20">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between text-xs text-purple-200/70 font-bold uppercase tracking-wider">
              <span>Overall Monthly Budget</span>
              <span>{preferredCurrency}</span>
            </div>

            <div>
              <p className="text-xs font-semibold text-white/60">Total Budgeted</p>
              <h2 className="text-3xl font-black tracking-tight text-white privacy-blur">
                {formatCurrency(totalBudgeted, curr)}
              </h2>
            </div>

            {/* Overall Progress bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    spentPercent > 90
                      ? 'bg-rose-500'
                      : spentPercent > 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${spentPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-white/70">
                  Spent: <span className="privacy-blur text-white">{formatCurrency(totalSpent, curr)}</span> ({spentPercent.toFixed(0)}%)
                </span>
                <span className={remaining < 0 ? 'text-rose-400 font-black' : 'text-emerald-400'}>
                  {remaining < 0 ? 'Over: ' : 'Left: '}
                  <span className="privacy-blur">{formatCurrency(Math.abs(remaining), curr)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Budget Cards Stack */}
        <div className="space-y-3">
          {budgets.map((b) => {
            const cat: Category = expenseCategories.find((c) => c.name === b.categoryName) || {
              id: b.id,
              name: b.categoryName,
              color: '#a855f7',
              icon: 'pie_chart',
              classification: 'expense',
              subCategories: [],
            };

            // Calculate spent for this category
            const spentForCat = transactions
              .filter((t) => t.type === 'expense' && t.category === b.categoryName)
              .reduce((sum, t) => sum + convertToEur(Math.abs(t.amount), t.currency), 0);

            return (
              <div key={b.id} onClick={() => onEditBudget(b)} className="touch-feedback cursor-pointer">
                <BudgetProgressCard
                  category={cat}
                  budgeted={b.amount}
                  spent={spentForCat}
                  onEdit={() => onEditBudget(b)}
                />
              </div>
            );
          })}

          {budgets.length === 0 && (
            <div className="text-center py-12 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 p-6">
              <Icon name="pie_chart" className="text-4xl text-gray-400 mb-2" />
              <p className="text-sm font-bold text-light-text dark:text-white">No active budgets</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                Create category budgets to stay on top of your monthly spending.
              </p>
              <button
                onClick={onAddBudget}
                className="mt-4 px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold shadow-md touch-feedback"
              >
                Create Budget
              </button>
            </div>
          )}
        </div>

        <FloatingActionButton onClick={onAddBudget} label="Add Budget" />
      </div>
    </PullToRefresh>
  );
};
