import React, { useMemo, useState } from 'react';
import { parseLocalDate, getMainCurrency } from '../utils';
import type { ForecastDay, ForecastEvent } from '../utils/forecastModel';
import { Badge, DayGroup } from './ui/Display';
import { TextInput } from './ui/Fields';
import { Amount } from './ui/Money';
import { ShowMore } from './ui/Display';

const PAGE = 40;
const KIND_LABEL = { recurring: 'Recurring', bill: 'One-time', loan: 'Loan', card: 'Card', property: 'Property', goal: 'Goal' };

interface ForecastListProps {
  days: ForecastDay[];
  accountName: (id?: string) => string | undefined;
  onOpen: (event: ForecastEvent) => void;
}

const dayLabel = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

/** Day by day, with the lowest point overall and in each month marked (FCT-07). */
const ForecastList: React.FC<ForecastListProps> = ({ days, accountName, onOpen }) => {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const { overall, monthly } = useMemo(() => {
    const months = new Map<string, ForecastDay>();
    let low: ForecastDay | undefined;
    for (const day of days) {
      if (!low || day.total < low.total) low = day;
      const key = day.date.slice(0, 7);
      const current = months.get(key);
      if (!current || day.total < current.total) months.set(key, day);
    }
    return { overall: low?.date, monthly: new Set([...months.values()].map(day => day.date)) };
  }, [days]);

  const shown = useMemo(() => {
    const text = search.trim().toLowerCase();
    return days
      .map(day => ({ day, events: day.events.filter(event => !text || event.description.toLowerCase().includes(text)) }))
      .filter(item => item.events.length > 0);
  }, [days, search]);

  return (
    <section aria-label="Forecast list" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
      <TextInput className="mb-3 max-w-sm" label="Search the forecast" value={search} onChange={value => { setSearch(value); setLimit(PAGE); }} />
      {shown.length === 0 ? (
        <p className="type-body text-muted">Nothing matches.</p>
      ) : (
        <div className="space-y-2">
          {shown.slice(0, limit).map(({ day, events }) => (
            <DayGroup
              key={day.date}
              label={
                <span className="flex flex-wrap items-center gap-2">
                  {dayLabel(day.date)}
                  {day.date === overall ? <Badge tone="negative">Lowest</Badge> : monthly.has(day.date) ? <Badge tone="attention">Month's lowest</Badge> : null}
                </span>
              }
              total={<Amount value={day.total} currency={getMainCurrency()} />}
            >
              <ul className="divide-y divide-line">
                {events.map(event => (
                  <li key={event.key}>
                    <button type="button" onClick={() => onOpen(event)} className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 py-1.5 text-left">
                      <span className="min-w-0">
                        <span className="type-body-strong block truncate text-ink">{event.description}</span>
                        <span className="type-caption block truncate text-muted">{[KIND_LABEL[event.kind], accountName(event.accountId), event.overdue ? 'Overdue' : ''].filter(Boolean).join(', ')}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="type-figure-row block text-ink"><Amount value={event.amount} currency={getMainCurrency()} tone="flow" /></span>
                        <span className="type-caption block text-muted">Leaves <Amount value={event.balanceAfter} currency={getMainCurrency()} /></span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </DayGroup>
          ))}
          <ShowMore remaining={shown.length - limit} onPress={() => setLimit(value => value + PAGE)} />
        </div>
      )}
    </section>
  );
};

export default ForecastList;
