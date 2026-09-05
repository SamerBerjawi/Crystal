
import React from 'react';
import Card from './Card';
import { formatCurrency, getPreferredTimeZone, parseLocalDate } from '../utils';
import { Currency } from '../types';
import Icon from './ui/Icon';

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
        <div className={`grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3`}>
            {sortedForecasts.map((item) => {
                    const isLow = item.lowestBalance < 0;
                    const isWarning = !isLow && item.lowestBalance < 1000;
                    
                    let cardStyle = 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10';
                    let amountColor = 'text-emerald-600 dark:text-emerald-400';
                    let iconColor = 'text-emerald-500/60 dark:text-emerald-400/60';
                    let icon = 'check_circle';

                    if (isLow) {
                        cardStyle = 'bg-rose-500/[0.03] dark:bg-rose-500/[0.06] border-rose-500/20';
                        amountColor = 'text-rose-600 dark:text-rose-400';
                        iconColor = 'text-rose-500';
                        icon = 'alert_triangle';
                    } else if (isWarning) {
                        cardStyle = 'bg-amber-500/[0.03] dark:bg-amber-500/[0.06] border-amber-500/20';
                        amountColor = 'text-amber-600 dark:text-amber-400';
                        iconColor = 'text-amber-500';
                        icon = 'alert_circle';
                    }

                    const formattedDate = parseLocalDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                        <div 
                            key={item.period} 
                            className={`p-3.5 rounded-2xl border transition-all duration-200 select-none shadow-xs ${cardStyle}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.period}</span>
                                <Icon name={icon} className={`text-base ${iconColor}`} />
                            </div>

                            <p className={`text-xl font-bold tracking-tight tabular-nums privacy-blur ${amountColor}`}>
                                {formatCurrency(item.lowestBalance, currency as Currency)}
                            </p>
                            
                            <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 text-2xs font-semibold text-slate-400 dark:text-slate-500">
                                <Icon name="calendar" className="text-xs" />
                                <span>On {formattedDate}</span>
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
        <Card className="border border-black/5 dark:border-white/5 shadow-xs !rounded-[2rem] p-4">
            {content}
        </Card>
    );
};

export default ForecastOverview;
