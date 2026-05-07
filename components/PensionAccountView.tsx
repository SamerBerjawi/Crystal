import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseLocalDate, convertToEur, getPreferredTimeZone, toLocalISOYearMonth } from '../utils';
import Card from './Card';
import PageHeader from './PageHeader';
import BankCard from './BankCard';
import TransactionList from './TransactionList';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, ComposedChart, Line } from 'recharts';
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
}

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
}) => {
  const timeZone = getPreferredTimeZone();
  const currentYear = new Date().getFullYear();
  const retirementYear = account.expectedRetirementYear || (currentYear + 20);
  const yearsToRetirement = Math.max(0, retirementYear - currentYear);

  // --- 1. Growth & Contributions Analysis ---
  const { totalContributions, totalGrowth, annualizedReturn, monthlyContributionAvg } = useMemo(() => {
    let contributions = 0;
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    
    let contributionsLast12Months = 0;

    transactions.forEach(({ tx, convertedAmount, parsedDate }) => {
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
  }, [transactions, account]);

  // --- 2. Projection Chart Data ---
  const chartData = useMemo(() => {
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
        const txsInMonth = transactions.filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth);
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
  }, [transactions, account.balance, account.currency, account.apy, account.openingDate, totalContributions, monthlyContributionAvg, yearsToRetirement]);

  const projectedValueAtRetirement = chartData.length > 0 ? chartData[chartData.length - 1].balance : 0;

  return (
    <div className="space-y-10 animate-fade-in-up pb-12">
      <PageHeader 
        markerIcon="auto_graph"
        markerLabel="Retirement Planning & Growth • Pension Fund"
        title={account.name}
        subtitle="Strategic wealth accumulation tracking with historical growth analysis and future maturity forecasting."
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
                    <span className="hidden sm:inline">Adjust Strategy</span>
                </button>
             )}
            <button onClick={onAddTransaction} className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-all">
                <span className="material-symbols-outlined text-sm font-black">add</span>
                <span className="hidden sm:inline">Contribution</span>
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
                type="Pension"
                color="violet"
            />

            <Card className="p-8 !rounded-[2.5rem] bg-violet-600 text-white shadow-2xl shadow-violet-600/20 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                     <span className="material-symbols-outlined text-9xl">savings</span>
                 </div>
                 <div className="relative z-10">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-6 leading-none">Wealth Accumulation</p>
                     <div className="flex items-end justify-between mb-8">
                        <div className="space-y-1">
                            <h3 className="text-5xl font-black tracking-tightest leading-none privacy-blur">
                                {formatCurrency(account.balance, account.currency)}
                            </h3>
                            <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Current Pot</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-2xl font-black tracking-tightest privacy-blur">{formatCurrency(projectedValueAtRetirement, account.currency)}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Target {retirementYear}</span>
                        </div>
                     </div>
                     <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden flex shadow-inner">
                        <div 
                            className="h-full bg-white rounded-full transition-all duration-1000" 
                            style={{ width: `${Math.min(100, Math.max(5, (1 - (yearsToRetirement / 40)) * 100))}%` }} 
                        />
                     </div>
                     <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mt-4 text-center">
                        {yearsToRetirement} Years Until Maturity
                     </p>
                 </div>
            </Card>

            <div className="grid grid-cols-1 gap-4">
                <Card className="p-8 !rounded-[2.5rem] border-violet-500/10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary opacity-40 mb-1">Total Growth</p>
                            <p className="text-3xl font-black text-emerald-500 tracking-tightest privacy-blur">{formatCurrency(totalGrowth, account.currency)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">trending_up</span>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest leading-relaxed">
                        Compounded lifetime returns and market appreciation
                    </p>
                </Card>

                <Card className="p-8 !rounded-[2.5rem] border-violet-500/10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary opacity-40 mb-1">Monthly Flow</p>
                            <p className="text-3xl font-black text-blue-500 tracking-tightest privacy-blur">{formatCurrency(monthlyContributionAvg, account.currency)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">payments</span>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest leading-relaxed">
                        Average net contributions based on the last 12 months
                    </p>
                </Card>
            </div>
        </div>

        {/* Right Column: Projection & History */}
        <div className="lg:col-span-8 space-y-8">
            <Card className="p-8 !rounded-[2.5rem] border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-dark-card flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-violet-500">timeline</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Fortune Projection</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary opacity-40 uppercase tracking-widest leading-none">History vs Mathematical Forecasting</p>
                        </div>
                    </div>
                </div>

                <div className="flex-grow w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPensionValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.4 }} 
                                minTickGap={50}
                                tickFormatter={(val) => val.split('-')[0]}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.4 }} 
                                tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} 
                                width={40}
                            />
                            <Tooltip 
                                cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.2 }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white dark:bg-dark-card p-4 rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 min-w-[180px]">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40">{label}</p>
                                                <div className="space-y-3">
                                                    {payload.map((entry, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-6">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{entry.name}</span>
                                                            </div>
                                                            <span className="text-xs font-black text-light-text dark:text-dark-text">
                                                                {formatCurrency(entry.value as number, account.currency)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend 
                                verticalAlign="top" 
                                align="right" 
                                iconType="circle"
                                wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="balance" 
                                name="Projected Value" 
                                stroke="#7c3aed" 
                                fill="url(#colorPensionValue)" 
                                strokeWidth={4} 
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="contributions" 
                                name="Contributions" 
                                stroke="#10B981" 
                                strokeWidth={2} 
                                dot={false}
                                strokeDasharray="6 6"
                            />
                            <ReferenceLine x={toLocalISOYearMonth(new Date())} stroke="#F59E0B" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "TODAY", position: "top", fill: "#F59E0B", fontSize: 10, fontWeight: 900, letterSpacing: '0.1em' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
                <div className="flex items-center justify-between p-8 border-b border-black/5 dark:border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-light-text-secondary">history</span>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text">Contribution Ledger</h3>
                    </div>
                </div>
                <div className="flex-grow overflow-hidden">
                    <TransactionList
                        transactions={displayTransactionsList}
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

export default PensionAccountView;