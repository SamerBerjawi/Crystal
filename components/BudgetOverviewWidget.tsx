import React, { useMemo } from 'react';
import { Budget, Transaction, Category, Duration, Account } from '../types';
import { getDateRange, convertToEur, parseLocalDate } from '../utils';
import { LIQUID_ACCOUNT_TYPES } from '../constants';
import BudgetProgressBar from './BudgetProgressBar';

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
        }).sort((a, b) => b.progress - a.progress); // Show most spent budgets first
    }, [budgets, spendingByCategory]);

    if (budgetData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">
                <p>No budgets set up.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full overflow-y-auto pr-2 -mr-4">
            {budgetData.slice(0, 4).map(budget => (
                <div key={budget.id} onClick={onBudgetClick} className="cursor-pointer group hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-xl transition-colors">
                    <BudgetProgressBar
                        spent={budget.spent}
                        budgeted={budget.amount}
                        currency="EUR"
                        categoryName={budget.categoryName}
                        variant="compact"
                        showLabels={true}
                        showValues={true}
                        showPercentage={true}
                    />
                </div>
            ))}
        </div>
    );
};

export default BudgetOverviewWidget;
