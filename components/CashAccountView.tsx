import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, convertToEur, getPreferredTimeZone } from '../utils';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { motion } from 'motion/react';

interface CashAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
  onAdjustBalance: () => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
  showBalanceAdjustments?: boolean;
}

const MetricTile = ({ label, value, icon, subValue, trend, colorClass = 'primary' }: { 
    label: string; 
    value: string; 
    icon: string; 
    subValue?: string;
    trend?: { val: string; positive: boolean };
    colorClass?: 'primary' | 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'orange' | 'purple';
}) => {
    const colors = {
        primary: 'bg-primary-500/10 text-primary-500',
        emerald: 'bg-emerald-500/10 text-emerald-500',
        rose: 'bg-rose-500/10 text-rose-500',
        amber: 'bg-amber-500/10 text-amber-500',
        blue: 'bg-blue-500/10 text-blue-500',
        indigo: 'bg-indigo-500/10 text-indigo-500',
        orange: 'bg-orange-500/10 text-orange-500',
        purple: 'bg-purple-500/10 text-purple-500',
    };

    return (
        <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2rem] p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 transition-all duration-500 h-full">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${colors[colorClass].split(' ')[1].replace('text-', 'bg-')}`}></div>
            <div className="flex justify-between items-start relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[colorClass]}`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${trend.positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                         <span className="material-symbols-outlined text-[10px]">{trend.positive ? 'trending_up' : 'trending_down'}</span>
                         {trend.val}
                    </div>
                )}
            </div>
            <div className="mt-6 relative z-10">
                <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/90 mb-1">{label}</p>
                <h4 className="text-2xl font-black text-light-text dark:text-dark-text tracking-tight tabular-nums">{value}</h4>
                {subValue && <p className="text-[11px] font-bold text-light-text-secondary/50 dark:text-dark-text-secondary/70 mt-1 tracking-tight">{subValue}</p>}
            </div>
        </div>
    );
};

