
import React, { useRef, useState, useEffect } from 'react';
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
    noCard?: boolean;
}

const CreditCardStatementCard: React.FC<CreditCardStatementCardProps> = ({ 
    accountName, 
    accountBalance, 
    creditLimit, 
    currency, 
    currentStatement, 
    nextStatement,
    noCard = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const isWide = width > 500;
    const usedPercentage = creditLimit && creditLimit > 0 ? ((-accountBalance) / creditLimit) * 100 : 0;
    const progressBarColor = usedPercentage > 90 ? 'bg-red-500' : usedPercentage > 75 ? 'bg-orange-500' : 'bg-blue-500';

    const StatementBlock: React.FC<{ title: string; data: StatementInfo; isHighlight?: boolean }> = ({ title, data, isHighlight }) => {
        const previousStatementBalance = data.previousStatementBalance || 0;
        const previousStatementDebt = (data.previousStatementBalance || 0) < 0 ? Math.abs(data.previousStatementBalance || 0) : 0;
        const hasPreviousStatement = data.previousStatementBalance !== undefined && Math.abs(previousStatementBalance) > 0;
        const isPreviousCredit = previousStatementBalance > 0;
        const isPaid = (data.amountPaid || 0) >= previousStatementDebt && previousStatementDebt > 0;
        return (
            <div className={`p-3 rounded-xl border ${isHighlight ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' : 'bg-gray-50 dark:bg-white/5 border-transparent'}`}>
                <div className="flex justify-between items-center mb-1.5">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${isHighlight ? 'text-blue-700 dark:text-blue-300' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{title}</h4>
                </div>
                <div className="space-y-0.5">
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Balance</span>
                        <span className="text-base font-bold text-light-text dark:text-dark-text">{formatCurrency(data.balance, currency)}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Due Date</span>
                        <span className={`text-[13px] font-semibold ${title.includes("Current") ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{data.dueDate}</span>
                    </div>
                </div>
                {title.includes("Current") && hasPreviousStatement && (
                     <div className="mt-2 pt-1.5 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">{isPreviousCredit ? 'Prev. Credit' : 'Prev. Bill'}</span>
                            {isPaid && (
                                <span className="flex items-center gap-1 font-bold uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded scale-90 origin-left">
                                    <span className="material-symbols-outlined text-[10px]">check</span> Paid
                                </span>
                            )}
                        </div>
                        <span className="font-mono">{formatCurrency(Math.abs(previousStatementBalance), currency)}</span>
                     </div>
                )}
            </div>
        );
    };

    const content = (
        <div ref={containerRef} className={`flex ${isWide ? 'flex-row' : 'flex-col'} gap-3 h-full`}>
            {/* Left/Top: Card Info */}
            <div className={`flex flex-col justify-center ${isWide ? 'w-1/3 border-r pr-3' : 'border-b pb-2'} border-black/5 dark:border-white/5`}>
                <div className="flex items-center gap-3 mb-0.5">
                    <div className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[14px]">credit_card</span>
                    </div>
                    <h3 className="font-bold text-[14px] text-light-text dark:text-dark-text truncate">{accountName}</h3>
                </div>
                
                {creditLimit && creditLimit > 0 && (
                    <div className="mt-0.5">
                        <div className="flex justify-between text-[9px] font-medium mb-0.5">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">Used</span>
                            <span className="text-light-text dark:text-dark-text">{usedPercentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1 overflow-hidden">
                            <div className={`h-full rounded-full ${progressBarColor}`} style={{ width: `${Math.min(usedPercentage, 100)}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right/Bottom: Statements Grid */}
            <div className={`flex-1 ${isWide ? 'grid grid-cols-2 gap-3' : 'space-y-2'} w-full overflow-hidden`}>
                <StatementBlock title="Current" data={currentStatement} isHighlight={true} />
                <StatementBlock title="Next" data={nextStatement} />
            </div>
        </div>
    );

    if (noCard) return content;

    return (
        <Card className="border border-gray-100 dark:border-white/5 shadow-sm">
            {content}
        </Card>
    );
};


export default CreditCardStatementCard;
