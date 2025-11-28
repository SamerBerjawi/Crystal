
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
    const iconColor = isAsset ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    const iconBg = isAsset ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30';
    const iconName = isAsset ? 'account_balance' : 'credit_card';

    return (
        <div className="bg-white dark:bg-dark-card rounded-2xl p-5 border border-black/5 dark:border-white/5 shadow-sm h-full flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
                        <span className="material-symbols-outlined text-xl">{iconName}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-0.5">{title}</p>
                        <h3 className="text-2xl font-extrabold text-light-text dark:text-dark-text">{formatCurrency(totalValue, 'EUR')}</h3>
                    </div>
                </div>
                
                {/* Segmented Bar */}
                <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 w-full mb-4">
                    {breakdownData.map((item, index) => {
                        const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                        if (percentage < 1) return null; // Hide tiny segments
                        return (
                            <div
                                key={item.name}
                                className={`h-full ${index < breakdownData.length - 1 ? 'border-r border-white dark:border-dark-card' : ''}`}
                                style={{
                                    width: `${percentage}%`,
                                    backgroundColor: item.color,
                                }}
                                title={`${item.name}: ${percentage.toFixed(1)}%`}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Legend Grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                {breakdownData.slice(0, 6).map(item => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    if (percentage < 1) return null;
                    return (
                        <div key={item.name} className="flex items-center justify-between text-xs group">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                <span className="text-light-text-secondary dark:text-dark-text-secondary truncate group-hover:text-light-text dark:group-hover:text-dark-text transition-colors max-w-[80px]">{item.name}</span>
                            </div>
                            <span className="font-semibold text-light-text dark:text-dark-text opacity-80">{percentage.toFixed(0)}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AccountBreakdownCard;
