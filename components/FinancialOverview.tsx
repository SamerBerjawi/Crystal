
import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from 'recharts';
import Icon from './ui/Icon';

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
                <div className="p-4 sm:p-6 border-b border-slate-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1.5">
                                 <div className="w-6 h-6 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-500 flex items-center justify-center">
                                    <Icon name="Bank" className="text-xs" />
                                 </div>
                                 <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net worth</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-mono privacy-blur truncate leading-tight">
                                {formatCurrency(netWorth, currency as Currency)}
                            </h2>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Telemetry verified</p>
                            </div>
                        </div>

                        <div className={`px-3 py-2 rounded-2xl border backdrop-blur-xl flex flex-col items-center justify-center min-w-[80px] shadow-xs self-end sm:self-auto ${isPositiveNet ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'}`}>
                            <span className="text-xl font-black font-mono leading-none">{Math.abs(savingsRate).toFixed(0)}%</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider mt-1 whitespace-nowrap">
                                {savingsRate >= 0 ? 'Savings' : 'Burn'} rate
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- MIDDLE: PERFORMANCE GRID --- */}
                 <div className="grid grid-cols-3 divide-x divide-slate-200/60 dark:divide-white/5 border-b border-slate-200/60 dark:border-white/5 flex-grow min-h-[100px]">
                     {/* Flow */}
                     <div className="p-3 sm:p-4 flex flex-col justify-center glass-tile">
                         <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">Net flow</span>
                         <h3 className={`text-base sm:text-xl font-black font-mono tracking-tight privacy-blur leading-none ${isPositiveNet ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {formatCurrency(netCashFlow, currency as Currency, { showPlusSign: true, compact: true })}
                         </h3>
                         <div className="mt-2.5 flex items-center gap-1.5">
                             <Icon name={isPositiveNet ? 'trending_up' : 'trending_down'} className={`text-xs ${isPositiveNet ? 'text-emerald-500' : 'text-rose-500'}`} />
                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{isPositiveNet ? 'Surplus' : 'Deficit'}</span>
                         </div>
                     </div>
                     
                     {/* Income */}
                     <div className="p-3 sm:p-4 flex flex-col justify-center glass-tile group/stat hover:bg-emerald-500/[0.04] transition-colors relative overflow-hidden">
                        <div className="flex justify-between items-center mb-1.5 relative z-10">
                             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Revenue</span>
                        </div>
                        <p className="text-base sm:text-xl font-black font-mono text-slate-900 dark:text-white tracking-tight privacy-blur relative z-10 leading-none">
                            {formatCurrency(income, currency as Currency, { compact: true })}
                        </p>
                        <div className="h-4 sm:h-6 w-full mt-2 sm:mt-2.5 opacity-40 group-hover/stat:opacity-90 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={incomeSparkline.length > 0 ? incomeSparkline : [{value:10}, {value:15}, {value:12}, {value:20}, {value:18}]}>
                                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1.75} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                     </div>

                     {/* Expenses */}
                     <div className="p-3 sm:p-4 flex flex-col justify-center glass-tile group/stat hover:bg-rose-500/[0.04] transition-colors relative overflow-hidden">
                        <div className="flex justify-between items-center mb-1.5 relative z-10">
                             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Outflow</span>
                        </div>
                        <p className="text-base sm:text-xl font-black font-mono text-slate-900 dark:text-white tracking-tight privacy-blur relative z-10 leading-none">
                            {formatCurrency(expenses, currency as Currency, { compact: true })}
                        </p>
                        <div className="h-4 sm:h-6 w-full mt-2 sm:mt-2.5 opacity-40 group-hover/stat:opacity-90 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={expenseSparkline.length > 0 ? expenseSparkline : [{value:20}, {value:12}, {value:25}, {value:15}, {value:22}]}>
                                    <Line type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={1.75} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                     </div>
                </div>

                {/* --- BOTTOM: INTENSITY & VELOCITY --- */}
                <div className="px-5 py-3.5 glass-subwell">
                    <div className="flex justify-between items-center mb-2">
                         <div className="flex items-center gap-2">
                             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Burn intensity</span>
                             <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                             <span className={`text-xs font-bold font-mono ${flowIntensity > 100 ? 'text-rose-500' : 'text-primary-500'}`}>{flowIntensity.toFixed(0)}%</span>
                         </div>
                         <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Relative to revenue</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200/70 dark:bg-black/40 rounded-full overflow-hidden flex border border-slate-300/40 dark:border-white/5 p-0.5">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out shadow-xs ${isPositiveNet ? 'bg-gradient-to-r from-primary-600 to-primary-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'}`} 
                            style={{ width: `${Math.max(Math.min(flowIntensity, 100), flowIntensity > 0 ? 2 : 0)}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialOverview;
