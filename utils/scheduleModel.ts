import type {
  Account, BillPayment, Currency, LoanPaymentOverrides, RecurrenceFrequency, RecurringTransaction,
  RecurringTransactionOverride, Transaction, WeekendAdjustment,
} from '../types';
import {
  adjustDateForWeekend, advanceRecurrenceDate, convertCurrency, generateSyntheticCreditCardPayments,
  generateSyntheticLoanPayments, generateSyntheticPropertyTransactions, parseLocalDate, round2, safeAdd, toLocalISOString,
} from '../utils';
import { ASSET_TYPES } from '../constants';

/*
 * Schedule model. One occurrence engine for recurring
 * items, one-time bills and the payments that come from accounts (loan installments, card settlements, property
 * costs): dated occurrences, which of them are already paid, and the figures the Schedule page shows. Pure, so it is
 * unit tested (tests/unit/scheduleModel.test.ts).
 */

export type OccurrenceSource = 'recurring' | 'bill' | 'loan' | 'card' | 'property';
export type OccurrenceStatus = 'overdue' | 'today' | 'upcoming' | 'paid' | 'skipped';
/** What an occurrence does to your money: comes in, goes out, or moves between your own accounts (S-01). */
export type Flow = 'in' | 'out' | 'move';

export interface Occurrence {
  /** `sourceId|originalDate`: stable across overrides. */
  key: string;
  source: OccurrenceSource;
  sourceId: string;
  /** The date the series puts it on (before weekend rule and overrides): the key of an override. */
  originalDate: string;
  /** The date it actually lands on. */
  date: string;
  /** Positive, in `currency`. The sign comes from `flow`. */
  amount: number;
  currency: Currency;
  flow: Flow;
  type: RecurringTransaction['type'] | BillPayment['type'];
  description: string;
  merchant?: string;
  category?: string;
  accountId?: string;
  toAccountId?: string;
  status: OccurrenceStatus;
  isOverride: boolean;
  /** Payments that come from an account (loan, card, property): changed on that account, not here. */
  isReadOnly: boolean;
  matchedTransactionId?: string;
  series?: RecurringTransaction;
  bill?: BillPayment;
}

export interface OccurrenceInput {
  recurring: RecurringTransaction[];
  overrides: RecurringTransactionOverride[];
  bills: BillPayment[];
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides?: LoanPaymentOverrides;
  /** Inclusive range of dates to list. */
  from: Date;
  to: Date;
  today: Date;
  /**
   * Recurring occurrences older than this many days that were never paid are left out. Bank-synced payments are
   * not always linked to their series, so an unlimited look-back would list every month since the series began.
   * Unpaid one-time bills are always listed (they have Expire).
   */
  overdueDays?: number;
  /** Payments from accounts (loans, cards, property). Default true. */
  includeSynthetic?: boolean;
}

export const iso = (d: Date) => toLocalISOString(d);
const dayMs = 24 * 60 * 60 * 1000;
const daysBetween = (a: string, b: string) => Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / dayMs);
export const addDays = (d: Date, n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };

export const sourceOfSeries = (rt: Pick<RecurringTransaction, 'id' | 'isSynthetic'>): OccurrenceSource => {
  if (!rt.isSynthetic) return 'recurring';
  if (rt.id.startsWith('loan-pmt-')) return 'loan';
  if (rt.id.startsWith('cc-pmt-')) return 'card';
  if (rt.id.startsWith('prop-')) return 'property';
  return 'recurring';
};

/** The account a payment from an account belongs to (the loan, the card, the property). */
export const owningAccountId = (rt: RecurringTransaction): string | undefined => {
  const source = sourceOfSeries(rt);
  if (source === 'loan') return rt.id.replace(/^loan-pmt-/, '').replace(/-\d+$/, '');
  if (source === 'card') return rt.toAccountId;
  if (source === 'property') return rt.id.replace(/^prop-[a-z]+-/, '');
  return undefined;
};

const isAssetAccount = (a?: Account) => !!a && ASSET_TYPES.includes(a.type);

/**
 * In, out or a move (S-01). A transfer between two of your assets moves money; into a card, a loan or an account
 * outside Crystal it goes out; from outside (or from a loan) into an asset it comes in.
 */
export const classifyFlow = (
  type: Occurrence['type'], accountId: string | undefined, toAccountId: string | undefined, accountsById: Map<string, Account>,
): Flow => {
  if (type === 'income' || type === 'deposit') return 'in';
  if (type === 'expense' || type === 'payment') return 'out';
  const from = accountId ? accountsById.get(accountId) : undefined;
  const to = toAccountId ? accountsById.get(toAccountId) : undefined;
  const fromAsset = isAssetAccount(from);
  const toAsset = isAssetAccount(to);
  if (fromAsset && toAsset) return 'move';
  if (fromAsset) return 'out';
  if (toAsset) return 'in';
  return 'move';
};

