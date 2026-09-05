
import React from 'react';
import { formatCurrency } from '../utils';
import { Currency } from '../types';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
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
        <div className="flex flex-col h-full justify-between gap-3 p-0.5">
            {/* --- TOP: POSITION & WEALTH --- */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net worth</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums privacy-blur mt-0.5">
                        {formatCurrency(netWorth, currency as Currency)}
                    </h3>
                </div>

                <div className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wider flex items-center gap-1.5 shrink-0 border ${
                    isPositiveNet 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                }`}>
                    <Icon name={isPositiveNet ? 'trending_up' : 'trending_down'} className="text-sm shrink-0" />
                    <span>{Math.abs(savingsRate).toFixed(0)}% {savingsRate >= 0 ? 'Savings' : 'Burn'} rate</span>
                </div>
            </div>

            {/* --- MIDDLE: PERFORMANCE CARDS --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Net Flow */}
                <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-all">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net flow</span>
                    <p className={`text-base sm:text-lg font-bold tracking-tight tabular-nums privacy-blur mt-1 ${
                        isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                        {formatCurrency(netCashFlow, currency as Currency, { showPlusSign: true, compact: true })}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-2xs font-medium text-slate-500 dark:text-slate-400">
                        <Icon name={isPositiveNet ? 'trending_up' : 'trending_down'} className={`text-xs ${isPositiveNet ? 'text-emerald-500' : 'text-rose-500'}`} />
                        <span>{isPositiveNet ? 'Surplus' : 'Deficit'}</span>
                    </div>
                </div>
                
                {/* Revenue */}
                <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-all group/stat">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Revenue</span>
                    <p className="text-base sm:text-lg font-bold tracking-tight tabular-nums text-slate-900 dark:text-white privacy-blur mt-1">
                        {formatCurrency(income, currency as Currency, { compact: true })}
                    </p>
                    <div className="h-5 w-full mt-2 opacity-60 group-hover/stat:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={incomeSparkline.length > 0 ? incomeSparkline : [{value:10}, {value:15}, {value:12}, {value:20}, {value:18}]}>
                                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Outflow */}
                <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-all group/stat">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Outflow</span>
                    <p className="text-base sm:text-lg font-bold tracking-tight tabular-nums text-slate-900 dark:text-white privacy-blur mt-1">
                        {formatCurrency(expenses, currency as Currency, { compact: true })}
                    </p>
                    <div className="h-5 w-full mt-2 opacity-60 group-hover/stat:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={expenseSparkline.length > 0 ? expenseSparkline : [{value:20}, {value:12}, {value:25}, {value:15}, {value:22}]}>
                                <Line type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* --- BOTTOM: BURN INTENSITY --- */}
            <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                <div className="flex justify-between items-center text-xs mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Burn intensity</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className={`text-xs font-bold tabular-nums ${flowIntensity > 100 ? 'text-rose-500' : 'text-primary-600 dark:text-primary-400'}`}>
                            {flowIntensity.toFixed(0)}%
                        </span>
                    </div>
                    <span className="text-2xs font-medium text-slate-400 dark:text-slate-500">Relative to revenue</span>
                </div>
                <div className="h-2 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex p-0.5">
                    <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                            flowIntensity > 100 
                                ? 'bg-gradient-to-r from-rose-500 to-rose-600' 
                                : 'bg-gradient-to-r from-primary-500 to-indigo-500'
                        }`} 
                        style={{ width: `${Math.max(Math.min(flowIntensity, 100), flowIntensity > 0 ? 3 : 0)}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default FinancialOverview;
