
import React, { useMemo } from 'react';
import { Account } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES } from '../constants';

interface AccountCardProps {
    account: Account;
    onClick: () => void;
    onEdit: () => void;
    isDraggable: boolean;
    isBeingDragged: boolean;
    isDragOver: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
}

const AccountCard: React.FC<AccountCardProps> = ({ 
    account, 
    onClick, 
    onEdit, 
    isDraggable,
    isBeingDragged,
    isDragOver,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
}) => {
    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit();
    };
    
    const sparklineData = useMemo(() => {
        const data = [];
        let lastValue = Math.abs(account.balance) || Math.random() * 1000 + 500;
        if (lastValue === 0) lastValue = 1;

        for (let i = 0; i < 12; i++) {
            const trend = (account.balance >= 0 ? 0.02 : -0.01);
            const fluctuation = (Math.random() - 0.45) * (lastValue * 0.1);
            lastValue += (lastValue * trend) + fluctuation;
            data.push({ value: Math.max(0, lastValue) });
        }
        return data;
    }, [account.balance]);
    
    const isAsset = account.balance >= 0;
    const sparklineColor = isAsset ? '#22C55E' : '#F43F5E';
    const style = ACCOUNT_TYPE_STYLES[account.type];

    const dragClasses = isBeingDragged ? 'opacity-50 scale-95' : '';
    const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-bg' : 'hover:border-gray-300 dark:hover:border-white/20';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

    const secondaryText = account.type === 'Property' && account.propertyType ? account.propertyType : account.type;

    return (
        <div
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onClick={onClick}
            className={`
                group relative bg-white dark:bg-dark-card rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden
                ${cursorClass} ${dragClasses} ${dragOverClasses}
            `}
        >
            <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3 min-w-0">
                    <div className={`relative flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${style.color} bg-current/10`}>
                        <span className="material-symbols-outlined text-[24px]">
                            {account.icon || 'wallet'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">{account.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{secondaryText} {account.last4 ? `• ${account.last4}` : ''}</p>
                    </div>
                 </div>
                 <button 
                    onClick={handleEditClick} 
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
            </div>

            <div className="flex items-end justify-between gap-4">
                <div className="h-8 w-24 opacity-70 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                        <LineChart width={96} height={32} data={sparklineData}>
                                <Line type="monotone" dataKey="value" stroke={sparklineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="text-right min-w-0 flex-shrink-0">
                    <p className={`font-bold text-lg font-mono tracking-tight leading-none ${isAsset ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(convertToEur(account.balance, account.currency), 'EUR')}
                    </p>
                        {account.currency !== 'EUR' && (
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1">
                            {formatCurrency(account.balance, account.currency)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountCard;
