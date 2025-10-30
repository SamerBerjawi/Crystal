import React, { useState, useMemo } from 'react';
import { Account, FinancialGoal, RecurringTransaction, Transaction, WeekendAdjustment, Category, GoalProjection } from '../types';
import { BTN_PRIMARY_STYLE, LIQUID_ACCOUNT_TYPES } from '../constants';
import Card from '../components/Card';
import ForecastChart from '../components/ForecastChart';
import GoalScenarioModal from '../components/GoalScenarioModal';
import { convertToEur, formatCurrency } from '../utils';
import FinancialGoalCard from '../components/FinancialGoalCard';

interface ForecastingProps {
    accounts: Account[];
    transactions: Transaction[];
    recurringTransactions: RecurringTransaction[];
    financialGoals: FinancialGoal[];
    saveFinancialGoal: (goalData: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
    deleteFinancialGoal: (id: string) => void;
    expenseCategories: Category[];
}

const FORECAST_PERIODS = [
    { label: '3M', months: 3 },
    { label: '6M', months: 6 },
    { label: '1Y', months: 12 },
    { label: '2Y', months: 24 },
    { label: '5Y', months: 60 },
];


const adjustForWeekend = (date: Date, adjustment: WeekendAdjustment): Date => {
    const adjustedDate = new Date(date.getTime());
    const day = adjustedDate.getDay();
    if (day === 0) { // Sunday
        if (adjustment === 'before') adjustedDate.setDate(adjustedDate.getDate() - 2);
        if (adjustment === 'after') adjustedDate.setDate(adjustedDate.getDate() + 1);
    } else if (day === 6) { // Saturday
        if (adjustment === 'before') adjustedDate.setDate(adjustedDate.getDate() - 1);
        if (adjustment === 'after') adjustedDate.setDate(adjustedDate.getDate() + 2);
    }
    return adjustedDate;
};


const Forecasting: React.FC<ForecastingProps> = ({ accounts, transactions, recurringTransactions, financialGoals, saveFinancialGoal, deleteFinancialGoal, expenseCategories }) => {
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => accounts.map(a => a.id));
    const [forecastPeriodInMonths, setForecastPeriodInMonths] = useState(12);
    const [activeGoalIds, setActiveGoalIds] = useState<string[]>(() => financialGoals.map(g => g.id));
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

    const { liquidAccounts, otherAccounts } = useMemo(() => {
        const liquid: Account[] = [];
        const other: Account[] = [];
        accounts.forEach(acc => {
            if (LIQUID_ACCOUNT_TYPES.includes(acc.type)) {
                liquid.push(acc);
            } else {
                other.push(acc);
            }
        });
        return { liquidAccounts: liquid, otherAccounts: other };
    }, [accounts]);

    const handleAccountToggle = (accountId: string) => {
        setSelectedAccountIds(prev =>
            prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
        );
    };

