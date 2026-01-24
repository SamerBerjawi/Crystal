import React, { useMemo } from 'react';
import { Account, OtherAssetSubType, OtherLiabilitySubType, Transaction, Warrant } from '../types';
import { convertToEur, formatCurrency, generateAmortizationSchedule, toLocalISOString } from '../utils';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';
import { useScheduleContext } from '../contexts/FinancialDataContext';

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
    isLinkedToEnableBanking?: boolean;
}

const AccountRow: React.FC<AccountRowProps> = ({ account, transactions, warrants, onClick, onEdit, onAdjustBalance, isDraggable, isBeingDragged, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onContextMenu, isLinkedToEnableBanking = false }) => {
    const { loanPaymentOverrides } = useScheduleContext();

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit();
    };

    const handleAdjustBalanceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAdjustBalance();
    };

    const displayBalance = useMemo(() => {
        if (account.type === 'Loan') {
             if (account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined) {
                 const overrides = loanPaymentOverrides[account.id] || {};
                 const schedule = generateAmortizationSchedule(account, transactions, overrides);
                 
                 const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
                 const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
                 const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
                 const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
                
                 const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
                 const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);
                 
                 return -(outstandingPrincipal + outstandingInterest);
             }

             if (account.totalAmount) {
                const loanPayments = transactions.filter(tx => tx.type === 'income');
                const totalPaid = loanPayments.reduce((sum, tx) => {
                    const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
                    return sum + (totalPayment > 0 ? totalPayment : tx.amount);
                }, 0);
                return -(account.totalAmount - totalPaid);
             }
        }
        return account.balance;
    }, [account, transactions, loanPaymentOverrides]);

    const { sparklineData, trend, isPositiveTrend } = useMemo(() => {
        const NUM_POINTS = 15;
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);

        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let currentBal = convertToEur(displayBalance, account.currency);
        
        const txsByDate: Record<string, number> = {};
        sortedTransactions.forEach(tx => {
            const dateStr = tx.date;
            const amount = convertToEur(tx.amount, tx.currency);
            txsByDate[dateStr] = (txsByDate[dateStr] || 0) + amount;
        });

        const tempDate = new Date(endDate);
        const history: number[] = [];
        history.push(currentBal);

        while (tempDate > startDate) {
            const dateStr = toLocalISOString(tempDate);
            const change = txsByDate[dateStr] || 0;
            currentBal -= change;
            history.push(currentBal);
            tempDate.setDate(tempDate.getDate() - 1);
        }
        
        const chronological = history.reverse();
        const data: { value: number }[] = [];
        const step = Math.ceil(chronological.length / NUM_POINTS);
        for (let i = 0; i < chronological.length; i += step) {
            data.push({ value: Math.max(0, chronological[i]) });
        }
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

    let styleConfig = ACCOUNT_TYPE_STYLES[account.type];

    if (account.type === 'Investment' && account.subType) {
        styleConfig = INVESTMENT_SUB_TYPE_STYLES[account.subType];
    } else if (account.type === 'Other Assets' && account.otherSubType) {
        styleConfig = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType];
    } else if (account.type === 'Other Liabilities' && account.otherSubType) {
        styleConfig = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType];
    }
        
    const typeColor = styleConfig?.color || 'text-gray-500';
    const chartColor = isPositiveTrend ? '#22c55e' : '#ef4444';
    const dragClasses = isBeingDragged ? 'opacity-50 scale-95 ring-2 ring-primary-500' : '';
    const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 scale-[1.02]' : '';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

    let detailsText = account.financialInstitution || account.type;
    if (account.type === 'Other Assets' || account.type === 'Other Liabilities') {
        detailsText = account.otherSubType || detailsText;
    } else if (account.type === 'Investment' && account.subType) {
        if (account.subType === 'Pension Fund' && account.expectedRetirementYear) {
            detailsText = `Pension • Retires ${account.expectedRetirementYear}`;
        } else {
            detailsText = account.subType;
        }
    } else if (account.type === 'Savings' && account.apy) {
        detailsText = `${account.financialInstitution || 'Savings'} • ${account.apy}% APY`;
    }
    
    const isIncludedInAnalytics = account.includeInAnalytics ?? true;

    return (
        <div 
            draggable={isDraggable}
            onDragStart={(e) => onDragStart(e)}
            onDragOver={(e) => onDragOver(e)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e)}
            onDragEnd={onDragEnd}
            onContextMenu={onContextMenu}
            onClick={onClick}
            className={`
                relative group overflow-hidden
                bg-white/60 dark:bg-dark-card/60 backdrop-blur-xl
                rounded-2xl border border-black/5 dark:border-white/10
                shadow-sm hover:shadow-xl hover:-translate-y-1
                transition-all duration-300 ease-out
                p-6 min-h-[200px] flex flex-col
                ${cursorClass} ${dragClasses} ${dragOverClasses}
                ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
            `}
        >
            <div className="relative z-10 flex-grow">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`
                            w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                            ${styleConfig?.color ? styleConfig.color.replace('text-', 'bg-').replace('500', '100') + ' dark:' + styleConfig.color.replace('text-', 'bg-').replace('500', '900/30') : 'bg-gray-100 dark:bg-gray-800'}
                            ${typeColor}
                        `}>
                            <span className="material-symbols-outlined text-2xl leading-none">{account.icon || styleConfig?.icon || 'wallet'}</span>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 leading-tight">
                                <h3 className="font-bold text-lg text-light-text dark:text-dark-text truncate">
                                    {account.name}
                                </h3>
                                {isLinkedToEnableBanking && (
                                  <span className="material-symbols-outlined text-xl text-primary-500 shrink-0" title="Linked via Enable Banking">link</span>
                                )}
                                {isIncludedInAnalytics && (
                                    <span className="material-symbols-outlined text-base shrink-0 text-primary-400 dark:text-primary-600" title="Included in Analytics">insights</span>
                                )}
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate font-semibold mt-1 tracking-wide uppercase">
                                {detailsText}
                                {account.last4 && <span className="opacity-70 ml-1">•••• {account.last4}</span>}
                            </p>
                        </div>
                    </div>
                    {account.isPrimary && (
                        <span className="material-symbols-outlined text-yellow-500 text-2xl drop-shadow-sm" title="Primary Account">stars</span>
                    )}
                </div>

                <div className="mt-6 flex items-baseline gap-3">
                    <p className="text-3xl font-black tracking-tighter text-light-text dark:text-dark-text privacy-blur">
                        {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                    </p>
                    {transactions.length > 0 && (
                        <div className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter privacy-blur ${isPositiveTrend ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
                            <span>{isPositiveTrend ? '▲' : '▼'} {formatCurrency(Math.abs(trend), 'EUR', { showPlusSign: false })}</span>
                        </div>
                    )}
                </div>
                {account.currency !== 'EUR' && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono font-medium mt-1 privacy-blur opacity-70">
                        {formatCurrency(displayBalance, account.currency)}
                    </p>
                )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-20 w-full pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity duration-500">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`gradient-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.4}/>
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={chartColor} 
                            strokeWidth={2.5} 
                            fill={`url(#gradient-${account.id})`}
                            isAnimationActive={true}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
             <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 z-20">
                <button 
                    onClick={handleAdjustBalanceClick} 
                    className="p-2 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 shadow-lg border border-black/5 dark:border-white/10 transition-all active:scale-95"
                    title="Adjust Balance"
                    disabled={isComputedAccount}
                >
                    <span className="material-symbols-outlined text-lg block">tune</span>
                </button>
                <button 
                     onClick={handleEditClick} 
                     className="p-2 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 shadow-lg border border-black/5 dark:border-white/10 transition-all active:scale-95"
                     title="Edit Account"
                >
                     <span className="material-symbols-outlined text-lg block">settings</span>
                </button>
             </div>
        </div>
    );
};

export default AccountRow;