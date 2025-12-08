
import React from 'react';
import Card from './Card';
import { formatCurrency, getPreferredTimeZone, parseLocalDate } from '../utils';

interface LowestBalanceForecastCardProps {
    period: string;
    lowestBalance: number;
    date: string;
}

const LowestBalanceForecastCard: React.FC<LowestBalanceForecastCardProps> = ({ period, lowestBalance, date }) => {
    const isLow = lowestBalance < 0;
    const balanceColor = isLow ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text';
    const statusColor = isLow ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    const icon = isLow ? 'warning' : 'trending_flat';
    
    const timeZone = getPreferredTimeZone();
    const formattedDate = parseLocalDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone });

    return (
        <Card className="flex flex-col justify-between border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${statusColor}`}>
                        {period}
                    </span>
                    {isLow && <span className="material-symbols-outlined text-red-500 text-lg">priority_high</span>}
                </div>
                
                <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-0.5">projected low</p>
                <p className={`text-2xl font-extrabold tracking-tight ${balanceColor}`}>
                    {formatCurrency(lowestBalance, 'EUR')}
                </p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <span className="material-symbols-outlined text-sm">event</span>
                <span className="font-medium">{formattedDate}</span>
            </div>
        </Card>
    );
};

export default LowestBalanceForecastCard;
