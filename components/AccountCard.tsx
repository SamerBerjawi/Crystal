
import React, { useMemo } from 'react';
import { Account, OtherAssetSubType, OtherLiabilitySubType } from '../types';
import Card from './Card';
import { convertToEur, formatCurrency } from '../utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';

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
    // FIX: Added 'isDraggable' to the destructured props to resolve the 'Cannot find name' error.
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
        e.stopPropagation(); // Prevent card's onClick from firing
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
    const sparklineColor = isAsset ? '#6366F1' : '#F43F5E';
    
    let style = ACCOUNT_TYPE_STYLES[account.type];
    if (account.type === 'Other Assets' && account.otherSubType) {
        style = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType] || style;
    } else if (account.type === 'Other Liabilities' && account.otherSubType) {
        style = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType] || style;
    }

    const dragClasses = isBeingDragged ? 'opacity-50' : '';
    const dragOverClasses = isDragOver ? 'border-t-4 border-primary-500 pt-1' : '';

    const secondaryText = account.otherSubType || (account.type === 'Property' && account.propertyType ? account.propertyType : account.type);

    return (
        <div
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`transition-all duration-150 ${dragOverClasses} ${isDraggable ? 'cursor-grab' : ''}`}
        >
            <Card 
                className={`flex items-center justify-between h-full hover:shadow-lg transition-shadow duration-200 cursor-pointer group ${dragClasses}`} 
                onClick={onClick}
            >
                <div className="flex items-center flex-1 min-w-0">
                    <div className={`text-3xl mr-4 flex items-center justify-center w-12 h-12 shrink-0 ${style.color}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
                            {account.icon || 'wallet'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-light-text dark:text-dark-text truncate">{account.name}</p>
                        <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                           <span>{secondaryText} {account.last4 ? `•••• ${account.last4}` : ''}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 ml-4">
                    <div className="w-24 h-10 shrink-0">
                        <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                            <LineChart width={96} height={40} data={sparklineData}>
                                 <Line type="natural" dataKey="value" stroke={sparklineColor} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
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
