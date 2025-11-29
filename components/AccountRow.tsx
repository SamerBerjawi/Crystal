
import React, { useMemo } from 'react';
import { Account, OtherAssetSubType, OtherLiabilitySubType, Transaction, Warrant } from '../types';
import { convertToEur, formatCurrency, generateAmortizationSchedule } from '../utils';
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
}

const AccountRow: React.FC<AccountRowProps> = ({ account, transactions, warrants, onClick, onEdit, onAdjustBalance, isDraggable, isBeingDragged, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onContextMenu }) => {
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
             // Use robust amortization calculation if details are available
             if (account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined) {
                 const overrides = loanPaymentOverrides[account.id] || {};
                 const schedule = generateAmortizationSchedule(account, transactions, overrides);
                 
                 const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
                 const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
    
                 const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
                 const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
                
                 const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
                 const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);
                 
                 return -(outstandingPrincipal + outstandingInterest);
             }

             // Fallback for loans with incomplete setup
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
        startDate.setDate(endDate.getDate() - 30); // Last 30 days

        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Calculate daily balances working backwards
        let currentBal = convertToEur(displayBalance, account.currency);
        
        // Map transactions to dates for O(1) lookup or simple filtering
        const txsByDate: Record<string, number> = {};
        sortedTransactions.forEach(tx => {
            const dateStr = tx.date; // YYYY-MM-DD
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
    let styleConfig = ACCOUNT_TYPE_STYLES[account.type];

    if (account.type === 'Investment' && account.subType) {
        styleConfig = INVESTMENT_SUB_TYPE_STYLES[account.subType];
    } else if (account.type === 'Other Assets' && account.otherSubType) {
        styleConfig = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType];
    } else if (account.type === 'Other Liabilities' && account.otherSubType) {
        styleConfig = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType];
    }
        
    const typeColor = styleConfig?.color || 'text-gray-500';
    
    const chartColor = isPositiveTrend ? '#22c55e' : '#ef4444'; // Green or Red

    const dragClasses = isBeingDragged ? 'opacity-50 scale-95 ring-2 ring-primary-500' : '';
    const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 scale-[1.02]' : '';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

    // Sub-details text logic
    let detailsText = account.financialInstitution || account.type;
    if (account.type === 'Other Assets' || account.type === 'Other Liabilities') {
        detailsText = account.otherSubType || detailsText;
    } else if (account.type === 'Investment' && account.subType) {
        if (account.subType === 'Pension Fund' && account.expectedRetirementYear) {
            detailsText = `Pension • Retires ${account.expectedRetirementYear}`;
        } else {
            detailsText = account.subType;
        }
    }

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
                bg-light-card dark:bg-dark-card
                rounded-2xl 
                shadow-sm hover:shadow-lg hover:-translate-y-1
                transition-all duration-300 ease-out
                p-5 min-h-[160px] flex flex-col
                ${cursorClass} ${dragClasses} ${dragOverClasses}
                ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
            `}
        >
            <div className="relative z-10">
                {/* Top Section: Icon, Name, Details */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`
                            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                            ${styleConfig?.color ? styleConfig.color.replace('text-', 'bg-').replace('500', '100') + ' dark:' + styleConfig.color.replace('text-', 'bg-').replace('500', '900/20') : 'bg-gray-100 dark:bg-gray-800'}
                            ${typeColor}
                        `}>
                            <span className="material-symbols-outlined text-[20px]">{account.icon || styleConfig?.icon || 'wallet'}</span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-light-text dark:text-dark-text truncate text-sm leading-tight">
                                {account.name}
                            </h3>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate font-medium mt-0.5 tracking-wide">
                                {detailsText}
                                {account.last4 && <span className="opacity-70 ml-1">•••• {account.last4}</span>}
                            </p>
                        </div>
                    </div>
                    {account.isPrimary && (
                        <span className="material-symbols-outlined text-yellow-500 text-[16px]" title="Primary Account">star</span>
                    )}
                </div>

                {/* Middle: Balance & Trend */}
                <div className="mt-3 flex items-center gap-3">
                    <p className={`text-2xl font-extrabold tracking-tight ${displayBalance < 0 ? 'text-light-text dark:text-dark-text' : 'text-light-text dark:text-dark-text'}`}>
                        {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                    </p>
                    {transactions.length > 0 && (
                        <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${isPositiveTrend ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                            <span>{isPositiveTrend ? '+' : ''}{formatCurrency(trend, 'EUR', { showPlusSign: false })}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: Sparkline (Absolute Positioned) */}
            <div className="absolute bottom-4 left-0 right-0 h-12 w-full px-4 pointer-events-none">
                <div className="w-full h-full relative">
                     {/* Left Fade */}
                     <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-light-card dark:from-dark-card to-transparent z-10"></div>
                     {/* Right Fade */}
                     <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-light-card dark:from-dark-card to-transparent z-10"></div>
                     
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData}>
                            <defs>
                                <linearGradient id={`gradient-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={chartColor} 
                                strokeWidth={3} 
                                fill={`url(#gradient-${account.id})`}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            {/* Actions (Visible on Hover) */}
             <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                <button 
                    onClick={handleAdjustBalanceClick} 
                    className="p-1.5 rounded-full bg-white dark:bg-black/40 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-white/10 shadow-sm border border-black/5 dark:border-white/10 transition-colors"
                    title="Adjust Balance"
                    disabled={isComputedAccount}
                >
                    <span className="material-symbols-outlined text-xs">tune</span>
                </button>
                <button 
                     onClick={handleEditClick} 
                     className="p-1.5 rounded-full bg-white dark:bg-black/40 text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-white/10 shadow-sm border border-black/5 dark:border-white/10 transition-colors"
                     title="Edit Account"
                >
                     <span className="material-symbols-outlined text-xs">edit</span>
                </button>
             </div>
        </div>
    );
};

export default AccountRow;
