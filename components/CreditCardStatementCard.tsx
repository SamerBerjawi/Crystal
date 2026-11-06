import React, { useMemo } from 'react';
import Card from './Card';
import { Currency } from '../types';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, getCardNetworkLogoUrl } from '../utils/brandfetch';
import { LogoTile } from './EntityIcon';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';
import { LinearGauge } from './ui/StatGauge';

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
    /** The statement that closed before this one. Balance is what it came to, and amountPaid what has been paid since. */
    previousStatement?: StatementInfo;
    currentStatement: StatementInfo;
    nextStatement: StatementInfo;
    noCard?: boolean;
}

type Phase = 'last' | 'this' | 'next';

/** The card's one-line state for a statement: settled, still owed, a credit, or not closed yet. */
const phaseStatus = (phase: Phase, data: StatementInfo): { label: string; tone: 'positive' | 'negative' | 'neutral' | 'attention'; icon: string } => {
    if (phase === 'last') {
        const owed = data.balance < 0 ? Math.abs(data.balance) : 0;
        if (owed === 0) return { label: data.balance > 0 ? 'Credit' : 'Nothing owed', tone: 'neutral', icon: 'check' };
        const paid = data.amountPaid || 0;
        return paid >= owed ? { label: 'Paid', tone: 'positive', icon: 'check' } : { label: paid > 0 ? 'Part paid' : 'To pay', tone: 'attention', icon: 'alert-circle' };
    }
    return phase === 'this' ? { label: 'Building up', tone: 'neutral', icon: 'clock-01' } : { label: 'Not started', tone: 'neutral', icon: 'calendar-03' };
};

const StatementColumn: React.FC<{ phase: Phase; title: string; data: StatementInfo; currency: Currency; compact: boolean }> = ({ phase, title, data, currency, compact }) => {
    const status = phaseStatus(phase, data);
    const owed = phase === 'last' && data.balance < 0 ? Math.abs(data.balance) : 0;
    const left = owed > 0 ? Math.max(0, owed - (data.amountPaid || 0)) : 0;
    const highlight = phase === 'this';

    if (compact) {
        return (
            <div className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 ${highlight ? 'bg-primary-soft' : 'bg-inset'}`}>
                <div className="min-w-0">
                    <p className="type-label flex items-center gap-2 text-muted">{title}<Badge tone={status.tone} icon={status.icon}>{status.label}</Badge></p>
                    <p className="type-caption truncate text-muted">{data.period} · due {data.dueDate}</p>
                </div>
                <span className="type-figure-row shrink-0 text-ink"><Amount value={data.balance} currency={currency} /></span>
            </div>
        );
    }

    return (
        <div className={`flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-lg)] p-3.5 ${highlight ? 'bg-primary-soft' : 'bg-inset'}`}>
            <div className="flex items-center justify-between gap-2">
                <h4 className="type-label text-muted">{title}</h4>
                <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
            </div>
            <p className="type-figure-lg text-ink"><Amount value={data.balance} currency={currency} /></p>
            <dl className="type-caption mt-auto space-y-0.5 border-t border-line pt-2 text-muted">
                <div className="flex justify-between gap-2"><dt>Period</dt><dd className="truncate text-ink">{data.period}</dd></div>
                <div className="flex justify-between gap-2"><dt>Due</dt><dd className="text-ink">{data.dueDate}</dd></div>
                {phase === 'last' && owed > 0 && (
                    <div className="flex justify-between gap-2"><dt>{left > 0 ? 'Left to pay' : 'Paid'}</dt><dd className="text-ink"><Amount value={left > 0 ? left : data.amountPaid || owed} currency={currency} /></dd></div>
                )}
            </dl>
        </div>
    );
};

/** One credit card: how much of its limit is used, then the last statement, this one and the next side by side. */
const CreditCardStatementCard: React.FC<CreditCardStatementCardProps> = ({
    accountName,
    accountBalance,
    creditLimit,
    cardNetwork,
    financialInstitution,
    currency,
    previousStatement,
    currentStatement,
    nextStatement,
    noCard = false
}) => {
    const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
    const logoUrl = useMemo(() => {
        if (!brandfetchClientId) return null;
        if (cardNetwork) return getCardNetworkLogoUrl(cardNetwork, brandfetchClientId);
        if (financialInstitution) return getMerchantLogoUrl(financialInstitution, brandfetchClientId);
        return null;
    }, [cardNetwork, financialInstitution, brandfetchClientId]);

    const used = creditLimit && creditLimit > 0 ? (-accountBalance / creditLimit) * 100 : null;

    // The last statement comes from what the current one carries when the caller did not pass it separately.
    const last: StatementInfo = previousStatement ?? {
        period: 'Before this statement',
        balance: currentStatement.previousStatementBalance ?? 0,
        dueDate: '—',
        amountPaid: currentStatement.amountPaid,
    };

    const content = (
        <div className="@container h-full">
            <div className="flex h-full flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <LogoTile url={logoUrl} label={accountName} size={28} fallbackIcon="credit-card" />
                        <h3 className="type-body-strong truncate text-ink">{accountName}</h3>
                    </div>
                    {used !== null && (
                        <div className="w-full min-w-[160px] max-w-[280px] @[480px]:w-64">
                            <div className="type-caption mb-1 flex justify-between text-muted">
                                <span>Limit used</span>
                                <span className="tabular-nums text-ink">{used.toFixed(0)}%</span>
                            </div>
                            <LinearGauge fill={used} tone={used > 90 ? 'loss' : used > 75 ? 'amber' : 'pine'} label="Limit used" height={12} />
                        </div>
                    )}
                </div>
                {/* Narrow, each statement is one line. From 560px they are three tiles side by side. */}
                <div className="flex flex-col gap-2 @[560px]:hidden">
                    <StatementColumn phase="last" title="Last" data={last} currency={currency} compact />
                    <StatementColumn phase="this" title="This" data={currentStatement} currency={currency} compact />
                    <StatementColumn phase="next" title="Next" data={nextStatement} currency={currency} compact />
                </div>
                <div className="hidden min-w-0 flex-1 gap-2.5 @[560px]:grid @[560px]:grid-cols-3">
                    <StatementColumn phase="last" title="Last statement" data={last} currency={currency} compact={false} />
                    <StatementColumn phase="this" title="This statement" data={currentStatement} currency={currency} compact={false} />
                    <StatementColumn phase="next" title="Next statement" data={nextStatement} currency={currency} compact={false} />
                </div>
            </div>
        </div>
    );

    if (noCard) return content;
    return <Card>{content}</Card>;
};

export default CreditCardStatementCard;
