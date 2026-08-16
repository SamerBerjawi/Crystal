import React, { useState, useMemo } from 'react';
import { Budget, Category, Transaction, Account, BudgetSuggestion, AppPreferences } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, QUICK_CREATE_BUDGET_OPTIONS, SELECT_ARROW_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency, convertToEur } from '../utils';
import BudgetProgressCard from '../components/BudgetProgressCard';
import BudgetModal from '../components/BudgetModal';
import QuickBudgetModal from '../components/QuickBudgetModal';
import PageHeader from '../components/PageHeader';
import HeaderButton from '../components/HeaderButton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { PieChart as BklitPieChart, PieSlice, PieCenter } from '../src/components/charts';
import { useConfirm } from '../components/ConfirmationModal';

import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import Icon from '../components/ui/Icon';
import { MobileBudgetView } from '../components/MobileBudgetView';
import { useIsMobile } from '../hooks/useIsMobile';

interface BudgetingProps {
  budgets?: Budget[];
  transactions?: Transaction[];
  expenseCategories?: Category[];
  saveBudget?: (budgetData: Omit<Budget, 'id'> & { id?: string }) => void;
  deleteBudget?: (id: string) => void;
  accounts?: Account[];
  preferences?: AppPreferences;
}

// Helper to find a parent category by a transaction's category name
const findParentCategory = (categoryName: string, categories: Category[]): Category | undefined => {
  for (const parent of categories) {
    if (parent.name === categoryName) return parent;
    if (parent.subCategories.some(sub => sub.name === categoryName)) return parent;
  }
  return undefined;
};

