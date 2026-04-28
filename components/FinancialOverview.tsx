
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
        <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/10 shadow-2xl bg-white dark:bg-dark-card/40 backdrop-blur-3xl group h-full">
            <div className="flex flex-col lg:flex-row h-full">
                
                {/* --- LEFT: POSITION & WEALTH --- */}
                <div className="lg:w-2/5 p-4 sm:p-6 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/10 flex flex-col justify-between shrink-0">
                    {/* Background Visual */}
                    <div className="absolute inset-0 z-0 opacity-5 dark:opacity-10 pointer-events-none translate-y-12">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[{v: 30}, {v: 45}, {v: 40}, {v: 60}, {v: 55}, {v: 75}]}>
                                <Area 
                                    type="monotone" 
                                    dataKey="v" 
                                    stroke="#fa9a1d" 
                                    fill="#fa9a1d" 
                                    strokeWidth={4}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 sm:mb-4">
                            <div className="w-8 h-8 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/30">
                                <span className="material-symbols-outlined text-lg filled-icon">account_balance</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary block leading-none">
                                    Current Wealth
                                </span>
                                <span className="text-[8px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mt-0.5 block opacity-80">Net Worth</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-light-text dark:text-dark-text tracking-tighter privacy-blur truncate">
                                {formatCurrency(netWorth, currency as Currency)}
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">Verified Balance</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-4">
                         <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.15em] mb-1">Portfolio Velocity</p>
                                <div className="h-1 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-500 rounded-full w-2/3"></div>
                                </div>
                            </div>
                            <button className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-light-text-secondary hover:text-primary-500 transition-colors">
                                <span className="material-symbols-outlined text-base">north_east</span>
                            </button>
                         </div>
                    </div>
                </div>

                {/* --- RIGHT: VELOCITY & FLOW --- */}
                <div className="lg:w-3/5 p-0 flex flex-col relative overflow-hidden transition-all duration-500 min-h-0 h-full">
                    
                    {/* Top Row: Flow Status Hero - Reduced height */}
                    <div className="p-4 sm:p-6 pb-4 flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-black/5 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01]">
                        <div className="flex-grow">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-1 block">
                                Flow Performance
                            </span>
                            <div className="flex items-baseline gap-2">
                                <h3 className={`text-2xl sm:text-3xl font-black tracking-tighter privacy-blur ${isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatCurrency(netCashFlow, currency as Currency, { showPlusSign: true })}
                                </h3>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isPositiveNet ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {isPositiveNet ? 'Surplus' : 'Deficit'}
                                </span>
                            </div>
                        </div>

                        <div className={`px-4 py-2 rounded-xl border backdrop-blur-xl flex flex-col items-center justify-center min-w-[80px] shadow-sm ${isPositiveNet ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                            <span className="text-xl font-black leading-none">{Math.abs(savingsRate).toFixed(0)}%</span>
                            <span className="text-[8px] font-black uppercase tracking-widest mt-1 opacity-80 whitespace-nowrap">
                                {savingsRate >= 0 ? 'Savings Rate' : 'Burn Rate'}
                            </span>
                        </div>
                    </div>

                    {/* Middle Row: Intensity Meter - Even more compact */}
                    <div className="px-4 sm:px-6 py-2 bg-gray-50/50 dark:bg-white/[0.02]">
                        <div className="flex justify-between items-center mb-1">
                             <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Inbound</span>
                                <span className="text-[8px] font-bold text-emerald-500">100%</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Outward</span>
                                <span className={`text-[8px] font-bold ${flowIntensity > 100 ? 'text-rose-500' : 'text-amber-500'}`}>{flowIntensity.toFixed(0)}%</span>
                             </div>
                        </div>
                        <div className="h-2 w-full bg-gray-200 dark:bg-black/20 rounded-full overflow-hidden flex p-0.5 border border-black/5 dark:border-white/5">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${isPositiveNet ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-rose-600'}`} 
                                style={{ width: `${Math.min(flowIntensity, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Bottom Row: Granular Stats with Sparklines */}
                    <div className="grid grid-cols-2 divide-x border-t border-black/5 dark:border-white/5 flex-grow min-h-0">
                        {/* Income Stats */}
                        <div className="p-4 sm:p-5 group/stat hover:bg-emerald-500/[0.02] transition-colors relative overflow-hidden flex flex-col justify-center">
                             <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-[10px] font-black">south_east</span>
                                    <span className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Revenue</span>
                                </div>
                                {incomeChange && (
                                    <span className={`text-[8px] font-black px-1 py-0.5 rounded ${incomeChange.startsWith('+') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30'}`}>
                                        {incomeChange}
                                    </span>
                                )}
                             </div>
                             <p className="text-xl sm:text-2xl font-black text-light-text dark:text-dark-text privacy-blur relative z-10 leading-none">
                                {formatCurrency(income, currency as Currency)}
                             </p>
                             <div className="h-8 w-full mt-2 opacity-40 group-hover/stat:opacity-80 transition-opacity">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={incomeSparkline.length > 0 ? incomeSparkline : [{v:10}, {v:15}, {v:12}, {v:20}, {v:18}]}>
                                        <Line type="monotone" dataKey={incomeSparkline.length > 0 ? "value" : "v"} stroke="#10b981" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                             </div>
                        </div>

                        {/* Expense Stats */}
                        <div className="p-4 sm:p-5 group/stat hover:bg-rose-500/[0.02] transition-colors relative overflow-hidden flex flex-col justify-center">
                             <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-rose-500 text-[10px] font-black">north_east</span>
                                    <span className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Outflow</span>
                                </div>
                                {expenseChange && (
                                    <span className={`text-[8px] font-black px-1 py-0.5 rounded ${expenseChange.startsWith('+') ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'}`}>
                                        {expenseChange}
                                    </span>
                                )}
                             </div>
                             <p className="text-xl sm:text-2xl font-black text-light-text dark:text-dark-text privacy-blur relative z-10 leading-none">
                                {formatCurrency(expenses, currency as Currency)}
                             </p>
                             <div className="h-8 w-full mt-2 opacity-40 group-hover/stat:opacity-80 transition-opacity">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={expenseSparkline.length > 0 ? expenseSparkline : [{v:20}, {v:12}, {v:25}, {v:15}, {v:22}]}>
                                        <Line type="monotone" dataKey={expenseSparkline.length > 0 ? "value" : "v"} stroke="#f43f5e" strokeWidth={2} dot={false} />
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
