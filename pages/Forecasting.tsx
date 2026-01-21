
import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Currency,
  Transaction,
} from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, CHECKBOX_STYLE, FORECAST_DURATION_OPTIONS } from '../constants';
import { calculateForecastHorizon, formatCurrency, convertToEur, generateBalanceForecast, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, parseLocalDate, getPreferredTimeZone, generateSyntheticPropertyTransactions, toLocalISOString } from '../utils';
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
import PageHeader from '../components/PageHeader';
import { v4 as uuidv4 } from 'uuid';

// --- AI Planner Hook ---
const useSmartGoalPlanner = (
    accounts: Account[],
    recurringTransactions: RecurringTransaction[],
    financialGoals: FinancialGoal[]
) => {
    const [plan, setPlan] = useState<Record<string, ContributionPlanStep[]> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { preferences } = usePreferencesContext();

    const generatePlan = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setPlan(null);

        const apiKey = process.env.API_KEY || preferences.geminiApiKey;

        if (!apiKey) {
            setError("The AI Planner is not configured. An API key is required. Please see Settings > Integrations.");
            setIsLoading(false);
            return;
        }

        try {
            const { GoogleGenAI, Type } = await loadGenAiModule();
            const ai = new GoogleGenAI({ apiKey });
            
            const liquidAccounts = accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type));
            const context = {
                current_date: toLocalISOString(new Date()),
                liquid_accounts: liquidAccounts.map(({ name, balance, currency }) => ({ name, balance, currency })),
                recurring_transactions: recurringTransactions.map(({ description, amount, type, frequency, nextDueDate }) => ({ description, amount, type, frequency, nextDueDate })),
                financial_goals: financialGoals.filter(g => g.projection).map(({ name, type, amount, currentAmount, date, startDate, projection }) => ({ name, type, amount, currentAmount, date, startDate, projected_status: projection?.status })),
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
    }, [accounts, recurringTransactions, financialGoals, preferences.geminiApiKey]);
    
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

    // 0. Calculate Historical Data (D-7 to D-1)
    const historyData = useMemo(() => {
      if (selectedAccounts.length === 0) return [];

      const today = new Date();
      // Ensure we treat "today" as local date to match transaction dates
      const todayDate = parseLocalDate(toLocalISOString(today));
      const pastDays = 7;
      const historyPoints: any[] = [];
      const selectedAccountIdsSet = new Set(selectedAccountIds);

      // Start with current balances
      const currentBalances: Record<string, number> = {};
      let runningTotal = 0;
      selectedAccounts.forEach(acc => {
          const val = convertToEur(acc.balance, acc.currency);
          currentBalances[acc.id] = val;
          runningTotal += val;
      });

      // Filter relevant transactions
      const relevantTransactions = transactions.filter(tx => 
          selectedAccountIdsSet.has(tx.accountId)
      );

      // Map transactions by date for quick lookup
      // Since we need to 'rewind' from Today's balance, we need transactions from Today backwards.
      const txsByDate = new Map<string, Transaction[]>();
      relevantTransactions.forEach(tx => {
          const d = tx.date;
          if (!txsByDate.has(d)) txsByDate.set(d, []);
          txsByDate.get(d)!.push(tx);
      });

      // Iterate backwards from Today to D-7
      // Logic: Balance(Start of Day T) = Balance(End of Day T) - Transactions(Day T)
      // We assume account.balance is "Current Balance" (End of Today effectively, or Now).
      // So to get yesterday's closing balance, we subtract today's transactions.
      
      let iterDate = new Date(todayDate);

      // We go back 7 days.
      // i=0 corresponds to Today. We calculate Start of Today (which is End of Yesterday)
      // i=1 corresponds to Yesterday. We calculate Start of Yesterday (End of D-2)
      for (let i = 0; i < pastDays; i++) {
          const dateStr = toLocalISOString(iterDate);
          
          // Transactions that happened on `iterDate` contributed to the `currentBalances`.
          // To rewind to the start of `iterDate` (or end of `iterDate - 1`), we subtract the effect of `iterDate` transactions.
          const todaysTxs = txsByDate.get(dateStr) || [];

          todaysTxs.forEach(tx => {
              const amountEur = convertToEur(tx.amount, tx.currency);
              
              if (currentBalances[tx.accountId] !== undefined) {
                  // Reverse the transaction: if it was income (+), subtract. If expense (-), add.
                  currentBalances[tx.accountId] -= amountEur; 
              }
              runningTotal -= amountEur;
          });

          // The balances now represent the state at the BEGINNING of `iterDate` (or end of previous day).
          // We want to plot this as the data point for `iterDate - 1 day`.
          
          const plottingDate = new Date(iterDate);
          plottingDate.setDate(plottingDate.getDate() - 1);
          const plottingDateStr = toLocalISOString(plottingDate);

          const dataPoint: any = {
              date: plottingDateStr,
              value: runningTotal,
              dailySummary: [], // No forecast summary for history
              isHistorical: true
          };
          
          // Add individual account balances
          Object.entries(currentBalances).forEach(([accId, bal]) => {
              dataPoint[accId] = bal;
          });

          historyPoints.unshift(dataPoint);
          
          // Move iterDate back by one day for next iteration
          iterDate.setDate(iterDate.getDate() - 1);
      }

      return historyPoints;
    }, [selectedAccounts, selectedAccountIds, transactions]);


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
        return calculateForecastHorizon(fullForecast.chartData);
    }, [fullForecast]);

    // 3. Derived Data for Chart and Table (Filtered by selected Duration)
    const { forecastData, tableData, lowestPoint, goalsWithProjections, startBalance, endBalance } = useMemo(() => {
        const { chartData, tableData, lowestPoint } = fullForecast;
        
        // Merge History with Forecast Chart Data
        const mergedChartData = [...historyData, ...chartData];

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

        // Filter Chart Data (History is kept, future is clipped)
        // We show all history (7 days) + forecast up to limit
        const forecastDataForPeriod = mergedChartData.filter(d => parseLocalDate(d.date) <= endDate);
        
        // Table data usually only shows future items
        const tableDataForPeriod = tableData.filter(d => parseLocalDate(d.date) <= endDate);

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
    }, [fullForecast, financialGoals, forecastDuration, historyData]);
    
    // Account Goal Allocation Summary
    const accountGoalSummary = useMemo(() => {
        const summary: Record<string, { id: string; name: string; current: number; target: number; currency: Currency; goalsCount: number; type: 'income' | 'expense' }> = {};
        
        financialGoals.forEach(g => {
            if (g.isBucket) return;
            const isVisible = !filterGoalsByAccount || !g.paymentAccountId || selectedAccountIds.includes(g.paymentAccountId);
            if (!isVisible) return;

            const accId = g.paymentAccountId || 'unlinked';
            const type = g.transactionType; // 'income' | 'expense'
            // Create a unique key for account + type combination
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
            // Respect account filters for grand totals if the checkbox is checked
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

    const majorUpcomingOutflows = useMemo(() => {
        const endDate = new Date();
        switch (forecastDuration) {
            case '3M': endDate.setMonth(endDate.getMonth() + 3); break;
            case '6M': endDate.setMonth(endDate.getMonth() + 6); break;
            case 'EOY': endDate.setFullYear(endDate.getFullYear(), 11, 31); break;
            case '1Y': endDate.setFullYear(endDate.getFullYear() + 1); break;
        }
        const today = parseLocalDate(toLocalISOString(new Date()));

        const outflows: any[] = [];

        // 1. Recurring
        allRecurringItems.forEach(rt => {
            if (rt.type !== 'expense' && rt.type !== 'transfer') return;
            if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(rt.accountId)) return;
            
            const nextDue = parseLocalDate(rt.nextDueDate);
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

            const due = parseLocalDate(bill.dueDate);
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

    const handleDuplicateGoal = (goal: FinancialGoal) => {
        // Create a copy without the ID, let the context handler generate a new one
        const { id, ...rest } = goal;
        
        // If it's a bucket, do we duplicate children? 
        // For simplicity, we just duplicate the top-level bucket/goal structure initially.
        // A deep clone would require iterating children and recreating them with new IDs linked to new parent ID.
        // Let's stick to shallow clone for now as per simple UI action.
        
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
        if (deletingGoal) return;
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
            <PageHeader
                markerIcon="trending_up"
                markerLabel="Forward View"
                title="Financial Forecast"
                subtitle="Projected cash, income, and obligations so you can plan moves weeks and months ahead."
                actions={
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
                        <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg h-10 flex-shrink-0 w-full sm:w-auto">
                             <button onClick={() => setShowGoalLines(true)} className={`${segmentItemBase} ${showGoalLines ? segmentItemActive : segmentItemInactive}`}>
                                <span className="material-symbols-outlined text-lg mr-1.5">flag</span>
                                Goals
                             </button>
                             <button onClick={() => setShowGoalLines(false)} className={`${segmentItemBase} ${!showGoalLines ? segmentItemActive : segmentItemInactive}`}>
                                Hide
                             </button>
                        </div>
                        <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex-shrink-0 whitespace-nowrap w-full sm:w-auto h-10`}>
                            <span className="material-symbols-outlined text-xl mr-2">add</span>
                            Add Goal
                        </button>
                    </div>
                }
            />

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
                        <p className={`text-2xl font-extrabold tracking-tight ${lowestPoint.value < 0 ? 'text-red-600' : 'text-light-text dark:text-dark-text'}`}>
                            {hasForecastData ? formatCurrency(lowestPoint.value, 'EUR') : '—'}
                        </p>
                        <p className="text-xs font-medium mt-1 opacity-80">
                            {hasForecastData ? `Lowest on ${parseLocalDate(lowestPoint.date).toLocaleDateString()}` : 'No forecast data yet'}
                        </p>
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
                        <span className="font-semibold">{forecastData.length}</span> data points (incl. 7 days history)
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
            
            {/* Goals Section (Full Width with 3 Cols) */}
             <div className="space-y-6">
                 {/* Goal Header & Filters */}
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

                {/* Goals Summary Hero Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
                    {/* Grand Total Income Card */}
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

                    {/* Grand Total Savings Card */}
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

                    {/* Individual Account Goal Summaries */}
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
                
                {/* Individual Goals Grid */}
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

            {/* Forecast Ledger (Redesigned) */}
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
                     <div className="flex items-center gap-2 text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full border border-red-100 dark:border-red-900/30 self-start sm:self-auto">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        Lowest Balance Highlighted
                    </div>
                </div>

                <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-dark-card p-0">
                    <div className="overflow-x-auto max-h-[600px]">
                        <table className="w-full text-sm text-left border-collapse">
                             <thead className="sticky top-0 z-20 bg-white dark:bg-[#1E1E20] shadow-sm text-xs uppercase font-bold tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                <tr>
                                    <th className="px-6 py-4 border-b border-black/5 dark:border-white/5">Date</th>
                                    <th className="px-6 py-4 border-b border-black/5 dark:border-white/5">Account</th>
                                    <th className="px-6 py-4 border-b border-black/5 dark:border-white/5">Description</th>
                                    <th className="px-6 py-4 border-b border-black/5 dark:border-white/5 text-right">Amount</th>
                                    <th className="px-6 py-4 border-b border-black/5 dark:border-white/5 text-right">Run. Bal.</th>
                                    <th className="px-6 py-4 border-b border-black/5 dark:border-white/5 text-center">Type</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                                {tableData.map(row => {
                                    const isLowest = hasForecastData && row.balance.toFixed(2) === lowestPoint.value.toFixed(2);
                                    
                                    let rowClass = 'hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer';
                                    if (isLowest) rowClass += ' bg-red-50/50 dark:bg-red-900/10 hover:!bg-red-100/50 dark:hover:!bg-red-900/20 border-l-4 border-l-red-500';

                                    const amountClass = row.amount >= 0 
                                        ? 'text-emerald-600 dark:text-emerald-400 font-bold' 
                                        : 'text-light-text dark:text-dark-text font-medium';

                                    return (
                                        <tr 
                                            key={row.id} 
                                            className={rowClass}
                                            onClick={() => handleEditForecastItem(row)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text">
                                                {parseLocalDate(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-light-text dark:text-dark-text truncate block max-w-[140px]">{row.accountName}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="truncate block max-w-[220px] text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text">{row.description}</span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono ${amountClass}`}>
                                                {formatCurrency(row.amount, 'EUR')}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold ${isLowest ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                                                {formatCurrency(row.balance, 'EUR')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                 <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                                    row.type === 'Financial Goal' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                                    row.type === 'Bill/Payment' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' :
                                                    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                                                }`}>
                                                    {row.type === 'Financial Goal' ? 'Goal' : row.type === 'Bill/Payment' ? 'Bill' : 'Recurring'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                             </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Forecasting;
