import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';

interface CreditCardStatementCardProps {
    title: string;
    balance: number;
    currency: Currency;
    statementPeriod: string;
    paymentDueDate: string;
}

const CreditCardStatementCard: React.FC<CreditCardStatementCardProps> = ({ title, balance, currency, statementPeriod, paymentDueDate }) => {
    return (
        <Card>
            <h3 className="font-semibold text-lg text-light-text dark:text-dark-text">{title}</h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{statementPeriod}</p>
            <div className="flex items-end justify-between mt-4">
                <div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Balance</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(balance, currency)}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Payment Due</p>
                    <p className="font-semibold text-light-text dark:text-dark-text">{paymentDueDate}</p>
                </div>
            </div>
        </Card>
    );
};

export default CreditCardStatementCard;