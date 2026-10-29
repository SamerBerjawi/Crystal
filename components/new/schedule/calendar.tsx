import React, { useMemo, useRef } from 'react';
import { cn } from '../../../lib/utils';
import { addDays, iso, monthGrid, type CalendarDay, type Occurrence } from '../../../utils/scheduleModel';
import type { ScheduleData } from '../../../hooks/useScheduleData';
import { parseLocalDate } from '../../../utils';
import { IconButton, Money } from '../ui';

/* Calendar tab, Month view (docs/SCHEDULE_NEW_PLAN.md §4.3): a 7-column grid, dots per kind, the day's net. */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MonthNav: React.FC<{ year: number; month: number; onChange: (year: number, month: number) => void }> = ({ year, month, onChange }) => {
  const shift = (n: number) => { const d = new Date(year, month + n, 1); onChange(d.getFullYear(), d.getMonth()); };
  return (
    <div className="flex items-center gap-1">
      <IconButton icon="arrowLeft" label="Previous month" onClick={() => shift(-1)} />
      <span className="min-w-36 text-center text-[15px] font-medium text-nv-ink">
        {new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
      </span>
      <IconButton icon="arrowRight" label="Next month" onClick={() => shift(1)} />
    </div>
  );
};

const Dots: React.FC<{ day: CalendarDay }> = ({ day }) => {
  const kinds = new Set(day.items.filter(o => o.status !== 'skipped').map(o => o.flow));
  return (
    <span className="flex justify-center gap-1" aria-hidden>
      {kinds.has('in') && <span className="h-1.5 w-1.5 rounded-full bg-nv-green" />}
      {kinds.has('out') && <span className="h-1.5 w-1.5 rounded-full bg-nv-orange" />}
      {kinds.has('move') && <span className="h-1.5 w-1.5 rounded-full bg-nv-sky" />}
    </span>
  );
};

/**
 * The month grid. A `role="grid"`: arrows move a day, PageUp / PageDown a month, Home / End the week, Enter selects.
 * Overdue days are outlined in red; today in ink.
 */
export const MonthCalendar: React.FC<{
  data: ScheduleData;
  occurrences: Occurrence[];
  year: number;
  month: number;
  selected: string;
  onSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}> = ({ data, occurrences, year, month, selected, onSelect, onMonthChange }) => {
  const days = useMemo(() => monthGrid(year, month, occurrences, data.convert), [year, month, occurrences, data.convert]);
  const todayStr = iso(data.today);
  const gridRef = useRef<HTMLDivElement>(null);

  const move = (date: string, n: number | 'month+' | 'month-') => {
    const d = parseLocalDate(date);
    const next = n === 'month+' ? new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()) : n === 'month-' ? new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()) : addDays(d, n);
    const nextIso = iso(next);
    if (next.getMonth() !== month || next.getFullYear() !== year) onMonthChange(next.getFullYear(), next.getMonth());
    onSelect(nextIso);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${nextIso}"]`)?.focus());
  };

  const onKey = (e: React.KeyboardEvent, date: string) => {
    const dow = (parseLocalDate(date).getDay() + 6) % 7;
    const map: Record<string, number | 'month+' | 'month-'> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: 'month-', PageDown: 'month+', Home: -dow, End: 6 - dow,
    };
    const step = map[e.key];
    if (step === undefined) return;
    e.preventDefault();
    move(date, step);
  };

  return (
    <div ref={gridRef} role="grid" aria-label="Payments by day" className="select-none">
      <div role="row" className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map(w => <span key={w} role="columnheader" className="text-center text-xs font-medium text-nv-muted">{w}</span>)}
      </div>
      {Array.from({ length: 6 }, (_, week) => (
        <div key={week} role="row" className="grid grid-cols-7 gap-1">
          {days.slice(week * 7, week * 7 + 7).map(day => {
            const isToday = day.date === todayStr;
            const isSelected = day.date === selected;
            const count = day.items.filter(o => o.status !== 'skipped').length;
            return (
              <button
                key={day.date}
                type="button"
                role="gridcell"
                data-date={day.date}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                aria-label={`${parseLocalDate(day.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} ${count === 1 ? 'payment' : 'payments'}`}
                onClick={() => onSelect(day.date)}
                onKeyDown={e => onKey(e, day.date)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-start gap-1 rounded-xl py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-nv-ink sm:min-h-20',
                  !day.inMonth && 'opacity-40',
                  isSelected ? 'bg-nv-ink text-nv-on-ink' : 'hover:bg-nv-surface',
                  day.hasOverdue && !isSelected && 'ring-1 ring-nv-red',
                )}
              >
                <span className={cn('nv-tabular flex h-7 w-7 items-center justify-center rounded-full text-sm', isToday && !isSelected && 'border border-nv-ink font-semibold')}>
                  {parseLocalDate(day.date).getDate()}
                </span>
                <Dots day={day} />
                {(day.in > 0 || day.out > 0) && (
                  <span className={cn('hidden max-w-full truncate px-1 text-xs sm:block', isSelected ? 'text-nv-on-ink' : 'text-nv-muted')}>
                    <Money amount={day.net} currency={data.displayCurrency} signed compact className={cn('text-xs font-medium', isSelected && 'text-nv-on-ink')} tone="inherit" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
