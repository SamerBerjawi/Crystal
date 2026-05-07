import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, formatDateKey, toLocalISOString, parseLocalDate } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, AreaChart, Area } from 'recharts';
import BankCard from './BankCard';
import PageHeader from './PageHeader';
import { useAccountsContext } from '../contexts/DomainProviders';
import { useGoalsContext } from '../contexts/FinancialDataContext';
import { ACCOUNT_TYPE_STYLES } from '../constants';

interface CreditCardAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
  setViewingAccountId: (id: string | null) => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
}

const CreditCardAccountView: React.FC<CreditCardAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack,
  setViewingAccountId,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
}) => {
  const { accounts } = useAccountsContext();
  const { financialGoals } = useGoalsContext();

  // --- Metrics ---
  const metrics = useMemo(() => {
      let spent = 0;
      let payments = 0;
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      transactions.forEach(({ tx, parsedDate, convertedAmount }) => {
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
      const utilization = creditLimit > 0 ? (balanceOwed / creditLimit) * 100 : 0;
      const availableCredit = creditLimit - balanceOwed;

      return { totalSpent: spent, totalPayments: payments, utilization, availableCredit };
  }, [transactions, account.balance, account.creditLimit]);

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
            .reduce((sum, t) => {
                if (t.tx.type === 'expense') return sum + Math.abs(t.convertedAmount);
                if (t.tx.type === 'income') {
                    if (!(t.tx.transferId || t.tx.category.toLowerCase().includes('payment') || t.tx.category.toLowerCase().includes('transfer'))) {
                        return sum - t.convertedAmount;
                    }
                }
                return sum;
            }, 0);
        data.push({ name: monthKey, spending: total });
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

  const relevantGoals = useMemo(() => {
    return financialGoals.filter(goal => goal.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  const linkedAccounts = useMemo(() => {
    return accounts.filter(acc => acc.linkedAccountId === account.id || acc.settlementAccountId === account.id);
  }, [accounts, account.id]);

  const settlementAccount = useMemo(() => {
    if (!account.settlementAccountId) return null;
    return accounts.find(a => a.id === account.settlementAccountId);
  }, [account.settlementAccountId, accounts]);

  const showVirtualCard = !!(account.cardNetwork || account.last4 || account.expirationDate || account.cardholderName) || account.type === 'Credit Card';

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      <PageHeader 
        markerIcon="credit_card"
        markerLabel={`${account.financialInstitution || 'Credit Line'} • ${account.currency}`}
        title={account.name}
        subtitle="Credit utilization management and automated cycle tracking."
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
                <button onClick={onAddTransaction} className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-500/25 hover:bg-rose-600 transition-all">
                    <span className="material-symbols-outlined text-lg">add</span>
                    <span className="hidden sm:inline">Transaction</span>
                </button>
             </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN: VISUALS & METRICS */}
        <div className="xl:col-span-8 space-y-6">
            {/* HERO SECTION */}
            <div className={`grid grid-cols-1 ${showVirtualCard ? 'md:grid-cols-2' : ''} gap-6`}>
                {showVirtualCard && (
                    <BankCard 
                        name={account.name}
                        balance={account.balance}
                        currency={account.currency}
                        last4={account.last4}
                        institution={account.financialInstitution}
                        type="Credit"
                        color="rose"
                    />
                )}

                {/* METRICS PULSE */}
                <div className={`grid ${showVirtualCard ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4 w-full`}>
                     <div className="p-5 rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                         <div>
                            <span className="material-symbols-outlined text-rose-500 mb-3 bg-rose-500/10 p-2 rounded-xl">shopping_bag</span>
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">Spent (30d)</p>
                            <h4 className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter leading-none">{formatCurrency(metrics.totalSpent, account.currency, { compact: true })}</h4>
                         </div>
                         <p className="text-[9px] font-bold text-rose-500 mt-2 flex items-center gap-1">Liability</p>
                     </div>
                     <div className="p-5 rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                         <div>
                            <span className="material-symbols-outlined text-emerald-500 mb-3 bg-emerald-500/10 p-2 rounded-xl">payments</span>
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">Payments</p>
                            <h4 className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter leading-none">{formatCurrency(metrics.totalPayments, account.currency, { compact: true })}</h4>
                         </div>
                         <p className="text-[9px] font-bold text-emerald-500 mt-2 flex items-center gap-1">Reduction</p>
                     </div>
                     {account.creditLimit && (
                        <div className="col-span-2 p-6 rounded-[2rem] bg-black dark:bg-white/[0.05] text-white flex flex-col justify-center gap-3">
                            <div className="flex justify-between items-center text-white/50">
                                <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Credit Utilization</span>
                                <span className="text-xs font-black text-white">{metrics.utilization.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${metrics.utilization > 80 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-primary-400'}`} style={{ width: `${Math.min(100, metrics.utilization)}%` }}></div>
                            </div>
                            <div className="flex justify-between items-end mt-1">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Available</p>
                                <p className="text-lg font-black tracking-tighter leading-none">{formatCurrency(metrics.availableCredit, account.currency)}</p>
                            </div>
                        </div>
                     )}
                </div>
            </div>

            {/* BALANCE HISTORY CHART */}
            <Card className="!p-6 overflow-hidden">
                <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight mb-6">Spending Trend</h3>
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceHistory}>
                            <defs>
                                <linearGradient id="colorBalanceRose" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 10, fontWeight: 700 }}
                                tickFormatter={(val) => new Date(val).getDate().toString()}
                            />
                            <YAxis 
                                hide={false}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 10, fontWeight: 700 }}
                                tickFormatter={(val) => `${(val/1000).toFixed(0)}k`}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(255,255,255,0.9)', 
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.05)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                                formatter={(val: number) => [formatCurrency(val, account.currency), 'Balance']}
                                labelFormatter={(val) => formatDateKey(new Date(val))}
                            />
                            <Area type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorBalanceRose)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* LOWER STATS SECTION: GOALS & LINKED ACCOUNTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* FINANCIAL GOALS */}
                <Card className="!p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500">target</span>
                            Financial Goals
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {relevantGoals.length > 0 ? relevantGoals.map(goal => (
                            <div key={goal.id} className="p-3 rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-light-text dark:text-dark-text">{goal.name}</span>
                                    <span className="text-[10px] font-bold text-emerald-500">{((goal.currentAmount / goal.amount) * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((goal.currentAmount/goal.amount)*100, 100)}%` }}></div>
                                </div>
                            </div>
                        )) : (
                            <div className="py-8 flex flex-col items-center justify-center text-center opacity-30">
                                <span className="material-symbols-outlined text-4xl mb-2">flag</span>
                                <p className="text-[10px] font-bold uppercase tracking-widest">No goals linked</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* LINKED ACCOUNTS */}
                <Card className="!p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary-500">link</span>
                            Linked Products
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {settlementAccount && (
                            <div onClick={() => setViewingAccountId(settlementAccount.id)} className="p-3 rounded-2xl bg-primary-500/5 border border-primary-500/20 flex items-center justify-between cursor-pointer hover:bg-primary-500/10 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center border border-black/5 dark:border-white/10 shrink-0 text-primary-500">
                                        <span className="material-symbols-outlined text-lg">account_balance</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-light-text dark:text-dark-text leading-tight">{settlementAccount.name}</p>
                                        <p className="text-[9px] font-bold text-primary-500 uppercase">Settlement Account</p>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-primary-500/30 text-sm">chevron_right</span>
                            </div>
                        )}
                        {linkedAccounts.filter(a => a.id !== settlementAccount?.id).length > 0 ? linkedAccounts.filter(a => a.id !== settlementAccount?.id).map(acc => (
                            <div key={acc.id} onClick={() => setViewingAccountId(acc.id)} className="p-3 rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center justify-between cursor-pointer hover:bg-black/10 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center border border-black/5 dark:border-white/10 shrink-0 text-primary-500">
                                        <span className="material-symbols-outlined text-lg">{ACCOUNT_TYPE_STYLES[acc.type].icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-light-text dark:text-dark-text leading-tight">{acc.name}</p>
                                        <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">{acc.type}</p>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-light-text-secondary/30 text-sm">chevron_right</span>
                            </div>
                        )) : !settlementAccount && (
                            <div className="py-8 flex flex-col items-center justify-center text-center opacity-30">
                                <span className="material-symbols-outlined text-4xl mb-2">link_off</span>
                                <p className="text-[10px] font-bold uppercase tracking-widest">No linked products</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>

        {/* RIGHT COLUMN: RECENT & UPCOMING */}
        <div className="xl:col-span-4 space-y-6">
             {/* STATS OVERVIEW */}
             <Card className="!p-6 bg-rose-500/[0.02] border-rose-500/10 h-min">
                 <h3 className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.2em] mb-4">Cycle Metadata</h3>
                 <div className="space-y-4">
                     {account.openingDate && (
                        <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                             <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Opened On</p>
                             <p className="text-xs font-bold text-light-text dark:text-dark-text uppercase tracking-tight">{account.openingDate}</p>
                        </div>
                     )}
                     <div className="flex justify-between items-center">
                         <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Statement Day</span>
                         <span className="text-sm font-bold text-light-text dark:text-dark-text leading-none">{account.statementStartDate || '—'}</span>
                     </div>
                     <div className="flex justify-between items-center">
                         <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Due Day</span>
                         <span className="text-sm font-bold text-light-text dark:text-dark-text leading-none">{account.paymentDate || '—'}</span>
                     </div>
                     {account.cardNetwork && (
                         <div className="flex justify-between items-center pt-2 border-t border-black/5 dark:border-white/5">
                            <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Network</span>
                            <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] font-bold uppercase text-rose-500">{account.cardNetwork}</span>
                         </div>
                     )}
                 </div>
             </Card>

             {/* ACCOUNT LEDGER */}
             <Card className="!p-0 overflow-hidden flex flex-col h-[500px]">
                 <div className="p-6 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-md font-bold text-light-text dark:text-dark-text tracking-tight uppercase">Activity Flow</h3>
                        <span className="text-[8px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">Newest First</span>
                    </div>
                 </div>
                 <div className="flex-grow overflow-y-auto overflow-x-hidden p-2">
                    <TransactionList 
                        transactions={displayTransactionsList.slice(0, 30)} 
                        allCategories={allCategories}
                        onTransactionClick={onTransactionClick}
                    />
                 </div>
             </Card>
        </div>
      </div>
    </div>
  );
};

export default CreditCardAccountView;