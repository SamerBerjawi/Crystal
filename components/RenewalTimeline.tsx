import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseLocalDate, getMainCurrency } from '../utils';
import { assignLabelLanes, type Renewal } from '../utils/subscriptionsModel';
import { ShowMore } from './ui/Display';
import { Amount } from './ui/Money';
import Icon from './ui/Icon';

const DAYS = 30;
const LIST_LIMIT = 6;
const LABEL_WIDTH_PX = 120;
const LABEL_INSET_PX = 40;
const LANES = 4;
const LANE_STEP_PX = 46;
const shortDay = (date: string) =>
  parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
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
  const [isExpanded, setIsExpanded] = useState(false);
  const lineRef = useRef<HTMLDivElement>(null);
  const [lineWidth, setLineWidth] = useState(0);

  const totalRenewing = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items]
  );

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const observer = new ResizeObserver(([entry]) => setLineWidth(entry.contentRect.width));
    observer.observe(line);
    return () => observer.disconnect();
  }, [isPhone, items.length, isExpanded]);

  const placed = useMemo(() => {
    const dots = items
      .map(item => {
        const offset = (parseLocalDate(item.date).getTime() - today.getTime()) / 86400000;
        return { item, left: Math.max(0, Math.min(100, (offset / DAYS) * 100)) };
      })
      .sort((a, b) => a.left - b.left);
    const labelWidth = lineWidth > 0 ? (LABEL_WIDTH_PX / lineWidth) * 100 : 100;
    const inset = lineWidth > 0 ? (LABEL_INSET_PX / lineWidth) * 100 : 0;
    const centres = dots.map(dot => Math.max(inset, Math.min(100 - inset, dot.left)));
    const lanes = assignLabelLanes(centres, labelWidth, LANES);
    return dots.map((dot, index) => ({
      ...dot,
      lane: lanes[index],
      nudge: ((centres[index] - dot.left) / 100) * lineWidth,
    }));
  }, [items, lineWidth, today]);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="The next 30 days"
      className="surface-card rounded-[var(--radius-xl)] border border-line p-5 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal-soft text-teal">
            <Icon name="calendar-03" size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="type-card-title text-ink font-semibold">The Next 30 Days</h2>
              <span className="type-caption text-muted">
                ({items.length} {items.length === 1 ? 'renewal' : 'renewals'} · <Amount value={totalRenewing} currency={getMainCurrency()} className="text-ink font-medium" />)
              </span>
            </div>
            <p className="type-caption text-muted">Upcoming renewal schedule horizon</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:text-ink hover:bg-inset transition-colors"
        >
          <span>{isExpanded ? 'Hide timeline' : 'View timeline'}</span>
          <Icon name={isExpanded ? 'arrow-up-01' : 'arrow-down-01'} size={14} />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-line/60">
          {isPhone ? (
            <>
              <ul className="divide-y divide-line">
                {items.slice(0, limit).map(item => (
                  <li key={`${item.service.id}-${item.date}`}>
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="flex min-h-12 w-full cursor-pointer items-center gap-3 py-2 text-left hover:bg-inset/50 rounded-lg px-2 transition-colors"
                    >
                      <span className="type-caption w-14 shrink-0 text-muted font-mono">{shortDay(item.date)}</span>
                      <span className="type-body min-w-0 flex-1 truncate text-ink font-medium">{nameOf(item)}</span>
                      <span className="type-figure-row shrink-0 text-ink font-semibold">
                        <Amount value={item.amount} currency={getMainCurrency()} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <ShowMore remaining={items.length - limit} onPress={() => setLimit(value => value + LIST_LIMIT)} />
            </>
          ) : (
            <div ref={lineRef} className="relative mx-4 mt-2 h-56">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[var(--line-strong)] opacity-40"
              />
              {[
                { label: 'Today', left: 0 },
                { label: 'in 7 days', left: (7 / DAYS) * 100 },
                { label: 'in 14 days', left: (14 / DAYS) * 100 },
                { label: 'in 21 days', left: (21 / DAYS) * 100 },
                { label: 'in 30 days', left: 100 },
              ].map(mark => (
                <span
                  key={mark.label}
                  className="type-caption absolute top-1/2 mt-2 -translate-x-1/2 whitespace-nowrap text-muted text-[11px]"
                  style={{ left: `${mark.left}%` }}
                >
                  {mark.label}
                </span>
              ))}
              <ul>
                {placed.map(({ item, left, lane, nudge }) => {
                  const isAbove = lane !== null && lane % 2 === 0;
                  const step = lane === null ? 0 : Math.floor(lane / 2) * LANE_STEP_PX;
                  return (
                    <li
                      key={`${item.service.id}-${item.date}`}
                      className="absolute top-1/2"
                      style={{ left: `${left}%` }}
                    >
                      <button
                        type="button"
                        title={`${nameOf(item)}, ${shortDay(item.date)}`}
                        aria-label={`${nameOf(item)}, ${shortDay(item.date)}`}
                        onClick={() => onOpen(item)}
                        className="group absolute -left-3 -top-3 flex size-6 cursor-pointer items-center justify-center rounded-full outline-hidden focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                      >
                        <span className="block size-4 rounded-full border-[3px] border-[var(--primary)] bg-[var(--solid)] shadow-xs transition-transform group-hover:scale-125" />
                      </button>
                      {lane !== null && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute w-28 -translate-x-1/2 rounded-[var(--radius-sm)] border border-line bg-solid px-2 py-1 text-center shadow-xs"
                          style={{
                            left: nudge,
                            ...(isAbove ? { bottom: 14 + step } : { top: 34 + step }),
                          }}
                        >
                          <p className="type-caption truncate text-ink font-medium">{nameOf(item)}</p>
                          <p className="text-[.6875rem] font-semibold text-muted">{shortDay(item.date)}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default RenewalTimeline;
