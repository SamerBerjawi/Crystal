import React, { useMemo } from 'react';
import { Budget, Transaction, Category, Duration, Account } from '../types';
import { formatCurrency, getDateRange, convertToEur, parseLocalDate } from '../utils';
import { LIQUID_ACCOUNT_TYPES } from '../constants';

const findParentCategory = (categoryName: string, categories: Category[]): Category | undefined => {
    for (const parent of categories) {
      if (parent.name === categoryName) return parent;
      if (parent.subCategories.some(sub => sub.name === categoryName)) return parent;
    }
    return undefined;
};
  
interface BudgetOverviewWidgetProps {
  budgets: Budget[];
  transactions: Transaction[];
  expenseCategories: Category[];
  accounts: Account[];
  duration: Duration;
  onBudgetClick: () => void;
}


const BudgetOverviewWidget: React.FC<BudgetOverviewWidgetProps> = ({ budgets, transactions, expenseCategories, accounts, duration, onBudgetClick }) => {
    const { spendingByCategory } = useMemo(() => {
        const { start, end } = getDateRange(duration, transactions);
        const liquidAccountIds = new Set(
            accounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).map(acc => acc.id)
        );

        const relevantTransactions = transactions.filter(t => {
            const txDate = parseLocalDate(t.date);
            return txDate >= start && txDate <= end && t.type === 'expense' && !t.transferId && liquidAccountIds.has(t.accountId);
        });

        const spending: Record<string, number> = {};
        for (const tx of relevantTransactions) {
            const parentCategory = findParentCategory(tx.category, expenseCategories);
            if (parentCategory) {
                spending[parentCategory.name] = (spending[parentCategory.name] || 0) + Math.abs(convertToEur(tx.amount, tx.currency));
            }
        }
        return { spendingByCategory: spending };
    }, [duration, transactions, expenseCategories, accounts]);

    const budgetData = useMemo(() => {
        return budgets.map(budget => {
            const spent = spendingByCategory[budget.categoryName] || 0;
            const progress = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

            return {
                ...budget,
                spent,
                progress
            };
        }).sort((a, b) => b.progress - a.progress); 
    }, [budgets, spendingByCategory]);

    if (budgetData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full flex-col gap-4 py-8">
                <div className="w-16 h-16 rounded-[2rem] bg-black/5 dark:bg-white/5 flex items-center justify-center animate-pulse">
                    <span className="material-symbols-outlined text-3xl opacity-20">inventory_2</span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">No budget nodes active</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full overflow-y-auto pr-3 scrollbar-hide py-2">
            {budgetData.slice(0, 5).map(budget => {
                const remaining = budget.amount - budget.spent;

                let progressColorClass = 'text-primary-500';
                let progressBgClass = 'bg-primary-500';
                let shadowClass = 'shadow-primary-500/20';
                
                if (budget.progress > 100) {
                    progressColorClass = 'text-rose-500';
                    progressBgClass = 'bg-rose-500';
                    shadowClass = 'shadow-rose-500/20';
                } else if (budget.progress > 85) {
                    progressColorClass = 'text-amber-500';
                    progressBgClass = 'bg-amber-500';
                    shadowClass = 'shadow-amber-500/20';
                }
                
                return (
                    <div key={budget.id} onClick={onBudgetClick} className="cursor-pointer group">
                        <div className="flex justify-between items-end mb-2 px-1">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-black text-[9px] uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 group-hover:opacity-100 transition-opacity">
                                    Budget Node: {budget.categoryName}
                                </span>
                                <span className="text-[8px] font-black font-mono tracking-tighter opacity-30 uppercase tracking-[0.1em]">
                                    Delta: {formatCurrency(Math.abs(remaining), 'EUR')} {remaining >= 0 ? 'Surplus' : 'Deficit'}
                                </span>
                            </div>
                            <span className={`text-base font-black font-mono tracking-tighter ${progressColorClass}`}>
                                {budget.progress.toFixed(0)}%
                            </span>
                        </div>
                        
                        <div className="relative h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5">
                            <div
                                className={`${progressBgClass} h-full rounded-full transition-all duration-1000 ease-out shadow-lg ${shadowClass}`}
                                style={{ width: `${Math.min(budget.progress, 100)}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between px-1 mt-2">
                             <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-80 transition-opacity">
                                <div className={`w-1 h-1 rounded-full ${progressBgClass}`}></div>
                                <span className="text-[9px] font-black font-mono">{formatCurrency(budget.spent, 'EUR')} Utilized</span>
                             </div>
                             <span className="text-[9px] font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-20 uppercase">Core Asset Flow</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default BudgetOverviewWidget;