/** Signed amount of an occurrence for totals: + in, − out, 0 for a move. */
export const netOf = (o: Pick<Occurrence, 'flow' | 'amount'>) => (o.flow === 'in' ? o.amount : o.flow === 'out' ? -o.amount : 0);

/** Days between two occurrences of a series, roughly (for the matching window). */
export const periodDays = (frequency: RecurrenceFrequency, interval = 1): number => {
  const step = Math.max(1, interval || 1);
  switch (frequency) {
    case 'daily': return step;
    case 'weekly': return 7 * step;
    case 'biweekly': return 14 * step;
    case 'yearly': return 365 * step;
    default: return 30 * step;
  }
};

/** Monthly cost of a series (N2): what it adds up to in an average month. */
export const monthlyEquivalent = (rt: Pick<RecurringTransaction, 'amount' | 'frequency' | 'frequencyInterval'>): number => {
  const step = Math.max(1, rt.frequencyInterval || 1);
  const perYear = rt.frequency === 'daily' ? 365 : rt.frequency === 'weekly' ? 52 : rt.frequency === 'biweekly' ? 26 : rt.frequency === 'yearly' ? 1 : 12;
  return round2((Math.abs(rt.amount) * perYear) / 12 / step);
};

interface RawOccurrence { originalDate: string; date: string; amount: number; description: string; isOverride: boolean; isSkipped: boolean }

/** Every occurrence of one series between `fromStr` and `toStr` by effective date, skipped ones included. */
const expandSeries = (rt: RecurringTransaction, fromStr: string, toStr: string, overrides: Map<string, RecurringTransactionOverride>): RawOccurrence[] => {
  const result: RawOccurrence[] = [];
  const anchorDay = rt.dueDateOfMonth || parseLocalDate(rt.startDate || rt.nextDueDate).getDate();
  const endStr = rt.endDate || null;
  let next = parseLocalDate(rt.nextDueDate);
  // An override can move an occurrence up to a week either way, so scan a little wider than the range.
  const scanFrom = iso(addDays(parseLocalDate(fromStr), -7));
  let guard = 0;
  while (iso(next) < scanFrom && guard++ < 20000) next = advanceRecurrenceDate(next, rt.frequency, rt.frequencyInterval, anchorDay);
  const scanTo = iso(addDays(parseLocalDate(toStr), 7));
  guard = 0;
  while (guard++ < 20000) {
    const raw = iso(next);
    if (raw > scanTo || (endStr && raw > endStr)) break;
    const override = overrides.get(`${rt.id}|${raw}`);
    const date = override?.date || adjustDateForWeekend(raw, rt.weekendAdjustment);
    if (date >= fromStr && date <= toStr) {
      result.push({
        originalDate: raw,
        date,
        amount: Math.abs(override?.amount ?? rt.amount),
        description: override?.description || rt.description,
        isOverride: !!override,
        isSkipped: !!override?.isSkipped,
      });
    }
    next = advanceRecurrenceDate(next, rt.frequency, rt.frequencyInterval, anchorDay);
  }
  return result;
};

/**
 * Which occurrences are already paid (E-06). A transaction linked to the series (`recurringSourceId`) pays the
 * occurrence it names (`recurringOccurrenceDate`), else the nearest unpaid one within half a period (at most 4.5
 * days). One transaction pays one occurrence.
 */
export const matchPaid = (
  occurrences: { key: string; sourceId: string; originalDate: string; date: string }[],
  transactions: Transaction[],
  series: Map<string, RecurringTransaction>,
): Map<string, string> => {
  const paid = new Map<string, string>();
  const bySeries = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!tx.recurringSourceId) continue;
    const list = bySeries.get(tx.recurringSourceId) ?? [];
    list.push(tx);
    bySeries.set(tx.recurringSourceId, list);
  }
  const occBySeries = new Map<string, typeof occurrences>();
  for (const o of occurrences) {
    const list = occBySeries.get(o.sourceId) ?? [];
    list.push(o);
    occBySeries.set(o.sourceId, list);
  }
  for (const [seriesId, txs] of bySeries) {
    const occs = occBySeries.get(seriesId);
    if (!occs?.length) continue;
    const rt = series.get(seriesId);
    const windowDays = Math.min(4.5, (rt ? periodDays(rt.frequency, rt.frequencyInterval) : 30) / 2);
    const used = new Set<string>();
    // Explicit links first: posting from the Schedule page names the occurrence.
    for (const tx of txs) {
      const named = tx.recurringOccurrenceDate;
      if (!named) continue;
      const occ = occs.find(o => o.originalDate === named && !paid.has(o.key));
      if (occ) { paid.set(occ.key, tx.id); used.add(tx.id); }
    }
    // Then by date, nearest first, so one transaction never pays two occurrences.
    const pairs: { key: string; txId: string; distance: number }[] = [];
    for (const tx of txs) {
      if (used.has(tx.id) || tx.recurringOccurrenceDate) continue;
      for (const o of occs) {
        if (paid.has(o.key)) continue;
        const distance = Math.min(Math.abs(daysBetween(o.date, tx.date)), Math.abs(daysBetween(o.originalDate, tx.date)));
        if (distance <= windowDays) pairs.push({ key: o.key, txId: tx.id, distance });
      }
    }
    pairs.sort((a, b) => a.distance - b.distance);
    for (const p of pairs) {
      if (paid.has(p.key) || used.has(p.txId)) continue;
      paid.set(p.key, p.txId);
      used.add(p.txId);
    }
  }
  return paid;
};

