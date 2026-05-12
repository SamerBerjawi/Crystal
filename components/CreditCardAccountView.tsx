import React, { useMemo, useState } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, getPreferredTimeZone } from '../utils';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { motion } from 'motion/react';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getCardNetworkLogoUrl } from '../utils/brandfetch';

interface CreditCardAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
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
                <p className="text-[11px] font-bold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/90 mb-1">{label}</p>
                <h4 className="text-3xl font-black text-light-text dark:text-dark-text tracking-tight tabular-nums">{value}</h4>
                {subValue && <p className="text-xs font-bold text-light-text-secondary/50 dark:text-dark-text-secondary/70 mt-1 tracking-tight">{subValue}</p>}
            </div>
        </div>
    );
};

const CreditCardAccountView: React.FC<CreditCardAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
  showBalanceAdjustments = true,
}) => {
  const timeZone = getPreferredTimeZone();
  const [logoError, setLogoError] = useState(false);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());

  const logoUrl = useMemo(() => {
    if (logoError || !brandfetchClientId || !account.cardNetwork) return null;
    return getCardNetworkLogoUrl(account.cardNetwork, brandfetchClientId);
  }, [account.cardNetwork, brandfetchClientId, logoError]);

  // --- Metrics ---
  const { totalSpent, totalPayments, utilization, availableCredit } = useMemo(() => {
      let spent = 0;
      let payments = 0;
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      transactions
        .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
        .forEach(({ tx, parsedDate, convertedAmount }) => {
          if (parsedDate >= startOfMonth) {
              if (tx.type === 'expense') {
                  spent += Math.abs(convertedAmount);
              } else if (tx.type === 'income') {
                  if (tx.transferId || tx.category.toLowerCase().includes('payment') || tx.category.toLowerCase().includes('transfer')) {
                      payments += convertedAmount;
                  } else {
                      spent -= convertedAmount;
                  }
              }
          }
      });
      
      const creditLimit = account.creditLimit || 0;
      const balanceOwed = -account.balance;
      const util = creditLimit > 0 ? (balanceOwed / creditLimit) * 100 : 0;
      const available = creditLimit - balanceOwed;

      return { totalSpent: spent, totalPayments: payments, utilization: util, availableCredit: available };
  }, [transactions, account.balance, account.creditLimit, showBalanceAdjustments]);

  // --- Chart Data ---
  const spendingHistory = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        
        const total = transactions
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth)
            .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
            .reduce((sum, t) => {
                if (t.tx.type === 'expense') {
                    return sum + Math.abs(t.convertedAmount);
                } else if (t.tx.type === 'income') {
                    if (!(t.tx.transferId || t.tx.category.toLowerCase().includes('payment') || t.tx.category.toLowerCase().includes('transfer'))) {
                        return sum - t.convertedAmount;
                    }
                }
                return sum;
            }, 0);
        
        data.push({ name: monthKey, value: total });
    }
    return data;
  }, [transactions, showBalanceAdjustments]);

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
                       <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">Liability Account</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80">{account.currency} Credit Line</span>
                  </div>
                  <h1 className="text-4xl font-black text-light-text dark:text-dark-text tracking-tighter flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 border border-black/5 dark:border-white/5 overflow-hidden">
                        {logoUrl ? (
                            <img src={logoUrl} alt="" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
                        ) : (
                            <span className="material-symbols-outlined text-primary-500 text-2xl">credit_card</span>
                        )}
                      </div>
                      {account.name}
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
              <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-6 h-12 shadow-lg shadow-primary-500/20`}>
                  <span className="material-symbols-outlined text-lg mr-2">add</span>
                  Transaction
              </button>
          </div>
      </header>

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Immersive Virtual Card */}
           <div className="lg:col-span-5 xl:col-span-4">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-full min-h-[440px] rounded-[3rem] bg-[#1a1a1a] text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group"
               >
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent"></div>
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                   <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]"></div>
                                     <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                             <div className="w-14 h-10 rounded-lg bg-gradient-to-br from-amber-400/80 to-amber-200/40 p-[2px] backdrop-blur-sm shadow-inner relative overflow-hidden group/chip">
                                  <div className="w-full h-full bg-amber-400/30 rounded-[6px] relative overflow-hidden">
                                       <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.1)_4px,rgba(0,0,0,0.1)_8px)]"></div>
                                  </div>
                             </div>
                             
                             {logoUrl ? (
                                <img src={logoUrl} alt="" className="h-10 object-contain" onError={() => setLogoError(true)} />
                             ) : (
                                <span className="text-xl font-bold tracking-widest text-white/40 drop-shadow-sm uppercase">{account.cardNetwork || 'PLATINUM'}</span>
                             )}
                        </div>
                        
                        <div>
                            <p className="text-[11px] font-bold tracking-wider text-slate-400 mb-2">Total Outstanding Liability</p>
                            <h2 className={`text-6xl font-bold tracking-tight tabular-nums drop-shadow-sm mb-12 ${account.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {formatCurrency(account.balance, account.currency)}
                            </h2>
                            
                            {account.last4 && (
                                <p className="text-lg font-bold tracking-[0.3em] text-slate-200 drop-shadow-md font-mono mb-8 opacity-80 decoration-slate-500/50 underline-offset-8">
                                    •••• •••• •••• {account.last4}
                                </p>
                            )}
                        </div>

                     <div className="relative z-10 pt-10 border-t border-white/5 space-y-6">
                       <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[11px] tracking-wider text-slate-500 font-bold">Credit Limit Utilization</p>
                                <p className={`text-4xl font-bold tabular-nums leading-none ${utilization > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {utilization.toFixed(1)}%
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] tracking-wider text-slate-500 font-bold mb-1">Limit</p>
                                <p className="font-bold text-2xl text-white tabular-nums opacity-60 decoration-slate-500/50 underline-offset-4">{formatCurrency(account.creditLimit || 0, account.currency)}</p>
                            </div>
                       </div>
                       <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, utilization)}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className={`h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)] ${utilization > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            />
                       </div>
                    </div>
                </div>
            </motion.div>
        </div>

           {/* Metrics & Analytics */}
           <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricTile 
                        label="Spent (MTD)" 
                        value={formatCurrency(totalSpent, account.currency)} 
                        icon="shopping_bag" 
                        colorClass="rose"
                        subValue="Current cycle charges"
                    />
                    <MetricTile 
                        label="Repayments" 
                        value={formatCurrency(totalPayments, account.currency)} 
                        icon="check_circle" 
                        colorClass="emerald"
                        subValue="Statement credit applied"
                    />
                    <MetricTile 
                        label="Unused Credit" 
                        value={formatCurrency(availableCredit, account.currency)} 
                        icon="shield" 
                        colorClass="blue"
                        subValue="Total liquidity buffer"
                    />
                </div>

                {/* Spending Velocity Chart */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-8 flex-grow flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <span className="material-symbols-outlined text-8xl">insights</span>
                    </div>
                    <div className="flex justify-between items-center mb-10 relative z-10">
                        <div>
                             <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Spend velocity</h3>
                             <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Monthly credit utilization history</p>
                        </div>
                    </div>
                    
                    <div className="flex-grow w-full h-full min-h-[220px] relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={spendingHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={40}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} stroke="currentColor" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} 
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(110, 110, 110, 0.05)', radius: 10 }}
                                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ fontSize: '14px', fontWeight: '900', color: '#f97316' }}
                                    labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.05em' }}
                                />
                                <Bar dataKey="value" radius={[12, 12, 12, 12]}>
                                    {spendingHistory.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.value < 0 ? '#10B981' : '#f43f5e'} 
                                            fillOpacity={index === spendingHistory.length - 1 ? 1 : 0.6}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
           </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
           {/* Billing Details Sidebar */}
           <div className="xl:col-span-4 flex flex-col gap-8">
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-10 h-full flex flex-col group">
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight mb-8 flex items-center gap-3">
                        Billing engine
                        <span className="material-symbols-outlined text-slate-300">settings</span>
                    </h3>
                    <div className="space-y-10">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-[1.25rem] bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/5">
                                <span className="material-symbols-outlined text-2xl font-light">calendar_today</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Statement Open</p>
                                <p className="font-bold text-lg text-light-text dark:text-dark-text tracking-tight tabular-nums">
                                    {account.statementStartDate ? `Day ${account.statementStartDate} of Month` : 'Unconfigured'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-[1.25rem] bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/5">
                                <span className="material-symbols-outlined text-2xl font-light">priority_high</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Settlement Due</p>
                                <p className="font-bold text-lg text-light-text dark:text-dark-text tracking-tight tabular-nums">
                                    {account.paymentDate ? `Day ${account.paymentDate} of Month` : 'Unconfigured'}
                                </p>
                            </div>
                        </div>
                    </div>
                        
                        <div className="pt-10 border-t border-black/5 dark:border-white/5">
                             {account.settlementAccountId ? (
                                <div className="p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4 group/status">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center group-hover/status:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-lg">verified</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider mb-0.5">Auto-Pay Active</p>
                                        <p className="text-[10px] font-bold text-emerald-600/60 transition-colors group-hover/status:text-emerald-500 tracking-wider">Linked to Clearing Account</p>
                                    </div>
                                </div>
                             ) : (
                                <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">warning</span>
                                    </div>
                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 tracking-wider">Manual Payment Required</p>
                                </div>
                             )}
                        </div>
                    </div>
                </div>

           <div className="xl:col-span-8 flex flex-col gap-8">
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-2xl shadow-black/[0.02] overflow-hidden flex flex-col h-full group">
                    <div className="p-10 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-gray-50/30 dark:bg-white/[0.01]">
                        <div>
                            <h3 className="text-2xl font-bold tracking-tight text-light-text dark:text-dark-text">Statement activity</h3>
                            <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Active billing cycle transactions</p>
                        </div>
                    </div>
                    <div className="flex-grow min-h-[400px]">
                        {displayTransactionsList.length > 0 ? (
                            <TransactionList
                                transactions={displayTransactionsList}
                                allCategories={allCategories}
                                onTransactionClick={onTransactionClick}
                                density="high"
                                maxItems={15}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-20 grayscale opacity-20">
                                 <span className="material-symbols-outlined text-6xl mb-4 font-light">receipt_long</span>
                                 <p className="text-xs font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/60">No transaction data identified</p>
                            </div>
                        )}
                    </div>
                </div>
           </div>
      </div>
    </div>
  );
};

export default CreditCardAccountView;
