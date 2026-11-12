import type { LifeEvent, LifeEventKind } from '../types';

/*
 * Life events: dated moments you mark on the net-worth line ("bought the flat", "new job"). Pure helpers, tested in
 * tests/unit/lifeEvents.test.ts. Wrapped reads the same list for its year.
 */

export const LIFE_EVENT_KINDS: { id: LifeEventKind; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'job', label: 'Work', icon: 'work' },
  { id: 'family', label: 'Family', icon: 'family_restroom' },
  { id: 'move', label: 'Move', icon: 'luggage' },
  { id: 'education', label: 'Education', icon: 'graduation-cap' },
  { id: 'travel', label: 'Travel', icon: 'flight' },
  { id: 'health', label: 'Health', icon: 'health_and_safety' },
  { id: 'other', label: 'Other', icon: 'flag' },
];

export const lifeEventKind = (kind: LifeEventKind | undefined) => LIFE_EVENT_KINDS.find(item => item.id === kind) ?? LIFE_EVENT_KINDS[LIFE_EVENT_KINDS.length - 1];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Oldest first; events on one day keep the order they were added in. */
export const sortLifeEvents = (events: LifeEvent[]) => [...events].sort((a, b) => a.date.localeCompare(b.date));

/** Events whose date falls in `start` to `end`, both included (`YYYY-MM-DD`), oldest first. */
export const lifeEventsBetween = (events: LifeEvent[], start: string, end: string) =>
  sortLifeEvents(events.filter(event => DATE.test(event.date) && event.date >= start && event.date <= end));

export const lifeEventsInYear = (events: LifeEvent[], year: number) => lifeEventsBetween(events, `${year}-01-01`, `${year}-12-31`);

/** What a form may save: a title and a real date. */
export const lifeEventProblem = (draft: { title: string; date: string }): string | null => {
  if (!draft.title.trim()) return 'Give the event a name.';
  if (!DATE.test(draft.date) || Number.isNaN(Date.parse(`${draft.date}T00:00:00Z`))) return 'Pick a date.';
  return null;
};

/**
 * The net worth on an event's day, or the nearest earlier point in the series, so a marker can sit on the line.
 * Undefined when the series starts after the event.
 */
export const netWorthOn = (series: { name: string; value?: number; actual?: number; forecast?: number }[], date: string): number | undefined => {
  let found: number | undefined;
  for (const point of series) {
    if (point.name > date) break;
    const value = point.actual ?? point.value ?? point.forecast;
    if (typeof value === 'number') found = value;
  }
  return found;
};
