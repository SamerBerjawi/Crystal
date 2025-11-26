
import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction } from '../types';
import { formatCurrency, parseDateAsUTC, convertToEur } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useGoalsContext } from '../contexts/FinancialDataContext';

interface OtherAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: any[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
}

const OtherAccountView: React.FC<OtherAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack
}) => {
  const { financialGoals } = useGoalsContext();
  const isLiability = account.type === 'Other Liabilities';

  // --- Theme Config ---
  const theme = isLiability ? {
      gradient: 'from-pink-500 to-rose-600',
      text: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-100 dark:bg-pink-900/30',
      border: 'border-pink-200 dark:border-pink-800',
      stroke: '#db2777', // pink-600
      fillId: 'colorPink',
  } : {
      gradient: 'from-lime-500 to-green-600',
      text: 'text-lime-600 dark:text-lime-400',
      bg: 'bg-lime-100 dark:bg-lime-900/30',
      border: 'border-lime-200 dark:border-lime-800',
      stroke: '#65a30d', // lime-600
      fillId: 'colorLime',
  };

  // --- Metrics ---
  const metrics = useMemo(() => {
    const sortedTxs = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    const lastActivity = sortedTxs.length > 0 ? sortedTxs[0].parsedDate.toLocaleDateString() : 'Never';
    
    // Net Change (Simple sum of all transactions)
    // For Assets: Positive sum = Growth.
    // For Liabilities: Positive sum (income type) = Paid off amount? Or Debt incurred?
    // Usually in Crystal: Expense = Debt increased/Asset bought. Income = Debt paid/Asset sold/value up.
    // Let's track raw movement volume.
    const totalMovement = transactions.reduce((sum, t) => sum + t.convertedAmount, 0);

    return { lastActivity, totalMovement };
  }, [transactions]);

  // --- Chart Data ---
  const balanceHistory = useMemo(() => {
    const data = [];
    let currentBalance = account.balance;
    
    const today = new Date();
    // Filter out future transactions for the "current" calculation reverse walk
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
    // 6 Month History
    for (let i = 0; i <= 180; i++) {
        const dateStr = iterDate.toISOString().split('T')[0];
        data.push({ date: dateStr, value: currentBalance });
        const change = dailyChanges[dateStr] || 0;
        currentBalance -= change;
        iterDate.setDate(iterDate.getDate() - 1);
    }
    return data.reverse();
  }, [account.balance, transactions]);

  // --- Linked Goals ---
  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`w-16 h-16 rounded-xl flex-shrink-0 ${theme.text} bg-current/10 border border-current/20 flex items-center justify-center flex-shrink-0`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || (isLiability ? 'receipt' : 'category')}</span>
            </div>
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text truncate">{account.name}</h1>
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <span>{account.type}</span>
                </div>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 ml-auto md:ml-0">
          <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Hero Card */}
        <div className="lg:col-span-5 xl:col-span-4">
            <div className={`h-full min-h-[240px] bg-gradient-to-br ${theme.gradient} rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between group`}>
                 {/* Decorative Elements */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                 <div className="relative z-10">
                    <p className="text-white/80 font-medium text-sm uppercase tracking-widest mb-2">Current Value</p>
                    <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md">
                        {formatCurrency(account.balance, account.currency)}
                    </h2>
                 </div>

                 <div className="relative z-10 mt-8 flex justify-between items-end">
                    <div>
                        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Total Activity</p>
                         <p className="text-xl font-medium text-white">
                             {metrics.totalMovement > 0 ? '+' : ''}{formatCurrency(metrics.totalMovement, account.currency)}
                        </p>
                    </div>
                    <div className="text-right">
                         <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Last Updated</p>
                         <p className="text-lg font-medium text-white">{metrics.lastActivity}</p>
                    </div>
                 </div>
            </div>
        </div>

        {/* Details Grid */}
        <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            
             {/* Chart */}
             <Card className="lg:col-span-2 flex flex-col min-h-[300px]">
                <h3 className="text-base font-bold text-light-text dark:text-dark-text mb-4">Balance History (6 Months)</h3>
                <div className="flex-grow w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id={theme.fillId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={theme.stroke} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={theme.stroke} stopOpacity={0}/>
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
                                stroke={theme.stroke} 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill={`url(#${theme.fillId})`} 
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
                      <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Transactions</h3>
                  </div>
                  <div className="flex-grow overflow-hidden">
                      <TransactionList 
                          transactions={displayTransactionsList} 
                          allCategories={allCategories} 
                          onTransactionClick={onTransactionClick} 
                      />
                  </div>
              </Card>
          </div>
          
          <div className="lg:col-span-1 space-y-6">
              {/* Notes Card */}
              <Card>
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-500">description</span>
                      Notes
                  </h3>
                  <div className="bg-light-fill dark:bg-dark-fill p-4 rounded-xl text-sm text-light-text dark:text-dark-text min-h-[100px] whitespace-pre-wrap border border-black/5 dark:border-white/5">
                      {account.notes ? account.notes : <span className="text-light-text-secondary dark:text-dark-text-secondary italic">No notes added for this account. Edit the account to add details.</span>}
                  </div>
              </Card>

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
                          <p>No goals linked.</p>
                      </div>
                  )}
              </Card>
          </div>
      </div>
    </div>
  );
};

export default OtherAccountView;