    const handleSelectAllAccounts = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedAccountIds(e.target.checked ? accounts.map(a => a.id) : []);
    };
    
    const allAccountsSelected = accounts.length > 0 && selectedAccountIds.length === accounts.length;

    const handleGoalToggle = (goalId: string) => {
        setActiveGoalIds(prev =>
// FIX: Corrected a typo where 'id' was used instead of 'goalId' when adding a new goal to the active list.
            prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]
        );
    };
    
    const handleOpenModal = (goal: FinancialGoal | null) => {
        setEditingGoal(goal);
        setIsModalOpen(true);
    };

    const { chartData, summary, projectedGoals, lowestBalance } = useMemo(() => {
        const selectedAccounts = accounts.filter(a => selectedAccountIds.includes(a.id));
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const initialBalance = selectedAccounts.reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
        let lowestBalance = { value: initialBalance, date: today.toISOString().split('T')[0] };

        if (selectedAccounts.length === 0) {
            return { chartData: [], summary: { finalBalance: 0 }, projectedGoals: financialGoals, lowestBalance };
        }
        
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + forecastPeriodInMonths);

        const chartDataPoints: { date: string, value: number }[] = [];
        let finalBalance: number = 0;
        
        const initialActiveGoals = financialGoals.filter(g => activeGoalIds.includes(g.id));
        const goalProjections: { [goalId: string]: GoalProjection } = {};
        
        let runningBalance = initialBalance;
        let futureRecurring = JSON.parse(JSON.stringify(recurringTransactions.filter(rt => selectedAccountIds.includes(rt.accountId) || (rt.toAccountId && selectedAccountIds.includes(rt.toAccountId)))));
        
        const goalsForScenario = JSON.parse(JSON.stringify(initialActiveGoals)).map((g: any) => {
            g.runningAmount = g.currentAmount;
            if (g.type === 'recurring' && g.startDate) {
                let nextDue = new Date(g.startDate);
                if (g.dueDateOfMonth) nextDue.setDate(g.dueDateOfMonth);
                while (nextDue < today) {
                    switch(g.frequency) {
                        case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break;
                        case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break;
                        case 'yearly': nextDue.setFullYear(nextDue.getFullYear() + 1); break;
                        default: nextDue.setDate(nextDue.getDate() + 1); break;
                    }
                }
                g.nextDueDate = nextDue;
            }
            return g;
        });

        let currentDate = new Date(today);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            let dailyChange = 0;

            futureRecurring.forEach((rt: any) => {
                const nextDueDate = new Date(rt.nextDueDate);
                if (nextDueDate > endDate || (rt.endDate && nextDueDate > new Date(rt.endDate))) return;
                const adjustedDueDate = adjustForWeekend(nextDueDate, rt.weekendAdjustment);
                if (adjustedDueDate.toISOString().split('T')[0] === dateStr) {
                    const rtAmount = convertToEur(rt.amount, rt.currency);
                    if (rt.type === 'transfer') {
                        if (selectedAccountIds.includes(rt.accountId)) dailyChange -= rtAmount;
                        if (rt.toAccountId && selectedAccountIds.includes(rt.toAccountId)) dailyChange += rtAmount;
                    } else if (rt.type === 'income' && selectedAccountIds.includes(rt.accountId)) {
                        dailyChange += rtAmount;
                    } else if (rt.type === 'expense' && selectedAccountIds.includes(rt.accountId)) {
                        dailyChange -= rtAmount;
                    }
                    const currentDue = new Date(rt.nextDueDate);
                    switch(rt.frequency) {
                        case 'daily': currentDue.setDate(currentDue.getDate() + (rt.frequencyInterval || 1)); break;
                        case 'weekly': currentDue.setDate(currentDue.getDate() + 7 * (rt.frequencyInterval || 1)); break;
                        case 'monthly': currentDue.setMonth(currentDue.getMonth() + (rt.frequencyInterval || 1)); break;
                        case 'yearly': currentDue.setFullYear(currentDue.getFullYear() + (rt.frequencyInterval || 1)); break;
                    }
                    rt.nextDueDate = currentDue.toISOString().split('T')[0];
                }
            });

            goalsForScenario.forEach((goal: any) => {
                if (goal.runningAmount >= goal.amount) return;
                let contribution = 0;
                if (goal.type === 'one-time' && goal.date === dateStr) {
                    contribution = goal.amount - goal.runningAmount;
                } else if (goal.type === 'recurring' && goal.nextDueDate && goal.monthlyContribution) {
                    if (currentDate.toISOString().split('T')[0] === new Date(goal.nextDueDate).toISOString().split('T')[0]) {
                        contribution = Math.min(goal.monthlyContribution, goal.amount - goal.runningAmount);
                        const currentDue = new Date(goal.nextDueDate);
                        switch(goal.frequency) {
                            case 'weekly': currentDue.setDate(currentDue.getDate() + 7); break;
                            case 'monthly': currentDue.setMonth(currentDue.getMonth() + 1); break;
                            case 'yearly': currentDue.setFullYear(currentDue.getFullYear() + 1); break;
                            default: currentDue.setDate(currentDue.getDate() + 1); break;
                        }
                        goal.nextDueDate = currentDue;
                    }
                }
                if (contribution > 0) {
                    dailyChange -= contribution;
                    goal.runningAmount += contribution;
                    if (goal.runningAmount >= goal.amount && !goal.projectedDate) {
                        goal.projectedDate = dateStr;
                    }
                }
            });
            
            runningBalance += dailyChange;

            if (runningBalance < lowestBalance.value) {
                lowestBalance = { value: runningBalance, date: dateStr };
            }

            chartDataPoints.push({ date: dateStr, value: runningBalance });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        finalBalance = runningBalance;
        
        goalsForScenario.forEach((goal: any) => {
            const projectedDate = goal.projectedDate || 'Beyond forecast';
            let status: GoalProjection['status'] = 'on-track';
            if (projectedDate === 'Beyond forecast') {
                status = 'off-track';
            } else if (goal.date) {
                const targetDate = new Date(goal.date);
                const projDate = new Date(projectedDate);
                const diffMonths = (targetDate.getFullYear() - projDate.getFullYear()) * 12 + targetDate.getMonth() - projDate.getMonth();
                if (projDate > targetDate) status = 'off-track';
                else if (diffMonths < 3) status = 'at-risk';
            }
            goalProjections[goal.id] = { projectedDate, status };
        });

        const finalProjectedGoals = financialGoals.map(g => ({ ...g, projection: goalProjections[g.id] }));

        return {
            chartData: chartDataPoints,
            summary: { finalBalance },
            projectedGoals: finalProjectedGoals,
            lowestBalance,
        };

    }, [accounts, recurringTransactions, financialGoals, selectedAccountIds, forecastPeriodInMonths, activeGoalIds]);
    
    const oneTimeGoalsOnChart = useMemo(() => {
        return financialGoals.filter(g => activeGoalIds.includes(g.id) && g.type === 'one-time' && g.date);
    }, [financialGoals, activeGoalIds]);

    const formatDateForDisplay = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-us', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="space-y-8">
            {isModalOpen && <GoalScenarioModal onClose={() => setIsModalOpen(false)} onSave={saveFinancialGoal} goalToEdit={editingGoal} />}
            <header>
                <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">Financial Forecasting</h2>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Project your financial future based on your data.</p>
            </header>
            
            <Card className="p-6">
                <div className="flex flex-col xl:flex-row justify-between items-start gap-8">
                    {/* CONTROLS SECTION */}
                    <div className="w-full xl:max-w-md space-y-6 flex-shrink-0">
                        <div>
                            <h4 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">Forecast Period</h4>
                            <div className="bg-light-bg dark:bg-dark-bg p-1 rounded-lg flex items-center shadow-neu-inset-light dark:shadow-neu-inset-dark">
                                {FORECAST_PERIODS.map(period => (
                                    <button
                                        key={period.months}
                                        onClick={() => setForecastPeriodInMonths(period.months)}
                                        className={`flex-1 text-center py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 ${
                                            forecastPeriodInMonths === period.months
                                            ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark text-primary-600 dark:text-primary-400'
                                            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                        }`}
                                    >
                                        {period.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">Accounts to Include</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 bg-light-bg/50 dark:bg-dark-bg/50 p-3 rounded-lg border border-black/5 dark:border-white/10">
                                <label className="flex items-center gap-2 cursor-pointer font-semibold pb-2 border-b border-black/10 dark:border-white/10">
                                    <input
                                        type="checkbox"
                                        checked={allAccountsSelected}
                                        onChange={handleSelectAllAccounts}
                                        className="w-4 h-4 rounded text-primary-500 bg-transparent border-gray-400 focus:ring-primary-500"
                                    />
                                    <span>Select All</span>
                                </label>
                                <div className="pt-2">
                                    {liquidAccounts.length > 0 && (
                                        <div className="mb-2">
                                             <h5 className="px-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-1">Liquid Accounts</h5>
                                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                {liquidAccounts.map(acc => (
                                                    <label key={acc.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                        <input type="checkbox" checked={selectedAccountIds.includes(acc.id)} onChange={() => handleAccountToggle(acc.id)} className="w-4 h-4 rounded text-primary-500 bg-transparent border-gray-400 focus:ring-primary-500" />
                                                        <span className="truncate" title={acc.name}>{acc.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                     {otherAccounts.length > 0 && (
                                        <div>
                                             <h5 className="px-1 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-1">Other Assets & Liabilities</h5>
                                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                {otherAccounts.map(acc => (
                                                    <label key={acc.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                        <input type="checkbox" checked={selectedAccountIds.includes(acc.id)} onChange={() => handleAccountToggle(acc.id)} className="w-4 h-4 rounded text-primary-500 bg-transparent border-gray-400 focus:ring-primary-500" />
                                                        <span className="truncate" title={acc.name}>{acc.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STATS SECTION */}
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="p-6 rounded-xl text-white bg-gradient-to-br from-blue-400 to-purple-600">
                            <div className="flex items-center gap-2 text-white/80">
                                <span className="material-symbols-outlined text-base">trending_up</span>
                                <h4 className="text-sm font-semibold">Final Balance</h4>
                            </div>
                            <p className="text-3xl font-bold mt-1 text-white">{summary.finalBalance !== undefined ? formatCurrency(summary.finalBalance, 'EUR') : 'N/A'}</p>
                            <p className="text-xs text-white/80 mt-1">in {forecastPeriodInMonths} months</p>
                        </div>
                        <div className="p-6 rounded-xl text-white bg-gradient-to-br from-orange-400 to-red-500">
                            <div className="flex items-center gap-2 text-white/80">
                                <span className="material-symbols-outlined text-base">trending_down</span>
                                <h4 className="text-sm font-semibold">Lowest Point</h4>
                            </div>
                            <p className="text-3xl font-bold mt-1 text-white">
                                {lowestBalance !== undefined ? formatCurrency(lowestBalance.value, 'EUR') : 'N/A'}
                            </p>
                            <p className="text-xs text-white/80 mt-1">on {formatDateForDisplay(lowestBalance.date)}</p>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-3">
                    <Card className="h-full">
                        <ForecastChart data={chartData} oneTimeGoals={oneTimeGoalsOnChart} lowestPoint={lowestBalance} />
                    </Card>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-light-text dark:text-dark-text">Financial Goals</h3>
                    <button onClick={() => handleOpenModal(null)} className={BTN_PRIMARY_STYLE}>
                        Add Goal
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {projectedGoals.map(goal => (
                        <FinancialGoalCard 
                            key={goal.id} 
                            goal={goal}
                            isActive={activeGoalIds.includes(goal.id)}
                            onToggle={handleGoalToggle}
                            onEdit={handleOpenModal}
                            onDelete={deleteFinancialGoal}
                        />
                    ))}
                    {financialGoals.length === 0 && (
                        <Card className="md:col-span-2 xl:col-span-3">
                            <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                                <span className="material-symbols-outlined text-5xl mb-2">flag</span>
                                <p className="font-semibold">No financial goals set yet.</p>
                                <p className="text-sm">Click "Add Goal" to start planning your future.</p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
            
        </div>
    );
};

export default Forecasting;