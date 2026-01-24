import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

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
    const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;
    const expenseRatio = income > 0 ? (expenses / income) * 100 : 0;
    const isPositiveNet = netCashFlow >= 0;

    // Mock trend data for the background visual effect
    const mockTrend = [
        { v: 45 }, { v: 52 }, { v: 48 }, { v: 61 }, { v: 55 }, { v: 68 }, { v: 72 }
    ];

    return (
        <Card className="p-0 overflow-hidden border border-black/5 dark:border-white/10 shadow-2xl bg-white/40 dark:bg-dark-card/40 backdrop-blur-3xl group">
            <div className="flex flex-col lg:flex-row min-h-[240px]">
                
                {/* --- NET WORTH SECTION --- */}
                <div className="lg:w-2/5 p-8 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/10 transition-all duration-500 hover:bg-white/40 dark:hover:bg-white/5">
                    {/* Background Trend Visual */}
                    <div className="absolute inset-0 z-0 opacity-10 dark:opacity-20 pointer-events-none translate-y-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mockTrend}>
                                <Area 
                                    type="monotone" 
                                    dataKey="v" 
                                    stroke="#fa9a1d" 
                                    fill="#fa9a1d" 
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
                                    <span className="material-symbols-outlined text-lg">account_balance</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">
                                    Total Position
                                </span>
                            </div>
                            <h2 className="text-4xl font-black tracking-tighter text-light-text dark:text-dark-text privacy-blur">
                                {formatCurrency(netWorth, currency as Currency)}
                            </h2>
                            <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1 uppercase tracking-wider opacity-60">Net Worth</p>
                        </div>

                        <div className="mt-8 flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Live Valuation</span>
                        </div>
                    </div>
                </div>

                {/* --- CASH FLOW SECTION --- */}
                <div className="lg:w-3/5 p-8 relative overflow-hidden transition-all duration-500 hover:bg-white/40 dark:hover:bg-white/5">
                    {/* Background Trend Visual (Mirrored color) */}
                    <div className="absolute inset-0 z-0 opacity-10 dark:opacity-20 pointer-events-none translate-y-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mockTrend}>
                                <Area 
                                    type="monotone" 
                                    dataKey="v" 
                                    stroke={isPositiveNet ? '#10b981' : '#f43f5e'} 
                                    fill={isPositiveNet ? '#10b981' : '#f43f5e'} 
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-1 block">
                                    Cash Flow Pulse
                                </span>
                                <h3 className={`text-4xl font-black tracking-tighter privacy-blur ${isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatCurrency(netCashFlow, currency as Currency, { showPlusSign: true })}
                                </h3>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl backdrop-blur-xl border flex flex-col items-center ${isPositiveNet ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                                <span className="text-xl font-black leading-none">{savingsRate.toFixed(0)}%</span>
                                <span className="text-[9px] font-black uppercase tracking-tighter mt-1 opacity-80">Savings Rate</span>
                            </div>
                        </div>

                        {/* Flow Meter */}
                        <div className="mb-8">
                            <div className="flex justify-between text-[9px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-2">
                                <span>Inbound 100%</span>
                                <span>Utilization {Math.min(expenseRatio, 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-3 w-full bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full overflow-hidden flex shadow-inner border border-black/5 dark:border-white/5">
                                <div 
                                    className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-1000 ease-out shadow-lg" 
                                    style={{ width: `${Math.min(expenseRatio, 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 gap-4 mt-auto">
                            <div className="group/item">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-sm text-emerald-500 font-black">south_east</span>
                                    <span className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Income</span>
                                </div>
                                <p className="text-lg font-black text-light-text dark:text-dark-text privacy-blur leading-none">
                                    {formatCurrency(income, currency as Currency)}
                                </p>
                                {incomeChange && (
                                    <p className={`text-[9px] font-black mt-1 ${incomeChange.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {incomeChange} VELOCITY
                                    </p>
                                )}
                            </div>

                            <div className="group/item text-right">
                                <div className="flex items-center gap-2 mb-1 justify-end">
                                    <span className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Expenses</span>
                                    <span className="material-symbols-outlined text-sm text-rose-500 font-black">north_east</span>
                                </div>
                                <p className="text-lg font-black text-light-text dark:text-dark-text privacy-blur leading-none">
                                    {formatCurrency(expenses, currency as Currency)}
                                </p>
                                {expenseChange && (
                                    <p className={`text-[9px] font-black mt-1 ${expenseChange.startsWith('+') ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {expenseChange} INTENSITY
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default FinancialOverview;