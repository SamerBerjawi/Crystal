
import React, { useMemo } from 'react';
import { Account, Transaction, Warrant } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';

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

    const sparklineData = useMemo(() => {
        const NUM_POINTS = 20;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30); // Last 30 days

        if (transactions.length === 0) {
             // Generate a flat line if no transactions
             return Array(NUM_POINTS).fill({ value: convertToEur(displayBalance, account.currency) });
        }

        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const relevantTransactions = sortedTransactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= startDate && txDate <= endDate;
        });

        // Calculate starting balance 30 days ago
        const totalChangeInPeriod = relevantTransactions.reduce((sum, tx) => sum + convertToEur(tx.amount, tx.currency), 0);
        let runningBalance = convertToEur(displayBalance, account.currency) - totalChangeInPeriod;
        
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

    }, [account, transactions, displayBalance]);

    const isComputedAccount = useMemo(() => {
        if (account.type !== 'Investment' || !account.symbol) return false;
        return warrants.some(w => w.isin === account.symbol);
    }, [account, warrants]);

    // Style determination
    const styleConfig = account.type === 'Investment' && account.subType
        ? INVESTMENT_SUB_TYPE_STYLES[account.subType]
        : ACCOUNT_TYPE_STYLES[account.type];
        
    const typeColor = styleConfig?.color || 'text-gray-500';
    
    const trend = sparklineData.length > 1 ? sparklineData[sparklineData.length - 1].value - sparklineData[0].value : 0;
    const isPositiveTrend = trend >= 0;
    const chartColor = isPositiveTrend ? '#22c55e' : '#ef4444'; // Green or Red

    const dragClasses = isBeingDragged ? 'opacity-50 scale-95 ring-2 ring-primary-500' : '';
    const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 scale-[1.02]' : '';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

    const renderSecondaryDetails = () => {
        const details = [];
        if (account.type === 'Property' && account.propertyType) details.push(account.propertyType);
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
            onClick={onClick}
            className={`
                relative group overflow-hidden
                bg-white dark:bg-dark-card 
                rounded-2xl 
                border border-gray-200 dark:border-white/10
                hover:border-primary-500/50 dark:hover:border-primary-500/50
                shadow-sm hover:shadow-xl 
                transition-all duration-300 ease-out
                p-5
                ${cursorClass} ${dragClasses} ${dragOverClasses}
                ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
            `}
        >
            {/* Background Gradient based on trend */}
             <div className={`absolute inset-0 bg-gradient-to-br ${isPositiveTrend ? 'from-green-50/50 dark:from-green-900/10' : 'from-red-50/50 dark:from-red-900/10'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

            <div className="relative z-10 flex justify-between items-start">
                <div className="flex items-center gap-4 overflow-hidden">
                    {/* Icon Container */}
                    <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center 
                        shadow-sm group-hover:scale-110 transition-transform duration-300
                        ${styleConfig?.color ? styleConfig.color.replace('text-', 'bg-').replace('500', '100') + ' dark:' + styleConfig.color.replace('text-', 'bg-').replace('500', '900/30') : 'bg-gray-100 dark:bg-gray-800'}
                        ${typeColor}
                    `}>
                        <span className="material-symbols-outlined text-[26px]">{account.icon || 'wallet'}</span>
                    </div>

                    {/* Name & Details */}
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white truncate text-lg leading-tight">
                                {account.name}
                            </h3>
                            {account.isPrimary && (
                                <span className="material-symbols-outlined text-yellow-500 text-sm" title="Primary Account">star</span>
                            )}
                            {account.symbol && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-mono">
                                    {account.symbol}
                                </span>
                            )}
                        </div>
                         <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 font-medium">
                             {renderSecondaryDetails() || account.type}
                         </p>
                    </div>
                </div>

                {/* Balance */}
                <div className="text-right flex-shrink-0 ml-4">
                    <p className={`text-xl font-bold tracking-tight ${displayBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                         {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                    </p>
                     {account.currency !== 'EUR' && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                            {formatCurrency(displayBalance, account.currency)}
                        </p>
                    )}
                </div>
            </div>

            {/* Middle Section: Sparkline & Actions */}
            <div className="relative mt-6 h-16 flex items-end justify-between">
                {/* Sparkline Chart */}
                <div className="absolute inset-0 -mx-5 -mb-5 opacity-50 group-hover:opacity-80 transition-opacity duration-300">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData}>
                            <defs>
                                <linearGradient id={`gradient-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={chartColor} 
                                strokeWidth={2} 
                                fill={`url(#gradient-${account.id})`}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Action Buttons (Visible on Hover) */}
                 <div className="relative z-20 flex gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 mb-1">
                    <button 
                        onClick={handleAdjustBalanceClick} 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Adjust Balance"
                        disabled={isComputedAccount}
                    >
                        <span className="material-symbols-outlined text-sm">tune</span>
                        <span>Adjust</span>
                    </button>
                    <button 
                         onClick={handleEditClick} 
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                         title="Edit Account"
                    >
                         <span className="material-symbols-outlined text-sm">edit</span>
                         <span>Edit</span>
                    </button>
                 </div>
                 
                 {/* Trend Badge */}
                 <div className="relative z-10 mb-1 ml-auto opacity-100 group-hover:opacity-0 transition-opacity duration-200">
                     <span className={`text-xs font-bold px-2 py-1 rounded-full ${isPositiveTrend ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                         {isPositiveTrend ? '+' : ''}{formatCurrency(trend, 'EUR')} (30d)
                     </span>
                 </div>
            </div>
        </div>
    );
};

export default AccountRow;
