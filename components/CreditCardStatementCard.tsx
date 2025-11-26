
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
    
    let progressBarColor = 'bg-orange-400';
    if (usedPercentage > 90) progressBarColor = 'bg-red-500';
    else if (usedPercentage > 75) progressBarColor = 'bg-orange-500';

    const hasSettlementInfo = (currentStatement.amountPaid !== undefined && currentStatement.amountPaid > 0) || (currentStatement.previousStatementBalance !== undefined && Math.abs(currentStatement.previousStatementBalance) > 0);

    const renderStatementBlock = (title: string, data: StatementInfo) => {
        const balanceColor = data.balance > 0 ? 'text-green-500' : data.balance < 0 ? 'text-red-500' : 'text-light-text dark:text-dark-text';
        return (
           <div className="flex flex-col h-full justify-between">
               <div>
                   <h4 className="font-semibold text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase mb-2 tracking-wider">{title}</h4>
                   <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3 font-medium bg-black/5 dark:bg-white/5 py-1 px-2 rounded inline-block">
                       {data.period}
                   </p>
               </div>
               <div className="flex items-end justify-between">
                   <div>
                       <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-0.5">Balance</p>
                       <p className={`text-xl font-bold ${balanceColor}`}>{formatCurrency(data.balance, currency)}</p>
                   </div>
                   <div className="text-right">
                       <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-0.5">Due</p>
                       <p className="font-semibold text-light-text dark:text-dark-text text-sm">{data.dueDate}</p>
                   </div>
               </div>
           </div>
        );
   }

    return (
        <Card className="flex flex-col h-full">
            {/* Header Row: Account Name + Previous Settle + Credit Available */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-black/10 dark:border-white/10 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                        <span className="material-symbols-outlined">credit_card</span>
                    </div>
                    <h3 className="font-bold text-xl text-light-text dark:text-dark-text truncate">{accountName}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-6 md:gap-8 ml-12 md:ml-0">
                    {/* Previous Settlement */}
                    {hasSettlementInfo && (
                        <div className="flex flex-col items-start md:items-end">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider font-semibold">Prev. Settlement</p>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <p className={`font-bold ${currentStatement.amountPaid && currentStatement.amountPaid > 0 ? 'text-green-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                    {formatCurrency(currentStatement.amountPaid || 0, currency)}
                                </p>
                                {currentStatement.previousStatementBalance !== undefined && (
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        / {formatCurrency(Math.abs(currentStatement.previousStatementBalance), currency)}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Available Credit */}
                    {creditLimit && creditLimit > 0 && (
                        <div className="flex flex-col min-w-[140px]">
                            <div className="flex justify-between items-baseline">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider font-semibold">Available</p>
                                <p className="text-xs font-bold text-light-text dark:text-dark-text">
                                    {formatCurrency(creditLimit - Math.abs(accountBalance), currency)}
                                </p>
                            </div>
                            <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-1.5 mt-1.5 shadow-inner">
                                <div
                                    className={`${progressBarColor} h-1.5 rounded-full transition-all duration-300`}
                                    style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-grow">
                {/* Current Statement */}
                <div className="md:border-r md:border-black/5 md:dark:border-white/5 md:pr-8 pb-4 md:pb-0 border-b md:border-b-0 border-black/5 dark:border-white/5">
                    {renderStatementBlock("Current Statement", currentStatement)}
                </div>

                {/* Next Statement */}
                <div>
                    {renderStatementBlock("Next Statement", nextStatement)}
                </div>
            </div>
        </Card>
    );
};

export default CreditCardStatementCard;
