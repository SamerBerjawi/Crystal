import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';

interface LowestBalanceForecastCardProps {
    period: string;
    lowestBalance: number;
    date: string;
}

const LowestBalanceForecastCard: React.FC<LowestBalanceForecastCardProps> = ({ period, lowestBalance, date }) => {
    const balanceColor = lowestBalance < 0 ? 'text-red-500' : 'text-light-text dark:text-dark-text';
    const formattedDate = new Date(date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <Card className="flex flex-col justify-between">
            <div>
                <div className="flex items-start justify-between">
                    <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">{period}</h3>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/10">
                        <span className="material-symbols-outlined text-2xl text-yellow-500">
                        crisis_alert
                        </span>
                    </div>
                </div>
                <p className={`text-2xl font-bold mt-1 ${balanceColor}`}>{formatCurrency(lowestBalance, 'EUR')}</p>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">
                Projected on {formattedDate}
            </p>
        </Card>
    );
};

export default LowestBalanceForecastCard;