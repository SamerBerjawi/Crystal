import React from 'react';
import { getMainCurrency } from '../utils';
import { Amount } from './ui/Money';

interface BreakdownItem {
    name: string;
    value: number;
    color: string;
}

interface AccountBreakdownCardProps {
    title: string;
    totalValue: number;
    breakdownData: BreakdownItem[];
}

/** Assets or debts by account type: the total, one bar split by type, and each type's share. The widget frame holds the title. */
const AccountBreakdownCard: React.FC<AccountBreakdownCardProps> = ({ title, totalValue, breakdownData }) => {
    const currency = getMainCurrency();
    const shown = totalValue > 0 ? breakdownData.filter(item => item.value / totalValue >= 0.01) : [];
    const share = (value: number) => (value / totalValue) * 100;

    return (
        <div className="flex h-full flex-col gap-4">
            <p className="type-figure-lg text-ink"><Amount value={totalValue} currency={currency} /></p>
            {shown.length === 0 ? (
                <p className="type-body text-muted">{title === 'Assets' ? 'No assets yet.' : 'No debts.'}</p>
            ) : (
                <>
                    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-inset" aria-hidden>
                        {shown.map(item => <div key={item.name} className="h-full" style={{ width: `${share(item.value)}%`, backgroundColor: item.color }} />)}
                    </div>
                    <ul className="space-y-2">
                        {shown.map(item => (
                            <li key={item.name} className="type-body flex items-center justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2 text-ink">
                                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="truncate">{item.name}</span>
                                </span>
                                <span className="type-figure-row shrink-0 text-ink">
                                    <Amount value={item.value} currency={currency} />
                                    <span className="type-caption ml-2 inline-block w-9 text-right text-muted">{share(item.value).toFixed(0)}%</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default AccountBreakdownCard;
