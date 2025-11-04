import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES } from '../constants';

interface AccountRowProps {
    account: Account;
    transactions: Transaction[];
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
}

const AccountRow: React.FC<AccountRowProps> = ({ account, transactions, onClick, onEdit, onAdjustBalance, isDraggable, isBeingDragged, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }) => {
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
        startDate.setDate(endDate.getDate() - 90); // last 90 days

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
    // FIX: The type 'Crypto' is not a valid AccountType. 'Crypto' is a subtype of 'Investment'.
    // The check is simplified to only verify if the account type is 'Investment'.
    const isComputedAccount = account.type === 'Investment';
    const sparklineColor = isAsset ? '#22C55E' : '#F43F5E';
    const style = ACCOUNT_TYPE_STYLES[account.type];
    
    const dragClasses = isBeingDragged ? 'opacity-30' : '';
    const dragOverClasses = isDragOver ? 'outline-2 outline-dashed outline-primary-500 bg-primary-500/5' : '';
    const cursorClass = isDraggable ? 'cursor-grab' : 'cursor-pointer';

    const renderSecondaryDetails = () => {
        const details = [];
        if (account.last4) details.push(`•••• ${account.last4}`);
        if (account.subType) details.push(account.subType);
        if (account.interestRate) details.push(`${account.interestRate}%`);
        if (account.make) details.push(`${account.year} ${account.make} ${account.model}`);
        if (account.propertyType) details.push(account.propertyType);
        
        if (details.length === 0) return <span>{account.type}</span>;

        return (
            <>
                <span>{account.type}</span>
                {details.map((detail, index) => (
                    <React.Fragment key={index}>
                        <span className="mx-1">&bull;</span>
                        <span>{detail}</span>
                    </React.Fragment>
                ))}
            </>
        );
    };

    return (
        <div 
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`flex items-center justify-between p-4 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-md ${cursorClass} ${dragClasses} ${dragOverClasses}`} 
            onClick={onClick}
        >
            {/* Left side: Icon, Name, Type */}
            <div className="flex items-center flex-1 min-w-0">
                <div className={`text-3xl mr-4 flex items-center justify-center w-12 h-12 shrink-0 ${style.color}`}>
                    <span className="material-symbols-outlined material-symbols-filled" style={{ fontSize: '36px' }}>
                        {account.icon || 'wallet'}
                    </span>
                </div>
                <div className="min-w-0">
                    <p className="font-semibold text-light-text dark:text-dark-text truncate flex items-center gap-2">
                      {account.name}
                      {account.isPrimary && <span className="material-symbols-outlined text-yellow-500 text-base" title="Primary Account">star</span>}
                    </p>
                    <div className="flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">
                       {renderSecondaryDetails()}
                       {account.symbol && <span className="font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs ml-2">{account.symbol}</span>}
                    </div>
                </div>
            </div>

            {/* Right side: Balance, Sparkline, Edit button */}
            <div className="flex items-center gap-2 ml-4">
                <div className="w-24 h-10 shrink-0 hidden sm:block">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData}>
                            <Line type="natural" dataKey="value" stroke={sparklineColor} strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="text-right shrink-0 w-32">
                    <p className={`font-bold text-lg ${isAsset ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
                        {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                    </p>
                     {account.currency !== 'EUR' && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {formatCurrency(displayBalance, account.currency)}
                        </p>
                    )}
                </div>
                <button 
                    onClick={handleAdjustBalanceClick} 
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed" 
                    title={isComputedAccount ? "Balance is computed automatically" : "Adjust Balance"}
                    disabled={isComputedAccount}
                >
                    <span className="material-symbols-outlined">tune</span>
                </button>
                <button onClick={handleEditClick} className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="Edit Account">
                    <span className="material-symbols-outlined">edit</span>
                </button>
            </div>
        </div>
    );
};

export default AccountRow;
