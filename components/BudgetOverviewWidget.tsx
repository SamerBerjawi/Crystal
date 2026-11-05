import React, { useMemo } from 'react';
import { Budget, Transaction, Category, Duration, Account } from '../types';
import { getDateRange, convertToMain, getMainCurrency, toLocalISOString } from '../utils';
import { budgetAccountIds, spendByCategory } from '../utils/budgetModel';
import { monthsInPeriod } from '../utils/reportsModel';
import BudgetProgressBar from './BudgetProgressBar';

interface BudgetOverviewWidgetProps {
  budgets: Budget[];
  transactions: Transaction[];
  expenseCategories: Category[];
  accounts: Account[];
  duration: Duration;
  onBudgetClick: () => void;
  onCategoryClick?: (categoryName: string) => void;
}


const BudgetOverviewWidget: React.FC<BudgetOverviewWidgetProps> = ({ budgets, transactions, expenseCategories, accounts, duration, onBudgetClick, onCategoryClick }) => {
    const { spendingByCategory, periodMonths } = useMemo(() => {
        const { start, end } = getDateRange(duration, transactions);
        const from = toLocalISOString(start);
        const to = toLocalISOString(end);
        const accountIds = budgetAccountIds(accounts);
        const map = spendByCategory(transactions, { from, to }, {
            accountIds,
            categories: expenseCategories,
            convert: convertToMain,
        });
        const spending: Record<string, number> = {};
        map.forEach((val, key) => { spending[key] = val; });

        const months = Math.max(1, monthsInPeriod(from, to));

        return { spendingByCategory: spending, periodMonths: months };
    }, [duration, transactions, expenseCategories, accounts]);

    const budgetData = useMemo(() => {
        return budgets.map(budget => {
            const spent = spendingByCategory[budget.categoryName] || 0;
            const monthlyLimit = convertToMain(budget.amount, budget.currency);
            const limit = monthlyLimit * periodMonths;
            const progress = limit > 0 ? (spent / limit) * 100 : 0;

            return {
                ...budget,
                spent,
                limit,
                progress
            };
        }).sort((a, b) => b.progress - a.progress); // Show most spent budgets first
    }, [budgets, spendingByCategory, periodMonths]);

    if (budgetData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">
                <p>No budgets set up.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 h-full overflow-y-auto pr-1">
            {budgetData.slice(0, 4).map(budget => (
                <div
                    key={budget.id}
                    onClick={() => (onCategoryClick ? onCategoryClick(budget.categoryName) : onBudgetClick())}
                    className="cursor-pointer group p-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all duration-200"
                >
                    <BudgetProgressBar
                        spent={budget.spent}
                        budgeted={budget.limit}
                        currency={getMainCurrency()}
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
