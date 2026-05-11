import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseLocalDate, convertToEur, getPreferredTimeZone, toLocalISOYearMonth } from '../utils';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, ComposedChart, Line, Cell } from 'recharts';
import { motion } from 'motion/react';

interface PensionAccountViewProps {
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

const PensionAccountView: React.FC<PensionAccountViewProps> = ({
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
  const currentYear = new Date().getFullYear();
  const retirementYear = account.expectedRetirementYear || (currentYear + 20);
  const yearsToRetirement = Math.max(0, retirementYear - currentYear);

  // --- Growth & Contributions ---
  const { totalContributions, totalGrowth, annualizedReturn, monthlyContributionAvg } = useMemo(() => {
    let contributions = 0;
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    let contributionsLast12Months = 0;

    transactions
        .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
        .forEach(({ tx, parsedDate, convertedAmount }) => {
        if (tx.type === 'income') {
            if (!tx.isMarketAdjustment && !tx.category.toLowerCase().includes('interest') && !tx.category.toLowerCase().includes('dividend')) {
                 contributions += convertedAmount;
                 if (parsedDate >= oneYearAgo) {
                     contributionsLast12Months += convertedAmount;
                 }
            }
        } else if (tx.type === 'expense') {
            if (!tx.isMarketAdjustment) {
                contributions -= Math.abs(convertedAmount);
            }
        }
    });

    const currentBalanceEur = convertToEur(account.balance, account.currency);
    const growth = currentBalanceEur - contributions;
    const simpleReturn = contributions > 0 ? (growth / contributions) : 0;
    
    return {
        totalContributions: contributions,
        totalGrowth: growth,
        annualizedReturn: simpleReturn, 
        monthlyContributionAvg: contributionsLast12Months / 12
    };
  }, [transactions, account.balance, account.currency, showBalanceAdjustments]);

  // --- Projection Chart ---
  const chartData = useMemo(() => {
    const historicalDataPoints = [];
    const today = new Date();
    const openingDate = account.openingDate ? parseLocalDate(account.openingDate) : new Date(today.getFullYear() - 5, today.getMonth(), 1);
    const monthsToBackfill = (today.getFullYear() - openingDate.getFullYear()) * 12 + (today.getMonth() - openingDate.getMonth()) + 1;
    const monthlyDataMap = new Map<string, { balance: number, contributions: number }>();
    
    let currentBal = convertToEur(account.balance, account.currency);
    let currentContrib = totalContributions;
    
    for (let i = 0; i < Math.max(1, monthsToBackfill); i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = toLocalISOYearMonth(d);
        monthlyDataMap.set(key, { balance: currentBal, contributions: currentContrib });
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const txsInMonth = transactions
            .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth);
        txsInMonth.forEach(({ tx, convertedAmount }) => {
            currentBal -= convertedAmount;
             if (tx.type === 'income' && !tx.isMarketAdjustment && !tx.category.toLowerCase().includes('interest')) {
                 currentContrib -= convertedAmount;
             } else if (tx.type === 'expense' && !tx.isMarketAdjustment) {
                 currentContrib += Math.abs(convertedAmount);
             }
        });
        if (currentBal < 0) currentBal = 0;
        if (currentContrib < 0) currentContrib = 0;
    }
    const historicalData = Array.from(monthlyDataMap.entries())
        .map(([date, data]) => ({ date, ...data, type: 'History' }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const projectionData = [];
    let projBalance = convertToEur(account.balance, account.currency);
    let projContrib = totalContributions;
    const monthlyRate = (account.apy || 5) / 100 / 12;
    const monthsToRetire = yearsToRetirement * 12;
    const step = Math.max(1, Math.floor(monthsToRetire / 24));
    let d = new Date(today);
    
    for (let i = 1; i <= monthsToRetire; i++) {
        projBalance += monthlyContributionAvg;
        projContrib += monthlyContributionAvg;
        projBalance = projBalance * (1 + monthlyRate);
        d.setMonth(d.getMonth() + 1);
        if (i % step === 0 || i === monthsToRetire) {
             projectionData.push({
                 date: toLocalISOYearMonth(d),
                 balance: projBalance,
                 contributions: projContrib,
                 type: 'Projection'
             });
        }
    }
    return [...historicalData, ...projectionData];
  }, [transactions, account.balance, account.currency, account.apy, account.openingDate, totalContributions, monthlyContributionAvg, yearsToRetirement, showBalanceAdjustments]);

  const projectedValueAtRetirement = chartData.length > 0 ? chartData[chartData.length - 1].balance : 0;

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
                       <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">Pension Asset</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80">Targeted Maturity: {retirementYear}</span>
                  </div>
                  <h1 className="text-4xl font-bold text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
                      {account.name}
                      <span className="material-symbols-outlined text-light-text-secondary/20 dark:text-dark-text-secondary/20 font-light">{account.icon || 'elderly'}</span>
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
                  Contribution
              </button>
          </div>
      </header>

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Immersive Growth Card */}
           <div className="lg:col-span-12 xl:col-span-8">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-full min-h-[360px] rounded-[3rem] bg-gradient-to-br from-indigo-700 via-indigo-900 to-[#1e1b4b] text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group"
               >
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)]"></div>
                   <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px]"></div>
                   