const CashAccountView: React.FC<CashAccountViewProps> = ({
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
  showBalanceAdjustments = true,
}) => {
  const timeZone = getPreferredTimeZone();

  // --- Metrics ---
  const { totalInflow, totalOutflow, netChange, lastReplenishment } = useMemo(() => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      let inflow = 0;
      let outflow = 0;
      let lastRep: Date | null = null;

      transactions
        .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
        .forEach(({ tx, parsedDate }) => {
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
  }, [transactions, showBalanceAdjustments]);

  const flowData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        
        let inc = 0;
        let exp = 0;

        transactions
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth)
            .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
            .forEach(({ tx }) => {
                 const val = Math.abs(convertToEur(tx.amount, tx.currency));
                 if (tx.amount > 0) inc += val;
                 else exp += val;
            });
        
        data.push({ name: monthKey, income: inc, expense: exp });
    }
    return data;
  }, [transactions, showBalanceAdjustments]);

  const burnRateMessage = useMemo(() => {
      if (account.balance <= 0) return "Reserve depleted";
      const avgDailySpend = totalOutflow / 30;
      if (avgDailySpend <= 0) return "Stagnant reserve";
      const daysLeft = account.balance / avgDailySpend;
      if (daysLeft < 3) return "Low reserve warning";
      if (daysLeft > 60) return "Robust liquidity";
      return `~${Math.floor(daysLeft)} days runway`;
  }, [account.balance, totalOutflow]);

  return (
    <div className="space-y-10 animate-fade-in-up pb-10">
      {/* Dynamic Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
          <div className="flex items-center gap-6">
              <button 
                  onClick={onBack}
                  className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all shadow-sm group active:scale-95"
              >
                  <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
              </button>
              <div>
                  <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">Cash Asset</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80">{account.currency} Physical Reserve</span>
                  </div>
                  <h1 className="text-4xl font-bold text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
                      {account.name}
                      <span className="material-symbols-outlined text-light-text-secondary/20 dark:text-dark-text-secondary/20">payments</span>
                  </h1>
              </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
              <button onClick={onAdjustBalance} className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-6 h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card`}>
                  <span className="material-symbols-outlined text-lg mr-2">balance</span>
                  Adjust Balance
              </button>
              <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-6 h-12 shadow-lg shadow-primary-500/20`}>
                  <span className="material-symbols-outlined text-lg mr-2">add</span>
                  Log Transaction
              </button>
          </div>
      </header>

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Immersive Safe Card */}
           <div className="lg:col-span-5 xl:col-span-4">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-full min-h-[440px] rounded-[3rem] bg-gradient-to-br from-slate-800 to-slate-950 text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group"
               >
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)]"></div>
                   <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] animate-pulse"></div>
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] opacity-20 pointer-events-none"></div>
                   
                   <div className="relative z-10">
                        <div className="flex justify-between items-start mb-12">
                             <div className="w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg">
                                  <span className="material-symbols-outlined text-3xl text-emerald-400 font-light">lock</span>
                             </div>
                             <div className="text-right">
                                  <p className="text-[10px] font-bold tracking-wider text-slate-400 mb-1">Status</p>
                                  <p className="text-xs font-bold text-emerald-400 tracking-widest drop-shadow-sm">Synchronized</p>
                             </div>
                        </div>
                        
                        <p className="text-[10px] font-bold text-slate-400 mb-2">Total Managed Cash</p>
                        <h2 className="text-6xl font-bold tracking-tighter tabular-nums drop-shadow-lg mb-8">
                            {formatCurrency(account.balance, account.currency)}
                        </h2>
                        
                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 backdrop-blur-md border border-white/5 shadow-inner">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                             <span className="text-[11px] font-bold tracking-wider text-emerald-300 drop-shadow-sm">{burnRateMessage}</span>
                        </div>
                   </div>

                   <div className="relative z-10 pt-10 border-t border-white/5 grid grid-cols-2 gap-8">
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-500 font-bold mb-1">MTD Delta</p>
                           <p className={`font-black text-xl flex items-center gap-1 ${netChange >= 0 ? 'text-white' : 'text-rose-400'}`}>
                               {netChange >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(netChange), account.currency)}
                           </p>
                       </div>
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-500 font-bold mb-1">Last Intake</p>
                           <p className="font-black text-xl text-white tabular-nums opacity-60">
                                {lastReplenishment ? lastReplenishment.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '—'}
                           </p>
                       </div>
                   </div>
               </motion.div>
           </div>

           {/* Metrics & Analytics */}
           <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricTile 
                        label="Replenished" 
                        value={formatCurrency(totalInflow, account.currency)} 
                        icon="input" 
                        colorClass="emerald"
                        subValue="New capital (30d)"
                    />
                    <MetricTile 
                        label="Expended" 
                        value={formatCurrency(totalOutflow, account.currency)} 
                        icon="output" 
                        colorClass="rose"
                        subValue="Withdrawals (30d)"
                    />
                    <MetricTile 
                        label="Reserve Index" 
                        value={burnRateMessage.split(' ')[0]} 
                        icon="analytics" 
                        colorClass="blue"
                        subValue="Stability forecast"
                    />
                </div>

                {/* Flow Velocity Chart */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-8 flex-grow flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <span className="material-symbols-outlined text-8xl">compare_arrows</span>
                    </div>
                    <div className="flex justify-between items-center mb-10 relative z-10">
                        <div>
                             <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Flow lifecycle</h3>
                             <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Inflow vs Outflow velocity</p>
                        </div>
                    </div>
                    
                    <div className="flex-grow w-full h-full min-h-[220px] relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={flowData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} stroke="currentColor" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} 
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(110, 110, 110, 0.05)', radius: 12 }}
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(30, 41, 59, 0.7)', 
                                        backdropFilter: 'blur(16px)', 
                                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                                        borderRadius: '24px', 
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                        padding: '16px' 
                                    }}
                                    itemStyle={{ color: '#fff', fontSize: '18px', fontWeight: '900' }}
                                    labelStyle={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px' }}
                                    formatter={(value: number, name: string) => [`${formatCurrency(value, account.currency)}`, name]}
                                />
                                <Bar dataKey="income" name="Intake" stackId="a" fill="#10B981" radius={[0, 0, 12, 12]} />
                                <Bar dataKey="expense" name="Spend" stackId="a" fill="#F43F5E" radius={[12, 12, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
           </div>
      </div>

      {/* Ledger Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-2xl shadow-black/[0.02] overflow-hidden flex flex-col h-full group">
                <div className="p-10 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-gray-50/30 dark:bg-white/[0.01]">
                    <div>
                        <h3 className="text-[11px] font-black tracking-widest text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-1 uppercase">Reserve journal</h3>
                        <p className="text-[10px] font-semibold text-light-text-secondary/40 dark:text-dark-text-secondary/60 tracking-widest uppercase">Complete history of manual flow logs</p>
                    </div>
                </div>
                <div className="flex-grow min-h-[400px]">
                    <TransactionList
                        transactions={displayTransactionsList.slice(0, 15)}
                        allCategories={allCategories}
                        onTransactionClick={onTransactionClick}
                        density="high"
                    />
                </div>
           </div>

           {/* Sidebar */}
           <div className="lg:col-span-4 space-y-8">
                {/* Infrastructure Configuration */}
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[3rem] p-10 group overflow-hidden">
                    <h3 className="text-[11px] font-black tracking-widest text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-8 uppercase">Infrastructure Configuration</h3>
                    <div className="space-y-6">
                        {[
                            { label: 'Settlement Engine', value: account.currency },
                            { label: 'Establishment Date', value: account.openingDate ? new Date(account.openingDate).toLocaleDateString() : '—' },
                            { label: 'Engine Integrity', value: 'Verified' },
                            { label: 'Logical Serial', value: account.id.slice(0, 8), isMono: true }
                        ].map((item, idx) => (
                            <div key={idx} className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                                <p className="text-[9px] font-black tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/50 uppercase">{item.label}</p>
                                <p className={`text-xs font-black text-light-text dark:text-dark-text tracking-tight ${item.isMono ? 'font-mono opacity-60' : ''}`}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-12 p-8 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">verified_user</span>
                            </div>
                            <p className="text-[10px] font-bold text-emerald-500 tracking-wider">Physical Reserve</p>
                        </div>
                        <p className="text-xs font-medium text-light-text-secondary/70 dark:text-dark-text-secondary/90 leading-relaxed uppercase tracking-tighter">
                            Assets are verified through periodic manual reconciliation procedures.
                        </p>
                    </div>
                </div>
           </div>
      </div>
    </div>
  );
};

export default CashAccountView;
