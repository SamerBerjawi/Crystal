import test from 'node:test';
import assert from 'node:assert/strict';
import { lifeEventKind, lifeEventProblem, lifeEventsBetween, lifeEventsInYear, netWorthOn, sortLifeEvents } from '../../utils/lifeEvents';
import type { LifeEvent } from '../../types';

const event = (id: string, date: string, extra: Partial<LifeEvent> = {}): LifeEvent => ({ id, date, title: id, kind: 'other', ...extra });

test('events are listed oldest first and filtered by year', () => {
  const events = [event('b', '2025-06-01'), event('a', '2024-12-31'), event('c', '2025-01-01')];
  assert.deepEqual(sortLifeEvents(events).map(e => e.id), ['a', 'c', 'b']);
  assert.deepEqual(lifeEventsInYear(events, 2025).map(e => e.id), ['c', 'b']);
  assert.deepEqual(lifeEventsBetween(events, '2025-01-01', '2025-01-01').map(e => e.id), ['c']);
});

test('events with a malformed date are left out of a range', () => {
  assert.deepEqual(lifeEventsInYear([event('x', '2025-6-1'), event('y', '2025-06-01')], 2025).map(e => e.id), ['y']);
});

test('a draft needs a name and a real date', () => {
  assert.equal(lifeEventProblem({ title: 'Bought the flat', date: '2025-03-02' }), null);
  assert.match(lifeEventProblem({ title: '  ', date: '2025-03-02' }) ?? '', /name/);
  assert.match(lifeEventProblem({ title: 'x', date: '' }) ?? '', /date/);
  assert.match(lifeEventProblem({ title: 'x', date: '2025-13-45' }) ?? '', /date/);
});

test('unknown kinds fall back to other', () => {
  assert.equal(lifeEventKind('home').label, 'Home');
  assert.equal(lifeEventKind(undefined).id, 'other');
});

test('net worth on a day uses the nearest earlier point and prefers actuals', () => {
  const series = [{ name: '2025-01-01', value: 100 }, { name: '2025-02-01', actual: 150, forecast: 999 }, { name: '2025-03-01', forecast: 200 }];
  assert.equal(netWorthOn(series, '2025-01-15'), 100);
  assert.equal(netWorthOn(series, '2025-02-01'), 150);
  assert.equal(netWorthOn(series, '2025-03-05'), 200);
  assert.equal(netWorthOn(series, '2024-12-31'), undefined);
});
