
import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';

interface FinancialOverviewProps {
    netWorth: number;
    income: number;
    expenses: number;
    incomeChange?: string | null;
    expenseChange?: string | null;
    currency?: Currency;
}

const FinancialOverview: React.FC<FinancialOverviewProps> = ({ 
    netWorth, 
    income, 
    expenses, 
    incomeChange, 
    expenseChange, 
    currency = 'EUR' 
}) => {
    const netCashFlow = income - expenses;
    // Savings rate is Net Flow / Income
    const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;
    const expenseRatio = income > 0 ? (expenses / income) * 100 : 0;
    
    const isPositiveNet = netCashFlow >= 0;

    return (
        <Card className="p-0 overflow-hidden border border-black/5 dark:border-white/5 shadow-sm bg-white dark:bg-dark-card">
            <div className="flex flex-col lg:flex-row h-full">
                
                {/* LEFT COLUMN: Net Worth (The Foundation) */}
                <div className="lg:w-1/3 p-5 border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5">
                    <div className="h-full p-6 rounded-2xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col justify-between relative overflow-hidden group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors duration-300">
                        
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-primary-500 border border-black/5 dark:border-white/5">
                                    <span className="material-symbols-outlined text-xl">savings</span>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Net Worth</span>
                            </div>
                            
                            <h2 className="text-3xl font-extrabold tracking-tight text-light-text dark:text-dark-text mb-1 privacy-blur">
                                {formatCurrency(netWorth, currency as Currency)}
                            </h2>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">Total Assets - Liabilities</p>
                        </div>

                        <div className="relative z-10 mt-8">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white dark:bg-white/10 border border-black/5 dark:border-white/5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Live Snapshot</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Cash Flow (The Pulse) */}
                <div className="lg:w-2/3 p-5 flex flex-col justify-between">
                    
                    {/* Top Row: Net Flow & Savings Badge */}
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Net Cash Flow</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-extrabold privacy-blur ${isPositiveNet ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
                                    {formatCurrency(netCashFlow, currency as Currency, { showPlusSign: true })}
                                </span>
                            </div>
                        </div>
                        <div className={`flex flex-col items-end px-3 py-1.5 rounded-xl ${isPositiveNet ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <span className={`text-sm font-bold privacy-blur ${isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {savingsRate.toFixed(0)}%
                            </span>
                            <span className={`text-[10px] font-bold uppercase ${isPositiveNet ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-red-600/70 dark:text-red-400/70'}`}>Savings Rate</span>
                        </div>
                    </div>

                    {/* Middle Row: Visual Flow Bar */}
                    <div className="mb-6">
                         <div className="flex justify-between text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-2">
                            <span>Expenses {Math.min(expenseRatio, 100).toFixed(0)}%</span>
                            <span>Income 100%</span>
                        </div>
                        <div className="h-2.5 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden relative flex">
                            {/* Savings Portion (Background is already green, representing income) */}
                            
                            {/* Expense Portion */}
                            <div 
                                className="h-full bg-rose-400 dark:bg-rose-500/80 rounded-full z-10 transition-all duration-1000 ease-out" 
                                style={{ width: `${Math.min(expenseRatio, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Bottom Row: Detailed Splits */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                     <span className="material-symbols-outlined text-lg">arrow_downward</span>
                                </div>
                                <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">Income</span>
                            </div>
                            <p className="text-xl font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(income, currency as Currency)}</p>
                            {incomeChange && (
                                <p className={`text-[10px] font-medium mt-1 ${incomeChange.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {incomeChange} vs prev.
                                </p>
                            )}
                        </div>

                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 transition-colors hover:bg-rose-50/50 dark:hover:bg-rose-900/10 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-rose-600 dark:text-rose-400">
                                     <span className="material-symbols-outlined text-lg">arrow_upward</span>
                                </div>
                                <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">Expenses</span>
                            </div>
                            <p className="text-xl font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(expenses, currency as Currency)}</p>
                            {expenseChange && (
                                <p className={`text-[10px] font-medium mt-1 ${expenseChange.startsWith('+') ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {expenseChange} vs prev.
                                </p>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </Card>
    );
};

export default FinancialOverview;
