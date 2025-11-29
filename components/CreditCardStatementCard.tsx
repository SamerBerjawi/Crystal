
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
    const progressBarColor = usedPercentage > 90 ? 'bg-red-500' : usedPercentage > 75 ? 'bg-orange-500' : 'bg-blue-500';

    const StatementBlock: React.FC<{ title: string; data: StatementInfo; isHighlight?: boolean }> = ({ title, data, isHighlight }) => {
        const isPaid = (data.amountPaid || 0) >= Math.abs(data.previousStatementBalance || 0) && Math.abs(data.previousStatementBalance || 0) > 0;
        return (
            <div className={`p-4 rounded-xl border ${isHighlight ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' : 'bg-gray-50 dark:bg-white/5 border-transparent'}`}>
                <div className="flex justify-between items-center mb-3">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${isHighlight ? 'text-blue-700 dark:text-blue-300' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{title}</h4>
                    {isPaid && title.includes("Current") && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                            <span className="material-symbols-outlined text-xs">check</span> Paid
                        </span>
                    )}
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Balance</span>
                        <span className="text-lg font-bold text-light-text dark:text-dark-text">{formatCurrency(data.balance, currency)}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Due Date</span>
                        <span className={`text-sm font-semibold ${title.includes("Current") ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{data.dueDate}</span>
                    </div>
                </div>
                {title.includes("Current") && (data.previousStatementBalance !== undefined && Math.abs(data.previousStatementBalance) > 0) && (
                     <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex justify-between text-xs">
                        <span className="text-light-text-secondary dark:text-dark-text-secondary">Prev. Bill</span>
                        <span className="font-mono">{formatCurrency(Math.abs(data.previousStatementBalance), currency)}</span>
                     </div>
                )}
            </div>
        );
    };

    return (
        <Card className="border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 h-full">
                {/* Left: Card Info */}
                <div className="md:w-1/3 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">credit_card</span>
                            </div>
                            <h3 className="font-bold text-lg text-light-text dark:text-dark-text truncate">{accountName}</h3>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary ml-11 mb-6">Statement Summary</p>
                    </div>
                    
                    {creditLimit && creditLimit > 0 && (
                        <div>
                            <div className="flex justify-between text-xs font-medium mb-1.5">
                                <span className="text-light-text-secondary dark:text-dark-text-secondary">Credit Used</span>
                                <span className="text-light-text dark:text-dark-text">{usedPercentage.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden mb-2">
                                <div className={`h-full rounded-full ${progressBarColor}`} style={{ width: `${Math.min(usedPercentage, 100)}%` }}></div>
                            </div>
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary text-right">
                                {formatCurrency(creditLimit - Math.abs(accountBalance), currency)} available
                            </p>
                        </div>
                    )}
                </div>

                {/* Right: Statements Grid */}
                <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatementBlock title="Current Statement" data={currentStatement} isHighlight={true} />
                    <StatementBlock title="Next Statement" data={nextStatement} />
                </div>
            </div>
        </Card>
    );
};

export default CreditCardStatementCard;
