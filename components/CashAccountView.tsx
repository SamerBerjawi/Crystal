import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseLocalDate, convertToEur, getPreferredTimeZone, toLocalISOString } from '../utils';
import Card from './Card';
import PageHeader from './PageHeader';
import BankCard from './BankCard';
import TransactionList from './TransactionList';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

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
}

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
}) => {
  const timeZone = getPreferredTimeZone();

  // --- Metrics ---
  const { totalInflow, totalOutflow, netChange, lastReplenishment } = useMemo(() => {
      const today = new Date();
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
        
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        
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
      if (account.balance <= 0) return "Depleted";
      const avgDailySpend = totalOutflow / 30; // Rough 30 day avg
      if (avgDailySpend <= 0) return "Reserve Stable";
      const daysLeft = account.balance / avgDailySpend;
      if (daysLeft < 3) return "Low Liquidity";
      if (daysLeft > 60) return "High Reserve";
      return `~${Math.floor(daysLeft)}d Buffer`;
  }, [account.balance, totalOutflow]);

  return (
    <div className="space-y-10 animate-fade-in-up pb-12">
      <PageHeader 
        markerIcon="payments"
        markerLabel="Physical Currency Pool • Liquid Asset"
        title={account.name}
        subtitle="Real-time physical liquidity tracking with high-fidelity velocity analysis."
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
            <button onClick={onAdjustBalance} className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 text-light-text dark:text-dark-text rounded-xl font-bold text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5">
                <span className="material-symbols-outlined text-sm font-black">fact_check</span>
                <span className="hidden sm:inline">Verify Count</span>
            </button>
            <button onClick={onAddTransaction} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all">
                <span className="material-symbols-outlined text-sm font-black">add</span>
                <span className="hidden sm:inline">Manual Entry</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: The Safe Card & Pulse */}
        <div className="lg:col-span-4 space-y-8">
            <BankCard 
                name={account.name}
                balance={account.balance}
                currency={account.currency}
                last4={account.last4}
                institution={account.financialInstitution}
                type="Cash"
                color="emerald"
            />

            <Card className="p-8 !rounded-[2.5rem] bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                     <span className="material-symbols-outlined text-9xl">mintmark</span>
                 </div>
                 <div className="relative z-10">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-6 leading-none">Liquidity Pulse</p>
                     <div className="flex items-end justify-between mb-8">
                        <div className="space-y-1">
                            <h3 className="text-5xl font-black tracking-tightest leading-none privacy-blur">
                                {formatCurrency(account.balance, account.currency)}
                            </h3>
                            <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Available Reserve</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-2xl font-black tracking-tightest">{burnRateMessage}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Horizon</span>
                        </div>
                     </div>
                     <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden flex shadow-inner">
                        <div className="h-full bg-white rounded-full animate-pulse-slow" style={{ width: '100%' }} />
                     </div>
                 </div>
            </Card>

            <Card className="p-8 !rounded-[2.5rem] border-emerald-500/10">
                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-light-text-secondary opacity-40 mb-6">Movement Analytics (30d)</h4>
                <div className="space-y-6">
                    <div className="flex justify-between items-center group/stat">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/5 group-hover/stat:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-lg">keyboard_double_arrow_down</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary opacity-60">Replenished</p>
                                <p className="text-xl font-black text-emerald-500 tracking-tightest privacy-blur">{formatCurrency(totalInflow, 'EUR')}</p>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-emerald-500/20 text-3xl">insights</span>
                    </div>

                    <div className="flex justify-between items-center group/stat">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/5 group-hover/stat:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-lg">payments</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary opacity-60">Disbursed</p>
                                <p className="text-xl font-black text-rose-500 tracking-tightest privacy-blur">{formatCurrency(totalOutflow, 'EUR')}</p>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-rose-500/20 text-3xl">local_atm</span>
                    </div>
                </div>
            </Card>
        </div>

        {/* Right Column: Flow Visualization & Records */}
        <div className="lg:col-span-8 space-y-8">
            <Card className="p-8 !rounded-[2.5rem] border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-dark-card flex flex-col">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-500">monitoring</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Cash Velocity</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary opacity-40 uppercase tracking-widest leading-none">Inflow vs Outflow Dynamics</p>
                        </div>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={flowData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={32}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.4 }} 
                            />
                            <YAxis 
                                hide={true}
                            />
                            <Tooltip 
                                cursor={{ fill: 'currentColor', opacity: 0.05, radius: 12 }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white dark:bg-dark-card p-4 rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 min-w-[160px]">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40">{label}</p>
                                                <div className="space-y-3">
                                                    {payload.map((entry, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
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
                            <ReferenceLine y={0} stroke="currentColor" opacity={0.1} />
                            <Bar dataKey="income" name="Replenish" stackId="a" fill="#10B981" radius={[0, 0, 8, 8]} />
                            <Bar dataKey="expense" name="Spend" stackId="a" fill="#F43F5E" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
                <div className="flex items-center justify-between p-8 border-b border-black/5 dark:border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-light-text-secondary">list_alt</span>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text">Transaction Ledger</h3>
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

export default CashAccountView;