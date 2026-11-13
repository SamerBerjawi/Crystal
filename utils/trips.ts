import type { Transaction } from '../types';
import { convertToMain, parseLocalDate, round2, safeAdd } from '../utils';

/*
 * Trips, worked out from the country already saved on your transactions. A trip is a run of days with spending
 * outside your home country; days up to two apart still count as one trip. Nothing is stored: change a country on a
 * transaction and the trips change with it. A transaction with no country is never guessed at.
 */

export const MIN_COUNTRY_SAMPLE = 5;
export const MAX_GAP_DAYS = 3; // two empty days between spending days still joins them
export const MIN_TRIP_TRANSACTIONS = 2;
const MIN_BASELINE_DAYS = 30;
const MIN_HOME_VISITS = 2;
const MAX_PLACES = 60;

export interface TripPlace { latitude: number; longitude: number; label: string; count: number }

export interface Trip {
  id: string;
  name: string;
  start: string;
  end: string;
  /** Calendar days from the first to the last day, both included. */
  days: number;
  countries: string[];
  cities: string[];
  currencies: string[];
  transactionIds: string[];
  /** Money spent there, in the main currency. */
  spend: number;
  perDay: number;
  topCategories: { category: string; amount: number }[];
  places: TripPlace[];
  /** What a day at home costs you on average (main currency), or null when there is too little history. */
  homePerDay: number | null;
}

/** Real spending: not a transfer, a split parent or an adjustment. */
const isSpending = (tx: Transaction) => !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment && !tx.isMarketAdjustment;

const key = (country: string) => country.trim().toLowerCase();
const dayNumber = (date: string) => Math.round(parseLocalDate(date).getTime() / 86_400_000);
const clean = (text?: string) => text?.trim() || '';
const spentOf = (tx: Transaction) => (tx.type === 'expense' ? Math.abs(convertToMain(tx.amount, tx.currency)) : 0);

/** The country with the most transactions, when there is enough to say. */
export const detectHomeCountry = (transactions: Transaction[]): string | null => {
  const tally = new Map<string, { name: string; count: number }>();
  transactions.filter(isSpending).forEach(tx => {
    const name = clean(tx.country);
    if (!name) return;
    const entry = tally.get(key(name)) ?? { name, count: 0 };
    entry.count++;
    tally.set(key(name), entry);
  });
  const best = [...tally.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0];
  return best && best.count >= MIN_COUNTRY_SAMPLE ? best.name : null;
};

const nameOf = (countries: string[], cities: string[]) => {
  if (countries.length === 1) return cities[0] ? `${cities[0]}, ${countries[0]}` : countries[0];
  if (countries.length === 2) return `${countries[0]} and ${countries[1]}`;
  return `${countries[0]} and ${countries.length - 1} more countries`;
};

const mostly = <T,>(items: T[], size: number) => {
  const tally = new Map<T, number>();
  items.forEach(item => tally.set(item, (tally.get(item) ?? 0) + 1));
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, size).map(([item]) => item);
};

