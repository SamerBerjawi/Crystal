
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ContributionPlanStep,
  Account,
  RecurringTransaction,
  FinancialGoal,
  RecurringTransactionOverride,
  LoanPaymentOverrides,
  BillPayment,
  ForecastDuration,
  Currency,
  GoalCategory,
} from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, CHECKBOX_STYLE, FORECAST_DURATION_OPTIONS } from '../constants';
import { calculateForecastHorizon, formatCurrency, convertToEur, generateBalanceForecast, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseLocalDate, getPreferredTimeZone, generateSyntheticPropertyTransactions, toLocalISOString, toLocalISOYearMonth } from '../utils';
import Card from '../components/Card';
import MultiAccountFilter from '../components/MultiAccountFilter';
import FinancialGoalCard from '../components/FinancialGoalCard';
import GoalScenarioModal from '../components/GoalScenarioModal';
import ForecastChart from '../components/ForecastChart';
import GoalContributionPlan from '../components/GoalContributionPlan';
import ConfirmationModal from '../components/ConfirmationModal';
import ForecastDayModal from '../components/ForecastDayModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import BillPaymentModal from '../components/BillPaymentModal';
import ForecastOverview from '../components/ForecastOverview';
import GoalTable from '../components/GoalTable';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';
import PageHeader from '../components/PageHeader';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CACHE_KEYS = {
  PREDICTIVE_INSIGHTS: 'crystal_forecasting_insights'
};

