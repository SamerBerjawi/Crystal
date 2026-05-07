import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseLocalDate, convertToEur, toLocalISOString, formatDateKey } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { useGoalsContext } from '../contexts/FinancialDataContext';
import BankCard from './BankCard';
import PageHeader from './PageHeader';

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
}

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
}) => {
  const { financialGoals } = useGoalsContext();

  const apy = account.apy || 0;
  const projectedAnnualInterest = (account.balance * apy) / 100;
  const projectedMonthlyInterest = projectedAnnualInterest / 12;

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    const interestYTD = transactions
      .filter(({ tx, parsedDate }) => 
          parsedDate >= startOfYear && 
          tx.type === 'income' && 
          (tx.category.toLowerCase().includes('interest') || tx.description.toLowerCase().includes('interest'))
      )
      .reduce((sum, { convertedAmount }) => sum + convertedAmount, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const netChange30d = transactions
        .filter(({ parsedDate }) => parsedDate >= thirtyDaysAgo)
        .reduce((sum, { tx }) => sum + tx.amount, 0);

    return { interestYTD, netChange30d };
  }, [transactions]);

  const interestHistory = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const interestTxs = transactions.filter(({ tx, parsedDate }) => {
             return parsedDate >= startOfMonth && parsedDate <= endOfMonth && tx.type === 'income' &&
                    (tx.category.toLowerCase().includes('interest') || tx.description.toLowerCase().includes('interest'));
        });
        const totalInterest = interestTxs.reduce((sum, { convertedAmount }) => sum + convertedAmount, 0);
        data.push({ name: monthKey, interest: totalInterest });
    }
    return data;
  }, [transactions]);

  const balanceHistory = useMemo(() => {
    const data = [];
    let currentBalance = account.balance;
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const sortedTxs = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    const dailyChanges: Record<string, number> = {};
    
    sortedTxs.forEach(({ tx, parsedDate }) => {
         if (parsedDate > today) return;
         const dateStr = toLocalISOString(parsedDate);
         dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + tx.amount;
    });

    let iterDate = new Date(endDate);
    for (let i = 0; i <= 30; i++) {
        const dateStr = toLocalISOString(iterDate);
        data.push({ date: dateStr, value: currentBalance });
        currentBalance -= (dailyChanges[dateStr] || 0);
        iterDate.setDate(iterDate.getDate() - 1);
    }
    return data.reverse();
  }, [account.balance, transactions]);

  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      <PageHeader 
        markerIcon="savings"
        markerLabel={`${account.financialInstitution || 'Savings Reserve'} • ${account.currency}`}
        title={account.name}
        subtitle="Growth oriented capital reserve with yield tracking and goal alignment."
        className="mb-8"
        actions={
          <div className="flex items-center gap-3 w-full lg:w-auto">
             <div className="flex items-center gap-2">
                <button 
                    onClick={onBack} 
                    className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
                    title="Back to All Accounts"
                >
                    <span className="material-symbols-outlined text-xl">arrow_back</span>
                </button>
                {isLinkedToEnableBanking && (
                    <button onClick={onSyncLinkedAccount} className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 transition-colors">
                        <span className="material-symbols-outlined text-xl">sync</span>
                    </button>
                )}
                <button onClick={onAddTransaction} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all">
                    <span className="material-symbols-outlined text-lg">add</span>
                    <span className="hidden sm:inline">Transaction</span>
                </button>
             </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BankCard 
                    name={account.name}
                    balance={account.balance}
                    currency={account.currency}
                    last4={account.last4}
                    institution={account.financialInstitution}
                    type="Savings"
                    color="emerald"
                />

                <div className="grid grid-cols-2 gap-4">
                     <div className="p-5 rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                         <div>
                            <span className="material-symbols-outlined text-emerald-500 mb-3 bg-emerald-500/10 p-2 rounded-xl">percent</span>
                            <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">Current APY</p>
                            <h4 className="text-2xl font-black text-emerald-500 tracking-tighter leading-none">{apy}%</h4>
                         </div>
                         <p className="text-[9px] font-bold text-emerald-500 mt-2 flex items-center gap-1">
                             Yielding Returns
                         </p>
                     </div>
                     <div className="p-5 rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                         <div>
                            <span className="material-symbols-outlined text-amber-500 mb-3 bg-amber-500/10 p-2 rounded-xl">auto_graph</span>
                            <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">YTD Interest</p>
                            <h4 className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter leading-none">
                                {formatCurrency(metrics.interestYTD, account.currency, { compact: true })}
                            </h4>
                         </div>
                         <p className="text-[9px] font-bold text-amber-500 mt-2 flex items-center gap-1">Accumulated Profit</p>
                     </div>
                     <div className="col-span-2 p-5 rounded-[2rem] bg-indigo-500 text-white flex items-center justify-between shadow-lg shadow-indigo-500/20">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">rocket_launch</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-0.5">Est. Annual Profit</p>
                                <p className="text-xl font-black tracking-tighter leading-none">
                                    {formatCurrency(projectedAnnualInterest, account.currency)}
                                </p>
                            </div>
                         </div>
                         <span className="material-symbols-outlined text-white/30">chevron_right</span>
                     </div>
                </div>
            </div>

            <Card className="!p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black text-light-text dark:text-dark-text tracking-tight">Growth Velocity</h3>
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Balance Progression (30D)</p>
                    </div>
                </div>
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceHistory}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                            <XAxis dataKey="date" hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(val: number) => [formatCurrency(val, account.currency), 'Balance']}
                                labelFormatter={(val) => formatDateKey(new Date(val))}
                            />
                            <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card className="!p-6 overflow-hidden">
                <h3 className="text-lg font-black text-light-text dark:text-dark-text tracking-tight mb-6">Interest Radar</h3>
                <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={interestHistory}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 10, fontStyle: 'bold' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="interest" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>

        <div className="xl:col-span-4 space-y-6">
             {linkedGoals.length > 0 && (
                 <Card className="!p-6 bg-amber-500/[0.03] border-amber-500/10">
                     <div className="flex items-center gap-2 mb-6">
                         <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                             <span className="material-symbols-outlined text-lg">flag</span>
                         </div>
                         <h3 className="text-md font-black text-light-text dark:text-dark-text tracking-tight uppercase">Active Targets</h3>
                     </div>
                     <div className="space-y-5">
                         {linkedGoals.map(goal => {
                             const progress = (goal.currentAmount / goal.amount) * 100;
                             return (
                                 <div key={goal.id}>
                                     <div className="flex justify-between items-end mb-2">
                                         <div>
                                            <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest leading-none mb-1">Mission</p>
                                            <p className="text-sm font-black text-light-text dark:text-dark-text uppercase tracking-tight">{goal.name}</p>
                                         </div>
                                         <p className="text-xs font-black text-amber-600 dark:text-amber-400">{progress.toFixed(0)}%</p>
                                     </div>
                                     <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                         <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }}></div>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 </Card>
             )}

             <Card className="!p-0 overflow-hidden flex flex-col">
                 <div className="p-6 border-b border-black/5 dark:border-white/5">
                    <h3 className="text-md font-black text-light-text dark:text-dark-text tracking-tight uppercase">Ledger</h3>
                 </div>
                 <div className="max-h-[400px] overflow-y-auto">
                    <TransactionList 
                        transactions={displayTransactionsList.slice(0, 20)} 
                        allCategories={allCategories}
                        onTransactionClick={onTransactionClick}
                    />
                 </div>
             </Card>

             <Card className="!p-6 bg-black/5 dark:bg-white/[0.02]">
                 <p className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-4">Verification</p>
                 <div className="space-y-4">
                     <div>
                         <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60 mb-1">IBAN / Account</p>
                         <p className="font-mono text-xs font-bold text-light-text dark:text-dark-text break-all">{account.accountNumber || '—'}</p>
                     </div>
                     <div>
                         <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60 mb-1">BIC / Routing</p>
                         <p className="font-mono text-xs font-bold text-light-text dark:text-dark-text">{account.routingNumber || '—'}</p>
                     </div>
                 </div>
             </Card>
        </div>
      </div>
    </div>
  );
};

export default SavingsAccountView;