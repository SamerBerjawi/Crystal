import React from 'react';
import { formatCurrency, getMainCurrency } from '../utils';
import { Currency } from '../types';
import { Badge, Sparkline } from './ui/Display';
import { Amount, FormattedAmount } from './ui/Money';

interface FinancialOverviewProps {
    netWorth: number;
    income: number;
    expenses: number;
    incomeChange?: string | null;
    expenseChange?: string | null;
    incomeSparkline?: { value: number }[];
    expenseSparkline?: { value: number }[];
    currency?: Currency;
    size?: 's' | 'm' | 'l';
}

const Tile: React.FC<{ label: string; children: React.ReactNode; trend?: React.ReactNode }> = ({ label, children, trend }) => (
    <div className="flex flex-col justify-between gap-1 rounded-[var(--radius-md)] bg-inset p-3">
        <span className="type-label text-muted">{label}</span>
        <p className="type-figure-row text-ink privacy-blur">{children}</p>
        {trend}
    </div>
);

/** Net worth, then what came in, what went out, and how much of the income the spending used. */
const FinancialOverview: React.FC<FinancialOverviewProps> = ({
    netWorth,
    income,
    expenses,
    incomeSparkline = [],
    expenseSparkline = [],
    currency = getMainCurrency(),
    size = 'm'
}) => {
    const netCashFlow = income - expenses;
    const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;
    const isPositiveNet = netCashFlow >= 0;
    const flowIntensity = income > 0 ? (expenses / income) * 100 : (expenses > 0 ? 100 : 0);
    const compact = (value: number, showPlusSign = false) => formatCurrency(value, currency, { compact: true, showPlusSign });

    return (
        <div className="flex h-full flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <span className="type-label text-muted">Net worth</span>
                    <p className="type-figure-lg text-ink"><Amount value={netWorth} currency={currency} /></p>
                </div>
                <Badge tone={isPositiveNet ? 'positive' : 'negative'} icon={isPositiveNet ? 'trending_up' : 'trending_down'} className="shrink-0">
                    {Math.abs(savingsRate).toFixed(0)}% {savingsRate >= 0 ? 'saved' : 'overspent'}
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <Tile label="Net flow">
                    <span className={isPositiveNet ? 'text-money-in' : 'text-money-out'}><FormattedAmount text={compact(netCashFlow, true)} /></span>
                    <span className="type-caption ml-1.5 text-muted">{isPositiveNet ? 'surplus' : 'deficit'}</span>
                </Tile>
                <Tile label="Money in" trend={size !== 's' && <Sparkline data={incomeSparkline} isPositive width={120} height={20} preserveAspect={false} className="w-full" />}>
                    <FormattedAmount text={compact(income)} />
                </Tile>
                <Tile label="Money out" trend={size !== 's' && <Sparkline data={expenseSparkline} isPositive={false} width={120} height={20} preserveAspect={false} className="w-full" />}>
                    <FormattedAmount text={compact(expenses)} />
                </Tile>
            </div>

            {size !== 's' && (
                <div className="rounded-[var(--radius-md)] bg-inset p-3">
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="type-label text-muted">Spent of what came in</span>
                        <span className={`type-figure-row ${flowIntensity > 100 ? 'text-money-out' : 'text-ink'}`}>{flowIntensity.toFixed(0)}%</span>
                    </div>
                    <div
                        role="progressbar"
                        aria-label="Spent of what came in"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(Math.round(flowIntensity), 100)}
                        className="h-2 overflow-hidden rounded-full bg-line-strong"
                    >
                        <div
                            className={`h-full rounded-full transition-[width] duration-[var(--duration-medium)] ${flowIntensity > 100 ? 'bg-money-out' : 'bg-primary'}`}
                            style={{ width: `${Math.max(Math.min(flowIntensity, 100), flowIntensity > 0 ? 3 : 0)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialOverview;
