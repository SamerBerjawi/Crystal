import React, { useMemo, useState } from 'react';
import { parseLocalDate } from '../utils';
import type { Renewal } from '../utils/subscriptionsModel';
import { cn } from '../lib/utils';
import { ShowMore } from './ui/Display';
import { Amount } from './ui/Money';

const DAYS = 30;
const LIST_LIMIT = 6;
const LABELLED = 9;
const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const nameOf = (renewal: Renewal) => renewal.service.merchant || renewal.service.description;

interface RenewalTimelineProps {
  items: Renewal[];
  today: Date;
  isPhone: boolean;
  onOpen: (renewal: Renewal) => void;
}

/** Every renewal in the next 30 days on one line, or a list on a phone (D-028). */
const RenewalTimeline: React.FC<RenewalTimelineProps> = ({ items, today, isPhone, onOpen }) => {
  const [limit, setLimit] = useState(LIST_LIMIT);
  const placed = useMemo(() => {
    const seen = new Map<string, number>();
    return items.map(item => {
      const offset = (parseLocalDate(item.date).getTime() - today.getTime()) / 86400000;
      const stack = seen.get(item.date) ?? 0;
      seen.set(item.date, stack + 1);
      return { item, left: Math.max(0, Math.min(100, (offset / DAYS) * 100)), stack };
    });
  }, [items, today]);

  return (
    <section aria-label="The next 30 days" className="surface-card rounded-[var(--radius-xl)] p-5">
      <h2 className="type-card-title text-ink">The next 30 days</h2>
      <p className="type-caption text-muted">Every renewal on one line.</p>
      {items.length === 0 ? (
        <p className="type-body mt-3 text-muted">Nothing renews in the next 30 days.</p>
      ) : isPhone ? (
        <>
          <ul className="mt-2 divide-y divide-line">
            {items.slice(0, limit).map(item => (
              <li key={`${item.service.id}-${item.date}`}>
                <button type="button" onClick={() => onOpen(item)} className="flex min-h-12 w-full cursor-pointer items-center gap-3 py-1 text-left">
                  <span className="type-caption w-12 shrink-0 text-muted">{shortDay(item.date)}</span>
                  <span className="type-body min-w-0 flex-1 truncate text-ink">{nameOf(item)}</span>
                  <span className="type-figure-row shrink-0 text-ink"><Amount value={item.amount} currency="EUR" /></span>
                </button>
              </li>
            ))}
          </ul>
          <ShowMore remaining={items.length - limit} onPress={() => setLimit(value => value + LIST_LIMIT)} />
        </>
      ) : (
        <div className="relative mx-4 mt-3 h-44">
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[var(--line-strong)] opacity-40" />
          {[{ label: 'Today', left: 0 }, { label: 'in 7 days', left: (7 / DAYS) * 100 }, { label: 'in 14 days', left: (14 / DAYS) * 100 }, { label: 'in 21 days', left: (21 / DAYS) * 100 }, { label: 'in 30 days', left: 100 }].map(mark => (
            <span key={mark.label} className="type-caption absolute top-1/2 mt-2 -translate-x-1/2 whitespace-nowrap text-muted" style={{ left: `${mark.left}%` }}>{mark.label}</span>
          ))}
          <ul>
            {placed.map(({ item, left, stack }, index) => {
              const isAbove = index % 2 === 0;
              const showLabel = index < LABELLED;
              return (
                <li key={`${item.service.id}-${item.date}`} className="absolute top-1/2" style={{ left: `${left}%` }}>
                  <button
                    type="button"
                    title={`${nameOf(item)}, ${shortDay(item.date)}`}
                    aria-label={`${nameOf(item)}, ${shortDay(item.date)}`}
                    onClick={() => onOpen(item)}
                    className="absolute -left-2 -top-2 block size-4 cursor-pointer rounded-full border-[3px] border-[var(--primary)] bg-[var(--solid)]"
                  />
                  {showLabel && (
                    <div
                      aria-hidden="true"
                      className={cn('pointer-events-none absolute w-28 -translate-x-1/2 rounded-[var(--radius-sm)] border border-line bg-solid px-2 py-1 text-center shadow-sm', left < 8 && 'translate-x-[-12%]', left > 92 && 'translate-x-[-88%]')}
                      style={isAbove ? { bottom: 14 + stack * 2 } : { top: 34 + stack * 2 }}
                    >
                      <p className="type-caption truncate text-ink">{nameOf(item)}</p>
                      <p className="text-[.6875rem] font-semibold text-muted">{shortDay(item.date)}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default RenewalTimeline;