export const detectTrips = (transactions: Transaction[], homeCountry?: string | null): Trip[] => {
  const home = clean(homeCountry ?? undefined) || detectHomeCountry(transactions);
  if (!home) return [];
  const homeKey = key(home);
  const dated = transactions.filter(tx => isSpending(tx) && clean(tx.country) && /^\d{4}-\d{2}-\d{2}/.test(tx.date));
  // A shop you also pay at home, or a recurring charge, is most likely online or a subscription, not a trip.
  const homeMerchants = new Map<string, number>();
  dated.filter(tx => key(tx.country!) === homeKey && tx.merchant).forEach(tx => homeMerchants.set(key(tx.merchant!), (homeMerchants.get(key(tx.merchant!)) ?? 0) + 1));
  const isOnline = (tx: Transaction) => !!tx.recurringSourceId || (!!tx.merchant && (homeMerchants.get(key(tx.merchant)) ?? 0) >= MIN_HOME_VISITS);
  const away = dated.filter(tx => key(tx.country!) !== homeKey && !isOnline(tx)).sort((a, b) => a.date.localeCompare(b.date));

  const groups: Transaction[][] = [];
  away.forEach(tx => {
    const last = groups[groups.length - 1];
    if (last && dayNumber(tx.date.slice(0, 10)) - dayNumber(last[last.length - 1].date.slice(0, 10)) <= MAX_GAP_DAYS) last.push(tx);
    else groups.push([tx]);
  });

  const trips = groups.filter(group => group.length >= MIN_TRIP_TRANSACTIONS).map((group): Trip => {
    const start = group[0].date.slice(0, 10);
    const end = group[group.length - 1].date.slice(0, 10);
    const days = dayNumber(end) - dayNumber(start) + 1;
    const countries = mostly(group.map(tx => clean(tx.country)), 10);
    const cities = mostly(group.map(tx => clean(tx.city)).filter(Boolean), 3);
    const spend = round2(group.reduce((total, tx) => safeAdd(total, spentOf(tx)), 0));

    const byCategory = new Map<string, number>();
    group.forEach(tx => { if (spentOf(tx) > 0) byCategory.set(tx.category, safeAdd(byCategory.get(tx.category) ?? 0, spentOf(tx))); });

    const spots = new Map<string, TripPlace>();
    group.forEach(tx => {
      if (!Number.isFinite(tx.latitude) || !Number.isFinite(tx.longitude)) return;
      const id = `${tx.latitude!.toFixed(3)},${tx.longitude!.toFixed(3)}`;
      const spot = spots.get(id) ?? { latitude: tx.latitude!, longitude: tx.longitude!, label: clean(tx.placeName) || clean(tx.merchant) || clean(tx.city) || 'Stop', count: 0 };
      spot.count++;
      spots.set(id, spot);
    });

    return {
      id: `trip:${start}`,
      name: nameOf(countries, cities),
      start, end, days, countries, cities,
      currencies: mostly(group.map(tx => tx.currency), 5),
      transactionIds: group.map(tx => tx.id),
      spend,
      perDay: round2(spend / days),
      topCategories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, amount]) => ({ category, amount: round2(amount) })),
      places: [...spots.values()].sort((a, b) => b.count - a.count).slice(0, MAX_PLACES),
      homePerDay: null,
    };
  });

  return withHomeBaseline(trips, dated, homeKey).sort((a, b) => b.start.localeCompare(a.start));
};

/** A day at home costs this much, over the span of your history outside the trips. */
const withHomeBaseline = (trips: Trip[], dated: Transaction[], homeKey: string): Trip[] => {
  if (dated.length === 0) return trips;
  const first = dayNumber(dated.reduce((min, tx) => (tx.date < min ? tx.date : min), dated[0].date).slice(0, 10));
  const last = dayNumber(dated.reduce((max, tx) => (tx.date > max ? tx.date : max), dated[0].date).slice(0, 10));
  const tripDays = trips.reduce((total, trip) => total + trip.days, 0);
  const homeDays = last - first + 1 - tripDays;
  if (homeDays < MIN_BASELINE_DAYS) return trips;
  const homeSpend = dated.filter(tx => key(tx.country!) === homeKey).reduce((total, tx) => safeAdd(total, spentOf(tx)), 0);
  const perDay = round2(homeSpend / homeDays);
  return trips.map(trip => ({ ...trip, homePerDay: perDay }));
};

/** Calendar days between two dates, both included. */
export const spanDays = (start: string, end: string) => dayNumber(end) - dayNumber(start) + 1;

/** A tile server address: https, with {z}, {x} and {y}. Anything else is refused rather than fetched. */
export const tileUrlProblem = (url: string): string | null => {
  const text = url.trim();
  if (!text) return 'Enter the tile address.';
  if (!/^https:\/\//i.test(text)) return 'The address must start with https://.';
  if (!text.includes('{z}') || !text.includes('{x}') || !text.includes('{y}')) return 'The address needs {z}, {x} and {y}, for example https://tiles.example.com/{z}/{x}/{y}.png';
  try { new URL(text.replace(/\{[xyzs]\}/g, '0')); } catch { return 'That is not a valid address.'; }
  return null;
};
