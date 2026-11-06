import React from 'react';
import { getMainCurrency } from '../utils';
import { Amount } from './ui/Money';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';

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
    const box = useWidgetBox();
    // The total and the bar take about 90px; each type is a 28px line. What does not fit folds into "Other".
    const fit = box.height === 0 ? shown.length : fitRows(box, 28, shown.length, 92);
    const folded = fit >= shown.length ? [] : shown.slice(Math.max(1, fit - 1));
    const rows = fit >= shown.length ? shown : [
        ...shown.slice(0, Math.max(1, fit - 1)),
        { name: `${folded.length} more`, value: folded.reduce((sum, item) => sum + item.value, 0), color: 'var(--line-strong)' },
    ];

    return (
        <div className={`flex h-full flex-col ${box.height > 0 && box.height < 160 ? 'gap-2' : 'gap-4'}`}>
            <p className="type-figure-lg text-ink"><Amount value={totalValue} currency={currency} /></p>
            {shown.length === 0 ? (
                <p className="type-body text-muted">{title === 'Assets' ? 'No assets yet.' : 'No debts.'}</p>
            ) : (
                <>
                    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-inset" aria-hidden>
                        {shown.map(item => <div key={item.name} className="h-full" style={{ width: `${share(item.value)}%`, backgroundColor: item.color }} />)}
                    </div>
                    <ul className="min-h-0 space-y-2 overflow-hidden">
                        {rows.map(item => (
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
