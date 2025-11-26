
import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseDateAsUTC, convertToEur, getDateRange } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useGoalsContext } from '../contexts/FinancialDataContext';

interface SavingsAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allTransactions: Transaction[]; // Global transactions for runway calc
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
}

const SavingsAccountView: React.FC<SavingsAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allTransactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack
}) => {
  const { financialGoals } = useGoalsContext();

  // --- Metrics Calculation ---
  const metrics = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    // 1. Interest Earned (Approximation based on category/name)
    const interestEarned = transactions.reduce((sum, { tx }) => {
        const isInterest = 
            tx.category.toLowerCase().includes('interest') || 
            tx.description.toLowerCase().includes('interest') ||
            tx.description.toLowerCase().includes('dividend');
        
        if (isInterest && tx.amount > 0) {
            return sum + convertToEur(tx.amount, tx.currency);
        }
        return sum;
    }, 0);

    // 2. Average Monthly Contribution (Inflows excluding Interest)
    const recentInflows = transactions.filter(t => t.parsedDate >= sixMonthsAgo && t.tx.amount > 0);
    const totalInflow6Mo = recentInflows.reduce((sum, { tx }) => sum + convertToEur(tx.amount, tx.currency), 0);
    // Subtract interest from contribution to get "Real Savings Effort"
    const monthlyContribution = Math.max(0, (totalInflow6Mo / 6));

    // 3. Calculate Runway (Global Monthly Spend)
    // We look at ALL transactions in the app to find the user's burn rate
    const { start, end } = getDateRange('90D', allTransactions);
    const diffMonths = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    const globalExpenses = allTransactions.filter(t => {
        const d = parseDateAsUTC(t.date);
        return d >= start && d <= end && t.type === 'expense' && !t.transferId;
    }).reduce((sum, t) => sum + Math.abs(convertToEur(t.amount, t.currency)), 0);

    const avgMonthlyGlobalSpend = globalExpenses / (diffMonths || 3);
    const accountBalanceEur = convertToEur(account.balance, account.currency);
    const runwayMonths = avgMonthlyGlobalSpend > 0 ? accountBalanceEur / avgMonthlyGlobalSpend : 0;

    return { interestEarned, monthlyContribution, runwayMonths };
  }, [transactions, allTransactions, account]);

  // --- Linked Goals ---
  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  // --- Chart Data ---
  const balanceHistory = useMemo(() => {
    const data = [];
    let currentBalance = account.balance;
    
    const today = new Date();
    // Filter out future transactions for the "current" calculation
    const sortedTxsDesc = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    
    // Adjust starting balance by reversing future transactions
    sortedTxsDesc.forEach(({ tx, parsedDate }) => {
        if (parsedDate > today) {
             currentBalance -= tx.amount;
        }
    });

    const endDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    
    const dailyChanges: Record<string, number> = {};
    sortedTxsDesc.forEach(({ tx, parsedDate }) => {
         if (parsedDate > today) return; 
         const dateStr = parsedDate.toISOString().split('T')[0];
         dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + tx.amount;
    });

    let iterDate = new Date(endDate);
    // 90 Day History for Savings
    for (let i = 0; i <= 90; i++) {
        const dateStr = iterDate.toISOString().split('T')[0];
        data.push({ date: dateStr, value: currentBalance });
        const change = dailyChanges[dateStr] || 0;
        currentBalance -= change;
        iterDate.setDate(iterDate.getDate() - 1);
    }
    return data.reverse();
  }, [account.balance, transactions]);


  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center border flex-shrink-0 ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'text-emerald-500'} bg-current/10 border-current/20`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || 'savings'}</span>
            </div>
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text truncate">{account.name}</h1>
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <span>Savings</span>
                    {account.apy && (
                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-xs font-bold">
                            {account.apy}% APY
                        </span>
                    )}
                </div>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 ml-auto md:ml-0">
          <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Hero Card - The "Growth Engine" */}
        <div className="lg:col-span-5 xl:col-span-4">
            <div className="h-full min-h-[280px] bg-gradient-to-br from-teal-500 to-emerald-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between group">
                 {/* Decorative Elements */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none"></div>

                 <div className="relative z-10">
                    <p className="text-emerald-100 font-medium text-sm uppercase tracking-widest mb-2">Total Balance</p>
                    <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md">
                        {formatCurrency(account.balance, account.currency)}
                    </h2>
                 </div>

                 <div className="relative z-10 mt-8">
                    <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/30 flex items-center justify-between">
                        <div>
                            <p className="text-emerald-50 text-xs font-bold uppercase tracking-wider">Safety Net</p>
                            <p className="text-xl font-bold text-white mt-0.5">
                                {metrics.runwayMonths.toFixed(1)} <span className="text-sm font-medium text-emerald-100">months</span>
                            </p>
                        </div>
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
                            <span className="material-symbols-outlined">umbrella</span>
                        </div>
                    </div>
                    {account.financialInstitution && (
                        <p className="text-right text-xs text-emerald-100 mt-4 font-medium opacity-80">{account.financialInstitution}</p>
                    )}
                 </div>
            </div>
        </div>

        {/* Metrics & Stats */}
        <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Total Interest Earned</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(metrics.interestEarned, 'EUR')}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">detected from transactions</p>
                    </div>
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                        <span className="material-symbols-outlined">trending_up</span>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Avg. Monthly Savings</p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {formatCurrency(metrics.monthlyContribution, 'EUR')}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">based on last 6 months</p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                        <span className="material-symbols-outlined">savings</span>
                    </div>
                </div>
            </Card>

             <Card className="sm:col-span-2 flex flex-col min-h-[250px]">
                <h3 className="text-base font-bold text-light-text dark:text-dark-text mb-4">Balance Growth (90 Days)</h3>
                <div className="flex-grow w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                }}
                                minTickGap={40}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                                tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`} 
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
                                labelStyle={{ color: 'var(--light-text)' }}
                                formatter={(val: number) => [formatCurrency(val, account.currency), 'Balance']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#10B981" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorGrowth)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
             </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-full">
              <Card className="h-full flex flex-col min-h-[500px]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Recent Activity</h3>
                  </div>
                  <div className="flex-grow overflow-hidden">
                      <TransactionList 
                          transactions={displayTransactionsList.slice(0, 15)} 
                          allCategories={allCategories} 
                          onTransactionClick={onTransactionClick} 
                      />
                  </div>
              </Card>
          </div>
          
          <div className="lg:col-span-1 space-y-6">
              {/* Linked Goals */}
              <Card>
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-yellow-500">flag</span>
                      Linked Goals
                  </h3>
                  {linkedGoals.length > 0 ? (
                      <div className="space-y-4">
                          {linkedGoals.map(goal => {
                              const progress = goal.amount > 0 ? (goal.currentAmount / goal.amount) * 100 : 0;
                              return (
                                  <div key={goal.id} className="group">
                                      <div className="flex justify-between text-sm font-medium mb-1">
                                          <span className="text-light-text dark:text-dark-text">{goal.name}</span>
                                          <span className="text-light-text-secondary dark:text-dark-text-secondary">{Math.min(progress, 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                                          <div className="bg-yellow-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                      </div>
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-right">
                                          {formatCurrency(goal.currentAmount, 'EUR')} of {formatCurrency(goal.amount, 'EUR')}
                                      </p>
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                          <p>No goals linked to this account.</p>
                          <p className="text-xs mt-1">Edit a goal and set this as the "Payment Account" to see it here.</p>
                      </div>
                  )}
              </Card>
              
              <Card>
                  <h3 className="text-base font-bold text-light-text dark:text-dark-text mb-4">Account Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Account Number</span><span className="font-mono">{account.accountNumber || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Routing Number</span><span className="font-mono">{account.routingNumber || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Opened</span><span>{account.openingDate ? parseDateAsUTC(account.openingDate).toLocaleDateString() : '—'}</span></div>
                    {account.apy && <div className="flex justify-between border-t border-black/5 dark:border-white/5 pt-2"><span className="text-light-text-secondary dark:text-dark-text-secondary">Interest Rate</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{account.apy}%</span></div>}
                  </div>
              </Card>
          </div>
      </div>
    </div>
  );
};

export default SavingsAccountView;
