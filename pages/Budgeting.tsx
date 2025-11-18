import React, { useState, useMemo } from 'react';
import { Budget, Category, Transaction, Account, BudgetSuggestion, AppPreferences } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, QUICK_CREATE_BUDGET_OPTIONS } from '../constants';
import Card from '../components/Card';
import { formatCurrency, convertToEur } from '../utils';
import BudgetProgressCard from '../components/BudgetProgressCard';
import BudgetModal from '../components/BudgetModal';
import AIBudgetSuggestionsModal from '../components/AIBudgetSuggestionsModal';
import QuickBudgetModal from '../components/QuickBudgetModal';
import { GoogleGenAI, Type } from '@google/genai';

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

  const totalRemaining = totalBudgeted - totalSpent;
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const overallProgress = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  let overallProgressBarColor = 'bg-primary-500';
  if (overallProgress > 100) overallProgressBarColor = 'bg-red-500';
  else if (overallProgress > 80) overallProgressBarColor = 'bg-yellow-500';

  return (
    <div className="space-y-8">
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
      <header className="flex justify-between items-center">
        <div>
          {/* <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">Budgeting</h2> */}
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Track your spending against your monthly budgets.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex rounded-lg shadow-sm">
                <button
                    onClick={handleQuickCreateDefault}
                    className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 rounded-r-none`}
                    title={`Create/update budgets based on the ${defaultQuickCreateOption.label}`}
                >
                    <span className="material-symbols-outlined">auto_awesome</span>
                    {`Create from ${defaultQuickCreateOption.shortLabel}`}
                </button>
                <button
                    onClick={() => setQuickBudgetModalOpen(true)}
                    className={`${BTN_SECONDARY_STYLE} px-2 rounded-l-none border-l border-light-separator dark:border-dark-separator`}
                    title="More Quick Create Options"
                >
                    <span className="material-symbols-outlined">expand_more</span>
                </button>
            </div>
            <button onClick={handleGenerateSuggestions} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`} disabled={isGeneratingSuggestions}>
                <span className="material-symbols-outlined">smart_toy</span>
                {isGeneratingSuggestions ? 'Analyzing...' : 'Get AI Suggestions'}
            </button>
            <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>
                Create New Budget
            </button>
        </div>
      </header>

      <Card>
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
                <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">chevron_left</span></button>
                <h3 className="text-xl font-semibold text-center">{monthName}</h3>
                <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">chevron_right</span></button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="text-center md:text-left">
                <p className="text-base text-light-text-secondary dark:text-dark-text-secondary">Amount Remaining this month</p>
                <p className={`text-4xl font-bold ${totalRemaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(totalRemaining, 'EUR')}
                </p>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-lg">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Spent</span>
                    <span className="font-semibold">{formatCurrency(totalSpent, 'EUR')}</span>
                </div>
                <div className="flex justify-between text-lg">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Budgeted</span>
                    <span className="font-semibold">{formatCurrency(totalBudgeted, 'EUR')}</span>
                </div>
            </div>
        </div>
        <div className="mt-6">
            <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-4 shadow-neu-inset-light dark:shadow-neu-inset-dark">
                <div
                    className={`h-4 rounded-full transition-all duration-500 ${overallProgressBarColor}`}
                    style={{ width: `${Math.min(overallProgress, 100)}%` }}
                ></div>
            </div>
            <div className="flex justify-end text-sm mt-2">
                <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">{overallProgress.toFixed(0)}% of budget spent</span>
            </div>
        </div>
    </Card>

      <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">Category Breakdown</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
         <Card>
            <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
              <span className="material-symbols-outlined text-5xl mb-2">savings</span>
              <p className="font-semibold">No expense categories found.</p>
              <p className="text-sm">Go to Settings to create categories to track your spending.</p>
            </div>
         </Card>
      )}
    </div>
  );
};

export default Budgeting;
