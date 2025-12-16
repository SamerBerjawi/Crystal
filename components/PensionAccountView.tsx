

import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseDateAsUTC, convertToEur, getPreferredTimeZone } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, ComposedChart, Line } from 'recharts';

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

    transactions.forEach(({ tx, parsedDate, convertedAmount }) => {
        if (tx.type === 'income') {
            // Exclude explicit "Interest" or "Dividend" transactions from contributions if categorized as such
            // This assumes contributions are transfers or deposits
            // Also exclude Market Adjustments
            if (!tx.isMarketAdjustment && !tx.category.toLowerCase().includes('interest') && !tx.category.toLowerCase().includes('dividend')) {
                 contributions += convertedAmount;
                 if (parsedDate >= oneYearAgo) {
                     contributionsLast12Months += convertedAmount;
                 }
            }
        } else if (tx.type === 'expense') {
            // Withdrawals reduce net contributions
            // Market Adjustments (losses) are not withdrawals
            if (!tx.isMarketAdjustment) {
                contributions -= Math.abs(convertedAmount);
            }
        }
    });

    const currentBalanceEur = convertToEur(account.balance, account.currency);
    const growth = currentBalanceEur - contributions;
    
    // Simple CAGR estimate based on total growth vs contributions (very rough approximation)
    // Real CAGR requires time-weighted returns, but this suffices for a snapshot
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
    const history = [];
    const today = new Date();
    // 5 Years history max
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - 5);

    const sortedTxs = [...transactions].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
    
    // Build History
    let runningBalance = 0;
    let runningContributions = 0;
    
    // Find starting balance before the 5 year window if any
    // For simplicity in this view, we'll build forward from the first available transaction
    // or calculate backwards from current. Let's calculate backwards from current for accuracy.
    
    const monthlyDataMap = new Map<string, { balance: number, contributions: number }>();
    
    // Reverse calculation
    let currentBal = convertToEur(account.balance, account.currency);
    let currentContrib = totalContributions;
    
    // Backfill history
    for (let i = 0; i < 60; i++) { // Last 60 months
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7); // YYYY-MM
        
        monthlyDataMap.set(key, { balance: currentBal, contributions: currentContrib });
        
        // Reverse transactions in this month
        const startOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
        
        const txsInMonth = transactions.filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth);
        
        txsInMonth.forEach(({ tx, convertedAmount }) => {
            currentBal -= convertedAmount; // Reverse flow
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

    // Build Projection
    const projectionData = [];
    let projBalance = convertToEur(account.balance, account.currency);
    let projContrib = totalContributions;
    const monthlyRate = (account.apy || 5) / 100 / 12; // Default to 5% if no APY set
    
    // Project until retirement
    const monthsToRetire = yearsToRetirement * 12;
    // Limit points to keep chart readable (e.g., 1 point per year if long duration)
    const step = Math.max(1, Math.floor(monthsToRetire / 24)); // Approx 24 points max

    let d = new Date(today);
    
    for (let i = 1; i <= monthsToRetire; i++) {
        // Add monthly contribution
        projBalance += monthlyContributionAvg;
        projContrib += monthlyContributionAvg;
        // Compound interest
        projBalance = projBalance * (1 + monthlyRate);
        
        d.setMonth(d.getMonth() + 1);
        
        if (i % step === 0 || i === monthsToRetire) {
             projectionData.push({
                 date: d.toISOString().slice(0, 7),
                 balance: projBalance,
                 contributions: projContrib,
                 type: 'Projection'
             });
        }
    }
    
    return [...historicalData, ...projectionData];
  }, [transactions, account.balance, account.currency, account.apy, totalContributions, monthlyContributionAvg, yearsToRetirement]);

  const projectedValueAtRetirement = chartData.length > 0 ? chartData[chartData.length - 1].balance : 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <span className="material-symbols-outlined text-4xl">{account.icon || 'elderly'}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-light-text dark:text-dark-text tracking-tight">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                <span>Pension Fund</span>
                <span>•</span>
                <span>Target: {retirementYear}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0 ml-auto md:ml-0">
             {isLinkedToEnableBanking && onSyncLinkedAccount && (
                 <button onClick={onSyncLinkedAccount} className={`${BTN_SECONDARY_STYLE}`}>Sync</button>
             )}
             {onAdjustBalance && (
                 <button onClick={onAdjustBalance} className={`${BTN_SECONDARY_STYLE}`}>
                     <span className="material-symbols-outlined text-lg mr-2">tune</span>
                     Adjust
                 </button>
             )}
            <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE}`}>
                <span className="material-symbols-outlined text-lg mr-2">add</span>
                Add Contribution
            </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Pot Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-800 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[260px]">
               <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                   <span className="material-symbols-outlined text-9xl">savings</span>
               </div>
               
               <div className="relative z-10 flex justify-between items-start">
                    <div>
                         <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs mb-2">Current Pot Value</p>
                         <h2 className="text-5xl font-extrabold tracking-tight drop-shadow-sm">{formatCurrency(account.balance, account.currency)}</h2>
                    </div>
                    <div className="text-right">
                         <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs mb-1">Projected at {retirementYear}</p>
                         <p className="text-2xl font-bold opacity-90">{formatCurrency(projectedValueAtRetirement, account.currency)}</p>
                         <p className="text-xs text-indigo-200 mt-1">Assuming {account.apy || 5}% growth</p>
                    </div>
               </div>

               <div className="relative z-10 mt-8">
                    <div className="w-full bg-black/20 rounded-full h-3 overflow-hidden mb-2">
                        {/* Progress bar towards a hypothetical goal, or generic progress based on age */}
                        <div className="h-full bg-gradient-to-r from-white to-indigo-200" style={{ width: `${Math.min(100, Math.max(5, (1 - (yearsToRetirement / 40)) * 100))}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-indigo-100">
                        <span>{yearsToRetirement} years to retirement</span>
                        <span>Keep going!</span>
                    </div>
               </div>
          </div>

          {/* Key Metrics */}
          <div className="flex flex-col gap-4">
              <Card className="flex-1 flex flex-col justify-center border-l-4 border-l-emerald-500">
                  <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Total Growth</p>
                      <span className="material-symbols-outlined text-emerald-500">trending_up</span>
                  </div>
                  <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalGrowth, account.currency)}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Interest & Gains</p>
              </Card>
              <Card className="flex-1 flex flex-col justify-center border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Avg. Contribution</p>
                      <span className="material-symbols-outlined text-blue-500">payments</span>
                  </div>
                  <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(monthlyContributionAvg, account.currency)}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Per month (Last 12m)</p>
              </Card>
          </div>
      </div>

      {/* Projection Chart */}
      <Card className="h-[400px] flex flex-col">
           <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Growth Projection</h3>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Historical performance & future estimation</p>
                </div>
           </div>
           <div className="flex-grow w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorBalancePension" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} 
                            minTickGap={50}
                            tickFormatter={(val) => val.split('-')[0]}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} 
                            tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} 
                            width={40}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
                            formatter={(val: number, name: string) => [formatCurrency(val, account.currency), name]}
                            labelFormatter={(label) => label}
                        />
                        <Legend />
                        <Area 
                            type="monotone" 
                            dataKey="balance" 
                            name="Total Value" 
                            stroke="#6366F1" 
                            fill="url(#colorBalancePension)" 
                            strokeWidth={3} 
                        />
                        <Line 
                            type="monotone" 
                            dataKey="contributions" 
                            name="Net Contributions" 
                            stroke="#10B981" 
                            strokeWidth={2} 
                            dot={false}
                            strokeDasharray="5 5"
                        />
                        <ReferenceLine x={new Date().toISOString().slice(0,7)} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: "Today", position: "insideTopRight", fill: "#F59E0B", fontSize: 12 }} />
                    </ComposedChart>
                </ResponsiveContainer>
           </div>
      </Card>

      {/* Transaction History */}
      <Card className="flex flex-col">
            <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4">Contribution History</h3>
            <div className="flex-grow">
                <TransactionList 
                    transactions={displayTransactionsList.slice(0, 10)} 
                    allCategories={allCategories} 
                    onTransactionClick={onTransactionClick} 
                />
            </div>
      </Card>
    </div>
  );
};

export default PensionAccountView;
