
import React, { useMemo } from 'react';
import { Account, OtherAssetSubType, OtherLiabilitySubType, Currency, Transaction, Warrant } from '../types';
import Card from './Card';
import { convertCurrency, formatCurrency, convertToEur, generateAmortizationSchedule, toLocalISOString } from '../utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { getMerchantLogoUrl, getCardNetworkLogoUrl } from '../utils/brandfetch';

interface AccountCardProps {
    account: Account;
    transactions: Transaction[];
    warrants: Warrant[];
    onClick: () => void;
    onEdit: () => void;
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
    transactions,
    warrants,
    onClick, 
    onEdit, 
    // FIX: Added 'isDraggable' to the destructured props to resolve the 'Cannot find name' error.
    isDraggable,
    isBeingDragged,
    isDragOver,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
}) => {
    const preferredCurrency = usePreferencesSelector(p => (p.currency || 'EUR') as Currency);
    const conversionRates = usePreferencesSelector(p => p.conversionRates);
    const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
    const { loanPaymentOverrides } = useScheduleContext();
    
    const [logoError, setLogoError] = React.useState(false);

    const logoUrl = React.useMemo(() => {
        if (logoError || !brandfetchClientId) return null;
        if (account.type === 'Credit Card' && account.cardNetwork) {
            return getCardNetworkLogoUrl(account.cardNetwork, brandfetchClientId);
        }
        if (account.financialInstitution) {
            return getMerchantLogoUrl(account.financialInstitution, brandfetchClientId);
        }
        return null;
    }, [account, brandfetchClientId, logoError]);
    
    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card's onClick from firing
        onEdit();
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

    const { sparklineData, isPositiveTrend } = useMemo(() => {
        const NUM_POINTS = 90;
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let currentBal = convertToEur(displayBalance, account.currency, conversionRates);
        
        const txsByDate: Record<string, number> = {};
        sortedTransactions.forEach(tx => {
            const dateStr = tx.date;
            const amount = convertToEur(tx.amount, tx.currency, conversionRates);
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
        
        return { sparklineData: data, isPositiveTrend: isPositive };
    }, [account, transactions, displayBalance, conversionRates]);
    
    const isAsset = displayBalance >= 0;
    const sparklineColor = isPositiveTrend ? '#10B981' : '#F43F5E';
    
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
    
    let style = ACCOUNT_TYPE_STYLES[account.type];
    if (account.type === 'Other Assets' && account.otherSubType) {
        style = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType] || style;
    } else if (account.type === 'Other Liabilities' && account.otherSubType) {
        style = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType] || style;
    } else if (account.type === 'Investment' && account.subType) {
        style = INVESTMENT_SUB_TYPE_STYLES[account.subType] || style;
    }

    const dragClasses = isBeingDragged ? 'opacity-50' : '';
    const dragOverClasses = isDragOver ? 'border-t-4 border-primary-500 pt-1' : '';

    // Improved Secondary Text Logic
    // FIX: Explicitly type secondaryText as string to avoid AccountType incompatibility errors
    let secondaryText: string = account.type;
    if (account.type === 'Other Assets' || account.type === 'Other Liabilities') {
        secondaryText = account.otherSubType || account.type;
    } else if (account.type === 'Property' && account.propertyType) {
        secondaryText = account.propertyType;
    } else if (account.type === 'Investment' && account.subType) {
        secondaryText = account.subType;
        if (account.subType === 'Pension Fund' && account.expectedRetirementYear) {
            secondaryText = `Retires: ${account.expectedRetirementYear}`;
        } else if (account.subType === 'Spare Change' && account.linkedAccountId) {
            // Ideally we would lookup account name, but here we just indicate it's linked
            secondaryText = 'Round-ups Active'; 
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
            className={`transition-all duration-150 ${dragOverClasses} ${isDraggable ? 'cursor-grab' : ''}`}
        >
            <Card 
                className={`flex items-center justify-between h-full hover:shadow-lg transition-shadow duration-200 cursor-pointer group ${dragClasses}`} 
                onClick={onClick}
            >
                {/* Inner Glow Effect */}
                <div 
                    className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
                    style={{ 
                        background: `radial-gradient(circle at 0% 0%, ${glowColor} 0%, transparent 60%)`,
                        opacity: 0.5
                    }}
                />
                
                <div className="flex items-center flex-1 min-w-0 relative z-10">
                    <div className={`text-4xl mr-4 flex items-center justify-center w-14 h-14 shrink-0 rounded-2xl bg-black/5 dark:bg-white/10 ${style.color} shadow-inner overflow-hidden`}>
                        {logoUrl ? (
                            <img 
                                src={logoUrl} 
                                alt="" 
                                className="w-full h-full object-contain p-2" 
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <span className="material-symbols-outlined text-light-text dark:text-dark-text opacity-90" style={{ fontSize: '32px' }}>
                                {account.icon || style.icon}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-xl text-light-text dark:text-dark-text truncate leading-tight uppercase tracking-tight">{account.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-base text-light-text-secondary dark:text-dark-text-secondary font-semibold tracking-wide uppercase">
                           <span>{secondaryText} {account.last4 ? `•••• ${account.last4}` : ''}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 ml-4 relative z-10">
                    <div className="hidden sm:block w-20 h-8 shrink-0 opacity-60">
                        <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                            <LineChart width={80} height={32} data={sparklineData}>
                                 <Line type="natural" dataKey="value" stroke={sparklineColor} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-right shrink-0">
                        <p className={`font-black text-2xl tracking-tighter tabular-nums ${isAsset ? 'text-light-text dark:text-dark-text' : 'text-rose-500'}`}>
                            {formatCurrency(convertCurrency(displayBalance, account.currency, preferredCurrency, conversionRates), preferredCurrency)}
                        </p>
                         {account.currency !== preferredCurrency && (
                            <p className="text-[11px] font-black text-light-text-secondary dark:text-dark-text-secondary tabular-nums tracking-widest uppercase opacity-40">
                                {formatCurrency(displayBalance, account.currency)}
                            </p>
                        )}
                    </div>
                    <button onClick={handleEditClick} className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary/40 hover:text-primary-500 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default AccountCard;
