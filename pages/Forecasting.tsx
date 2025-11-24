
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
import { formatCurrency, convertToEur, generateBalanceForecast, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseDateAsUTC, getPreferredTimeZone } from '../utils';
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

    const { forecastData, tableData, lowestPoint, goalsWithProjections } = useMemo(() => {
        const projectionEndDate = new Date();
        projectionEndDate.setMonth(projectionEndDate.getMonth() + 12); // Align with 12-month schedule horizon
        projectionEndDate.setFullYear(new Date().getFullYear() + 2); // Capped at 2 years for performance

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
        const syntheticCreditCardPayments = generateSyntheticCreditCardPayments(accounts, transactions);
        const allRecurringItems = [...recurringTransactions, ...syntheticLoanPayments, ...syntheticCreditCardPayments];

        const { chartData: fullData, tableData: fullTableData, lowestPoint: overallLowestPoint } = generateBalanceForecast(
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

        return { forecastData: forecastDataForPeriod, tableData: tableDataForPeriod, lowestPoint: lowestPointInPeriod, goalsWithProjections };
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

    // Styles for the segmented controls
    const segmentItemBase = "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center whitespace-nowrap";
    const segmentItemActive = "bg-light-card dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400 font-semibold";
    const segmentItemInactive = "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text";

    return (
        <div className="space-y-8">
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

            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Project your financial future and plan for your goals.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto flex-wrap">
                    
                    {/* 1. Account Filter */}
                    <div className="w-full sm:w-auto">
                         <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                    </div>
                    
                    {/* 2. View Mode Segmented Control */}
                    <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg h-10 flex-shrink-0 w-full sm:w-auto border border-black/5 dark:border-white/10">
                             <button 
                                onClick={() => setShowIndividualLines(false)} 
                                className={`${segmentItemBase} ${!showIndividualLines ? segmentItemActive : segmentItemInactive}`}
                            >
                                Consolidated
                            </button>
                            <button 
                                onClick={() => setShowIndividualLines(true)} 
                                className={`${segmentItemBase} ${showIndividualLines ? segmentItemActive : segmentItemInactive}`}
                            >
                                Individual
                            </button>
                    </div>
                    
                    {/* 3. Goals Toggle */}
                    <button 
                            onClick={() => setShowGoalLines(!showGoalLines)}
                            className={`h-10 px-4 flex items-center justify-center gap-2 rounded-lg transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary-500 flex-shrink-0 w-full sm:w-auto ${showGoalLines ? 'border-black/5 dark:border-white/10 bg-light-card dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400 font-semibold' : 'border-black/5 dark:border-white/10 bg-light-fill dark:bg-dark-fill text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5'}`}
                            title={showGoalLines ? "Hide goal lines" : "Show goal lines"}
                        >
                             <span className={`material-symbols-outlined text-xl ${showGoalLines ? 'material-symbols-filled' : ''}`}>flag</span>
                             <span className="text-sm">Goals</span>
                        </button>

                    {/* 4. Time Range Segmented Control */}
                    <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg h-10 flex-shrink-0 w-full sm:w-auto overflow-x-auto no-scrollbar border border-black/5 dark:border-white/10">
                        {durationOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setForecastDuration(opt.value)}
                                className={`${segmentItemBase} ${forecastDuration === opt.value ? segmentItemActive : segmentItemInactive}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    
                    {/* 5. Add Goal Button */}
                    <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex-shrink-0 whitespace-nowrap w-full sm:w-auto h-10`}>
                        <span className="material-symbols-outlined text-xl mr-2">add</span>
                        Add Goal
                    </button>
                </div>
            </header>

            <Card>
                <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Cash Flow Forecast</h3>
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

            <Card>
                <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Forecast Details</h3>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-light-card dark:bg-dark-card z-10">
                            <tr className="border-b border-light-separator dark:border-dark-separator">
                                <th className="p-2 font-semibold text-left">Date</th>
                                <th className="p-2 font-semibold text-left">Account</th>
                                <th className="p-2 font-semibold text-left">Description</th>
                                <th className="p-2 font-semibold text-right">Amount</th>
                                <th className="p-2 font-semibold text-right">Balance</th>
                                <th className="p-2 font-semibold text-left">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map(row => {
                                const isLowest = row.balance.toFixed(2) === lowestPoint.value.toFixed(2);
                                const rowClass = `border-b border-light-separator/50 dark:border-dark-separator/50 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer
                                    ${row.isGoal ? 'bg-yellow-100/50 dark:bg-yellow-900/20' : ''}
                                    ${isLowest ? 'bg-red-100/50 dark:bg-red-900/20' : ''}`;
                                return (
                                    <tr key={row.id} className={rowClass} onClick={() => handleEditForecastItem(row)}>
                                        <td className="p-2 whitespace-nowrap">{parseDateAsUTC(row.date, timeZone).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone })}</td>
                                        <td className="p-2">{row.accountName}</td>
                                        <td className="p-2">{row.description}</td>
                                        <td className={`p-2 text-right font-mono ${row.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(row.amount, 'EUR')}</td>
                                        <td className={`p-2 text-right font-mono ${isLowest ? 'font-bold' : ''}`}>{formatCurrency(row.balance, 'EUR')}</td>
                                        <td className="p-2">{row.type}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {tableData.length === 0 && <p className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">No forecast data to display for the selected period.</p>}
                </div>
            </Card>

            <div className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topLevelGoals.length > 0 ? topLevelGoals.map(goal => {
                        const subGoals = goalsByParentId.get(goal.id) || [];
                        // A bucket's toggle is active if ANY of its children are active OR if the bucket itself is active.
                        // This allows the UI to reflect a partially-active state.
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
                        <p className="text-light-text-secondary dark:text-dark-text-secondary col-span-full text-center py-8">
                            {filterGoalsByAccount ? 'No goals found for the selected accounts.' : 'No financial goals created yet.'}
                        </p>
                    )}
                </div>
            </div>

            <Card>
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Smart Contribution Plan</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Let AI generate a step-by-step plan to reach your goals.</p>
                    </div>
                    <button onClick={generatePlan} className={BTN_PRIMARY_STYLE} disabled={isPlanLoading}>
                        {isPlanLoading ? 'Generating...' : 'Generate Smart Plan'}
                    </button>
                </div>
                <GoalContributionPlan plan={plan} isLoading={isPlanLoading} error={planError} />
            </Card>
        </div>
    );
};

export default React.memo(Forecasting);
