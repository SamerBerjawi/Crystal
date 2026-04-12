import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseLocalDate, convertToEur, getPreferredTimeZone, toLocalISOString } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, AreaChart, Area } from 'recharts';
import { useGoalsContext } from '../contexts/FinancialDataContext';

interface SavingsAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
}

const SavingsAccountView: React.FC<SavingsAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
}) => {
  const { financialGoals } = useGoalsContext();
  const timeZone = getPreferredTimeZone();

  // --- 1. Interest & APY Calculations ---
  const apy = account.apy || 0;
  const projectedAnnualInterest = (account.balance * apy) / 100;
  const projectedMonthlyInterest = projectedAnnualInterest / 12;

  const interestHistory = useMemo(() => {
    const data = [];
    const today = new Date();
    
    // Look back 12 months
    for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        
        // Filter for transactions that look like interest
        const interestTxs = transactions.filter(({ tx, parsedDate }) => {
             return parsedDate >= startOfMonth && 
                    parsedDate <= endOfMonth && 
                    tx.type === 'income' &&
                    (tx.category.toLowerCase().includes('interest') || tx.description.toLowerCase().includes('interest'));
        });
        
        const totalInterest = interestTxs.reduce((sum, { convertedAmount }) => sum + convertedAmount, 0);
        data.push({ name: monthKey, value: totalInterest });
    }
    return data;
  }, [transactions]);

  const totalInterestYTD = useMemo(() => {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return transactions
        .filter(({ tx, parsedDate }) => 
            parsedDate >= startOfYear && 
            tx.type === 'income' && 
            (tx.category.toLowerCase().includes('interest') || tx.description.toLowerCase().includes('interest'))
        )
        .reduce((sum, { convertedAmount }) => sum + convertedAmount, 0);
  }, [transactions]);

  // --- 2. Balance History ---
  const balanceHistory = useMemo(() => {
    const data = [];
    // Start with current balance and work backwards
    let currentBalance = account.balance;
    
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const sortedTxs = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    const dailyChanges: Record<string, number> = {};
    
    sortedTxs.forEach(({ tx, parsedDate }) => {
         if (parsedDate > today) return; 
         const dateStr = toLocalISOString(parsedDate);
         dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + tx.amount; // using native currency amount
    });

    let iterDate = new Date(endDate);
    // 3 months history
    for (let i = 0; i <= 90; i++) {
        const dateStr = toLocalISOString(iterDate);
        data.push({ date: dateStr, value: currentBalance });
        const change = dailyChanges[dateStr] || 0;
        currentBalance -= change; // Reverse to go back in time
        iterDate.setDate(iterDate.getDate() - 1);
    }
    return data.reverse();
  }, [account.balance, transactions]);

  // --- 3. Linked Goals ---
  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <span className="material-symbols-outlined text-4xl">{account.icon || 'savings'}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-light-text dark:text-dark-text tracking-tight">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                <span>Savings Account</span>
                {account.financialInstitution && (
                    <>
                        <span>•</span>
                        <span>{account.financialInstitution}</span>
                    </>
                )}
                {account.accountNumber && (
                    <>
                        <span>•</span>
                        <span className="font-mono">...{account.accountNumber.slice(-4)}</span>
                    </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto md:ml-0 flex-shrink-0">
            {isLinkedToEnableBanking && onSyncLinkedAccount && (
                <button onClick={onSyncLinkedAccount} className={BTN_SECONDARY_STYLE}>Sync</button>
            )}
            <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE}`}>
                <span className="material-symbols-outlined text-lg mr-2">add</span>
                Add Transaction
            </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Balance Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[240px]">
               {/* Decorative Elements */}
               <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                   <span className="material-symbols-outlined text-9xl">account_balance</span>
               </div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10"></div>

               <div className="relative z-10">
                    <div className="flex items-start justify-between">
                        <div>
                             <p className="text-blue-100 font-bold uppercase tracking-widest text-xs mb-2 flex items-center gap-2">
                                 <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse"></span>
                                 Total Savings
                             </p>
                             <h2 className="text-5xl font-extrabold tracking-tight drop-shadow-sm">{formatCurrency(account.balance, account.currency)}</h2>
                        </div>
                        {apy > 0 && (
                            <div className="bg-white/20 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl text-center">
                                <p className="text-xs font-bold uppercase text-blue-100">APY</p>
                                <p className="text-2xl font-bold">{apy}%</p>
                            </div>
                        )}
                    </div>
               </div>

               <div className="relative z-10 mt-8 grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
                    <div>
                        <p className="text-blue-200 text-xs font-bold uppercase mb-1">Est. Annual Return</p>
                        <p className="text-xl font-bold">{apy > 0 ? formatCurrency(projectedAnnualInterest, account.currency) : '—'}</p>
                    </div>
                    <div>
                        <p className="text-blue-200 text-xs font-bold uppercase mb-1">Interest Earned YTD</p>
                        <p className="text-xl font-bold">{formatCurrency(totalInterestYTD, account.currency)}</p>
                    </div>
               </div>
          </div>

          {/* Growth Chart Mini */}
          <Card className="flex flex-col">
               <h3 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-4">90-Day Growth</h3>
               <div className="flex-grow w-full min-h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceHistory}>
                             <defs>
                                <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                formatter={(val: number) => [formatCurrency(val, account.currency), 'Balance']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                fill="url(#colorGrowth)" 
                                fillOpacity={1}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
               </div>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Interest & Activity */}
          <div className="lg:col-span-2 space-y-8">
               {/* Interest Tracker */}
               {apy > 0 && (
                   <Card>
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Interest History</h3>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Monthly interest payouts</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Est. Monthly</p>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(projectedMonthlyInterest, account.currency)}</p>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={interestHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} tickFormatter={(val) => `${val}`} />
                                    <Tooltip 
                                        cursor={{ fill: 'rgba(128, 128, 128, 0.05)', radius: 4 }}
                                        contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.05)', borderRadius: '12px' }}
                                        formatter={(value: number) => [formatCurrency(value, account.currency), 'Interest']}
                                    />
                                    <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                   </Card>
               )}

               {/* Recent Transactions */}
                <Card className="flex flex-col h-full max-h-[500px] !p-0">
                    <div className="flex justify-between items-center p-4 border-b border-black/5 dark:border-white/5">
                        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Recent Activity</h3>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <TransactionList
                            transactions={displayTransactionsList.slice(0, 10)}
                            allCategories={allCategories}
                            onTransactionClick={onTransactionClick}
                        />
                    </div>
                </Card>
          </div>

          {/* Right Column: Goals & Details */}
          <div className="space-y-8">
              
              {/* Linked Goals */}
              {linkedGoals.length > 0 && (
                  <Card>
                      <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-500">flag</span>
                          Linked Goals
                      </h3>
                      <div className="space-y-4">
                          {linkedGoals.map(goal => {
                              const progress = Math.min(100, Math.max(0, (goal.currentAmount / goal.amount) * 100));
                              return (
                                  <div key={goal.id} className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="font-semibold text-sm text-light-text dark:text-dark-text">{goal.name}</span>
                                          <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">{progress.toFixed(0)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden mb-2">
                                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }}></div>
                                      </div>
                                      <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                          <span>{formatCurrency(goal.currentAmount, 'EUR')}</span>
                                          <span>Target: {formatCurrency(goal.amount, 'EUR')}</span>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </Card>
              )}

              {/* Account Details */}
              <Card>
                   <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-4 border-b border-black/5 dark:border-white/5 pb-2">
                       Account Details
                   </h3>
                   <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Type</span>
                            <span className="font-medium text-light-text dark:text-dark-text">{account.type}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Currency</span>
                            <span className="font-medium text-light-text dark:text-dark-text">{account.currency}</span>
                        </div>
                        {account.openingDate && (
                            <div className="flex justify-between">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Opened</span>
                                <span className="font-medium text-light-text dark:text-dark-text">{parseLocalDate(account.openingDate).toLocaleDateString()}</span>
                            </div>
                        )}
                         {account.accountNumber && (
                            <div className="flex justify-between">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Account #</span>
                                <span className="font-medium text-light-text dark:text-dark-text font-mono">{account.accountNumber}</span>
                            </div>
                        )}
                        {account.routingNumber && (
                            <div className="flex justify-between">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Routing</span>
                                <span className="font-medium text-light-text dark:text-dark-text font-mono">{account.routingNumber}</span>
                            </div>
                        )}
                   </div>
              </Card>
          </div>
      </div>
    </div>
  );
};

export default SavingsAccountView;