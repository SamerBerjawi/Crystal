
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
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';
import PageHeader from '../components/PageHeader';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { getPredictiveInsights } from '../src/services/geminiService';

// --- Smart Goal Planner Hook (Deterministic) ---
const useSmartGoalPlanner = (
    accounts: Account[],
    recurringTransactions: RecurringTransaction[],
    financialGoals: FinancialGoal[]
) => {
    const [plan, setPlan] = useState<Record<string, ContributionPlanStep[]> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generatePlan = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setPlan(null);

        try {
            // Simulate a brief calculation delay for UX consistency
            await new Promise(resolve => setTimeout(resolve, 500));

            const liquidAccounts = accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type));
            const totalLiquidCash = liquidAccounts.reduce((sum, a) => sum + convertToEur(a.balance, a.currency), 0);
            
            const planObject: Record<string, ContributionPlanStep[]> = {};
            
            // Basic logic: prioritize goals based on date
            // This replaces the GenAI logic with a deterministic distribution strategy.
            const sortedGoals = [...financialGoals].sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            });

            sortedGoals.forEach(goal => {
                if (goal.currentAmount >= goal.amount) return; // Goal met
                
                const steps: ContributionPlanStep[] = [];
                const remainingNeeded = goal.amount - goal.currentAmount;
                const today = new Date();
                const goalDate = goal.date ? new Date(goal.date) : new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
                
                // Calculate months remaining
                const monthsDiff = (goalDate.getFullYear() - today.getFullYear()) * 12 + (goalDate.getMonth() - today.getMonth());
                const months = Math.max(1, monthsDiff);
                
                const monthlyAmount = remainingNeeded / months;
                
                // Determine source account (simply pick the first liquid account with balance > 0, or default to first)
                // In a real app, this would check free cash flow from the forecast engine.
                const sourceAccount = liquidAccounts.find(a => a.balance > 0) || liquidAccounts[0];
                const sourceName = sourceAccount ? sourceAccount.name : 'Unknown Account';
                
                // Generate step
                steps.push({
                    goalName: goal.name,
                    date: `Monthly until ${goalDate.toLocaleDateString()}`,
                    amount: parseFloat(monthlyAmount.toFixed(2)),
                    accountName: sourceName,
                    notes: `Calculated over ${months} months`
                });

                planObject[goal.name] = steps;
            });

            setPlan(planObject);

        } catch (err: any) {
            console.error("Error generating plan:", err);
            setError("An error occurred while generating the plan.");
        } finally {
            setIsLoading(false);
        }
    }, [accounts, recurringTransactions, financialGoals]);
    
    return { generatePlan, plan, isLoading, error };
};