const statusFor = (date: string, todayStr: string): OccurrenceStatus => (date < todayStr ? 'overdue' : date === todayStr ? 'today' : 'upcoming');

/** The synthetic series (loan installments, card settlements, property costs), generated once. */
export const syntheticSeries = (accounts: Account[], transactions: Transaction[], loanPaymentOverrides: LoanPaymentOverrides = {}): RecurringTransaction[] => [
  ...generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides),
  ...generateSyntheticCreditCardPayments(accounts, transactions),
  ...generateSyntheticPropertyTransactions(accounts),
];

/** Every occurrence in the range, plus recurring ones still unpaid from the last `overdueDays` days. */
export const buildOccurrences = (input: OccurrenceInput): Occurrence[] => {
  const { recurring, overrides, bills, accounts, transactions, from, to, today, overdueDays = 31, includeSynthetic = true } = input;
  const todayStr = iso(today);
  const accountsById = new Map(accounts.map(a => [a.id, a]));
  const overrideMap = new Map(overrides.map(o => [`${o.recurringTransactionId}|${o.originalDate}`, o]));
  const allSeries = [...recurring, ...(includeSynthetic ? syntheticSeries(accounts, transactions, input.loanPaymentOverrides) : [])];
  const seriesById = new Map(allSeries.map(rt => [rt.id, rt]));
  const lookBack = iso(addDays(today, -overdueDays));
  const fromStr = iso(from) < lookBack ? iso(from) : lookBack;
  const toStr = iso(to);
  const rangeFrom = iso(from);

  const out: Occurrence[] = [];
  for (const rt of allSeries) {
    const source = sourceOfSeries(rt);
    for (const raw of expandSeries(rt, fromStr, toStr, overrideMap)) {
      // Before the range only unpaid, past occurrences matter (they are overdue).
      if (raw.date < rangeFrom && raw.date >= todayStr) continue;
      out.push({
        key: `${rt.id}|${raw.originalDate}`,
        source,
        sourceId: rt.id,
        originalDate: raw.originalDate,
        date: raw.date,
        amount: raw.amount,
        currency: rt.currency,
        flow: classifyFlow(rt.type, rt.accountId, rt.toAccountId, accountsById),
        type: rt.type,
        description: raw.description,
        merchant: rt.merchant,
        category: rt.category,
        accountId: rt.accountId === 'external' ? undefined : rt.accountId,
        toAccountId: rt.toAccountId,
        status: raw.isSkipped ? 'skipped' : statusFor(raw.date, todayStr),
        isOverride: raw.isOverride,
        isReadOnly: source !== 'recurring',
        series: rt,
      });
    }
  }

  const paid = matchPaid(out, transactions, seriesById);
  for (const o of out) {
    const txId = paid.get(o.key);
    if (txId) { o.matchedTransactionId = txId; if (o.status !== 'skipped') o.status = 'paid'; }
  }
  // Paid occurrences before the range are history, not schedule.
  const kept = out.filter(o => o.date >= rangeFrom || o.status === 'overdue');

  for (const bill of bills) {
    if (bill.status === 'expired') continue;
    if (bill.status === 'unpaid' && bill.dueDate > toStr) continue;
    if (bill.status === 'paid' && (bill.dueDate < rangeFrom || bill.dueDate > toStr)) continue;
    kept.push({
      key: `${bill.id}|${bill.dueDate}`,
      source: 'bill',
      sourceId: bill.id,
      originalDate: bill.dueDate,
      date: bill.dueDate,
      amount: Math.abs(bill.amount),
      currency: bill.currency,
      flow: classifyFlow(bill.type, bill.accountId, undefined, accountsById),
      type: bill.type,
      description: bill.description,
      accountId: bill.accountId,
      status: bill.status === 'paid' ? 'paid' : statusFor(bill.dueDate, todayStr),
      isOverride: false,
      isReadOnly: false,
      bill,
    });
  }

  return kept.sort(compareOccurrences);
};

