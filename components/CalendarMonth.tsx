import React, { useMemo } from 'react';
import { parseLocalDate, getMainCurrency } from '../utils';
import { addDays, iso, type CalendarDay, type Occurrence } from '../utils/scheduleModel';
import { cn } from '../lib/utils';
import { Button, IconButton } from './ui/Actions';
import { Amount } from './ui/Money';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const VISIBLE_ITEMS = 2;

const chipTone = (o: Occurrence) => (o.status === 'overdue' ? 'bg-amber-soft' : o.flow === 'in' ? 'bg-money-in-soft' : o.flow === 'out' ? 'bg-inset' : 'bg-blue-soft');

interface CalendarMonthProps {
  label: string;
  days: CalendarDay[];
  today: string;
  selected: string;
  goals: Map<string, string[]>;
  onSelect: (date: string) => void;
  onMonth: (offset: number) => void;
  onToday: () => void;
}

const dayLabel = (day: CalendarDay, goals: string[]) => {
  const date = parseLocalDate(day.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const count = day.items.length + goals.length;
  return `${date}, ${count === 0 ? 'nothing planned' : `${count} ${count === 1 ? 'item' : 'items'}`}`;
};

/** The month, with what lands on each day (D-007). Select a day to see it beside the grid. */
export const CalendarMonth: React.FC<CalendarMonthProps> = ({ label, days, today, selected, goals, onSelect, onMonth, onToday }) => {
  const weeks = useMemo(() => {
    const rows: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows.filter(row => row.some(day => day.inMonth));
  }, [days]);

  return (
    <section aria-label="Month" className="surface-card min-w-0 rounded-[var(--radius-xl)] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="type-section-title text-ink" aria-live="polite">{label}</h2>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onPress={onToday}>Today</Button>
          <IconButton icon="chevron_left" label="Previous month" onPress={() => onMonth(-1)} />
          <IconButton icon="chevron_right" label="Next month" onPress={() => onMonth(1)} />
        </div>
      </div>
      <div role="grid" aria-label={label} className="grid gap-1.5">
        <div role="row" className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map(day => <span key={day} role="columnheader" className="type-caption px-1 text-muted">{day}</span>)}
        </div>
        {weeks.map(week => (
          <div key={week[0].date} role="row" className="grid grid-cols-7 gap-1.5">
            {week.map(day => {
              const dayGoals = goals.get(day.date) ?? [];
              const isSelected = day.date === selected;
              const shown = day.items.slice(0, VISIBLE_ITEMS);
              const extra = day.items.length - shown.length + dayGoals.length;
              return (
                <button
                  key={day.date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={dayLabel(day, dayGoals)}
                  onClick={() => onSelect(day.date)}
                  className={cn(
                    'flex min-h-24 min-w-0 cursor-pointer flex-col gap-1 rounded-[var(--radius-md)] border p-1.5 text-left transition-colors duration-[var(--duration-fast)] hover:border-line-strong',
                    day.inMonth ? 'bg-inset' : 'opacity-50',
                    isSelected ? 'border-pill' : 'border-transparent'
                  )}
                >
                  <span className={cn('type-caption flex size-6 items-center justify-center rounded-full', day.date === today ? 'bg-pill text-on-pill' : 'text-ink')}>{parseLocalDate(day.date).getDate()}</span>
                  {shown.map(item => (
                    <span key={item.key} className={cn('truncate rounded-[6px] px-1.5 py-0.5 text-[.6875rem] font-semibold text-ink', chipTone(item), item.status === 'skipped' && 'line-through opacity-60')}>
                      {item.merchant || item.description}
                    </span>
                  ))}
                  {extra > 0 && <span className="px-1 text-[.6875rem] font-semibold text-muted">+{extra} more</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

interface CalendarWeekProps {
  days: CalendarDay[];
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  onWeek: (offset: number) => void;
}

/** The phone's week strip (D-007): one week, with a dot on busy days. */
export const CalendarWeek: React.FC<CalendarWeekProps> = ({ days, today, selected, onSelect, onWeek }) => (
  <section aria-label="Week" className="surface-card flex items-center rounded-[var(--radius-xl)] p-1">
    <IconButton icon="chevron_left" label="Previous week" onPress={() => onWeek(-7)} />
    <div className="grid min-w-0 flex-1 grid-cols-7">
      {days.map(day => {
        const date = parseLocalDate(day.date);
        const isSelected = day.date === selected;
        return (
          <button key={day.date} type="button" aria-pressed={isSelected} onClick={() => onSelect(day.date)} className={cn('flex min-h-14 min-w-0 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)]', isSelected && 'bg-pill text-on-pill')}>
            <span className={cn('type-caption', !isSelected && 'text-muted')}>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            <span className={cn('type-body-strong', !isSelected && (day.date === today ? 'text-primary' : 'text-ink'))}>{date.getDate()}</span>
            <span aria-hidden="true" className={cn('size-1 rounded-full', day.items.length ? (isSelected ? 'bg-on-pill' : 'bg-ink') : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
    <IconButton icon="chevron_right" label="Next week" onPress={() => onWeek(7)} />
  </section>
);

/** The seven days around a date, Monday first. */
export const weekOf = (date: string, days: CalendarDay[]) => {
  const start = parseLocalDate(date);
  const monday = addDays(start, -((start.getDay() + 6) % 7));
  const from = iso(monday);
  const to = iso(addDays(monday, 6));
  return days.filter(day => day.date >= from && day.date <= to);
};

export const FlowTotal: React.FC<{ day: CalendarDay }> = ({ day }) => (
  <p className="type-caption text-muted">
    {day.in > 0 && <>In <Amount value={day.in} currency={getMainCurrency()} /> </>}
    {day.out > 0 && <>Out <Amount value={day.out} currency={getMainCurrency()} /></>}
  </p>
);
