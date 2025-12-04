
import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, calculateStatementPeriods, getCreditCardStatementDetails, getPreferredTimeZone } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, ReferenceLine } from 'recharts';

interface CreditCardAccountViewProps {
  account: Account;
  displayTransactionsList: DisplayTransaction[];
  transactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  allCategories: Category[];
  onAddTransaction: () => void;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onBack: () => void;
}

const getCardGradient = (id: string) => {
    const gradients = [
        "from-purple-600 to-blue-600",
        "from-pink-500 to-rose-500",
        "from-emerald-500 to-teal-500",
        "from-orange-500 to-amber-500",
        "from-blue-500 to-cyan-500",
        "from-fuchsia-600 to-purple-600",
        "from-indigo-500 to-blue-500",
        "from-red-500 to-orange-500",
        "from-teal-400 to-emerald-600",
        "from-violet-600 to-fuchsia-500"
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return `bg-gradient-to-br ${gradients[index]}`;
};

const CreditCardAccountView: React.FC<CreditCardAccountViewProps> = ({
  account,
  displayTransactionsList,
  transactions,
  allCategories,
  onAddTransaction,
  onTransactionClick,
  onBack
}) => {
  // --- 1. Metrics & Utilization ---
  const creditLimit = account.creditLimit || 0;
  const currentBalance = account.balance; 
  const balanceMagnitude = Math.abs(currentBalance);
  
  const availableCredit = Math.max(0, creditLimit - balanceMagnitude);
  const utilization = creditLimit > 0 ? (balanceMagnitude / creditLimit) * 100 : 0;

  let utilizationColor = 'text-green-500';
  let utilizationBarColor = 'bg-green-500';
  if (utilization > 80) {
    utilizationColor = 'text-red-500';
    utilizationBarColor = 'bg-red-500';
  } else if (utilization > 30) {
    utilizationColor = 'text-yellow-500';
    utilizationBarColor = 'bg-yellow-500';
  }

  // --- 2. Statement Logic ---
  const statementInfo = useMemo(() => {
    if (!account.statementStartDate || !account.paymentDate) return null;
    
    const periods = calculateStatementPeriods(account.statementStartDate, account.paymentDate);
    const { start, end } = periods.current;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let relevantPaymentDate = periods.previous.paymentDue;
    let relevantPeriodLabel = "Previous Statement";
    
    if (today > periods.previous.paymentDue) {
        relevantPaymentDate = periods.current.paymentDue;
        relevantPeriodLabel = "Current Statement";
    }

    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const cycleProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const daysToClose = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysToDue = Math.ceil((relevantPaymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
        start, 
        end, 
        relevantPaymentDate,
        relevantPeriodLabel,
        daysToClose: Math.max(0, daysToClose),
        daysToDue: Math.max(0, daysToDue),
        cycleProgress
    };
  }, [account]);

  // --- 3. Monthly Spending Data ---
  const monthlySpendingData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        
        const startOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
        
        const totalSpent = transactions
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth && t.tx.amount < 0 && !t.tx.transferId)
            .reduce((sum, t) => sum + Math.abs(t.tx.amount), 0);
        
        data.push({ name: monthKey, value: totalSpent });
    }
    return data;
  }, [transactions]);

  const averageMonthlySpend = useMemo(() => {
      const total = monthlySpendingData.reduce((sum, item) => sum + item.value, 0);
      return total / monthlySpendingData.length || 0;
  }, [monthlySpendingData]);

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
      return <span className="font-bold text-xl text-white tracking-widest">CARD</span>;
  };
  
  const timeZone = getPreferredTimeZone();

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'text-gray-600'} bg-current/10 border border-current/20`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || 'credit_card'}</span>
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

      {/* Virtual Card & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 xl:col-span-4">
              <div className={`aspect-[1.586/1] rounded-2xl ${getCardGradient(account.id)} p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-white/20 flex flex-col justify-between group transition-transform hover:scale-[1.02] duration-300`}>
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
          </div>
          <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold uppercase tracking-wider">Current Balance</p>
                          <p className="text-3xl font-bold text-light-text dark:text-dark-text mt-1">{formatCurrency(currentBalance, account.currency)}</p>
                      </div>
                      <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-full text-primary-600 dark:text-primary-400">
                          <span className="material-symbols-outlined">account_balance_wallet</span>
                      </div>
                  </div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-4">Updated today</p>
              </Card>
              <Card className="flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold uppercase tracking-wider">Available Credit</p>
                          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(availableCredit, account.currency)}</p>
                      </div>
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                          <span className="material-symbols-outlined">check_circle</span>
                      </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                       <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Limit: {formatCurrency(creditLimit, account.currency)}</span>
                  </div>
              </Card>
              <Card className="sm:col-span-2">
                  <div className="flex justify-between items-end mb-2">
                      <div>
                          <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs font-bold uppercase tracking-wider">Credit Utilization</p>
                          <p className={`text-3xl font-bold mt-1 ${utilizationColor}`}>{utilization.toFixed(1)}%</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${utilization > 30 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                          {utilization > 30 ? 'High Usage' : 'Healthy Usage'}
                      </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner mt-2">
                      <div className={`h-full ${utilizationBarColor} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(utilization, 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                      <span>0%</span>
                      <span>30% (Recommended)</span>
                      <span>100%</span>
                  </div>
              </Card>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Billing Cycle Timeline */}
          <div className="lg:col-span-2 space-y-8">
              {statementInfo && (
                  <Card>
                      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                              <span className="material-symbols-outlined text-primary-500">date_range</span>
                              Billing Cycle
                          </h3>
                          <span className="text-xs font-bold bg-black/5 dark:bg-white/10 px-3 py-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
                              {statementInfo.daysToClose > 0 ? `${statementInfo.daysToClose} Days Left` : 'Closing Today'}
                          </span>
                      </div>

                      <div className="relative pb-6 px-2">
                          {/* Track Container - Ensuring proper spacing */}
                          <div className="relative h-12 flex items-center">
                                {/* Track Line */}
                                <div className="absolute w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${statementInfo.cycleProgress}%` }}
                                    ></div>
                                </div>

                                {/* Start Marker */}
                                <div className="absolute left-0 w-4 h-4 bg-white dark:bg-dark-card border-4 border-primary-600 rounded-full z-10 shadow-sm"></div>

                                {/* End Marker */}
                                <div className={`absolute right-0 w-4 h-4 bg-white dark:bg-dark-card border-4 rounded-full z-10 shadow-sm ${statementInfo.cycleProgress >= 100 ? 'border-primary-600' : 'border-gray-400 dark:border-gray-500'}`}></div>
                                
                                {/* Today Marker */}
                                <div 
                                    className="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-1000 ease-out"
                                    style={{ left: `${statementInfo.cycleProgress}%`, transform: 'translate(-50%, -50%)' }}
                                >
                                     {/* Tooltip Label */}
                                     <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap flex flex-col items-center">
                                        Today
                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-primary-600 mt-0.5"></div>
                                    </div>
                                    <div className="w-5 h-5 bg-white dark:bg-dark-card rounded-full border-[5px] border-primary-500 shadow-md"></div>
                                </div>
                          </div>

                          {/* Labels Container - Decoupled from the track logic for safer alignment */}
                          <div className="flex justify-between mt-1 w-full">
                              <div className="text-left">
                                   <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-0.5">Open</p>
                                   <p className="text-xs font-bold text-light-text dark:text-dark-text">{statementInfo.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                              </div>
                              <div className="text-right">
                                   <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-0.5">Close</p>
                                   <p className="text-xs font-bold text-light-text dark:text-dark-text">{statementInfo.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                              </div>
                          </div>
                      </div>
                      
                      {/* Next Payment Section */}
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 border border-black/5 dark:border-white/5 mt-4">
                          <div>
                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-bold uppercase tracking-wider mb-1">Next Payment Due</p>
                              <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-red-500">event_busy</span>
                                  <span className="text-lg font-bold text-light-text dark:text-dark-text">
                                      {statementInfo.relevantPaymentDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone })}
                                  </span>
                              </div>
                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                  For {statementInfo.relevantPeriodLabel}
                              </p>
                          </div>
                          
                          <div className="text-right">
                              <p className={`text-2xl font-extrabold ${statementInfo.daysToDue <= 5 ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                                  {statementInfo.daysToDue}
                              </p>
                              <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">days remaining</p>
                          </div>
                      </div>
                  </Card>
              )}

              {/* Monthly Spending Trend */}
              <Card className="h-96 flex flex-col">
                   <div className="flex justify-between items-end mb-6">
                       <div>
                           <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Spending Trend</h3>
                           <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Last 6 months</p>
                       </div>
                       <div className="text-right">
                           <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-0.5">6-Mo Average</p>
                           <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(averageMonthlySpend, account.currency)}</p>
                       </div>
                   </div>
                   
                   <div className="flex-grow w-full min-h-0">
                       <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlySpendingData} margin={{ top: 20, right: 10, left: -10, bottom: 50 }} barSize={36}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12, fontWeight: 500 }} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12, fontWeight: 500 }} 
                                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                                />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(128, 128, 128, 0.05)', radius: 4 }}
                                    contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.05)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', color: 'var(--light-text)' }}
                                    formatter={(value: number) => [formatCurrency(value, account.currency), 'Spent']}
                                    labelStyle={{ color: 'var(--light-text-secondary)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                />
                                <ReferenceLine y={averageMonthlySpend} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.8} strokeWidth={1.5} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {monthlySpendingData.map(entry => (
                                        <Cell
                                            key={entry.name}
                                            fill={entry.value > averageMonthlySpend * 1.1 ? '#F43F5E' : (entry.name === monthlySpendingData[monthlySpendingData.length - 1].name ? '#3B82F6' : '#CBD5E1')}
                                            fillOpacity={entry.name === monthlySpendingData[monthlySpendingData.length - 1].name ? 1 : 0.8}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                       </ResponsiveContainer>
                   </div>
              </Card>
          </div>

          <div className="space-y-8">
              {/* Recent Transactions */}
              <Card className="flex flex-col h-full max-h-[500px]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Recent Activity</h3>
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
      </div>
    </div>
  );
};

export default CreditCardAccountView;