const MetricCard: React.FC<{ title: string; value: string; subValue?: string; icon: string; colorClass: string; trend?: 'up' | 'down' | 'neutral' }> = ({ title, value, subValue, icon, colorClass, trend }) => (
    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full relative overflow-hidden group">
        <div className="flex justify-between items-start mb-3 relative z-10">
            <span className="text-[11px] font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary uppercase">{title}</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass} bg-opacity-10 dark:bg-opacity-20 group-hover:scale-110 transition-transform duration-300`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
            </div>
        </div>
        <div className="relative z-10">
            <p className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter">{value}</p>
            {subValue && (
                <div className="flex items-center gap-1 mt-1">
                     {trend === 'up' && <span className="material-symbols-outlined text-xs text-green-500 font-bold">trending_up</span>}
                     {trend === 'down' && <span className="material-symbols-outlined text-xs text-red-500 font-bold">trending_down</span>}
                     <p className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-90">{subValue}</p>
                </div>
            )}
        </div>
    </div>
);

const Forecasting: React.FC = () => {
  const { activeGoalIds, setActiveGoalIds } = useInsightsView();
  const { accounts } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  
  const { financialGoals, goalOrder, setGoalOrder, saveFinancialGoal, deleteFinancialGoal } = useGoalsContext();
  const { expenseCategories, incomeCategories } = useCategoryContext();
  const {
    recurringTransactions,
    recurringTransactionOverrides,
    loanPaymentOverrides,
    billsAndPayments,
    saveRecurringTransaction,
    deleteRecurringTransaction,
    saveBillPayment,
    deleteBillPayment,
  } = useScheduleContext();
    const { preferences } = usePreferencesContext();
    const timeZone = getPreferredTimeZone();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
    const [parentIdForNewGoal, setParentIdForNewGoal] = useState<string | undefined>();
    const [deletingGoal, setDeletingGoal] = useState<FinancialGoal | null>(null);

    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [scheduleMode, setScheduleMode] = useState<'account' | 'date'>('account');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // State for interactivity
    const [selectedForecastDate, setSelectedForecastDate] = useState<string | null>(null);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
    const [editingBill, setEditingBill] = useState<BillPayment | null>(null);

    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
        const primaryAccount = accounts.find(a => a.isPrimary);
        if (primaryAccount) {
            return [primaryAccount.id];
        }
        return accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type)).map(a => a.id)
    });
    const [forecastDuration, setForecastDuration] = useState<ForecastDuration>(preferences.defaultForecastPeriod || '1Y');
    const [filterGoalsByAccount, setFilterGoalsByAccount] = useState(false);
    const [showIndividualLines, setShowIndividualLines] = useState(false);
    const [showGoalLines, setShowGoalLines] = useState(true);
    
    // --- Global Assumptions State ---
    const [assumptions, setAssumptions] = useState({
        savingsRateAdjustment: 0, // % adjustment to recurring savings
        marketReturn: 0, // % annual return for investment accounts
        inflationRate: 0, // % annual inflation
    });
    const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);

    useEffect(() => {
        setForecastDuration(preferences.defaultForecastPeriod || '1Y');
    }, [preferences.defaultForecastPeriod]);
    
    const selectedAccounts = useMemo(() => 
      accounts.filter(a => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds]);

    const activeGoals = useMemo(() => {
        let goals = financialGoals.filter(g => activeGoalIds.includes(g.id));
        if (filterGoalsByAccount) {
             goals = goals.filter(g => 
                !g.paymentAccountId || 
                selectedAccountIds.includes(g.paymentAccountId)
            );
        }
        return goals;
    }, [financialGoals, activeGoalIds, filterGoalsByAccount, selectedAccountIds]);
    
    const { allRecurringItems } = useMemo(() => {
        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        
        const all = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];
        return { allRecurringItems: all };
    }, [accounts, transactions, loanPaymentOverrides, recurringTransactions]);

    const fullForecast = useMemo(() => {
        const projectionEndDate = new Date();
        projectionEndDate.setMonth(projectionEndDate.getMonth() + 24);

        return generateBalanceForecast(
            selectedAccounts,
            allRecurringItems,
            activeGoals,
            billsAndPayments,
            projectionEndDate,
            recurringTransactionOverrides,
            assumptions
        );
    }, [selectedAccounts, allRecurringItems, activeGoals, billsAndPayments, recurringTransactionOverrides, assumptions]);

    const lowestBalanceForecasts = useMemo(() => {
        return calculateForecastHorizon(fullForecast.chartData);
    }, [fullForecast]);

    const { forecastData, tableData, lowestPoint, goalsWithProjections, startBalance, endBalance, combinedChartData } = useMemo(() => {
        const { chartData, tableData, lowestPoint } = fullForecast;
        
        const startBalanceValue = chartData.length > 0 ? chartData[0].value : 0;

        // Generate per-account forecasts for accurate projection calculation based on goal account assignment
        const projectionEndDate = new Date();
        projectionEndDate.setMonth(projectionEndDate.getMonth() + 24);

        const perAccountForecasts = accounts.reduce((acc, account) => {
            const accountForecast = generateBalanceForecast(
                [account],
                allRecurringItems,
                activeGoals,
                billsAndPayments,
                projectionEndDate,
                recurringTransactionOverrides,
                assumptions
            );
            acc[account.id] = accountForecast.chartData;
            return acc;
        }, {} as Record<string, typeof chartData>);
        
        const goalsWithProjections = financialGoals.map(goal => {
            if (goal.isBucket) return { ...goal, projection: undefined };
            
            const goalDate = goal.date ? parseLocalDate(goal.date) : null;
            let projectedDate = 'Beyond forecast';
            let status: 'on-track' | 'at-risk' | 'off-track' = 'off-track';

            const category = goal.goalCategory || (goal.transactionType === 'income' ? 'income' : 'savings');
            const isSavings = category === 'savings';
            const isIncome = category === 'income';
            const isExpense = category === 'expense';
            const remainingToTarget = goal.amount - goal.currentAmount;

            // Use the specific account's start balance and forecast if assigned
            const targetAccountId = goal.paymentAccountId;
            const targetAccount = targetAccountId ? accounts.find(a => a.id === targetAccountId) : null;
            
            // Current liquid balance for the projection reference
            // If goal is linked to an account, use THAT account's balance
            // Otherwise, use the total start balance of the currently selected accounts (current behavior for unlinked)
            const referenceStartBalance = targetAccount 
                ? convertToEur(targetAccount.balance, targetAccount.currency)
                : startBalanceValue;

            const referenceChartData = (targetAccountId && perAccountForecasts[targetAccountId]) 
                ? perAccountForecasts[targetAccountId] 
                : chartData;

            // 1. Check if target already reached / Ready to execute
            if (isSavings) {
                if (referenceStartBalance >= goal.amount) {
                    projectedDate = 'Goal reached';
                    status = 'on-track';
                    return { ...goal, projection: { projectedDate, status } };
                }
            } else if (isExpense) {
                if (remainingToTarget <= 0) {
                    projectedDate = 'Goal reached';
                    status = 'on-track';
                    return { ...goal, projection: { projectedDate, status } };
                } else if (referenceStartBalance >= remainingToTarget) {
                    // Ready to spend today (funded)
                    projectedDate = toLocalISOString(new Date());
                    status = 'on-track';
                }
            } else {
                // Income
                if (remainingToTarget <= 0) {
                    projectedDate = 'Goal reached';
                    status = 'on-track';
                    return { ...goal, projection: { projectedDate, status } };
                } else if (referenceStartBalance >= goal.amount) {
                    // If balance exceeds target amount, we consider it "funded" or on-track
                    projectedDate = toLocalISOString(new Date());
                    status = 'on-track';
                }
            }

            // 2. Check forecast with monthly contributions integration
            if (goal.monthlyContribution && goal.monthlyContribution > 0) {
                const monthsToGoal = Math.max(0, remainingToTarget) / goal.monthlyContribution;
                const estimatedDate = new Date();
                estimatedDate.setMonth(estimatedDate.getMonth() + Math.ceil(monthsToGoal));
                const estimatedDateStr = toLocalISOString(estimatedDate);
                
                if (projectedDate === 'Beyond forecast' || parseLocalDate(estimatedDateStr) < parseLocalDate(projectedDate)) {
                    projectedDate = estimatedDateStr;
                }
            }

            // 3. Fallback: Check when portfolio balance reaches target/funding level
            const targetBalanceNeeded = isSavings 
                ? goal.amount 
                : (isExpense 
                    ? Math.max(0, goal.amount - goal.currentAmount)
                    : goal.amount); // For income, reach target balance as fallback

            for (const point of referenceChartData) {
                if (point.value >= targetBalanceNeeded) {
                    const forecastProjDate = point.date;
                    if (projectedDate === 'Beyond forecast' || parseLocalDate(forecastProjDate) < parseLocalDate(projectedDate)) {
                        projectedDate = forecastProjDate;
                    }
                    break;
                }
            }

            // 4. Status normalization
            if (goalDate && projectedDate !== 'Beyond forecast' && projectedDate !== 'Goal reached') {
                const projDate = parseLocalDate(projectedDate);
                if (projDate <= goalDate) {
                    status = 'on-track';
                } else {
                    const diffDays = (projDate.getTime() - goalDate.getTime()) / (1000 * 3600 * 24);
                    status = diffDays <= 60 ? 'at-risk' : 'off-track';
                }
            } else if (projectedDate === 'Goal reached') {
                status = 'on-track';
            } else if (goalDate && projectedDate === 'Beyond forecast') {
                status = 'off-track';
            }

            return { ...goal, projection: { projectedDate, status } };
        });

        const endDate = new Date();
        switch (forecastDuration) {
            case '3M': endDate.setMonth(endDate.getMonth() + 3); break;
            case '6M': endDate.setMonth(endDate.getMonth() + 6); break;
            case 'EOY': endDate.setFullYear(endDate.getFullYear(), 11, 31); break;
            case '1Y': endDate.setFullYear(endDate.getFullYear() + 1); break;
        }

        const forecastDataForPeriod = chartData.filter(d => parseLocalDate(d.date) <= endDate);
        const tableDataForPeriod = tableData.filter(d => parseLocalDate(d.date) <= endDate);

        let lowestPointInPeriod = { value: Infinity, date: '' };
        if (forecastDataForPeriod.length > 0) {
            lowestPointInPeriod = forecastDataForPeriod.reduce((min, p) => p.value < min.value ? { value: p.value, date: p.date } : min, { value: forecastDataForPeriod[0].value, date: forecastDataForPeriod[0].date });
        }
        
        const periodStartBalance = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[0].value : 0;
        const periodEndBalance = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[forecastDataForPeriod.length - 1].value : 0;

        const historyData: typeof forecastDataForPeriod = [];
        let runningAccountBalances = selectedAccounts.reduce((acc, a) => {
            acc[a.id] = convertToEur(a.balance, a.currency);
            return acc;
        }, {} as Record<string, number>);
        const today = new Date();
        const todayStr = toLocalISOString(today);

        const txsByDateAndAccount = new Map<string, Map<string, number>>();
        transactions.forEach(tx => {
             if (!selectedAccountIds.includes(tx.accountId)) return;
             const d = tx.date;
             if (!txsByDateAndAccount.has(d)) txsByDateAndAccount.set(d, new Map());
             const accMap = txsByDateAndAccount.get(d)!;
             accMap.set(tx.accountId, (accMap.get(tx.accountId) || 0) + convertToEur(tx.amount, tx.currency));
        });

        for (let i = 0; i <= 10; i++) {
             const d = new Date(today);
             d.setDate(d.getDate() - i);
             const dateStr = toLocalISOString(d);
             
             if (dateStr === todayStr) continue; 
             
             const dateForChangeLookup = new Date(today);
             dateForChangeLookup.setDate(today.getDate() - i);
             const lookupDateStr = toLocalISOString(dateForChangeLookup);
             
             const dayChanges = txsByDateAndAccount.get(lookupDateStr);
             if (dayChanges) {
                 dayChanges.forEach((amt, accId) => {
                     runningAccountBalances[accId] = (runningAccountBalances[accId] || 0) - amt;
                 });
             }
             
             const dPrev = new Date(d);
             dPrev.setDate(d.getDate() - 1);
             
             historyData.push({ 
                 date: toLocalISOString(dPrev), 
                 value: Object.values(runningAccountBalances).reduce((a, b) => a + b, 0),
                 ...runningAccountBalances,
                 dailySummary: [], 
                 isHistory: true
            });
        }
        
        const sortedHistory = historyData.reverse();
        const combinedChartData = [...sortedHistory, ...forecastDataForPeriod];

        return { 
            forecastData: forecastDataForPeriod, 
            tableData: tableDataForPeriod, 
            lowestPoint: lowestPointInPeriod, 
            goalsWithProjections,
            startBalance: periodStartBalance,
            endBalance: periodEndBalance,
            combinedChartData
        };
    }, [fullForecast, financialGoals, forecastDuration, transactions, selectedAccountIds]);
    
    const { globalIncomeGoalTarget, globalIncomeGoalCurrent, globalSavingsGoalTarget, globalSavingsGoalCurrent, globalExpenseGoalTarget, globalExpenseGoalCurrent, globalAccountBreakdown, monthlyPaymentBreakdown, monthlyDateBreakdown } = useMemo(() => {
        let incTarget = 0, incCurrent = 0, savTarget = 0, savCurrent = 0, expTarget = 0, expCurrent = 0;
        const accountGroups: Record<string, { 
            id: string; 
            name: string; 
            income: { current: number; target: number };
            savings: { current: number; target: number };
            expense: { current: number; target: number };
            currency: Currency;
        }> = {};

        const monthlyAccountAggregates: Record<string, { 
            id: string; 
            name: string; 
            currency: Currency;
            months: Record<string, { income: number; savings: number; expense: number }>;
        }> = {};

        financialGoals.forEach(g => {
            if (g.isBucket) return;
            const category = g.goalCategory || (g.transactionType === 'income' ? 'income' : 'savings');

            // Global totals
            if (category === 'income') {
                incTarget += g.amount;
                incCurrent += g.currentAmount;
            } else if (category === 'expense') {
                expTarget += g.amount;
                expCurrent += g.currentAmount;
            } else {
                savTarget += g.amount;
                savCurrent += g.currentAmount;
            }

            // Global account summary grouping
            const accId = g.paymentAccountId || 'unlinked';
            if (!accountGroups[accId]) {
                 const acc = accounts.find(a => a.id === accId);
                 accountGroups[accId] = {
                     id: accId,
                     name: acc ? acc.name : 'Unassigned Account',
                     income: { current: 0, target: 0 },
                     savings: { current: 0, target: 0 },
                     expense: { current: 0, target: 0 },
                     currency: acc?.currency || 'EUR'
                 };
            }
            
            if (category === 'income') {
                accountGroups[accId].income.current += g.currentAmount;
                accountGroups[accId].income.target += g.amount;
            } else if (category === 'expense') {
                accountGroups[accId].expense.current += g.currentAmount;
                accountGroups[accId].expense.target += g.amount;
            } else {
                accountGroups[accId].savings.current += g.currentAmount;
                accountGroups[accId].savings.target += g.amount;
            }

            const remaining = g.amount - g.currentAmount;
            if (remaining <= 0) return;

            if (!monthlyAccountAggregates[accId]) {
                const acc = accounts.find(a => a.id === accId);
                monthlyAccountAggregates[accId] = {
                    id: accId,
                    name: acc ? acc.name : 'Unassigned Account',
                    currency: acc?.currency || 'EUR',
                    months: {}
                };
            }

            const addAmount = (mKey: string, amt: number) => {
                if (!monthlyAccountAggregates[accId].months[mKey]) {
                    monthlyAccountAggregates[accId].months[mKey] = { income: 0, savings: 0, expense: 0 };
                }
                if (category === 'income') monthlyAccountAggregates[accId].months[mKey].income += amt;
                else if (category === 'expense') monthlyAccountAggregates[accId].months[mKey].expense += amt;
                else monthlyAccountAggregates[accId].months[mKey].savings += amt;
            };

            // Group by target month
            if (g.date) {
                const dateObj = parseLocalDate(g.date);
                const monthKey = toLocalISOYearMonth(dateObj);
                addAmount(monthKey, remaining);
            } else if (g.frequency === 'monthly' || g.monthlyContribution) {
                const contribution = Number(g.monthlyContribution || 0);
                if (contribution > 0) {
                    const today = new Date();
                    for (let i = 0; i < 6; i++) {
                        const m = new Date(today.getFullYear(), today.getMonth() + i, 1);
                        const monthKey = toLocalISOYearMonth(m);
                        addAmount(monthKey, contribution);
                    }
                }
            }
        });

        const outputAggregates = Object.values(monthlyAccountAggregates).map(acc => {
            const sortedMonthKeys = Object.keys(acc.months).sort();
            const sortedMonths: Record<string, { income: number; savings: number; expense: number }> = {};
            sortedMonthKeys.forEach(k => { sortedMonths[k] = acc.months[k]; });
            return { ...acc, months: sortedMonths };
        });

        // Derive Date Breakdown
        const dateMap: Record<string, Array<{ id: string; name: string; currency: Currency; income: number; savings: number; expense: number }>> = {};
        Object.values(monthlyAccountAggregates).forEach(acc => {
            Object.entries(acc.months).forEach(([monthKey, breakdown]) => {
                if (!dateMap[monthKey]) dateMap[monthKey] = [];
                dateMap[monthKey].push({
                    id: acc.id,
                    name: acc.name,
                    currency: acc.currency,
                    ...breakdown
                });
            });
        });

        const monthlyDateBreakdown = Object.entries(dateMap).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, items]) => ({
            monthKey,
            monthName: new Date(monthKey + '-02').toLocaleDateString('default', { month: 'long', year: 'numeric' }),
            accounts: items.sort((a,b) => a.name.localeCompare(b.name))
        }));

        return { 
            globalIncomeGoalTarget: incTarget, 
            globalIncomeGoalCurrent: incCurrent, 
            globalSavingsGoalTarget: savTarget, 
            globalSavingsGoalCurrent: savCurrent,
            globalExpenseGoalTarget: expTarget,
            globalExpenseGoalCurrent: expCurrent,
            globalAccountBreakdown: Object.values(accountGroups).sort((a, b) => a.name.localeCompare(b.name)),
            monthlyPaymentBreakdown: outputAggregates.sort((a, b) => a.name.localeCompare(b.name)),
            monthlyDateBreakdown
        };
    }, [financialGoals, accounts]);

    const { totalIncomeGoalTarget, totalIncomeGoalCurrent, totalSavingsGoalTarget, totalSavingsGoalCurrent, totalExpenseGoalTarget, totalExpenseGoalCurrent, accountGoalSummary } = useMemo(() => {
        let incTarget = 0, incCurrent = 0, savTarget = 0, savCurrent = 0, expTarget = 0, expCurrent = 0;
        const summary: Record<string, { id: string; name: string; current: number; target: number; currency: Currency; goalsCount: number; type: GoalCategory }> = {};

        goalsWithProjections.forEach(g => {
            if (g.isBucket) return;
            const isVisible = !filterGoalsByAccount || !g.paymentAccountId || selectedAccountIds.includes(g.paymentAccountId);
            if (!isVisible) return;

            const category = g.goalCategory || (g.transactionType === 'income' ? 'income' : 'savings');

            if (category === 'income') {
                incTarget += g.amount;
                incCurrent += g.currentAmount;
            } else if (category === 'expense') {
                expTarget += g.amount;
                expCurrent += g.currentAmount;
            } else {
                savTarget += g.amount;
                savCurrent += g.currentAmount;
            }

            const accId = g.paymentAccountId || 'unlinked';
            const key = `${accId}_${category}`;

            if (!summary[key]) {
                 const acc = accounts.find(a => a.id === accId);
                 summary[key] = {
                     id: key,
                     name: acc ? acc.name : 'General (Unlinked)',
                     current: 0,
                     target: 0,
                     currency: acc?.currency || 'EUR',
                     goalsCount: 0,
                     type: category
                 };
            }
            summary[key].current += g.currentAmount;
            summary[key].target += g.amount;
            summary[key].goalsCount += 1;
        });
        return { 
            totalIncomeGoalTarget: incTarget, 
            totalIncomeGoalCurrent: incCurrent, 
            totalSavingsGoalTarget: savTarget, 
            totalSavingsGoalCurrent: savCurrent,
            totalExpenseGoalTarget: expTarget,
            totalExpenseGoalCurrent: expCurrent,
            accountGoalSummary: Object.values(summary).sort((a, b) => a.name.localeCompare(b.name))
        };
    }, [goalsWithProjections, filterGoalsByAccount, selectedAccountIds, accounts]);

    const plannerGoals = useMemo(() => {
        return goalsWithProjections.filter(g => {
            if (!activeGoalIds.includes(g.id)) return false;
            if (filterGoalsByAccount) {
                return !g.paymentAccountId || selectedAccountIds.includes(g.paymentAccountId);
            }
            return true;
        });
    }, [goalsWithProjections, activeGoalIds, filterGoalsByAccount, selectedAccountIds]);

    const handleToggleGoal = (id: string) => {
        const goal = financialGoals.find(g => g.id === id);
        if (!goal) return;
        const subGoalIds = goal.isBucket ? financialGoals.filter(g => g.parentId === id).map(g => g.id) : [];
        const allRelatedIds = [id, ...subGoalIds];
        
        setActiveGoalIds(prev => {
        const isGroupActive = allRelatedIds.some(relatedId => prev.includes(relatedId));
        if (isGroupActive) {
            return prev.filter(activeId => !allRelatedIds.includes(activeId));
        } else {
            return [...new Set([...prev, ...allRelatedIds])];
        }
        });
    };

    const handleOpenModal = (goal?: FinancialGoal) => {
        setEditingGoal(goal || null);
        setParentIdForNewGoal(undefined);
        setIsModalOpen(true);
    };

    const handleAddSubGoal = (parentId: string) => {
        setEditingGoal(null);
        setParentIdForNewGoal(parentId);
        setIsModalOpen(true);
    };

    const handleDuplicateGoal = (goal: FinancialGoal) => {
        const { id, ...rest } = goal;
        const duplicatedGoal: Omit<FinancialGoal, 'id'> = {
            ...rest,
            name: `${goal.name} (Copy)`
        };
        saveFinancialGoal(duplicatedGoal);
    };
    
    const handleDeleteClick = (goalId: string) => {
        const goal = financialGoals.find(g => g.id === goalId);
        if (goal) setDeletingGoal(goal);
    };

    const handleConfirmDelete = () => {
        if (deletingGoal) {
            deleteFinancialGoal(deletingGoal.id);
            setDeletingGoal(null);
        }
    };

    const subGoalsOfDeleting = useMemo(() => {
        if (!deletingGoal || !deletingGoal.isBucket) return [];
        return financialGoals.filter(g => g.parentId === deletingGoal.id);
    }, [deletingGoal, financialGoals]);

    const { topLevelGoals, goalsByParentId, displayedGoals } = useMemo(() => {
        const visibleGoals = goalsWithProjections.filter(g => 
            !filterGoalsByAccount || 
            !g.paymentAccountId || 
            selectedAccountIds.includes(g.paymentAccountId)
        );

        let topLevel: FinancialGoal[] = [];
        const byParent = new Map<string, FinancialGoal[]>();
        
        visibleGoals.forEach(g => {
            if (g.parentId) {
                if (!byParent.has(g.parentId)) {
                    byParent.set(g.parentId, []);
                }
                byParent.get(g.parentId)!.push(g);
            } else {
                topLevel.push(g);
            }
        });

        // Apply ordering if available
        if (goalOrder && goalOrder.length > 0) {
            topLevel.sort((a, b) => {
                const idxA = goalOrder.indexOf(a.id);
                const idxB = goalOrder.indexOf(b.id);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
        }

        return { topLevelGoals: topLevel, goalsByParentId: byParent, displayedGoals: visibleGoals };
    }, [goalsWithProjections, filterGoalsByAccount, selectedAccountIds, goalOrder]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = topLevelGoals.findIndex((g) => g.id === active.id);
            const newIndex = topLevelGoals.findIndex((g) => g.id === over.id);
            const newOrder = arrayMove(topLevelGoals.map(g => g.id), oldIndex, newIndex);
            
            // Handle merging with existing goalOrder if it contains non-visible goals
            const baseOrder = goalOrder || [];
            const otherIds = baseOrder.filter(id => !topLevelGoals.some(g => g.id === id));
            setGoalOrder([...newOrder, ...otherIds]);
        }
    };

    const SortableGoal = ({ goal, subGoals, isActive, accounts }: { goal: FinancialGoal; subGoals: FinancialGoal[]; isActive: boolean; accounts: Account[] }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({ id: goal.id });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            zIndex: isDragging ? 50 : undefined,
            opacity: isDragging ? 0.5 : 1,
        };

        return (
            <div ref={setNodeRef} style={style}>
                 <div className="relative group/drag">
                    {goal.isBucket && (
                        <div {...attributes} {...listeners} className="absolute -top-2 -left-2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-center opacity-0 group-hover/drag:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
                            <span className="material-symbols-outlined text-sm text-gray-400">drag_indicator</span>
                        </div>
                    )}
                    <FinancialGoalCard
                        goal={goal}
                        subGoals={subGoals}
                        isActive={isActive}
                        onToggle={handleToggleGoal}
                        onEdit={handleOpenModal}
                        onDuplicate={handleDuplicateGoal}
                        onDelete={handleDeleteClick}
                        onAddSubGoal={handleAddSubGoal}
                        accounts={accounts}
                    />
                 </div>
            </div>
        );
    };

    const handleDateClick = (date: string) => {
        setSelectedForecastDate(date);
    };

    const selectedDayItems = useMemo(() => {
        if (!selectedForecastDate) return [];
        return tableData.filter(item => item.date === selectedForecastDate);
    }, [selectedForecastDate, tableData]);

    const handleEditForecastItem = (item: any) => {
        setSelectedForecastDate(null);
        if (item.type === 'Financial Goal') {
             handleOpenModal(item.originalItem);
        } else if (item.type === 'Recurring') {
             setEditingRecurring(item.originalItem);
             setIsRecurringModalOpen(true);
        } else if (item.type === 'Bill/Payment') {
             setEditingBill(item.originalItem);
             setIsBillModalOpen(true);
        }
    };

    const handleAddNewToDate = () => {
        setEditingRecurring(null);
        setIsRecurringModalOpen(true);
    };

    const durationOptions = FORECAST_DURATION_OPTIONS;
    const segmentItemBase = "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center whitespace-nowrap";
    const segmentItemActive = "bg-light-card dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400 font-semibold border border-black/5 dark:border-white/10";
    const segmentItemInactive = "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text";

    const netChange = endBalance - startBalance;
    
    // Separate stats per category
    const incomeProgress = totalIncomeGoalTarget > 0 ? (totalIncomeGoalCurrent / totalIncomeGoalTarget) * 100 : 0;
    const expenseProgress = totalExpenseGoalTarget > 0 ? (totalExpenseGoalCurrent / totalExpenseGoalTarget) * 100 : 0;
    const savingsProgress = totalSavingsGoalTarget > 0 ? (totalSavingsGoalCurrent / totalSavingsGoalTarget) * 100 : 0;
    
    const goalProgress = (totalIncomeGoalTarget + totalSavingsGoalTarget + totalExpenseGoalTarget) > 0 
        ? ((totalIncomeGoalCurrent + totalSavingsGoalCurrent + totalExpenseGoalCurrent) / (totalIncomeGoalTarget + totalSavingsGoalTarget + totalExpenseGoalTarget)) * 100 
        : 0;
        
    const totalGoalSaved = totalIncomeGoalCurrent + totalSavingsGoalCurrent + totalExpenseGoalCurrent;
    const totalGoalTarget = totalIncomeGoalTarget + totalSavingsGoalTarget + totalExpenseGoalTarget;
    const hasForecastData = forecastData.length > 0;

    useEffect(() => {
        if (accounts.length === 0) return;
        setSelectedAccountIds(prev => {
            const validIds = prev.filter(id => accounts.some(account => account.id === id));
            if (validIds.length > 0) return validIds;
            const primaryAccount = accounts.find(a => a.isPrimary);
            if (primaryAccount) return [primaryAccount.id];
            return accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type)).map(a => a.id);
        });
    }, [accounts]);

    const areAllDisplayedSelected = useMemo(() => {
        if (displayedGoals.length === 0) return false;
        return displayedGoals.every(g => activeGoalIds.includes(g.id));
    }, [displayedGoals, activeGoalIds]);

    const handleToggleAllDisplayed = () => {
        if (areAllDisplayedSelected) {
            const visibleIds = new Set(displayedGoals.map(g => g.id));
            setActiveGoalIds(prev => prev.filter(id => !visibleIds.has(id)));
        } else {
            const visibleIds = displayedGoals.map(g => g.id);
            setActiveGoalIds(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const groupedTableData = useMemo(() => {
        const monthGroups: Record<string, typeof tableData> = {};
        
        tableData.forEach(row => {
            const date = parseLocalDate(row.date);
            const monthKey = toLocalISOYearMonth(date);
            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = [];
            }
            monthGroups[monthKey].push(row);
        });

        return Object.keys(monthGroups).sort().map(key => {
            const [year, month] = key.split('-').map(Number);
            const date = new Date(year, month - 1, 1);
            const rows = monthGroups[key];
            const minBalance = rows.length > 0 ? Math.min(...rows.map(r => r.balance)) : 0;
            
            return {
                monthName: date.toLocaleDateString('default', { month: 'long' }),
                year: year.toString(),
                monthKey: key,
                rows: rows,
                minBalance: minBalance
            };
        });
    }, [tableData]);

     return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {isModalOpen && <GoalScenarioModal onClose={() => setIsModalOpen(false)} onSave={(d) => { saveFinancialGoal(d); setIsModalOpen(false); }} goalToEdit={editingGoal} financialGoals={financialGoals} parentId={parentIdForNewGoal} accounts={accounts} />}
            {isRecurringModalOpen && <RecurringTransactionModal onClose={() => setIsRecurringModalOpen(false)} onSave={(d) => { saveRecurringTransaction(d); setIsRecurringModalOpen(false); }} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} recurringTransactionToEdit={editingRecurring} />}
            {isBillModalOpen && <BillPaymentModal onClose={() => setIsBillModalOpen(false)} onSave={(d) => { saveBillPayment(d); setIsBillModalOpen(false); }} bill={editingBill} accounts={accounts} initialDate={selectedForecastDate || undefined} />}
            {selectedForecastDate && <ForecastDayModal isOpen={!!selectedForecastDate} onClose={() => setSelectedForecastDate(null)} date={selectedForecastDate} items={selectedDayItems} onEditItem={handleEditForecastItem} onAddTransaction={handleAddNewToDate} />}
            
            {deletingGoal && (
                <ConfirmationModal
                    isOpen={!!deletingGoal}
                    onClose={() => setDeletingGoal(null)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Goal"
                    message={deletingGoal.isBucket ? `Are you sure you want to delete "${deletingGoal.name}" and its ${subGoalsOfDeleting.length} sub-goals? This action cannot be undone.` : `Are you sure you want to delete "${deletingGoal.name}"? This action cannot be undone.`}
                    confirmButtonText="Delete"
                />
            )}

            <PageHeader
                markerIcon="trending_up"
                markerLabel="Forward View"
                title="Financial Forecast"
                subtitle="Projected cash, income, and obligations so you can plan moves weeks and months ahead."
                actions={
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto flex-wrap">
                        <button 
                            onClick={() => setIsPlaygroundOpen(!isPlaygroundOpen)} 
                            className={`${BTN_SECONDARY_STYLE} flex items-center justify-center gap-2 ${isPlaygroundOpen ? 'bg-primary-500/10 text-primary-600 border-primary-500/30' : ''}`}
                        >
                            <span className="material-symbols-outlined text-xl">science</span>
                            <span className="truncate">{isPlaygroundOpen ? 'Close Playground' : 'Playground'}</span>
                        </button>
                        <div className="w-full sm:w-auto min-w-[200px]">
                             <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                        </div>
                        <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg h-10 flex-shrink-0 w-full sm:w-auto overflow-x-auto no-scrollbar justify-between sm:justify-start">
                            {durationOptions.map(opt => (
                                <button key={opt.value} onClick={() => setForecastDuration(opt.value)} className={`${segmentItemBase} ${forecastDuration === opt.value ? segmentItemActive : segmentItemInactive} !px-3 sm:!px-4`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex-shrink-0 whitespace-nowrap w-full sm:w-auto h-10 flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-xl mr-2">add</span>
                            Add Goal
                        </button>
                    </div>
                }
            />

            {/* --- Scenario Playground --- */}
            <AnimatePresence>
                {isPlaygroundOpen && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="bg-primary-500/5 border-primary-500/20 mb-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
                                    <span className="material-symbols-outlined">science</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Scenario Playground</h3>
                                    <p className="text-xs font-bold text-primary-600/70 tracking-widest">Adjust assumptions to see future impacts</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-light-text dark:text-dark-text tracking-wider">Savings Boost</label>
                                        <span className="text-sm font-bold text-primary-600">+{assumptions.savingsRateAdjustment}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="50" step="5" 
                                        value={assumptions.savingsRateAdjustment} 
                                        onChange={(e) => setAssumptions(prev => ({ ...prev, savingsRateAdjustment: parseInt(e.target.value) }))}
                                        className="w-full accent-primary-500"
                                    />
                                    <p className="text-[10px] text-light-text-secondary font-bold">Increase all recurring savings by this percentage.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-light-text dark:text-dark-text tracking-wider">Market Return</label>
                                        <span className="text-sm font-bold text-emerald-600">{assumptions.marketReturn}%</span>
                                    </div>
                                    <input 
                                        type="range" min="-10" max="15" step="1" 
                                        value={assumptions.marketReturn} 
                                        onChange={(e) => setAssumptions(prev => ({ ...prev, marketReturn: parseInt(e.target.value) }))}
                                        className="w-full accent-emerald-500"
                                    />
                                    <p className="text-[10px] text-light-text-secondary font-bold">Estimated annual return on investment accounts.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-light-text dark:text-dark-text tracking-wider">Inflation</label>
                                        <span className="text-sm font-bold text-rose-600">{assumptions.inflationRate}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="10" step="0.5" 
                                        value={assumptions.inflationRate} 
                                        onChange={(e) => setAssumptions(prev => ({ ...prev, inflationRate: parseFloat(e.target.value) }))}
                                        className="w-full accent-rose-500"
                                    />
                                    <p className="text-[10px] text-light-text-secondary font-bold">Annual inflation impact on expenses.</p>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- Bento Grid Hero --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Main Forecast Card */}
                <motion.div 
                    layout
                    className="md:col-span-2 relative overflow-hidden rounded-3xl p-6 bg-white dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between min-h-[220px]"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500">
                                    <span className="material-symbols-outlined text-lg">insights</span>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-semibold tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Wealth Projection</p>
                                    <p className="text-[10px] font-bold text-light-text-secondary/60">{forecastDuration} horizon</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                    <span className="material-symbols-outlined text-xs">trending_up</span>
                                    {((endBalance / startBalance - 1) * 100).toFixed(1)}% Growth
                                </div>
                                <div className="h-3 w-px bg-black/10 dark:bg-white/10 mx-1"></div>
                                <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary privacy-blur">
                                    {formatCurrency(endBalance - startBalance, 'EUR', { showPlusSign: true })} 
                                    <span className="text-[9px] ml-1 opacity-40">Delta</span>
                                </p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                             <div className="space-y-0">
                                <h2 className="text-4xl font-bold tracking-tighter privacy-blur leading-none">
                                    {formatCurrency(endBalance, 'EUR')}
                                </h2>
                                <p className="text-[10px] font-bold tracking-widest text-light-text-secondary dark:text-dark-text-secondary ml-1 opacity-60">Estimated Liquid Value</p>
                            </div>
                        </div>
                    </div>

                    {/* Subtle Gradient Accents */}
                    <div className="absolute top-0 right-0 w-[40%] h-full bg-primary-500/5 dark:bg-primary-500/10 blur-[80px] rounded-full -z-1" />
                </motion.div>

                {/* Net Change Card */}
                <Card className="relative overflow-hidden group flex flex-col justify-between !p-4 sm:!p-5 border border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-dark-card hover:shadow-md transition-all rounded-3xl min-h-[160px] sm:min-h-[180px]">
                    <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest opacity-60">Portfolio Shift</p>
                            <h2 className={`text-4xl font-bold tracking-tight privacy-blur ${netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {netChange >= 0 ? '+' : ''}{formatCurrency(netChange, 'EUR')}
                            </h2>
                        </div>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${netChange >= 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            <span className="material-symbols-outlined text-lg">{netChange >= 0 ? 'trending_up' : 'trending_down'}</span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                             <div className="flex -space-x-1.5">
                                {selectedAccounts.slice(0, 3).map((acc, i) => (
                                    <div key={acc.id} className="w-5 h-5 rounded-full border border-white dark:border-dark-card bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[7px] font-bold" style={{ zIndex: 10 - i }}>
                                        {acc.name.charAt(0)}
                                    </div>
                                ))}
                             </div>
                             <span className="text-[9px] font-bold tracking-wider text-light-text-secondary opacity-60">
                                {selectedAccounts.length} Account{selectedAccounts.length !== 1 ? 's' : ''}
                             </span>
                        </div>
                        <div className="pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
                            <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest opacity-40">Term: {forecastDuration}</p>
                            <span className="text-[9px] font-bold text-emerald-500 tracking-widest">Active</span>
                        </div>
                    </div>
                </Card>

                {/* Progress Mini Card */}
                <Card className="relative overflow-hidden group flex flex-col justify-between !p-4 sm:!p-5 border border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-dark-card hover:shadow-md transition-all rounded-3xl min-h-[160px] sm:min-h-[180px]">
                    <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest opacity-60">Global Performance</p>
                            <h2 className="text-3xl font-bold tracking-tight text-primary-500">
                                {goalProgress.toFixed(0)}%
                            </h2>
                        </div>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary-500/10 text-primary-500 border border-primary-500/20">
                            <span className="material-symbols-outlined text-lg">donut_large</span>
                        </div>
                    </div>
                    
                    <div className="space-y-2 mt-4">
                        {/* Savings Progress */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-[8px] font-bold tracking-wider">
                                <span className="text-primary-500">Savings</span>
                                <span className="text-light-text dark:text-dark-text">{savingsProgress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${savingsProgress}%` }} />
                            </div>
                        </div>

                        {/* Income Progress */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-[8px] font-bold tracking-wider">
                                <span className="text-emerald-500">Income</span>
                                <span className="text-light-text dark:text-dark-text">{incomeProgress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${incomeProgress}%` }} />
                            </div>
                        </div>

                        {/* Expense Progress */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-[8px] font-bold tracking-wider">
                                <span className="text-rose-500">Expenses</span>
                                <span className="text-light-text dark:text-dark-text">{expenseProgress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${expenseProgress}%` }} />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            
            <ForecastOverview forecasts={lowestBalanceForecasts} currency="EUR" />

            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Cash Flow Forecast</h3>
                        <p className="text-[10px] font-bold tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                            {formatCurrency(startBalance, 'EUR')} → {formatCurrency(endBalance, 'EUR')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl">
                            <button 
                                onClick={() => setShowIndividualLines(false)}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${!showIndividualLines ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-light-text-secondary hover:text-light-text dark:text-neutral-300'}`}
                            >
                                <span className="material-symbols-outlined text-xl">stacked_line_chart</span>
                                <span className="text-xs font-bold uppercase tracking-wider">Combined</span>
                            </button>
                            <button 
                                onClick={() => setShowIndividualLines(true)}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${showIndividualLines ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-light-text-secondary hover:text-light-text dark:text-neutral-300'}`}
                            >
                                <span className="material-symbols-outlined text-xl">multiline_chart</span>
                                <span className="text-xs font-bold tracking-wider">Split Accounts</span>
                            </button>
                        </div>

                        <div className="h-6 w-px bg-black/10 dark:bg-white/10 hidden sm:block"></div>

                        <label className="flex items-center gap-2 px-3 py-1.5 bg-light-fill dark:bg-dark-fill rounded-xl cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={showGoalLines} 
                                onChange={(e) => setShowGoalLines(e.target.checked)} 
                                className={CHECKBOX_STYLE} 
                            />
                            <span className="text-[12px] font-bold tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Goals</span>
                        </label>
                    </div>
                </div>
                <ForecastChart 
                    data={combinedChartData} 
                    lowestPoint={lowestPoint} 
                    oneTimeGoals={activeGoals.filter(g => g.type === 'one-time')} 
                    showIndividualLines={showIndividualLines}
                    accounts={selectedAccounts}
                    showGoalLines={showGoalLines}
                    onDataPointClick={handleDateClick}
                />
            </Card>
            
             <div className="space-y-6">
                 <div className="bg-light-fill dark:bg-dark-fill p-5 rounded-[2rem] flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                         <div className="p-3 rounded-2xl bg-white dark:bg-white/5 shadow-sm text-amber-500 border border-black/5 dark:border-white/10">
                             <span className="material-symbols-outlined">flag</span>
                         </div>
                         <h3 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tighter">Financial Goals</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none hover:text-primary-500 transition-colors bg-white dark:bg-white/5 px-4 py-2 rounded-full border border-black/5 dark:border-white/10">
                            <input type="checkbox" checked={filterGoalsByAccount} onChange={(e) => setFilterGoalsByAccount(e.target.checked)} className={CHECKBOX_STYLE} />
                            <span className="text-light-text-secondary dark:text-dark-text-secondary font-bold tracking-widest">Filter by Account</span>
                        </label>
                        <div className="h-4 w-px bg-black/10 dark:bg-white/10"></div>
                        <button onClick={handleToggleAllDisplayed} className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline transition-colors tracking-widest">
                            {areAllDisplayedSelected ? 'Deselect All' : 'Select All'}
                        </button>
                        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl">
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-light-text-secondary hover:text-light-text dark:text-neutral-300'}`}
                            >
                                <span className="material-symbols-outlined text-xl">grid_view</span>
                                <span className="text-xs font-bold uppercase tracking-wider">Grid</span>
                            </button>
                            <button 
                                onClick={() => setViewMode('table')}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500' : 'text-light-text-secondary hover:text-light-text dark:text-neutral-300'}`}
                            >
                                <span className="material-symbols-outlined text-xl">table_rows</span>
                                <span className="text-xs font-bold uppercase tracking-wider">Table</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:grid lg:grid-cols-12 gap-8 items-start">
                    {/* Simplified Status Column - One big element */}
                    <div className="lg:col-span-3 space-y-4 mb-8 lg:mb-0">
                        {/* Monthly Target Schedule Summary */}
                        <Card className="flex flex-col border border-black/5 dark:border-neutral-800 shadow-sm rounded-3xl overflow-hidden !p-0">
                            <div className="p-4 bg-gray-50/50 dark:bg-white/5 border-b border-black/5 dark:border-white/10 flex justify-between items-center">
                                <h2 className="text-xs font-bold tracking-widest text-primary-500">Monthly Target Schedule</h2>
                                <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                                    <button 
                                        onClick={() => setScheduleMode('account')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${scheduleMode === 'account' ? 'bg-white dark:bg-white/10 shadow-sm text-primary-500' : 'text-light-text-secondary dark:text-neutral-300'}`}
                                    >
                                        Account
                                    </button>
                                    <button 
                                        onClick={() => setScheduleMode('date')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${scheduleMode === 'date' ? 'bg-white dark:bg-white/10 shadow-sm text-primary-500' : 'text-light-text-secondary dark:text-neutral-300'}`}
                                    >
                                        Date
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-6 space-y-8">
                                <div className="space-y-8">
                                    {scheduleMode === 'account' ? (
                                        monthlyPaymentBreakdown.map((account, index) => {
                                            const colors = [
                                                'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 
                                                'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-amber-500'
                                            ];
                                            const accColor = colors[index % colors.length];
                                            return (
                                                <div key={account.id} className="space-y-3 group/account text-left border-l-2 border-black/5 dark:border-white/5 pl-4 transition-colors hover:border-primary-500/30">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className={`w-2 h-2 rounded-full ${accColor}`} />
                                                        <p className="text-[12px] font-black tracking-widest text-light-text dark:text-dark-text uppercase group-hover/account:text-primary-500 transition-colors">{account.name}</p>
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        {Object.entries(account.months).map(([monthKey, breakdown]) => {
                                                            const date = new Date(monthKey + '-02');
                                                            const monthName = date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                                                            return (
                                                                <div key={monthKey} className="flex justify-between items-center py-2.5 px-3 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all group/item border border-transparent hover:border-black/5 dark:hover:border-white/5">
                                                                    <span className="text-[11px] font-black tracking-widest text-light-text-secondary dark:text-neutral-300 group-hover/item:text-light-text dark:group-hover/item:text-dark-text transition-colors uppercase">{monthName}</span>
                                                                    <div className="flex items-center gap-4">
                                                                        {breakdown.income > 0 && (
                                                                            <div className="flex flex-col items-end">
                                                                                <span className="text-[8px] font-black text-emerald-500/60 leading-none mb-0.5 uppercase tracking-tighter">Income</span>
                                                                                <span className="text-[13px] font-black text-emerald-500 tracking-tighter tabular-nums">{formatCurrency(breakdown.income, account.currency)}</span>
                                                                            </div>
                                                                        )}
                                                                        {breakdown.savings > 0 && (
                                                                            <div className="flex flex-col items-end">
                                                                                <span className="text-[8px] font-black text-primary-500/60 leading-none mb-0.5 uppercase tracking-tighter">Savings</span>
                                                                                <span className="text-[13px] font-black text-primary-500 tracking-tighter tabular-nums">{formatCurrency(breakdown.savings, account.currency)}</span>
                                                                            </div>
                                                                        )}
                                                                        {breakdown.expense > 0 && (
                                                                            <div className="flex flex-col items-end">
                                                                                <span className="text-[8px] font-black text-rose-500/60 leading-none mb-0.5 uppercase tracking-tighter">Expense</span>
                                                                                <span className="text-[13px] font-black text-rose-500 tracking-tighter tabular-nums">{formatCurrency(breakdown.expense, account.currency)}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        monthlyDateBreakdown.map((month) => (
                                            <div key={month.monthKey} className="space-y-3 group/date text-left border-l-2 border-black/5 dark:border-white/5 pl-4 transition-colors hover:border-primary-500/30">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 opacity-30" />
                                                    <p className="text-[12px] font-black tracking-widest text-light-text dark:text-dark-text uppercase group-hover/date:text-primary-500 transition-colors">{month.monthName}</p>
                                                </div>
                                                
                                                <div className="space-y-1">
                                                    {month.accounts.map((account) => (
                                                        <div key={account.id} className="flex justify-between items-center py-2 px-3 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all group/item border border-transparent hover:border-black/5 dark:hover:border-white/5">
                                                            <span className="text-[11px] font-black tracking-widest text-light-text-secondary dark:text-neutral-300 group-hover/item:text-light-text dark:group-hover/item:text-dark-text transition-colors uppercase">{account.name}</span>
                                                            <div className="flex items-center gap-4">
                                                                {account.income > 0 && (
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-[8px] font-black text-emerald-500/60 leading-none mb-0.5 uppercase tracking-tighter">Income</span>
                                                                        <span className="text-[13px] font-black text-emerald-500 tracking-tighter tabular-nums">{formatCurrency(account.income, account.currency)}</span>
                                                                    </div>
                                                                )}
                                                                {account.savings > 0 && (
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-[8px] font-black text-primary-500/60 leading-none mb-0.5 uppercase tracking-tighter">Savings</span>
                                                                        <span className="text-[13px] font-black text-primary-500 tracking-tighter tabular-nums">{formatCurrency(account.savings, account.currency)}</span>
                                                                    </div>
                                                                )}
                                                                {account.expense > 0 && (
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-[8px] font-black text-rose-500/60 leading-none mb-0.5 uppercase tracking-tighter">Expense</span>
                                                                        <span className="text-[13px] font-black text-rose-500 tracking-tighter tabular-nums">{formatCurrency(account.expense, account.currency)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {monthlyPaymentBreakdown.length === 0 && (
                                        <div className="py-6 text-center">
                                            <p className="text-[10px] opacity-40 text-light-text-secondary">No upcoming goal targets found for the selected accounts.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                        <Card className="flex flex-col border border-black/5 dark:border-neutral-800 shadow-sm rounded-3xl overflow-hidden !p-0">
                            <div className="p-4 bg-gray-50/50 dark:bg-white/5 border-b border-black/5 dark:border-white/10">
                                <h2 className="text-sm font-black tracking-widest mb-1 uppercase">Global Performance</h2>
                            </div>
                            
                            <div className="p-6 space-y-7">
                                {/* Total Income Bar */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <span className="text-[12px] font-black tracking-widest text-light-text dark:text-dark-text uppercase">Total Income Target</span>
                                            <p className="text-3xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                {formatCurrency(globalIncomeGoalCurrent, 'EUR')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black tabular-nums">{globalIncomeGoalTarget > 0 ? ((globalIncomeGoalCurrent / globalIncomeGoalTarget) * 100).toFixed(0) : 0}%</span>
                                            <p className="text-[11px] font-black opacity-50 tracking-widest uppercase">of {formatCurrency(globalIncomeGoalTarget, 'EUR')}</p>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-500 transition-all duration-1000" 
                                            style={{ width: `${globalIncomeGoalTarget > 0 ? Math.min(100, (globalIncomeGoalCurrent / globalIncomeGoalTarget) * 100) : 0}%` }} 
                                        />
                                    </div>
                                </div>

                                {/* Total Savings Bar */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <span className="text-[12px] font-black tracking-widest text-light-text dark:text-dark-text uppercase">Total Savings Target</span>
                                            <p className="text-3xl font-black tracking-tighter text-primary-500 tabular-nums">
                                                {formatCurrency(globalSavingsGoalCurrent, 'EUR')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black tabular-nums">{globalSavingsGoalTarget > 0 ? ((globalSavingsGoalCurrent / globalSavingsGoalTarget) * 100).toFixed(0) : 0}%</span>
                                            <p className="text-[11px] font-black opacity-50 tracking-widest uppercase">of {formatCurrency(globalSavingsGoalTarget, 'EUR')}</p>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-primary-500 transition-all duration-1000" 
                                            style={{ width: `${globalSavingsGoalTarget > 0 ? Math.min(100, (globalSavingsGoalCurrent / globalSavingsGoalTarget) * 100) : 0}%` }} 
                                        />
                                    </div>
                                </div>

                                {/* Total Expense Bar */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <span className="text-[12px] font-black tracking-widest text-light-text dark:text-dark-text uppercase">Total Expense Target</span>
                                            <p className="text-3xl font-black tracking-tighter text-rose-600 dark:text-rose-400 tabular-nums">
                                                {formatCurrency(globalExpenseGoalCurrent, 'EUR')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black tabular-nums">{globalExpenseGoalTarget > 0 ? ((globalExpenseGoalCurrent / globalExpenseGoalTarget) * 100).toFixed(0) : 0}%</span>
                                            <p className="text-[11px] font-black opacity-50 tracking-widest uppercase">of {formatCurrency(globalExpenseGoalTarget, 'EUR')}</p>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-rose-500 transition-all duration-1000" 
                                            style={{ width: `${globalExpenseGoalTarget > 0 ? Math.min(100, (globalExpenseGoalCurrent / globalExpenseGoalTarget) * 100) : 0}%` }} 
                                        />
                                    </div>
                                </div>

                                {/* Account Specific Section */}
                                <div className="pt-5 border-t border-black/5 dark:border-white/10 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[12px] font-black tracking-widest text-light-text dark:text-dark-text uppercase">Account Breakdown</p>
                                        <p className="text-[11px] font-black text-primary-500 tracking-widest uppercase">Global</p>
                                    </div>
                                    <div className="space-y-6">
                                        {globalAccountBreakdown.map((accGroup, index) => {
                                            const colors = [
                                                'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 
                                                'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-amber-500'
                                            ];
                                            const accColor = colors[index % colors.length];
                                            const hasIncome = accGroup.income.target > 0;
                                            const hasSavings = accGroup.savings.target > 0;
                                            const hasExpense = accGroup.expense.target > 0;
                                            
                                            const incProgress = hasIncome ? Math.min(100, (accGroup.income.current / accGroup.income.target) * 100) : 0;
                                            const savProgress = hasSavings ? Math.min(100, (accGroup.savings.current / accGroup.savings.target) * 100) : 0;
                                            const expProgress = hasExpense ? Math.min(100, (accGroup.expense.current / accGroup.expense.target) * 100) : 0;

                                            return (
                                                <div key={accGroup.id} className="space-y-3 group/acc border-l-2 border-black/5 dark:border-white/5 pl-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${accColor}`} />
                                                        <span className="text-[12px] font-black text-light-text dark:text-dark-text tracking-widest truncate uppercase">{accGroup.name}</span>
                                                    </div>

                                                    {hasIncome && (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                                                <span className="opacity-60">Income</span>
                                                                <span>{formatCurrency(accGroup.income.current, accGroup.currency)} <span className="opacity-40">/ {formatCurrency(accGroup.income.target, accGroup.currency)}</span></span>
                                                            </div>
                                                            <div className="h-1 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full bg-emerald-500 transition-all duration-700`} 
                                                                    style={{ width: `${incProgress}%` }} 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {hasSavings && (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                                                <span className="opacity-60">Savings</span>
                                                                <span>{formatCurrency(accGroup.savings.current, accGroup.currency)} <span className="opacity-40">/ {formatCurrency(accGroup.savings.target, accGroup.currency)}</span></span>
                                                            </div>
                                                            <div className="h-1 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full bg-primary-500 transition-all duration-700 opacity-80`} 
                                                                    style={{ width: `${savProgress}%` }} 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {hasExpense && (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                                                <span className="opacity-60">Expenses</span>
                                                                <span>{formatCurrency(accGroup.expense.current, accGroup.currency)} <span className="opacity-40">/ {formatCurrency(accGroup.expense.target, accGroup.currency)}</span></span>
                                                            </div>
                                                            <div className="h-1 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full bg-rose-500 transition-all duration-700 opacity-80`} 
                                                                    style={{ width: `${expProgress}%` }} 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {globalAccountBreakdown.length === 0 && (
                                            <p className="text-[10px] italic text-center opacity-40 py-4">No account-specific goals tracked.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Goals Grid Column */}
                    <div className="lg:col-span-9 space-y-6">
                        {viewMode === 'grid' ? (
                            <DndContext 
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext 
                                    items={topLevelGoals.map(g => g.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="columns-1 md:columns-2 gap-6 space-y-6">
                                        {topLevelGoals.length > 0 ? topLevelGoals.map(goal => {
                                            const subGoals = goalsByParentId.get(goal.id) || [];
                                            const isEffectivelyActive = goal.isBucket
                                            ? activeGoalIds.includes(goal.id) || subGoals.some(sg => activeGoalIds.includes(sg.id))
                                            : activeGoalIds.includes(goal.id);

                                            return (
                                                <div key={goal.id} className="break-inside-avoid mb-6">
                                                    <SortableGoal
                                                        goal={goal}
                                                        subGoals={subGoals}
                                                        isActive={isEffectivelyActive}
                                                        accounts={accounts}
                                                    />
                                                </div>
                                            );
                                        }) : (
                                            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white dark:bg-dark-card rounded-[2.5rem] border border-dashed border-black/10 dark:border-white/10">
                                                <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                                     <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">flag</span>
                                                </div>
                                                <h4 className="text-xl font-black text-light-text dark:text-dark-text mb-2 tracking-tight">No Goals Found</h4>
                                                <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto mb-8 opacity-60">
                                                    {filterGoalsByAccount ? 'No goals match the selected accounts.' : 'Start planning for your future by adding a financial goal.'}
                                                </p>
                                                <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>Create New Goal</button>
                                            </div>
                                        )}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            <GoalTable 
                                goals={goalsWithProjections}
                                accounts={accounts}
                                onGoalClick={handleOpenModal}
                                onEdit={handleOpenModal}
                                onDelete={handleDeleteClick}
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                             <span className="material-symbols-outlined text-xl">table_view</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Forecast Ledger</h3>
                            <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Daily Projections</p>
                        </div>
                    </div>
                     <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                         <div className="flex items-center gap-2 text-[12px] font-black bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-full border border-red-100 dark:border-red-900/30 uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            Global Lowest
                        </div>
                        <div className="flex items-center gap-2 text-[12px] font-black bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-full border border-amber-100 dark:border-amber-900/30 uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Monthly Lowest
                        </div>
                    </div>
                </div>

                <Card className="overflow-hidden border-0 shadow-xl bg-white dark:bg-dark-card !p-0">
                    <div className="overflow-x-auto max-h-[700px] no-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                             <thead className="sticky top-0 z-30 bg-white/95 dark:bg-[#1E1E20]/95 backdrop-blur-md shadow-sm text-[12px] font-bold tracking-widest text-light-text-secondary dark:text-dark-text-secondary border-b border-black/5 dark:border-white/5">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Origin/Account</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    <th className="px-6 py-4 text-right">Proj. Bal.</th>
                                    <th className="px-6 py-4 text-center">Source</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                                {groupedTableData.map((group) => (
                                    <React.Fragment key={group.monthKey}>
                                        <tr className="bg-light-fill/50 dark:bg-dark-fill/30 sticky top-[53px] z-20 backdrop-blur-sm">
                                            <td colSpan={6} className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[14px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-tighter">
                                                        {group.monthName} {group.year}
                                                    </span>
                                                    <div className="h-px flex-1 bg-gradient-to-r from-primary-500/20 to-transparent"></div>
                                                    <span className="text-[12px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                                                        {group.rows.length} Events
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {group.rows.map(row => {
                                            const isLowest = hasForecastData && row.balance.toFixed(2) === lowestPoint.value.toFixed(2);
                                            const isMonthlyLowest = row.balance.toFixed(2) === group.minBalance.toFixed(2);
                                            
                                            let rowClass = 'hover:bg-gray-50/80 dark:hover:bg-white/5 transition-all duration-150 group cursor-pointer relative';
                                            if (isLowest) rowClass += ' bg-red-500/[0.03] hover:!bg-red-500/[0.06]';
                                            else if (isMonthlyLowest) rowClass += ' bg-amber-500/[0.02]';

                                            const amountClass = row.amount >= 0 
                                                ? 'text-emerald-600 dark:text-emerald-400 font-black' 
                                                : 'text-light-text dark:text-dark-text font-bold opacity-80';

                                            const getIcon = (type: string) => {
                                                switch (type) {
                                                    case 'Financial Goal': return 'flag';
                                                    case 'Bill/Payment': return 'receipt_long';
                                                    default: return 'repeat';
                                                };
                                            }

                                            return (
                                                <tr 
                                                    key={row.id} 
                                                    className={rowClass}
                                                    onClick={() => handleEditForecastItem(row)}
                                                >
                                                    <td className="px-6 py-2 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-[12px] font-bold text-light-text dark:text-dark-text">
                                                                {parseLocalDate(row.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${
                                                                row.type === 'Financial Goal' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                row.type === 'Bill/Payment' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                                'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                                                            }`}>
                                                                <span className="material-symbols-outlined text-sm">{getIcon(row.type)}</span>
                                                            </div>
                                                            <span className="font-bold text-[12px] text-light-text dark:text-dark-text truncate block max-w-[140px] tracking-tight">{row.accountName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-2">
                                                        <span className="truncate block max-w-[280px] text-[12px] font-medium text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text transition-colors">{row.description}</span>
                                                    </td>
                                                    <td className={`px-6 py-2 text-right font-mono text-[12px] ${amountClass}`}>
                                                        {formatCurrency(row.amount, 'EUR', { showPlusSign: true })}
                                                    </td>
                                                    <td className={`px-6 py-2 text-right font-mono text-[12px] ${isLowest ? 'text-red-600 dark:text-red-400 font-bold' : isMonthlyLowest ? 'text-amber-600 dark:text-amber-400 font-bold' : 'font-bold text-light-text dark:text-dark-text'}`}>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isMonthlyLowest && !isLowest && (
                                                                <span className="material-symbols-outlined text-[14px] text-amber-500 font-bold" title="Monthly Lowest Balance">arrow_downward</span>
                                                            )}
                                                            {formatCurrency(row.balance, 'EUR')}
                                                        </div>
                                                        {isLowest && (
                                                            <div className="absolute top-0 right-0 h-full w-[3px] bg-red-500"></div>
                                                        )}
                                                        {isMonthlyLowest && !isLowest && (
                                                            <div className="absolute top-0 right-0 h-full w-[2px] bg-amber-500/40"></div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-2 text-center">
                                                         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${
                                                            row.type === 'Financial Goal' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800' :
                                                            row.type === 'Bill/Payment' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800' :
                                                            'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800'
                                                        }`}>
                                                            {row.type === 'Financial Goal' ? 'Goal' : row.type === 'Bill/Payment' ? 'Bill' : 'Recurring'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                             </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Forecasting;
