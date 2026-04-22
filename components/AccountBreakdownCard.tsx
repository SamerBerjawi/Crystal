
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
    const accentColor = isAsset ? 'emerald' : 'rose';
    const iconName = isAsset ? 'account_balance' : 'credit_card';

    return (
        <div className="h-full flex flex-col justify-between !bg-transparent !p-0">
            <div>
                <div className="flex justify-between items-start mb-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${accentColor}-500/10 text-${accentColor}-500 border border-${accentColor}-500/20 shadow-lg shadow-${accentColor}-500/5 transition-transform duration-500 hover:scale-110`}>
                        <span className="material-symbols-outlined text-xl filled-icon">{iconName}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-1 opacity-60">Cumulative {title}</p>
                        <h3 className="text-2xl font-black text-light-text dark:text-dark-text tracking-tighter privacy-blur leading-none">{formatCurrency(totalValue, 'EUR')}</h3>
                    </div>
                </div>
                
                {/* Segmented Bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden bg-black/5 dark:bg-white/5 w-full mb-6 p-0.5 border border-black/5 dark:border-white/5">
                    {breakdownData.map((item, index) => {
                        const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                        if (percentage < 1) return null; 
                        return (
                            <div
                                key={item.name}
                                className={`h-full rounded-full transition-all duration-700 ${index < breakdownData.length - 1 ? 'mr-0.5' : ''}`}
                                style={{
                                    width: `${percentage}%`,
                                    backgroundColor: item.color,
                                    boxShadow: `0 0 10px ${item.color}33`
                                }}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Legend Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {breakdownData.slice(0, 6).map(item => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    if (percentage < 1) return null;
                    return (
                        <div key={item.name} className="flex flex-col gap-1 group">
                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest leading-none">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: item.color }}></div>
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary truncate transition-colors group-hover:text-primary-500 max-w-[80px]">{item.name}</span>
                                </div>
                                <span className="text-light-text dark:text-dark-text font-mono opacity-60 group-hover:opacity-100">{percentage.toFixed(0)}%</span>
                            </div>
                            <div className="h-0.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500 group-hover:bg-primary-500" style={{ width: `${percentage}%`, backgroundColor: `${item.color}44` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AccountBreakdownCard;
