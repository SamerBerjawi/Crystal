
import React, { useMemo } from 'react';
import { Account, OtherAssetSubType, OtherLiabilitySubType, Currency, Transaction, Warrant } from '../types';
import Card from './Card';
import { convertCurrency, formatCurrency, convertToEur, generateAmortizationSchedule, toLocalISOString } from '../utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ACCOUNT_TYPE_STYLES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { useScheduleContext } from '../contexts/FinancialDataContext';

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
    const { loanPaymentOverrides } = useScheduleContext();
    
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
                <div className="flex items-center flex-1 min-w-0">
                    <div className={`text-3xl mr-4 flex items-center justify-center w-12 h-12 shrink-0 ${style.color}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
                            {account.icon || style.icon}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-light-text dark:text-dark-text truncate">{account.name}</p>
                        <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                           <span>{secondaryText} {account.last4 ? `•••• ${account.last4}` : ''}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 ml-4">
                    <div className="w-24 h-10 shrink-0">
                        <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                            <LineChart width={96} height={60} data={sparklineData}>
                                 <Line type="natural" dataKey="value" stroke={sparklineColor} strokeWidth={2} dot={true} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-right shrink-0 w-32">
                        <p className={`font-bold text-xl ${isAsset ? 'text-light-text dark:text-dark-text' : 'text-red-500'}`}>
                            {formatCurrency(convertCurrency(displayBalance, account.currency, preferredCurrency, conversionRates), preferredCurrency)}
                        </p>
                         {account.currency !== preferredCurrency && (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {formatCurrency(displayBalance, account.currency)}
                            </p>
                        )}
                    </div>
                    <button onClick={handleEditClick} className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default AccountCard;
