
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
import { loadGenAiModule } from '../genAiLoader';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';

interface ForecastingProps {
  activeGoalIds: string[];
  setActiveGoalIds: React.Dispatch<React.SetStateAction<string[]>>;
}

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


const Forecasting: React.FC<ForecastingProps> = ({ activeGoalIds, setActiveGoalIds }) => {
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

    const { forecastData, tableData, lowestPoint, goalsWithProjections, summaryMetrics } = useMemo(() => {
        const projectionEndDate = new Date();
        projectionEndDate.setMonth(projectionEndDate.getMonth() + 12); // Align with 12-month schedule horizon
        projectionEndDate.setFullYear(new Date().getFullYear() + 2); // Capped at 2 years for performance

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const syntheticPropertyTransactions = generateSyntheticPropertyTransactions(accounts);
        const allRecurringItems = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments, ...syntheticPropertyTransactions];

        const { chartData: fullData, tableData: fullTableData } = generateBalanceForecast(
            selectedAccounts,
            allRecurringItems,
            activeGoals,
            billsAndPayments,
            projectionEndDate,
            recurringTransactionOverrides
        );

        const goalsWithProjections = financialGoals.map(goal => {
            if (goal.isBucket) { // Projections for buckets are calculated separately
                return { ...goal, projection: undefined };
            }
            const goalDate = goal.date ? parseDateAsUTC(goal.date) : null;
            let projectedDate = 'Beyond forecast';
            let status: 'on-track' | 'at-risk' | 'off-track' = 'off-track';

            for (const point of fullData) {
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

        const forecastDataForPeriod = fullData.filter(d => parseDateAsUTC(d.date) <= endDate);
        const tableDataForPeriod = fullTableData.filter(d => parseDateAsUTC(d.date) <= endDate);

        let lowestPointInPeriod = { value: Infinity, date: '' };
        if (forecastDataForPeriod.length > 0) {
            lowestPointInPeriod = forecastDataForPeriod.reduce((min, p) => p.value < min.value ? { value: p.value, date: p.date } : min, { value: forecastDataForPeriod[0].value, date: forecastDataForPeriod[0].date });
        }
        
        // Summary Metrics
        const startValue = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[0].value : 0;
        const endValue = forecastDataForPeriod.length > 0 ? forecastDataForPeriod[forecastDataForPeriod.length - 1].value : 0;
        const netChange = endValue - startValue;

        return { 
            forecastData: forecastDataForPeriod, 
            tableData: tableDataForPeriod, 
            lowestPoint: lowestPointInPeriod, 
            goalsWithProjections,
            summaryMetrics: { startValue, endValue, netChange }
        };
    }, [selectedAccounts, recurringTransactions, recurringTransactionOverrides, loanPaymentOverrides, activeGoals, billsAndPayments, financialGoals, forecastDuration, accounts, transactions]);

    // Also filter goals passed to the planner to stay consistent with the view
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
            // Deselect all visible
            const visibleIds = new Set(displayedGoals.map(g => g.id));
            setActiveGoalIds(prev => prev.filter(id => !visibleIds.has(id)));
        } else {
            // Select all visible
            const visibleIds = displayedGoals.map(g => g.id);
            setActiveGoalIds(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    // New Logic for Chart Interactivity
    const handleDateClick = (date: string) => {
        setSelectedForecastDate(date);
    };

    const selectedDayItems = useMemo(() => {
        if (!selectedForecastDate) return [];
        return tableData.filter(item => item.date === selectedForecastDate);
    }, [selectedForecastDate, tableData]);

    const handleEditForecastItem = (item: any) => {
        setSelectedForecastDate(null); // Close date modal
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
        // Currently generic 'Add New' from modal opens Recurring modal. 
        // In future this could show a selection menu (Bill, Recurring, Goal).
        setEditingRecurring(null);
        // Pre-fill start date if adding a new recurring tx
        setIsRecurringModalOpen(true);
    };

    const durationOptions = FORECAST_DURATION_OPTIONS;

    return (
        <div className="space-y-8 pb-8">
            {/* Modals */}
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

            <header className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Forecasting</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Project your cash flow and plan for financial goals.</p>
                </div>
                
                 {/* Enhanced Control Bar */}
                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col xl:flex-row items-start xl:items-center gap-6">
                    
                    {/* Filter Group 1: Scope */}
                    <div className="flex flex-col sm:flex-row gap-6 w-full xl:w-auto flex-1">
                        <div className="flex-1 sm:flex-none min-w-[240px]">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Accounts</label>
                            <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                        </div>

                        <div className="flex-1 sm:flex-none">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Forecast Period</label>
                             <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                {durationOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setForecastDuration(opt.value)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${forecastDuration === opt.value ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                     <div className="w-full h-px xl:w-px xl:h-12 bg-gray-200 dark:bg-gray-700 hidden md:block"></div>

                    {/* Filter Group 2: Display */}
                    <div className="flex flex-wrap items-end gap-4 w-full xl:w-auto">
                         <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Chart Mode</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                <button onClick={() => setShowIndividualLines(false)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${!showIndividualLines ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>Total</button>
                                <button onClick={() => setShowIndividualLines(true)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${showIndividualLines ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>Split</button>
                            </div>
                        </div>

                        <div>
                             <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Overlay</label>
                            <button 
                                onClick={() => setShowGoalLines(!showGoalLines)}
                                className={`h-[36px] px-4 rounded-lg border transition-colors flex items-center gap-2 ${showGoalLines ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <span className={`material-symbols-outlined text-xl ${showGoalLines ? 'material-symbols-filled' : ''}`}>flag</span>
                                <span className="text-sm font-medium">Goals</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow xl:flex-grow-0 text-right">
                         <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} h-[42px] flex items-center gap-2 px-6 shadow-lg shadow-primary-500/20`}>
                            <span className="material-symbols-outlined">add_circle</span>
                            Add Goal
                        </button>
                    </div>
                </div>
            </header>
            
            {/* KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="relative overflow-hidden !p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><span className="material-symbols-outlined text-6xl">savings</span></div>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Projected End Balance</p>
                    <h2 className="text-3xl font-bold">{formatCurrency(summaryMetrics.endValue, 'EUR')}</h2>
                    <p className="text-emerald-100 text-xs mt-1 opacity-80">At end of period</p>
                </Card>

                <Card className={`relative overflow-hidden !p-5 border-none ${summaryMetrics.netChange >= 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-orange-500 to-red-600'} text-white`}>
                     <div className="absolute top-0 right-0 p-3 opacity-10"><span className="material-symbols-outlined text-6xl">trending_up</span></div>
                    <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">Net Change</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-3xl font-bold">{summaryMetrics.netChange >= 0 ? '+' : ''}{formatCurrency(summaryMetrics.netChange, 'EUR')}</h2>
                    </div>
                     <p className="text-white/70 text-xs mt-1 opacity-80">vs. current balance</p>
                </Card>

                <Card className={`relative overflow-hidden !p-5 border-none ${lowestPoint.value < 0 ? 'bg-gradient-to-br from-rose-500 to-pink-600' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900'} ${lowestPoint.value < 0 ? 'text-white' : 'text-light-text dark:text-dark-text'}`}>
                     <div className="absolute top-0 right-0 p-3 opacity-10"><span className="material-symbols-outlined text-6xl">warning</span></div>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${lowestPoint.value < 0 ? 'text-rose-100' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>Lowest Point</p>
                    <h2 className="text-3xl font-bold">{formatCurrency(lowestPoint.value, 'EUR')}</h2>
                     <p className={`text-xs mt-1 opacity-80 ${lowestPoint.value < 0 ? 'text-rose-100' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                        on {parseDateAsUTC(lowestPoint.date).toLocaleDateString()}
                    </p>
                </Card>
            </div>

            {/* Chart Section */}
            <Card className="p-0 overflow-hidden border border-black/5 dark:border-white/10">
                <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                         <span className="material-symbols-outlined text-primary-500">ssid_chart</span>
                         Cash Flow Forecast
                    </h3>
                </div>
                <div className="p-6">
                    <ForecastChart 
                        data={forecastData} 
                        lowestPoint={lowestPoint} 
                        oneTimeGoals={activeGoals.filter(g => g.type === 'one-time')} 
                        showIndividualLines={showIndividualLines}
                        accounts={selectedAccounts}
                        showGoalLines={showGoalLines}
                        onDataPointClick={handleDateClick}
                    />
                </div>
            </Card>
            
            {/* Split View: Goals & Strategy */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Goals Column */}
                <div className="lg:col-span-2 space-y-6">
                     <div className="flex flex-wrap justify-between items-center gap-4">
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Financial Goals</h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={filterGoalsByAccount} 
                                    onChange={(e) => setFilterGoalsByAccount(e.target.checked)} 
                                    className={CHECKBOX_STYLE}
                                />
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Filter by Account</span>
                            </label>
                            <button onClick={handleToggleAllDisplayed} className="text-sm font-semibold text-primary-500 hover:underline">
                                {areAllDisplayedSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="col-span-full p-8 bg-light-card dark:bg-dark-card rounded-xl border border-dashed border-light-separator dark:border-dark-separator text-center text-light-text-secondary dark:text-dark-text-secondary">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">flag</span>
                                <p>{filterGoalsByAccount ? 'No goals found for the selected accounts.' : 'No financial goals created yet.'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Strategy & Details Column */}
                <div className="space-y-6">
                    <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-dark-card border border-indigo-100 dark:border-indigo-800">
                        <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <span className="material-symbols-outlined">psychology</span>
                             </div>
                             <div>
                                 <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">AI Strategy</h3>
                                 <p className="text-xs text-indigo-600 dark:text-indigo-300">Smart Contribution Plan</p>
                             </div>
                        </div>
                        
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                            Let AI analyze your cash flow and suggest the best way to fund your goals without running out of money.
                        </p>
                        
                        <button onClick={generatePlan} className={`${BTN_PRIMARY_STYLE} w-full flex items-center justify-center gap-2 mb-4`} disabled={isPlanLoading}>
                            {isPlanLoading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> : <span className="material-symbols-outlined text-lg">auto_awesome</span>}
                            {isPlanLoading ? 'Analyzing...' : 'Generate Plan'}
                        </button>
                        
                        <GoalContributionPlan plan={plan} isLoading={isPlanLoading} error={planError} />
                    </Card>
                </div>
            </div>

             {/* Full Width Data Table */}
             <Card className="overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary-500">table_view</span>
                            Detailed Forecast Data
                        </h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            Daily breakdown of projected balances and transactions.
                        </p>
                    </div>
                </div>
                
                <div className="overflow-x-auto max-h-[600px] border border-gray-200 dark:border-gray-700 rounded-xl">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                                <th className="px-6 py-3 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-dark-card">
                            {tableData.slice(0, 100).map(row => (
                                <tr key={row.id} onClick={() => handleEditForecastItem(row)} className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                    <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                                        {parseDateAsUTC(row.date, timeZone).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-3">
                                        <p className="truncate max-w-[300px] font-medium">{row.description}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{row.accountName}</p>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            row.type === 'Financial Goal' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                                            row.type === 'Recurring' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                            'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                        }`}>
                                            {row.type}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-3 text-right font-medium ${row.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatCurrency(row.amount, 'EUR', { showPlusSign: true })}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-medium text-gray-700 dark:text-gray-300">
                                        {formatCurrency(row.balance, 'EUR')}
                                    </td>
                                </tr>
                            ))}
                            {tableData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No forecast data available for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {tableData.length > 100 && (
                        <div className="p-4 text-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <p className="text-sm text-gray-500">Showing first 100 items. Filter duration to see more specific details.</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default React.memo(Forecasting);
