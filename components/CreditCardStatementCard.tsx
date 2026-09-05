
import React, { useRef, useState, useEffect } from 'react';
import Card from './Card';
import { formatCurrency } from '../utils';
import { Currency } from '../types';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, getCardNetworkLogoUrl } from '../utils/brandfetch';
import Icon from './ui/Icon';

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
    cardNetwork?: string;
    financialInstitution?: string;
    currency: Currency;
    currentStatement: StatementInfo;
    nextStatement: StatementInfo;
    noCard?: boolean;
}

const CreditCardStatementCard: React.FC<CreditCardStatementCardProps> = ({ 
    accountName, 
    accountBalance, 
    creditLimit, 
    cardNetwork,
    financialInstitution,
    currency, 
    currentStatement, 
    nextStatement,
    noCard = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [logoError, setLogoError] = useState(false);
    const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());

    const logoUrl = React.useMemo(() => {
        if (logoError || !brandfetchClientId) return null;
        if (cardNetwork) {
            return getCardNetworkLogoUrl(cardNetwork, brandfetchClientId);
        }
        if (financialInstitution) {
            return getMerchantLogoUrl(financialInstitution, brandfetchClientId);
        }
        return null;
    }, [cardNetwork, financialInstitution, brandfetchClientId, logoError]);

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
            <div className={`p-2.5 sm:p-3 rounded-2xl border flex flex-col justify-between transition-all min-h-0 overflow-hidden ${
                isHighlight 
                    ? 'bg-primary-500/[0.03] dark:bg-primary-500/[0.05] border-primary-500/20 shadow-xs' 
                    : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5'
            }`}>
                <div className="min-h-0">
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-2xs font-bold uppercase tracking-wider ${
                            isHighlight ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                            {title}
                        </span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline leading-tight">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Balance</span>
                            <span className="text-sm sm:text-base font-bold tracking-tight tabular-nums text-slate-900 dark:text-white privacy-blur">
                                {formatCurrency(data.balance, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline leading-tight">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Due Date</span>
                            <span className={`text-xs font-semibold ${isHighlight ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                {data.dueDate}
                            </span>
                        </div>
                    </div>
                </div>

                {title.includes("Current") && hasPreviousStatement && (
                     <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-xs leading-tight">
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                            <span className="text-slate-500 dark:text-slate-400 truncate">{isPreviousCredit ? 'Prev. Credit' : 'Prev. Bill'}</span>
                            {isPaid && (
                                <span className="flex items-center gap-0.5 font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded-full text-2xs uppercase tracking-wider shrink-0">
                                    <Icon name="check" className="text-xs" /> Paid
                                </span>
                            )}
                        </div>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                            {formatCurrency(Math.abs(previousStatementBalance), currency)}
                        </span>
                     </div>
                )}
            </div>
        );
    };

    const content = (
        <div ref={containerRef} className={`flex ${isWide ? 'flex-row' : 'flex-col'} gap-2.5 sm:gap-3 h-full items-stretch`}>
            {/* Left/Top: Card Info */}
            <div className={`p-2.5 sm:p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col justify-between min-h-0 ${isWide ? 'w-1/3' : 'w-full'}`}>
                <div>
                    <div className="flex items-center gap-2 mb-1.5 min-w-0">
                        {logoUrl ? (
                            <img src={logoUrl} alt={accountName} className="w-7 h-7 rounded-xl object-contain bg-white p-1 border border-black/5 shadow-xs shrink-0" onError={() => setLogoError(true)} />
                        ) : (
                            <div className="w-7 h-7 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                                <Icon name="credit_card" className="text-xs" />
                            </div>
                        )}
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{accountName}</h3>
                    </div>
                </div>
                
                {creditLimit && creditLimit > 0 && (
                    <div className="mt-1.5">
                        <div className="flex justify-between text-2xs font-semibold uppercase tracking-wider mb-1 leading-tight">
                            <span className="text-slate-500 dark:text-slate-400">Used</span>
                            <span className="text-slate-900 dark:text-white tabular-nums">{usedPercentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-1.5 overflow-hidden p-0.5">
                            <div 
                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                    usedPercentage > 90 
                                        ? 'bg-rose-500' 
                                        : usedPercentage > 75 
                                        ? 'bg-amber-500' 
                                        : 'bg-primary-500'
                                }`} 
                                style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right/Bottom: Statements Grid */}
            <div className={`flex-1 ${isWide ? 'grid grid-cols-2 gap-2.5 sm:gap-3' : 'space-y-2.5 sm:space-y-3'} w-full min-h-0`}>
                <StatementBlock title="Current" data={currentStatement} isHighlight={true} />
                <StatementBlock title="Next" data={nextStatement} />
            </div>
        </div>
    );

    if (noCard) return content;

    return (
        <Card className="border border-black/5 dark:border-white/5 shadow-xs !rounded-[2rem] p-4">
            {content}
        </Card>
    );
};

export default CreditCardStatementCard;
