
import React, { useMemo } from 'react';
import { Account, DisplayTransaction, Category, Transaction, RecurringTransaction } from '../types';
import { formatCurrency, parseDateAsUTC, generateSyntheticLoanPayments, generateSyntheticCreditCardPayments } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, Legend } from 'recharts';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';

interface GeneralAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
}

const GeneralAccountView: React.FC<GeneralAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack
}) => {
  const { recurringTransactions, billsAndPayments, loanPaymentOverrides } = useScheduleContext();
  const { accounts } = useAccountsContext();
  const { transactions: allTransactions } = useTransactionsContext();

  // --- 1. Key Metrics Calculations ---

  // Helper: Get transactions for specific timeframes
  const getTransactionsInDateRange = (startDate: Date, endDate: Date) => {
    return transactions.filter(t => t.parsedDate >= startDate && t.parsedDate <= endDate);
  };

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // A. Lowest Balance (Last 30 Days)
    let currentBalance = account.balance;
    let lowestBalance = currentBalance;
    const sortedTxsDesc = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    
    // Replay backwards to find history
    // We only care about the last 30 days for the lowest point
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // We need to process transactions from NOW backwards to 30 days ago
    // balance[t-1] = balance[t] - amount[t]
    for (const { tx } of sortedTxsDesc) {
        const txDate = parseDateAsUTC(tx.date);
        if (txDate < thirtyDaysAgo) break; // Optimization
        
        // If tx was today or earlier, it affected the current balance.
        // Walking back: subtract the transaction amount to get the state *before* it happened.
        // Check min balance at each step.
        if (txDate <= todayStart) {
             lowestBalance = Math.min(lowestBalance, currentBalance);
             currentBalance -= tx.amount; // Reverse the transaction
        }
    }
    // One final check for the start of the 30d period
    lowestBalance = Math.min(lowestBalance, currentBalance);


    // B. Average Monthly Spend (Last 3 Months)
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


    // C. Safe to Spend (Balance - Upcoming Payments in next 7 days)
    // Identify upcoming scheduled items
    const next7Days = new Date(todayStart);
    next7Days.setDate(next7Days.getDate() + 7);
    
    let upcomingOutflows = 0;
    const upcomingItems: { date: Date, description: string, amount: number }[] = [];

    // 1. Recurring
    const relevantRecurring = recurringTransactions.filter(rt => 
        rt.accountId === account.id && (rt.type === 'expense' || rt.type === 'transfer')
    );
    
    // Add synthetic payments (loans, etc)
    const syntheticLoans = generateSyntheticLoanPayments(accounts, allTransactions, loanPaymentOverrides).filter(rt => rt.accountId === account.id);
    const syntheticCC = generateSyntheticCreditCardPayments(accounts, allTransactions).filter(rt => rt.accountId === account.id);
    
    [...relevantRecurring, ...syntheticLoans, ...syntheticCC].forEach(rt => {
        let nextDue = parseDateAsUTC(rt.nextDueDate);
        const interval = rt.frequencyInterval || 1;
        
        // Check occurrences within next 30 days (for list) and 7 days (for safe-to-spend)
        while (nextDue <= next7Days) { // Optimization: just check near future for metric
             if (nextDue >= todayStart) {
                 upcomingOutflows += rt.amount;
             }
             // Advance
             if (rt.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + interval);
             else if (rt.frequency === 'weekly') nextDue.setDate(nextDue.getDate() + (7 * interval));
             else if (rt.frequency === 'daily') nextDue.setDate(nextDue.getDate() + interval);
             else if (rt.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + interval);
             else break; // safety
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

    const safeToSpend = account.balance - upcomingOutflows;

    return { lowestBalance, avgMonthlySpend, safeToSpend };
  }, [account, transactions, recurringTransactions, billsAndPayments, accounts, allTransactions, loanPaymentOverrides]);


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

  // Balance History (30 Days) - Reusing existing logic
  const balanceHistory = useMemo(() => {
    const data = [];
    let currentBalance = account.balance;
    const today = new Date();
    const endDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const sortedTxs = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    const dailyChanges: Record<string, number> = {};
    
    sortedTxs.forEach(({ tx, parsedDate }) => {
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
  }, [account.balance, transactions]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 w-full">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'bg-gray-200 text-gray-600'} bg-opacity-10 border border-current`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || 'wallet'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                  {account.financialInstitution && (
                      <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                          {account.financialInstitution}
                      </span>
                  )}
              </div>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span>{account.type}</span>
                {account.last4 && <><span>•</span><span className="font-mono">**** {account.last4}</span></>}
              </div>
            </div>
            <div className="ml-auto">
              <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
            </div>
          </div>
        </div>
      </header>

      {/* Grid 1: Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

        {/* Lowest Balance */}
        <Card>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Lowest Balance (30d)</p>
                    <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(metrics.lowestBalance, account.currency)}</p>
                </div>
                {metrics.lowestBalance < 0 && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-600" title="Overdraft detected">
                        <span className="material-symbols-outlined text-lg">trending_down</span>
                    </div>
                )}
            </div>
        </Card>
      </div>

      {/* Grid 2: Cash Flow Trend + Upcoming Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-full">
              <Card className="h-full flex flex-col min-h-[320px]">
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Monthly Cash Flow (6 Months)</h3>
                  <div className="flex-grow w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} tickFormatter={(val) => `${val/1000}k`} width={30} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
                                cursor={{fill: 'transparent'}}
                                formatter={(val: number) => formatCurrency(val, account.currency)}
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                            <Bar dataKey="income" name="Money In" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="expense" name="Money Out" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
              </Card>
          </div>
          <div className="lg:col-span-1 h-full">
              <Card className="h-full flex flex-col">
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Upcoming Payments</h3>
                  <div className="flex-grow overflow-y-auto max-h-[250px] space-y-3 pr-1">
                      {upcomingPayments.length > 0 ? upcomingPayments.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                  <div className="bg-light-fill dark:bg-dark-fill w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs flex-shrink-0">
                                      <span className="font-bold text-light-text dark:text-dark-text">{parseDateAsUTC(item.date).getDate()}</span>
                                      <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary">{parseDateAsUTC(item.date).toLocaleString('default', { month: 'short' })}</span>
                                  </div>
                                  <div className="min-w-0">
                                      <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">{item.description}</p>
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.isRecurring ? 'Recurring' : 'Bill'}</p>
                                  </div>
                              </div>
                              <p className="text-sm font-semibold text-light-text dark:text-dark-text whitespace-nowrap">{formatCurrency(item.amount, account.currency)}</p>
                          </div>
                      )) : (
                          <div className="h-full flex flex-col items-center justify-center text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                              <span className="material-symbols-outlined text-4xl mb-2">event_available</span>
                              <p className="text-sm">No upcoming payments.</p>
                          </div>
                      )}
                  </div>
              </Card>
          </div>
      </div>

      {/* Grid 3: Top Categories + Balance History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-1 h-full">
              <Card className="h-full flex flex-col min-h-[300px]">
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Top Spending (30d)</h3>
                  <div className="flex-grow space-y-4 overflow-y-auto max-h-[250px] pr-1">
                      {topCategories.length > 0 ? topCategories.map((cat, idx) => (
                          <div key={idx}>
                              <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium text-light-text dark:text-dark-text">{cat.name}</span>
                                  <span className="text-light-text dark:text-dark-text">{formatCurrency(cat.value, account.currency)}</span>
                              </div>
                              <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${(cat.value / topCategories[0].value) * 100}%`, backgroundColor: cat.color }}></div>
                              </div>
                          </div>
                      )) : (
                          <div className="h-full flex flex-col items-center justify-center text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                              <span className="material-symbols-outlined text-4xl mb-2">pie_chart</span>
                              <p className="text-sm">No spending data.</p>
                          </div>
                      )}
                  </div>
              </Card>
           </div>
           <div className="lg:col-span-2 h-full">
                <Card className="h-full flex flex-col min-h-[300px]">
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Balance History (30 Days)</h3>
                    <div className="flex-grow w-full h-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={balanceHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                                    minTickGap={30}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false}
                                    tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                                    tickFormatter={(val) => formatCurrency(val, account.currency).replace(/[^0-9.,-]/g, '')} 
                                    width={60}
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
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorBalance)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
           </div>
      </div>

      {/* Grid 4: Recent Transactions */}
      <Card className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Recent Transactions</h3>
        </div>
        <div className="flex-grow overflow-hidden">
            <TransactionList 
                transactions={displayTransactionsList.slice(0, 8)} 
                allCategories={allCategories} 
                onTransactionClick={onTransactionClick} 
            />
        </div>
     </Card>
    </div>
  );
};

export default GeneralAccountView;
