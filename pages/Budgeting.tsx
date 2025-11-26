
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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';

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

  const { totalBudgeted, totalSpent, spendingByCategory, budgetHealthData, dailySafeSpend, daysRemaining } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    // Calculate days remaining in month
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const daysRem = isCurrentMonth ? Math.max(0, lastDayOfMonth - today.getDate()) : 0;

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
    
    // Calculate data for charts
    const healthData = budgets.map(b => {
        const spent = spending[b.categoryName] || 0;
        return {
            name: b.categoryName,
            budget: b.amount,
            spent: spent,
            remaining: b.amount - spent,
            percent: b.amount > 0 ? (spent / b.amount) * 100 : 0
        };
    }).sort((a, b) => b.percent - a.percent); // Sort by highest utilization

    const totalRemaining = totalBudgeted - totalSpent;
    const safeSpend = (isCurrentMonth && daysRem > 0) ? (totalRemaining > 0 ? totalRemaining / daysRem : 0) : 0;

    return { 
        totalBudgeted, 
        totalSpent, 
        spendingByCategory: spending, 
        budgetHealthData: healthData,
        dailySafeSpend: safeSpend,
        daysRemaining: daysRem
    };
  }, [currentDate, transactions, budgets, expenseCategories, accounts]);
  
  // AI & Quick Budget Handlers
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
    const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    const startDate = new Date(endDate);
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

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const totalRemaining = totalBudgeted - totalSpent;
  const overallProgress = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const isOverBudget = totalRemaining < 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-dark-card p-3 rounded-lg shadow-xl border border-black/5 dark:border-white/10 text-sm">
          <p className="font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value, 'EUR')}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-10">
      {isModalOpen && (
        <BudgetModal 
          onClose={handleCloseModal}
          onSave={saveBudget}
          budgetToEdit={editingBudget}
          categoryNameToCreate={categoryNameToCreate}
          existingBudgets={budgets}
          expenseCategories={expenseCategories.filter(c => !c.parentId)}
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

      {/* 1. Header & Controls */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-light-card dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-black/5 dark:border-white/5">
        <div className="flex items-center gap-4 order-2 md:order-1">
            <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary"><span className="material-symbols-outlined">chevron_left</span></button>
            <h2 className="text-xl font-bold text-light-text dark:text-dark-text min-w-[150px] text-center">{monthName}</h2>
            <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary"><span className="material-symbols-outlined">chevron_right</span></button>
        </div>
        <div className="flex items-center gap-2 order-1 md:order-2 w-full md:w-auto justify-end">
            <div className="flex rounded-lg shadow-sm">
                <button onClick={handleQuickCreateDefault} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 rounded-r-none text-xs md:text-sm px-3`} title={`Create from ${defaultQuickCreateOption.shortLabel}`}>
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    <span className="hidden sm:inline">Quick Budget</span>
                </button>
                <button onClick={() => setQuickBudgetModalOpen(true)} className={`${BTN_SECONDARY_STYLE} px-2 rounded-l-none border-l border-light-separator dark:border-dark-separator`} title="More Options">
                    <span className="material-symbols-outlined text-lg">expand_more</span>
                </button>
            </div>
            <button onClick={handleGenerateSuggestions} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 text-xs md:text-sm px-3`} disabled={isGeneratingSuggestions}>
                <span className="material-symbols-outlined text-lg">smart_toy</span>
                <span className="hidden sm:inline">AI Insights</span>
            </button>
            <button onClick={() => handleOpenModal()} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2 text-xs md:text-sm px-3`}>
                <span className="material-symbols-outlined text-lg">add</span>
                <span className="hidden sm:inline">Add Budget</span>
            </button>
        </div>
      </header>

      {/* 2. Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Remaining */}
          <div className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-lg bg-gradient-to-br ${isOverBudget ? 'from-rose-500 to-pink-600' : 'from-emerald-500 to-teal-600'}`}>
               <div className="absolute top-0 right-0 p-4 opacity-20"><span className="material-symbols-outlined text-8xl">account_balance_wallet</span></div>
               <div className="relative z-10">
                   <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Remaining Budget</p>
                   <h3 className="text-4xl font-bold mb-4">{formatCurrency(totalRemaining, 'EUR')}</h3>
                   
                   <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                       <div className="flex justify-between items-center mb-1">
                           <span className="text-xs font-medium text-white/90">Daily Safe Spend</span>
                           <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">{daysRemaining} days left</span>
                       </div>
                       <p className="text-xl font-bold">{formatCurrency(dailySafeSpend, 'EUR')} <span className="text-xs font-normal text-white/70">/ day</span></p>
                   </div>
               </div>
          </div>

          {/* Spent vs Budgeted */}
          <Card className="flex flex-col justify-center">
               <div className="flex justify-between items-end mb-2">
                   <div>
                       <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold uppercase tracking-wider">Total Spent</p>
                       <p className="text-3xl font-bold text-light-text dark:text-dark-text mt-1">{formatCurrency(totalSpent, 'EUR')}</p>
                   </div>
                   <div className="text-right">
                       <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold uppercase tracking-wider">Budgeted</p>
                       <p className="text-xl font-semibold text-light-text-secondary dark:text-dark-text-secondary">{formatCurrency(totalBudgeted, 'EUR')}</p>
                   </div>
               </div>
               <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden shadow-inner">
                   <div className={`h-full transition-all duration-1000 ${isOverBudget ? 'bg-rose-500' : overallProgress > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(overallProgress, 100)}%` }}></div>
               </div>
               <p className={`text-center text-sm font-bold mt-3 ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
                   {overallProgress.toFixed(0)}% of budget used
               </p>
          </Card>

          {/* Chart: Budget vs Actual */}
          <Card className="flex flex-col">
               <h3 className="text-sm font-bold text-light-text dark:text-dark-text uppercase tracking-wider mb-4">Top Categories</h3>
               <div className="flex-grow w-full h-[150px]">
                   <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={budgetHealthData.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barCategoryGap={12}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 10, fill: 'currentColor', opacity: 0.7}} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                            {/* Budget Bar (Background) */}
                            <Bar dataKey="budget" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={8} stackId="a" />
                             {/* Actual Spent (Foreground) */}
                            <Bar dataKey="spent" radius={[0, 4, 4, 0]} barSize={8} stackId="b">
                                {budgetHealthData.slice(0, 5).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.percent > 100 ? '#ef4444' : entry.percent > 85 ? '#f59e0b' : '#3b82f6'} />
                                ))}
                            </Bar>
                            <ReferenceLine x={0} stroke="#000" />
                        </BarChart>
                   </ResponsiveContainer>
               </div>
          </Card>
      </div>

      {/* 3. Budget Cards Grid */}
      <div>
          <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">Category Budgets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {expenseCategories.filter(c => !c.parentId).map(category => {
              const budget = budgets.find(b => b.categoryName === category.name);
              const spent = spendingByCategory[category.name] || 0;
              // Only show if there's a budget OR spending
              if (!budget && spent === 0) return null;

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
             {expenseCategories.filter(c => !c.parentId).length === 0 && (
                 <div className="col-span-full text-center py-12 text-light-text-secondary dark:text-dark-text-secondary bg-light-card dark:bg-dark-card rounded-xl border border-dashed border-black/10 dark:border-white/10">
                   <span className="material-symbols-outlined text-5xl mb-2 opacity-50">savings</span>
                   <p className="font-semibold">No expense categories found.</p>
                   <p className="text-sm">Go to Settings to create categories to track your spending.</p>
                 </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default Budgeting;