/** By date, then money in before money out, larger first (as the classic timeline). */
export const compareOccurrences = (a: Occurrence, b: Occurrence) => {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ai = a.flow === 'in' ? 0 : 1;
  const bi = b.flow === 'in' ? 0 : 1;
  if (ai !== bi) return ai - bi;
  return b.amount - a.amount;
};

/**
 * `nextDueDate` after an occurrence is paid (E-09). It moves past the paid occurrence only when that one was the
 * oldest still open; paying a later one early leaves the earlier ones open (they are matched by the link instead).
 */
export const nextDueAfterPaying = (
  rt: RecurringTransaction,
  paidOriginalDate: string,
  /** Original dates of the series' other occurrences still open (not paid, not skipped). */
  openOriginalDates: string[],
  /** Original dates already paid, which `nextDueDate` should step over. */
  paidOriginalDates: string[] = [],
): string => {
  if (paidOriginalDate < rt.nextDueDate) return rt.nextDueDate;
  if (openOriginalDates.some(d => d >= rt.nextDueDate && d < paidOriginalDate)) return rt.nextDueDate;
  const anchorDay = rt.dueDateOfMonth || parseLocalDate(rt.startDate || rt.nextDueDate).getDate();
  const paid = new Set(paidOriginalDates);
  let next = advanceRecurrenceDate(parseLocalDate(paidOriginalDate), rt.frequency, rt.frequencyInterval, anchorDay);
  let guard = 0;
  while (paid.has(iso(next)) && guard++ < 500) next = advanceRecurrenceDate(next, rt.frequency, rt.frequencyInterval, anchorDay);
  return iso(next);
};

// ---------------------------------------------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------------------------------------------

export interface Converter { (amount: number, currency: Currency): number }

export const makeConverter = (displayCurrency: Currency, rates?: Record<string, number>): Converter =>
  (amount, currency) => (currency === displayCurrency ? amount : convertCurrency(amount, currency, displayCurrency, rates));

/** Counts in totals: not skipped and not already paid. */
export const isOpen = (o: Occurrence) => o.status !== 'skipped' && o.status !== 'paid';

export interface Summary {
  in: number; out: number; moves: number; net: number; count: number;
  overdueCount: number; overdueNet: number;
  next?: Occurrence; largestOut?: Occurrence;
}

/** The next `days` days from today, inclusive of today (today … today + days − 1), plus everything overdue. */
export const summarize = (occurrences: Occurrence[], today: Date, convert: Converter, days = 30): Summary => {
  const todayStr = iso(today);
  const endStr = iso(addDays(today, days - 1));
  const s: Summary = { in: 0, out: 0, moves: 0, net: 0, count: 0, overdueCount: 0, overdueNet: 0 };
  let largest = 0;
  for (const o of occurrences) {
    if (!isOpen(o) || o.date > endStr) continue;
    const value = convert(o.amount, o.currency);
    if (o.status === 'overdue') { s.overdueCount += 1; s.overdueNet = safeAdd(s.overdueNet, netOf({ flow: o.flow, amount: value })); }
    s.count += 1;
    if (o.flow === 'in') s.in = safeAdd(s.in, value);
    else if (o.flow === 'out') {
      s.out = safeAdd(s.out, value);
      if (value > largest) { largest = value; s.largestOut = o; }
    } else s.moves = safeAdd(s.moves, value);
    if (!s.next && o.date >= todayStr) s.next = o;
  }
  s.net = round2(s.in - s.out);
  return s;
};

export interface DayCommitted { date: string; in: number; out: number; moves: number; net: number; cumulative: number }

/** Per day for the next `days` days (C1). Overdue items count on today: they still have to be paid. */
export const dailyCommitted = (occurrences: Occurrence[], today: Date, convert: Converter, days = 30): DayCommitted[] => {
  const todayStr = iso(today);
  const rows: DayCommitted[] = Array.from({ length: days }, (_, i) => ({ date: iso(addDays(today, i)), in: 0, out: 0, moves: 0, net: 0, cumulative: 0 }));
  const index = new Map(rows.map((r, i) => [r.date, i]));
  for (const o of occurrences) {
    if (!isOpen(o)) continue;
    const i = index.get(o.date < todayStr ? todayStr : o.date);
    if (i === undefined) continue;
    const value = convert(o.amount, o.currency);
    const row = rows[i];
    if (o.flow === 'in') row.in = safeAdd(row.in, value);
    else if (o.flow === 'out') row.out = safeAdd(row.out, value);
    else row.moves = safeAdd(row.moves, value);
  }
  let running = 0;
  for (const r of rows) { r.net = round2(r.in - r.out); running = safeAdd(running, r.net); r.cumulative = running; }
  return rows;
};

export type GroupId = 'overdue' | 'today' | 'next7' | string;
export interface OccurrenceGroup { id: GroupId; label: string; items: Occurrence[]; net: number }

