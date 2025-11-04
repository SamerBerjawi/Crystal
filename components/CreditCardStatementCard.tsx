import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';

interface CreditCardStatementCardProps {
    title: string;
    statementBalance: number;
    accountBalance: number;
    creditLimit?: number;
    currency: Currency;
    statementPeriod: string;
    paymentDueDate: string;
}

const CreditCardStatementCard: React.FC<CreditCardStatementCardProps> = ({ title, statementBalance, accountBalance, creditLimit, currency, statementPeriod, paymentDueDate }) => {
    const balanceColor = statementBalance > 0 ? 'text-green-500' : statementBalance < 0 ? 'text-red-500' : 'text-light-text dark:text-dark-text';
    const usedPercentage = creditLimit && creditLimit > 0 ? (Math.abs(accountBalance) / creditLimit) * 100 : 0;
    
    let progressBarColor = 'bg-orange-400';
    if (usedPercentage > 90) progressBarColor = 'bg-red-500';
    else if (usedPercentage > 75) progressBarColor = 'bg-orange-500';

    return (
        <Card>
            <h3 className="font-semibold text-lg text-light-text dark:text-dark-text">{title}</h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{statementPeriod}</p>
            <div className="flex items-end justify-between mt-4">
                <div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Statement Balance</p>
                    <p className={`text-2xl font-bold ${balanceColor}`}>{formatCurrency(statementBalance, currency)}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Payment Due</p>
                    <p className="font-semibold text-light-text dark:text-dark-text">{paymentDueDate}</p>
                </div>
            </div>
            {creditLimit && creditLimit > 0 && (
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between text-xs mb-1 text-light-text-secondary dark:text-dark-text-secondary">
                        <span>Credit Used</span>
                        <span>{formatCurrency(creditLimit - Math.abs(accountBalance), currency)} Available</span>
                    </div>
                    <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-2 shadow-inner">
                        <div
                            className={`${progressBarColor} h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                        ></div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default CreditCardStatementCard;