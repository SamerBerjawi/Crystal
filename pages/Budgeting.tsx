import React, { useState, useMemo } from 'react';
import { Budget, Category, Transaction, Account, BudgetSuggestion, AppPreferences } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, QUICK_CREATE_BUDGET_OPTIONS, SELECT_ARROW_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency, convertToEur } from '../utils';
import BudgetProgressCard from '../components/BudgetProgressCard';
import BudgetModal from '../components/BudgetModal';
import QuickBudgetModal from '../components/QuickBudgetModal';
import PageHeader from '../components/PageHeader';
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
    <div className="space-y-6 pb-8 animate-fade-in-up">
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

      <PageHeader
        markerIcon="pie_chart"
        markerLabel="Spending Plan"
        title="Budgeting"
        subtitle="Set envelopes, guardrails, and spending alerts that adapt as your cash flow evolves."
        actions={
          <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>
            <span className="material-symbols-outlined text-lg">add</span>
            Create budget
          </button>
        }
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black/5 dark:bg-white/5 p-2 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-2xl relative z-10">
           <div className="flex items-center gap-2 bg-white/50 dark:bg-black/50 p-1 rounded-[1.5rem] w-full md:w-auto justify-between md:justify-start border border-black/5 dark:border-white/5 shadow-lg">
                <button onClick={() => handleMonthChange(-1)} className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 group">
                    <span className="material-symbols-outlined text-lg leading-none group-hover:-translate-x-1 transition-transform">chevron_left</span>
                </button>
                <div className="flex flex-col items-center px-6 min-w-[140px]">
                    <span className="text-[10px] font-bold tracking-[0.2em] opacity-40 leading-none mb-1">Active cycle</span>
                    <span className="text-xs font-bold tracking-widest leading-none">{monthName}</span>
                </div>
                <button onClick={() => handleMonthChange(1)} className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 group">
                    <span className="material-symbols-outlined text-lg leading-none group-hover:translate-x-1 transition-transform">chevron_right</span>
                </button>
           </div>
           
           <div className="flex items-center gap-2 w-full md:w-auto group">
                <div className="flex rounded-[1.5rem] shadow-lg bg-white/50 dark:bg-black/50 border border-black/5 dark:border-white/5 overflow-hidden">
                    <button
                        onClick={handleQuickCreateDefault}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-primary-500/10 transition-colors group/btn"
                        title={`Create/update budgets based on the ${defaultQuickCreateOption.label}`}
                    >
                        <span className="material-symbols-outlined text-lg text-primary-500 group-hover/btn:scale-125 transition-transform">bolt</span>
                        <span className="text-[10px] font-bold tracking-[0.2em] whitespace-nowrap">Quick budget</span>
                    </button>
                    <div className="w-[1px] bg-black/5 dark:bg-white/10"></div>
                    <button
                        onClick={() => setQuickBudgetModalOpen(true)}
                        className="px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        title="More Quick Create Options"
                    >
                        <span className="material-symbols-outlined text-lg leading-none">expand_more</span>
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
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 block">Available Liquidity</h2>
                            <h2 className="text-4xl font-black tracking-tighter leading-none mb-2">{formatCurrency(totalRemaining, 'EUR')}</h2>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${totalRemaining >= 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'} animate-pulse`}></div>
                                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${totalRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {totalRemaining >= 0 ? 'Surplus Projection' : 'Deficit Expected'}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform">
                                <span className="material-symbols-outlined text-2xl opacity-40">account_balance_wallet</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-8 mt-6 bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                     <div>
                        <p className="text-white/30 text-[10px] font-bold tracking-[0.2em] mb-1">Total budgeted</p>
                        <p className="text-xl font-bold tracking-tight">{formatCurrency(totalBudgeted, 'EUR')}</p>
                     </div>
                     <div>
                        <p className="text-white/30 text-[10px] font-bold tracking-[0.2em] mb-1">Total spent</p>
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
                             <span className="text-[10px] font-bold tracking-[0.2em] text-white/40">Utilization</span>
                             <span className="text-[13px] font-bold tracking-tight">{overallProgress.toFixed(0)}%</span>
                        </div>
                        {daysRemaining > 0 ? (
                           <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold tracking-[0.2em] text-white/40">Active range</span>
                                <span className="text-[13px] font-bold tracking-tight">{daysRemaining} DAYS REMAINING</span>
                           </div>
                        ) : (
                           <span className="text-[10px] font-bold tracking-[0.2em] text-white/40">Cycle closed</span>
                        )}
                    </div>
                </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-2xl border border-black/5 dark:border-white/5 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-24 -top-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none group-hover:opacity-40 transition-opacity"></div>
              <div className="relative z-10 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 shadow-inner">
                        <span className="material-symbols-outlined text-2xl">local_atm</span>
                  </div>
                  <p className="text-[10px] font-bold tracking-[0.2em] opacity-40 mb-1">Daily safe spend</p>
                  <h3 className="text-3xl font-bold tracking-tighter text-light-text dark:text-dark-text mb-2">{formatCurrency(dailySafeSpend, 'EUR')}</h3>
                  <div className="px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <p className="text-[8px] font-bold tracking-[0.2em] opacity-60 leading-none">
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
                    <span className="material-symbols-outlined text-xl">category</span>
                 </div>
                 <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-light-text dark:text-dark-text">Control Center</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 leading-none">Category Allocation & Performance</p>
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
                        <span className="material-symbols-outlined text-4xl opacity-20">savings</span>
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] mb-2 opacity-60">No financial guardrails detected</p>
                    <p className="text-[11px] font-bold opacity-30 max-w-[240px] mx-auto text-center">Your spending categories are currently unmapped. Initialize them in settings to start tracking.</p>
                 </div>
              )}
          </div>

          <div className="space-y-4">
              <Card className="flex flex-col !p-6 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card shadow-2xl relative overflow-hidden group min-h-[320px]">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-primary-500/5 rounded-full blur-[60px] -ml-16 -mt-16 pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5">Portfolio</p>
                        <h3 className="text-xs font-black uppercase tracking-tight text-light-text dark:text-dark-text leading-none">Allocation</h3>
                    </div>
                    <span className="material-symbols-outlined opacity-20 group-hover:rotate-45 transition-transform text-lg">pie_chart</span>
                  </div>

                  <div className="flex-grow min-h-[160px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={allocationData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={75}
                                paddingAngle={6}
                                dataKey="value"
                            >
                                {allocationData.map(entry => (
                                    <Cell key={entry.name} fill={entry.color} stroke="none" className="transition-all hover:opacity-80" />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                formatter={(value: number) => formatCurrency(value, 'EUR')}
                                contentStyle={{ backgroundColor: 'black', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 'bold', fontSize: '10px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
                                itemStyle={{ color: 'white' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                         <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-30 leading-none mb-1">Total</p>
                         <p className="text-lg font-black tracking-tighter leading-none">€{(totalBudgeted/1000).toFixed(1)}k</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4 relative z-10">
                       {allocationData.slice(0, 4).map(item => (
                            <div key={item.name} className="flex items-center gap-1.5 font-bold">
                                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-[8px] font-black uppercase tracking-wider opacity-40 truncate">{item.name}</span>
                            </div>
                       ))}
                  </div>
              </Card>

              <Card className="!p-6 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card shadow-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5">Critical</p>
                        <h3 className="text-xs font-black uppercase tracking-tight text-light-text dark:text-dark-text leading-none">Watchlist</h3>
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
                                        <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-[140px] leading-none">{b.categoryName}</span>
                                        <div className={`flex items-center gap-2 px-2 py-0.5 rounded-lg ${isOver ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                            <span className="text-[10px] font-black tracking-tighter leading-none">{pct.toFixed(0)}</span>
                                            <span className="text-[7px] font-black opacity-30">%</span>
                                        </div>
                                    </div>
                                );
                            })
                      ) : (
                          <div className="text-center py-6 opacity-30 flex flex-col items-center gap-2">
                              <span className="material-symbols-outlined text-2xl">verified_user</span>
                              <p className="text-[9px] font-black uppercase tracking-[0.2em]">Safely within limits</p>
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