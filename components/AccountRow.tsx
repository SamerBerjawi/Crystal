
import React, { useMemo, useState } from 'react';
import { Account, OtherAssetSubType, OtherLiabilitySubType, Transaction, Warrant } from '../types';
import { convertToEur, formatCurrency, generateAmortizationSchedule, toLocalISOString } from '../utils';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl } from '../utils/brandfetch';

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
    const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
    const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
    const [logoError, setLogoError] = useState(false);

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
        const NUM_POINTS = 20;
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
        styleConfig = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType] || styleConfig;
    } else if (account.type === 'Other Liabilities' && account.otherSubType) {
        styleConfig = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType] || styleConfig;
    }
        
    const typeColor = styleConfig?.color || 'text-gray-500';
    const iconName = account.icon || styleConfig?.icon || 'wallet';

    // Dynamically set stroke color based on trend or account type context
    const chartColor = isPositiveTrend ? '#10B981' : '#F43F5E'; 
    const gradientId = `gradient-${account.id}-${isPositiveTrend ? 'pos' : 'neg'}`;

    const dragClasses = isBeingDragged ? 'opacity-50 scale-95 ring-2 ring-primary-500' : '';
    const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 scale-[1.02]' : '';
    const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

    let detailsText = account.financialInstitution || account.type;
    if (account.type === 'Other Assets' || account.type === 'Other Liabilities') {
        detailsText = account.otherSubType || account.type;
    } else if (account.type === 'Property' && account.propertyType) {
        detailsText = account.propertyType;
    } else if (account.type === 'Investment' && account.subType) {
        detailsText = account.subType;
        if (account.subType === 'Pension Fund' && account.expectedRetirementYear) {
            detailsText = `Pension • Retires ${account.expectedRetirementYear}`;
        } else if (account.subType === 'Spare Change' && account.linkedAccountId) {
            // Ideally we would lookup account name, but here we just indicate it's linked
            detailsText = 'Round-ups Active'; 
        }
    } else if (account.type === 'Savings' && account.apy) {
        detailsText = `${account.financialInstitution || 'Savings'} • ${account.apy}% APY`;
    }

    // Secondary Text fallback
    let secondaryText = detailsText;
    
    const isIncludedInAnalytics = account.includeInAnalytics ?? true;

    // Background Gradient Logic based on Type
    let bgGradient = "bg-white dark:bg-dark-card"; // Default
    if (account.type === 'Checking' || account.type === 'Savings') {
        bgGradient = "bg-gradient-to-br from-white to-blue-50/50 dark:from-dark-card dark:to-blue-900/10";
    } else if (account.type === 'Investment') {
        bgGradient = "bg-gradient-to-br from-white to-purple-50/50 dark:from-dark-card dark:to-purple-900/10";
    } else if (account.type === 'Credit Card' || account.type === 'Loan') {
        bgGradient = "bg-gradient-to-br from-white to-red-50/30 dark:from-dark-card dark:to-red-900/10";
    }

    const logoUrl = account.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, merchantLogoOverrides, { type: 'icon', fallback: 'lettermark', width: 64, height: 64 }) : null;
    const showLogo = !!logoUrl && !logoError;

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
                ${bgGradient}
                rounded-2xl border border-black/5 dark:border-white/10
                shadow-sm hover:shadow-xl hover:-translate-y-1
                transition-all duration-300 ease-out
                w-full h-[210px] p-5 flex flex-col justify-between
                ${cursorClass} ${dragClasses} ${dragOverClasses}
                ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
            `}
        >
            {/* Backdrop Watermark Icon */}
            <div className="absolute -right-4 -bottom-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none transform -rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-0 z-0">
                <span className="material-symbols-outlined text-[120px] select-none">{iconName}</span>
            </div>

            {/* Header Section */}
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`
                            w-10 h-10 rounded-lg flex-shrink-0 shadow-sm overflow-hidden
                            ${showLogo ? 'bg-white' : `bg-white dark:bg-white/10 flex items-center justify-center ${typeColor}`}
                        `}>
                            {showLogo ? (
                                <img 
                                    src={logoUrl!} 
                                    alt={account.financialInstitution} 
                                    className="w-full h-full object-cover" 
                                    onError={() => setLogoError(true)} 
                                />
                            ) : (
                                <span className="material-symbols-outlined text-xl">{iconName}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-light-text dark:text-dark-text truncate leading-tight">
                                {account.name}
                            </h3>
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary truncate font-semibold mt-0.5 tracking-wide uppercase">
                                {secondaryText}
                                {account.last4 && <span className="opacity-70 ml-1">•••• {account.last4}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-1">
                        {isLinkedToEnableBanking && (
                            <span className="material-symbols-outlined text-base text-emerald-500" title="Live Sync Active">link</span>
                        )}
                        {isIncludedInAnalytics ? (
                             <span className="material-symbols-outlined text-base text-blue-400 dark:text-blue-500 opacity-70" title="Included in Analytics">bar_chart</span>
                        ) : (
                             <span className="material-symbols-outlined text-base text-gray-400" title="Hidden from Analytics">visibility_off</span>
                        )}
                         {account.isPrimary && (
                            <span className="material-symbols-outlined text-base text-yellow-500" title="Primary Account">star</span>
                        )}
                    </div>
                </div>

                {/* Balance Section */}
                <div>
                    <p className="text-2xl font-extrabold tracking-tight text-light-text dark:text-dark-text privacy-blur">
                        {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                    </p>
                    {account.currency !== 'EUR' && (
                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono font-medium mt-0.5 privacy-blur opacity-70">
                            {formatCurrency(displayBalance, account.currency)}
                        </p>
                    )}
                </div>
            </div>

            {/* Sparkline Background */}
            <div className="absolute bottom-0 left-0 right-0 h-16 w-full pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-500 z-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.5}/>
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={chartColor} 
                            strokeWidth={2} 
                            fill={`url(#${gradientId})`}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
            {/* Quick Actions (Hover) */}
             <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-20">
                <button 
                    onClick={handleAdjustBalanceClick} 
                    className="p-1.5 rounded-lg bg-white dark:bg-black/80 backdrop-blur-md text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 shadow-md border border-black/5 dark:border-white/10 transition-all active:scale-95"
                    title="Adjust Balance"
                    disabled={isComputedAccount}
                >
                    <span className="material-symbols-outlined text-base block">tune</span>
                </button>
                <button 
                     onClick={handleEditClick} 
                     className="p-1.5 rounded-lg bg-white dark:bg-black/80 backdrop-blur-md text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 shadow-md border border-black/5 dark:border-white/10 transition-all active:scale-95"
                     title="Edit Account"
                >
                     <span className="material-symbols-outlined text-base block">edit</span>
                </button>
             </div>
             
             {/* Trend Badge */}
             {transactions.length > 0 && Math.abs(trend) > 0 && (
                <div className="absolute bottom-3 left-4 z-10 flex items-center gap-1 text-[10px] font-bold bg-white/50 dark:bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-md">
                    <span className={isPositiveTrend ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                         {isPositiveTrend ? '▲' : '▼'}
                    </span>
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">
                        {formatCurrency(Math.abs(trend), 'EUR', { showPlusSign: false })}
                    </span>
                    <span className="text-[8px] opacity-60 uppercase ml-1">30d</span>
                </div>
             )}
        </div>
    );
};

export default AccountRow;