const monthLabel = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Overdue, Today, Next 7 days, then one group per month (F1). Skipped items stay in their day, paid ones are left out. */
export const groupUpcoming = (occurrences: Occurrence[], today: Date, convert: Converter): OccurrenceGroup[] => {
  const todayStr = iso(today);
  const weekEnd = iso(addDays(today, 7));
  const groups = new Map<string, OccurrenceGroup>();
  const add = (id: string, label: string, o: Occurrence) => {
    const g = groups.get(id) ?? { id, label, items: [], net: 0 };
    g.items.push(o);
    if (o.status !== 'skipped') g.net = safeAdd(g.net, netOf({ flow: o.flow, amount: convert(o.amount, o.currency) }));
    groups.set(id, g);
  };
  for (const o of occurrences) {
    if (o.status === 'paid') continue;
    if (o.status === 'overdue') add('overdue', 'Overdue', o);
    else if (o.date === todayStr) add('today', 'Today', o);
    else if (o.date < todayStr) continue; // skipped in the past
    else if (o.date <= weekEnd) add('next7', 'Next 7 days', o);
    else add(o.date.slice(0, 7), monthLabel(o.date), o);
  }
  const fixed = ['overdue', 'today', 'next7'].map(id => groups.get(id)).filter((g): g is OccurrenceGroup => !!g);
  const months = [...groups.values()].filter(g => !['overdue', 'today', 'next7'].includes(g.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  return [...fixed, ...months];
};

// ---------------------------------------------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------------------------------------------

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** "Monthly on the 5th", "Every 2 weeks on Friday", "Yearly on 1 Mar". */
export const cadenceLabel = (rt: Pick<RecurringTransaction, 'frequency' | 'frequencyInterval' | 'dueDateOfMonth' | 'startDate' | 'nextDueDate'>): string => {
  const step = Math.max(1, rt.frequencyInterval || 1);
  const anchor = parseLocalDate(rt.nextDueDate || rt.startDate);
  const day = rt.dueDateOfMonth || parseLocalDate(rt.startDate || rt.nextDueDate).getDate();
  switch (rt.frequency) {
    case 'daily': return step === 1 ? 'Every day' : `Every ${step} days`;
    case 'weekly': return `${step === 1 ? 'Weekly' : `Every ${step} weeks`} on ${WEEKDAYS[anchor.getDay()]}`;
    case 'biweekly': return `${step === 1 ? 'Every 2 weeks' : `Every ${step * 2} weeks`} on ${WEEKDAYS[anchor.getDay()]}`;
    case 'yearly': return `${step === 1 ? 'Yearly' : `Every ${step} years`} on ${anchor.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
    default: return `${step === 1 ? 'Monthly' : `Every ${step} months`} on the ${ordinal(day)}`;
  }
};

/** The next `n` dates a series lands on (weekend rule applied), for the composer preview. */
export const nextDates = (rt: Pick<RecurringTransaction, 'frequency' | 'frequencyInterval' | 'dueDateOfMonth' | 'startDate' | 'nextDueDate' | 'endDate' | 'weekendAdjustment'>, from: Date, n = 3): string[] => {
  const anchorDay = rt.dueDateOfMonth || parseLocalDate(rt.startDate || rt.nextDueDate).getDate();
  let next = parseLocalDate(rt.nextDueDate || rt.startDate);
  const fromStr = iso(from);
  const out: string[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 5000) {
    const raw = iso(next);
    if (rt.endDate && raw > rt.endDate) break;
    const date = adjustDateForWeekend(raw, rt.weekendAdjustment);
    if (date >= fromStr) out.push(date);
    next = advanceRecurrenceDate(next, rt.frequency, rt.frequencyInterval, anchorDay);
  }
  return out;
};

export type SeriesGroupId = 'income' | 'expense' | 'transfer' | 'accounts' | 'ended';
export interface SeriesRow { series: RecurringTransaction; source: OccurrenceSource; monthly: number; next?: string; ended: boolean; flow: Flow }
export interface SeriesGroup { id: SeriesGroupId; label: string; rows: SeriesRow[]; monthlyIn: number; monthlyOut: number }

/**
 * The Series tab (F5): your series by kind, then the payments that come from accounts, grouped one row per account
 * (a loan's installments are one series), then ended series.
 */
export const seriesGroups = (recurring: RecurringTransaction[], synthetic: RecurringTransaction[], accounts: Account[], today: Date, convert: Converter): SeriesGroup[] => {
  const todayStr = iso(today);
  const accountsById = new Map(accounts.map(a => [a.id, a]));
  const groups: Record<SeriesGroupId, SeriesGroup> = {
    income: { id: 'income', label: 'Income', rows: [], monthlyIn: 0, monthlyOut: 0 },
    expense: { id: 'expense', label: 'Spending', rows: [], monthlyIn: 0, monthlyOut: 0 },
    transfer: { id: 'transfer', label: 'Transfers', rows: [], monthlyIn: 0, monthlyOut: 0 },
    accounts: { id: 'accounts', label: 'From your accounts', rows: [], monthlyIn: 0, monthlyOut: 0 },
    ended: { id: 'ended', label: 'Ended', rows: [], monthlyIn: 0, monthlyOut: 0 },
  };
  const tally = (g: SeriesGroup, row: SeriesRow) => {
    const value = convert(row.monthly, row.series.currency);
    if (row.flow === 'in') g.monthlyIn = safeAdd(g.monthlyIn, value);
    else if (row.flow === 'out') g.monthlyOut = safeAdd(g.monthlyOut, value);
  };
  for (const rt of recurring) {
    const ended = !!rt.endDate && rt.endDate < todayStr;
    const next = ended ? undefined : nextDates(rt, today, 1)[0];
    const row: SeriesRow = { series: rt, source: 'recurring', monthly: monthlyEquivalent(rt), next, ended, flow: classifyFlow(rt.type, rt.accountId, rt.toAccountId, accountsById) };
    const g = ended ? groups.ended : groups[rt.type];
    g.rows.push(row);
    if (!ended) tally(g, row);
  }
  // One row per owning account: the next installment, with its amount as the monthly cost.
  const byOwner = new Map<string, RecurringTransaction[]>();
  for (const rt of synthetic) {
    const owner = `${sourceOfSeries(rt)}:${owningAccountId(rt) ?? rt.id}`;
    const list = byOwner.get(owner) ?? [];
    list.push(rt);
    byOwner.set(owner, list);
  }
  for (const list of byOwner.values()) {
    const sorted = [...list].sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : 1));
    const first = sorted[0];
    const source = sourceOfSeries(first);
    const monthly = source === 'property' ? monthlyEquivalent(first) : round2(Math.abs(first.amount));
    const row: SeriesRow = { series: first, source, monthly, next: first.nextDueDate, ended: false, flow: classifyFlow(first.type, first.accountId, first.toAccountId, accountsById) };
    groups.accounts.rows.push(row);
    tally(groups.accounts, row);
  }
  for (const g of Object.values(groups)) g.rows.sort((a, b) => ((a.next ?? '9') < (b.next ?? '9') ? -1 : (a.next ?? '9') > (b.next ?? '9') ? 1 : a.series.description.localeCompare(b.series.description)));
  return (['income', 'expense', 'transfer', 'accounts', 'ended'] as SeriesGroupId[]).map(id => groups[id]).filter(g => g.rows.length > 0);
};

export interface CategoryCost { name: string; value: number }

/** Monthly cost of your spending series by category (C2): top `limit`, the rest as "Other". */
export const monthlyCostByCategory = (rows: SeriesRow[], convert: Converter, limit = 6): CategoryCost[] => {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.ended || r.flow !== 'out') continue;
    const name = r.series.category?.trim() || (r.source === 'loan' ? 'Loans' : r.source === 'card' ? 'Cards' : r.source === 'property' ? 'Property' : 'Other');
    totals.set(name, safeAdd(totals.get(name) ?? 0, convert(r.monthly, r.series.currency)));
  }
  const sorted = [...totals.entries()].map(([name, value]) => ({ name, value: round2(value) })).sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit - 1).reduce((s, c) => safeAdd(s, c.value), 0);
  return [...sorted.slice(0, limit - 1), { name: 'Other', value: round2(rest) }];
};

// ---------------------------------------------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------------------------------------------

export interface CalendarDay { date: string; inMonth: boolean; items: Occurrence[]; in: number; out: number; moves: number; net: number; hasOverdue: boolean }

/** A month grid (six weeks, `weekStartsOn` 1 = Monday) with each day's occurrences and totals. */
export const monthGrid = (year: number, month: number, occurrences: Occurrence[], convert: Converter, weekStartsOn = 1): CalendarDay[] => {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(first, -offset);
  const byDate = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    if (o.status === 'paid') continue;
    const list = byDate.get(o.date) ?? [];
    list.push(o);
    byDate.set(o.date, list);
  }
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i);
    const date = iso(d);
    const items = byDate.get(date) ?? [];
    let inSum = 0; let outSum = 0; let moves = 0;
    for (const o of items) {
      if (o.status === 'skipped') continue;
      const value = convert(o.amount, o.currency);
      if (o.flow === 'in') inSum = safeAdd(inSum, value);
      else if (o.flow === 'out') outSum = safeAdd(outSum, value);
      else moves = safeAdd(moves, value);
    }
    return { date, inMonth: d.getMonth() === month, items, in: inSum, out: outSum, moves, net: round2(inSum - outSum), hasOverdue: items.some(o => o.status === 'overdue') };
  });
};

// ---------------------------------------------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------------------------------------------

export type BillTab = 'unpaid' | 'paid' | 'expired';

/** Bills for one status chip; unpaid by due date, paid and expired newest first. */
export const billsFor = (bills: BillPayment[], tab: BillTab): BillPayment[] => {
  const list = bills.filter(b => b.status === tab);
  return list.sort((a, b) => (tab === 'unpaid' ? (a.dueDate < b.dueDate ? -1 : 1) : (a.dueDate > b.dueDate ? -1 : 1)));
};

/** Unpaid bills more than `days` days late (F7). */
export const oldUnpaidBills = (bills: BillPayment[], today: Date, days = 7): BillPayment[] => {
  const cutoff = iso(addDays(today, -days));
  return bills.filter(b => b.status === 'unpaid' && b.dueDate < cutoff);
};

// ---------------------------------------------------------------------------------------------------------------
// Search and filters
// ---------------------------------------------------------------------------------------------------------------

export interface ScheduleFilters {
  flows: Flow[];
  sources: OccurrenceSource[];
  accountIds: string[];
  categories: string[];
  showSkipped: boolean;
}

export const emptyFilters = (): ScheduleFilters => ({ flows: [], sources: [], accountIds: [], categories: [], showSkipped: true });

export const filterOccurrences = (occurrences: Occurrence[], f: ScheduleFilters, query: string, accountName: (id?: string) => string): Occurrence[] => {
  const q = query.trim().toLowerCase();
  return occurrences.filter(o => {
    if (f.flows.length && !f.flows.includes(o.flow)) return false;
    if (f.sources.length && !f.sources.includes(o.source)) return false;
    if (f.accountIds.length && !f.accountIds.includes(o.accountId ?? '') && !f.accountIds.includes(o.toAccountId ?? '')) return false;
    if (f.categories.length && !f.categories.includes(o.category ?? '')) return false;
    if (!f.showSkipped && o.status === 'skipped') return false;
    if (!q) return true;
    return [o.description, o.merchant, o.category, accountName(o.accountId), accountName(o.toAccountId)].some(v => v?.toLowerCase().includes(q));
  });
};

export const filterCount = (f: ScheduleFilters) =>
  f.flows.length + f.sources.length + f.accountIds.length + f.categories.length + (f.showSkipped ? 0 : 1);

// ---------------------------------------------------------------------------------------------------------------
// Series edits
// ---------------------------------------------------------------------------------------------------------------

export interface SeriesDraft {
  kind: 'recurring' | 'bill';
  type: 'income' | 'expense' | 'transfer';
  amount: string;
  currency: Currency;
  description: string;
  merchant: string;
  category: string;
  accountId: string;
  toAccountId: string;
  startDate: string;
  frequency: RecurrenceFrequency;
  frequencyInterval: string;
  dueDateOfMonth: string;
  weekendAdjustment: WeekendAdjustment;
  endDate: string;
}

export const emptySeriesDraft = (accountId: string, currency: Currency, today: Date): SeriesDraft => ({
  kind: 'recurring', type: 'expense', amount: '', currency, description: '', merchant: '', category: '', accountId, toAccountId: '',
  startDate: iso(today), frequency: 'monthly', frequencyInterval: '1', dueDateOfMonth: '', weekendAdjustment: 'on', endDate: '',
});

export const draftFromSeries = (rt: RecurringTransaction): SeriesDraft => ({
  kind: 'recurring', type: rt.type, amount: String(Math.abs(rt.amount)), currency: rt.currency, description: rt.description,
  merchant: rt.merchant ?? '', category: rt.category ?? '', accountId: rt.accountId, toAccountId: rt.toAccountId ?? '',
  startDate: rt.nextDueDate || rt.startDate, frequency: rt.frequency, frequencyInterval: String(rt.frequencyInterval || 1),
  dueDateOfMonth: rt.dueDateOfMonth ? String(rt.dueDateOfMonth) : '', weekendAdjustment: rt.weekendAdjustment, endDate: rt.endDate ?? '',
});

export const draftFromBill = (bill: BillPayment): SeriesDraft => ({
  kind: 'bill', type: bill.type === 'deposit' ? 'income' : 'expense', amount: String(Math.abs(bill.amount)), currency: bill.currency,
  description: bill.description, merchant: '', category: '', accountId: bill.accountId ?? '', toAccountId: '', startDate: bill.dueDate,
  frequency: 'monthly', frequencyInterval: '1', dueDateOfMonth: '', weekendAdjustment: 'on', endDate: '',
});

/** Parses "1.250,50" and "1,250.50" alike (the Budget L-B3 rule). */
export const parseAmountInput = (value: string): number => {
  const v = value.trim().replace(/\s/g, '');
  if (!v) return NaN;
  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');
  let normalized = v;
  if (lastComma > lastDot) normalized = v.replace(/\./g, '').replace(',', '.');
  else normalized = v.replace(/,/g, '');
  return Number(normalized);
};

/**
 * The first date on or after `start` that falls on `day` of the month (clamped to short months). Yearly series keep
 * `start`'s month. A series that starts on the 29th but pays on the 5th first pays on the next 5th.
 */
export const firstDueOnOrAfter = (start: string, day: number | undefined, frequency: RecurrenceFrequency): string => {
  if (!day || (frequency !== 'monthly' && frequency !== 'yearly')) return start;
  const s = parseLocalDate(start);
  const at = (year: number, month: number) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
  let candidate = at(s.getFullYear(), s.getMonth());
  if (iso(candidate) < start) candidate = frequency === 'yearly' ? at(s.getFullYear() + 1, s.getMonth()) : at(s.getFullYear(), s.getMonth() + 1);
  return iso(candidate);
};

export type SeriesPlan =
  | { ok: true; kind: 'recurring'; series: Omit<RecurringTransaction, 'id'> & { id?: string } }
  | { ok: true; kind: 'bill'; bill: Omit<BillPayment, 'id'> & { id?: string } }
  | { ok: false; error: string };

/** Validates a draft and turns it into what the schedule context saves. */
export const planSeries = (draft: SeriesDraft, existingId?: string, existingBill?: BillPayment): SeriesPlan => {
  const amount = round2(parseAmountInput(draft.amount));
  if (!(amount > 0)) return { ok: false, error: 'Enter an amount' };
  if (!draft.description.trim() && !draft.merchant.trim()) return { ok: false, error: 'Add a name' };
  if (!draft.startDate) return { ok: false, error: 'Choose a date' };
  if (draft.kind === 'bill') {
    const deposit = draft.type === 'income';
    return {
      ok: true, kind: 'bill',
      bill: {
        ...(existingBill ?? {}),
        id: existingId,
        description: draft.description.trim() || draft.merchant.trim(),
        amount: deposit ? amount : -amount,
        type: deposit ? 'deposit' : 'payment',
        currency: draft.currency,
        dueDate: draft.startDate,
        status: existingBill?.status ?? 'unpaid',
        accountId: draft.accountId || undefined,
      },
    };
  }
  if (!draft.accountId) return { ok: false, error: 'Choose an account' };
  if (draft.type === 'transfer') {
    if (!draft.toAccountId) return { ok: false, error: 'Choose the account it goes to' };
    if (draft.toAccountId === draft.accountId) return { ok: false, error: 'Choose two different accounts' };
  }
  if (draft.endDate && draft.endDate < draft.startDate) return { ok: false, error: 'The end date is before the start' };
  const interval = Math.max(1, Math.floor(Number(draft.frequencyInterval) || 1));
  const day = Number(draft.dueDateOfMonth);
  const usesDay = draft.frequency === 'monthly' || draft.frequency === 'yearly';
  return {
    ok: true, kind: 'recurring',
    series: {
      id: existingId,
      accountId: draft.accountId,
      toAccountId: draft.type === 'transfer' ? draft.toAccountId : undefined,
      description: draft.description.trim() || draft.merchant.trim(),
      merchant: draft.merchant.trim() || undefined,
      amount,
      category: draft.type === 'transfer' ? undefined : draft.category || undefined,
      type: draft.type,
      currency: draft.currency,
      frequency: draft.frequency,
      frequencyInterval: interval,
      startDate: draft.startDate,
      nextDueDate: firstDueOnOrAfter(draft.startDate, usesDay && day >= 1 && day <= 31 ? day : undefined, draft.frequency),
      endDate: draft.endDate || undefined,
      dueDateOfMonth: usesDay && day >= 1 && day <= 31 ? day : undefined,
      weekendAdjustment: draft.weekendAdjustment,
    },
  };
};

/**
 * "This and future" (F13): the old series ends the day before `originalDate`, a new one starts there with the
 * changes. Returns both records.
 */
export const splitSeriesAt = (rt: RecurringTransaction, originalDate: string, changes: Omit<RecurringTransaction, 'id'>) => ({
  ended: { ...rt, endDate: iso(addDays(parseLocalDate(originalDate), -1)) },
  started: { ...changes, startDate: originalDate, nextDueDate: originalDate } as Omit<RecurringTransaction, 'id'>,
});

/** End a series at an occurrence: its last payment is the one before. */
export const endSeriesAt = (rt: RecurringTransaction, originalDate: string): RecurringTransaction => ({ ...rt, endDate: iso(addDays(parseLocalDate(originalDate), -1)) });

/** Payment history of a series (N1): the last `n` linked transactions, newest first, with days late. */
export const paymentHistory = (rt: RecurringTransaction, transactions: Transaction[], n = 6) =>
  transactions
    .filter(t => t.recurringSourceId === rt.id && t.amount !== 0)
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, n)
    .map(t => ({ transaction: t, daysLate: t.recurringOccurrenceDate ? daysBetween(t.recurringOccurrenceDate, t.date) : 0 }));
