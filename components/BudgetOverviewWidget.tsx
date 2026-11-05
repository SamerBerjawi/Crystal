import React, { useMemo } from 'react';
import { Budget, Transaction, Category, Duration, Account } from '../types';
import { getDateRange, convertToMain, getMainCurrency, toLocalISOString } from '../utils';
import { budgetAccountIds, spendByCategory } from '../utils/budgetModel';
import { monthsInPeriod } from '../utils/reportsModel';
import BudgetProgressBar from './BudgetProgressBar';
import { EmptyState } from './ui/States';

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
        return <EmptyState icon="pie-chart-01" title="No budgets yet" description="Set one up in Budget to track it here." actionLabel="Go to Budget" onAction={onBudgetClick} className="h-full py-6" />;
    }

    return (
        <ul className="no-scrollbar -mx-2 h-full space-y-1 overflow-y-auto">
            {budgetData.slice(0, 4).map(budget => (
                <li key={budget.id}>
                    <button
                        type="button"
                        onClick={() => (onCategoryClick ? onCategoryClick(budget.categoryName) : onBudgetClick())}
                        className="w-full rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                    >
                        <BudgetProgressBar spent={budget.spent} budgeted={budget.limit} currency={getMainCurrency()} categoryName={budget.categoryName} />
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default BudgetOverviewWidget;
