
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
    const flowIntensity = income > 0 ? (expenses / income) * 100 : 0;

    return (
        <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/10 shadow-2xl bg-white/40 dark:bg-dark-card/20 backdrop-blur-3xl group h-full relative">
            {/* Ambient Background Blobs */}
            <div className="absolute -left-20 -top-20 w-64 h-64 rounded-full bg-primary-500/10 blur-[100px] pointer-events-none"></div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none"></div>

            <div className="flex flex-col lg:flex-row h-full relative z-10">
                
                {/* --- LEFT: POSITION & WEALTH --- */}
                <div className="lg:w-2/5 p-6 sm:p-8 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/10 flex flex-col justify-between shrink-0">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/30">
                                <span className="material-symbols-outlined text-xl filled-icon">account_balance</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary block leading-none mb-1">
                                    Total Liquidity
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-primary-500"></span>
                                    <span className="text-[9px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em] opacity-80">Net Worth Position</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-light-text dark:text-dark-text tracking-tighter privacy-blur leading-none">
                                {formatCurrency(netWorth, currency as Currency)}
                            </h2>
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <p className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Real-time Verified</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-8">
                         <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Portfolio Velocity</p>
                                <span className="text-[10px] font-mono font-bold text-primary-500">Active</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex p-0.5">
                                <div className="h-full bg-primary-500 rounded-full w-2/3 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                            </div>
                         </div>
                    </div>
                </div>

                {/* --- RIGHT: VELOCITY & FLOW --- */}
                <div className="lg:w-3/5 p-0 flex flex-col relative overflow-hidden transition-all duration-500 min-h-0 h-full bg-white/20 dark:bg-transparent">
                    
                    {/* Top Row: Flow Status Hero */}
                    <div className="p-6 sm:p-8 pb-6 flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-black/5 dark:border-white/5">
                        <div className="flex-grow">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-light-text-secondary dark:text-dark-text-secondary mb-2 block">
                                Capital Flow Efficiency
                            </span>
                            <div className="flex items-baseline gap-3">
                                <h3 className={`text-3xl sm:text-4xl font-black tracking-tighter privacy-blur leading-none ${isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatCurrency(netCashFlow, currency as Currency, { showPlusSign: true })}
                                </h3>
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isPositiveNet ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                    <span className="material-symbols-outlined text-[12px]">{isPositiveNet ? 'trending_up' : 'trending_down'}</span>
                                    {isPositiveNet ? 'Surplus' : 'Deficit'}
                                </div>
                            </div>
                        </div>

                        <div className={`p-4 rounded-[2rem] border backdrop-blur-2xl flex flex-col items-center justify-center min-w-[100px] shadow-xl ${isPositiveNet ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                            <span className="text-2xl font-black leading-none">{Math.abs(savingsRate).toFixed(0)}%</span>
                            <span className="text-[8px] font-black uppercase tracking-widest mt-2 opacity-80 whitespace-nowrap">
                                {savingsRate >= 0 ? 'Savings Factor' : 'Burn Factor'}
                            </span>
                        </div>
                    </div>

                    {/* Middle Row: Intensity Meter */}
                    <div className="px-6 sm:px-8 py-3 bg-black/[0.02] dark:bg-white/[0.02] flex items-center gap-4">
                         <div className="flex-grow">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Transaction Intensity</span>
                                <span className={`text-[9px] font-mono font-bold ${flowIntensity > 100 ? 'text-rose-500' : 'text-primary-500'}`}>{flowIntensity.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex p-0.5">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${isPositiveNet ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-rose-600'}`} 
                                    style={{ width: `${Math.min(flowIntensity, 100)}%` }}
                                ></div>
                            </div>
                         </div>
                    </div>

                    {/* Bottom Row: Granular Stats */}
                    <div className="grid grid-cols-2 divide-x border-t border-black/5 dark:border-white/5 flex-grow min-h-0">
                        {/* Income Stats */}
                        <div className="p-6 sm:p-8 group/stat hover:bg-emerald-500/[0.04] transition-all relative overflow-hidden flex flex-col justify-center">
                             <div className="flex justify-between items-start mb-3 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-500 text-xs font-black">south_east</span>
                                    </div>
                                    <span className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Revenue</span>
                                </div>
                                {incomeChange && (
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full font-mono ${incomeChange.startsWith('+') ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                        {incomeChange}
                                    </span>
                                )}
                             </div>
                             <p className="text-2xl sm:text-3xl font-black text-light-text dark:text-dark-text privacy-blur relative z-10 leading-none mb-4">
                                {formatCurrency(income, currency as Currency)}
                             </p>
                             <div className="h-10 w-full opacity-40 group-hover/stat:opacity-100 transition-opacity">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={incomeSparkline.length > 0 ? incomeSparkline : [{v:10}, {v:15}, {v:12}, {v:20}, {v:18}]}>
                                        <Line type="monotone" dataKey={incomeSparkline.length > 0 ? "value" : "v"} stroke="#10b981" strokeWidth={3} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                             </div>
                        </div>

                        {/* Expense Stats */}
                        <div className="p-6 sm:p-8 group/stat hover:bg-rose-500/[0.04] transition-all relative overflow-hidden flex flex-col justify-center">
                             <div className="flex justify-between items-start mb-3 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-rose-500 text-xs font-black">north_east</span>
                                    </div>
                                    <span className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Outflow</span>
                                </div>
                                {expenseChange && (
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full font-mono ${expenseChange.startsWith('+') ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                        {expenseChange}
                                    </span>
                                )}
                             </div>
                             <p className="text-2xl sm:text-3xl font-black text-light-text dark:text-dark-text privacy-blur relative z-10 leading-none mb-4">
                                {formatCurrency(expenses, currency as Currency)}
                             </p>
                             <div className="h-10 w-full opacity-40 group-hover/stat:opacity-100 transition-opacity">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={expenseSparkline.length > 0 ? expenseSparkline : [{v:20}, {v:12}, {v:25}, {v:15}, {v:22}]}>
                                        <Line type="monotone" dataKey={expenseSparkline.length > 0 ? "value" : "v"} stroke="#f43f5e" strokeWidth={3} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default FinancialOverview;
