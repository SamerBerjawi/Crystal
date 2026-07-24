import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseLocalDate, getPreferredTimeZone, toLocalISOString, calculateTrendLine } from '../utils';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, AreaChart, Area, Line, Cell } from 'recharts';
import { useGoalsContext } from '../contexts/FinancialDataContext';
import { motion } from 'motion/react';
import { MobileAccountHeader } from './MobileAccountHeader';

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
  showBalanceAdjustments?: boolean;
  onAdjustBalance?: () => void;
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
                <h4 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight tabular-nums">{value}</h4>
                {subValue && <p className="text-[11px] font-bold text-light-text-secondary/50 dark:text-dark-text-secondary/70 mt-1 tracking-tight">{subValue}</p>}
            </div>
        </div>
    );
};

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
  showBalanceAdjustments = true,
  onAdjustBalance,
}) => {
  const { financialGoals } = useGoalsContext();
  const timeZone = getPreferredTimeZone();

  // --- 1. Interest & APY Calculations ---
  const apy = account.apy || 0;
  const projectedAnnualInterest = (account.balance * apy) / 100;
  const projectedMonthlyInterest = projectedAnnualInterest / 12;

  // Set the reference date to today if there is recent transaction activity,
  // or fall back to the latest transaction date in the past (e.g. 2024 for demo data).
  const referenceDate = useMemo(() => {
    if (transactions.length === 0) return new Date();
    const latestTxDate = new Date(Math.max(...transactions.map(t => t.parsedDate.getTime())));
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return latestTxDate > thirtyDaysAgo ? today : latestTxDate;
  }, [transactions]);

  const interestHistory = useMemo(() => {
    const data = [];
    const filteredTxs = transactions.filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment);
    const sortedTxs = [...filteredTxs].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

    for (let i = 11; i >= 0; i--) {
        const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        
        const interestTxs = transactions
            .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
            .filter(({ tx, parsedDate }) => {
                 const cat = allCategories.find(c => c.id === tx.category);
                 const categoryName = cat ? cat.name : tx.category;
                 const matchesCategory = categoryName && categoryName.toLowerCase().includes('interest');
                 const matchesDescription = tx.description && tx.description.toLowerCase().includes('interest');
                 return parsedDate >= startOfMonth && 
                        parsedDate <= endOfMonth && 
                        tx.type === 'income' &&
                        (matchesCategory || matchesDescription);
            });
        
        const actualInterest = interestTxs.reduce((sum, { convertedAmount }) => sum + convertedAmount, 0);

        // Estimate balance at the end of this month
        let estBalance = account.balance;
        sortedTxs.forEach(({ tx, parsedDate }) => {
            if (parsedDate > endOfMonth) {
                estBalance -= tx.amount;
            }
        });
        if (estBalance < 0) estBalance = 0;

        const projectedInterest = (estBalance * apy) / 100 / 12;

        data.push({ 
            name: monthKey, 
            actual: actualInterest,
            projected: projectedInterest,
            value: actualInterest > 0 ? actualInterest : projectedInterest,
            isProjected: actualInterest === 0
        });
    }
    return data;
  }, [transactions, account.balance, account.apy, referenceDate, allCategories, showBalanceAdjustments]);

  const totalInterestYTD = useMemo(() => {
      const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
      return transactions
        .filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment)
        .filter(({ tx, parsedDate }) => {
             const cat = allCategories.find(c => c.id === tx.category);
             const categoryName = cat ? cat.name : tx.category;
             const matchesCategory = categoryName && categoryName.toLowerCase().includes('interest');
             const matchesDescription = tx.description && tx.description.toLowerCase().includes('interest');
             return parsedDate >= startOfYear && 
                 parsedDate <= referenceDate &&
                 tx.type === 'income' && 
                 (matchesCategory || matchesDescription);
        })
        .reduce((sum, { convertedAmount }) => sum + convertedAmount, 0);
  }, [transactions, referenceDate, allCategories, showBalanceAdjustments]);

  // --- 2. Balance History ---
  const balanceHistory = useMemo(() => {
    const data = [];
    let currentBalance = account.balance;
    const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const filteredTxs = transactions.filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment);
    const sortedTxs = [...filteredTxs].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    const dailyChanges: Record<string, number> = {};
    
    sortedTxs.forEach(({ tx, parsedDate }) => {
         if (parsedDate > referenceDate) return; 
         const dateStr = toLocalISOString(parsedDate);
         dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + tx.amount;
    });

    let iterDate = new Date(endDate);
    for (let i = 0; i <= 90; i++) {
        const dateStr = toLocalISOString(iterDate);
        data.push({ date: dateStr, value: currentBalance });
        const change = dailyChanges[dateStr] || 0;
        currentBalance -= change;
        iterDate.setDate(iterDate.getDate() - 1);
    }
    const reversedData = data.reverse();
    const trendVals = calculateTrendLine(reversedData, 'value');
    return reversedData.map((item, idx) => ({
      ...item,
      trend: trendVals[idx]
    }));
  }, [account.balance, transactions, referenceDate, showBalanceAdjustments]);

  // --- 3. Linked Goals ---
  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in-up pb-10">
      {/* Mobile Header */}
      <MobileAccountHeader
        account={account}
        onBack={onBack}
        formattedBalance={formatCurrency(account.balance, account.currency)}
        badgeText="Savings Account"
        subText={account.financialInstitution || 'Vault'}
        primaryAction={{ label: 'Log Tx', icon: 'add', onClick: onAddTransaction }}
        secondaryAction={onAdjustBalance ? { label: 'Adjust', icon: 'tune', onClick: onAdjustBalance } : undefined}
        syncAction={isLinkedToEnableBanking && onSyncLinkedAccount ? { label: 'Sync', icon: 'sync', onClick: onSyncLinkedAccount } : undefined}
      />

      {/* Dynamic Desktop Header */}
      <header className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
          <div className="flex items-center gap-6">
              <button 
                  onClick={onBack}
                  className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all shadow-sm group active:scale-95"
              >
                  <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
              </button>
              <div>
                  <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">Savings Account</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80">{account.financialInstitution || 'Vault'}</span>
                  </div>
                  <h1 className="text-4xl font-bold text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
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
              <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-6 h-12 shadow-lg shadow-primary-500/20`}>
                  <span className="material-symbols-outlined text-lg mr-2">add</span>
                  Transaction
              </button>
          </div>
      </header>

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Immersive Balance Card */}
           <div className="lg:col-span-5 xl:col-span-4">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-full min-h-[440px] rounded-[3rem] bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group"
               >
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)]"></div>
                   <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
                                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-12">
                             <span className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold tracking-wider border border-white/10">
                                 Active Savings • {account.currency}
                             </span>
                             {apy > 0 && (
                                <div className="text-right">
                                    <p className="text-[10px] font-bold tracking-wider text-emerald-100/80 mb-1">Yield</p>
                                    <p className="text-3xl font-bold tabular-nums">{apy}% <span className="text-xs opacity-60">APY</span></p>
                                </div>
                             )}
                        </div>
                        
                        <p className="text-[10px] font-bold text-emerald-100/90 mb-2">Current Total Balance</p>
                        <h2 className="text-5xl font-bold tracking-tight tabular-nums drop-shadow-sm mb-12">
                            {formatCurrency(account.balance, account.currency)}
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between text-[10px] font-bold tracking-wider text-emerald-100/70">
                                <span>Quarterly Velocity</span>
                                <span className="text-white">Active</span>
                            </div>
                            <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: '100%' }}
                                    className="h-full bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                 />
                            </div>
                        </div>
                   </div>

                   <div className="relative z-10 pt-10 border-t border-white/5 grid grid-cols-2 gap-8">
                       <div>
                           <p className="text-[10px] tracking-wider text-emerald-100/70 font-bold mb-1">Est. Annual Return</p>
                           <p className="font-black text-xl text-white tabular-nums drop-shadow-sm">{apy > 0 ? formatCurrency(projectedAnnualInterest, account.currency) : '—'}</p>
                       </div>
                       <div>
                           <p className="text-[10px] tracking-wider text-emerald-100/70 font-bold mb-1">YTD Interest</p>
                           <p className="font-black text-xl text-emerald-300 tabular-nums">{formatCurrency(totalInterestYTD, account.currency)}</p>
                       </div>
                   </div>
               </motion.div>
           </div>

           {/* Metrics & Analytics */}
           <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricTile 
                        label="Est. Monthly" 
                        value={apy > 0 ? formatCurrency(projectedMonthlyInterest, account.currency) : '—'} 
                        icon="trending_up" 
                        colorClass="emerald"
                        subValue="Projected yields"
                    />
                    <MetricTile 
                        label="Growth Index" 
                        value={`${((balanceHistory[balanceHistory.length - 1].value / (balanceHistory[0].value || 1) - 1) * 100).toFixed(1)}%`} 
                        icon="insights" 
                        colorClass="blue"
                        subValue="90-day balance change"
                    />
                    <MetricTile 
                        label="Liquidity" 
                        value={formatCurrency(account.balance, account.currency)} 
                        icon="waves" 
                        colorClass="indigo"
                        subValue="Total accessible cash"
                    />
                </div>

                {/* Balance Trajectory Chart */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-8 flex-grow flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <span className="material-symbols-outlined text-8xl">account_balance</span>
                    </div>
                    <div className="flex justify-between items-center mb-10 relative z-10">
                        <div>
                             <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Financial trajectory</h3>
                             <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">90-day balance progression</p>
                        </div>
                        <div className="text-right">
                             <p className="text-xs font-bold text-emerald-500 tracking-wider">Active Reserve</p>
                        </div>
                    </div>
                    
                    <div className="flex-grow w-full h-full min-h-[220px] relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={balanceHistory}>
                                <defs>
                                    <linearGradient id="savValGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.06} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} 
                                    tickFormatter={(val) => parseLocalDate(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.3, fontSize: 10, fontWeight: 900 }} tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} />
                                 <Tooltip 
                                     contentStyle={{ 
                                         backgroundColor: 'var(--light-card)', 
                                         backdropFilter: 'blur(15px) saturate(180%) brightness(105%)', 
                                         WebkitBackdropFilter: 'blur(15px) saturate(180%) brightness(105%)',
                                         border: 'none', 
                                         borderRadius: '24px', 
                                         boxShadow: 'inset 2px 2px 1px rgba(255, 255, 255, 0.05), inset -2px -2px 2px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.1)' 
                                     }}
                                     itemStyle={{ fontSize: '12px', fontWeight: '900', color: '#10B981' }}
                                     labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8',  marginBottom: '4px', letterSpacing: '0.1em' }}
                                     formatter={(val: number) => [`${formatCurrency(val, account.currency)}`, 'Balance']}
                                 />
                                <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={4} fill="url(#savValGradient)" name="Balance" />
                                <Line type="monotone" dataKey="trend" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} name="Trend Line" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
           </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
           {/* Detailed Activity & Yield Sidebar */}
           <div className="xl:col-span-8 space-y-8">
                {/* Interest History Analysis */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-10 group">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Yield Analysis</h3>
                            <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Monthly interest payout history</p>
                        </div>
                    </div>
                    
                    <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={interestHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                                         boxShadow: 'inset 2px 2px 1px rgba(255, 255, 255, 0.05), inset -2px -2px 2px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.1)' 
                                     }}
                                     itemStyle={{ fontSize: '12px', fontWeight: '900' }}
                                     labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8',  marginBottom: '4px', letterSpacing: '0.1em' }}
                                     formatter={(val: number, name: any, props: any) => {
                                         const isProj = props.payload?.isProjected;
                                         return [
                                             `${formatCurrency(val, account.currency)}`, 
                                             isProj ? 'Projected Yield' : 'Actual Interest'
                                         ];
                                     }}
                                 />
                                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={24}>
                                    {interestHistory.map((entry: any, index: number) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.isProjected ? "#3B82F6" : "#10B981"} 
                                            fillOpacity={entry.isProjected ? 0.3 : (index === interestHistory.length - 1 ? 1 : 0.4)}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden flex flex-col group h-[600px]">
                    <div className="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-gray-50/30 dark:bg-white/[0.01]">
                        <div>
                            <h3 className="text-xl font-bold tracking-tight text-light-text dark:text-dark-text italic">Active Ledger</h3>
                            <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Recent savings activity</p>
                        </div>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <TransactionList
                            transactions={displayTransactionsList}
                            allCategories={allCategories}
                            onTransactionClick={onTransactionClick}
                            density="high"
                            maxItems={15}
                        />
                    </div>
                </div>
           </div>

           {/* Goals & Details Sidebar */}
           <div className="xl:col-span-4 flex flex-col gap-8">
                {/* Infrastructure Configuration */}
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2.5rem] p-10 group overflow-hidden">
                    <h3 className="text-[11px] font-bold tracking-tight text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-8">Infrastructure Configuration</h3>
                    <div className="space-y-6">
                        {[
                            { label: 'Clearing Institution', value: account.financialInstitution },
                            { label: 'Asset Architecture', value: account.type },
                            { label: 'Settlement Engine', value: account.currency },
                            { label: 'Origin Epoch', value: account.openingDate ? parseLocalDate(account.openingDate).toLocaleDateString() : '—' },
                            { label: 'Logical Reference', value: account.accountNumber, isMono: true },
                            { label: 'Routing Directive', value: account.routingNumber, isMono: true }
                        ].filter(i => i.value).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                                <p className="text-[9px] font-black tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/50 ">{item.label}</p>
                                <p className={`text-xs font-black text-light-text dark:text-dark-text tracking-tight ${item.isMono ? 'font-mono opacity-60' : ''}`}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Linked Financial Goals */}
                {linkedGoals.length > 0 && (
                    <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-10 h-full flex flex-col group">
                        <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight mb-8 flex items-center gap-3">
                            Linked Goals
                            <span className="material-symbols-outlined text-amber-500">ads_click</span>
                        </h3>
                        <div className="space-y-8">
                            {linkedGoals.map(goal => {
                                const progress = Math.min(100, Math.max(0, (goal.currentAmount / goal.amount) * 100));
                                return (
                                    <div key={goal.id} className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-sm font-black text-light-text dark:text-dark-text tracking-tight">{goal.name}</p>
                                                <p className="text-[10px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/70 tracking-wider leading-none mt-1">{progress.toFixed(0)}% Achieved</p>
                                            </div>
                                            <span className="text-xs font-black text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(goal.amount, goal.currency)}</span>
                                        </div>
                                        <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-3 overflow-hidden shadow-inner">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
           </div>
      </div>
    </div>
  );
};

export default SavingsAccountView;
