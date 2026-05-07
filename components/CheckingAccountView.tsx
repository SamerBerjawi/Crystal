import React, { useMemo } from 'react';
import { Account, DisplayTransaction, Category, Transaction } from '../types';
import { formatCurrency, parseLocalDate, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateBalanceForecast, convertToEur, generateSyntheticPropertyTransactions, toLocalISOString, formatDateKey } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE } from '../constants';
import PageHeader from './PageHeader';
import BankCard from './BankCard';
import { useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';
import { motion } from 'motion/react';

interface CheckingAccountViewProps {
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

const CheckingAccountView: React.FC<CheckingAccountViewProps> = ({
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
  const { recurringTransactions, billsAndPayments, loanPaymentOverrides, recurringTransactionOverrides } = useScheduleContext();
  const { financialGoals } = useGoalsContext();
  const { accounts } = useAccountsContext();
  const { transactions: allTransactions } = useTransactionsContext();

  const cashFlowData = useMemo(() => {
      const data: { month: string; income: number; expense: number }[] = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthKey = d.toLocaleString('default', { month: 'short' });
          const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          const txs = transactions.filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth);
          let inc = 0; let exp = 0;
          txs.forEach(({ tx }) => {
             if (tx.amount > 0) inc += tx.amount;
             else exp += Math.abs(tx.amount);
          });
          data.push({ month: monthKey, income: inc, expense: exp });
      }
      return data;
  }, [transactions]);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const sortedTxsDesc = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    let realTodayBalance = account.balance;
    
    sortedTxsDesc.forEach(({ tx, parsedDate }) => {
        if (parsedDate > now) {
             realTodayBalance -= tx.amount;
        }
    });

    const threeMonthsAgo = new Date(todayStart);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1);
    const endOfLastMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 0);
    
    const last3MonthsTxs = transactions.filter(t => t.parsedDate >= threeMonthsAgo && t.parsedDate <= endOfLastMonth);
    const totalSpend3Months = last3MonthsTxs.reduce((sum, { tx }) => {
        if (tx.amount < 0 && !tx.transferId) return sum + Math.abs(tx.amount);
        return sum;
    }, 0);
    const avgMonthlySpend = totalSpend3Months / 3;

    const allRecurringItems = [
        ...recurringTransactions, 
        ...generateSyntheticLoanPayments(accounts, allTransactions, loanPaymentOverrides), 
        ...generateSyntheticCreditCardPayments(accounts, allTransactions), 
        ...generateSyntheticPropertyTransactions(accounts)
    ];

    const next7Days = new Date(todayStart);
    next7Days.setDate(next7Days.getDate() + 7);
    
    let upcomingOutflows = 0;
    const relevantRecurringForSafeSpend = allRecurringItems.filter(rt => 
        rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer')
    );
    
    relevantRecurringForSafeSpend.forEach(rt => {
        let nextDue = parseLocalDate(rt.nextDueDate);
        const interval = rt.frequencyInterval || 1;
        let safety = 0;
        while (nextDue <= next7Days && safety < 50) { 
             safety++;
             if (nextDue >= todayStart) upcomingOutflows += rt.amount;
             const d = new Date(nextDue);
             if (rt.frequency === 'monthly') d.setMonth(d.getMonth() + interval);
             else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
             else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
             else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
             nextDue = d;
        }
    });

    billsAndPayments.forEach(bill => {
        if (bill.accountId === account.id && bill.status === 'unpaid' && bill.type === 'payment') {
            const due = parseLocalDate(bill.dueDate);
            if (due >= todayStart && due <= next7Days) upcomingOutflows += Math.abs(bill.amount);
        }
    });

    const safeToSpend = realTodayBalance - upcomingOutflows;
    const forecastEndDate = new Date(todayStart);
    forecastEndDate.setDate(forecastEndDate.getDate() + 30);

    const { lowestPoint } = generateBalanceForecast(
        [{ ...account, balance: realTodayBalance }],
        allRecurringItems,
        financialGoals,
        billsAndPayments,
        forecastEndDate,
        recurringTransactionOverrides
    );
    
    const conversionRate = convertToEur(1, account.currency);
    const lowestBalanceForecast = lowestPoint.value / (conversionRate || 1);

    return { 
        lowestBalanceForecast, 
        avgMonthlySpend, 
        safeToSpend, 
        realTodayBalance,
        monthlyIncome: cashFlowData[cashFlowData.length - 1]?.income || 0,
        monthlyExpense: cashFlowData[cashFlowData.length - 1]?.expense || 0
    };
  }, [account, transactions, recurringTransactions, billsAndPayments, accounts, allTransactions, loanPaymentOverrides, cashFlowData]);

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

  const upcomingPayments = useMemo(() => {
      const list: { date: string; description: string; amount: number; isRecurring: boolean }[] = [];
      const now = new Date();
      const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const horizon = new Date(todayLocal);
      horizon.setDate(horizon.getDate() + 14);

      const allRecurring = [
          ...recurringTransactions.filter(rt => rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer')),
          ...generateSyntheticLoanPayments(accounts, allTransactions, loanPaymentOverrides).filter(rt => rt.accountId === account.id),
          ...generateSyntheticCreditCardPayments(accounts, allTransactions).filter(rt => rt.accountId === account.id)
      ];

      allRecurring.forEach(rt => {
          let nextDue = parseLocalDate(rt.nextDueDate);
          const interval = rt.frequencyInterval || 1;
          let safety = 0;
          while (nextDue <= horizon && safety < 100) {
             safety++;
             if (nextDue >= todayLocal) {
                 list.push({ date: toLocalISOString(nextDue), description: rt.description, amount: Math.abs(rt.amount), isRecurring: true });
             }
             const d = new Date(nextDue);
             if (rt.frequency === 'monthly') d.setMonth(d.getMonth() + interval);
             else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
             else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
             else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
             nextDue = d;
          }
      });

      billsAndPayments.forEach(bill => {
        if (bill.accountId === account.id && bill.status === 'unpaid' && bill.type === 'payment') {
             const due = parseLocalDate(bill.dueDate);
             if (due >= todayLocal && due <= horizon) {
                 list.push({ date: bill.dueDate, description: bill.description, amount: Math.abs(bill.amount), isRecurring: false });
             }
        }
      });
      
      return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
  }, [recurringTransactions, billsAndPayments, accounts, account.id, allTransactions, loanPaymentOverrides]);

  const expenseIntensity = metrics.monthlyIncome > 0 ? (metrics.monthlyExpense / metrics.monthlyIncome) * 100 : (metrics.monthlyExpense > 0 ? 100 : 0);

  const relevantGoals = useMemo(() => {
    return financialGoals.filter(goal => goal.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  const linkedAccounts = useMemo(() => {
    return accounts.filter(acc => acc.linkedAccountId === account.id || acc.settlementAccountId === account.id);
  }, [accounts, account.id]);

    const showVirtualCard = (account.type === 'Checking' || account.type === 'Savings') || !!(account.cardNetwork || account.last4 || account.expirationDate || account.cardholderName);

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 pb-6 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-6">
            <button 
                onClick={onBack} 
                className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
                title="Back to All Accounts"
            >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-4xl font-black tracking-tightest text-light-text dark:text-dark-text">{account.name}</h1>
                </div>
                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] opacity-60 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">account_balance_wallet</span>
                    {account.financialInstitution || 'Checking Account'}
                </p>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
            {isLinkedToEnableBanking && onSyncLinkedAccount && (
                <button onClick={onSyncLinkedAccount} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black/90 transition-all shadow-xl shadow-black/10">
                    <span className="material-symbols-outlined text-lg">sync</span>
                    Sync
                </button>
            )}
            <button onClick={onAddTransaction} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all">
                <span className="material-symbols-outlined text-lg">add</span>
                Add Entry
            </button>
        </div>
      </div>

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
                        type="Checking"
                        color="primary"
                    />
                )}

                {/* METRICS PULSE */}
                <div className={`grid ${showVirtualCard ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4 w-full`}>
                     <div className="p-5 rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                         <div>
                            <span className="material-symbols-outlined text-indigo-500 mb-3 bg-indigo-500/10 p-2 rounded-xl">monitoring</span>
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">Monthly Flow</p>
                            <h4 className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter leading-none">
                                {formatCurrency(metrics.monthlyIncome, account.currency, { compact: true })}
                            </h4>
                         </div>
                         <p className="text-[9px] font-bold text-emerald-500 mt-2 flex items-center gap-1">
                             Total Inbound
                         </p>
                     </div>
                     <div className="p-5 rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                         <div>
                            <span className="material-symbols-outlined text-rose-500 mb-3 bg-rose-500/10 p-2 rounded-xl">outbound</span>
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">Avg Outbound</p>
                            <h4 className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter leading-none">
                                {formatCurrency(metrics.avgMonthlySpend, account.currency, { compact: true })}
                            </h4>
                         </div>
                         <p className="text-[9px] font-bold text-rose-500 mt-2 flex items-center gap-1">
                             Expected Burn
                         </p>
                     </div>
                     <div className={`${account.showCard ? 'col-span-2' : 'col-span-2'} p-5 rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between`}>
                         <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${metrics.lowestBalanceForecast < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-primary-500/10 text-primary-500'}`}>
                                <span className="material-symbols-outlined text-2xl">{metrics.lowestBalanceForecast < 0 ? 'warning' : 'verified_user'}</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-0.5">30d Safety Floor</p>
                                <p className={`text-xl font-black tracking-tighter leading-none ${metrics.lowestBalanceForecast < 0 ? 'text-rose-500' : 'text-light-text dark:text-dark-text'}`}>
                                    {formatCurrency(metrics.lowestBalanceForecast, account.currency)}
                                </p>
                            </div>
                         </div>
                         <span className="material-symbols-outlined text-light-text-secondary/20">chevron_right</span>
                     </div>
                </div>
            </div>

            {/* BALANCE HISTORY CHART */}
            <Card className="!p-6 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">Balance History</h3>
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Trailing 30 Day Progression</p>
                    </div>
                </div>
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 10, fontWeight: 700 }}
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return d.getDate().toString();
                                }}
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
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
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
                            <span className="material-symbols-outlined text-indigo-500">target</span>
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

                {/* LINKED CARDS / ACCOUNTS */}
                <Card className="!p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary-500">link</span>
                            Linked Products
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {linkedAccounts.length > 0 ? linkedAccounts.map(acc => (
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
                        )) : (
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
             {/* ACCOUNT LEDGER */}
             <Card className="!p-0 overflow-hidden flex flex-col h-[400px]">
                 <div className="p-6 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-md font-bold text-light-text dark:text-dark-text tracking-tight">Recent Activity</h3>
                        <span className="text-[8px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">Newest First</span>
                    </div>
                 </div>
                 <div className="flex-grow overflow-y-auto overflow-x-hidden p-2">
                    <TransactionList 
                        transactions={displayTransactionsList.slice(0, 20)} 
                        allCategories={allCategories}
                        onTransactionClick={onTransactionClick}
                    />
                 </div>
                 <div className="p-4 bg-gray-50/50 dark:bg-white/[0.01] border-t border-black/5 dark:border-white/5">
                    <button 
                        onClick={() => setViewingAccountId(null)}
                        className="w-full py-2.5 rounded-xl border border-black/5 dark:border-white/10 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                    >
                        View Full Ledger
                    </button>
                 </div>
             </Card>

             {/* UPCOMING OBLIGATIONS */}
             <Card className="!p-6 overflow-hidden border-primary-500/10 h-min">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center">
                         <span className="material-symbols-outlined text-lg font-bold">calendar_month</span>
                     </div>
                     <h3 className="text-md font-bold text-light-text dark:text-dark-text tracking-tight">Upcoming Payments</h3>
                 </div>
                 
                 <div className="space-y-3">
                    {upcomingPayments.length > 0 ? upcomingPayments.map((item, idx) => (
                        <div key={idx} className="group p-3 rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-transparent hover:border-primary-500/10 transition-all flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/5 flex flex-col items-center justify-center border border-black/5 dark:border-white/10 shrink-0">
                                    <span className="text-[10px] font-bold text-primary-500 leading-none">{parseLocalDate(item.date).getDate()}</span>
                                    <span className="text-[7px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase opacity-60 leading-none mt-0.5">{parseLocalDate(item.date).toLocaleString('default', { month: 'short' })}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-light-text dark:text-dark-text truncate leading-tight group-hover:text-primary-500 transition-colors uppercase tracking-tight">{item.description}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`w-1 h-1 rounded-full ${item.isRecurring ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                                        <p className="text-[8px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">{item.isRecurring ? 'Recurring' : 'One-time'}</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs font-bold text-light-text dark:text-dark-text whitespace-nowrap ml-2">
                                {formatCurrency(item.amount, account.currency)}
                            </p>
                        </div>
                    )) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center opacity-30">
                            <span className="material-symbols-outlined text-4xl mb-2">event_available</span>
                            <p className="text-[10px] font-bold uppercase tracking-widest">No due payments</p>
                        </div>
                    )}
                 </div>
             </Card>

             {/* BANKING DETAILS PANEL */}
             <Card className="!p-6 bg-primary-500/[0.02] border-primary-500/10 h-min">
                 <h3 className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.2em] mb-4">Account Metadata</h3>
                 <div className="space-y-4">
                     {account.openingDate && (
                        <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                             <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Opened On</p>
                             <p className="text-xs font-bold text-light-text dark:text-dark-text uppercase tracking-tight">{account.openingDate}</p>
                        </div>
                     )}
                     {account.accountNumber && (
                        <div>
                             <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60 mb-1">Account / IBAN</p>
                             <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 group">
                                  <p className="font-mono text-[10px] font-bold text-light-text dark:text-dark-text break-all truncate mr-2">{account.accountNumber}</p>
                                  <button className="text-light-text-secondary hover:text-primary-500 transition-colors opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                             </div>
                        </div>
                     )}
                     {account.routingNumber && (
                        <div>
                             <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60 mb-1">BIC / Routing</p>
                             <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 group">
                                  <p className="font-mono text-[10px] font-bold text-light-text dark:text-dark-text">{account.routingNumber}</p>
                                  <button className="text-light-text-secondary hover:text-primary-500 transition-colors opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                             </div>
                        </div>
                     )}
                     {account.apy !== undefined && (
                        <div className="flex justify-between items-center pt-2">
                             <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Base APY</p>
                             <p className="text-lg font-bold text-emerald-500 leading-none">{account.apy}%</p>
                        </div>
                     )}
                 </div>
             </Card>
        </div>
      </div>
    </div>
  );
};

export default CheckingAccountView;
