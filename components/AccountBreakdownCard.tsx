
import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';

interface BreakdownItem {
    name: string;
    value: number;
    color: string;
}

interface AccountBreakdownCardProps {
    title: string;
    totalValue: number;
    breakdownData: BreakdownItem[];
}

const AccountBreakdownCard: React.FC<AccountBreakdownCardProps> = ({ title, totalValue, breakdownData }) => {
    return (
        <Card className="flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-6">
                <div>
                     <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalValue, 'EUR')}</h3>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${title === 'Assets' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                    <span className="material-symbols-outlined text-xl">{title === 'Assets' ? 'account_balance' : 'credit_card'}</span>
                </div>
            </div>
            
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 w-full mb-5">
                {breakdownData.map((item, index) => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    // Add a separator unless it's the last item
                    const separator = index < breakdownData.length - 1 ? 'border-r-2 border-white dark:border-dark-card' : '';
                    return (
                        <div
                            key={item.name}
                            className={`h-full ${separator}`}
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: item.color,
                            }}
                            title={`${item.name}: ${percentage.toFixed(1)}%`}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {breakdownData.map(item => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    return (
                        <div key={item.name} className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                <span className="text-light-text-secondary dark:text-dark-text-secondary truncate group-hover:text-light-text dark:group-hover:text-dark-text transition-colors">{item.name}</span>
                            </div>
                            <span className="font-semibold text-light-text dark:text-dark-text">{percentage.toFixed(0)}%</span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default AccountBreakdownCard;
