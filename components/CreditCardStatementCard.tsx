
import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';

interface StatementInfo {
    period: string;
    balance: number;
    dueDate: string;
    amountPaid?: number;
    previousStatementBalance?: number;
}

interface CreditCardStatementCardProps {
    accountName: string;
    accountBalance: number;
    creditLimit?: number;
    currency: Currency;
    currentStatement: StatementInfo;
    nextStatement: StatementInfo;
}

const CreditCardStatementCard: React.FC<CreditCardStatementCardProps> = ({ 
    accountName, 
    accountBalance, 
    creditLimit, 
    currency, 
    currentStatement, 
    nextStatement 
}) => {
    const usedPercentage = creditLimit && creditLimit > 0 ? (Math.abs(accountBalance) / creditLimit) * 100 : 0;
    const availableCredit = (creditLimit || 0) - Math.abs(accountBalance);
    
    let progressBarColor = 'bg-orange-400';
    if (usedPercentage > 90) progressBarColor = 'bg-red-500';
    else if (usedPercentage > 75) progressBarColor = 'bg-orange-500';

    const hasSettlementInfo = (currentStatement.amountPaid !== undefined && currentStatement.amountPaid > 0) || (currentStatement.previousStatementBalance !== undefined && Math.abs(currentStatement.previousStatementBalance) > 0);

    return (
        <Card className="p-0 overflow-hidden">
            <div className="p-6 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-dark-bg flex items-center justify-center shadow-sm text-orange-600 dark:text-orange-400 border border-black/5 dark:border-white/5">
                            <span className="material-symbols-outlined">credit_card</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-light-text dark:text-dark-text">{accountName}</h3>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono">
                                Bal: {formatCurrency(accountBalance, currency)}
                            </p>
                        </div>
                    </div>
                    {creditLimit && (
                        <div className="text-right">
                            <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">Available</p>
                            <p className="text-lg font-bold text-light-text dark:text-dark-text">{formatCurrency(availableCredit, currency)}</p>
                        </div>
                    )}
                </div>
                
                {/* Progress Bar */}
                {creditLimit && (
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${progressBarColor} transition-all duration-500`} style={{ width: `${Math.min(usedPercentage, 100)}%` }}></div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/5 dark:divide-white/5">
                {/* Current Statement Block */}
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Current Statement</span>
                        <span className="text-[10px] bg-black/5 dark:bg-white/10 px-2 py-1 rounded text-light-text dark:text-dark-text">{currentStatement.period}</span>
                    </div>
                    
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Balance</span>
                        <span className={`text-xl font-bold ${currentStatement.balance > 0 ? 'text-green-600 dark:text-green-400' : currentStatement.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                            {formatCurrency(currentStatement.balance, currency)}
                        </span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Due Date</span>
                        <span className="font-medium text-light-text dark:text-dark-text">{currentStatement.dueDate}</span>
                    </div>
                    
                    {hasSettlementInfo && (
                         <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-xs">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Paid / Prev Bal</span>
                            <span className="font-medium text-light-text dark:text-dark-text">
                                {formatCurrency(currentStatement.amountPaid || 0, currency)} / {formatCurrency(Math.abs(currentStatement.previousStatementBalance || 0), currency)}
                            </span>
                         </div>
                    )}
                </div>

                {/* Next Statement Block */}
                <div className="p-6 bg-light-bg/30 dark:bg-dark-bg/30">
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Next Cycle</span>
                        <span className="text-[10px] bg-black/5 dark:bg-white/10 px-2 py-1 rounded text-light-text dark:text-dark-text opacity-70">{nextStatement.period}</span>
                    </div>
                    
                     <div className="flex justify-between items-baseline mb-1 opacity-80">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Est. Balance</span>
                        <span className={`text-lg font-bold ${nextStatement.balance > 0 ? 'text-green-600 dark:text-green-400' : nextStatement.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                            {formatCurrency(nextStatement.balance, currency)}
                        </span>
                    </div>
                     <div className="flex justify-between items-center opacity-80">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Future Due</span>
                        <span className="font-medium text-light-text dark:text-dark-text">{nextStatement.dueDate}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default CreditCardStatementCard;
