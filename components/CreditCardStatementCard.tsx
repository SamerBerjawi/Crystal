
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
    const usedPercentage = creditLimit && creditLimit > 0 ? ((-accountBalance) / creditLimit) * 100 : 0;
    const accentColor = usedPercentage > 85 ? 'rose' : usedPercentage > 60 ? 'amber' : 'primary';

    const StatementBlock: React.FC<{ title: string; data: StatementInfo; isHighlight?: boolean }> = ({ title, data, isHighlight }) => {
        const previousStatementBalance = data.previousStatementBalance || 0;
        const previousStatementDebt = (data.previousStatementBalance || 0) < 0 ? Math.abs(data.previousStatementBalance || 0) : 0;
        const hasPreviousStatement = data.previousStatementBalance !== undefined && Math.abs(previousStatementBalance) > 0;
        const isPaid = (data.amountPaid || 0) >= previousStatementDebt && previousStatementDebt > 0;
        
        return (
            <div className={`relative p-5 rounded-[2rem] border transition-all duration-500 overflow-hidden ${
                isHighlight 
                ? 'bg-primary-500/5 border-primary-500/20 shadow-lg shadow-primary-500/5' 
                : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'
            }`}>
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isHighlight ? 'text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                        {title}
                    </span>
                    {isHighlight && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></span>}
                </div>
                
                <div className="space-y-4 relative z-10">
                    <div>
                        <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40 mb-1">Projected Settlement</p>
                        <p className={`text-2xl font-black tracking-tighter privacy-blur ${isHighlight ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                            {formatCurrency(data.balance, currency)}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-base opacity-40">calendar_today</span>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40 leading-none mb-1">Due Date</p>
                            <p className="text-[10px] font-black text-light-text dark:text-dark-text uppercase tracking-widest leading-none font-mono">{data.dueDate}</p>
                        </div>
                    </div>
                </div>

                {isHighlight && hasPreviousStatement && (
                     <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10 flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-2">
                             <div className={`px-2 py-0.5 rounded-full flex items-center gap-1 text-[8px] font-black uppercase tracking-widest ${isPaid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                <span className={`w-1 h-1 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                {isPaid ? 'Settled' : 'Pending'}
                            </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold opacity-60">{formatCurrency(Math.abs(previousStatementBalance), currency)}</span>
                     </div>
                )}
            </div>
        );
    };

    return (
        <Card className="!bg-transparent !border-none !shadow-none !p-0 overflow-visible group">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Master Info Panel */}
                <div className="lg:w-1/3 p-6 sm:p-8 relative bg-white/40 dark:bg-dark-card/20 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[2rem] flex flex-col justify-between overflow-hidden">
                    <div className={`absolute -right-4 -top-4 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none ${
                        accentColor === 'rose' ? 'bg-rose-500' : accentColor === 'amber' ? 'bg-amber-500' : 'bg-primary-500'
                    }`}></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                                accentColor === 'rose' ? 'bg-rose-500 shadow-rose-500/30' : 
                                accentColor === 'amber' ? 'bg-amber-500 shadow-amber-500/30' : 
                                'bg-primary-500 shadow-primary-500/30'
                            }`}>
                                <span className="material-symbols-outlined text-white text-2xl filled-icon">credit_card</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-light-text dark:text-dark-text truncate leading-tight mb-1">{accountName}</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        accentColor === 'rose' ? 'bg-rose-500 animate-pulse' : 
                                        accentColor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}></span>
                                    <span className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.15em] opacity-60">Digital Settlement Node</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">Outstanding Total</p>
                            <p className={`text-4xl font-black tracking-tighter privacy-blur leading-none ${
                                accentColor === 'rose' ? 'text-rose-600' : 'text-light-text dark:text-dark-text'
                            }`}>
                                {formatCurrency(accountBalance, currency)}
                            </p>
                        </div>
                    </div>
                    
                    {creditLimit && creditLimit > 0 && (
                        <div className="relative z-10 mt-12">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] mb-1">Resource Utilization</p>
                                    <p className="text-xl font-black font-mono leading-none">{usedPercentage.toFixed(0)}%</p>
                                </div>
                                <p className="text-[10px] font-black text-light-text dark:text-dark-text uppercase tracking-widest font-mono opacity-40">
                                    {formatCurrency(creditLimit + accountBalance, currency)} Free
                                </p>
                            </div>
                            <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex p-0.5 border border-black/5">
                                <div className={`h-full rounded-full transition-all duration-1000 ${
                                    accentColor === 'rose' ? 'bg-rose-500' : accentColor === 'amber' ? 'bg-amber-500' : 'bg-primary-500'
                                }`} style={{ width: `${Math.min(usedPercentage, 100)}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sub-State Panels */}
                <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatementBlock title="Active Statement" data={currentStatement} isHighlight={true} />
                    <StatementBlock title="Upcoming Cycle" data={nextStatement} />
                </div>
            </div>
        </Card>
    );
};

export default CreditCardStatementCard;
