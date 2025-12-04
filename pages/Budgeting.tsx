
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

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


  const { totalBudgeted, totalSpent, spendingByCategory, totalIncome } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const liquidAccountIds = new Set(
      accounts.filter(acc => LIQUID_ACCOUNT_TYPES.includes(acc.type)).map(acc => acc.id)
    );

    const relevantTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= endDate && !t.transferId && liquidAccountIds.has(t.accountId);
    });

    const spending: Record<string, number> = {};
    let totalIncome = 0;

    for (const tx of relevantTransactions) {
      if (tx.type === 'income') {
          totalIncome += convertToEur(tx.amount, tx.currency);
          continue;
      }
      const parentCategory = findParentCategory(tx.category, expenseCategories);
      if (parentCategory) {
        spending[parentCategory.name] = (spending[parentCategory.name] || 0) + Math.abs(convertToEur(tx.amount, tx.currency));
      }
    }
    
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = Object.values(spending).reduce((sum, amount) => sum + amount, 0);

    return { totalBudgeted, totalSpent, spendingByCategory: spending, totalIncome };
  }, [currentDate, transactions, budgets, expenseCategories, accounts]);

  // Metrics Calculations
  const totalRemaining = totalBudgeted - totalSpent;
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const overallProgress = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  
  // Daily Safe Spend Logic
  const today = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  let daysRemaining = daysInMonth;
  
  // Only calculate days remaining if viewing current month
  if (currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()) {
      daysRemaining = Math.max(1, daysInMonth - today.getDate());
  } else if (currentDate < today) {
      daysRemaining = 0; // Past months
  }
  
  const dailySafeSpend = daysRemaining > 0 ? Math.max(0, totalRemaining / daysRemaining) : 0;
  
  // Allocation Chart Data
  const allocationData = useMemo(() => {
      return budgets.map(b => {
          const cat = expenseCategories.find(c => c.name === b.categoryName);
          return {
              name: b.categoryName,
              value: b.amount,
              color: cat?.color || '#cbd5e1'
          };
      }).sort((a, b) => b.value - a.value);
  }, [budgets, expenseCategories]);


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

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
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

      {/* Header & Month Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 bg-light-fill dark:bg-dark-fill p-1.5 rounded-full">
            <button onClick={() => handleMonthChange(-1)} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-white/10 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <span className="text-sm font-bold px-2 min-w-[100px] text-center">{monthName}</span>
            <button onClick={() => handleMonthChange(1)} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-white/10 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
            <div className="flex rounded-lg shadow-sm bg-light-card dark:bg-dark-card border border-black/5 dark:border-white/5">
                <button
                    onClick={handleQuickCreateDefault}
                    className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 rounded-r-none !bg-transparent border-none hover:bg-black/5 dark:hover:bg-white/5 !px-3`}
                    title={`Create/update budgets based on the ${defaultQuickCreateOption.label}`}
                >
                    <span className="material-symbols-outlined text-lg text-primary-500">auto_awesome</span>
                    <span className="whitespace-nowrap">Quick Budget</span>
                </button>
                <div className="w-px bg-black/5 dark:bg-white/10 my-2"></div>
                <button
                    onClick={() => setQuickBudgetModalOpen(true)}
                    className={`${BTN_SECONDARY_STYLE} px-2 rounded-l-none !bg-transparent border-none hover:bg-black/5 dark:hover:bg-white/5`}
                    title="More Quick Create Options"
                >
                    <span className="material-symbols-outlined text-lg">expand_more</span>
                </button>
            </div>
            <button onClick={handleGenerateSuggestions} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 whitespace-nowrap`} disabled={isGeneratingSuggestions}>
                <span className="material-symbols-outlined text-lg text-purple-500">smart_toy</span>
                {isGeneratingSuggestions ? 'Thinking...' : 'AI Advice'}
            </button>
            <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} whitespace-nowrap`}>
                <span className="material-symbols-outlined text-lg mr-1">add</span>
                Create
            </button>
        </div>
      </div>

      {/* Hero Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Budget Summary */}
          <div className="md:col-span-2 bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[200px]">
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                    <span className="material-symbols-outlined text-9xl">account_balance_wallet</span>
                </div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white/70 font-bold uppercase tracking-wider text-xs mb-1">Remaining Budget</p>
                            <h2 className="text-4xl font-bold tracking-tight">{formatCurrency(totalRemaining, 'EUR')}</h2>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase backdrop-blur-md bg-white/20 ${totalRemaining >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                            {totalRemaining >= 0 ? 'On Track' : 'Over Budget'}
                        </div>
                    </div>
                </div>

                <div className="relative z-10 mt-6 grid grid-cols-2 gap-8">
                     <div>
                        <p className="text-white/60 text-xs font-bold uppercase mb-0.5">Total Budgeted</p>
                        <p className="text-xl font-semibold">{formatCurrency(totalBudgeted, 'EUR')}</p>
                     </div>
                     <div>
                        <p className="text-white/60 text-xs font-bold uppercase mb-0.5">Total Spent</p>
                        <p className="text-xl font-semibold text-white/90">{formatCurrency(totalSpent, 'EUR')}</p>
                     </div>
                </div>
                
                {/* Progress Bar */}
                <div className="relative z-10 mt-6">
                     <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${overallProgress > 100 ? 'bg-red-400' : 'bg-white'}`} 
                            style={{ width: `${Math.min(overallProgress, 100)}%` }}
                        ></div>
                    </div>
                     <div className="flex justify-between text-[10px] font-medium text-white/60 mt-1.5">
                        <span>{overallProgress.toFixed(0)}% utilized</span>
                        {daysRemaining > 0 && <span>{daysRemaining} days left</span>}
                    </div>
                </div>
          </div>

          {/* 2. Daily Pacing Card */}
          <div className="bg-white dark:bg-dark-card rounded-3xl p-6 shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
              <div className="relative z-10 text-center">
                  <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold uppercase tracking-wider mb-2">Daily Safe Spend</p>
                  <h3 className="text-3xl font-bold text-light-text dark:text-dark-text mb-1">{formatCurrency(dailySafeSpend, 'EUR')}</h3>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">per day for {daysRemaining} days</p>
                  
                  <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5">
                      <div className="flex justify-between items-center text-sm">
                           <span className="text-light-text-secondary dark:text-dark-text-secondary">Projected Savings</span>
                           <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(Math.max(0, totalIncome - totalBudgeted), 'EUR')}</span>
                      </div>
                      <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1 text-right">Based on Income - Budget</p>
                  </div>
              </div>
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Left Column: Budget Cards */}
          <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                 <span className="material-symbols-outlined text-primary-500">category</span>
                 <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Budget Breakdown</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {expenseCategories.filter(c => !c.parentId).map(category => {
                  const budget = budgets.find(b => b.categoryName === category.name);
                  const spent = spendingByCategory[category.name] || 0;
                  
                  return (
                    <BudgetProgressCard 
                      key={category.id}
                      category={category}
                      budgeted={budget?.amount || 0}
                      spent={spent}
                      onEdit={() => handleOpenModal(budget, category.name)}
                    />
                  );
                })}
              </div>
              
               {expenseCategories.filter(c => !c.parentId).length === 0 && (
                 <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary bg-light-card dark:bg-dark-card rounded-2xl border border-dashed border-black/10 dark:border-white/10">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">savings</span>
                    <p className="font-medium">No categories found.</p>
                    <p className="text-sm">Go to Settings to set up your expense categories.</p>
                 </div>
              )}
          </div>

          {/* Right Column: Analytics Sidebar */}
          <div className="space-y-6">
              <Card className="h-96 flex flex-col">
                  <h3 className="text-base font-bold text-light-text dark:text-dark-text mb-4">Allocation</h3>
                  <div className="flex-grow min-h-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={allocationData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {allocationData.map(entry => (
                                    <Cell key={entry.name} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                formatter={(value: number) => formatCurrency(value, 'EUR')}
                                contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--light-text)' }}
                            />
                            <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom" 
                                align="center"
                                iconSize={8}
                                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center mt-2">
                       <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Total Budgeted: <span className="font-bold text-light-text dark:text-dark-text">{formatCurrency(totalBudgeted, 'EUR')}</span></span>
                  </div>
              </Card>

              <Card>
                  <h3 className="text-base font-bold text-light-text dark:text-dark-text mb-4">Watchlist</h3>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">Categories &gt; 80% utilized</p>
                  <div className="space-y-3">
                      {budgets.filter(b => {
                           const spent = spendingByCategory[b.categoryName] || 0;
                           return (spent / b.amount) > 0.8;
                      }).length > 0 ? (
                          budgets
                            .map(b => ({ ...b, spent: spendingByCategory[b.categoryName] || 0 }))
                            .filter(b => (b.spent / b.amount) > 0.8)
                            .sort((a, b) => (b.spent/b.amount) - (a.spent/a.amount))
                            .map(b => {
                                const pct = (b.spent / b.amount) * 100;
                                const isOver = pct > 100;
                                return (
                                    <div key={b.id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                                        <span className="text-sm font-medium text-red-900 dark:text-red-200 truncate max-w-[120px]">{b.categoryName}</span>
                                        <span className={`text-xs font-bold ${isOver ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                            {pct.toFixed(0)}%
                                        </span>
                                    </div>
                                );
                            })
                      ) : (
                          <div className="text-center py-4">
                              <span className="material-symbols-outlined text-green-500 text-2xl mb-1">check_circle</span>
                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">All budgets are healthy!</p>
                          </div>
                      )}
                  </div>
              </Card>
          </div>
      </div>
    </div>
  );
};

export default Budgeting;
