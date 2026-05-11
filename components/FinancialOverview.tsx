
import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from 'recharts';

interface FinancialOverviewProps {
    netWorth: number;
    income: number;
    expenses: number;
    incomeChange?: string | null;
    expenseChange?: string | null;
    incomeSparkline?: { value: number }[];
    expenseSparkline?: { value: number }[];
    currency?: Currency;
}

const FinancialOverview: React.FC<FinancialOverviewProps> = ({ 
    netWorth, 
    income, 
    expenses, 
    incomeChange, 
    expenseChange,
    incomeSparkline = [],
    expenseSparkline = [],
    currency = 'EUR' 
}) => {
    const netCashFlow = income - expenses;
    const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;
    const isPositiveNet = netCashFlow >= 0;
    const flowIntensity = income > 0 ? (expenses / income) * 100 : (expenses > 0 ? 100 : 0);

    return (
        <div className="!p-0 overflow-hidden group h-full">
            <div className="flex flex-col h-full">
                
                {/* --- TOP: POSITION & WEALTH --- */}
                <div className="p-4 sm:p-6 border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/[0.02]">
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary-500 text-sm">account_balance</span>
                                 <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Net worth</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-semibold text-light-text dark:text-dark-text tracking-tighter privacy-blur truncate leading-tight">
                                {formatCurrency(netWorth, currency as Currency)}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                <p className="text-[9px] font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/80 tracking-wider">Verified balance</p>
                            </div>
                        </div>

                        <div className={`px-3 py-2 rounded-2xl border backdrop-blur-xl flex flex-col items-center justify-center min-w-[75px] shadow-sm ${isPositiveNet ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                            <span className="text-xl font-semibold leading-none">{Math.abs(savingsRate).toFixed(0)}%</span>
                            <span className="text-[8px] font-semibold tracking-wider mt-1 opacity-80 whitespace-nowrap">
                                {savingsRate >= 0 ? 'Savings' : 'Burn'} rate
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- MIDDLE: PERFORMANCE GRID --- */}
                 <div className="grid grid-cols-3 divide-x divide-black/5 dark:divide-white/5 border-b border-black/5 dark:border-white/5 flex-grow min-h-[100px]">
                     {/* Flow */}
                     <div className="p-4 flex flex-col justify-center">
                         <span className="text-[9px] font-semibold tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block">Net flow</span>
                         <h3 className={`text-xl font-semibold tracking-tighter privacy-blur leading-none ${isPositiveNet ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {formatCurrency(netCashFlow, currency as Currency, { showPlusSign: true, compact: true })}
                         </h3>
                         <div className="mt-2 flex items-center gap-1.5">
                             <span className={`material-symbols-outlined text-xs ${isPositiveNet ? 'text-emerald-500' : 'text-rose-500'}`}>
                                 {isPositiveNet ? 'trending_up' : 'trending_down'}
                             </span>
                             <span className="text-[8px] font-semibold tracking-wider opacity-40">{isPositiveNet ? 'Surplus' : 'Deficit'}</span>
                         </div>
                     </div>
                     
                     {/* Income */}
                     <div className="p-4 flex flex-col justify-center group/stat hover:bg-emerald-500/[0.02] transition-colors relative overflow-hidden">
                        <div className="flex justify-between items-center mb-1.5 relative z-10">
                             <span className="text-[9px] font-semibold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/90">Revenue</span>
                             {incomeChange && (
                                <span className={`text-[9px] font-semibold ${incomeChange.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {incomeChange}
                                </span>
                             )}
                        </div>
                        <p className="text-xl font-semibold text-light-text dark:text-dark-text privacy-blur relative z-10 leading-none">
                            {formatCurrency(income, currency as Currency, { compact: true })}
                        </p>
                        <div className="h-6 w-full mt-3 opacity-30 group-hover/stat:opacity-80 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={incomeSparkline.length > 0 ? incomeSparkline : [{v:10}, {v:15}, {v:12}, {v:20}, {v:18}]}>
                                    <Line type="monotone" dataKey={incomeSparkline.length > 0 ? "value" : "v"} stroke="#10b981" strokeWidth={1.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                     </div>

                     {/* Expenses */}
                     <div className="p-4 flex flex-col justify-center group/stat hover:bg-rose-500/[0.02] transition-colors relative overflow-hidden">
                        <div className="flex justify-between items-center mb-1.5 relative z-10">
                             <span className="text-[9px] font-semibold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/90">Outflow</span>
                             {expenseChange && (
                                <span className={`text-[9px] font-semibold ${expenseChange.startsWith('+') ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {expenseChange}
                                </span>
                             )}
                        </div>
                        <p className="text-xl font-semibold text-light-text dark:text-dark-text privacy-blur relative z-10 leading-none">
                            {formatCurrency(expenses, currency as Currency, { compact: true })}
                        </p>
                        <div className="h-6 w-full mt-3 opacity-30 group-hover/stat:opacity-80 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={expenseSparkline.length > 0 ? expenseSparkline : [{v:20}, {v:12}, {v:25}, {v:15}, {v:22}]}>
                                    <Line type="monotone" dataKey={expenseSparkline.length > 0 ? "value" : "v"} stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                     </div>
                </div>

                {/* --- BOTTOM: INTENSITY & VELOCITY --- */}
                <div className="px-6 py-4 bg-gray-50/50 dark:bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-2">
                         <div className="flex items-center gap-2">
                             <span className="text-[9px] font-semibold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/90">Burn intensity</span>
                             <div className="w-1 h-1 rounded-full bg-light-text-secondary/20"></div>
                             <span className={`text-[9px] font-semibold ${flowIntensity > 100 ? 'text-rose-500' : 'text-primary-500'}`}>{flowIntensity.toFixed(0)}%</span>
                         </div>
                         <span className="text-[8px] font-semibold text-light-text-secondary/40 tracking-wider">Relative to income</span>
                    </div>
                    <div className="h-2 w-full bg-black/5 dark:bg-black/20 rounded-full overflow-hidden flex border border-black/5 dark:border-white/5 p-0.5">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${isPositiveNet ? 'bg-gradient-to-r from-primary-600 to-primary-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'}`} 
                            style={{ width: `${Math.max(Math.min(flowIntensity, 100), flowIntensity > 0 ? 2 : 0)}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialOverview;
