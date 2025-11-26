
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Account, Transaction, Warrant } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';

interface AccountCardProps {
    account: Account;
    transactions?: Transaction[];
    onClick: () => void;
    onEdit: () => void;
    onAdjustBalance: () => void;
    onToggleStatus: () => void;
    onDelete: () => void;
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
    transactions = [],
    onClick, 
    onEdit, 
    onAdjustBalance,
    onToggleStatus,
    onDelete,
    isDraggable,
    isBeingDragged,
    isDragOver,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const sparklineData = useMemo(() => {
        const NUM_POINTS = 20;
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
            const loanPayments = transactions.filter(tx => tx.accountId === account.id && tx.type === 'income');
            const totalPrincipalPaid = loanPayments.reduce((sum, tx) => {
                 const principalPart = tx.principalAmount !== undefined ? tx.principalAmount : tx.amount;
                 return sum + principalPart;
            }, 0);
            return -(account.totalAmount - totalPrincipalPaid);
        }
        return account.balance;
    }, [account, transactions]);
    
    // Determine if it's an asset or liability for color coding
    const isLiabilityType = ['Credit Card', 'Loan', 'Other Liabilities'].includes(account.type);
    // Visual check: liabilities usually negative balance, but we want to color code based on type intent
    
    // Trend calculation
    const startVal = sparklineData[0]?.value || 0;
    const endVal = sparklineData[sparklineData.length - 1]?.value || 0;
    const change = endVal - startVal;
    const isPositiveTrend = change >= 0;
    const trendPercent = startVal !== 0 ? Math.abs((change / startVal) * 100) : 0;

    // Green line if value went up (good for assets), Red if went down.
    // For liabilities, value going up (towards 0) is good (Green), going down (more negative) is bad (Red).
    const sparklineColor = change >= 0 ? '#10B981' : '#EF4444';

    let style = ACCOUNT_TYPE_STYLES[account.type];
    if (account.type === 'Investment' && account.subType) {
         style = INVESTMENT_SUB_TYPE_STYLES[account.subType] || style;
    }
    
    const dragClasses = isBeingDragged ? 'opacity-40 scale-95 shadow-none ring-2 ring-primary-500 border-transparent' : '';
    const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 ring-offset-4 dark:ring-offset-dark-bg scale-105 z-10' : 'hover:-translate-y-1 hover:shadow-xl';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

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
                group relative bg-white dark:bg-dark-card rounded-2xl p-5 border border-gray-200 dark:border-white/5 shadow-sm transition-all duration-300 ease-out overflow-hidden h-[200px] flex flex-col justify-between
                ${cursorClass} ${dragClasses} ${dragOverClasses} ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
            `}
        >
            {/* Top Row: Icon, Name, Menu */}
            <div className="flex justify-between items-start z-20 relative">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${style.color} bg-gray-100 dark:bg-white/10`}>
                        <span className="material-symbols-outlined text-[20px]">
                            {account.icon || 'wallet'}
                        </span>
                        {account.isPrimary && (
                             <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center">
                                <span className="material-symbols-outlined text-[8px] text-white font-bold">star</span>
                             </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-base text-gray-900 dark:text-white truncate leading-tight">{account.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5 uppercase tracking-wide font-semibold opacity-80">
                            {account.type === 'Investment' ? account.subType : account.type}
                        </p>
                    </div>
                </div>

                {/* Menu Button */}
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>
                    
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-gray-200 dark:border-white/10 py-1 z-30 animate-fade-in-up origin-top-right">
                            <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                <span className="material-symbols-outlined text-base">edit</span> Edit
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onAdjustBalance(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                <span className="material-symbols-outlined text-base">tune</span> Adjust Balance
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onToggleStatus(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                <span className="material-symbols-outlined text-base">{account.status === 'closed' ? 'undo' : 'archive'}</span> {account.status === 'closed' ? 'Reopen' : 'Archive'}
                            </button>
                            <div className="h-px bg-gray-100 dark:bg-white/10 my-1"></div>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">delete</span> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Middle: Balance and Trend */}
            <div className="relative z-10 mt-4 mb-auto">
                 <div className="flex items-baseline gap-2 flex-wrap">
                     <p className={`text-2xl font-bold tracking-tight ${!isLiabilityType && displayBalance < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                        {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                     </p>
                     {/* Trend Badge next to balance */}
                     {sparklineData.length > 1 && (
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                            isPositiveTrend 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                        }`}>
                            <span className="material-symbols-outlined text-[12px]">
                                {isPositiveTrend ? 'trending_up' : 'trending_down'}
                            </span>
                            <span>{trendPercent.toFixed(1)}%</span>
                        </div>
                    )}
                 </div>
                 {account.currency !== 'EUR' && (
                     <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                         {formatCurrency(displayBalance, account.currency)}
                     </p>
                 )}
            </div>

            {/* Bottom: Sparkline */}
            <div className="absolute bottom-0 left-0 right-0 h-20 opacity-30 pointer-events-none overflow-hidden rounded-b-2xl">
                 <ResponsiveContainer minWidth={0} minHeight={0}>
                    <AreaChart data={sparklineData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`grad-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.4}/>
                                <stop offset="100%" stopColor={sparklineColor} stopOpacity={0}/>
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

export default AccountCard;
