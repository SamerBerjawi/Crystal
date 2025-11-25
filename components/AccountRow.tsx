
import React, { useMemo } from 'react';
import { Account, Transaction, Warrant } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
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

    const sparklineColor = isAsset ? '#22C55E' : '#F43F5E';
    const style = ACCOUNT_TYPE_STYLES[account.type];
    
    const dragClasses = isBeingDragged ? 'opacity-40 scale-95' : '';
    const dragOverClasses = isDragOver ? 'border-primary-500 ring-2 ring-primary-500/20 z-10' : 'border-transparent hover:border-black/5 dark:hover:border-white/10';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

    const renderSecondaryDetails = () => {
        const details = [];
        if (account.type === 'Property' && account.propertyType) details.push(account.propertyType);
        else details.push(account.type);

        if (account.financialInstitution) details.push(account.financialInstitution);
        if (account.last4) details.push(`•••• ${account.last4}`);
        if (account.subType) details.push(account.subType);
        if (account.interestRate) details.push(`${account.interestRate}%`);
        if (account.make) details.push(`${account.year} ${account.make} ${account.model}`);
        
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
            className={`group relative flex flex-col sm:flex-row items-center gap-4 p-5 bg-light-card dark:bg-dark-card rounded-2xl border shadow-card hover:shadow-lg transition-all duration-300 ease-in-out ${cursorClass} ${dragClasses} ${dragOverClasses} ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}`} 
            onClick={onClick}
        >
            {/* Account Icon & Info */}
            <div className="flex items-center w-full sm:w-auto flex-1 min-w-0 gap-4">
                <div className={`relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${style.color} bg-opacity-10 shadow-sm`}>
                    <span className="material-symbols-outlined material-symbols-filled" style={{ fontSize: '28px' }}>
                        {account.icon || 'wallet'}
                    </span>
                     {account.isPrimary && (
                        <div className="absolute -top-1 -right-1 bg-white dark:bg-dark-card rounded-full p-0.5 shadow-sm">
                            <span className="material-symbols-outlined text-yellow-500 text-xs filled">star</span>
                        </div>
                    )}
                </div>
                
                <div className="min-w-0 flex-col flex">
                    <div className="flex items-baseline gap-2">
                         <h3 className="font-bold text-base text-light-text dark:text-dark-text truncate">{account.name}</h3>
                         {account.symbol && <span className="text-[10px] font-bold font-mono text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded tracking-wide">{account.symbol}</span>}
                    </div>
                    <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mt-0.5 truncate">
                        {renderSecondaryDetails()}
                    </p>
                </div>
            </div>

            {/* Actions, Sparkline, Amount */}
            <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                
                 {/* Sparkline - Hidden on very small screens */}
                <div className="w-24 h-10 shrink-0 hidden md:block opacity-50 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                        <LineChart width={96} height={40} data={sparklineData}>
                            <Line type="monotone" dataKey="value" stroke={sparklineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Balance */}
                <div className="text-right shrink-0">
                    <p className={`font-bold text-lg font-mono tracking-tight ${isAsset ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
                        {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                    </p>
                     {account.currency !== 'EUR' && (
                        <p className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {formatCurrency(displayBalance, account.currency)}
                        </p>
                    )}
                </div>

                {/* Floating Actions */}
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 sm:translate-x-2 group-hover:translate-x-0">
                    <button 
                        onClick={handleAdjustBalanceClick} 
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-20 disabled:cursor-not-allowed" 
                        title={isComputedAccount ? "Balance computed automatically" : "Adjust Balance"}
                        disabled={isComputedAccount}
                    >
                        <span className="material-symbols-outlined text-[20px]">tune</span>
                    </button>
                    <button 
                        onClick={handleEditClick} 
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors" 
                        title="Edit Account"
                    >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountRow;
