import React from 'react';
import { formatCurrency, getPreferredTimeZone, parseLocalDate, getMainCurrency } from '../utils';
import { Currency } from '../types';
import Icon from './ui/Icon';

interface ForecastItem {
    period: string;
    lowestBalance: number;
    date: string;
}

interface ForecastOverviewProps {
    forecasts: ForecastItem[];
    currency?: Currency;
}

/** The lowest your balance gets in each period ahead, with the day it happens. */
const ForecastOverview: React.FC<ForecastOverviewProps> = ({ forecasts, currency = getMainCurrency() }) => {
    const timeZone = getPreferredTimeZone();

    return (
        <div className="@container"><div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
            {forecasts.map(item => {
                const isNegative = item.lowestBalance < 0;
                const isTight = !isNegative && item.lowestBalance < 1000;
                const state = isNegative
                    ? { icon: 'alert-02', iconTone: 'text-money-out', amountTone: 'text-money-out', note: 'Below zero' }
                    : isTight
                        ? { icon: 'alert-circle', iconTone: 'text-attention-text', amountTone: 'text-ink', note: 'Under 1,000' }
                        : { icon: 'checkmark-circle-02', iconTone: 'text-money-in', amountTone: 'text-ink', note: 'Comfortable' };
                const day = parseLocalDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });

                return (
                    <div key={item.period} className="rounded-[var(--radius-md)] bg-inset p-3.5">
                        <div className="mb-1 flex items-start justify-between gap-2">
                            <span className="type-label text-muted">{item.period}</span>
                            <Icon name={state.icon} size={16} className={state.iconTone} aria-label={state.note} />
                        </div>
                        <p className={`type-figure-lg privacy-blur ${state.amountTone}`}>{formatCurrency(item.lowestBalance, currency as Currency)}</p>
                        <p className="type-caption mt-2 border-t border-line pt-2 text-muted">Lowest on {day}</p>
                    </div>
                );
            })}
        </div></div>
    );
};

export default ForecastOverview;
