
import React from 'react';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';

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
    const iconName = isAsset ? 'account_balance' : 'credit_card';

    return (
        <div className="glass-tile rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-[4px_6px_12px_rgba(0,0,0,0.06)] dark:shadow-[4px_6px_12px_rgba(0,0,0,0.25)] h-full flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${isAsset ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500' : 'bg-rose-500/15 border-rose-500/30 text-rose-500'}`}>
                        <Icon name={iconName} className="text-lg" />
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                        <h3 className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">{formatCurrency(totalValue, 'EUR')}</h3>
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
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                {breakdownData.slice(0, 4).map(item => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    if (percentage < 1) return null;
                    return (
                        <div key={item.name} className="flex items-center justify-between text-xs group">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                <span className="text-light-text-secondary dark:text-gray-300 truncate group-hover:text-light-text dark:group-hover:text-white transition-colors max-w-[60px]">{item.name}</span>
                            </div>
                            <span className="font-semibold text-light-text dark:text-white shrink-0">{percentage.toFixed(0)}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AccountBreakdownCard;
