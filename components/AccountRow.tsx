
import React, { useMemo } from 'react';
import { Account, Transaction, Warrant } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { ACCOUNT_TYPE_STYLES } from '../constants';

interface AccountRowProps {
    account: Account;
    transactions: Transaction[];
    warrants: Warrant[];
    onClick: () => void;
    onEdit: () => void;
    onAdjustBalance: () => void;
    isDraggable: boolean;
    isBeingDragged: boolean;
    isDragOver: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

const AccountRow: React.FC<AccountRowProps> = ({ account, transactions, warrants, onClick, onEdit, onAdjustBalance, isDraggable, isBeingDragged, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onContextMenu }) => {
    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit();
    };
    
    const handleAdjustBalanceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAdjustBalance();
    };

    const sparklineData = useMemo(() => {
        const NUM_POINTS = 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 90);

        if (transactions.length === 0) {
            // Return flat line if no data
            return Array(NUM_POINTS).fill({ value: account.balance });
        }
        
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const relevantTransactions = sortedTransactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= startDate && txDate <= endDate;
        });
        
        const totalChangeInPeriod = relevantTransactions.reduce((sum, tx) => sum + convertToEur(tx.amount, tx.currency), 0);
        let runningBalance = convertToEur(account.balance, account.currency) - totalChangeInPeriod;
        
        const data: { value: number }[] = [];
        const timeRange = endDate.getTime() - startDate.getTime();
        const interval = timeRange / (NUM_POINTS - 1);

        let txIndex = 0;
        for (let i = 0; i < NUM_POINTS; i++) {
            const pointDate = new Date(startDate.getTime() + i * interval);
            
            while (txIndex < relevantTransactions.length && new Date(relevantTransactions[txIndex].date) <= pointDate) {
                runningBalance += convertToEur(relevantTransactions[txIndex].amount, relevantTransactions[txIndex].currency);
                txIndex++;
            }
            data.push({ value: runningBalance });
        }
        
        return data;
    }, [account, transactions]);
    
    const displayBalance = useMemo(() => {
        if (account.type === 'Loan' && account.totalAmount) {
            const loanPayments = transactions.filter(tx => tx.type === 'income');

            const totalPaid = loanPayments.reduce((sum, tx) => {
                const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
                return sum + (totalPayment > 0 ? totalPayment : tx.amount);
            }, 0);
            
            return -(account.totalAmount - totalPaid);
        }
        return account.balance;
    }, [account, transactions]);
    
    const isAsset = displayBalance >= 0;
    
    const isComputedAccount = useMemo(() => {
        if (account.type !== 'Investment' || !account.symbol) {
            return false;
        }
        return warrants.some(w => w.isin === account.symbol);
    }, [account, warrants]);

    // Calculate trend stats
    const startVal = sparklineData[0]?.value || 0;
    const endVal = sparklineData[sparklineData.length - 1]?.value || 0;
    const change = endVal - startVal;
    const isPositiveTrend = change >= 0;
    const trendPercent = startVal !== 0 ? Math.abs((change / startVal) * 100) : 0;

    const sparklineColor = isAsset 
        ? (isPositiveTrend ? '#22C55E' : '#F59E0B') // Green if up, Yellow/Orange if down but still asset
        : (isPositiveTrend ? '#22C55E' : '#EF4444'); // Green if debt reducing (technically 'up'), Red if debt increasing

    const style = ACCOUNT_TYPE_STYLES[account.type];
    
    const dragClasses = isBeingDragged ? 'opacity-40 scale-95 shadow-none' : '';
    const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-bg z-10' : 'hover:border-primary-500/50 dark:hover:border-primary-500/30 hover:shadow-md';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

    const renderSecondaryDetails = () => {
        const details = [];
        if (account.type === 'Property' && account.propertyType) details.push(account.propertyType);
        else details.push(account.type);

        if (account.financialInstitution) details.push(account.financialInstitution);
        if (account.last4) details.push(`•••• ${account.last4}`);
        if (account.subType) details.push(account.subType);
        
        return details.join(' • ');
    };

    return (
        <div 
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onContextMenu={onContextMenu}
            className={`
                group relative bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 ease-in-out overflow-hidden h-[150px] flex flex-col
                ${cursorClass} ${dragClasses} ${dragOverClasses} ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
            `}
            onClick={onClick}
        >
            {/* Info Layer (Z-Index 10) */}
            <div className="relative z-10 p-5 flex justify-between items-start h-full">
                <div className="flex items-start gap-4">
                    <div className={`relative flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${style.color} bg-current/5 ring-1 ring-inset ring-current/10 shadow-sm`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                            {account.icon || 'wallet'}
                        </span>
                         {account.isPrimary && (
                            <div className="absolute -top-1.5 -right-1.5 bg-white dark:bg-dark-card rounded-full p-0.5 shadow-sm border border-gray-100 dark:border-gray-800 z-10">
                                <span className="material-symbols-outlined text-yellow-500 text-[14px] filled">star</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="min-w-0 flex flex-col pt-0.5">
                         <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate leading-tight">{account.name}</h3>
                         <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {renderSecondaryDetails()}
                        </p>
                    </div>
                </div>

                <div className="text-right flex flex-col items-end">
                    <p className={`font-bold text-xl font-mono tracking-tight leading-none ${isAsset ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                    </p>
                     {account.currency !== 'EUR' && (
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1">
                            {formatCurrency(displayBalance, account.currency)}
                        </p>
                    )}
                    
                    {/* Trend Badge */}
                    {sparklineData.length > 1 && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold mt-2 ${isPositiveTrend ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                            <span className="material-symbols-outlined text-[14px]">
                                {isPositiveTrend ? 'trending_up' : 'trending_down'}
                            </span>
                            <span>{trendPercent.toFixed(1)}%</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions Layer (Z-Index 20) */}
            <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-black/5 dark:border-white/5">
                <button 
                    onClick={handleAdjustBalanceClick} 
                    className="p-1.5 rounded-md text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-20 disabled:cursor-not-allowed" 
                    title={isComputedAccount ? "Balance computed automatically" : "Adjust Balance"}
                    disabled={isComputedAccount}
                >
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
                <button 
                    onClick={handleEditClick} 
                    className="p-1.5 rounded-md text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors" 
                    title="Edit Account"
                >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
            </div>

            {/* Sparkline Background (Z-Index 0) */}
            <div className="absolute bottom-0 left-0 right-0 h-20 opacity-20 dark:opacity-30 pointer-events-none px-2 pb-2">
                <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                    <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`grad-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.6}/>
                                <stop offset="90%" stopColor={sparklineColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <YAxis domain={['dataMin', 'dataMax']} hide />
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={sparklineColor} 
                            strokeWidth={2} 
                            fill={`url(#grad-${account.id})`} 
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AccountRow;
