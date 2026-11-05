import React, { useMemo } from 'react';
import Card from './Card';
import { Currency } from '../types';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, getCardNetworkLogoUrl } from '../utils/brandfetch';
import { LogoTile } from './EntityIcon';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';

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

const StatementBlock: React.FC<{ title: string; data: StatementInfo; currency: Currency; showPrevious?: boolean }> = ({ title, data, currency, showPrevious }) => {
    const previous = data.previousStatementBalance ?? 0;
    const previousDebt = previous < 0 ? Math.abs(previous) : 0;
    const isPaid = previousDebt > 0 && (data.amountPaid || 0) >= previousDebt;
    return (
        <div className="rounded-[var(--radius-lg)] bg-inset p-3">
            <h4 className="type-label text-muted">{title}</h4>
            <dl className="type-body mt-1 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Balance</dt>
                    <dd className="type-figure-row text-ink"><Amount value={data.balance} currency={currency} /></dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Due</dt>
                    <dd className="text-ink">{data.dueDate}</dd>
                </div>
                {showPrevious && Math.abs(previous) > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-line pt-1">
                        <dt className="flex min-w-0 items-center gap-2 text-muted">
                            <span className="truncate">{previous > 0 ? 'Last statement credit' : 'Last statement'}</span>
                            {isPaid && <Badge tone="positive" icon="check">Paid</Badge>}
                        </dt>
                        <dd className="type-figure-row shrink-0 text-ink"><Amount value={Math.abs(previous)} currency={currency} /></dd>
                    </div>
                )}
            </dl>
        </div>
    );
};

/** One credit card's current and next statement, with how much of the limit is used. */
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
    const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
    const logoUrl = useMemo(() => {
        if (!brandfetchClientId) return null;
        if (cardNetwork) return getCardNetworkLogoUrl(cardNetwork, brandfetchClientId);
        if (financialInstitution) return getMerchantLogoUrl(financialInstitution, brandfetchClientId);
        return null;
    }, [cardNetwork, financialInstitution, brandfetchClientId]);

    const used = creditLimit && creditLimit > 0 ? (-accountBalance / creditLimit) * 100 : null;
    const usedColour = used === null ? '' : used > 90 ? 'bg-money-out' : used > 75 ? 'bg-amber' : 'bg-primary';

    const content = (
        <div className="@container h-full">
            <div className="flex h-full flex-col gap-3 @[500px]:flex-row">
                <div className="flex flex-col justify-between gap-3 @[500px]:w-1/3">
                    <div className="flex min-w-0 items-center gap-2">
                        <LogoTile url={logoUrl} label={accountName} size={28} fallbackIcon="credit-card" />
                        <h3 className="type-body-strong truncate text-ink">{accountName}</h3>
                    </div>
                    {used !== null && (
                        <div>
                            <div className="type-caption mb-1 flex justify-between text-muted">
                                <span>Limit used</span>
                                <span className="tabular-nums text-ink">{used.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden>
                                <div className={`h-full rounded-full ${usedColour}`} style={{ width: `${Math.min(Math.max(used, 0), 100)}%` }} />
                            </div>
                        </div>
                    )}
                </div>
                <div className="grid min-w-0 flex-1 gap-3 @[500px]:grid-cols-2">
                    <StatementBlock title="This statement" data={currentStatement} currency={currency} showPrevious />
                    <StatementBlock title="Next statement" data={nextStatement} currency={currency} />
                </div>
            </div>
        </div>
    );

    if (noCard) return content;
    return <Card>{content}</Card>;
};

export default CreditCardStatementCard;
