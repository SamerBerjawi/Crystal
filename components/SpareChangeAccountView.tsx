import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, convertToEur, getPreferredTimeZone } from '../utils';
import Card from './Card';
import PageHeader from './PageHeader';
import BankCard from './BankCard';
import TransactionList from './TransactionList';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { useAccountsContext } from '../contexts/DomainProviders';
import { motion } from 'motion/react';

interface SpareChangeAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
  onAdjustBalance?: () => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
}

const SpareChangeAccountView: React.FC<SpareChangeAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack,
  onAdjustBalance,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
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
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      transactions.forEach(({ tx, parsedDate, convertedAmount }) => {
          if (tx.type === 'income') {
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
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const total = transactions
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth && t.tx.type === 'income' && !t.tx.isMarketAdjustment)
            .reduce((sum, t) => sum + t.convertedAmount, 0);
        data.push({ name: monthKey, value: total });
    }
    return data;
  }, [transactions]);
  
  const coffeesSaved = Math.floor(totalSaved / 4.50);

  return (
    <div className="space-y-10 animate-fade-in-up pb-12">
      <PageHeader 
        markerIcon="savings"
        markerLabel="Micro-saving engine • Spare Change"
        title={account.name}
        subtitle="Automated change round-up tracking with accumulation velocity and impact analysis."
        className="mb-8"
        actions={
          <div className="flex items-center gap-2">
            <button 
                onClick={onBack} 
                className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
                title="Back to All Accounts"
            >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
             {onAdjustBalance && (
                <button onClick={onAdjustBalance} className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 text-light-text dark:text-dark-text rounded-xl font-bold text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5">
                    <span className="material-symbols-outlined text-sm font-black">tune</span>
                    <span className="hidden sm:inline">Reconcile</span>
                </button>
             )}
            <button onClick={onAddTransaction} className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-cyan-600/25 hover:bg-cyan-700 transition-all">
                <span className="material-symbols-outlined text-sm font-black">add</span>
                <span className="hidden sm:inline">Manual Fill</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Bank Card & Summary Pulse */}
        <div className="lg:col-span-4 space-y-8">
            <BankCard 
                name={account.name}
                balance={account.balance}
                currency={account.currency}
                last4={account.last4}
                institution={account.financialInstitution}
                type="Spare Change"
                color="cyan"
            />

            <Card className="p-8 !rounded-[2.5rem] bg-cyan-600 text-white shadow-2xl shadow-cyan-600/20 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                     <span className="material-symbols-outlined text-9xl">savings</span>
                 </div>
                 <div className="relative z-10 text-center">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-8 leading-none">Coffee Index Impact</p>
                     <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-xl">
                        ☕
                     </div>
                     <h3 className="text-6xl font-black tracking-tightest mb-2 privacy-blur">{coffeesSaved}</h3>
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Cappuccinos Accumulated</p>
                 </div>
            </Card>

            <div className="grid grid-cols-1 gap-4">
                <Card className="p-8 !rounded-[2.5rem] border-cyan-500/10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary opacity-40 mb-1">Lifetime Rounds</p>
                            <p className="text-3xl font-black text-light-text dark:text-dark-text tracking-tightest">{totalRoundUps}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">restart_alt</span>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest leading-relaxed">
                        Total number of micro-transactions processed
                    </p>
                </Card>

                <Card className="p-8 !rounded-[2.5rem] border-cyan-500/10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary opacity-40 mb-1">Average Lift</p>
                            <p className="text-3xl font-black text-light-text dark:text-dark-text tracking-tightest privacy-blur">{formatCurrency(avgRoundUp, account.currency)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">analytics</span>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest leading-relaxed">
                        The average amount saved per transaction
                    </p>
                </Card>
            </div>
        </div>

        {/* Right Column: Analytics & List */}
        <div className="lg:col-span-8 space-y-8">
            <Card className="p-8 !rounded-[2.5rem] border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-dark-card flex flex-col h-[450px]">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-cyan-500">bar_chart_4_bars</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Accumulation Intensity</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary opacity-40 uppercase tracking-widest leading-none">Last 6 Months Velocity</p>
                        </div>
                    </div>
                    {sourceAccount && (
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Source Account</span>
                            <span className="text-xs font-black text-light-text dark:text-dark-text">{sourceAccount.name}</span>
                        </div>
                    )}
                </div>

                <div className="flex-grow w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.05} vertical={false} stroke="currentColor" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 10, fontWeight: 900 }} 
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 10, fontWeight: 900 }} 
                                tickFormatter={(val) => `${val}`} 
                            />
                            <Tooltip 
                                cursor={{ fill: 'currentColor', opacity: 0.05, radius: 8 }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white dark:bg-dark-card p-4 rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 min-w-[140px]">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-40">{label}</p>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-light-text dark:text-dark-text">
                                                        {formatCurrency(payload[0].value as number, account.currency)}
                                                    </span>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 mt-1">Saved</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={40}>
                                {monthlyData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={index === monthlyData.length - 1 ? '#0891B2' : 'currentColor'} 
                                        className={index === monthlyData.length - 1 ? 'opacity-100' : 'opacity-10'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden flex flex-col h-full max-h-[500px]">
                <div className="flex items-center justify-between p-8 border-b border-black/5 dark:border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-light-text-secondary">history</span>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text">Micro Journal</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded">Accumulating</span>
                    </div>
                </div>
                <div className="flex-grow overflow-hidden">
                    <TransactionList 
                        transactions={displayTransactionsList.slice(0, 15)} 
                        allCategories={allCategories} 
                        onTransactionClick={onTransactionClick} 
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SpareChangeAccountView;