

import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseDateAsUTC, convertToEur, getPreferredTimeZone } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { useAccountsContext } from '../contexts/DomainProviders';

interface SpareChangeAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
  onAdjustBalance?: () => void;
}

const SpareChangeAccountView: React.FC<SpareChangeAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack,
  onAdjustBalance
}) => {
  const { accounts } = useAccountsContext();
  const timeZone = getPreferredTimeZone();

  // Find linked source account name
  const sourceAccount = useMemo(() => {
      return accounts.find(a => a.id === account.linkedAccountId);
  }, [accounts, account.linkedAccountId]);

  // --- 1. Metrics ---
  const { totalSaved, totalRoundUps, avgRoundUp, thisMonthSaved, biggestRoundUp } = useMemo(() => {
      let saved = 0;
      let count = 0;
      let thisMonth = 0;
      let max = 0;
      
      const now = new Date();
      const currentMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

      transactions.forEach(({ tx, parsedDate, convertedAmount }) => {
          if (tx.type === 'income') {
              // Only count actual deposits/transfers, ignore market gains
               if (!tx.isMarketAdjustment) {
                   saved += convertedAmount;
                   count++;
                   if (convertedAmount > max) max = convertedAmount;
                   
                   if (parsedDate >= currentMonthStart) {
                       thisMonth += convertedAmount;
                   }
               }
          }
      });
      
      return {
          totalSaved: saved,
          totalRoundUps: count,
          avgRoundUp: count > 0 ? saved / count : 0,
          thisMonthSaved: thisMonth,
          biggestRoundUp: max
      };
  }, [transactions]);

  // --- 2. Monthly Chart Data ---
  const monthlyData = useMemo(() => {
    const data = [];
    const today = new Date();
    // 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        
        const startOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
        
        const total = transactions
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth && t.tx.type === 'income' && !t.tx.isMarketAdjustment)
            .reduce((sum, t) => sum + t.convertedAmount, 0);
        
        data.push({ name: monthKey, value: total });
    }
    return data;
  }, [transactions]);
  
  // "Coffee Index" - fun metric
  const coffeesSaved = Math.floor(totalSaved / 4.50); // Assuming €4.50 per fancy coffee

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
              <span className="material-symbols-outlined text-4xl">{account.icon || 'savings'}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-light-text dark:text-dark-text tracking-tight">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                <span>Spare Change</span>
                {sourceAccount && (
                    <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            Source: <span className="text-light-text dark:text-dark-text">{sourceAccount.name}</span>
                        </span>
                    </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0 ml-auto md:ml-0">
             {onAdjustBalance && (
                 <button onClick={onAdjustBalance} className={`${BTN_SECONDARY_STYLE}`}>
                     <span className="material-symbols-outlined text-lg mr-2">tune</span>
                     Adjust
                 </button>
             )}
            <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE}`}>
                <span className="material-symbols-outlined text-lg mr-2">add</span>
                Add Cash
            </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Piggy Bank Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[240px]">
               <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                   <span className="material-symbols-outlined text-9xl">savings</span>
               </div>
               
               <div className="relative z-10">
                    <p className="text-cyan-100 font-bold uppercase tracking-widest text-xs mb-2">Total Accumulated</p>
                    <h2 className="text-5xl font-extrabold tracking-tight drop-shadow-sm">{formatCurrency(account.balance, account.currency)}</h2>
                    <p className="text-cyan-50 text-sm mt-2 font-medium bg-black/10 inline-block px-3 py-1 rounded-lg backdrop-blur-sm">
                        {totalRoundUps} round-ups collected
                    </p>
               </div>

               <div className="relative z-10 mt-8 pt-6 border-t border-white/20 grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-cyan-100 text-xs font-bold uppercase mb-1">Average Round-up</p>
                        <p className="text-xl font-bold">{formatCurrency(avgRoundUp, account.currency)}</p>
                    </div>
                    <div>
                        <p className="text-cyan-100 text-xs font-bold uppercase mb-1">This Month</p>
                        <p className="text-xl font-bold">+{formatCurrency(thisMonthSaved, account.currency)}</p>
                    </div>
               </div>
          </div>

          {/* Fun Fact Card */}
          <Card className="flex flex-col justify-center items-center text-center bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800/30">
               <div className="w-16 h-16 bg-white dark:bg-white/10 rounded-full flex items-center justify-center shadow-sm mb-4 text-orange-500 text-3xl">
                   ☕
               </div>
               <h3 className="text-lg font-bold text-orange-800 dark:text-orange-200">The Coffee Index</h3>
               <p className="text-sm text-orange-700/80 dark:text-orange-300/80 mt-1 mb-4 px-4">
                   Your spare change has saved you the equivalent of...
               </p>
               <p className="text-4xl font-extrabold text-orange-600 dark:text-orange-400">{coffeesSaved}</p>
               <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mt-1">Coffees</p>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Monthly Trends */}
          <div className="lg:col-span-2">
               <Card className="h-[350px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Accumulation Velocity</h3>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Monthly savings from round-ups</p>
                        </div>
                    </div>
                    <div className="flex-grow w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} tickFormatter={(val) => `${val}`} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(128, 128, 128, 0.05)', radius: 4 }}
                                    contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.05)', borderRadius: '12px' }}
                                    formatter={(value: number) => [formatCurrency(value, account.currency), 'Saved']}
                                />
                                <Bar dataKey="value" fill="#06B6D4" radius={[4, 4, 0, 0]} barSize={40}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === monthlyData.length - 1 ? '#0891B2' : '#06B6D4'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
               </Card>
          </div>

          {/* Right Column: Recent List */}
          <div className="space-y-8">
               <Card className="flex flex-col h-full max-h-[350px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Recent Round-ups</h3>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <TransactionList 
                            transactions={displayTransactionsList.slice(0, 8)} 
                            allCategories={allCategories} 
                            onTransactionClick={onTransactionClick} 
                        />
                    </div>
                </Card>
          </div>
      </div>
    </div>
  );
};

export default SpareChangeAccountView;