                   <div className="relative z-10 flex flex-col md:flex-row justify-between gap-12">
                        <div className="flex-grow">
                             <p className="text-[10px] font-bold tracking-wider text-indigo-200/80 mb-2">Total Pot Capitalization</p>
                             <h2 className="text-6xl md:text-7xl font-bold tracking-tighter tabular-nums drop-shadow-lg mb-8">
                                 {formatCurrency(account.balance, account.currency)}
                             </h2>
                             <div className="flex gap-10">
                                 <div>
                                    <p className="text-[10px] font-bold tracking-wider text-indigo-200/40 mb-1">Maturity Age Target</p>
                                    <p className="font-bold text-2xl text-white drop-shadow-sm">{retirementYear}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold tracking-wider text-indigo-200/40 mb-1">Runway</p>
                                    <p className="font-bold text-2xl text-indigo-300 drop-shadow-sm">{yearsToRetirement} Years</p>
                                </div>
                             </div>
                        </div>
                        
                        <div className="md:w-64 flex flex-col justify-between text-right border-l border-white/10 md:pl-10">
                             <div>
                                 <p className="text-[10px] font-bold tracking-wider text-indigo-200/40 mb-2">Forecasted Value</p>
                                 <p className="text-3xl font-bold text-white tabular-nums tracking-tight">{formatCurrency(projectedValueAtRetirement, account.currency)}</p>
                                 <p className="text-[10px] font-bold text-indigo-300 mt-1">At {account.apy || 5}% Growth Rate</p>
                             </div>
                             <div className="mt-8 space-y-3">
                                 <div className="flex justify-between items-end text-[10px] font-bold tracking-wider text-indigo-100/40">
                                     <span>Accumulation Index</span>
                                     <span className="text-white">{(100 - (yearsToRetirement/40 * 100)).toFixed(0)}%</span>
                                 </div>
                                 <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                     <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, Math.max(5, (1 - (yearsToRetirement / 40)) * 100))}%` }}
                                        className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                                     />
                                 </div>
                             </div>
                        </div>
                   </div>
               </motion.div>
           </div>

           {/* Metrics Grid */}
           <div className="lg:col-span-12 xl:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6">
                <MetricTile 
                    label="Yield Growth" 
                    value={formatCurrency(totalGrowth, account.currency)} 
                    icon="trending_up" 
                    colorClass="emerald"
                    subValue="Market adjustments & dividends"
                />
                <MetricTile 
                    label="Velocity" 
                    value={formatCurrency(monthlyContributionAvg, account.currency)} 
                    icon="payments" 
                    colorClass="blue"
                    subValue="Avg. monthly infusion (12m)"
                />
           </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Charting & Activity */}
           <div className="lg:col-span-8 space-y-8">
                <div className="bg-white dark:bg-dark-card rounded-[3rem] border border-black/5 dark:border-white/5 p-10 group relative overflow-hidden">
                    <h3 className="text-xl font-black text-light-text dark:text-dark-text tracking-tight mb-10 flex justify-between items-center relative z-10">
                        Fortune Trajectory
                        <span className="text-[10px] font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/60">History & Forecast</span>
                    </h3>
                    
                    <div className="h-[400px] w-full relative z-10">
                         <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="pensionBalGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} stroke="currentColor" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} 
                                    minTickGap={60}
                                    tickFormatter={(val) => val.split('-')[0]}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} width={40} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ fontSize: '14px', fontWeight: '900' }}
                                    labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.05em' }}
                                />
                                <Legend verticalAlign="bottom" iconType="circle" />
                                <Area type="monotone" dataKey="balance" name="Market Value" stroke="#6366F1" fill="url(#pensionBalGradient)" strokeWidth={4} />
                                <Line type="monotone" dataKey="contributions" name="Principal" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="6 6" />
                                <ReferenceLine x={toLocalISOYearMonth(new Date())} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: "Now", position: "top", fill: "#F59E0B", fontSize: 10, fontWeight: 900 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card rounded-[3rem] border border-black/5 dark:border-white/5 overflow-hidden flex flex-col group h-[600px]">
                    <div className="p-10 border-b border-black/5 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01]">
                        <h3 className="text-xl font-bold tracking-tight text-light-text dark:text-dark-text">Capital infusions</h3>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <TransactionList
                            transactions={displayTransactionsList}
                            allCategories={allCategories}
                            onTransactionClick={onTransactionClick}
                            density="high"
                        />
                    </div>
                </div>
           </div>

           {/* Sidebar Logistics */}
           <div className="lg:col-span-4 space-y-8">
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[3rem] p-10 group overflow-hidden">
                    <h3 className="text-[10px] font-bold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/90 mb-8 underline underline-offset-8 decoration-primary-500/20">Financial Logistics</h3>
                    <div className="space-y-10 divide-y divide-black/5 dark:divide-white/5">
                        {[
                            { label: 'Clearing Institution', value: account.financialInstitution },
                            { label: 'Pot Architecture', value: account.type },
                            { label: 'Settlement Engine', value: account.currency },
                            { label: 'Establishment Date', value: account.openingDate ? parseLocalDate(account.openingDate).toLocaleDateString() : '—' },
                            { label: 'Growth Vector (APY)', value: `${account.apy || 5}% Calculated` },
                            { label: 'Target Epoch', value: retirementYear },
                            { label: 'Internal Serial', value: account.accountNumber, isMono: true }
                        ].filter(i => i.value).map((item, idx) => (
                            <div key={idx} className="pt-8 first:pt-0">
                                <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/50 dark:text-dark-text-secondary/70 mb-1">{item.label}</p>
                                <p className={`text-base font-bold text-light-text dark:text-dark-text tracking-tight ${item.isMono ? 'font-mono opacity-60' : ''}`}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-12 p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">verified</span>
                            </div>
                            <p className="text-[10px] font-bold text-indigo-500 tracking-wider">Asset Integrity Verified</p>
                        </div>
                        <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 leading-relaxed">
                            Projections assume a static growth vector and linear contribution velocity.
                        </p>
                    </div>
                </div>
           </div>
      </div>
    </div>
  );
};

export default PensionAccountView;
