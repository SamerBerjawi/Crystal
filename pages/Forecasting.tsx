
import React, { useState, useMemo, useCallback, Dispatch, SetStateAction, useEffect } from 'react';
import {
  Page,
  ContributionPlanStep,
  ScheduledPayment,
  Account,
  RecurringTransaction,
  FinancialGoal,
  RecurringTransactionOverride,
  LoanPaymentOverrides,
  BillPayment,
  ForecastDuration,
} from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, CHECKBOX_STYLE, FORECAST_DURATION_OPTIONS } from '../constants';
import { formatCurrency, convertToEur, generateBalanceForecast, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseDateAsUTC, getPreferredTimeZone, generateSyntheticPropertyTransactions } from '../utils';
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
import { loadGenAiModule } from '../genAiLoader';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useInsightsView } from '../contexts/InsightsViewContext';

// --- AI Planner Hook ---
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

        if (!process.env.API_KEY) {
            setError("The AI Planner is not configured. An API key is required. Please see Settings > AI Assistant for configuration instructions.");
            setIsLoading(false);
            return;
        }

        try {
            const { GoogleGenAI, Type } = await loadGenAiModule();
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const liquidAccounts = accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type));
            const context = {
                current_date: new Date().toISOString().split('T')[0],
                liquid_accounts: liquidAccounts.map(({ name, balance, currency }) => ({ name, balance, currency })),
                recurring_transactions: recurringTransactions.map(({ description, amount, type, frequency, nextDueDate }) => ({ description, amount, type, frequency, nextDueDate })),
                financial_goals: financialGoals.filter(g => g.projection).map(({ name, amount, currentAmount, date, projection }) => ({ name, target_amount: amount, current_amount: currentAmount, target_date: date, projected_status: projection?.status })),
            };

            const prompt = `You are a financial planner. Based on the user's financial data, create a smart contribution plan to help them achieve their goals. 
            Prioritize goals that are "at-risk" or "off-track". Suggest an "Upfront Contribution" if there's enough cash in checking/savings accounts. 
            For shortfalls, add a final step with accountName "Unfunded Shortfall" and notes explaining the situation.
            
            User's Data: ${JSON.stringify(context, null, 2)}`;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    plan: {
                        type: Type.ARRAY,
                        description: "The array of contribution plans for each goal.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                goalName: { type: Type.STRING },
                                steps: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            date: { type: Type.STRING, description: "Contribution date (YYYY-MM) or 'Upfront Contribution'." },
                                            amount: { type: Type.NUMBER },
                                            accountName: { type: Type.STRING, description: "The name of the account to contribute from, or 'Unfunded Shortfall'." },
                                            notes: { type: Type.STRING, description: "Optional notes or warnings." }
                                        },
                                        required: ['date', 'amount', 'accountName']
                                    }
                                }
                            },
                            required: ['goalName', 'steps']
                        }
                    }
                },
                required: ['plan']
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema
                }
            });
            
            const parsedJson = JSON.parse(response.text);
            
            const planObject = parsedJson.plan.reduce((acc: any, goalPlan: {goalName: string, steps: any[]}) => {
                acc[goalPlan.goalName] = goalPlan.steps;
                return acc;
            }, {} as Record<string, ContributionPlanStep[]>);

            setPlan(planObject);

        } catch (err: any) {
            console.error("Error generating smart plan:", err);
            setError(err.message || "An error occurred while generating the plan.");
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

    useEffect(() => {
        setForecastDuration(preferences.defaultForecastPeriod || '1Y');
    }, [preferences.defaultForecastPeriod]);
    
    const selectedAccounts = useMemo(() => 
      accounts.filter(a => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds]);

    // Updated activeGoals to respect the account filter
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
    
    const { allRecurringItems, syntheticItemsOnly } = useMemo(() => {
        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        
        const all = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];
        const synthetic = [...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];
        return { allRecurringItems: all, syntheticItemsOnly: synthetic };
    }, [accounts, transactions, loanPaymentOverrides, recurringTransactions]);

    // 1. Generate Full Forecast (2 Years) - This is the stable base for all views
    const fullForecast = useMemo(() => {
        const projectionEndDate = new Date();
        projectionEndDate.setMonth(projectionEndDate.getMonth() + 24); // 2 years

        return generateBalanceForecast(
            selectedAccounts,
            allRecurringItems,
            activeGoals,
            billsAndPayments,
            projectionEndDate,
            recurringTransactionOverrides
        );
    }, [selectedAccounts, allRecurringItems, activeGoals, billsAndPayments, recurringTransactionOverrides]);

    // 2. Calculate Horizon Data (Dashboard Style - 1M, 3M, 6M, 1Y)
    const lowestBalanceForecasts = useMemo(() => {
        const { chartData } = fullForecast;
        if (chartData.length === 0) return [];

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayStr = new Date().toISOString().split('T')[0];
        const startBalance = chartData[0].value;

        const findNthLowestUniquePoint = (
            data: { date: string; value: number }[],
            n: number,
            excludeValues: number[] = []
        ): { value: number; date: string } | null => {
            if (data.length === 0) return null;
            const uniqueSortedValues = [...new Set(data.map(p => p.value))]
                .filter(v => !excludeValues.includes(v))
                .sort((a, b) => a - b);
            const targetIndex = n - 1;
            if (targetIndex >= uniqueSortedValues.length) {
                const fallbackPoint = data.find(p => !excludeValues.includes(p.value)) 
                                   || data.reduce((min, p) => (p.value < min.value ? p : min), data[0]);
                return fallbackPoint;
            }
            const nthLowestValue = uniqueSortedValues[targetIndex];
            const point = data.find(p => p.value === nthLowestValue);
            return point ? { value: point.value, date: point.date } : null;
        };
    
        const periods = [
            { 
                label: 'This Month', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
            },
            { 
                label: 'Next 3 Months', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0))
            },
            { 
                label: 'Next 6 Months', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 6, 0))
            },
            { 
                label: 'Next Year', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 6, 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 12, 0))
            },
        ];
        
        const results: { period: string; lowestBalance: number; date: string }[] = [];
        const displayedValues: number[] = [];
    
        for (const period of periods) {
            const dataForPeriod = chartData.filter(d => {
                const dDate = parseDateAsUTC(d.date);
                return dDate >= period.startDate && dDate <= period.endDate;
            });
            
            let displayedPoint: { value: number; date: string } | null = null;
            let n = 1;
    
            while(true) {
                const point = findNthLowestUniquePoint(dataForPeriod, n, displayedValues);
                if (!point) {
                     // Fallback to last known if no data in future period (e.g., nothing scheduled)
                     const lastKnown = chartData.find(d => parseDateAsUTC(d.date) < period.startDate);
                     const val = lastKnown ? lastKnown.value : startBalance;
                     displayedPoint = { value: val, date: todayStr };
                     break;
                }
                if (!displayedValues.includes(point.value)) {
                    displayedPoint = point;
                    break;
                }
                n++;
                if (n > 20) { displayedPoint = point; break; } // Safety break
            }
            
            results.push({
                period: period.label,
                lowestBalance: displayedPoint.value,
                date: displayedPoint.date,
            });
            displayedValues.push(displayedPoint.value);
        }
        return results;

    }, [fullForecast]);

    // 3. Derived Data for Chart and Table (Filtered by selected Duration)
    const { forecastData, tableData, lowestPoint, goalsWithProjections, startBalance, endBalance } = useMemo(() => {
        const { chartData, tableData, lowestPoint } = fullForecast;
        
        const goalsWithProjections = financialGoals.map(goal => {
            if (goal.isBucket) return { ...goal, projection: undefined };
            
            const goalDate = goal.date ? parseDateAsUTC(goal.date) : null;
            let projectedDate = 'Beyond forecast';
            let status: 'on-track' | 'at-risk' | 'off-track' = 'off-track';

            for (const point of chartData) {
                if (point.value >= goal.amount) {
                    projectedDate = point.date;
                    if (goalDate) {
                        const projDate = parseDateAsUTC(projectedDate);
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

        const forecastDataForPeriod = chartData.filter(d => parseDateAsUTC(d.date) <= endDate);
        const tableDataForPeriod = tableData.filter(d => parseDateAsUTC(d.date) <= endDate);

        let lowestPointInPeriod = { value: Infinity, date: '' };
        if (forecastDataForPeriod.length > 0) {
            lowestPointInPeriod = forecastDataForPeriod.reduce((min, p) => p.value < min.value ? { value: p.value, date: p.date } : min, { value: forecastDataForPeriod[0].value, date: forecastDataForPeriod[0].date });
        }
        
        const startBal = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[0].value : 0;
        const endBal = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[forecastDataForPeriod.length - 1].value : 0;

        return { 
            forecastData: forecastDataForPeriod, 
            tableData: tableDataForPeriod, 
            lowestPoint: lowestPointInPeriod, 
            goalsWithProjections,
            startBalance: startBal,
            endBalance: endBal
        };
    }, [fullForecast, financialGoals, forecastDuration]);
    
    const majorUpcomingOutflows = useMemo(() => {
        const endDate = new Date();
        switch (forecastDuration) {
            case '3M': endDate.setMonth(endDate.getMonth() + 3); break;
            case '6M': endDate.setMonth(endDate.getMonth() + 6); break;
            case 'EOY': endDate.setFullYear(endDate.getFullYear(), 11, 31); break;
            case '1Y': endDate.setFullYear(endDate.getFullYear() + 1); break;
        }
        const today = new Date();

        const outflows: any[] = [];

        // 1. Recurring
        allRecurringItems.forEach(rt => {
            if (rt.type !== 'expense' && rt.type !== 'transfer') return;
            if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(rt.accountId)) return;
            
            const nextDue = parseDateAsUTC(rt.nextDueDate);
            if (nextDue >= today && nextDue <= endDate) {
                outflows.push({
                    name: rt.description,
                    amount: Math.abs(rt.amount),
                    date: rt.nextDueDate,
                    isRecurring: true
                });
            }
        });

        // 2. Bills
        billsAndPayments.forEach(bill => {
            if (bill.status === 'paid') return;
            if (bill.type !== 'payment') return;
            if (selectedAccountIds.length > 0 && bill.accountId && !selectedAccountIds.includes(bill.accountId)) return;

            const due = parseDateAsUTC(bill.dueDate);
            if (due >= today && due <= endDate) {
                 outflows.push({
                    name: bill.description,
                    amount: Math.abs(bill.amount),
                    date: bill.dueDate,
                    isRecurring: false
                });
            }
        });
        
        return outflows.sort((a, b) => b.amount - a.amount).slice(0, 5);

    }, [forecastDuration, allRecurringItems, billsAndPayments, selectedAccountIds]);

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
    
    const handleDeleteClick = (goalId: string) => {
        const goal = financialGoals.find(g => g.id === goalId);
        if (goal) setDeletingGoal(goal);
    };

    const handleConfirmDelete = () => {
        if (!deletingGoal) return;
        deleteFinancialGoal(deletingGoal.id);
        setDeletingGoal(null);
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

            {/* Header */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                     <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Financial Forecast</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Project your future balance and plan for goals.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto flex-wrap">
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
                     <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg h-10 flex-shrink-0 w-full sm:w-auto">
                             <button onClick={() => setShowIndividualLines(false)} className={`${segmentItemBase} ${!showIndividualLines ? segmentItemActive : segmentItemInactive}`}>Consolidated</button>
                             <button onClick={() => setShowIndividualLines(true)} className={`${segmentItemBase} ${showIndividualLines ? segmentItemActive : segmentItemInactive}`}>Individual</button>
                    </div>
                    <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex-shrink-0 whitespace-nowrap w-full sm:w-auto h-10`}>
                        <span className="material-symbols-outlined text-xl mr-2">add</span>
                        Add Goal
                    </button>
                </div>
            </header>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Projected End Balance" 
                    value={formatCurrency(endBalance, 'EUR')} 
                    subValue={forecastDuration === '1Y' ? 'In 1 Year' : `At end of ${forecastDuration}`}
                    icon="flag"
                    colorClass="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
                />
                <MetricCard 
                    title="Net Change" 
                    value={`${netChange >= 0 ? '+' : ''}${formatCurrency(netChange, 'EUR')}`}
                    subValue="Over selected period"
                    icon="trending_up"
                    trend={netChange >= 0 ? 'up' : 'down'}
                    colorClass={netChange >= 0 ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30" : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"}
                />
                <MetricCard 
                    title="Total Goal Progress" 
                    value={`${goalProgress.toFixed(0)}%`} 
                    subValue={`${formatCurrency(totalGoalSaved, 'EUR')} of ${formatCurrency(totalGoalTarget, 'EUR')}`}
                    icon="track_changes"
                    colorClass="text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30"
                />
                 <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Safety Margin</span>
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-opacity-20 transition-transform duration-300 group-hover:scale-110 ${lowestPoint.value < 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600 dark:text-orange-400'}`}>
                            <span className="material-symbols-outlined text-xl">shield</span>
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className={`text-2xl font-extrabold tracking-tight ${lowestPoint.value < 0 ? 'text-red-600' : 'text-light-text dark:text-dark-text'}`}>{formatCurrency(lowestPoint.value, 'EUR')}</p>
                        <p className="text-xs font-medium mt-1 opacity-80">Lowest on {parseDateAsUTC(lowestPoint.date).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>
            
            {/* Forecast Horizon */}
            <ForecastOverview forecasts={lowestBalanceForecasts} currency="EUR" />

            {/* Main Chart */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Cash Flow Forecast</h3>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="font-semibold">{forecastData.length}</span> data points
                    </div>
                </div>
                <ForecastChart 
                    data={forecastData} 
                    lowestPoint={lowestPoint} 
                    oneTimeGoals={activeGoals.filter(g => g.type === 'one-time')} 
                    showIndividualLines={showIndividualLines}
                    accounts={selectedAccounts}
                    showGoalLines={showGoalLines}
                    onDataPointClick={handleDateClick}
                />
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Goals Section */}
                <div className="lg:col-span-2 space-y-6">
                     <div className="flex flex-wrap justify-between items-center gap-4">
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Financial Goals</h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none hover:text-primary-500 transition-colors">
                                <input type="checkbox" checked={filterGoalsByAccount} onChange={(e) => setFilterGoalsByAccount(e.target.checked)} className={CHECKBOX_STYLE} />
                                <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Filter by Account</span>
                            </label>
                            <button onClick={handleToggleAllDisplayed} className="text-sm font-semibold text-primary-500 hover:underline transition-colors">
                                {areAllDisplayedSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    onDelete={handleDeleteClick}
                                    onAddSubGoal={handleAddSubGoal}
                                    accounts={accounts}
                                />
                            );
                        }) : (
                            <div className="col-span-full text-center py-12 bg-light-card/50 dark:bg-dark-card/30 rounded-2xl border-2 border-dashed border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500">
                                    <span className="material-symbols-outlined text-3xl">flag</span>
                                </div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">
                                    {filterGoalsByAccount ? 'No goals found for the selected accounts.' : 'No financial goals created yet.'}
                                </p>
                                <button onClick={() => handleOpenModal()} className={BTN_SECONDARY_STYLE}>Create Goal</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Major Expenses & AI Planner */}
                <div className="space-y-6">
                     {/* Major Expenses */}
                     <Card>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500">payments</span>
                            Major Upcoming Outflows
                        </h3>
                         <div className="space-y-3">
                            {majorUpcomingOutflows.length > 0 ? majorUpcomingOutflows.map(item => (
                                <div key={`${item.name}-${item.date}-${item.amount}`} className="flex justify-between items-center p-3 rounded-xl bg-light-bg dark:bg-dark-bg/50 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/10 cursor-default group">
                                    <div className="min-w-0 pr-4">
                                        <p className="font-bold text-sm text-light-text dark:text-dark-text truncate">{item.name}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1 mt-0.5">
                                            <span className="material-symbols-outlined text-[10px]">{item.isRecurring ? 'repeat' : 'receipt'}</span>
                                            {parseDateAsUTC(item.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <p className="font-mono font-bold text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">{formatCurrency(item.amount, 'EUR')}</p>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                    <span className="material-symbols-outlined text-3xl mb-2">check_circle</span>
                                    <p className="text-sm">No major outflows found.</p>
                                </div>
                            )}
                         </div>
                     </Card>

                     {/* AI Planner */}
                     <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                             <span className="material-symbols-outlined text-8xl text-indigo-500">psychology</span>
                         </div>
                         <div className="relative z-10">
                             <div className="flex items-center gap-2 mb-3">
                                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">
                                     <span className="material-symbols-outlined text-xl">smart_toy</span>
                                  </div>
                                  <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200">Smart Planner</h3>
                             </div>
                            <p className="text-sm text-indigo-800 dark:text-indigo-300 mb-5 leading-relaxed">
                                Generate a step-by-step contribution plan to reach your goals based on your projected cash flow.
                            </p>
                            <button onClick={generatePlan} className={`${BTN_PRIMARY_STYLE} w-full justify-center py-3 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30`} disabled={isPlanLoading}>
                                {isPlanLoading ? (
                                    <div className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Analyzing...
                                    </div>
                                ) : 'Generate Plan'}
                            </button>
                            <div className="mt-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                 <GoalContributionPlan plan={plan} isLoading={isPlanLoading} error={planError} />
                            </div>
                         </div>
                     </Card>
                </div>
            </div>
            
            {/* Detailed Forecast Data Section */}
            <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-dark-card">
                <div className="p-6 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Forecast Ledger</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Daily breakdown of projected transactions</p>
                    </div>
                     <div className="flex items-center gap-2 text-xs font-medium bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        Lowest Balance Point Highlighted
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-sm text-left">
                         <thead className="sticky top-0 z-20 bg-gray-50/95 dark:bg-black/40 backdrop-blur-md text-xs uppercase font-bold tracking-wider text-light-text-secondary dark:text-dark-text-secondary border-b border-black/5 dark:border-white/5 shadow-sm">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Account</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-right">Run. Bal.</th>
                                <th className="px-6 py-4 text-center">Type</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {tableData.map(row => {
                                const isLowest = row.balance.toFixed(2) === lowestPoint.value.toFixed(2);
                                const isGoal = row.type === 'Financial Goal';
                                
                                let rowBg = 'hover:bg-black/5 dark:hover:bg-white/5';
                                if (isLowest) rowBg = 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20';
                                else if (isGoal) rowBg = 'bg-yellow-50/30 dark:bg-yellow-900/10 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/20';

                                const amountClass = row.amount >= 0 
                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium' 
                                    : 'text-rose-600 dark:text-rose-400 font-medium';

                                return (
                                    <tr 
                                        key={row.id} 
                                        className={`cursor-pointer transition-colors duration-150 group ${rowBg}`}
                                        onClick={() => handleEditForecastItem(row)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text transition-colors">
                                            {parseDateAsUTC(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-light-text dark:text-dark-text truncate block max-w-[140px]">{row.accountName}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="truncate block max-w-[200px] text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text transition-colors">{row.description}</span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-mono ${amountClass}`}>
                                            {formatCurrency(row.amount, 'EUR')}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-mono font-bold ${isLowest ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                                            {formatCurrency(row.balance, 'EUR')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                             <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                                row.type === 'Financial Goal' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                                row.type === 'Bill/Payment' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' :
                                                'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                            }`}>
                                                {row.type === 'Financial Goal' ? 'Goal' : row.type === 'Bill/Payment' ? 'Bill' : 'Recurring'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {tableData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-light-text-secondary dark:text-dark-text-secondary italic">
                                        No forecast data available for the selected period.
                                    </td>
                                </tr>
                            )}
                         </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default React.memo(Forecasting);
