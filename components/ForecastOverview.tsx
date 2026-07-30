
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
    noCard?: boolean;
}

const ForecastOverview: React.FC<ForecastOverviewProps> = ({ forecasts, currency = 'EUR', noCard = false }) => {
    const timeZone = getPreferredTimeZone();

    const sortedForecasts = [...forecasts].sort((a, b) => {
         // Sort logical order based on period labels if needed, or trust incoming order
         // Assuming incoming order is correct [This Month, 3M, 6M, 1Y]
         return 0; 
    });
    
    const content = (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sortedForecasts.map((item) => {
                    const isLow = item.lowestBalance < 0;
                    
                    let statusColor = 'bg-gray-100 dark:bg-gray-800 text-light-text dark:text-dark-text';
                    let amountColor = 'text-light-text dark:text-dark-text';
                    let icon = 'trending_flat';

                    if (isLow) {
                        statusColor = 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
                        amountColor = 'text-red-600 dark:text-red-400';
                        icon = 'warning';
                    } else if (item.lowestBalance < 1000) {
                        statusColor = 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50';
                        amountColor = 'text-amber-600 dark:text-amber-400';
                        icon = 'priority_high';
                    } else {
                         statusColor = 'bg-white dark:bg-white/5 border border-black/5 dark:border-white/5';
                         amountColor = 'text-emerald-600 dark:text-emerald-400';
                         icon = 'check_circle';
                    }

                    const formattedDate = parseLocalDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                        <div 
                            key={item.period} 
                            className={`p-2 rounded-xl border flex flex-col justify-between ${statusColor}`}
                        >
                            <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[10px] font-bold tracking-wider opacity-70 truncate">{item.period}</span>
                                <span className={`material-symbols-outlined text-sm ${isLow ? 'text-red-500' : 'opacity-30'}`}>{icon}</span>
                            </div>

                            <p className={`text-xs sm:text-sm font-black tracking-tight privacy-blur ${amountColor}`}>
                                {formatCurrency(item.lowestBalance, currency as Currency)}
                            </p>
                            
                            <div className="mt-1 pt-1 border-t border-black/5 dark:border-white/5 flex items-center gap-1 text-[9px] opacity-70">
                                <span className="material-symbols-outlined text-[11px]">event</span>
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                    );
                })}
        </div>
    );

    if (noCard) {
        return content;
    }

    return (
        <Card className="bg-gradient-to-b from-white to-gray-50 dark:from-dark-card dark:to-black/20 border border-black/5 dark:border-white/5 shadow-sm">
            {content}
        </Card>
    );
};

export default ForecastOverview;
