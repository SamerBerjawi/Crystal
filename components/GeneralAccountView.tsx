import React, { useMemo, useState } from 'react';
import { Account, DisplayTransaction, Category, Transaction } from '../types';
import { formatCurrency, parseLocalDate, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateBalanceForecast, convertToEur, generateSyntheticPropertyTransactions, getPreferredTimeZone, toLocalISOString } from '../utils';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, BTN_SECONDARY_STYLE } from '../constants';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'motion/react';
import { MobileAccountHeader } from './MobileAccountHeader';
import { useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import HistoricalBalanceTrend from './HistoricalBalanceTrend';

interface GeneralAccountViewProps {
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
  showBalanceAdjustments?: boolean;
  onAdjustBalance?: () => void;
}

const getCardGradient = (id: string) => {
    const gradients = [
        "from-emerald-500 to-teal-500",
        "from-blue-600 to-indigo-600",
        "from-orange-500 to-amber-500",
        "from-purple-600 to-fuchsia-600",
        "from-cyan-500 to-blue-500",
        "from-rose-500 to-pink-500",
        "from-violet-600 to-purple-600",
        "from-teal-400 to-emerald-600",
        "from-fuchsia-600 to-pink-600",
        "from-indigo-500 to-blue-500",
        "from-yellow-400 to-orange-500",
        "from-lime-500 to-green-600"
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return `bg-gradient-to-br ${gradients[index]}`;
};

const MetricTile = ({ label, value, icon, subValue, trend, colorClass = 'primary' }: { 
    label: string; 
    value: string; 
    icon: string; 
    subValue?: string;
    trend?: { val: string; positive: boolean };
    colorClass?: 'primary' | 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'orange' | 'purple' | 'cyan' | 'slate';
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
        slate: 'bg-slate-500/10 text-slate-500',
    };

    return (
        <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2rem] p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 transition-all duration-500 h-full">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${colors[colorClass].split(' ')[1].replace('text-', 'bg-')}`}></div>
            <div className="flex justify-between items-start relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[colorClass]}`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg ${trend.positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                         <span className="material-symbols-outlined text-[10px]">{trend.positive ? 'trending_up' : 'trending_down'}</span>
                         {trend.val}
                    </div>
                )}
            </div>
            <div className="mt-6 relative z-10">
                <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary mb-1">{label}</p>
                <h4 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight tabular-nums privacy-blur">{value}</h4>
                {subValue && <p className="text-[11px] font-semibold text-light-text-secondary/50 dark:text-dark-text-secondary/70 mt-1 tracking-tight">{subValue}</p>}
            </div>
        </div>
    );
};

