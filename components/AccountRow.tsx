
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
        if (account.type === 'Loan' || account.type === 'Lending') {
             if (account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined) {
                 const overrides = loanPaymentOverrides[account.id] || {};
                 const schedule = generateAmortizationSchedule(account, transactions, overrides);
                 
                 const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
                 const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
                 const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
                 const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
                
                 const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
                 const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);
                 
                 const totalOutstanding = outstandingPrincipal + outstandingInterest;
                 return account.type === 'Loan' ? -totalOutstanding : totalOutstanding;
             }

             if (account.totalAmount) {
                const isLending = account.type === 'Lending';
                const loanPayments = transactions.filter(tx => tx.type === (isLending ? 'expense' : 'income'));
                const totalPaid = loanPayments.reduce((sum, tx) => {
                    const totalPayment = (tx.principalAmount || 0) + (tx.interestAmount || 0);
                    return sum + (totalPayment > 0 ? totalPayment : tx.amount);
                }, 0);
                const outstanding = account.totalAmount - totalPaid;
                return isLending ? outstanding : -outstanding;
             }
        }
        return account.balance;
    }, [account, transactions, loanPaymentOverrides]);

    const { sparklineData, trend, isPositiveTrend } = useMemo(() => {
        const NUM_POINTS = 90;
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 90);

        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let currentBal = convertToEur(displayBalance, account.currency);
        
        const txsByDate: Record<string, number> = {};
        sortedTransactions.forEach(tx => {
            const dateStr = tx.date;
            const amount = convertToEur(tx.amount, tx.currency);
            txsByDate[dateStr] = (txsByDate[dateStr] || 0) + amount;
        });

        const runningDate = new Date(endDate);
        const history: number[] = [];
        let runningBal = currentBal;

        for (let i = 0; i < NUM_POINTS; i++) {
            history.push(runningBal);
            const dateStr = toLocalISOString(runningDate);
            const change = txsByDate[dateStr] || 0;
            runningBal -= change;
            runningDate.setDate(runningDate.getDate() - 1);
        }
        
        const data = history.reverse().map(val => ({ value: Math.max(0, val) }));

        const trendVal = data[data.length - 1].value - data[0].value;
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
    let bgGradient = "bg-white dark:bg-dark-card";
    let cardTheme = "white"; // Default white theme
    
    if (account.type === 'Checking') {
        bgGradient = "bg-gradient-to-br from-indigo-500 to-indigo-700 text-white";
        cardTheme = "colored";
    } else if (account.type === 'Savings') {
        bgGradient = "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white";
        cardTheme = "colored";
    } else if (account.type === 'Credit Card') {
        bgGradient = "bg-gradient-to-br from-rose-500 to-rose-700 text-white";
        cardTheme = "colored";
    } else if (account.type === 'Investment') {
        bgGradient = "bg-gradient-to-br from-indigo-600 to-primary-700 text-white";
        cardTheme = "colored";
    }

    const logoUrl = account.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, merchantLogoOverrides, { type: 'icon', fallback: 'lettermark', width: 64, height: 64 }) : null;
    const showLogo = !!logoUrl && !logoError;

    const colorConfig: Record<string, { bg: string, text: string, border: string, icon: string }> = {
        Checking: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', icon: 'payments' },
        'Credit Card': { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20', icon: 'credit_card' },
        Investment: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20', icon: 'trending_up' },
        Lending: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/20', icon: 'account_balance' },
        Loan: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', icon: 'account_balance' },
        'Other Assets': { bg: 'bg-lime-500/10', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-500/20', icon: 'category' },
        Property: { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20', icon: 'location_on' },
        Savings: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', icon: 'savings' },
        Vehicle: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20', icon: 'directions_car' },
        'Other Liabilities': { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/20', icon: 'warning' },
    };


    const currentConfig = colorConfig[account.type] || colorConfig['Other Assets'];

    const glowColors: Record<string, string> = {
        Checking: 'rgba(59, 130, 246, 0.25)', // Blue
        'Credit Card': 'rgba(244, 63, 94, 0.25)', // Rose
        Investment: 'rgba(139, 92, 246, 0.25)', // Violet
        Lending: 'rgba(20, 184, 166, 0.25)', // Teal
        Loan: 'rgba(239, 68, 68, 0.25)', // Red
        'Other Assets': 'rgba(132, 204, 22, 0.25)', // Lime
        Property: 'rgba(14, 165, 233, 0.25)', // Sky
        Savings: 'rgba(16, 185, 129, 0.25)', // Emerald
        Vehicle: 'rgba(100, 116, 139, 0.25)', // Slate
        'Other Liabilities': 'rgba(236, 72, 153, 0.25)', // Pink
    };

    const glowColor = glowColors[account.type] || 'rgba(156, 163, 175, 0.25)';

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
                relative group cursor-pointer
                w-full bg-white dark:bg-dark-card rounded-[2rem] border-l-4 border-y border-r border-black/5 dark:border-white/5
                p-6 flex flex-col justify-between h-[210px]
                transition-all duration-300 hover:-translate-y-1
                ${account.status === 'closed' ? 'opacity-60 grayscale' : ''}
                ${dragClasses} ${dragOverClasses}
            `}
            style={{ 
                borderLeftColor: currentConfig.text.includes('blue') ? '#3b82f6' : 
                                currentConfig.text.includes('emerald') ? '#10b981' :
                                currentConfig.text.includes('rose') ? '#f43f5e' :
                                currentConfig.text.includes('violet') ? '#8b5cf6' :
                                currentConfig.text.includes('amber') ? '#f59e0b' :
                                currentConfig.text.includes('teal') ? '#14b8a6' :
                                currentConfig.text.includes('sky') ? '#0ea5e9' :
                                currentConfig.text.includes('slate') ? '#64748b' :
                                currentConfig.text.includes('orange') ? '#f97316' :
                                currentConfig.text.includes('lime') ? '#84cc16' :
                                currentConfig.text.includes('red') ? '#ef4444' : '#3b82f6',
                boxShadow: `0 10px 40px -10px ${glowColor}`
            }}
        >
            {/* Inner Glow Effect */}
            <div 
                className="absolute inset-0 pointer-events-none rounded-[2rem] overflow-hidden"
                style={{ 
                    background: `radial-gradient(circle at 0% 0%, ${glowColor} 0%, transparent 50%)`,
                    opacity: 0.6
                }}
            />

            {/* Action Bar Overlay */}
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <button 
                    onClick={handleAdjustBalanceClick} 
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary transition-all"
                    title="Adjust Balance"
                    disabled={isComputedAccount}
                >
                    <span className="material-symbols-outlined text-base">tune</span>
                </button>
                <button 
                    onClick={handleEditClick} 
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary transition-all"
                    title="Edit Account"
                >
                    <span className="material-symbols-outlined text-base">edit</span>
                </button>
            </div>

            <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-2xl ${currentConfig.bg} ${currentConfig.text} flex items-center justify-center border ${currentConfig.border} transition-transform duration-500 group-hover:scale-110 overflow-hidden`}>
                            {showLogo ? (
                                <img src={logoUrl!} alt="" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
                            ) : (
                                <span className="material-symbols-outlined text-2xl">{iconName}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest opacity-60 mb-0.5 truncate">
                                {account.financialInstitution || account.type}
                            </p>
                            <h3 className="text-lg font-black text-light-text dark:text-dark-text tracking-tight truncate leading-tight">
                                {account.name}
                            </h3>
                        </div>
                    </div>

                    <div className="space-y-0.5">
                        <p className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums privacy-blur">
                            {formatCurrency(convertToEur(displayBalance, account.currency), 'EUR')}
                        </p>
                        {account.currency !== 'EUR' && (
                            <p className="text-xs font-mono font-medium text-light-text-secondary dark:text-dark-text-secondary privacy-blur">
                                {formatCurrency(displayBalance, account.currency)}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-end justify-between mt-auto">
                    <div className="flex flex-col">
                        {/* Trend Badge - Now part of the flow instead of absolute */}
                        {transactions.length > 0 && Math.abs(trend) > 0 && (
                            <div className="flex items-center gap-1 text-[12px] font-bold">
                                <span className={isPositiveTrend ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                    {isPositiveTrend ? '▲' : '▼'}
                                </span>
                                <span className="text-light-text-secondary dark:text-dark-text-secondary font-mono">
                                    {formatCurrency(Math.abs(trend), 'EUR', { showPlusSign: false })}
                                </span>
                                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60 uppercase">
                                    90d
                                </span>
                            </div>
                        )}

                        {account.last4 && (
                            <span className="text-[10px] font-mono font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-50">
                                •••• {account.last4}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                         {isLinkedToEnableBanking && (
                             <span className="material-symbols-outlined text-emerald-500 text-lg animate-pulse" title="Live Sync Active">sync</span>
                         )}
                         <div className={`h-12 w-48 opacity-40 group-hover:opacity-100 transition-opacity`}>
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={sparklineData}>
                                    <defs>
                                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountRow;
