import React, { useMemo } from 'react';
import { Account, Transaction, DisplayTransaction, Category } from '../types';
import { formatCurrency, calculateStatementPeriods, getCreditCardStatementDetails, getPreferredTimeZone } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

interface CreditCardAccountViewProps {
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

const CreditCardAccountView: React.FC<CreditCardAccountViewProps> = ({
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
  const timeZone = getPreferredTimeZone();

  // --- Metrics ---
  const { totalSpent, totalPayments, utilization, availableCredit } = useMemo(() => {
      let spent = 0;
      let payments = 0;
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      transactions.forEach(({ tx, parsedDate, convertedAmount }) => {
          if (parsedDate >= startOfMonth) {
              if (tx.type === 'expense') {
                  spent += Math.abs(convertedAmount);
              } else if (tx.type === 'income') {
                  payments += convertedAmount;
              }
          }
      });
      
      const creditLimit = account.creditLimit || 0;
      const balance = Math.abs(account.balance);
      const util = creditLimit > 0 ? (balance / creditLimit) * 100 : 0;
      const available = Math.max(0, creditLimit - balance);

      return { totalSpent: spent, totalPayments: payments, utilization: util, availableCredit: available };
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
            .filter(t => t.parsedDate >= startOfMonth && t.parsedDate <= endOfMonth && t.tx.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.convertedAmount), 0);
        
        data.push({ name: monthKey, value: total });
    }
    return data;
  }, [transactions]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
              <span className="material-symbols-outlined text-4xl">{account.icon || 'credit_card'}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-light-text dark:text-dark-text tracking-tight truncate">{account.name}</h1>
                  {account.cardNetwork && <span className="text-xs font-bold uppercase bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">{account.cardNetwork}</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">
                <span>Credit Card</span>
                {account.last4 && <span>• Ends in {account.last4}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0 ml-auto md:ml-0">
             {isLinkedToEnableBanking && onSyncLinkedAccount && (
                <button onClick={onSyncLinkedAccount} className={BTN_SECONDARY_STYLE}>Sync</button>
             )}
            <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE}`}>
                <span className="material-symbols-outlined text-lg mr-2">add</span>
                Add Transaction
            </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[240px]">
               <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                   <span className="material-symbols-outlined text-9xl">credit_card</span>
               </div>
               
               <div className="relative z-10 flex justify-between items-start">
                    <div>
                         <p className="text-orange-100 font-bold uppercase tracking-widest text-xs mb-2">Current Balance</p>
                         <h2 className="text-5xl font-extrabold tracking-tight drop-shadow-sm">{formatCurrency(account.balance, account.currency)}</h2>
                    </div>
                    {account.creditLimit && (
                        <div className="text-right">
                             <p className="text-orange-100 font-bold uppercase tracking-widest text-xs mb-1">Available</p>
                             <p className="text-2xl font-bold opacity-90">{formatCurrency(availableCredit, account.currency)}</p>
                        </div>
                    )}
               </div>

               <div className="relative z-10 mt-8">
                    {account.creditLimit && (
                        <>
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-orange-100">
                                <span>Utilization</span>
                                <span>{utilization.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-3 overflow-hidden">
                                <div className={`h-full ${utilization > 80 ? 'bg-white' : 'bg-white/80'}`} style={{ width: `${Math.min(100, utilization)}%` }}></div>
                            </div>
                        </>
                    )}
                    {!account.creditLimit && (
                        <p className="text-sm text-orange-100 italic">No credit limit set.</p>
                    )}
               </div>
          </div>

          {/* Monthly Stats */}
          <Card className="flex flex-col justify-center gap-6">
               <div className="flex items-center justify-between">
                   <div>
                       <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Spent (30d)</p>
                       <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalSpent, account.currency)}</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                       <span className="material-symbols-outlined">shopping_cart</span>
                   </div>
               </div>
               <div className="w-full h-px bg-black/5 dark:bg-white/5"></div>
               <div className="flex items-center justify-between">
                   <div>
                       <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Payments (30d)</p>
                       <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalPayments, account.currency)}</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                       <span className="material-symbols-outlined">payments</span>
                   </div>
               </div>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Spending Trend */}
          <div className="lg:col-span-2">
               <Card className="h-[350px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Spending History</h3>
                    </div>
                    <div className="flex-grow w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={spendingHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} tickFormatter={(val) => `${val}`} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(128, 128, 128, 0.05)', radius: 4 }}
                                    contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.05)', borderRadius: '12px' }}
                                    formatter={(value: number) => [formatCurrency(value, account.currency), 'Spent']}
                                />
                                <Bar dataKey="value" fill="#F97316" radius={[4, 4, 0, 0]} barSize={40}>
                                    {spendingHistory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === spendingHistory.length - 1 ? '#EA580C' : '#F97316'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
               </Card>
          </div>

          {/* Right Column: Statement Details */}
          <div className="space-y-8">
               <Card>
                   <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-4 border-b border-black/5 dark:border-white/5 pb-2">
                       Statement Config
                   </h3>
                   <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Statement Cycle</span>
                            <span className="font-medium text-light-text dark:text-dark-text">
                                {account.statementStartDate ? `Day ${account.statementStartDate}` : 'Not Set'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Payment Due</span>
                            <span className="font-medium text-light-text dark:text-dark-text">
                                {account.paymentDate ? `Day ${account.paymentDate}` : 'Not Set'}
                            </span>
                        </div>
                         {account.settlementAccountId && (
                            <div className="flex justify-between items-center pt-2 border-t border-black/5 dark:border-white/5">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Auto-Pay From</span>
                                <span className="font-medium text-primary-500 truncate max-w-[120px]">Linked Account</span>
                            </div>
                        )}
                   </div>
               </Card>
          </div>
      </div>

      {/* Recent Transactions */}
      <Card className="flex flex-col h-full max-h-[500px] !p-0">
          <div className="flex justify-between items-center p-4 border-b border-black/5 dark:border-white/5">
              <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Recent Activity</h3>
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

export default CreditCardAccountView;