const Budgeting: React.FC<BudgetingProps> = ({
  budgets: propsBudgets,
  transactions: propsTransactions,
  expenseCategories: propsExpenseCategories,
  saveBudget: propsSaveBudget,
  deleteBudget: propsDeleteBudget,
  accounts: propsAccounts,
  preferences: propsPreferences,
}) => {
  const contextBudgets = useBudgetsContext();
  const contextCategories = useCategoryContext();
  const contextTransactions = useTransactionsContext();
  const contextAccounts = useAccountsContext();
  const contextPreferences = usePreferencesContext();

  const budgets = propsBudgets || contextBudgets.budgets;
  const transactions = propsTransactions || contextTransactions.transactions;
  const expenseCategories = propsExpenseCategories || contextCategories.expenseCategories;
  const saveBudget = propsSaveBudget || contextBudgets.saveBudget;
  const deleteBudget = propsDeleteBudget || contextBudgets.deleteBudget;
  const accounts = propsAccounts || contextAccounts.accounts;
  const preferences = propsPreferences || contextPreferences.preferences;
  const isMobile = useIsMobile();
  const { confirm, ConfirmDialog } = useConfirm();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [categoryNameToCreate, setCategoryNameToCreate] = useState<string | undefined>();
  const [isQuickBudgetModalOpen, setQuickBudgetModalOpen] = useState(false);

  const handleMonthChange = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
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

    const handleQuickCreateDefault = async () => {
        const confirmed = await confirm({
            title: 'Auto-Generate Budgets?',
            message: `This will create or update budgets based on your spending from the last ${defaultQuickCreateOption.value} month(s), overwriting existing budgets for those categories.`,
            confirmLabel: 'Generate Budgets',
            variant: 'warning',
            icon: 'zap',
        });
        if (confirmed) {
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
      return txDate >= startDate && txDate <= endDate && !t.transferId && liquidAccountIds.has(t.accountId);
    });

    const spending: Record<string, number> = {};

    for (const tx of relevantTransactions) {
      if (tx.type === 'income') continue;
      const parentCategory = findParentCategory(tx.category, expenseCategories);
      if (parentCategory) {
        spending[parentCategory.name] = (spending[parentCategory.name] || 0) + Math.abs(convertToEur(tx.amount, tx.currency));
      } else {
        spending.Uncategorized = (spending.Uncategorized || 0) + Math.abs(convertToEur(tx.amount, tx.currency));
      }
    }
    
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = Object.values(spending).reduce((sum, amount) => sum + amount, 0);

    return { totalBudgeted, totalSpent, spendingByCategory: spending };
  }, [currentDate, transactions, budgets, expenseCategories, accounts]);

  const totalRemaining = totalBudgeted - totalSpent;
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const overallProgress = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  
  const today = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  let daysRemaining = daysInMonth;
  
  if (currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()) {
      daysRemaining = Math.max(1, daysInMonth - today.getDate());
  } else if (currentDate < today) {
      daysRemaining = 0;
  }
  
  const dailySafeSpend = daysRemaining > 0 ? Math.max(0, totalRemaining / daysRemaining) : 0;
  
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
    <div className="relative">
      {/* Shared Modals for Mobile & Desktop */}
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
      {isQuickBudgetModalOpen && (
        <QuickBudgetModal
          isOpen={isQuickBudgetModalOpen}
          onClose={() => setQuickBudgetModalOpen(false)}
          onApply={handleApplyQuickBudget}
        />
      )}
      {/* Responsive View Switch */}
      {isMobile ? (
        <MobileBudgetView
          budgets={budgets}
          transactions={transactions}
          expenseCategories={expenseCategories}
          totalBudgeted={totalBudgeted}
          totalSpent={totalSpent}
          spendingByCategory={spendingByCategory}
          currentDate={currentDate}
          onMonthChange={handleMonthChange}
          onAddBudget={(catName) => handleOpenModal(undefined, catName)}
          onEditBudget={(b) => handleOpenModal(b)}
          onDeleteBudget={(id) => deleteBudget(id)}
          onApplyQuickBudget={handleApplyQuickBudget}
          onQuickCreateDefault={handleQuickCreateDefault}
          preferredCurrency={preferences.currency || 'EUR'}
        />
      ) : (
        <div className="space-y-6 pb-8 animate-fade-in-up">
          <PageHeader
            markerIcon="pie_chart"
            markerLabel="Spending Plan"
            title="Budgeting"
            subtitle="Set envelopes, guardrails, and spending alerts that adapt as your cash flow evolves."
            actions={
              <div className="flex items-center gap-2">
                <HeaderButton
                  variant="accent"
                  icon="zap"
                  onClick={handleQuickCreateDefault}
                  title={`Create/update budgets based on the ${defaultQuickCreateOption.label}`}
                >
                  Quick Budget
                </HeaderButton>
                <HeaderButton
                  variant="primary"
                  icon="PlusCircle"
                  onClick={() => handleOpenModal()}
                >
                  Create Budget
                </HeaderButton>
              </div>
            }
          />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black/5 dark:bg-white/5 p-2 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-2xl relative z-10">
           <div className="flex items-center gap-2 bg-white/50 dark:bg-black/50 p-1 rounded-[1.5rem] w-full md:w-auto justify-between md:justify-start border border-black/5 dark:border-white/5 shadow-lg">
                <button onClick={() => handleMonthChange(-1)} className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 group">
                    <Icon name="chevron_left" className="text-lg leading-none group-hover:-translate-x-1 transition-transform" />
                </button>
                <div className="flex flex-col items-center px-6 min-w-[140px]">
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-60 leading-none mb-1">Active cycle</span>
                    <span className="text-xs font-bold leading-none">{monthName}</span>
                </div>
                <button onClick={() => handleMonthChange(1)} className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 group">
                    <Icon name="chevron_right" className="text-lg leading-none group-hover:translate-x-1 transition-transform" />
                </button>
           </div>
           
           <div className="flex items-center gap-2 w-full md:w-auto group">
                <div className="flex rounded-[1.5rem] shadow-lg bg-white/50 dark:bg-black/50 border border-black/5 dark:border-white/5 overflow-hidden">
                    <button
                        onClick={handleQuickCreateDefault}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-primary-500/10 transition-colors group/btn"
                        title={`Create/update budgets based on the ${defaultQuickCreateOption.label}`}
                    >
                        <Icon name="zap" className="text-lg text-primary-500 group-hover/btn:scale-125 transition-transform" />
                        <span className="text-xs font-semibold tracking-wide whitespace-nowrap">Quick budget</span>
                    </button>
                    <div className="w-[1px] bg-black/5 dark:bg-white/10"></div>
                    <button
                        onClick={() => setQuickBudgetModalOpen(true)}
                        className="px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        title="More Quick Create Options"
                    >
                        <Icon name="expand_more" className="text-lg leading-none" />
                    </button>
                </div>
           </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
          <div className="md:col-span-2 bg-[#121214] dark:bg-dark-card rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[200px] border border-white/5 group">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] -mr-64 -mt-64 transition-opacity group-hover:opacity-20"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] -ml-40 -mb-40 transition-opacity group-hover:opacity-20"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2 block">Available Liquidity</h2>
                            <h2 className="text-4xl font-bold tracking-tight leading-none mb-2">{formatCurrency(totalRemaining, 'EUR')}</h2>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${totalRemaining >= 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'} animate-pulse`}></div>
                                <span className={`text-xs font-semibold ${totalRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {totalRemaining >= 0 ? 'Surplus Projection' : 'Deficit Expected'}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform">
                                <Icon name="wallet" className="text-2xl opacity-40" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-8 mt-6 bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                     <div>
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">Total budgeted</p>
                        <p className="text-xl font-bold tracking-tight">{formatCurrency(totalBudgeted, 'EUR')}</p>
                     </div>
                     <div>
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">Total spent</p>
                        <p className="text-xl font-bold tracking-tight opacity-100">{formatCurrency(totalSpent, 'EUR')}</p>
                     </div>
                </div>
                
                <div className="relative z-10 mt-6">
                     <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10 p-[1px]">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.1)] ${overallProgress > 100 ? 'bg-rose-500' : 'bg-primary-500'}`} 
                            style={{ width: `${Math.min(overallProgress, 100)}%` }}
                        ></div>
                    </div>
                     <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-2">
                             <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Utilization</span>
                             <span className="text-sm font-bold tracking-tight">{overallProgress.toFixed(0)}%</span>
                        </div>
                        {daysRemaining > 0 ? (
                           <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Active range</span>
                                <span className="text-xs font-bold tracking-wide">{daysRemaining} DAYS REMAINING</span>
                           </div>
                        ) : (
                           <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Cycle closed</span>
                        )}
                    </div>
                </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-2xl border border-black/5 dark:border-white/5 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-24 -top-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none group-hover:opacity-40 transition-opacity"></div>
              <div className="relative z-10 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 shadow-inner">
                        <Icon name="coins_stacked" className="text-2xl" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-1">Daily safe spend</p>
                  <h3 className="text-3xl font-bold tracking-tight text-light-text dark:text-dark-text mb-2">{formatCurrency(dailySafeSpend, 'EUR')}</h3>
                  <div className="px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <p className="text-xs font-medium opacity-70 leading-none">
                        Available per day / {daysRemaining}d
                    </p>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-10">
          <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-black/5 dark:border-white/5">
                 <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                    <Icon name="layout_alt" className="text-xl" />
                 </div>
                 <div>
                    <h3 className="text-base font-semibold tracking-tight text-light-text dark:text-dark-text">Control Center</h3>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-60 leading-none">Category Allocation & Performance</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {expenseCategories.filter(c => !c.parentId)
                  .sort((a, b) => {
                    const budgetA = budgets.find(bu => bu.categoryName === a.name)?.amount || 0;
                    const budgetB = budgets.find(bu => bu.categoryName === b.name)?.amount || 0;
                    return budgetB - budgetA;
                  })
                  .map(category => {
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
                 <div className="text-center py-24 text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-black/10 dark:border-white/10 shadow-inner">
                    <div className="w-20 h-20 rounded-[2rem] bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 mx-auto mb-6 flex items-center justify-center shadow-lg">
                        <Icon name="savings" className="text-4xl opacity-20" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-60">No financial guardrails detected</p>
                    <p className="text-xs font-normal opacity-50 max-w-[240px] mx-auto text-center">Your spending categories are currently unmapped. Initialize them in settings to start tracking.</p>
                 </div>
              )}
          </div>

          <div className="space-y-4">
              <Card className="flex flex-col !p-6 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card shadow-2xl relative overflow-hidden group min-h-[320px]">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-primary-500/5 rounded-full blur-[60px] -ml-16 -mt-16 pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-0.5">Portfolio</p>
                        <h3 className="text-sm font-semibold tracking-tight text-light-text dark:text-dark-text leading-none">Allocation</h3>
                    </div>
                    <Icon name="pie_chart" className="opacity-20 group-hover:rotate-45 transition-transform text-lg" />
                  </div>

                  <div className="flex-grow min-h-[160px] relative z-10 flex items-center justify-center">
                    <BklitPieChart
                      data={allocationData.map((item) => ({
                        label: item.name,
                        value: item.value,
                        color: item.color,
                      }))}
                      innerRadius={55}
                      cornerRadius={6}
                      padAngle={allocationData.length > 1 ? 0.05 : 0}
                      className="w-full h-44"
                    >
                      {allocationData.map((_, index) => (
                        <PieSlice key={index} index={index} showGlow />
                      ))}
                      <PieCenter defaultLabel="Total">
                        {({ value, label, isHovered }) => (
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold uppercase tracking-wider opacity-60 leading-none mb-1">
                              {label}
                            </span>
                            <span className="text-sm font-bold tracking-tight leading-none">
                              {formatCurrency(isHovered ? value : totalBudgeted, 'EUR')}
                            </span>
                          </div>
                        )}
                      </PieCenter>
                    </BklitPieChart>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4 relative z-10">
                       {allocationData.slice(0, 4).map(item => (
                            <div key={item.name} className="flex items-center gap-1.5 font-semibold">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-xs font-medium opacity-70 truncate">{item.name}</span>
                            </div>
                       ))}
                  </div>
              </Card>

              <Card className="!p-6 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card shadow-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-0.5">Critical</p>
                        <h3 className="text-sm font-semibold tracking-tight text-light-text dark:text-dark-text leading-none">Watchlist</h3>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                  </div>
                  
                  <div className="space-y-2">
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
                                    <div key={b.id} className="flex justify-between items-center p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 hover:scale-[1.01] transition-transform duration-300">
                                        <span className="text-xs font-semibold tracking-tight truncate max-w-[140px] leading-none">{b.categoryName}</span>
                                        <div className={`flex items-center gap-2 px-2 py-0.5 rounded-lg ${isOver ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                            <span className="text-xs font-bold tracking-tight leading-none">{pct.toFixed(0)}</span>
                                            <span className="text-xs font-normal opacity-50">%</span>
                                        </div>
                                    </div>
                                );
                            })
                      ) : (
                          <div className="text-center py-6 opacity-30 flex flex-col items-center gap-2">
                              <Icon name="verified_user" className="text-2xl" />
                              <p className="text-xs font-semibold uppercase tracking-wider">Safely within limits</p>
                          </div>
                      )}
                  </div>
              </Card>
          </div>
      </div>
      </div>
      )}
      <ConfirmDialog />
    </div>
  );
};

export default Budgeting;