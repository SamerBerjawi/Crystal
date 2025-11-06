import React, { useState, useMemo, useCallback, Dispatch, SetStateAction } from 'react';
import { Account, Transaction, RecurringTransaction, FinancialGoal, Category, Page, ContributionPlanStep, BillPayment } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES } from '../constants';
import { formatCurrency, convertToEur, generateBalanceForecast, generateSyntheticLoanPayments } from '../utils';
import Card from '../components/Card';
import MultiAccountFilter from '../components/MultiAccountFilter';
import FinancialGoalCard from '../components/FinancialGoalCard';
import GoalScenarioModal from '../components/GoalScenarioModal';
import ForecastChart from '../components/ForecastChart';
import GoalContributionPlan from '../components/GoalContributionPlan';
import { GoogleGenAI, Type } from '@google/genai';

type ForecastDuration = '3M' | '6M' | 'EOY' | '1Y' | '2Y';

interface ForecastingProps {
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  financialGoals: FinancialGoal[];
  saveFinancialGoal: (goalData: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
  deleteFinancialGoal: (id: string) => void;
  expenseCategories: Category[];
  billsAndPayments: BillPayment[];
  activeGoalIds: string[];
  // FIX: Update the type of the `setActiveGoalIds` prop to `React.Dispatch<React.SetStateAction<string[]>>` to correctly handle state updates.
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


const Forecasting: React.FC<ForecastingProps> = ({ accounts, transactions, recurringTransactions, financialGoals, saveFinancialGoal, deleteFinancialGoal, expenseCategories, billsAndPayments, activeGoalIds, setActiveGoalIds }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
        const primaryAccount = accounts.find(a => a.isPrimary);
        if (primaryAccount) {
            return [primaryAccount.id];
        }
        return accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type)).map(a => a.id)
    });
    const [forecastDuration, setForecastDuration] = useState<ForecastDuration>('1Y');
    
    const selectedAccounts = useMemo(() => 
      accounts.filter(a => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds]);

    const activeGoals = useMemo(() => financialGoals.filter(g => activeGoalIds.includes(g.id)), [financialGoals, activeGoalIds]);

    const { forecastData, lowestPoint, goalsWithProjections } = useMemo(() => {
        const projectionEndDate = new Date();
        projectionEndDate.setFullYear(new Date().getFullYear() + 10);

        const syntheticLoanPayments = generateSyntheticLoanPayments(accounts);
        const allRecurringItems = [...recurringTransactions, ...syntheticLoanPayments];

        const fullData = generateBalanceForecast(
            selectedAccounts,
            allRecurringItems,
            activeGoals,
            billsAndPayments,
            projectionEndDate
        );

        const goalsWithProjections = financialGoals.map(goal => {
            const goalDate = goal.date ? new Date(goal.date) : null;
            let projectedDate = 'Beyond forecast';
            let status: 'on-track' | 'at-risk' | 'off-track' = 'off-track';

            for (const point of fullData) {
                if (point.value >= goal.amount) {
                    projectedDate = point.date;
                    if (goalDate) {
                        const projDate = new Date(projectedDate);
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
            case '2Y': endDate.setFullYear(endDate.getFullYear() + 2); break;
        }

        const forecastData = fullData.filter(d => new Date(d.date) <= endDate);

        let lowestPoint = { value: Infinity, date: '' };
        if (forecastData.length > 0) {
            lowestPoint = forecastData.reduce((min, p) => p.value < min.value ? { value: p.value, date: p.date } : min, { value: forecastData[0].value, date: forecastData[0].date });
        }

        return { forecastData, lowestPoint, goalsWithProjections };
    }, [selectedAccounts, recurringTransactions, activeGoals, billsAndPayments, financialGoals, forecastDuration, accounts]);

    const { generatePlan, plan, isLoading: isPlanLoading, error: planError } = useSmartGoalPlanner(selectedAccounts, recurringTransactions, goalsWithProjections.filter(g => activeGoalIds.includes(g.id)));


    const handleToggleGoal = (id: string) => {
        setActiveGoalIds(prev => prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]);
    };

    const durationOptions: { label: string; value: ForecastDuration }[] = [
        { label: '3M', value: '3M' },
        { label: '6M', value: '6M' },
        { label: 'EOY', value: 'EOY' },
        { label: '1Y', value: '1Y' },
        { label: '2Y', value: '2Y' },
    ];
    
    return (
        <div className="space-y-8">
            {isModalOpen && <GoalScenarioModal onClose={() => setIsModalOpen(false)} onSave={(d) => { saveFinancialGoal(d); setIsModalOpen(false); }} goalToEdit={editingGoal} />}

            <header className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Project your financial future and plan for your goals.</p>
                </div>
                <div className="flex items-center gap-4">
                    <MultiAccountFilter accounts={accounts.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type))} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
                    
                    <div className="hidden sm:flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg h-10">
                        {durationOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setForecastDuration(opt.value)}
                                className={`h-full px-3 text-sm font-semibold rounded-md transition-colors ${
                                    forecastDuration === opt.value
                                        ? 'bg-light-card dark:bg-dark-card shadow-sm'
                                        : 'text-light-text-secondary dark:text-dark-text-secondary'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    
                    <button onClick={() => { setEditingGoal(null); setIsModalOpen(true); }} className={BTN_PRIMARY_STYLE}>Add Goal / Scenario</button>
                </div>
            </header>

            <Card>
                <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Cash Flow Forecast</h3>
                <ForecastChart data={forecastData} lowestPoint={lowestPoint} oneTimeGoals={activeGoals.filter(g => g.type === 'one-time')} />
            </Card>

            <div className="space-y-6">
                <h3 className="text-2xl font-bold text-light-text dark:text-dark-text">Financial Goals</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goalsWithProjections.map(goal => (
                        <FinancialGoalCard 
                            key={goal.id} 
                            goal={goal} 
                            isActive={activeGoalIds.includes(goal.id)}
                            onToggle={handleToggleGoal}
                            onEdit={(g) => { setEditingGoal(g); setIsModalOpen(true); }}
                            onDelete={deleteFinancialGoal}
                        />
                    ))}
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

export default Forecasting;