
import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseDateAsUTC, convertToEur, getPreferredTimeZone } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, ReferenceLine } from 'recharts';
import { useGoalsContext } from '../contexts/FinancialDataContext';

interface CashAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
  onAdjustBalance: () => void;
}

const CashAccountView: React.FC<CashAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack,
  onAdjustBalance
}) => {
  const { financialGoals } = useGoalsContext();
  const timeZone = getPreferredTimeZone();

  // --- Linked Goals ---
  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  // --- Metrics ---
  const { totalInflow, totalOutflow, netChange, lastReplenishment } = useMemo(() => {
      const today = new Date();
      // Use local date constructor for start of month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      let inflow = 0;
      let outflow = 0;
      let lastRep: Date | null = null;

      transactions.forEach(({ tx, parsedDate }) => {
          // Check for last replenishment (Transfer IN)
          if (tx.type === 'income' && (tx.transferId || tx.category === 'Transfer') && (!lastRep || parsedDate > lastRep)) {
              lastRep = parsedDate;
          }

          if (parsedDate >= startOfMonth) {
              const val = convertToEur(tx.amount, tx.currency);
              if (tx.type === 'income') inflow += val;
              else outflow += Math.abs(val);
          }
      });

      return { 
          totalInflow: inflow, 
          totalOutflow: outflow, 
          netChange: inflow - outflow,
          lastReplenishment: lastRep 
      };
  }, [transactions]);

  // --- Chart Data (Inflow vs Outflow) ---
  const flowData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        
        // Use local date constructors for month boundaries
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        
        let inc = 0;
        let exp = 0;

        transactions
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth)
            .forEach(({ tx }) => {
                 const val = Math.abs(convertToEur(tx.amount, tx.currency));
                 if (tx.amount > 0) inc += val;
                 else exp += val;
            });
        
        data.push({ name: monthKey, income: inc, expense: exp });
    }
    return data;
  }, [transactions]);

  // --- Calculate Burn Rate ---
  const burnRateMessage = useMemo(() => {
      if (account.balance <= 0) return "Balance depleted";
      const avgDailySpend = totalOutflow / 30; // Rough 30 day avg
      if (avgDailySpend <= 0) return "No recent spending";
      const daysLeft = account.balance / avgDailySpend;
      if (daysLeft < 3) return "Low cash warning";
      if (daysLeft > 60) return "High cash reserve";
      return `~${Math.floor(daysLeft)} days coverage`;
  }, [account.balance, totalOutflow]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 w-full">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="material-symbols-outlined text-4xl">payments</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-light-text dark:text-dark-text tracking-tight">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {account.location || 'Unspecified Location'}
                </span>
                <span>•</span>
                <span>Physical Cash</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
             <button onClick={onAdjustBalance} className={`${BTN_SECONDARY_STYLE} flex-1 md:flex-none`}>
                <span className="material-symbols-outlined text-lg mr-2">fact_check</span>
                Count Cash
            </button>
            <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE} flex-1 md:flex-none`}>
                <span className="material-symbols-outlined text-lg mr-2">add</span>
                Add Log
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Hero Section - The "Safe" + Linked Goals */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
              <div className="relative flex-1 w-full min-h-[280px] rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-8 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group">
                  {/* Background Texture */}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 pointer-events-none"></div>
                  <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                       <span className="material-symbols-outlined text-[12rem]">lock</span>
                  </div>

                  <div className="relative z-10">
                       <p className="text-emerald-100 font-bold uppercase tracking-widest text-xs mb-2 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                           Current Balance
                       </p>
                       <h2 className="text-5xl font-extrabold tracking-tighter drop-shadow-sm">
                           {formatCurrency(account.balance, account.currency)}
                       </h2>
                       <p className="text-emerald-100/80 text-sm mt-2 font-medium bg-black/20 inline-block px-3 py-1 rounded-lg backdrop-blur-sm border border-white/10">
                           {burnRateMessage}
                       </p>
                  </div>

                  <div className="relative z-10 mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                       <div>
                           <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold mb-1">Last Replenished</p>
                           <p className="font-semibold text-lg">
                               {lastReplenishment ? lastReplenishment.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Never'}
                           </p>
                       </div>
                       <div>
                           <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold mb-1">Net Change (30d)</p>
                           <p className={`font-semibold text-lg flex items-center gap-1 ${netChange >= 0 ? 'text-white' : 'text-red-200'}`}>
                               {netChange >= 0 ? '+' : ''}{formatCurrency(netChange, 'EUR')}
                           </p>
                       </div>
                  </div>
              </div>

              {linkedGoals.length > 0 && (
                  <Card className="flex-shrink-0">
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
          </div>

          {/* Analytics & History */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
               {/* Quick Stats */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="flex items-center justify-between p-5 border-l-4 border-l-emerald-500">
                        <div>
                            <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Replenished (30d)</p>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalInflow, 'EUR')}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                             <span className="material-symbols-outlined">arrow_downward</span>
                        </div>
                    </Card>
                    <Card className="flex items-center justify-between p-5 border-l-4 border-l-rose-500">
                        <div>
                            <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Spent Cash (30d)</p>
                            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalOutflow, 'EUR')}</p>
                        </div>
                         <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                             <span className="material-symbols-outlined">payments</span>
                        </div>
                    </Card>
               </div>

               {/* Cash Flow Chart */}
               <Card className="flex-grow min-h-[300px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-light-text dark:text-dark-text text-lg">Cash Velocity</h3>
                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Inflow vs Outflow (6 Months)</p>
                    </div>
                    <div className="flex-grow w-full min-h-0">
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={flowData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} tickFormatter={(val) => `${val}`} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(128, 128, 128, 0.05)', radius: 4 }}
                                    contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.05)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', color: 'var(--light-text)' }}
                                    formatter={(value: number) => [formatCurrency(value, account.currency), 'Amount']}
                                />
                                <ReferenceLine y={0} stroke="#E5E7EB" />
                                <Bar dataKey="income" name="Replenish" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="expense" name="Spend" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                             </BarChart>
                         </ResponsiveContainer>
                    </div>
               </Card>
          </div>
      </div>

      {/* Recent Ledger */}
      <Card className="flex flex-col h-full max-h-[500px]">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Cash Ledger</h3>
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
  );
};

export default CashAccountView;
