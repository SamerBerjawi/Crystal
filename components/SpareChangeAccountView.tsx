import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseLocalDate, getPreferredTimeZone } from '../utils';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
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
  showBalanceAdjustments?: boolean;
}

const MetricTile = ({ label, value, icon, subValue, trend, colorClass = 'primary' }: { 
    label: string; 
    value: string; 
    icon: string; 
    subValue?: string;
    trend?: { val: string; positive: boolean };
    colorClass?: 'primary' | 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'orange' | 'purple' | 'cyan';
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
        cyan: 'bg-cyan-500/10 text-cyan-500',
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
  showBalanceAdjustments = true,
}) => {
  const { accounts } = useAccountsContext();
  const timeZone = getPreferredTimeZone();

  const sourceAccount = useMemo(() => {
      return accounts.find(a => a.id === account.linkedAccountId);
  }, [accounts, account.linkedAccountId]);

  const { totalSaved, totalRoundUps, avgRoundUp, thisMonthSaved, biggestRoundUp } = useMemo(() => {
      let saved = 0;
      let count = 0;
      let thisMonth = 0;
      let max = 0;
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      transactions
        .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
        .forEach(({ tx, parsedDate, convertedAmount }) => {
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
  }, [transactions, showBalanceAdjustments]);

  const monthlyData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const total = transactions
            .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth && t.tx.type === 'income' && !t.tx.isMarketAdjustment)
            .reduce((sum, t) => sum + t.convertedAmount, 0);
        data.push({ name: monthKey, value: total });
    }
    return data;
  }, [transactions, showBalanceAdjustments]);
  
  const coffeesSaved = Math.floor(totalSaved / 4.50);

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
                       <span className="text-[10px] font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">Auto-Savings</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80">Linked: {sourceAccount?.name || 'External'}</span>
                  </div>
                  <h1 className="text-4xl font-black text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
                      {account.name}
                      <span className="material-symbols-outlined text-light-text-secondary/20 dark:text-dark-text-secondary/20 font-light">{account.icon || 'savings'}</span>
                  </h1>
              </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
              {isLinkedToEnableBanking && onSyncLinkedAccount && (
                  <button onClick={onSyncLinkedAccount} className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-6 h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card`}>
                      <span className="material-symbols-outlined text-lg mr-2">sync</span>
                      Sync
                  </button>
              )}
              {onAdjustBalance && (
                  <button onClick={onAdjustBalance} className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-6 h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card`}>
                      <span className="material-symbols-outlined text-lg mr-2">tune</span>
                      Adjust
                  </button>
              )}
              <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-6 h-12 shadow-lg shadow-primary-500/20`}>
                  <span className="material-symbols-outlined text-lg mr-2">add</span>
                  Manual Link
              </button>
          </div>
      </header>

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Immersive Accumulation Card */}
           <div className="lg:col-span-12 xl:col-span-8">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-full min-h-[360px] rounded-[3rem] bg-gradient-to-br from-cyan-600 via-cyan-700 to-[#164e63] text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group"
               >
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)]"></div>
                   <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-[100px] animate-pulse"></div>
                   
                   <div className="relative z-10 flex flex-col md:flex-row justify-between gap-12 h-full">
                        <div className="flex-grow flex flex-col justify-between">
                             <div>
                                 <p className="text-[10px] font-bold text-cyan-100/80 mb-2">Automated micro-savings</p>
                                 <h2 className="text-6xl md:text-8xl font-bold tracking-tighter tabular-nums drop-shadow-lg">
                                     {formatCurrency(account.balance, account.currency)}
                                 </h2>
                             </div>
                             
                             <div className="flex gap-10 mt-8">
                                <div className="ios-regular px-6 py-4">
                                    <p className="text-[10px] tracking-wide text-cyan-100/70 font-bold mb-1">Total round-ups</p>
                                    <p className="font-bold text-2xl text-white">{totalRoundUps}</p>
                                </div>
                                <div className="ios-regular px-6 py-4 rounded-[2rem] border border-white/10 dark:border-white/5 !bg-white/10 dark:!bg-white/[0.05]">
                                    <p className="text-[10px] tracking-wide text-cyan-100/70 font-bold mb-1">MTD intake</p>
                                    <p className="font-bold text-2xl text-white">+{formatCurrency(thisMonthSaved, account.currency)}</p>
                                </div>
                             </div>
                        </div>
                        
                        <div className="md:w-64 flex flex-col justify-center items-center text-center border-l border-white/10 md:pl-10">
                             <div className="relative">
                                 <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full"></div>
                                 <div className="ios-regular w-24 h-24 !rounded-full flex items-center justify-center shadow-2xl relative z-10 mb-4">
                                      <span className="text-4xl">☕</span>
                                 </div>
                             </div>
                             <h3 className="text-xl font-bold text-white">Coffee index</h3>
                             <p className="text-[10px] font-bold text-cyan-200/80 tracking-wide mt-2">Saved value in caffeine</p>
                             <p className="text-5xl font-bold text-orange-400 mt-4 tabular-nums drop-shadow-sm">{coffeesSaved}</p>
                             <p className="text-[10px] font-bold text-orange-400/80 tracking-wide mt-1">Venti units</p>
                        </div>
                   </div>
               </motion.div>
           </div>

           {/* Metrics Grid */}
           <div className="lg:col-span-12 xl:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6">
                <MetricTile 
                    label="Capture Mean" 
                    value={formatCurrency(avgRoundUp, account.currency)} 
                    icon="auto_awesome" 
                    colorClass="emerald"
                    subValue="Avg value per round-up"
                />
                <MetricTile 
                    label="Peak Infusion" 
                    value={formatCurrency(biggestRoundUp, account.currency)} 
                    icon="bolt" 
                    colorClass="amber"
                    subValue="Largest single capture"
                />
           </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Charting & Activity */}
           <div className="lg:col-span-8 space-y-8">
                <div className="bg-white dark:bg-dark-card rounded-[3rem] border border-black/5 dark:border-white/5 p-10 group relative overflow-hidden">
                    <h3 className="text-xl font-black text-light-text dark:text-dark-text tracking-tight mb-10 flex justify-between items-center relative z-10">
                        Accumulation Pulse
                        <span className="text-[10px] font-bold text-light-text-secondary/50 dark:text-dark-text-secondary/60">Monthly Savings Velocity</span>
                    </h3>
                    
                    <div className="h-64 w-full relative z-10">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} stroke="currentColor" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(110, 110, 110, 0.05)', radius: 12 }}
                                    contentStyle={{ 
                                        backgroundColor: 'var(--light-card)', 
                                        backdropFilter: 'blur(15px) saturate(180%) brightness(105%)', 
                                        WebkitBackdropFilter: 'blur(15px) saturate(180%) brightness(105%)',
                                        border: 'none', 
                                        borderRadius: '24px', 
                                        boxShadow: 'inset 2px 2px 1px rgba(255, 255, 255, 0.05), inset -2px -2px 2px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.1)',
                                        padding: '16px' 
                                    }}
                                    itemStyle={{ color: 'inherit', fontSize: '18px', fontWeight: '900' }}
                                    labelStyle={{ color: 'currentColor', opacity: 0.5, fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px' }}
                                    formatter={(value: number) => [`${formatCurrency(value, account.currency)}`, 'Savings']}
                                />
                                <Bar dataKey="value" fill="#06B6D4" radius={[12, 12, 12, 12]} barSize={40}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={index === monthlyData.length - 1 ? 1 : 0.4} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card rounded-[3rem] border border-black/5 dark:border-white/5 overflow-hidden flex flex-col group h-[500px]">
                    <div className="p-10 border-b border-black/5 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01]">
                        <h3 className="text-xl font-bold tracking-tight text-light-text dark:text-dark-text">Recent captures</h3>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <TransactionList
                            transactions={displayTransactionsList.slice(0, 15)}
                            allCategories={allCategories}
                            onTransactionClick={onTransactionClick}
                            density="high"
                        />
                    </div>
                </div>
           </div>

           {/* Sidebar Logistics */}
           <div className="lg:col-span-4 space-y-8">
                {/* Infrastructure Configuration */}
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[3rem] p-10 group overflow-hidden">
                    <h3 className="text-[11px] font-black tracking-widest text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-8 uppercase">Infrastructure Configuration</h3>
                    <div className="space-y-6">
                        {[
                            { label: 'Source Account', value: sourceAccount?.name || 'External Link' },
                            { label: 'Accumulation Strategy', value: 'Dynamic Round-up' },
                            { label: 'Settlement Engine', value: account.currency },
                            { label: 'Establishment Date', value: account.openingDate ? parseLocalDate(account.openingDate).toLocaleDateString() : '—' },
                            { label: 'Engine Integrity', value: 'Active' },
                            { label: 'Logical Serial', value: account.accountNumber, isMono: true }
                        ].filter(i => i.value).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                                <p className="text-[9px] font-black tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/50 uppercase">{item.label}</p>
                                <p className={`text-xs font-black text-light-text dark:text-dark-text tracking-tight ${item.isMono ? 'font-mono opacity-60' : ''}`}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-12 p-8 rounded-[2rem] bg-cyan-500/5 border border-cyan-500/10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">settings_suggest</span>
                            </div>
                            <p className="text-[10px] font-bold text-cyan-500 tracking-wider">Automation Active</p>
                        </div>
                        <p className="text-xs font-medium text-light-text-secondary/70 dark:text-dark-text-secondary/90 leading-relaxed">
                            Spare change is automatically funneled from {sourceAccount?.name || 'the source account'} on every qualifying expenditure.
                        </p>
                    </div>
                </div>
           </div>
      </div>
    </div>
  );
};

export default SpareChangeAccountView;
