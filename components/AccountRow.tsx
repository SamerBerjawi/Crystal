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
}

const AccountRow: React.FC<AccountRowProps> = ({ account, transactions, onClick, onEdit, onAdjustBalance }) => {
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
    
    const isAsset = account.balance >= 0;
    const sparklineColor = isAsset ? '#22C55E' : '#F43F5E';
    const style = ACCOUNT_TYPE_STYLES[account.type];

    return (
        <div 
            className="flex items-center justify-between p-4 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200 cursor-pointer group" 
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
                    <p className="font-semibold text-light-text dark:text-dark-text truncate">{account.name}</p>
                    <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                       <span>{account.type} {account.last4 ? `•••• ${account.last4}` : ''}</span>
                        {account.enableBankingId && (
                            <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-primary-500">sync</span>
                                <span>{account.enableBankingInstitution}</span>
                            </div>
                        )}
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
                        {formatCurrency(convertToEur(account.balance, account.currency), 'EUR')}
                    </p>
                     {account.currency !== 'EUR' && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {formatCurrency(account.balance, account.currency)}
                        </p>
                    )}
                </div>
                <button onClick={handleAdjustBalanceClick} className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="Adjust Balance">
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