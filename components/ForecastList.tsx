import React, { useMemo, useState } from 'react';
import { parseLocalDate, getMainCurrency } from '../utils';
import type { ForecastDay, ForecastEvent } from '../utils/forecastModel';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';
import { Badge, ShowMore } from './ui/Display';
import { TextInput } from './ui/Fields';
import { Amount } from './ui/Money';

const PAGE = 60;
const KIND_LABEL = { recurring: 'Recurring', bill: 'One-time', loan: 'Loan', card: 'Card', property: 'Property', goal: 'Goal' };

interface ForecastListProps {
  days: ForecastDay[];
  accountName: (id?: string) => string | undefined;
  onOpen: (event: ForecastEvent) => void;
}

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const monthLabel = (key: string) => parseLocalDate(`${key}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

type Mark = 'global' | 'month' | null;

interface Row { event: ForecastEvent; day: ForecastDay; mark: Mark }
interface Month { key: string; low: ForecastDay; rows: Row[] }

const MARK_STYLE: Record<Exclude<Mark, null>, string> = {
  global: 'bg-money-out-soft',
  month: 'bg-amber-soft',
};

/**
 * The forecast as a ledger, grouped by month: date, where it comes from, what it is, the amount, the balance after
 * it, and what kind of item it is. The lowest balance overall and in each month are marked (FCT-07).
 */
const ForecastList: React.FC<ForecastListProps> = ({ days, accountName, onOpen }) => {
  const isPhone = useIsMobile();
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const { months, overall } = useMemo(() => {
    const lows = new Map<string, ForecastDay>();
    let global: ForecastDay | undefined;
    for (const day of days) {
      if (!global || day.total < global.total) global = day;
      const key = day.date.slice(0, 7);
      const current = lows.get(key);
      if (!current || day.total < current.total) lows.set(key, day);
    }
    const text = search.trim().toLowerCase();
    const grouped = new Map<string, Month>();
    for (const day of days) {
      const events = day.events.filter(event => !text || event.description.toLowerCase().includes(text));
      if (events.length === 0) continue;
      const key = day.date.slice(0, 7);
      const low = lows.get(key)!;
      const month = grouped.get(key) ?? { key, low, rows: [] };
      events.forEach((event, index) => {
        // The balance is lowest at the end of its day, so the mark goes on the day's last event.
        const isLast = index === events.length - 1 && events.length === day.events.length;
        const mark: Mark = isLast && day.date === low.date ? (global && day.date === global.date ? 'global' : 'month') : null;
        month.rows.push({ event, day, mark });
      });
      grouped.set(key, month);
    }
    return { months: [...grouped.values()], overall: global };
  }, [days, search]);

  let remaining = limit;
  const visible = months.map(month => {
    const rows = month.rows.slice(0, Math.max(0, remaining));
    remaining -= rows.length;
    return { ...month, rows };
  }).filter(month => month.rows.length > 0);
  const total = months.reduce((sum, month) => sum + month.rows.length, 0);

  const origin = (event: ForecastEvent) => {
    const from = accountName(event.accountId);
    const to = accountName(event.toAccountId);
    return from && to ? `${from} to ${to}` : from ?? to ?? '';
  };

  const markBadge = (mark: Mark) => mark === 'global' ? <Badge tone="negative">Global lowest</Badge> : mark === 'month' ? <Badge tone="attention">Month's lowest</Badge> : null;

  const monthHeader = (month: Month) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="type-section-title text-ink">{monthLabel(month.key)}</h3>
      <p className="type-caption flex flex-wrap items-center gap-x-2 text-muted">
        <span>Lowest <span className="whitespace-nowrap text-ink"><Amount value={month.low.total} currency={getMainCurrency()} /></span> on {shortDate(month.low.date)}</span>
        {overall && month.low.date === overall.date && <Badge tone="negative">Global lowest</Badge>}
      </p>
    </div>
  );

  return (
    <section aria-label="Forecast list" className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
      <TextInput className="mb-4 max-w-sm" label="Search the forecast" value={search} onChange={value => { setSearch(value); setLimit(PAGE); }} />
      {visible.length === 0 ? (
        <p className="type-body text-muted">Nothing matches.</p>
      ) : (
        <div className="space-y-6">
          {visible.map(month => isPhone ? (
            <section key={month.key} aria-label={monthLabel(month.key)} className="space-y-2">
              {monthHeader(month)}
              <ul className="divide-y divide-line">
                {month.rows.map(({ event, mark }) => (
                  <li key={event.key} className={cn('rounded-[var(--radius-md)]', mark && `${MARK_STYLE[mark]} px-2`)}>
                    <button type="button" onClick={() => onOpen(event)} className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 py-2 text-left">
                      <span className="min-w-0">
                        <span className="type-body-strong block truncate text-ink">{event.description}</span>
                        <span className="type-caption block truncate text-muted">{[shortDate(event.date), KIND_LABEL[event.kind], origin(event)].filter(Boolean).join(', ')}</span>
                        {mark && <span className="mt-1 inline-block">{markBadge(mark)}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="type-figure-row block text-ink"><Amount value={event.amount} currency={getMainCurrency()} tone="flow" /></span>
                        <span className="type-caption block text-muted">Leaves <Amount value={event.balanceAfter} currency={getMainCurrency()} /></span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <div key={month.key} className="space-y-2">
              {monthHeader(month)}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0">
                  <caption className="sr-only">{monthLabel(month.key)}</caption>
                  <colgroup>
                    <col className="w-[96px]" />
                    <col className="w-[14%]" />
                    <col />
                    <col className="w-[100px]" />
                    <col className="w-[124px]" />
                    <col className="w-[84px]" />
                  </colgroup>
                  <thead>
                    <tr className="type-label border-b border-line text-muted">
                      <th scope="col" className="h-9 px-3 text-left font-semibold">Date</th>
                      <th scope="col" className="h-9 px-3 text-left font-semibold">Origin</th>
                      <th scope="col" className="h-9 px-3 text-left font-semibold">Description</th>
                      <th scope="col" className="h-9 px-3 text-right font-semibold">Amount</th>
                      <th scope="col" className="h-9 px-3 text-right font-semibold">Projected balance</th>
                      <th scope="col" className="h-9 px-3 text-left font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {month.rows.map(({ event, mark }) => (
                      <tr key={event.key} className={cn('group cursor-pointer hover:bg-inset', mark && MARK_STYLE[mark])} onClick={() => onOpen(event)}>
                        <td className="h-14 border-t border-line px-3 type-body whitespace-nowrap text-ink">{shortDate(event.date)}</td>
                        <td className="h-14 truncate border-t border-line px-3 type-body text-muted">{origin(event)}</td>
                        <td className="h-14 border-t border-line px-3">
                          <button type="button" onClick={e => { e.stopPropagation(); onOpen(event); }} className="type-body-strong block w-full min-w-0 cursor-pointer truncate text-left text-ink outline-hidden focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                            {event.description}
                            {event.overdue && <span className="type-caption ml-2 font-normal text-muted">Overdue</span>}
                          </button>
                        </td>
                        <td className="type-figure-row h-12 border-t border-line px-3 text-right whitespace-nowrap text-ink"><Amount value={event.amount} currency={getMainCurrency()} tone="flow" /></td>
                        <td className="h-14 border-t border-line px-3 text-right">
                          <span className="type-figure-row block whitespace-nowrap text-ink"><Amount value={event.balanceAfter} currency={getMainCurrency()} /></span>
                          {mark && <span className="mt-0.5 inline-flex">{markBadge(mark)}</span>}
                        </td>
                        <td className="h-14 border-t border-line px-3 type-caption text-muted">{KIND_LABEL[event.kind]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <ShowMore remaining={total - limit} onPress={() => setLimit(value => value + PAGE)} />
        </div>
      )}
    </section>
  );
};

export default ForecastList;
