import React, { useState, useMemo } from 'react';
import { Budget, Category, Transaction, Account, BudgetSuggestion, AppPreferences } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, QUICK_CREATE_BUDGET_OPTIONS } from '../constants';
import Card from '../components/Card';
import { formatCurrency, convertToEur } from '../utils';
import BudgetProgressCard from '../components/BudgetProgressCard';
import BudgetModal from '../components/BudgetModal';
import AIBudgetSuggestionsModal from '../components/AIBudgetSuggestionsModal';
import QuickBudgetModal from '../components/QuickBudgetModal';
import { loadGenAiModule } from '../genAiLoader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend, ReferenceLine } from 'recharts';

interface BudgetingProps {
  budgets: Budget[];
  transactions: Transaction[];
  expenseCategories: Category[];
  saveBudget: (budgetData: Omit<Budget, 'id'> & { id?: string }) => void;
  deleteBudget: (id: string) => void;
  accounts: Account[];
  preferences: AppPreferences;
}

// Helper to find a parent category by a transaction's category name
const findParentCategory = (categoryName: string, categories: Category[]): Category | undefined => {
  for (const parent of categories) {
    if (parent.name === categoryName) return parent;
    if (parent.subCategories.some(sub => sub.name === categoryName)) return parent;
  }
  return undefined;
};