const GeneralAccountView: React.FC<GeneralAccountViewProps> = ({
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
  showBalanceAdjustments = true,
  onAdjustBalance,
}) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const [logoError, setLogoError] = useState(false);

  const logoUrl = useMemo(() => {
    if (!brandfetchClientId || !account.financialInstitution || logoError) return null;
    return getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, merchantLogoOverrides, { type: 'icon', fallback: 'lettermark', width: 64, height: 64 });
  }, [account.financialInstitution, brandfetchClientId, merchantLogoOverrides, logoError]);

  const { recurringTransactions, billsAndPayments, loanPaymentOverrides, recurringTransactionOverrides } = useScheduleContext();
  const { financialGoals } = useGoalsContext();
  const { accounts } = useAccountsContext();
  const { transactions: allTransactions } = useTransactionsContext();
  const timeZone = getPreferredTimeZone();

  // --- 1. Key Metrics Calculations ---
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const filteredTxs = transactions.filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment);
    const sortedTxsDesc = [...filteredTxs].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    let realTodayBalance = account.balance;
    
    sortedTxsDesc.forEach(({ tx, parsedDate }) => {
        if (parsedDate > now) realTodayBalance -= tx.amount;
    });

    const threeMonthsAgo = new Date(todayStart);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1);
    const endOfLastMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 0);
    const last3MonthsTxs = filteredTxs.filter(t => t.parsedDate >= threeMonthsAgo && t.parsedDate <= endOfLastMonth);
    const totalSpend3Months = last3MonthsTxs.reduce((sum, { tx }) => {
        if (tx.amount < 0 && !tx.transferId) return sum + Math.abs(tx.amount);
        return sum;
    }, 0);
    const avgMonthlySpend = totalSpend3Months / 3;

    const syntheticLoans = generateSyntheticLoanPayments(accounts, allTransactions, loanPaymentOverrides);
    const syntheticCC = generateSyntheticCreditCardPayments(accounts, allTransactions);
    const syntheticProperty = generateSyntheticPropertyTransactions(accounts);
    const allRecurringItems = [...recurringTransactions, ...syntheticLoans, ...syntheticCC, ...syntheticProperty];

    const next7Days = new Date(todayStart);
    next7Days.setDate(next7Days.getDate() + 7);
    let upcomingOutflows = 0;
    const relevantRecurringForSafeSpend = allRecurringItems.filter(rt => rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer'));
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
    const accountForForecast = { ...account, balance: realTodayBalance };
    const { lowestPoint } = generateBalanceForecast([accountForForecast], allRecurringItems, financialGoals, billsAndPayments, forecastEndDate, recurringTransactionOverrides);
    const conversionRate = convertToEur(1, account.currency);
    const lowestBalanceForecast = lowestPoint.value / (conversionRate || 1);

    return { lowestBalanceForecast, avgMonthlySpend, safeToSpend, realTodayBalance };
  }, [account, transactions, recurringTransactions, billsAndPayments, accounts, allTransactions, loanPaymentOverrides, financialGoals, recurringTransactionOverrides, showBalanceAdjustments]);

  // --- 2. Chart Data ---
  const balanceHistory = useMemo(() => {
    const data = [];
    let currentBalance = metrics.realTodayBalance;
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const filteredTxs = transactions.filter(({ tx }) => showBalanceAdjustments || !tx.isBalanceAdjustment);
    const sortedTxs = [...filteredTxs].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
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
        const change = dailyChanges[dateStr] || 0;
        currentBalance -= change;
        iterDate.setDate(iterDate.getDate() - 1);
    }
    return data.reverse();
  }, [metrics.realTodayBalance, transactions, showBalanceAdjustments]);

  const upcomingPayments = useMemo(() => {
      const list: { date: string; description: string; amount: number; isRecurring: boolean }[] = [];
      const now = new Date();
      const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const horizon = new Date(todayLocal);
      horizon.setDate(horizon.getDate() + 14);

      const relevantRecurring = recurringTransactions.filter(rt => rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer'));
      const syntheticLoans = generateSyntheticLoanPayments(accounts, allTransactions, loanPaymentOverrides).filter(rt => rt.accountId === account.id);
      const syntheticCC = generateSyntheticCreditCardPayments(accounts, allTransactions).filter(rt => rt.accountId === account.id);
      
      [...relevantRecurring, ...syntheticLoans, ...syntheticCC].forEach(rt => {
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

  const linkedCreditCards = useMemo(() => {
    return accounts.filter(acc => acc.type === 'Credit Card' && acc.settlementAccountId === account.id);
  }, [accounts, account.id]);
  
  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  const style = ACCOUNT_TYPE_STYLES[account.type] || { color: 'text-primary-500', icon: 'wallet' };
  const cardGradient = getCardGradient(account.id);

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in-up pb-10">
      {/* Mobile Header */}
      <MobileAccountHeader
        account={account}
        onBack={onBack}
        formattedBalance={formatCurrency(account.balance, account.currency)}
        badgeText={`${account.type} Asset`}
        subText={account.financialInstitution || 'Vault'}
        primaryAction={{ label: 'Log Tx', icon: 'add', onClick: onAddTransaction }}
        secondaryAction={onAdjustBalance ? { label: 'Adjust', icon: 'tune', onClick: onAdjustBalance } : undefined}
        syncAction={isLinkedToEnableBanking && onSyncLinkedAccount ? { label: 'Sync', icon: 'sync', onClick: onSyncLinkedAccount } : undefined}
      />

      {/* Dynamic Desktop Header */}
      <header className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6 relative">
          <div className="flex items-center gap-4 sm:gap-6">
              <button 
                  onClick={onBack}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all shadow-sm group active:scale-95"
              >
                  <span className="material-symbols-outlined text-xl sm:text-2xl transition-transform group-hover:-translate-x-1">arrow_back</span>
              </button>
              <div>
                  <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-bold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-lg border border-primary-500/20">{account.type} Asset</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80">{account.financialInstitution || 'Vault'}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
                      {account.name}
                      <span className="material-symbols-outlined text-light-text-secondary/40 dark:text-dark-text-secondary/40 font-light text-xl sm:text-2xl">{account.icon || style.icon}</span>
                  </h1>
              </div>
          </div>
          
          <div className="flex gap-2 sm:gap-3 w-full md:w-auto">
              {isLinkedToEnableBanking && onSyncLinkedAccount && (
                  <button onClick={onSyncLinkedAccount} className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-4 sm:!px-6 h-10 sm:h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card flex-1 sm:flex-none text-xs sm:text-sm`}>
                      <span className="material-symbols-outlined text-base sm:text-lg mr-1 sm:mr-2">sync</span>
                      Sync
                  </button>
              )}
              <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-4 sm:!px-6 h-10 sm:h-12 shadow-lg shadow-primary-500/20 flex-1 sm:flex-none text-xs sm:text-sm`}>
                  <span className="material-symbols-outlined text-base sm:text-lg mr-1 sm:mr-2">add</span>
                  Transaction
              </button>
          </div>
      </header>

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
           {/* Immersive Dynamic Card */}
           <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 sm:gap-8">
               <div 
                   className={`relative min-h-[360px] sm:min-h-[440px] rounded-[2.5rem] sm:rounded-[3rem] ${cardGradient} text-white p-6 sm:p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group`}
               >
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)]"></div>
                   <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-[100px] animate-pulse"></div>
                   
                   <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8 sm:mb-12">
                             <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                  {logoUrl ? (
                                      <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={() => setLogoError(true)} />
                                  ) : (
                                      <span className="material-symbols-outlined text-2xl sm:text-3xl font-light">credit_card</span>
                                  )}
                             </div>
                             <div className="text-right">
                                  <p className="text-[9px] sm:text-[10px] font-bold tracking-wider text-white/60 mb-1">{account.financialInstitution || 'Crystal'}</p>
                                  <p className="text-[10px] sm:text-xs font-semibold text-white/90 tracking-widest">{account.accountNumber ? `•••• ${account.accountNumber.slice(-4)}` : 'Active'}</p>
                             </div>
                        </div>
                        
                        <p className="text-[9px] sm:text-[10px] font-black text-white/70 mb-1 sm:mb-2  tracking-wider">Managed Capital</p>
                        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter tabular-nums drop-shadow-lg privacy-blur truncate">
                            {formatCurrency(account.balance, account.currency)}
                        </h2>
                   </div>

                   <div className="relative z-10 pt-6 sm:pt-10 border-t border-white/5 flex justify-between items-end">
                       <div>
                           <p className="text-[10px] sm:text-[11px] tracking-wider text-white/50 font-bold mb-1 ">Verified Holder</p>
                           <p className="font-semibold text-xs sm:text-sm text-white tracking-widest truncate max-w-[150px]">{account.cardholderName || account.name}</p>
                       </div>
                       <span className="text-[9px] sm:text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg border border-white/10">{account.currency}</span>
                   </div>
               </div>

               {/* Infrastructure Configuration (Integrated with Card Context) */}
               <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 group overflow-hidden">
                   <h3 className="text-[10px] sm:text-[11px] font-bold tracking-tight text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-6 sm:mb-8">Infrastructure Configuration</h3>
                   <div className="space-y-4 sm:space-y-6">
                       {[
                           { label: 'Clearing Institution', value: account.financialInstitution },
                           { label: 'Asset Architecture', value: account.type },
                           { label: 'Settlement Engine', value: account.currency },
                           { label: 'Origin Epoch', value: account.openingDate ? parseLocalDate(account.openingDate).toLocaleDateString() : '—' },
                           { label: 'Logical Serial', value: account.accountNumber, isMono: true },
                           { label: 'Routing Directive', value: account.routingNumber, isMono: true },
                           { label: 'Yield Maturity', value: account.apy ? `${account.apy}% APY` : '—' }
                       ].filter(i => i.value).map((item, idx) => (
                           <div key={idx} className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-3 sm:pb-4 last:border-0 last:pb-0">
                               <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/50 ">{item.label}</p>
                               <p className={`text-xs sm:text-sm font-black text-light-text dark:text-dark-text tracking-tight shrink-0 ml-4 ${item.isMono ? 'font-mono opacity-60' : ''}`}>
                                   {item.value}
                               </p>
                           </div>
                       ))}
                   </div>
               </div>
           </div>

           {/* Metrics & Analytics */}
           <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 gap-6">
                    <MetricTile 
                        label="Safe to Spend" 
                        value={formatCurrency(metrics.safeToSpend, account.currency)} 
                        icon="verified" 
                        colorClass="emerald"
                        subValue="Post-upcoming outflows"
                    />
                    <MetricTile 
                        label="Lowest Forecast" 
                        value={formatCurrency(metrics.lowestBalanceForecast, account.currency)} 
                        icon="timeline" 
                        colorClass="amber"
                        subValue="30-day projected floor"
                    />
                    <MetricTile 
                        label="Monthly Velocity" 
                        value={formatCurrency(metrics.avgMonthlySpend, account.currency)} 
                        icon="analytics" 
                        colorClass="blue"
                        subValue="90-day spend average"
                    />
                    <MetricTile 
                        label="Effective Liquidity" 
                        value={formatCurrency(metrics.realTodayBalance, account.currency)} 
                        icon="water_drop" 
                        colorClass="indigo"
                        subValue="Current cleared funds"
                    />
                </div>

                {/* 6-Month Balance Trend Chart */}
                <HistoricalBalanceTrend account={account} transactions={allTransactions} />
           </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
           {/* Detailed Activity Sidebar */}
           <div className="xl:col-span-8 flex flex-col gap-8">
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden flex flex-col group h-full min-h-[600px]">
                    <div className="py-2 px-6 sm:px-10 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-gray-50/30 dark:bg-white/[0.01]">
                        <div>
                            <h3 className="text-[10px] sm:text-[11px] font-bold tracking-tight text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-1">Account Ledger</h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-light-text-secondary/40 dark:text-dark-text-secondary/60 tracking-widest ">Complete history of financial flows</p>
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

            {/* Metrics & Metadata Sidebar */}
           <div className="xl:col-span-4 flex flex-col gap-8">
                {/* Upcoming Obligations */}
                <div className="bg-white dark:bg-dark-card rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 dark:border-white/5 p-6 sm:p-10 group relative overflow-hidden">
                    <h3 className="text-[10px] sm:text-[11px] font-bold tracking-tight text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-6 sm:mb-8">Upcoming Obligations</h3>
                    <div className="space-y-6">
                        {upcomingPayments.length > 0 ? (
                            upcomingPayments.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-4 group/item">
                                    <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex flex-col items-center justify-center border border-transparent group-hover/item:border-primary-500/20 transition-all">
                                        <span className="text-[9px] font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/80 leading-none mb-1">{new Date(p.date).toLocaleString(undefined, { month: 'short' })}</span>
                                        <span className="text-lg font-bold leading-none">{new Date(p.date).getDate()}</span>
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-sm font-bold text-light-text dark:text-dark-text truncate">{p.description}</p>
                                        <p className="text-[10px] font-semibold text-light-text-secondary/40 dark:text-dark-text-secondary/60 tracking-widest">{p.isRecurring ? 'Recurring' : 'One-time'}</p>
                                    </div>
                                    <p className="text-sm font-bold text-rose-500 tabular-nums">-{formatCurrency(p.amount, account.currency)}</p>
                                </div>
                            ))
                        ) : (
                                <div className="py-20 flex flex-col items-center justify-center text-center opacity-30">
                                    <span className="material-symbols-outlined text-5xl mb-2">event_available</span>
                                    <p className="text-[10px] font-semibold tracking-widest">Clear Horizon</p>
                                </div>
                        )}
                    </div>
                </div>

                {/* Interconnected Assets */}
                {(linkedCreditCards.length > 0 || linkedGoals.length > 0) && (
                    <div className="bg-white dark:bg-dark-card rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 dark:border-white/5 p-6 sm:p-10 group overflow-hidden">
                        <h3 className="text-[10px] sm:text-[11px] font-bold tracking-tight text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-6 sm:mb-8">Interconnected Assets</h3>
                        <div className="space-y-4">
                            {linkedCreditCards.map(c => (
                                <button key={c.id} onClick={() => setViewingAccountId(c.id)} className="w-full flex items-center justify-between p-4 rounded-3xl bg-black/5 dark:bg-white/5 hover:bg-rose-500/10 transition-colors group/link border border-transparent hover:border-rose-500/20">
                                    <div className="flex items-center gap-4">
                                        <span className="material-symbols-outlined text-rose-500">credit_card</span>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-light-text dark:text-dark-text">{c.name}</p>
                                            <p className="text-[10px] font-semibold text-light-text-secondary/40 dark:text-dark-text-secondary/60">Liable Shield</p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-light-text-secondary/20 group-hover/link:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                            ))}
                            {linkedGoals.map(g => (
                                <div key={g.id} className="p-4 rounded-3xl bg-black/5 dark:bg-white/5 border border-transparent">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-4">
                                            <span className="material-symbols-outlined text-emerald-500">target</span>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-light-text dark:text-dark-text">{g.name}</p>
                                                <p className="text-[10px] font-semibold text-light-text-secondary/40 dark:text-dark-text-secondary/60">Capital Target</p>
                                            </div>
                                        </div>
                                        <p className="text-xs font-bold text-emerald-500">{((g.currentAmount / g.amount) * 100).toFixed(0)}%</p>
                                    </div>
                                    <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (g.currentAmount / g.amount) * 100)}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
           </div>
      </div>
    </div>
  );
};

export default GeneralAccountView;
