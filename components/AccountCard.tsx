
import React, { useMemo } from 'react';
import { Account } from '../types';
import Card from './Card';
import { convertToEur, formatCurrency } from '../utils';
import { LineChart, Line } from 'recharts';
import { ACCOUNT_TYPE_STYLES } from '../constants';

interface AccountCardProps {
    account: Account;
    onClick: () => void;
    onEdit: () => void;
    // Drag & Drop props
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
    isBeingDragged,
    isDragOver,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
}) => {
    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card's onClick from firing
        onEdit();
    };
    
    const generateSparklineData = (balance: number) => {
        const data = [];
        let lastValue = Math.abs(balance) || Math.random() * 1000 + 500;
        if (lastValue === 0) lastValue = 1;

        for (let i = 0; i < 12; i++) {
            // Create a gentle trend based on whether it's an asset or debt
            const trend = (account.balance >= 0 ? 0.02 : -0.01);
            const fluctuation = (Math.random() - 0.45) * (lastValue * 0.1);
            lastValue += (lastValue * trend) + fluctuation;
            data.push({ value: Math.max(0, lastValue) }); // Ensure value doesn't go below 0
        }
        return data;
    };
    
    const sparklineData = useMemo(() => generateSparklineData(account.balance), [account.balance]);
    
    const isAsset = account.balance >= 0;
    const sparklineColor = isAsset ? '#6366F1' : '#F43F5E';
    const style = ACCOUNT_TYPE_STYLES[account.type];

    const dragClasses = isBeingDragged ? 'opacity-50' : '';
    const dragOverClasses = isDragOver ? 'border-t-4 border-primary-500 pt-1' : '';

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`transition-all duration-150 ${dragOverClasses}`}
        >
            <Card 
                className={`flex items-center justify-between h-full hover:shadow-lg transition-shadow duration-200 cursor-pointer group ${dragClasses}`} 
                onClick={onClick}
            >
                {/* Left side: Icon, Name, Type */}
                <div className="flex items-center flex-1 min-w-0">
                    <div className={`text-3xl mr-4 flex items-center justify-center w-12 h-12 shrink-0 ${style.color}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
                            {account.icon || 'wallet'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-light-text dark:text-dark-text truncate">{account.name}</p>
                        <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                           <span>{account.type} {account.last4 ? `•••• ${account.last4}` : ''}</span>
                        </div>
                    </div>
                </div>

                {/* Right side: Balance, Sparkline, Edit button */}
                <div className="flex items-center gap-4 ml-4">
                    <div className="w-24 h-10 shrink-0">
                        {/* w-24 (6rem = 96px), h-10 (2.5rem = 40px) */}
                        <LineChart width={96} height={40} data={sparklineData}>
                             <Line type="natural" dataKey="value" stroke={sparklineColor} strokeWidth={2} dot={false} />
                        </LineChart>
                    </div>
                    <div className="text-right shrink-0 w-32">
                        <p className={`font-bold text-xl ${isAsset ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
                            {formatCurrency(convertToEur(account.balance, account.currency), 'EUR')}
                        </p>
                         {account.currency !== 'EUR' && (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {formatCurrency(account.balance, account.currency)}
                            </p>
                        )}
                    </div>
                    <button onClick={handleEditClick} className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default AccountCard;
