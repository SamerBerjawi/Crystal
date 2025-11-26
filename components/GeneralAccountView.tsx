
import React, { useMemo } from 'react';
import { Account, DisplayTransaction, Category, Transaction, RecurringTransaction } from '../types';
import { formatCurrency, parseDateAsUTC, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments, generateBalanceForecast, convertToEur, generateSyntheticPropertyTransactions, calculateStatementPeriods, getCreditCardStatementDetails, getPreferredTimeZone } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, Legend } from 'recharts';
import { useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';

interface GeneralAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
  setViewingAccountId: (id: string | null) => void;
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

const GeneralAccountView: React.FC<GeneralAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack,
  setViewingAccountId
}) => {
  const { recurringTransactions, billsAndPayments, loanPaymentOverrides, recurringTransactionOverrides } = useScheduleContext();
  const { financialGoals } = useGoalsContext();
  const { accounts } = useAccountsContext();
  const { transactions: allTransactions } = useTransactionsContext();

  // --- 1. Key Metrics Calculations ---

  // Helper: Get transactions for specific timeframes
  const getTransactionsInDateRange = (startDate: Date, endDate: Date) => {
    return transactions.filter(t => t.parsedDate >= startDate && t.parsedDate <= endDate);
  };

  const metrics = useMemo(() => {
    const now = new Date();
    // Normalize "Today" to end of day for inclusion, but keep 'now' for future checks
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // 1. Sort transactions descending (Newest -> Oldest)
    const sortedTxsDesc = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

    // 2. Calculate "Real Today Balance"
    // Start with the account's current balance (source of truth).
    // If there are transactions dated in the future included in this balance, 
    // we must reverse them to find the actual balance available *right now*.
    let realTodayBalance = account.balance;
    
    sortedTxsDesc.forEach(({ tx, parsedDate }) => {
        if (parsedDate > now) {
             // Reverse future transaction:
             // If it was income (+), we subtract it. If expense (-), we add it.
             realTodayBalance -= tx.amount;
        }
    });

    // --- A. Average Monthly Spend (Last 3 Months) ---
    const threeMonthsAgo = new Date(todayStart);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1); // Start of 3 months ago
    const endOfLastMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 0);
    
    const last3MonthsTxs = getTransactionsInDateRange(threeMonthsAgo, endOfLastMonth);
    const totalSpend3Months = last3MonthsTxs.reduce((sum, { tx }) => {
        if (tx.amount < 0 && !tx.transferId) return sum + Math.abs(tx.amount);
        return sum;
    }, 0);
    const avgMonthlySpend = totalSpend3Months / 3;


    // --- B. Prepare Recurring Items for Forecast (Safe-to-Spend & Lowest Balance) ---
    // Generate synthetic payments (loans, credit cards, properties)
    const syntheticLoans = generateSyntheticLoanPayments(accounts, allTransactions, loanPaymentOverrides);
    const syntheticCC = generateSyntheticCreditCardPayments(accounts, allTransactions);
    const syntheticProperty = generateSyntheticPropertyTransactions(accounts);
    
    const allRecurringItems = [
        ...recurringTransactions, 
        ...syntheticLoans, 
        ...syntheticCC, 
        ...syntheticProperty
    ];

    // --- C. Safe to Spend (Real Today Balance - Upcoming Payments in next 7 days) ---
    const next7Days = new Date(todayStart);
    next7Days.setDate(next7Days.getDate() + 7);
    
    let upcomingOutflows = 0;

    // 1. Recurring Check (Simple check for Safe-to-Spend)
    const relevantRecurringForSafeSpend = allRecurringItems.filter(rt => 
        rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer')
    );
    
    relevantRecurringForSafeSpend.forEach(rt => {
        let nextDue = parseDateAsUTC(rt.nextDueDate);
        const interval = rt.frequencyInterval || 1;
        
        // Check occurrences within next 7 days
        let safety = 0;
        while (nextDue <= next7Days && safety < 50) { 
             safety++;
             if (nextDue >= todayStart) {
                 upcomingOutflows += rt.amount;
             }
             // Advance
             const d = new Date(nextDue);
             if (rt.frequency === 'monthly') d.setMonth(d.getMonth() + interval);
             else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
             else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
             else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
             nextDue = d;
        }
    });

    // 2. Bills
    billsAndPayments.forEach(bill => {
        if (bill.accountId === account.id && bill.status === 'unpaid' && bill.type === 'payment') {
            const due = parseDateAsUTC(bill.dueDate);
            if (due >= todayStart && due <= next7Days) {
                upcomingOutflows += Math.abs(bill.amount);
            }
        }
    });

    const safeToSpend = realTodayBalance - upcomingOutflows;

    // --- D. Forecast Lowest Balance (Next 30 Days) ---
    const forecastEndDate = new Date(todayStart);
    forecastEndDate.setDate(forecastEndDate.getDate() + 30);

    // Create a temporary account object with the "Real Today Balance"
    // This ensures the forecast engine starts from the correct effective funds available now.
    const accountForForecast = { ...account, balance: realTodayBalance };

    const { chartData } = generateBalanceForecast(
        [accountForForecast],
        allRecurringItems,
        financialGoals,
        billsAndPayments,
        forecastEndDate,
        recurringTransactionOverrides
    );

    let lowestPoint = { value: accountForForecast.balance, date: '' }; // Default to current balance
    if (chartData.length > 0) {
        lowestPoint = chartData.reduce((min, p) => p.value < min.value ? { value: p.value, date: p.date } : min, { value: chartData[0].value, date: chartData[0].date });
    }
    
    // `generateBalanceForecast` works in EUR. Convert the result back to the account's currency.
    // If account currency is same as base (EUR), rate is 1.
    const conversionRate = convertToEur(1, account.currency);
    const lowestBalanceForecast = lowestPoint.value / (conversionRate || 1);

    return { lowestBalanceForecast, avgMonthlySpend, safeToSpend, realTodayBalance };
  }, [account, transactions, recurringTransactions, billsAndPayments, accounts, allTransactions, loanPaymentOverrides, financialGoals, recurringTransactionOverrides]);


  // --- 2. Chart Data ---
  
  // Cash Flow Trend (Last 6 Months)
  const cashFlowData = useMemo(() => {
      const data: { month: string; income: number; expense: number }[] = [];
      const today = new Date();
      
      for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthKey = d.toLocaleString('default', { month: 'short' });
          
          const startOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
          const endOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
          
          const txs = transactions.filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth);
          
          let inc = 0;
          let exp = 0;
          txs.forEach(({ tx }) => {
             if (tx.amount > 0) inc += tx.amount;
             else exp += Math.abs(tx.amount);
          });
          
          data.push({ month: monthKey, income: inc, expense: exp });
      }
      return data;
  }, [transactions]);

  // Top Spending Categories (Last 30 Days)
  const topCategories = useMemo(() => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const spending: Record<string, number> = {};
      let totalSpent = 0;
      
      transactions.forEach(({ tx, parsedDate }) => {
          if (parsedDate >= thirtyDaysAgo && tx.amount < 0 && !tx.transferId) {
             // Find parent category
             const category = allCategories.find(c => c.name === tx.category);
             let parentName = category ? category.name : tx.category;
             
             if (category && category.parentId) {
                 const parent = allCategories.find(c => c.id === category.parentId);
                 if (parent) {
                     parentName = parent.name;
                 }
             }
             
             spending[parentName] = (spending[parentName] || 0) + Math.abs(tx.amount);
             totalSpent += Math.abs(tx.amount);
          }
      });
      
      return Object.entries(spending)
        .map(([name, value]) => {
             // Re-find color
             const cat = allCategories.find(c => c.name === name);
             return { name, value, color: cat?.color || '#cbd5e1' };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
  }, [transactions, allCategories]);

  // Upcoming Payments List (Next 14 Days)
  const upcomingPayments = useMemo(() => {
      const list: { date: string; description: string; amount: number; isRecurring: boolean }[] = [];
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const horizon = new Date(todayUTC);
      horizon.setDate(horizon.getDate() + 14);

      // Recurring
      const relevantRecurring = recurringTransactions.filter(rt => 
        rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer')
      );
      // Synthetic
      const syntheticLoans = generateSyntheticLoanPayments(accounts, allTransactions, loanPaymentOverrides).filter(rt => rt.accountId === account.id);
      const syntheticCC = generateSyntheticCreditCardPayments(accounts, allTransactions).filter(rt => rt.accountId === account.id);
      
      [...relevantRecurring, ...syntheticLoans, ...syntheticCC].forEach(rt => {
          let nextDue = parseDateAsUTC(rt.nextDueDate);
          const interval = rt.frequencyInterval || 1;
          
          // Find occurrences in window
          let safety = 0;
          while (nextDue <= horizon && safety < 100) {
             safety++;
             if (nextDue >= todayUTC) {
                 list.push({
                     date: nextDue.toISOString().split('T')[0],
                     description: rt.description,
                     amount: Math.abs(rt.amount),
                     isRecurring: true
                 });
             }
             // Advance logic
             const d = new Date(nextDue);
             if (rt.frequency === 'monthly') d.setMonth(d.getMonth() + interval);
             else if (rt.frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
             else if (rt.frequency === 'daily') d.setDate(d.getDate() + interval);
             else if (rt.frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
             nextDue = d;
          }
      });

      // Bills
      billsAndPayments.forEach(bill => {
        if (bill.accountId === account.id && bill.status === 'unpaid' && bill.type === 'payment') {
             const due = parseDateAsUTC(bill.dueDate);
             if (due >= todayUTC && due <= horizon) {
                 list.push({
                     date: bill.dueDate,
                     description: bill.description,
                     amount: Math.abs(bill.amount),
                     isRecurring: false
                 });
             }
        }
      });
      
      return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
  }, [recurringTransactions, billsAndPayments, accounts, account.id, allTransactions, loanPaymentOverrides]);

  // Linked Goals
  const linkedGoals = useMemo(() => {
    return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  // Balance History (30 Days)
  const balanceHistory = useMemo(() => {
    const data = [];
    // Use the calculated "Real Today Balance" so future transactions don't skew the history chart
    let currentBalance = metrics.realTodayBalance;
    
    const today = new Date();
    const endDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const sortedTxs = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    const dailyChanges: Record<string, number> = {};
    
    sortedTxs.forEach(({ tx, parsedDate }) => {
         if (parsedDate > today) return; // Ignore future
         const dateStr = parsedDate.toISOString().split('T')[0];
         dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + tx.amount;
    });

    let iterDate = new Date(endDate);
    for (let i = 0; i <= 30; i++) {
        const dateStr = iterDate.toISOString().split('T')[0];
        data.push({ date: dateStr, value: currentBalance });
        const change = dailyChanges[dateStr] || 0;
        currentBalance -= change;
        iterDate.setDate(iterDate.getDate() - 1);
    }
    return data.reverse();
  }, [metrics.realTodayBalance, transactions]);

  // Find credit cards linked to this account (where settlementAccountId === this account.id)
  const linkedCreditCards = useMemo(() => {
    return accounts.filter(acc => 
      acc.type === 'Credit Card' && 
      acc.settlementAccountId === account.id
    );
  }, [accounts, account.id]);

  const showVirtualCard = !!(account.cardNetwork || account.last4 || account.expirationDate || account.cardholderName);
  const hasLinkedCards = linkedCreditCards.length > 0;
  
  const hasAccountDetails = useMemo(() => {
      const basicDetails = !!(account.accountNumber || account.routingNumber || account.apy || account.openingDate);
      if (showVirtualCard) return basicDetails;
      
      // If no virtual card, also check for card-like details to be shown in the list
      return basicDetails || !!(account.expirationDate || account.cardNetwork || account.cardholderName || account.last4);
  }, [account, showVirtualCard]);


  const NetworkLogo = () => {
      const network = account.cardNetwork?.toLowerCase() || '';
      if (network.includes('visa')) return <span className="font-bold text-2xl italic text-white">VISA</span>;
      if (network.includes('master')) return (
          <div className="flex">
              <div className="w-6 h-6 rounded-full bg-red-500/90"></div>
              <div className="w-6 h-6 rounded-full bg-yellow-500/90 -ml-3"></div>
          </div>
      );
      if (network.includes('amex') || network.includes('american')) return <span className="font-bold text-lg text-blue-300 tracking-tighter border-2 border-blue-300 px-1 rounded">AMEX</span>;
      return <span className="font-bold text-xl text-white tracking-widest opacity-60">DEBIT</span>;
  };

  const metricsCards = (
    <>
        {/* Current Balance */}
        <Card className="relative overflow-hidden">
             <div className="absolute right-0 top-0 p-4 opacity-10 pointer-events-none">
                 <span className="material-symbols-outlined text-6xl">account_balance_wallet</span>
            </div>
            <p className="text-xs font-medium uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p>
        </Card>

        {/* Safe To Spend */}
        <Card>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Safe to Spend (7d)</p>
                    <p className={`text-2xl font-bold ${metrics.safeToSpend < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCurrency(metrics.safeToSpend, account.currency)}
                    </p>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${metrics.safeToSpend < 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    <span className="material-symbols-outlined text-lg">
                        {metrics.safeToSpend < 0 ? 'warning' : 'verified'}
                    </span>
                </div>
            </div>
        </Card>

        {/* Avg Monthly Spend */}
        <Card>
            <p className="text-xs font-medium uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Avg Monthly Spend</p>
            <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(metrics.avgMonthlySpend, account.currency)}</p>
        </Card>

        {/* Lowest Forecast */}
        <Card>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Lowest Forecast (30d)</p>
                    <p className={`text-2xl font-bold ${metrics.lowestBalanceForecast < 0 ? 'text-red-500' : 'text-light-text dark:text-dark-text'}`}>
                        {formatCurrency(metrics.lowestBalanceForecast, account.currency)}
                    </p>
                </div>
                 {metrics.lowestBalanceForecast < 0 ? (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-600" title="Projected overdraft">
                        <span className="material-symbols-outlined text-lg">trending_down</span>
                    </div>
                ) : (
                     <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
                        <span className="material-symbols-outlined text-lg">timeline</span>
                    </div>
                )}
            </div>
             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                Minimum projected balance
            </p>
        </Card>
    </>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'text-gray-600'} bg-current/10`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || 'wallet'}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-light-text dark:text-dark-text truncate">{account.name}</h1>
                  {account.financialInstitution && (
                      <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded flex-shrink-0">
                          {account.financialInstitution}
                      </span>
                  )}
              </div>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span>{account.type}</span>
                {account.last4 && <span>• **** {account.last4}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 ml-auto md:ml-0">
          <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Virtual Card Column */}
          {showVirtualCard && (
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
                <div className={`w-full aspect-[1.586/1] rounded-2xl ${getCardGradient(account.id)} p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-white/20 flex flex-col justify-between group transition-transform hover:scale-[1.02] duration-300`}>
                    {/* Texture Overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start z-10">
                        <div className="w-12 h-9 bg-white/20 rounded-md border border-white/30 backdrop-blur-md flex items-center justify-center relative overflow-hidden shadow-sm">
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent"></div>
                            <div className="w-8 h-[1px] bg-black/20 absolute top-2"></div>
                            <div className="w-8 h-[1px] bg-black/20 absolute bottom-2"></div>
                            <div className="w-[1px] h-5 bg-black/20 absolute left-4"></div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="material-symbols-outlined text-2xl opacity-80 mb-1">rss_feed</span>
                            <span className="text-white/80 font-mono text-xs font-semibold uppercase tracking-wider shadow-sm">
                                {account.financialInstitution || 'Crystal Bank'}
                            </span>
                        </div>
                    </div>

                    <div className="z-10 mt-4">
                        <div className="flex items-center gap-3 text-xl sm:text-2xl font-mono tracking-widest text-white/95 drop-shadow-md truncate">
                            <span>••••</span> <span>••••</span> <span>••••</span> <span>{account.last4 || '0000'}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-end z-10">
                        <div className="min-w-0 flex-1 mr-4">
                            <p className="text-[9px] text-white/70 uppercase tracking-widest mb-0.5">Cardholder</p>
                            <p className="font-medium uppercase tracking-wide text-sm sm:text-base text-white/95 drop-shadow-sm truncate">{account.cardholderName || account.name}</p>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                            {account.expirationDate && (
                                <div className="text-center mb-2">
                                    <p className="text-[8px] text-white/70 uppercase">Valid Thru</p>
                                    <p className="font-mono text-sm font-semibold">{account.expirationDate}</p>
                                </div>
                            )}
                            <NetworkLogo />
                        </div>
                    </div>
                </div>

                {/* Linked Credit Cards Section */}
                {hasLinkedCards && (
                    <Card className="bg-gray-50 dark:bg-white/5 border-l-4 border-orange-500">
                        <h3 className="text-sm font-bold text-light-text dark:text-dark-text uppercase tracking-wider mb-3">Linked Credit Cards</h3>
                        <div className="space-y-3">
                            {linkedCreditCards.map(cc => (
                                <div key={cc.id} className="flex justify-between items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 p-2 -mx-2 rounded" onClick={() => setViewingAccountId(cc.id)}>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-orange-500">credit_card</span>
                                        <div>
                                            <p className="font-semibold text-sm">{cc.name}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Bal: {formatCurrency(cc.balance, cc.currency)}</p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-sm text-light-text-secondary">chevron_right</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
          )}

          {/* Metrics Grid (adjusts based on card presence) */}
          <div className={`${showVirtualCard ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 auto-rows-fr`}>
               {metricsCards}
          </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
              {/* Balance History Chart */}
              <Card className="flex flex-col min-h-[300px]">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Balance History (30 Days)</h3>
                <div className="flex-grow w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                }}
                                minTickGap={40}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                                tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`} 
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
                                labelStyle={{ color: 'var(--light-text)' }}
                                formatter={(val: number) => [formatCurrency(val, account.currency), 'Balance']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#3b82f6" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorBalance)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
              </Card>

              {/* Cash Flow Trend Chart */}
              <Card className="flex flex-col min-h-[300px]">
                   <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Cash Flow Trend (6 Months)</h3>
                   <div className="flex-grow w-full min-h-0">
                     <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                              <Tooltip 
                                  cursor={{ fill: 'transparent' }}
                                  contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', color: 'var(--light-text)' }}
                                  formatter={(value: number) => formatCurrency(value, account.currency)}
                              />
                              <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                     </ResponsiveContainer>
                   </div>
              </Card>
          </div>
          
          <div className="lg:col-span-1 space-y-8">
               {/* Top Categories */}
               <Card>
                   <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Top Spending (30d)</h3>
                   {topCategories.length > 0 ? (
                       <div className="space-y-4">
                           {topCategories.map((cat, idx) => {
                               // Calculate percentage relative to the max value for bar width
                               const maxVal = topCategories[0].value;
                               const percent = (cat.value / maxVal) * 100;
                               return (
                                   <div key={idx}>
                                       <div className="flex justify-between text-sm mb-1">
                                           <span className="font-medium">{cat.name}</span>
                                           <span className="font-semibold">{formatCurrency(cat.value, account.currency)}</span>
                                       </div>
                                       <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2">
                                           <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: cat.color }}></div>
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   ) : (
                       <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8 text-sm">No spending activity in the last 30 days.</p>
                   )}
               </Card>

               {/* Upcoming Payments List */}
               <Card>
                   <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Upcoming (14d)</h3>
                   {upcomingPayments.length > 0 ? (
                       <div className="space-y-3">
                           {upcomingPayments.map((item, idx) => (
                               <div key={idx} className="flex justify-between items-center p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors">
                                   <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.isRecurring ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                            <span className="material-symbols-outlined text-lg">{item.isRecurring ? 'update' : 'receipt_long'}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">{item.description}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                   </div>
                                   <span className="font-semibold text-sm">{formatCurrency(item.amount, account.currency)}</span>
                               </div>
                           ))}
                       </div>
                   ) : (
                       <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8 text-sm">No upcoming payments scheduled.</p>
                   )}
               </Card>

               {/* Account Details */}
               {hasAccountDetails && (
                   <Card>
                       <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-4 border-b border-black/5 dark:border-white/5 pb-2">Account Details</h3>
                       <div className="space-y-3 text-sm">
                           {account.accountNumber && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Account Number</span><span className="font-mono font-medium">{account.accountNumber}</span></div>}
                           {account.routingNumber && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Routing Number</span><span className="font-mono font-medium">{account.routingNumber}</span></div>}
                           {account.apy && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">APY</span><span className="font-medium text-green-600 dark:text-green-400">{account.apy}%</span></div>}
                           {account.openingDate && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Opened</span><span className="font-medium">{new Date(account.openingDate).toLocaleDateString()}</span></div>}
                           {account.cardNetwork && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Network</span><span className="font-medium">{account.cardNetwork}</span></div>}
                           {account.last4 && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Card Ending</span><span className="font-mono font-medium">**** {account.last4}</span></div>}
                           {account.expirationDate && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Expires</span><span className="font-mono font-medium">{account.expirationDate}</span></div>}
                       </div>
                   </Card>
               )}
          </div>
      </div>
      
      {/* Recent Transactions Table */}
      <Card className="flex flex-col h-full min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Recent Transactions</h3>
          </div>
          <div className="flex-grow overflow-hidden">
              <TransactionList 
                  transactions={displayTransactionsList} 
                  allCategories={allCategories} 
                  onTransactionClick={onTransactionClick} 
              />
          </div>
      </Card>
    </div>
  );
};

export default GeneralAccountView;
