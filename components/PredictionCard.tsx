
import React, { useMemo } from 'react';
import Card from './Card';
import { Prediction, Transaction, Account } from '../types';
import { formatCurrency, parseDateAsUTC, convertToEur, calculateAccountTotals } from '../utils';

interface PredictionCardProps {
    prediction: Prediction;
    transactions: Transaction[];
    accounts: Account[];
    onDelete: (id: string) => void;
    manualPrice?: number | null; // For price_target predictions
}

const PredictionCard: React.FC<PredictionCardProps> = ({ prediction, transactions, accounts, onDelete, manualPrice }) => {
    const isSpending = prediction.type === 'spending_cap';
    const isPriceTarget = prediction.type === 'price_target';
    const isActive = prediction.status === 'active';

    const analyticsAccounts = useMemo(() => accounts.filter(acc => acc.includeInAnalytics ?? true), [accounts]);
    const analyticsAccountIds = useMemo(() => new Set(analyticsAccounts.map(acc => acc.id)), [analyticsAccounts]);
    const analyticsTransactions = useMemo(
        () => transactions.filter(tx => analyticsAccountIds.has(tx.accountId)),
        [transactions, analyticsAccountIds]
    );

    // Calculate Current/Final Value
    const currentValue = useMemo(() => {
        if (!isActive && prediction.finalAmount !== undefined) {
            return prediction.finalAmount;
        }

        if (isSpending) {
            const start = parseDateAsUTC(prediction.startDate);
            // If active, calc until now.
            const now = new Date();

            return analyticsTransactions
                .filter(tx => {
                    const d = parseDateAsUTC(tx.date);
                    return d >= start && d <= now && tx.type === 'expense' && !tx.transferId && tx.category === prediction.targetName;
                })
                .reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);
        } else if (isPriceTarget) {
            return manualPrice ?? 0;
        } else {
             // Net Worth Goal
             if (prediction.targetId) {
                 const acc = analyticsAccounts.find(a => a.id === prediction.targetId);
                 return acc ? convertToEur(acc.balance, acc.currency) : 0;
             } else {
                 const { netWorth } = calculateAccountTotals(analyticsAccounts.filter(a => a.status !== 'closed'), analyticsTransactions);
                 return netWorth;
             }
        }
    }, [prediction, analyticsTransactions, analyticsAccounts, isActive, isSpending, isPriceTarget, manualPrice]);

    // Status / Progress Logic
    let progress = 0;
    if (prediction.targetAmount !== 0) {
        progress = (currentValue / prediction.targetAmount) * 100;
    }
    
    let statusColor = 'text-gray-500';
    let progressBarColor = 'bg-gray-500';
    let statusText = 'Processing';
    
    if (isActive) {
        if (isSpending) {
            // For spending, lower is better.
            if (progress > 100) {
                statusColor = 'text-red-500';
                progressBarColor = 'bg-red-500';
                statusText = 'Over Limit';
            } else if (progress > 80) {
                statusColor = 'text-amber-500';
                progressBarColor = 'bg-amber-500';
                statusText = 'At Risk';
            } else {
                statusColor = 'text-emerald-500';
                progressBarColor = 'bg-emerald-500';
                statusText = 'On Track';
            }
        } else {
            // For net worth and price target, higher is usually better.
            if (progress >= 100) {
                statusColor = 'text-emerald-500';
                progressBarColor = 'bg-emerald-500';
                statusText = 'Goal Met';
            } else if (progress > 80) {
                 statusColor = 'text-blue-500';
                 progressBarColor = 'bg-blue-500';
                 statusText = 'Close';
            } else {
                 statusColor = 'text-gray-500';
                 progressBarColor = 'bg-gray-500';
                 statusText = 'In Progress';
            }
        }
    } else {
        // Final Result
        if (prediction.status === 'won') {
             statusColor = 'text-emerald-600 dark:text-emerald-400';
             progressBarColor = 'bg-emerald-500';
             statusText = 'Won';
        } else {
             statusColor = 'text-red-600 dark:text-red-400';
             progressBarColor = 'bg-red-500';
             statusText = 'Lost';
        }
    }

    const cardBorder = prediction.status === 'won' 
        ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10' 
        : prediction.status === 'lost' 
            ? 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
            : 'border-black/5 dark:border-white/5 bg-white dark:bg-dark-card';

    // Badge styling based on type
    const badgeStyle = isSpending 
        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        : isPriceTarget 
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            
    const typeLabel = isSpending ? 'Spending Cap' : isPriceTarget ? 'Price Target' : 'Wealth Goal';

    return (
        <Card className={`relative overflow-hidden border ${cardBorder} transition-all hover:shadow-md group`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                     <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeStyle}`}>
                         {typeLabel}
                     </span>
                     <h3 className="font-bold text-lg mt-2 truncate max-w-[200px]" title={prediction.targetName}>{prediction.targetName}</h3>
                </div>
                
                {/* Result Badge */}
                {!isActive && (
                    <div className={`rotate-12 px-3 py-1 border-2 font-black uppercase tracking-widest text-sm rounded-lg ${prediction.status === 'won' ? 'border-emerald-500 text-emerald-600 bg-white/80' : 'border-red-500 text-red-600 bg-white/80'}`}>
                        {prediction.status}
                    </div>
                )}
                {isActive && (
                    <button onClick={() => onDelete(prediction.id)} className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                )}
            </div>

            <div className="space-y-2">
                 <div className="flex justify-between items-end">
                     <span className="text-2xl font-bold font-mono">{formatCurrency(currentValue, 'EUR')}</span>
                     <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Target: {formatCurrency(prediction.targetAmount, 'EUR')}</span>
                 </div>
                 
                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                     <div className={`h-full ${progressBarColor} transition-all duration-1000`} style={{ width: `${Math.min(100, progress)}%` }}></div>
                 </div>
                 
                 <div className="flex justify-between items-center text-xs font-medium pt-1">
                     <span className={statusColor}>{statusText}</span>
                     <span className="text-light-text-secondary dark:text-dark-text-secondary">
                         {isActive ? `Ends ${parseDateAsUTC(prediction.endDate).toLocaleDateString()}` : `Ended ${parseDateAsUTC(prediction.endDate).toLocaleDateString()}`}
                     </span>
                 </div>
            </div>
            
            {prediction.status === 'won' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <span className="material-symbols-outlined text-8xl text-emerald-500">emoji_events</span>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default PredictionCard;
