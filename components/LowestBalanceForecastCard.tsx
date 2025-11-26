
import React from 'react';
import Card from './Card';
import { formatCurrency, getPreferredTimeZone, parseDateAsUTC } from '../utils';

interface LowestBalanceForecastCardProps {
    period: string;
    lowestBalance: number;
    date: string;
}

const LowestBalanceForecastCard: React.FC<LowestBalanceForecastCardProps> = ({ period, lowestBalance, date }) => {
    const isRisk = lowestBalance < 0;
    const timeZone = getPreferredTimeZone();
    const formattedDate = parseDateAsUTC(date, timeZone).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Styling based on risk
    const accentColor = isRisk ? 'bg-red-500' : 'bg-blue-500';
    const textColor = isRisk ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text';
    const icon = isRisk ? 'warning' : 'trending_flat'; // or 'shield'

    return (
        <Card className={`flex flex-col justify-between h-full border-l-4 ${isRisk ? 'border-l-red-500' : 'border-l-blue-500'}`}>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">{period}</h3>
                 <span className={`material-symbols-outlined text-lg ${isRisk ? 'text-red-500' : 'text-blue-500/70'}`}>
                    {icon}
                </span>
            </div>
            
            <div>
                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-0.5">Projected Low</p>
                 <p className={`text-xl font-bold ${textColor}`}>
                    {formatCurrency(lowestBalance, 'EUR')}
                 </p>
            </div>

            <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <span className="material-symbols-outlined text-sm">event</span>
                <span>on {formattedDate}</span>
            </div>
        </Card>
    );
};

export default LowestBalanceForecastCard;