const Budgeting: React.FC<BudgetingProps> = ({ budgets, transactions, expenseCategories, saveBudget, deleteBudget, accounts, preferences }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [categoryNameToCreate, setCategoryNameToCreate] = useState<string | undefined>();

  // State for AI budget suggestions
  const [isSuggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [isQuickBudgetModalOpen, setQuickBudgetModalOpen] = useState(false);

  const handleMonthChange = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };
  
  const handleGenerateSuggestions = async () => {
    setIsGeneratingSuggestions(true);
    setSuggestionError(null);
    setSuggestions([]);

    if (!process.env.API_KEY) {
        setSuggestionError("AI Assistant is not configured. Please set your API key in the settings.");
        setIsGeneratingSuggestions(false);
        setSuggestionModalOpen(true); // Open modal to show error
        return;
    }

    try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const liquidAccountIds = new Set(
            accounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).map(acc => acc.id)
        );

        const relevantTransactions = transactions.filter(t => {
            const txDate = new Date(t.date);
            return txDate >= threeMonthsAgo && t.type === 'expense' && !t.transferId && liquidAccountIds.has(t.accountId);
        });
        
        const spendingByCategory: Record<string, number> = {};
        for (const tx of relevantTransactions) {
            const parentCategory = findParentCategory(tx.category, expenseCategories);
            if (parentCategory) {
                spendingByCategory[parentCategory.name] = (spendingByCategory[parentCategory.name] || 0) + Math.abs(convertToEur(tx.amount, tx.currency));
            }
        }
        
        const averageSpending = Object.entries(spendingByCategory).map(([categoryName, total]) => ({
            category: categoryName,
            averageMonthlySpending: parseFloat((total / 3).toFixed(2))
        })).filter(item => item.averageMonthlySpending > 0); // Only include categories with spending

        if (averageSpending.length === 0) {
            setSuggestionError("Not enough spending data from the last 3 months to generate suggestions.");
            setIsGeneratingSuggestions(false);
            setSuggestionModalOpen(true);
            return;
        }

        const { GoogleGenAI, Type } = await loadGenAiModule();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `You are a financial advisor. Based on the user's average monthly spending over the last 3 months, suggest a reasonable monthly budget for each category. For discretionary categories (like Shopping, Entertainment), suggest a budget slightly lower than the average to encourage saving. For essential categories (like Housing, Food), suggest a budget around the average. Round suggestions to the nearest whole number. Here is the data: ${JSON.stringify(averageSpending)}`;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    description: "The array of budget suggestions.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            categoryName: { type: Type.STRING },
                            averageSpending: { type: Type.NUMBER },
                            suggestedBudget: { type: Type.NUMBER }
                        },
                        required: ['categoryName', 'averageSpending', 'suggestedBudget']
                    }
                }
            },
            required: ['suggestions']
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema
            }
        });
        
        const result = JSON.parse(response.text);
        
        // Match suggestions back to the original average spending data to ensure consistency
        const finalSuggestions = result.suggestions.map((suggestion: any) => {
             const originalData = averageSpending.find(avg => avg.category === suggestion.categoryName);
             return {
                 categoryName: suggestion.categoryName,
                 averageSpending: originalData?.averageMonthlySpending || 0,
                 suggestedBudget: suggestion.suggestedBudget
             };
        });

        setSuggestions(finalSuggestions);

    } catch (err) {
        console.error("Error generating budget suggestions:", err);
        setSuggestionError("An error occurred while generating suggestions. Please try again.");
    } finally {
        setIsGeneratingSuggestions(false);
        setSuggestionModalOpen(true);
    }
  };

  const handleApplySuggestions = (selectedSuggestions: BudgetSuggestion[]) => {
      selectedSuggestions.forEach(suggestion => {
          const existingBudget = budgets.find(b => b.categoryName === suggestion.categoryName);
          const budgetData = {
              id: existingBudget?.id,
              categoryName: suggestion.categoryName,
              amount: suggestion.suggestedBudget,
              period: 'monthly' as const,
              currency: 'EUR' as const,
          };
          saveBudget(budgetData);
      });
      setSuggestionModalOpen(false);
  };

  const handleApplyQuickBudget = (periodInMonths: number) => {
    const today = new Date();
    // End date is the last day of the *previous* month
    const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const startDate = new Date(endDate);
    // Set to the first day of the starting month
    startDate.setMonth(startDate.getMonth() - (periodInMonths - 1));
    startDate.setDate(1);

    const liquidAccountIds = new Set(
      accounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).map(acc => acc.id)
    );

    const relevantTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= endDate && t.type === 'expense' && !t.transferId && liquidAccountIds.has(t.accountId);
    });

    const spending: Record<string, number> = {};
    for (const tx of relevantTransactions) {
        const parentCategory = findParentCategory(tx.category, expenseCategories);
        if (parentCategory) {
            spending[parentCategory.name] = (spending[parentCategory.name] || 0) + Math.abs(convertToEur(tx.amount, tx.currency));
        }
    }

    const averageSpending = Object.entries(spending).map(([categoryName, total]) => ({
        categoryName: categoryName,
        // Round to nearest whole number
        averageMonthlySpending: Math.round(total / periodInMonths)
    })).filter(item => item.averageMonthlySpending > 0);

    if (averageSpending.length === 0) {
        alert(`No spending data found for the last ${periodInMonths} month(s) to create budgets.`);
        return;
    }

    averageSpending.forEach(item => {
        const existingBudget = budgets.find(b => b.categoryName === item.categoryName);
        const budgetData = {
            id: existingBudget?.id,
            categoryName: item.categoryName,
            amount: item.averageMonthlySpending,
            period: 'monthly' as const,
            currency: 'EUR' as const,
        };
        saveBudget(budgetData);
    });

    alert(`${averageSpending.length} budget(s) have been created or updated based on your spending history.`);
  };

    const defaultQuickCreateOption = useMemo(() => {
        const period = preferences.defaultQuickCreatePeriod || 3;
        return QUICK_CREATE_BUDGET_OPTIONS.find(opt => opt.value === period) || QUICK_CREATE_BUDGET_OPTIONS[1];
    }, [preferences.defaultQuickCreatePeriod]);

    const handleQuickCreateDefault = () => {
        if (window.confirm(`This will create/update budgets based on your spending from the last ${defaultQuickCreateOption.value} month(s), overwriting any existing budgets for those categories. Are you sure you want to continue?`)) {
            handleApplyQuickBudget(defaultQuickCreateOption.value);
        }
    };


  const { totalBudgeted, totalSpent, spendingByCategory } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const liquidAccountIds = new Set(
      accounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).map(acc => acc.id)
    );

    const relevantTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= endDate && t.type === 'expense' && !t.transferId && liquidAccountIds.has(t.accountId);
    });

    const spending: Record<string, number> = {};
    for (const tx of relevantTransactions) {
      const parentCategory = findParentCategory(tx.category, expenseCategories);
      if (parentCategory) {
        spending[parentCategory.name] = (spending[parentCategory.name] || 0) + Math.abs(convertToEur(tx.amount, tx.currency));
      }
    }
    
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = Object.values(spending).reduce((sum, amount) => sum + amount, 0);

    return { totalBudgeted, totalSpent, spendingByCategory: spending };
  }, [currentDate, transactions, budgets, expenseCategories, accounts]);

  const handleOpenModal = (budget?: Budget, categoryName?: string) => {
    setEditingBudget(budget || null);
    setCategoryNameToCreate(budget ? undefined : categoryName);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBudget(null);
    setCategoryNameToCreate(undefined);
  };

  // Metrics for Hero
  const remainingBudget = totalBudgeted - totalSpent;
  const today = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  const daysPassed = isCurrentMonth ? today.getDate() : (currentDate < today ? daysInMonth : 0);
  const daysRemaining = Math.max(0, daysInMonth - daysPassed);
  
  const dailySafeSpend = daysRemaining > 0 && remainingBudget > 0 ? remainingBudget / daysRemaining : 0;
  const percentSpent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  
  // Projection (Burn Rate)
  const avgDailySpend = daysPassed > 0 ? totalSpent / daysPassed : 0;
  const projectedSpend = avgDailySpend * daysInMonth;
  const projectedSavings = totalBudgeted - projectedSpend;
  
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const sortedBudgets = useMemo(() => {
      // Sort budgets: Over budget first, then >80% used, then remaining
      return [...budgets].sort((a, b) => {
          const spentA = spendingByCategory[a.categoryName] || 0;
          const spentB = spendingByCategory[b.categoryName] || 0;
          const pctA = a.amount > 0 ? spentA / a.amount : 0;
          const pctB = b.amount > 0 ? spentB / b.amount : 0;
          return pctB - pctA; // Descending percent
      });
  }, [budgets, spendingByCategory]);
  
  const chartData = useMemo(() => {
      return budgets.map(b => ({
          name: b.categoryName,
          budget: b.amount,
          spent: spendingByCategory[b.categoryName] || 0,
      })).sort((a, b) => b.budget - a.budget).slice(0, 8);
  }, [budgets, spendingByCategory]);

  return (
    <div className="space-y-6 pb-10">
      {isModalOpen && (
        <BudgetModal 
          onClose={handleCloseModal}
          onSave={saveBudget}
          budgetToEdit={editingBudget}
          categoryNameToCreate={categoryNameToCreate}
          existingBudgets={budgets}
          expenseCategories={expenseCategories.filter(c => !c.parentId)} // Only allow parent categories for budgets
        />
      )}
      {isSuggestionModalOpen && (
          <AIBudgetSuggestionsModal
            isOpen={isSuggestionModalOpen}
            onClose={() => setSuggestionModalOpen(false)}
            suggestions={suggestions}
            onApply={handleApplySuggestions}
            isLoading={isGeneratingSuggestions}
            error={suggestionError}
            existingBudgets={budgets}
          />
      )}
      {isQuickBudgetModalOpen && (
        <QuickBudgetModal
          isOpen={isQuickBudgetModalOpen}
          onClose={() => setQuickBudgetModalOpen(false)}
          onApply={handleApplyQuickBudget}
        />
      )}
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <h2 className="text-xl font-bold text-light-text dark:text-dark-text min-w-[140px] text-center">{monthName}</h2>
            <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">chevron_right</span>
            </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center">
            <div className="flex rounded-lg shadow-sm">
                <button
                    onClick={handleQuickCreateDefault}
                    className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 rounded-r-none !h-9`}
                    title={`Create/update budgets based on the ${defaultQuickCreateOption.label}`}
                >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span className="text-sm">Quick Budget</span>
                </button>
                <button
                    onClick={() => setQuickBudgetModalOpen(true)}
                    className={`${BTN_SECONDARY_STYLE} px-2 rounded-l-none border-l border-light-separator dark:border-dark-separator !h-9`}
                    title="More Quick Create Options"
                >
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
            </div>
            <button onClick={handleGenerateSuggestions} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 !h-9`} disabled={isGeneratingSuggestions}>
                <span className="material-symbols-outlined text-sm">smart_toy</span>
                {isGeneratingSuggestions ? 'Analyzing...' : 'AI Suggest'}
            </button>
            <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} !h-9 text-sm`}>
                New Budget
            </button>
        </div>
      </header>

      {/* Hero Section - Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className={`relative overflow-hidden flex flex-col justify-between border-l-4 ${remainingBudget >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Remaining Budget</p>
                      <span className={`material-symbols-outlined text-xl ${remainingBudget >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {remainingBudget >= 0 ? 'savings' : 'money_off'}
                      </span>
                  </div>
                  <h3 className={`text-3xl font-bold ${remainingBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatCurrency(remainingBudget, 'EUR')}
                  </h3>
                  <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
                      <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Daily Safe Spend</span>
                      <span className="font-semibold text-light-text dark:text-dark-text">{formatCurrency(dailySafeSpend, 'EUR')}</span>
                  </div>
              </div>
          </Card>
          
          <Card className="flex flex-col justify-between">
              <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">Total Spent vs Budgeted</p>
                  <div className="flex items-baseline gap-2">
                       <h3 className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalSpent, 'EUR')}</h3>
                       <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">of {formatCurrency(totalBudgeted, 'EUR')}</span>
                  </div>
              </div>
              <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium">{percentSpent.toFixed(1)}% Used</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${percentSpent > 100 ? 'bg-rose-500' : percentSpent > 85 ? 'bg-yellow-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(percentSpent, 100)}%` }}
                      ></div>
                  </div>
              </div>
          </Card>
          
          <Card className="flex flex-col justify-between">
               <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">Projected Savings</p>
                  <h3 className={`text-2xl font-bold ${projectedSavings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500'}`}>
                      {formatCurrency(projectedSavings, 'EUR')}
                  </h3>
               </div>
               <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Current Burn Rate</span>
                  <span className="font-semibold text-light-text dark:text-dark-text">{formatCurrency(avgDailySpend, 'EUR')} / day</span>
               </div>
          </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-2">
              <Card className="h-full min-h-[400px] flex flex-col">
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Budget vs. Actual</h3>
                  <div className="flex-grow">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                              data={chartData}
                              layout="vertical"
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis 
                                type="category" 
                                dataKey="name" 
                                width={120} 
                                axisLine={false} 
                                tickLine={false}
                                tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 500 }} 
                              />
                              <Tooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', color: 'var(--light-text)' }}
                                formatter={(val: number) => formatCurrency(val, 'EUR')}
                              />
                              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                              <Bar dataKey="spent" name="Spent" stackId="a" fill="#3b82f6" barSize={20} radius={[0, 0, 0, 0]}>
                                 {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.spent > entry.budget ? '#ef4444' : '#3b82f6'} />
                                  ))}
                              </Bar>
                              <Bar dataKey="budget" name="Budget Limit" stackId="b" fill="#e2e8f0" barSize={20} radius={[0, 4, 4, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </Card>
          </div>

          {/* Budget Grid */}
          <div className="lg:col-span-1">
               <div className="space-y-4">
                   <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Category Detail</h3>
                   <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {sortedBudgets.map(budget => {
                             const category = expenseCategories.find(c => c.name === budget.categoryName);
                             const spent = spendingByCategory[budget.categoryName] || 0;
                             if (!category) return null;

                             return (
                                 <BudgetProgressCard
                                     key={budget.id}
                                     category={category}
                                     budgeted={budget.amount}
                                     spent={spent}
                                     onEdit={() => handleOpenModal(budget, budget.categoryName)}
                                 />
                             );
                        })}
                        {sortedBudgets.length === 0 && (
                            <div className="text-center py-10 text-light-text-secondary dark:text-dark-text-secondary border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                <p>No budgets defined.</p>
                            </div>
                        )}
                   </div>
               </div>
          </div>
      </div>
    </div>
  );
};

export default Budgeting;
