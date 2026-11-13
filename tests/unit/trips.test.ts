import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHomeCountry, detectTrips } from '../../utils/trips';
import type { Transaction } from '../../types';

let n = 0;
const tx = (date: string, country: string | undefined, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, accountId: 'a', date, description: 'x', merchant: 'Shop', amount: 10, category: 'Food', type: 'expense', currency: 'EUR', country, ...extra,
});
const homeDays = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => tx(`2025-01-${String(from + i).padStart(2, '0')}`, 'Belgium', { merchant: `Local ${i}` }));

test('home is the country with the most transactions, once there are enough', () => {
  assert.equal(detectHomeCountry(homeDays(1, 6).concat([tx('2025-02-01', 'Spain')])), 'Belgium');
  assert.equal(detectHomeCountry(homeDays(1, 3)), null);
  assert.equal(detectHomeCountry([tx('2025-01-01', undefined)]), null);
});

test('days abroad make a trip, and short gaps join them', () => {
  const list = [...homeDays(1, 10), tx('2025-03-10', 'Portugal', { city: 'Lisbon' }), tx('2025-03-12', 'Portugal', { city: 'Lisbon', amount: 30 }), tx('2025-03-14', 'Portugal', { city: 'Porto' })];
  const [trip] = detectTrips(list);
  assert.equal(trip.name, 'Lisbon, Portugal');
  assert.equal(trip.start, '2025-03-10');
  assert.equal(trip.end, '2025-03-14');
  assert.equal(trip.days, 5);
  assert.equal(trip.transactionIds.length, 3);
  assert.equal(trip.spend, 50);
  assert.equal(trip.perDay, 10);
});

test('a long gap splits two trips, newest first', () => {
  const list = [...homeDays(1, 10), tx('2025-03-01', 'Spain'), tx('2025-03-02', 'Spain'), tx('2025-06-01', 'Italy'), tx('2025-06-02', 'Italy')];
  assert.deepEqual(detectTrips(list).map(t => t.countries[0]), ['Italy', 'Spain']);
});

test('one stray foreign purchase is not a trip, and transfers are ignored', () => {
  const list = [...homeDays(1, 10), tx('2025-03-01', 'Spain'), tx('2025-03-02', 'Spain', { transferId: 'x' })];
  assert.equal(detectTrips(list).length, 0);
});

test('a transaction with no country is never guessed at', () => {
  const list = [...homeDays(1, 10), tx('2025-03-01', undefined), tx('2025-03-02', undefined)];
  assert.equal(detectTrips(list).length, 0);
});

test('two countries in one run share a trip; the home country can be set', () => {
  const list = [...homeDays(1, 10), tx('2025-03-01', 'France'), tx('2025-03-02', 'Spain'), tx('2025-03-03', 'Spain')];
  assert.equal(detectTrips(list)[0].name, 'Spain and France');
  const swapped = [...homeDays(1, 10), tx('2025-03-01', 'Spain'), tx('2025-03-02', 'Spain')];
  assert.equal(detectTrips(swapped, 'spain').length, 1);
});

test('the places on a map are merged by position and the baseline needs a month of history', () => {
  const stops = [tx('2025-01-15', 'Spain', { latitude: 41.3851, longitude: 2.1734, placeName: 'Cafe' }), tx('2025-01-15', 'Spain', { latitude: 41.38512, longitude: 2.17338 }), tx('2025-01-16', 'Spain', { latitude: 40.4, longitude: -3.7 })];
  const [trip] = detectTrips([...homeDays(1, 10), ...stops]);
  assert.equal(trip.places.length, 2);
  assert.equal(trip.places[0].count, 2);
  assert.equal(trip.homePerDay, null);
  const longer = [tx('2025-01-01', 'Belgium', { merchant: 'L1' }), ...homeDays(2, 10), tx('2025-04-01', 'Belgium', { merchant: 'L2' }), tx('2025-04-02', 'Belgium', { merchant: 'L3' }), tx('2025-02-01', 'Spain', { merchant: 'Bar' }), tx('2025-02-02', 'Spain', { merchant: 'Hotel' })];
  assert.ok((detectTrips(longer)[0].homePerDay ?? 0) > 0);
});

import { tileUrlProblem } from '../../utils/trips';
test('a tile address must be https and carry z, x and y', () => {
  assert.equal(tileUrlProblem('https://tiles.example.com/{z}/{x}/{y}.png'), null);
  assert.match(tileUrlProblem('http://tiles.example.com/{z}/{x}/{y}.png') ?? '', /https/);
  assert.match(tileUrlProblem('https://tiles.example.com/map.png') ?? '', /\{z\}/);
  assert.match(tileUrlProblem('  ') ?? '', /Enter/);
});

test('recurring charges and shops you also use at home are not trips', () => {
  const home = homeDays(1, 10).map(t => ({ ...t, merchant: 'Shop' }));
  const abroadShop = [tx('2025-03-01', 'Spain'), tx('2025-03-02', 'Spain')];
  assert.equal(detectTrips([...home, ...abroadShop]).length, 0);
  const recurring = [tx('2025-03-01', 'Spain', { merchant: 'Cafe', recurringSourceId: 'r' }), tx('2025-03-02', 'Spain', { merchant: 'Cafe', recurringSourceId: 'r' })];
  assert.equal(detectTrips([...home, ...recurring]).length, 0);
  const real = [tx('2025-03-01', 'Spain', { merchant: 'Cafe Sol' }), tx('2025-03-02', 'Spain', { merchant: 'Hotel Sol' })];
  assert.equal(detectTrips([...home, ...real]).length, 1);
});
