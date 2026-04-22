
import React from 'react';
import Card from './Card';
import { formatCurrency, getPreferredTimeZone, parseLocalDate } from '../utils';
import { Currency } from '../types';

interface ForecastItem {
    period: string;
    lowestBalance: number;
    date: string;
}

interface ForecastOverviewProps {
    forecasts: ForecastItem[];
    currency?: Currency;
}

const ForecastOverview: React.FC<ForecastOverviewProps> = ({ forecasts, currency = 'EUR' }) => {
    const timeZone = getPreferredTimeZone();

    const sortedForecasts = [...forecasts].sort((a, b) => {
         // Sort logical order based on period labels if needed, or trust incoming order
         // Assuming incoming order is correct [This Month, 3M, 6M, 1Y]
         return 0; 
    });
    
    return (
        <Card className="!bg-transparent !border-none !shadow-none !p-0 overflow-visible">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/30">
                        <span className="material-symbols-outlined text-xl filled-icon">query_stats</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-light-text dark:text-dark-text leading-tight">Forecast Horizon</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-60">System Prediction Active</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sortedForecasts.map((item) => {
                    const isLow = item.lowestBalance < 0;
                    const isCaution = !isLow && item.lowestBalance < 1000;
                    
                    let accentColor = 'primary';
                    let icon = 'sentiment_satisfied';
                    let label = 'Secure';

                    if (isLow) {
                        accentColor = 'rose';
                        icon = 'warning';
                        label = 'Critical';
                    } else if (isCaution) {
                        accentColor = 'amber';
                        icon = 'priority_high';
                        label = 'Caution';
                    } else {
                        accentColor = 'emerald';
                        icon = 'verified_user';
                        label = 'Safe';
                    }

                    const formattedDate = parseLocalDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                        <div 
                            key={item.period} 
                            className="group relative bg-white/40 dark:bg-dark-card/20 backdrop-blur-xl border border-black/5 dark:border-white/5 p-5 rounded-[2rem] hover:bg-white/60 dark:hover:bg-dark-card/40 transition-all duration-500 overflow-hidden"
                        >
                            {/* Decorative Background Blob */}
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-10 pointer-events-none transition-all duration-700 group-hover:scale-150 ${
                                accentColor === 'rose' ? 'bg-rose-500' : accentColor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}></div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-4">
                                    <div className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 ${
                                        accentColor === 'rose' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' : 
                                        accentColor === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : 
                                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                        <span className={`w-1 h-1 rounded-full ${
                                            accentColor === 'rose' ? 'bg-rose-500' : accentColor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}></span>
                                        {label}
                                    </div>
                                    <span className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">{item.period}</span>
                                </div>

                                <div className="space-y-1">
                                    <p className={`text-3xl font-black tracking-tighter privacy-blur leading-none transition-colors duration-500 ${
                                        accentColor === 'rose' ? 'text-rose-600 dark:text-rose-400' : 
                                        accentColor === 'amber' ? 'text-amber-600 dark:text-amber-400' : 
                                        'text-light-text dark:text-dark-text'
                                    }`}>
                                        {formatCurrency(item.lowestBalance, currency as Currency)}
                                    </p>
                                    <p className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">Minimum Projected Liquidity</p>
                                </div>
                                
                                <div className="mt-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                            <span className={`material-symbols-outlined text-base ${
                                                accentColor === 'rose' ? 'text-rose-500' : accentColor === 'amber' ? 'text-amber-500' : 'text-emerald-500'
                                            }`}>{icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40 leading-none mb-1">Target Date</p>
                                            <p className="text-[10px] font-black text-light-text dark:text-dark-text uppercase tracking-widest leading-none font-mono">{formattedDate}</p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-px bg-black/5 dark:bg-white/10"></div>
                                </div>
                            </div>

                            {/* Bottom Pattern */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden flex gap-0.5 opacity-20">
                                {Array.from({length: 20}).map((_, i) => (
                                    <div key={i} className={`flex-1 h-full ${
                                        accentColor === 'rose' ? 'bg-rose-500' : accentColor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}></div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default ForecastOverview;
