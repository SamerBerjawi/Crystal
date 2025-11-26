
import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, parseDateAsUTC, convertToEur } from '../utils';
import Card from './Card';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useGoalsContext } from '../contexts/FinancialDataContext';
import { useTransactionsContext, useWarrantsContext } from '../contexts/DomainProviders';

interface InvestmentAccountViewProps {
  account: Account;
  onAddTransaction: () => void;
  onBack: () => void;
}

const InvestmentAccountView: React.FC<InvestmentAccountViewProps> = ({
  account,
  onAddTransaction,
  onBack
}) => {
  const { financialGoals } = useGoalsContext();
  const { investmentTransactions } = useTransactionsContext();
  const { prices } = useWarrantsContext();

  // --- 1. Data Preparation ---
  
  // Filter transactions related to this specific asset (by symbol)
  const assetTransactions = useMemo(() => {
      if (!account.symbol) return [];
      return investmentTransactions
        .filter(t => t.symbol === account.symbol)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [investmentTransactions, account.symbol]);

  // Calculate Holdings & Cost Basis
  const metrics = useMemo(() => {
      let quantity = 0;
      let totalCost = 0;

      // Calculate quantity and cost basis from transactions
      // Note: This assumes FIFO or Average Cost logic isn't strictly required for display, 
      // just total cost of currently held shares.
      // A simple approach: Sum of Buy Costs - Sum of Sell Proceeds (adjusted for remaining quantity?)
      // Better approach for Cost Basis of *current holdings*: Average Cost.
      
      // Re-calculate from scratch in chronological order
      const sortedTx = [...assetTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedTx.forEach(tx => {
          if (tx.type === 'buy') {
              quantity += tx.quantity;
              totalCost += tx.quantity * tx.price;
          } else {
              if (quantity > 0) {
                  const avgCost = totalCost / quantity;
                  totalCost -= tx.quantity * avgCost; // Reduce cost basis proportionally
                  quantity -= tx.quantity;
              }
          }
      });
      
      // Current Value
      const currentPrice = (account.symbol && prices[account.symbol]) ?? (assetTransactions[0]?.price || 0); // Fallback to last transaction price if no live price
      // If manually maintained balance is used (e.g. for non-symbol accounts), use account.balance
      const marketValue = account.symbol ? quantity * currentPrice : account.balance;
      
      const gainLoss = marketValue - totalCost;
      const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

      return { quantity, totalCost, marketValue, gainLoss, gainLossPercent, currentPrice };
  }, [assetTransactions, account, prices]);

  // --- Linked Goals ---
  const linkedGoals = useMemo(() => {
      return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  // --- Chart Data ---
  // Since we don't have historical price API, we can chart the *invested amount* vs time, 
  // or if it's a manual balance account, use the balance history logic.
  // For Symbol-based accounts, we can show a simple line of "Cumulative Quantity" or "Cost Basis" over time
  // as a proxy for activity if we can't show value.
  // OR, if we assume the user updates the balance manually for non-symbol accounts.
  // Let's try to show "Value History" assuming the last known price was constant (flat line) or just show Cost Basis evolution?
  // Better: Just show a simple chart of the *Quantity* over time for now, as value is hard to reconstruct without historical prices.
  
  const performanceData = useMemo(() => {
      const data = [];
      let qty = 0;
      let cost = 0;
      
      const sortedTx = [...assetTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sortedTx.length === 0) return [];

      const startDate = new Date(sortedTx[0].date);
      const today = new Date();
      const endDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      
      let txIndex = 0;
      
      // Daily points
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
           const dateStr = d.toISOString().split('T')[0];
           
           // Process transactions for this day
           while(txIndex < sortedTx.length && sortedTx[txIndex].date === dateStr) {
               const tx = sortedTx[txIndex];
               if (tx.type === 'buy') {
                   qty += tx.quantity;
                   cost += tx.quantity * tx.price;
               } else {
                    if (qty > 0) {
                        const avgCost = cost / qty;
                        cost -= tx.quantity * avgCost;
                        qty -= tx.quantity;
                    }
               }
               txIndex++;
           }
           
           if (d.getDate() % 5 === 0 || d.getTime() === endDate.getTime()) { // Downsample slightly
               data.push({ date: dateStr, quantity: qty, costBasis: cost });
           }
      }
      return data;
  }, [assetTransactions]);
  
  const iconColorClass = useMemo(() => {
    if (account.subType) {
        return INVESTMENT_SUB_TYPE_STYLES[account.subType]?.color;
    }
    return ACCOUNT_TYPE_STYLES.Investment.color;
  }, [account.subType]);


  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center border flex-shrink-0 ${iconColorClass || 'text-indigo-500'} bg-current/10 border-current/20`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || 'show_chart'}</span>
            </div>
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text truncate">{account.name}</h1>
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <span>{account.subType || 'Investment'}</span>
                    {account.symbol && (
                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-bold font-mono">
                            {account.symbol}
                        </span>
                    )}
                </div>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 ml-auto md:ml-0">
          <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Hero Card */}
        <div className="lg:col-span-5 xl:col-span-4">
            <div className="h-full min-h-[280px] bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between group">
                 {/* Decorative Elements */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                 <div className="relative z-10">
                    <p className="text-indigo-100 font-medium text-sm uppercase tracking-widest mb-2">Market Value</p>
                    <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md">
                        {formatCurrency(metrics.marketValue, account.currency)}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                         <span className={`text-lg font-semibold ${metrics.gainLoss >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {metrics.gainLoss >= 0 ? '+' : ''}{formatCurrency(metrics.gainLoss, account.currency)}
                         </span>
                         <span className={`text-sm bg-white/20 px-2 py-0.5 rounded-md ${metrics.gainLoss >= 0 ? 'text-emerald-100' : 'text-rose-100'}`}>
                             {metrics.gainLossPercent.toFixed(2)}%
                         </span>
                    </div>
                 </div>

                 <div className="relative z-10 mt-8 flex justify-between items-end">
                    <div>
                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Quantity</p>
                        <p className="text-2xl font-bold text-white">
                            {metrics.quantity.toLocaleString()}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Current Price</p>
                         <p className="text-xl font-mono font-medium text-white">
                            {formatCurrency(metrics.currentPrice, account.currency)}
                        </p>
                    </div>
                 </div>
            </div>
        </div>

        {/* Metrics & Stats */}
        <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Total Cost Basis</p>
                <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                    {formatCurrency(metrics.totalCost, account.currency)}
                </p>
            </Card>

            <Card>
                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Avg. Buy Price</p>
                <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                    {metrics.quantity > 0 ? formatCurrency(metrics.totalCost / metrics.quantity, account.currency) : '—'}
                </p>
            </Card>

             <Card className="sm:col-span-2 flex flex-col min-h-[250px]">
                <h3 className="text-base font-bold text-light-text dark:text-dark-text mb-4">Holdings Growth (Quantity)</h3>
                <div className="flex-grow w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
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
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
                                labelStyle={{ color: 'var(--light-text)' }}
                                formatter={(val: number) => [val.toLocaleString(), 'Quantity']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Area 
                                type="stepAfter" 
                                dataKey="quantity" 
                                stroke="#6366F1" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorQty)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
             </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-full">
              <Card className="h-full flex flex-col min-h-[500px]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Transactions</h3>
                  </div>
                  <div className="flex-grow overflow-y-auto pr-1">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-light-card dark:bg-dark-card z-10">
                            <tr className="border-b border-black/10 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary">
                                <th className="p-3 font-semibold">Date</th>
                                <th className="p-3 font-semibold">Type</th>
                                <th className="p-3 font-semibold text-right">Quantity</th>
                                <th className="p-3 font-semibold text-right">Price</th>
                                <th className="p-3 font-semibold text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {assetTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <td className="p-3">{parseDateAsUTC(tx.date).toLocaleDateString()}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase ${tx.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono">{tx.quantity}</td>
                                    <td className="p-3 text-right text-light-text-secondary dark:text-dark-text-secondary">
                                        {formatCurrency(tx.price, account.currency)}
                                    </td>
                                    <td className="p-3 text-right font-semibold">
                                        {formatCurrency(tx.quantity * tx.price, account.currency)}
                                    </td>
                                </tr>
                            ))}
                            {assetTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                        No transactions found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                      </table>
                  </div>
              </Card>
          </div>
          
          <div className="lg:col-span-1 space-y-6">
              {/* Linked Goals */}
              <Card>
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-yellow-500">flag</span>
                      Linked Goals
                  </h3>
                  {linkedGoals.length > 0 ? (
                      <div className="space-y-4">
                          {linkedGoals.map(goal => {
                              const progress = goal.amount > 0 ? (goal.currentAmount / goal.amount) * 100 : 0;
                              return (
                                  <div key={goal.id} className="group">
                                      <div className="flex justify-between text-sm font-medium mb-1">
                                          <span className="text-light-text dark:text-dark-text">{goal.name}</span>
                                          <span className="text-light-text-secondary dark:text-dark-text-secondary">{Math.min(progress, 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                                          <div className="bg-yellow-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                      </div>
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-right">
                                          {formatCurrency(goal.currentAmount, 'EUR')} of {formatCurrency(goal.amount, 'EUR')}
                                      </p>
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                          <p>No goals linked to this account.</p>
                          <p className="text-xs mt-1">Edit a goal and set this as the "Payment Account" to see it here.</p>
                      </div>
                  )}
              </Card>
          </div>
      </div>
    </div>
  );
};

export default InvestmentAccountView;
