
import React from 'react';
import { formatCurrency } from '../utils';
import Card from './Card';
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Currency } from '../types';

interface CashFlowCardProps {
  income: number;
  expenses: number;
  incomeChange?: string | null;
  expenseChange?: string | null;
  incomeSparkline: { value: number }[];
  expenseSparkline: { value: number }[];
  netBalance: number;
  currency?: Currency;
  duration: string;
}

const CashFlowCard: React.FC<CashFlowCardProps> = ({
  income,
  expenses,
  incomeChange,
  expenseChange,
  incomeSparkline,
  expenseSparkline,
  netBalance,
  currency = 'EUR',
  duration
}) => {
  const savingsRate = income > 0 ? (netBalance / income) * 100 : 0;
  const expenseRatio = income > 0 ? (expenses / income) * 100 : 0;
  const isPositiveNet = netBalance >= 0;
  
  // Color Logic
  let savingsColorClass = 'text-green-600 dark:text-green-400';
  let savingsBgClass = 'bg-green-100 dark:bg-green-900/30';
  
  if (savingsRate < 0) {
      savingsColorClass = 'text-red-600 dark:text-red-400';
      savingsBgClass = 'bg-red-100 dark:bg-red-900/30';
  } else if (savingsRate < 20) {
      savingsColorClass = 'text-yellow-600 dark:text-yellow-400';
      savingsBgClass = 'bg-yellow-100 dark:bg-yellow-900/30';
  }

  const StatBlock = ({ 
    label, 
    amount, 
    change, 
    data, 
    color 
  }: { 
    label: string; 
    amount: number; 
    change?: string | null; 
    data: { value: number }[]; 
    color: string 
  }) => {
      const isGreen = color === 'green';
      const textColor = isGreen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
      const strokeColor = isGreen ? '#10B981' : '#F43F5E';

      return (
        <div className="flex flex-col h-full justify-between">
            <div>
                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">{label}</p>
                <p className={`text-xl font-bold ${textColor}`}>
                    {formatCurrency(amount, currency as Currency)}
                </p>
                {change && (
                    <p className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        <span className={change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>{change}</span> vs prev.
                    </p>
                )}
            </div>
            <div className="h-10 w-full mt-2 opacity-60">
                 <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={data}>
                        <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={strokeColor} 
                            strokeWidth={2} 
                            dot={false} 
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      );
  };

  return (
    <Card className="h-full flex flex-col justify-between p-0 overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm">
        {/* Header: Net Balance */}
        <div className="p-5 pb-3">
             <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Net Cash Flow</p>
                    <h3 className={`text-3xl font-extrabold tracking-tight ${isPositiveNet ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
                        {formatCurrency(netBalance, currency as Currency, { showPlusSign: true })}
                    </h3>
                </div>
                <div className={`px-3 py-1 rounded-lg flex flex-col items-center justify-center ${savingsBgClass}`}>
                    <span className={`text-lg font-bold ${savingsColorClass}`}>{savingsRate.toFixed(0)}%</span>
                    <span className={`text-[10px] font-bold uppercase ${savingsColorClass} opacity-80`}>Savings</span>
                </div>
             </div>

             {/* Visualization Bar */}
             <div className="mt-4">
                <div className="flex justify-between text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                    <span>Out {Math.min(expenseRatio, 100).toFixed(0)}%</span>
                    <span>In 100%</span>
                </div>
                <div className="w-full h-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-full overflow-hidden flex">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(expenseRatio, 100)}%` }}></div>
                </div>
             </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-black/5 dark:bg-white/5"></div>

        {/* Bottom Grid: Income vs Expense */}
        <div className="grid grid-cols-2 divide-x divide-black/5 dark:divide-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex-grow">
            <div className="p-4">
                <StatBlock 
                    label="Income" 
                    amount={income} 
                    change={incomeChange} 
                    data={incomeSparkline} 
                    color="green" 
                />
            </div>
            <div className="p-4">
                <StatBlock 
                    label="Expenses" 
                    amount={expenses} 
                    change={expenseChange} 
                    data={expenseSparkline} 
                    color="red" 
                />
            </div>
        </div>
    </Card>
  );
};

export default CashFlowCard;
