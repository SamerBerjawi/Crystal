
import React from 'react';
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
    const isAsset = title === 'Assets';
    const icon = isAsset ? 'account_balance' : 'credit_card';
    const iconBg = isAsset ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400';

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
                <div>
                     <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{formatCurrency(totalValue, 'EUR')}</h3>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </div>
            </div>
            
            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 w-full mb-6 ring-1 ring-black/5 dark:ring-white/5">
                {breakdownData.map((item, index) => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    return (
                        <div
                            key={item.name}
                            className="h-full first:rounded-l-full last:rounded-r-full relative group"
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: item.color,
                            }}
                        >
                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                                {item.name}: {percentage.toFixed(1)}%
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="space-y-3 mt-auto">
                {breakdownData.slice(0, 4).map(item => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    return (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-dark-card" style={{ backgroundColor: item.color }}></div>
                                <span className="text-light-text dark:text-dark-text font-medium truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">{formatCurrency(item.value, 'EUR')}</span>
                                <span className="font-bold text-light-text dark:text-dark-text w-8 text-right">{percentage.toFixed(0)}%</span>
                            </div>
                        </div>
                    );
                })}
                {breakdownData.length > 4 && (
                     <p className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary pt-2">
                        + {breakdownData.length - 4} more
                    </p>
                )}
            </div>
        </div>
    );
};

export default AccountBreakdownCard;
