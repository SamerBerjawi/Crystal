
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

    const { sparklineData, trend, isPositiveTrend } = useMemo(() => {
        const NUM_POINTS = 15;
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30); // Last 30 days

        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Calculate daily balances working backwards
        let currentBal = convertToEur(displayBalance, account.currency);
        const dailyBalances: { date: number, value: number }[] = [];
        
        // We need to calculate balances for the last 30 days
        // Map transactions to dates for O(1) lookup or simple filtering
        const txsByDate: Record<string, number> = {};
        sortedTransactions.forEach(tx => {
            const dateStr = tx.date; // YYYY-MM-DD
            // Reverse the effect: if it was income (+), subtract it. If expense (-), add it back.
            // But we are going backwards in time.
            // Wait, to get history from current balance:
            // Balance(T-1) = Balance(T) - Income(T) + Expense(T)
            const amount = convertToEur(tx.amount, tx.currency);
            txsByDate[dateStr] = (txsByDate[dateStr] || 0) + amount;
        });

        // We iterate from Today backwards to StartDate
        const tempDate = new Date(endDate);
        const history: number[] = [];

        // Push today's balance first
        history.push(currentBal);

        while (tempDate > startDate) {
            const dateStr = tempDate.toISOString().split('T')[0];
            const change = txsByDate[dateStr] || 0;
            currentBal -= change; // Reverse the transaction
            history.push(currentBal);
            tempDate.setDate(tempDate.getDate() - 1);
        }
        
        // The history array is now [Today, Yesterday, ..., 30 Days Ago]
        // Reverse it to be [30 Days Ago, ..., Today] for the chart
        const chronological = history.reverse();
        
        // Downsample for sparkline to NUM_POINTS
        const data: { value: number }[] = [];
        const step = Math.ceil(chronological.length / NUM_POINTS);
        for (let i = 0; i < chronological.length; i += step) {
            data.push({ value: Math.max(0, chronological[i]) });
        }
        // Ensure the last point is the actual current balance
        if (data.length < NUM_POINTS || data[data.length-1].value !== convertToEur(displayBalance, account.currency)) {
             data.push({ value: Math.max(0, convertToEur(displayBalance, account.currency)) });
        }

        const trendVal = chronological[chronological.length - 1] - chronological[0];
        const isPositive = trendVal >= 0;
        
        return { sparklineData: data, trend: trendVal, isPositiveTrend: isPositive };

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
                border border-black/5 dark:border-white/5
                hover:border-primary-500/30 dark:hover:border-primary-500/30
                shadow-sm hover:shadow-md hover:-translate-y-0.5
                transition-all duration-300 ease-out
                p-4
                ${cursorClass} ${dragClasses} ${dragOverClasses}
                ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
            `}
        >
            {/* Background Gradient on Hover */}
             <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-gray-50/50 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

            <div className="relative z-10 flex justify-between items-center">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Icon Container */}
                    <div className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0
                        shadow-sm group-hover:scale-105 transition-transform duration-300
                        ${styleConfig?.color ? styleConfig.color.replace('text-', 'bg-').replace('500', '100') + ' dark:' + styleConfig.color.replace('text-', 'bg-').replace('500', '900/20') : 'bg-gray-100 dark:bg-gray-800'}
                        ${typeColor}
                    `}>
                        <span className="material-symbols-outlined text-[24px]">{account.icon || 'wallet'}</span>
                    </div>

                    {/* Name & Details */}
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white truncate text-base">
                                {account.name}
                            </h3>
                            {account.isPrimary && (
                                <span className="material-symbols-outlined text-yellow-500 text-[14px]" title="Primary Account">star</span>
                            )}
                            {account.status === 'closed' && (
                                <span className="text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 rounded">Closed</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                             {account.symbol && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-mono tracking-wide border border-black/5 dark:border-white/10">
                                    {account.symbol}
                                </span>
                            )}
                             <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">
                                 {renderSecondaryDetails() || account.type}
                             </p>
                        </div>
                    </div>
                </div>

                {/* Balance & Sparkline Group */}
                <div className="flex items-center gap-6">
                     {/* Sparkline (Hidden on very small screens) */}
                     <div className="hidden sm:block h-10 w-24 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
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

                    <div className="text-right">
                        <p className={`text-lg font-extrabold tracking-tight ${displayBalance < 0 ? 'text-light-text dark:text-dark-text' : 'text-light-text dark:text-dark-text'}`}>
                             {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                        </p>
                        {transactions.length > 0 && (
                            <p className={`text-[10px] font-bold flex items-center justify-end gap-1 ${isPositiveTrend ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                <span className="material-symbols-outlined text-[10px]">{isPositiveTrend ? 'trending_up' : 'trending_down'}</span>
                                {formatCurrency(Math.abs(trend), 'EUR')} (30d)
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions (Visible on Hover) */}
             <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-4 group-hover:translate-x-0 bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-1 rounded-full shadow-sm border border-black/5 dark:border-white/5">
                <button 
                    onClick={handleAdjustBalanceClick} 
                    className="flex items-center justify-center w-8 h-8 rounded-full text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Adjust Balance"
                    disabled={isComputedAccount}
                >
                    <span className="material-symbols-outlined text-sm">tune</span>
                </button>
                <button 
                     onClick={handleEditClick} 
                     className="flex items-center justify-center w-8 h-8 rounded-full text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                     title="Edit Account"
                >
                     <span className="material-symbols-outlined text-sm">edit</span>
                </button>
             </div>
        </div>
    );
};

export default AccountRow;
