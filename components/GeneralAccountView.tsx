
import React, { useMemo } from 'react';
import { Account, DisplayTransaction, Category, Transaction } from '../types';
import { formatCurrency, parseDateAsUTC } from '../utils';
import Card from './Card';
import TransactionList from './TransactionList';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    let income = 0;
    let expense = 0;
    
    transactions.forEach(({ tx, parsedDate }) => {
        if (parsedDate >= thirtyDaysAgo) {
            // Use raw amount in account currency to match account balance context
            if (tx.amount > 0) income += tx.amount;
            else expense += Math.abs(tx.amount);
        }
    });
    
    return { income, expense, net: income - expense };
  }, [transactions]);

  const balanceHistory = useMemo(() => {
    const data = [];
    let currentBalance = account.balance;
    const today = new Date();
    // Normalize to midnight
    const endDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    
    // Sort transactions descending (newest first)
    const sortedTxs = [...transactions].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    
    // Map date string to daily change
    const dailyChanges: Record<string, number> = {};
    
    sortedTxs.forEach(({ tx, parsedDate }) => {
         // Normalize date to UTC midnight string YYYY-MM-DD for grouping
         const dateStr = parsedDate.toISOString().split('T')[0];
         dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + tx.amount;
    });

    let iterDate = new Date(endDate);
    
    // We walk backwards from today. 
    // Balance at end of 'iterDate' is 'currentBalance'.
    // Balance at end of 'iterDate - 1' is 'currentBalance' - 'dailyChange of iterDate'.
    
    // Generate 30 days back
    for (let i = 0; i <= 30; i++) {
        const dateStr = iterDate.toISOString().split('T')[0];
        
        data.push({
            date: dateStr,
            value: currentBalance,
        });
        
        // Prepare balance for the previous day
        const change = dailyChanges[dateStr] || 0;
        currentBalance -= change;
        
        iterDate.setDate(iterDate.getDate() - 1);
    }
    
    return data.reverse();
  }, [account.balance, transactions]);

  return (
    <div className="space-y-6 animate-fade-in-up">
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
              <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10">
                 <span className="material-symbols-outlined text-6xl">account_balance_wallet</span>
            </div>
          <div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">Current Balance</p>
            <p className="text-3xl font-bold mt-1 text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p>
          </div>
        </Card>
        
        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">30d Income</p>
                <p className="text-2xl font-bold mt-1 text-green-500">+{formatCurrency(stats.income, account.currency)}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined">trending_up</span>
             </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">30d Expenses</p>
                <p className="text-2xl font-bold mt-1 text-red-500">-{formatCurrency(stats.expense, account.currency)}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <span className="material-symbols-outlined">trending_down</span>
             </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                tickFormatter={(val) => formatCurrency(val, account.currency).replace(/[^0-9.,-]/g, '')} // simplified format
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
          <div className="lg:col-span-1">
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
      </div>
    </div>
  );
};

export default GeneralAccountView;
