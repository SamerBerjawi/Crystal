import React from 'react';
import { getPreferredTimeZone, parseLocalDate, getMainCurrency } from '../utils';
import { Currency } from '../types';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { useWidgetBox } from './ui/WidgetGrid';

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
    const { width, height } = useWidgetBox();
    // Four tiles across when there is width, two by two otherwise. With little height each period becomes one line.
    const columns = width >= 640 ? 4 : 2;
    const tileHeight = height > 0 ? height / (forecasts.length / columns || 1) : Infinity;
    const asList = (width > 0 && width < 300) || tileHeight < 78;
    const showNote = tileHeight >= 118;
    const lowest = Math.min(...forecasts.map(item => item.lowestBalance));

    return (
        <div className={asList ? 'flex h-full flex-col justify-around divide-y divide-line' : `grid h-full gap-3 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-2'}`} style={asList ? undefined : { gridAutoRows: '1fr' }}>
            {forecasts.map(item => {
                const isNegative = item.lowestBalance < 0;
                // The lowest point of all the periods is the one to watch: amber, or red when it goes below zero.
                const isLowest = !isNegative && item.lowestBalance === lowest;
                const state = isNegative
                    ? { icon: 'alert-02', iconTone: 'text-money-out', tile: 'bg-money-out-soft', note: 'Below zero' }
                    : isLowest
                        ? { icon: 'alert-circle', iconTone: 'text-attention-text', tile: 'bg-amber-soft', note: 'Lowest point ahead' }
                        : { icon: 'checkmark-circle-02', iconTone: 'text-money-in', tile: 'bg-inset', note: 'Comfortable' };
                const day = parseLocalDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });

                if (asList) {
                    return (
                        <div key={item.period} className="flex min-h-0 items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                            <span className="type-caption flex min-w-0 items-center gap-2 text-muted">
                                <Icon name={state.icon} size={14} className={`shrink-0 ${state.iconTone}`} aria-label={state.note} />
                                <span className="truncate">{item.period}</span>
                            </span>
                            <span className="flex shrink-0 items-baseline gap-2">
                                <span className="type-body-strong"><Amount value={item.lowestBalance} currency={currency as Currency} tone="loss" /></span>
                                <span className="type-caption text-muted">{day}</span>
                            </span>
                        </div>
                    );
                }

                return (
                    <div key={item.period} className={`flex min-h-0 flex-col justify-center rounded-[var(--radius-md)] ${state.tile} p-3.5`}>
                        <div className="mb-1 flex items-start justify-between gap-2">
                            <span className="type-label text-muted">{item.period}</span>
                            <Icon name={state.icon} size={16} className={state.iconTone} aria-label={state.note} />
                        </div>
                        <p className="type-figure-lg"><Amount value={item.lowestBalance} currency={currency as Currency} tone="loss" /></p>
                        {showNote
                            ? <p className="type-caption mt-2 border-t border-line pt-2 text-muted">{state.note !== 'Comfortable' && <span className="font-bold text-ink">{state.note} · </span>}Lowest on {day}</p>
                            : <p className="type-caption mt-0.5 text-muted">{day}</p>}
                    </div>
                );
            })}
        </div>
    );
};

export default ForecastOverview;