const MetricCard: React.FC<{ title: string; value: string; subValue?: string; icon: string; colorClass: string; trend?: 'up' | 'down' | 'neutral' }> = ({ title, value, subValue, icon, colorClass, trend }) => (
    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full relative overflow-hidden group">
        <div className="flex justify-between items-start mb-3 relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">{title}</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass} bg-opacity-10 dark:bg-opacity-20 group-hover:scale-110 transition-transform duration-300`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
            </div>
        </div>
        <div className="relative z-10">
            <p className="text-2xl font-extrabold text-light-text dark:text-dark-text tracking-tight">{value}</p>
            {subValue && (
                <div className="flex items-center gap-1 mt-1">
                     {trend === 'up' && <span className="material-symbols-outlined text-xs text-green-500">trending_up</span>}
                     {trend === 'down' && <span className="material-symbols-outlined text-xs text-red-500">trending_down</span>}
                     <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-90">{subValue}</p>
                </div>
            )}
        </div>
    </div>
);

const Forecasting: React.FC = () => {
  const { activeGoalIds, setActiveGoalIds } = useInsightsView();
  const { accounts } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  
  const [predictiveInsights, setPredictiveInsights] = useState<{
    anomalies: any[];
    predictedBalance30d: number;
    confidenceScore: number;
    insight: string;
  } | null>(null);
  const [isPredictiveLoading, setIsPredictiveLoading] = useState(false);
  const [predictiveError, setPredictiveError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredictiveInsights = async () => {
      if (transactions.length > 0 && !predictiveInsights && !isPredictiveLoading) {
        setIsPredictiveLoading(true);
        setPredictiveError(null);
        try {
          const result = await getPredictiveInsights({ transactions, accounts });
          setPredictiveInsights(result);
        } catch (err) {
          console.error('Failed to fetch predictive insights:', err);
          setPredictiveError('Could not generate AI predictive insights.');
        } finally {
          setIsPredictiveLoading(false);
        }
      }
    };
    fetchPredictiveInsights();
  }, [transactions, accounts, predictiveInsights, isPredictiveLoading]);
  const { financialGoals, saveFinancialGoal, deleteFinancialGoal } = useGoalsContext();
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
        
        const goalsWithProjections = financialGoals.map(goal => {
            if (goal.isBucket) return { ...goal, projection: undefined };
            
            const goalDate = goal.date ? parseLocalDate(goal.date) : null;
            let projectedDate = 'Beyond forecast';
            let status: 'on-track' | 'at-risk' | 'off-track' = 'off-track';

            for (const point of chartData) {
                if (point.value >= goal.amount) {
                    projectedDate = point.date;
                    if (goalDate) {
                        const projDate = parseLocalDate(projectedDate);
                        if (projDate <= goalDate) {
                            status = 'on-track';
                        } else {
                            const diffDays = (projDate.getTime() - goalDate.getTime()) / (1000 * 3600 * 24);
                            status = diffDays <= 90 ? 'at-risk' : 'off-track';
                        }
                    }
                    break;
                }
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
        
        const startBal = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[0].value : 0;
        const endBal = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[forecastDataForPeriod.length - 1].value : 0;

        const historyData: typeof forecastDataForPeriod = [];
        let currentHistoryBal = startBal;
        const today = new Date();
        const todayStr = toLocalISOString(today);

        const txsByDate = new Map<string, number>();
        transactions.forEach(tx => {
             if (selectedAccountIds.includes(tx.accountId) && !tx.transferId) {
                  const d = tx.date;
                  txsByDate.set(d, (txsByDate.get(d) || 0) + convertToEur(tx.amount, tx.currency));
             } else if (tx.transferId) {
                 if (selectedAccountIds.includes(tx.accountId)) {
                     const d = tx.date;
                     txsByDate.set(d, (txsByDate.get(d) || 0) + convertToEur(tx.amount, tx.currency));
                 }
             }
        });

        for (let i = 0; i <= 10; i++) {
             const d = new Date(today);
             d.setDate(d.getDate() - i);
             const dateStr = toLocalISOString(d);
             
             if (dateStr === todayStr) continue; 
             
             const dateForChangeLookup = new Date(today);
             dateForChangeLookup.setDate(today.getDate() - i);
             const lookupDateStr = toLocalISOString(dateForChangeLookup);
             
             const change = txsByDate.get(lookupDateStr) || 0;
             currentHistoryBal -= change; 
             
             const dPrev = new Date(d);
             dPrev.setDate(d.getDate() - 1);
             
             historyData.push({ 
                 date: toLocalISOString(dPrev), 
                 value: currentHistoryBal,
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
            startBalance: startBal,
            endBalance: endBal,
            combinedChartData
        };
    }, [fullForecast, financialGoals, forecastDuration, transactions, selectedAccountIds]);
    
    const accountGoalSummary = useMemo(() => {
        const summary: Record<string, { id: string; name: string; current: number; target: number; currency: Currency; goalsCount: number; type: 'income' | 'expense' }> = {};
        
        financialGoals.forEach(g => {
            if (g.isBucket) return;
            const isVisible = !filterGoalsByAccount || !g.paymentAccountId || selectedAccountIds.includes(g.paymentAccountId);
            if (!isVisible) return;

            const accId = g.paymentAccountId || 'unlinked';
            const type = g.transactionType; 
            const key = `${accId}_${type}`;

            if (!summary[key]) {
                 const acc = accounts.find(a => a.id === accId);
                 summary[key] = {
                     id: key,
                     name: acc ? acc.name : 'General (Unlinked)',
                     current: 0,
                     target: 0,
                     currency: acc?.currency || 'EUR',
                     goalsCount: 0,
                     type: type
                 };
            }
            summary[key].current += g.currentAmount;
            summary[key].target += g.amount;
            summary[key].goalsCount += 1;
        });
        
        return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
    }, [financialGoals, accounts, filterGoalsByAccount, selectedAccountIds]);

    const { totalIncomeGoalTarget, totalIncomeGoalCurrent, totalSavingsGoalTarget, totalSavingsGoalCurrent } = useMemo(() => {
        let incTarget = 0, incCurrent = 0, savTarget = 0, savCurrent = 0;
        goalsWithProjections.forEach(g => {
            if (g.isBucket) return;
            const isVisible = !filterGoalsByAccount || !g.paymentAccountId || selectedAccountIds.includes(g.paymentAccountId);
            if (!isVisible) return;

            if (g.transactionType === 'income') {
                incTarget += g.amount;
                incCurrent += g.currentAmount;
            } else {
                savTarget += g.amount;
                savCurrent += g.currentAmount;
            }
        });
        return { 
            totalIncomeGoalTarget: incTarget, 
            totalIncomeGoalCurrent: incCurrent, 
            totalSavingsGoalTarget: savTarget, 
            totalSavingsGoalCurrent: savCurrent 
        };
    }, [goalsWithProjections, filterGoalsByAccount, selectedAccountIds]);

    const plannerGoals = useMemo(() => {
        return goalsWithProjections.filter(g => {
            if (!activeGoalIds.includes(g.id)) return false;
            if (filterGoalsByAccount) {
                return !g.paymentAccountId || selectedAccountIds.includes(g.paymentAccountId);
            }
            return true;
        });
    }, [goalsWithProjections, activeGoalIds, filterGoalsByAccount, selectedAccountIds]);

    const { generatePlan, plan, isLoading: isPlanLoading, error: planError } = useSmartGoalPlanner(selectedAccounts, recurringTransactions, plannerGoals);

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

        const topLevel: FinancialGoal[] = [];
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
        return { topLevelGoals: topLevel, goalsByParentId: byParent, displayedGoals: visibleGoals };
    }, [goalsWithProjections, filterGoalsByAccount, selectedAccountIds]);

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
    const totalGoalTarget = displayedGoals.reduce((sum, g) => sum + (g.isBucket ? 0 : g.amount), 0);
    const totalGoalSaved = displayedGoals.reduce((sum, g) => sum + (g.isBucket ? 0 : g.currentAmount), 0);
    const goalProgress = totalGoalTarget > 0 ? (totalGoalSaved / totalGoalTarget) * 100 : 0;
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
            {/* AI Predictive Insights Section */}
            {(predictiveInsights || isPredictiveLoading) && (
                <div className={`${isPredictiveLoading ? 'animate-pulse' : 'animate-fade-in-up'} bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-900/10 dark:to-indigo-900/10 border border-primary-100 dark:border-primary-900/20 rounded-3xl p-6`}>
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500">auto_awesome</span>
                                <h3 className="font-bold text-light-text dark:text-dark-text">Crystal Insights</h3>
                                {predictiveInsights && (
                                    <div className="ml-auto px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-[10px] font-bold text-primary-600 dark:text-primary-400">
                                        Confidence: {Math.round(predictiveInsights.confidenceScore * 100)}%
                                    </div>
                                )}
                            </div>
                            
                            {isPredictiveLoading ? (
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                                </div>
                            ) : predictiveInsights ? (
                                <div className="text-sm text-light-text dark:text-dark-text leading-relaxed">
                                    {predictiveInsights.insight}
                                </div>
                            ) : null}

                            {!isPredictiveLoading && predictiveInsights?.anomalies.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-primary-500 uppercase tracking-widest flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">warning</span>
                                        Detected Anomalies
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {predictiveInsights.anomalies.map((anomaly, idx) => (
                                            <div key={idx} className="px-3 py-2 rounded-xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm text-xs group hover:border-primary-500/30 transition-colors">
                                                <div className="font-bold text-light-text dark:text-dark-text">{anomaly.description}</div>
                                                <div className="flex justify-between items-center gap-4 mt-1 opacity-70">
                                                    <span>{anomaly.date}</span>
                                                    <span className="text-red-500 font-bold">-{formatCurrency(Math.abs(anomaly.amount), 'EUR')}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) }
                        </div>

                        <div className="w-full md:w-64 flex flex-col justify-center items-center p-4 bg-white dark:bg-dark-card rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Predicted Balance (30d)</span>
                            {isPredictiveLoading ? (
                                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse rounded"></div>
                            ) : (
                                <div className="text-2xl font-black text-primary-500 tracking-tight">
                                    {formatCurrency(predictiveInsights?.predictedBalance30d || 0, 'EUR')}
                                </div>
                            )}
                            <div className="mt-4 flex items-center gap-2">
                                <button 
                                    onClick={() => { setPredictiveInsights(null); }}
                                    disabled={isPredictiveLoading}
                                    className="text-[10px] font-bold text-primary-500 hover:underline uppercase tracking-widest flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                                    Recalculate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto flex-wrap">
                        <button 
                            onClick={() => setIsPlaygroundOpen(!isPlaygroundOpen)} 
                            className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 ${isPlaygroundOpen ? 'bg-primary-500/10 text-primary-600 border-primary-500/30' : ''}`}
                        >
                            <span className="material-symbols-outlined text-xl">science</span>
                            {isPlaygroundOpen ? 'Close Playground' : 'Scenario Playground'}
                        </button>
                        <div className="w-full sm:w-auto">
                             <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                        </div>
                        <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg h-10 flex-shrink-0 w-full sm:w-auto overflow-x-auto no-scrollbar">
                            {durationOptions.map(opt => (
                                <button key={opt.value} onClick={() => setForecastDuration(opt.value)} className={`${segmentItemBase} ${forecastDuration === opt.value ? segmentItemActive : segmentItemInactive}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex-shrink-0 whitespace-nowrap w-full sm:w-auto h-10`}>
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
                                    <h3 className="text-lg font-black text-light-text dark:text-dark-text">Scenario Playground</h3>
                                    <p className="text-xs font-bold text-primary-600/70 uppercase tracking-widest">Adjust assumptions to see future impacts</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-black text-light-text dark:text-dark-text uppercase tracking-wider">Savings Boost</label>
                                        <span className="text-sm font-black text-primary-600">+{assumptions.savingsRateAdjustment}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="50" step="5" 
                                        value={assumptions.savingsRateAdjustment} 
                                        onChange={(e) => setAssumptions(prev => ({ ...prev, savingsRateAdjustment: parseInt(e.target.value) }))}
                                        className="w-full accent-primary-500"
                                    />
                                    <p className="text-[10px] text-light-text-secondary font-bold uppercase">Increase all recurring savings by this percentage.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-black text-light-text dark:text-dark-text uppercase tracking-wider">Market Return</label>
                                        <span className="text-sm font-black text-emerald-600">{assumptions.marketReturn}%</span>
                                    </div>
                                    <input 
                                        type="range" min="-10" max="15" step="1" 
                                        value={assumptions.marketReturn} 
                                        onChange={(e) => setAssumptions(prev => ({ ...prev, marketReturn: parseInt(e.target.value) }))}
                                        className="w-full accent-emerald-500"
                                    />
                                    <p className="text-[10px] text-light-text-secondary font-bold uppercase">Estimated annual return on investment accounts.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-black text-light-text dark:text-dark-text uppercase tracking-wider">Inflation</label>
                                        <span className="text-sm font-black text-rose-600">{assumptions.inflationRate}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="10" step="0.5" 
                                        value={assumptions.inflationRate} 
                                        onChange={(e) => setAssumptions(prev => ({ ...prev, inflationRate: parseFloat(e.target.value) }))}
                                        className="w-full accent-rose-500"
                                    />
                                    <p className="text-[10px] text-light-text-secondary font-bold uppercase">Annual inflation impact on expenses.</p>
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
                    className="md:col-span-2 md:row-span-2 relative overflow-hidden rounded-[2.5rem] p-8 bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 text-white shadow-2xl border border-white/10 flex flex-col justify-between"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                                <span className="w-8 h-[1px] bg-white/30"></span>
                                Projected Wealth
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-xl">timeline</span>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-6xl font-black tracking-tighter privacy-blur leading-none">
                                {formatCurrency(endBalance, 'EUR')}
                            </h2>
                            <p className="text-xs font-bold uppercase tracking-widest text-white/50 ml-1">
                                Estimated Balance in {forecastDuration === '1Y' ? '1 Year' : forecastDuration}
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 mt-12 flex items-center gap-6">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (endBalance / startBalance) * 100)}%` }}
                                className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                            />
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black tracking-tight">
                                {((endBalance / startBalance - 1) * 100).toFixed(1)}%
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total Growth</p>
                        </div>
                    </div>

                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.1, 0.2, 0.1] }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="absolute -top-1/2 -left-1/4 w-full h-full bg-white/10 rounded-full blur-3xl"
                        />
                    </div>
                </motion.div>

                {/* Net Change Card */}
                <Card className="relative overflow-hidden group flex flex-col justify-between !p-6 border-none shadow-sm bg-white dark:bg-dark-card">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Net Change</p>
                            <h3 className={`text-2xl font-black tracking-tight ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {netChange >= 0 ? '+' : ''}{formatCurrency(netChange, 'EUR')}
                            </h3>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netChange >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            <span className="material-symbols-outlined">{netChange >= 0 ? 'trending_up' : 'trending_down'}</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                        <p className="text-[10px] font-bold text-light-text-secondary uppercase tracking-widest">Over {forecastDuration}</p>
                    </div>
                </Card>

                {/* Goal Progress Card */}
                <Card className="relative overflow-hidden group flex flex-col justify-between !p-6 border-none shadow-sm bg-white dark:bg-dark-card">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Goal Progress</p>
                            <h3 className="text-2xl font-black tracking-tight text-purple-600">
                                {goalProgress.toFixed(0)}%
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-500">
                            <span className="material-symbols-outlined">track_changes</span>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500" style={{ width: `${goalProgress}%` }} />
                        </div>
                        <p className="text-[10px] font-bold text-light-text-secondary uppercase tracking-widest">
                            {formatCurrency(totalGoalSaved, 'EUR')} Saved
                        </p>
                    </div>
                </Card>

                {/* Safety Margin Card */}
                <Card className="relative overflow-hidden group flex flex-col justify-between !p-6 border-none shadow-sm bg-white dark:bg-dark-card">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Safety Margin</p>
                            <h3 className={`text-2xl font-black tracking-tight ${lowestPoint.value < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                {formatCurrency(lowestPoint.value, 'EUR')}
                            </h3>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lowestPoint.value < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            <span className="material-symbols-outlined">shield</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                        <p className="text-[10px] font-bold text-light-text-secondary uppercase tracking-widest">
                            Lowest on {parseLocalDate(lowestPoint.date).toLocaleDateString()}
                        </p>
                    </div>
                </Card>

                {/* Savings Rate Card */}
                <Card className="relative overflow-hidden group flex flex-col justify-between !p-6 border-none shadow-sm bg-white dark:bg-dark-card">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Savings Rate</p>
                            <h3 className="text-2xl font-black tracking-tight text-sky-600">
                                {totalIncomeGoalTarget > 0 ? ((totalSavingsGoalTarget / totalIncomeGoalTarget) * 100).toFixed(1) : 0}%
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-500">
                            <span className="material-symbols-outlined">savings</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                        <p className="text-[10px] font-bold text-light-text-secondary uppercase tracking-widest">Target Monthly Savings</p>
                    </div>
                </Card>
            </div>
            
            <ForecastOverview forecasts={lowestBalanceForecasts} currency="EUR" />

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Cash Flow Forecast</h3>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="font-semibold">{forecastData.length}</span> data points
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
                 <div className="bg-light-fill dark:bg-dark-fill p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                         <div className="p-2 rounded-lg bg-white dark:bg-white/10 shadow-sm text-amber-500">
                             <span className="material-symbols-outlined">flag</span>
                         </div>
                         <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Financial Goals</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none hover:text-primary-500 transition-colors">
                            <input type="checkbox" checked={filterGoalsByAccount} onChange={(e) => setFilterGoalsByAccount(e.target.checked)} className={CHECKBOX_STYLE} />
                            <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Filter by Account</span>
                        </label>
                        <div className="h-4 w-px bg-black/10 dark:bg-white/10"></div>
                        <button onClick={handleToggleAllDisplayed} className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline transition-colors uppercase tracking-wide">
                            {areAllDisplayedSelected ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
                    <div className="bg-white dark:bg-dark-card rounded-xl p-4 border-2 border-emerald-500/20 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-1 relative z-10">
                             <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">GRAND TOTAL INCOME</p>
                             <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm">GLOBAL</span>
                        </div>
                        <div className="flex items-end justify-between relative z-10 mt-2">
                            <div>
                                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">{formatCurrency(totalIncomeGoalCurrent, 'EUR')}</p>
                                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mt-0.5">Total Earned</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-light-text dark:text-dark-text opacity-60">{formatCurrency(totalIncomeGoalTarget, 'EUR')}</p>
                                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">Target <span className="text-emerald-600 dark:text-emerald-400 font-black ml-1">{totalIncomeGoalTarget > 0 ? ((totalIncomeGoalCurrent / totalIncomeGoalTarget) * 100).toFixed(0) : 0}%</span></p>
                            </div>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full mt-4 overflow-hidden relative z-10 border border-black/5 dark:border-white/5 shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${totalIncomeGoalTarget > 0 ? Math.min(100, (totalIncomeGoalCurrent / totalIncomeGoalTarget) * 100) : 0}%` }}
                            ></div>
                        </div>
                        <div className="absolute top-0 right-0 p-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                            <span className="material-symbols-outlined text-7xl">monetization_on</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-dark-card rounded-xl p-4 border-2 border-rose-500/20 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-1 relative z-10">
                             <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">GRAND TOTAL SAVINGS</p>
                             <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-sm">GLOBAL</span>
                        </div>
                        <div className="flex items-end justify-between relative z-10 mt-2">
                            <div>
                                <p className="text-2xl font-black text-rose-700 dark:text-rose-400 tracking-tight">{formatCurrency(totalSavingsGoalCurrent, 'EUR')}</p>
                                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mt-0.5">Total Saved</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-light-text dark:text-dark-text opacity-60">{formatCurrency(totalSavingsGoalTarget, 'EUR')}</p>
                                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">Target <span className="text-rose-600 dark:text-rose-400 font-black ml-1">{totalSavingsGoalTarget > 0 ? ((totalSavingsGoalCurrent / totalSavingsGoalTarget) * 100).toFixed(0) : 0}%</span></p>
                            </div>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full mt-4 overflow-hidden relative z-10 border border-black/5 dark:border-white/5 shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${totalSavingsGoalTarget > 0 ? Math.min(100, (totalSavingsGoalCurrent / totalSavingsGoalTarget) * 100) : 0}%` }}
                            ></div>
                        </div>
                         <div className="absolute top-0 right-0 p-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                            <span className="material-symbols-outlined text-7xl">savings</span>
                        </div>
                    </div>

                    {accountGoalSummary.map(summary => {
                        const progress = Math.min(100, (summary.current / summary.target) * 100);
                        return (
                        <div key={summary.id} className="bg-white dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/5 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                 <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest truncate max-w-[70%]">{summary.name}</p>
                                 <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${summary.type === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                     {summary.type === 'income' ? 'Earnings' : 'Savings'}
                                 </span>
                            </div>
                            <div className="flex items-end justify-between mt-2">
                                <div>
                                    <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(summary.current, summary.currency)}</p>
                                    <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mt-0.5">{summary.type === 'income' ? 'Earned' : 'Saved'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text opacity-60">{formatCurrency(summary.target, summary.currency)}</p>
                                    <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">Target <span className="font-black ml-1">{progress.toFixed(0)}%</span></p>
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full mt-4 overflow-hidden border border-black/5 dark:border-white/5 shadow-inner">
                                <div 
                                    className={`h-full rounded-full ${summary.type === 'income' ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )})}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topLevelGoals.length > 0 ? topLevelGoals.map(goal => {
                        const subGoals = goalsByParentId.get(goal.id) || [];
                        const isEffectivelyActive = goal.isBucket
                        ? activeGoalIds.includes(goal.id) || subGoals.some(sg => activeGoalIds.includes(sg.id))
                        : activeGoalIds.includes(goal.id);

                        return (
                            <FinancialGoalCard 
                                key={goal.id} 
                                goal={goal}
                                subGoals={subGoals}
                                isActive={isEffectivelyActive}
                                onToggle={handleToggleGoal}
                                onEdit={handleOpenModal}
                                onDuplicate={handleDuplicateGoal}
                                onDelete={handleDeleteClick}
                                onAddSubGoal={handleAddSubGoal}
                                accounts={accounts}
                            />
                        );
                    }) : (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white dark:bg-dark-card rounded-3xl border border-dashed border-black/10 dark:border-white/10">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                 <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">flag</span>
                            </div>
                            <h4 className="text-lg font-bold text-light-text dark:text-dark-text mb-1">No Goals Found</h4>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto mb-6">
                                {filterGoalsByAccount ? 'No goals match the selected accounts.' : 'Start planning for your future by adding a financial goal.'}
                            </p>
                            <button onClick={() => handleOpenModal()} className={BTN_SECONDARY_STYLE}>Create New Goal</button>
                        </div>
                    )}
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
                            <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Daily Projections</p>
                        </div>
                    </div>
                     <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                         <div className="flex items-center gap-2 text-[11px] font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full border border-red-100 dark:border-red-900/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            Global Lowest
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-900/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Monthly Lowest
                        </div>
                    </div>
                </div>

                <Card className="overflow-hidden border-0 shadow-xl bg-white dark:bg-dark-card !p-0">
                    <div className="overflow-x-auto max-h-[700px] no-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                             <thead className="sticky top-0 z-30 bg-white/95 dark:bg-[#1E1E20]/95 backdrop-blur-md shadow-sm text-[12px] uppercase font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary border-b border-black/5 dark:border-white/5">
                                <tr>
                                    <th className="px-6 py-5">Date</th>
                                    <th className="px-6 py-5">Origin/Account</th>
                                    <th className="px-6 py-5">Description</th>
                                    <th className="px-6 py-5 text-right">Amount</th>
                                    <th className="px-6 py-5 text-right">Proj. Bal.</th>
                                    <th className="px-6 py-5 text-center">Source</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                                {groupedTableData.map((group) => (
                                    <React.Fragment key={group.monthKey}>
                                        <tr className="bg-light-fill/50 dark:bg-dark-fill/30 sticky top-[53px] z-20 backdrop-blur-sm">
                                            <td colSpan={6} className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[17px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-tighter">
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
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-[14px] font-bold text-light-text dark:text-dark-text">
                                                                {parseLocalDate(row.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-tighter">
                                                                {parseLocalDate(row.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${
                                                                row.type === 'Financial Goal' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                row.type === 'Bill/Payment' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                                'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                                                            }`}>
                                                                <span className="material-symbols-outlined text-sm">{getIcon(row.type)}</span>
                                                            </div>
                                                            <span className="font-bold text-[14px] text-light-text dark:text-dark-text truncate block max-w-[140px] tracking-tight">{row.accountName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="truncate block max-w-[280px] text-[14px] font-medium text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text transition-colors">{row.description}</span>
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-mono text-[14px] ${amountClass}`}>
                                                        {formatCurrency(row.amount, 'EUR', { showPlusSign: true })}
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-mono text-[14px] ${isLowest ? 'text-red-600 dark:text-red-400 font-black' : isMonthlyLowest ? 'text-amber-600 dark:text-amber-400 font-bold' : 'font-bold text-light-text dark:text-dark-text'}`}>
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
                                                    <td className="px-6 py-4 text-center">
                                                         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
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
