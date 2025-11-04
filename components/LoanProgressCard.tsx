import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';

interface LoanProgressCardProps {
    title: string;
    paid: number;
    total: number;
    currency: Currency;
}

const LoanProgressCard: React.FC<LoanProgressCardProps> = ({ title, paid, total, currency }) => {
    const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
    const isOverpaid = paid > total;

    return (
        <Card>
            <h3 className="text-base font-semibold text-light-text-secondary dark:text-dark-text-secondary">{title}</h3>
            <div className="mt-2">
                <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                    {formatCurrency(paid, currency)}
                </p>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    of {formatCurrency(total, currency)}
                </p>
            </div>
            <div className="mt-4">
                <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    <span>Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2.5 shadow-inner">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${isOverpaid ? 'bg-yellow-400' : 'bg-primary-500'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </Card>
    );
};

export default LoanProgressCard;
