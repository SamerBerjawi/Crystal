import type { Account, Currency, RecurrenceFrequency, RecurringTransaction, Transaction, WeekendAdjustment } from '../types';

/**
 * Pure logic for TransactionsNew (UI_UX_DESIGN_REFERENCE.md §5.0, D13): display rows, filters, day groups,
 * period totals, CSV and turning a form draft into the transactions to save. Unit tested in
 * tests/unit/transactionsModel.test.ts. Amounts follow the stored convention: expenses negative, income
 * positive; a transfer is an expense leg and an income leg sharing a `transferId`.
 */

export type TxKind = 'expense' | 'income' | 'transfer';

export interface TxRow {
  /** Stable row id: the transaction id, or `xfer:<transferId>` for a transfer pair. */
  id: string;
  kind: TxKind;
  date: string;
  title: string;
  /** Description, when the title is the merchant and the two differ. */
  detail?: string;
  merchant?: string;
  description: string;
  category: string;
  /** Signed for expense and income; the positive amount moved for a transfer. */
  amount: number;
  currency: Currency;
  /** The account (for a transfer, the one money leaves). */
  accountId: string;
  /** Transfers: the account money arrives in, and its amount and currency. */
  toAccountId?: string;
  toAmount?: number;
  toCurrency?: Currency;
  tagIds: string[];
  notes?: string;
  /** Every stored transaction behind the row (two for a transfer). */
  txIds: string[];
  /** Location, when the transaction has one (a transfer shows its outgoing leg's). */
  city?: string;
  country?: string;
  place?: string;
  located: boolean;
  lat?: number;
  lng?: number;
  /** Where it happened, for the map and the Locations filter: the city, else a coordinate cell. */
  placeKey?: string;
  /** A split parent (its parts are hidden rows) or a combined parent. */
  split: boolean;
  combined: boolean;
  recurring: boolean;
  adjustment: boolean;
  roundUp: boolean;
  uncategorized: boolean;
  /** The round-up set aside for this transaction: its spare-change pair is folded into the row, not listed apart. */
  spare?: { amount: number; currency: Currency; txIds: string[] };
}

export const isUncategorized = (category?: string) => !category || !category.trim() || category.trim().toLowerCase() === 'uncategorized';

/** Rows that need the user's attention (the To review tab). */
export const needsReview = (row: TxRow) => row.kind !== 'transfer' && !row.adjustment && row.uncategorized;

const dateOf = (iso: string) => (iso || '').slice(0, 10);

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** The coordinates of a transaction, and the key of the place they belong to. */
const coordsOf = (tx: Transaction): { lat?: number; lng?: number; placeKey?: string } => {
  const ok = finite(tx.latitude) && finite(tx.longitude) && !(tx.latitude === 0 && tx.longitude === 0);
  const lat = ok ? tx.latitude : undefined;
  const lng = ok ? tx.longitude : undefined;
  const city = tx.city?.trim();
  return { lat, lng, placeKey: city || (ok ? `geo:${tx.latitude!.toFixed(1)},${tx.longitude!.toFixed(1)}` : undefined) };
};

const base = (tx: Transaction) => ({
  merchant: tx.merchant || undefined,
  description: tx.description || '',
  tagIds: tx.tagIds ?? [],
  notes: tx.notes || undefined,
  split: !!tx.isSplitParent,
  combined: !!tx.isCombinedParent,
  city: tx.city || undefined,
  country: tx.country || undefined,
  place: tx.placeName || tx.locationLabel || undefined,
  located: !!(tx.address || tx.city || tx.country || tx.latitude !== undefined),
  ...coordsOf(tx),
  recurring: !!tx.recurringSourceId,
  adjustment: !!(tx.isBalanceAdjustment || tx.isMarketAdjustment),
});

const titleFor = (merchant: string | undefined, description: string, fallback: string) => {
  const title = merchant?.trim() || description.trim() || fallback;
  const detail = merchant?.trim() && description.trim() && description.trim() !== merchant.trim() ? description.trim() : undefined;
  return { title, detail };
};

type SpareInfo = { transferId: string; pair: Transaction[]; amount: number; currency: Currency; used: boolean };

/**
 * Round-ups are stored as a pair of transfer legs with the id `spare-<transaction id or transfer id>`. They are
 * folded into the transaction they belong to (as the classic table did): by that id, or, for older data without it,
 * by account, day and description.
 */
const collectSpares = (transactions: Transaction[]) => {
  const parents = new Set<string>();
  const pairs = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.transferId?.startsWith('spare-')) {
      const list = pairs.get(tx.transferId);
      if (list) list.push(tx); else pairs.set(tx.transferId, [tx]);
    } else {
      parents.add(tx.id);
      if (tx.transferId) parents.add(tx.transferId);
    }
  }
  const byParent = new Map<string, SpareInfo>();
  const legacy = new Map<string, SpareInfo[]>();
  const all: SpareInfo[] = [];
  for (const [transferId, pair] of pairs) {
    const out = pair.find(t => t.amount < 0 || t.type === 'expense') ?? pair[0];
    const info: SpareInfo = { transferId, pair, amount: Math.abs(out.amount), currency: out.currency, used: false };
    all.push(info);
    const parentId = transferId.slice('spare-'.length);
    if (parents.has(parentId)) { byParent.set(parentId, info); continue; }
    const what = (out.description || '').replace(/^Spare change (for|from)\s*/i, '').trim().toLowerCase();
    const key = `${out.accountId}|${dateOf(out.date)}|${what}`;
    legacy.set(key, [...(legacy.get(key) ?? []), info]);
  }
  const claim = (info: SpareInfo): TxRow['spare'] => { info.used = true; return { amount: info.amount, currency: info.currency, txIds: info.pair.map(t => t.id) }; };
  return {
    take(ids: string[], accountId: string, date: string, description: string | undefined, amount: number): TxRow['spare'] {
      for (const id of ids) {
        const info = byParent.get(id);
        if (info && !info.used) return claim(info);
      }
      const key = `${accountId}|${date}|${(description || 'transaction').trim().toLowerCase()}`;
      const candidates = (legacy.get(key) ?? []).filter(i => !i.used);
      if (!candidates.length) return undefined;
      // Several round-ups on one day and description: take the one a standard round-up of this amount would give.
      const remainder = Math.abs(amount) % 1;
      const expected = round2(remainder === 0 ? 1 : 1 - remainder);
      return claim(candidates.find(i => Math.abs(i.amount - expected) < 0.005) ?? candidates[0]);
    },
    leftover: () => all.filter(i => !i.used).map(i => [i.transferId, i.pair] as [string, Transaction[]]),
  };
};

/**
 * One row per thing that happened: transfer legs are merged, and the parts behind a split or combined
 * transaction are hidden (their parent carries the total). Newest first.
 */
export const buildRows = (transactions: Transaction[], options: { showBalanceAdjustments?: boolean } = {}): TxRow[] => {
  const showAdjustments = options.showBalanceAdjustments ?? true;
  const rows: TxRow[] = [];
  const legs = new Map<string, Transaction[]>();
  const spares = collectSpares(transactions);

  for (const tx of transactions) {
    if (tx.parentTransactionId) continue;
    if (tx.transferId?.startsWith('spare-')) continue; // folded into its transaction, or listed below when it has none
    if (!showAdjustments && tx.isBalanceAdjustment) continue;
    if (tx.transferId) {
      const list = legs.get(tx.transferId);
      if (list) list.push(tx); else legs.set(tx.transferId, [tx]);
      continue;
    }
    const kind: TxKind = tx.type === 'income' ? 'income' : 'expense';
    rows.push({
      id: tx.id,
      kind,
      date: dateOf(tx.date),
      ...titleFor(tx.merchant, tx.description || '', tx.category || 'Transaction'),
      ...base(tx),
      category: tx.category || '',
      amount: tx.amount,
      currency: tx.currency,
      accountId: tx.accountId,
      txIds: [tx.id],
      roundUp: false,
      uncategorized: isUncategorized(tx.category),
      spare: spares.take([tx.id], tx.accountId, dateOf(tx.date), tx.description, tx.amount),
    });
  }
  // A round-up pair whose transaction is not in the list (deleted, or hidden) stays visible as its own row.
  for (const [transferId, pair] of spares.leftover()) legs.set(transferId, pair);

  for (const [transferId, pair] of legs) {
    const out = pair.find(t => t.amount < 0 || t.type === 'expense') ?? pair[0];
    const into = pair.find(t => t !== out);
    const roundUp = transferId.startsWith('spare-');
    rows.push({
      id: `xfer:${transferId}`,
      kind: 'transfer',
      date: dateOf(out.date),
      ...titleFor(out.merchant === 'Internal Transfer' ? undefined : out.merchant, out.description || '', roundUp ? 'Round-up' : 'Transfer'),
      ...base(out),
      category: out.category || 'Transfer',
      amount: Math.abs(out.amount),
      currency: out.currency,
      accountId: out.accountId,
      toAccountId: into?.accountId,
      toAmount: into ? Math.abs(into.amount) : undefined,
      toCurrency: into?.currency,
      txIds: pair.map(t => t.id),
      roundUp,
      uncategorized: false,
      spare: roundUp ? undefined : spares.take([out.id, transferId], out.accountId, dateOf(out.date), out.description, out.amount),
    });
  }

  return rows.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
};

export interface TxFilters {
  query?: string;
  /** Text in the description (or title, details, notes) / the merchant, each on its own. */
  description?: string;
  merchant?: string;
  /** Exact merchants (chosen from a list). */
  merchants?: string[];
  /** Empty means every kind. */
  kinds?: TxKind[];
  accountIds?: string[];
  categories?: string[];
  tagIds?: string[];
  /** Inclusive ISO dates. */
  from?: string;
  to?: string;
  review?: boolean;
  /** Absolute amount bounds. */
  minAmount?: number;
  maxAmount?: number;
  /** Place keys (city, or a coordinate cell) of the transaction's location. */
  places?: string[];
  /** Days of the week, Monday = 0 … Sunday = 6. */
  weekdays?: number[];
}

export const filterRows = (rows: TxRow[], f: TxFilters): TxRow[] => {
  const q = f.query?.trim().toLowerCase();
  const d = f.description?.trim().toLowerCase();
  const m = f.merchant?.trim().toLowerCase();
  const exact = f.merchants?.length ? new Set(f.merchants.map(x => x.toLowerCase())) : null;
  return rows.filter(r => {
    if (d && ![r.detail, r.description, r.notes].filter(Boolean).join(' ').toLowerCase().includes(d)) return false;
    if (exact && !(r.merchant && exact.has(r.merchant.toLowerCase()))) return false;
    if (m && !`${r.merchant ?? ''} ${r.title}`.toLowerCase().includes(m)) return false;
    if (f.review && !needsReview(r)) return false;
    if (f.kinds?.length && !f.kinds.includes(r.kind)) return false;
    if (f.accountIds?.length && !f.accountIds.includes(r.accountId) && !(r.toAccountId && f.accountIds.includes(r.toAccountId))) return false;
    if (f.categories?.length && !f.categories.includes(r.category)) return false;
    if (f.tagIds?.length && !r.tagIds.some(t => f.tagIds!.includes(t))) return false;
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    if (f.minAmount !== undefined && Math.abs(r.amount) < f.minAmount) return false;
    if (f.maxAmount !== undefined && Math.abs(r.amount) > f.maxAmount) return false;
    if (f.places?.length && !(r.placeKey && f.places.includes(r.placeKey))) return false;
    if (f.weekdays?.length && !f.weekdays.includes(weekdayOf(r.date))) return false;
    if (q) {
      const hay = [r.title, r.detail, r.merchant, r.description, r.category, r.notes, r.city, r.place, Math.abs(r.amount).toFixed(2)].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
};

/** Monday = 0 … Sunday = 6 for an ISO date. */
export const weekdayOf = (isoDate: string): number => {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return (new Date(y, (m || 1) - 1, d || 1).getDay() + 6) % 7;
};

export interface DayGroup { date: string; rows: TxRow[] }

/** Consecutive rows of the same day, in the rows' order. */
export const groupByDay = (rows: TxRow[]): DayGroup[] => {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.date) last.rows.push(row);
    else groups.push({ date: row.date, rows: [row] });
  }
  return groups;
};

export type SortId = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'merchant-asc' | 'category-asc';

export const SORTS: { value: SortId; label: string }[] = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Largest amount' },
  { value: 'amount-asc', label: 'Smallest amount' },
  { value: 'merchant-asc', label: 'Merchant A–Z' },
  { value: 'category-asc', label: 'Category A–Z' },
];

/** Date sorts group by day; the others are one flat list. */
export const isDateSort = (sort: SortId) => sort === 'date-desc' || sort === 'date-asc';

export const sortRows = (rows: TxRow[], sort: SortId): TxRow[] => {
  const byDate = (a: TxRow, b: TxRow) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1);
  const cmp: Record<SortId, (a: TxRow, b: TxRow) => number> = {
    'date-desc': (a, b) => byDate(b, a),
    'date-asc': byDate,
    'amount-desc': (a, b) => Math.abs(b.amount) - Math.abs(a.amount) || byDate(b, a),
    'amount-asc': (a, b) => Math.abs(a.amount) - Math.abs(b.amount) || byDate(b, a),
    'merchant-asc': (a, b) => a.title.localeCompare(b.title) || byDate(b, a),
    'category-asc': (a, b) => a.category.localeCompare(b.category) || byDate(b, a),
  };
  return [...rows].sort(cmp[sort]);
};

export type PeriodId = 'MTD' | 'LM' | '90D' | 'YTD' | '1Y' | 'ALL';

export const PERIODS: { value: PeriodId; label: string }[] = [
  { value: 'MTD', label: 'This month' },
  { value: 'LM', label: 'Last month' },
  { value: '90D', label: 'Last 90 days' },
  { value: 'YTD', label: 'This year' },
  { value: '1Y', label: 'Last 12 months' },
  { value: 'ALL', label: 'All time' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The inclusive date range of a period, in local time. `ALL` has no bounds. */
export const periodRange = (period: PeriodId, today: Date): { from?: string; to?: string } => {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (period) {
    case 'MTD': return { from: iso(new Date(y, m, 1)), to: iso(today) };
    case 'LM': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case '90D': return { from: iso(new Date(y, m, today.getDate() - 89)), to: iso(today) };
    case 'YTD': return { from: iso(new Date(y, 0, 1)), to: iso(today) };
    case '1Y': return { from: iso(new Date(y - 1, m, today.getDate() + 1)), to: iso(today) };
    default: return {};
  }
};

/**
 * Spending and income in one currency. Transfers and balance adjustments are neither; split and combined
 * parents count once (their parts are not rows). `convert` turns an amount into the display currency.
 */
export const periodTotals = (rows: TxRow[], convert: (amount: number, currency: Currency) => number) => {
  let spent = 0;
  let income = 0;
  for (const r of rows) {
    if (r.kind === 'transfer' || r.adjustment) continue;
    const value = convert(r.amount, r.currency);
    if (r.kind === 'expense') spent -= value; else income += value;
  }
  return { spent: Math.round(spent * 100) / 100, income: Math.round(income * 100) / 100 };
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** CSV of the rows shown, one line per row. */
export const rowsToCsv = (rows: TxRow[], accountName: (id?: string) => string, tagName: (id: string) => string): string => {
  const header = ['Date', 'Type', 'Title', 'Description', 'Category', 'Amount', 'Currency', 'Account', 'To account', 'Tags', 'Notes'];
  const lines = rows.map(r => [
    r.date, r.kind, r.title, r.description, r.category, r.amount.toFixed(2), r.currency,
    accountName(r.accountId), r.toAccountId ? accountName(r.toAccountId) : '', r.tagIds.map(tagName).join('; '), r.notes ?? '',
  ].map(csvCell).join(','));
  return [header.map(csvCell).join(','), ...lines].join('\n');
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------------------------------------------------------------- location */

export interface LocationDraft {
  address: string; placeName: string; street: string; city: string; postalCode: string; state: string; country: string;
  latitude?: number; longitude?: number; label: string;
}

export const emptyLocation = (): LocationDraft => ({ address: '', placeName: '', street: '', city: '', postalCode: '', state: '', country: '', label: '' });

export const hasLocation = (l: LocationDraft) => !!(l.address.trim() || l.city.trim() || l.country.trim());

export const locationFromTx = (t?: Transaction): LocationDraft => ({
  address: t?.address ?? '', placeName: t?.placeName ?? '', street: t?.street ?? '', city: t?.city ?? '', postalCode: t?.postalCode ?? '',
  state: t?.state ?? '', country: t?.country ?? '', latitude: t?.latitude, longitude: t?.longitude, label: t?.locationLabel ?? '',
});

/** The transaction fields for a location; every key is present so an empty location clears what was stored. */
export const locationFields = (l: LocationDraft): Partial<Transaction> => {
  const on = hasLocation(l);
  const t = (v: string) => (on ? v.trim() || undefined : undefined);
  return {
    address: t(l.address), placeName: t(l.placeName), street: t(l.street), city: t(l.city), postalCode: t(l.postalCode), state: t(l.state),
    country: t(l.country), locationLabel: t(l.label),
    latitude: on && l.latitude !== undefined && !Number.isNaN(l.latitude) ? l.latitude : undefined,
    longitude: on && l.longitude !== undefined && !Number.isNaN(l.longitude) ? l.longitude : undefined,
  };
};

/** One line for a location: place, street and city. */
/** Metres between two coordinates (haversine). */
const metresBetween = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(h));
};

type AddressParts = { address?: string; placeName?: string; street?: string; city?: string; postalCode?: string; state?: string; country?: string; latitude?: number; longitude?: number };

/**
 * A transaction's address as lines for display, with the place's name when the merchant has it saved: the branch
 * (Merchants page) at the same spot or the same address, else the transaction's own branch label. Structured fields
 * give street / postcode and city / region / country; a formatted address alone is split on its commas. A leading
 * segment that only repeats the merchant or the name is dropped.
 */
export const addressBlock = (
  tx: AddressParts & { locationLabel?: string } | undefined,
  merchant: string | undefined,
  saved: (AddressParts & { locations?: (AddressParts & { label?: string })[] }) | undefined,
): { name?: string; lines: string[] } | null => {
  if (!tx) return null;
  const same = (loc: AddressParts) =>
    (tx.latitude !== undefined && tx.longitude !== undefined && loc.latitude !== undefined && loc.longitude !== undefined
      && metresBetween(tx.latitude, tx.longitude, loc.latitude, loc.longitude) < 150)
    || (!!tx.address && !!loc.address && tx.address.trim().toLowerCase() === loc.address.trim().toLowerCase());
  const branch = saved?.locations?.find(same) ?? (saved && same(saved) ? { ...saved, label: undefined } : undefined);
  const name = (tx.locationLabel || (branch && 'label' in branch && branch.label) || branch?.placeName || '').trim() || undefined;
  const skip = new Set([merchant, name, tx.placeName].filter(Boolean).map(v => v!.trim().toLowerCase()));

  let lines: string[];
  if (tx.street || tx.postalCode) {
    lines = [tx.street, [tx.postalCode, tx.city].filter(Boolean).join(' '), tx.state, tx.country].map(v => (v || '').trim()).filter(Boolean);
  } else if (tx.address) {
    lines = tx.address.split(',').map(v => v.trim()).filter(Boolean);
  } else {
    lines = [tx.placeName, tx.city, tx.country].map(v => (v || '').trim()).filter(Boolean);
  }
  while (lines.length > 1 && skip.has(lines[0].toLowerCase())) lines.shift();
  return lines.length || name ? { name, lines } : null;
};

export const locationLine = (r: { place?: string; city?: string; country?: string }) => [r.place, r.city, r.country].filter(Boolean).join(', ');

/* -------------------------------------------------------- loans, round-ups */

/** The share of a loan payment that is interest this month and the rest that reduces the principal. */
export const loanSplit = (payment: number, loan: { balance: number; interestRate?: number }) => {
  if (!(payment > 0) || !loan.interestRate) return null;
  const interest = Math.min(payment, round2((Math.abs(loan.balance) * (loan.interestRate / 100)) / 12));
  return { interest, principal: round2(payment - interest) };
};

/** The loan a draft pays into: the destination of a transfer, or the account of an income. */
export const loanOf = (draft: Pick<TxDraft, 'kind' | 'accountId' | 'toAccountId'>, accounts: Account[]): Account | undefined => {
  const id = draft.kind === 'transfer' ? draft.toAccountId : draft.kind === 'income' ? draft.accountId : '';
  const a = accounts.find(x => x.id === id);
  return a?.type === 'Loan' ? a : undefined;
};

/** The spare-change account fed by an account, if any. */
export const spareAccountFor = (accounts: Account[], accountId: string) =>
  accounts.find(a => a.type === 'Investment' && a.subType === 'Spare Change' && a.linkedAccountId === accountId);

export type RoundUpBehavior = 'skip' | 'unit';

/** What rounding `amount` up to the next whole unit sets aside, times a multiplier. `skip` ignores whole amounts; `unit` sets aside 1. */
export const roundUpAmount = (amount: number, behavior: RoundUpBehavior = 'skip', multiplier = 1): number => {
  if (!(amount > 0)) return 0;
  const remainder = parseFloat((amount % 1).toFixed(2));
  const base = remainder === 0 ? (behavior === 'unit' ? 1 : 0) : 1 - remainder;
  return round2(base * Math.max(0, Number.isFinite(multiplier) ? multiplier : 1));
};

/* ------------------------------------------------------------------- draft */

/** What the add / edit form holds. `amount` is the typed text. */
export interface TxDraft {
  kind: TxKind;
  amount: string;
  /** Expense and income: the account; transfer: the account money leaves. */
  accountId: string;
  /** Transfer: the account money arrives in. */
  toAccountId: string;
  category: string;
  date: string;
  merchant: string;
  description: string;
  notes: string;
  tagIds: string[];
  location: LocationDraft;
  /** Loan payments: typed principal and interest, and whether they follow the amount automatically. */
  principal: string;
  interest: string;
  autoLoanSplit: boolean;
  /** Round-up into the spare-change account of the paying account. */
  roundUp: boolean;
  roundUpBehavior: RoundUpBehavior;
  roundUpMultiplier: string;
}

export const emptyDraft = (kind: TxKind, accountId: string, today: Date): TxDraft => ({
  kind, amount: '', accountId, toAccountId: '', category: '', date: iso(today), merchant: '', description: '', notes: '', tagIds: [],
  location: emptyLocation(), principal: '', interest: '', autoLoanSplit: true, roundUp: false, roundUpBehavior: 'skip', roundUpMultiplier: '1',
});

/** The round-up pair stored for a transaction, by its transfer id convention `spare-<id>`. */
export const roundUpPairOf = (mainId: string, transactions: Transaction[]) => {
  const pair = transactions.filter(t => t.transferId === `spare-${mainId}`);
  return pair.length ? { out: pair.find(t => t.amount < 0) ?? pair[0], into: pair.find(t => t.amount > 0), ids: pair.map(t => t.id) } : null;
};

/** A draft for editing `row`. With `transactions`, location, loan split and round-up come from the stored records. */
export const draftFromRow = (row: TxRow, transactions: Transaction[] = []): TxDraft => {
  const byId = new Map(transactions.map(t => [t.id, t]));
  const legs = row.txIds.map(id => byId.get(id)).filter((t): t is Transaction => !!t);
  const out = legs.find(t => t.amount < 0 || t.type === 'expense') ?? legs[0];
  const loanLeg = legs.find(t => t.principalAmount !== undefined || t.interestAmount !== undefined);
  const pair = out ? roundUpPairOf(row.kind === 'transfer' ? (out.id) : row.id, transactions) : null;
  const base = row.kind === 'transfer' && row.category === 'Transfer' ? '' : row.category;
  let multiplier = '1';
  if (pair?.out) {
    const baseAmt = roundUpAmount(Math.abs(row.amount), 'skip', 1);
    if (baseAmt > 0) multiplier = String(Math.max(1, round2(Math.abs(pair.out.amount) / baseAmt)));
  }
  return {
    kind: row.kind,
    amount: String(Math.abs(row.amount)),
    accountId: row.accountId,
    toAccountId: row.toAccountId ?? '',
    category: base,
    date: row.date,
    merchant: row.merchant ?? '',
    description: row.description,
    notes: row.notes ?? '',
    tagIds: row.tagIds,
    location: locationFromTx(out),
    principal: loanLeg?.principalAmount !== undefined ? String(loanLeg.principalAmount) : '',
    interest: loanLeg?.interestAmount !== undefined ? String(loanLeg.interestAmount) : '',
    autoLoanSplit: loanLeg ? false : true,
    roundUp: !!pair,
    roundUpBehavior: 'skip',
    roundUpMultiplier: multiplier,
  };
};

export type SavePlan =
  | { ok: true; save: (Omit<Transaction, 'id'> & { id: string })[]; remove: string[] }
  | { ok: false; error: string };

/**
 * The transactions to save and delete for a draft. Editing keeps ids; changing to or from a transfer
 * replaces the old record(s). Fields the form does not show (import ids, split links) are kept from the
 * original transaction. A loan payment records its principal and interest on the loan's leg, and a
 * round-up adds (or updates, or removes) the spare-change pair.
 */
export const planSave = (
  draft: TxDraft,
  ctx: { accounts: Account[]; transactions: Transaction[]; editing?: TxRow; newId: () => string },
): SavePlan => {
  const amount = round2(parseFloat(draft.amount) || 0);
  if (!(amount > 0)) return { ok: false, error: 'Enter an amount' };
  const byId = new Map(ctx.transactions.map(t => [t.id, t]));
  const original = ctx.editing ? ctx.editing.txIds.map(id => byId.get(id)).filter((t): t is Transaction => !!t) : [];
  const keep = (t?: Transaction): Partial<Transaction> => {
    if (!t) return {};
    const { id: _id, accountId: _a, date: _d, description: _de, merchant: _m, amount: _am, category: _c, type: _t, currency: _cu, transferId: _x, tagIds: _tg, notes: _n, ...rest } = t;
    return rest;
  };
  const shared = { date: draft.date, tagIds: draft.tagIds, notes: draft.notes.trim() || undefined, ...locationFields(draft.location) };

  const loan = loanOf(draft, ctx.accounts);
  let loanFields: Partial<Transaction> = {};
  if (loan) {
    const principal = round2(parseFloat(draft.principal) || 0);
    const interest = round2(parseFloat(draft.interest) || 0);
    if (draft.principal !== '' || draft.interest !== '') {
      if (Math.abs(principal + interest - amount) > 0.01) return { ok: false, error: 'Principal and interest must add up to the amount' };
      loanFields = { principalAmount: principal, interestAmount: interest };
    }
  }

  let save: (Omit<Transaction, 'id'> & { id: string })[];
  let remove: string[] = [];

  if (draft.kind === 'transfer') {
    const from = ctx.accounts.find(a => a.id === draft.accountId);
    const to = ctx.accounts.find(a => a.id === draft.toAccountId);
    if (!from || !to) return { ok: false, error: 'Choose both accounts' };
    if (from.id === to.id) return { ok: false, error: 'Choose two different accounts' };
    const wasTransfer = ctx.editing?.kind === 'transfer';
    const outOld = wasTransfer ? original.find(t => t.amount < 0 || t.type === 'expense') : undefined;
    const inOld = wasTransfer ? original.find(t => t !== outOld) : undefined;
    const transferId = (wasTransfer && original[0]?.transferId) || `xfer-${ctx.newId()}`;
    const category = draft.category.trim() || 'Transfer';
    const merchant = draft.merchant.trim() || 'Internal Transfer';
    if (ctx.editing && !wasTransfer) remove = [...ctx.editing.txIds];
    save = [
      { ...keep(outOld), ...shared, id: outOld?.id ?? ctx.newId(), accountId: from.id, description: draft.description.trim() || `Transfer to ${to.name}`, merchant, amount: -amount, category, type: 'expense', currency: from.currency, transferId },
      { ...keep(inOld), ...shared, ...(loan?.id === to.id ? loanFields : {}), id: inOld?.id ?? ctx.newId(), accountId: to.id, description: draft.description.trim() || `Transfer from ${from.name}`, merchant, amount, category, type: 'income', currency: to.currency, transferId },
    ];
  } else {
    const account = ctx.accounts.find(a => a.id === draft.accountId);
    if (!account) return { ok: false, error: 'Choose an account' };
    if (!draft.category.trim()) return { ok: false, error: 'Choose a category' };
    const wasSingle = ctx.editing && ctx.editing.kind !== 'transfer';
    const old = wasSingle ? original[0] : undefined;
    if (ctx.editing && !wasSingle) remove = [...ctx.editing.txIds];
    save = [{
      ...keep(old),
      ...shared,
      ...loanFields,
      id: old?.id ?? ctx.newId(),
      accountId: account.id,
      description: draft.description.trim(),
      merchant: draft.merchant.trim() || undefined,
      amount: draft.kind === 'expense' ? -amount : amount,
      category: draft.category.trim(),
      type: draft.kind,
      currency: account.currency,
    }];
  }

  // Round-up (expense and transfer out of an account that feeds a spare-change account).
  const mainId = save[0].id;
  const spare = draft.kind === 'income' ? undefined : spareAccountFor(ctx.accounts, draft.accountId);
  const existing = roundUpPairOf(mainId, ctx.transactions);
  const setAside = spare && draft.roundUp ? roundUpAmount(amount, draft.roundUpBehavior, parseFloat(draft.roundUpMultiplier) || 1) : 0;
  if (existing && !(spare && setAside > 0)) {
    remove.push(...existing.ids);
  } else if (spare && setAside > 0) {
    const source = ctx.accounts.find(a => a.id === draft.accountId)!;
    const transferId = `spare-${mainId}`;
    const what = draft.description.trim() || 'Transaction';
    save.push(
      { ...keep(existing?.out), date: draft.date, id: existing?.out.id ?? ctx.newId(), accountId: source.id, description: `Spare change for ${what}`, merchant: 'Round Up', amount: -setAside, category: 'Transfer', type: 'expense', currency: source.currency, transferId },
      { ...keep(existing?.into), date: draft.date, id: existing?.into?.id ?? ctx.newId(), accountId: spare.id, description: `Spare change from ${what}`, merchant: 'Round Up', amount: setAside, category: 'Transfer', type: 'income', currency: spare.currency, transferId },
    );
  }
  return { ok: true, save, remove };
};

/** Colours for tags created from the transaction sheet; the next one not yet used by an existing tag. */
export const TAG_COLORS = ['#7c4dff', '#22c55e', '#f59e0b', '#38bdf8', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6'];
export const nextTagColor = (existing: { color: string }[]) => TAG_COLORS.find(c => !existing.some(t => t.color.toLowerCase() === c)) ?? TAG_COLORS[existing.length % TAG_COLORS.length];

/** Categories used most for a kind, most used first, for the quick-pick grid. */
export const topCategories = (transactions: Transaction[], kind: 'expense' | 'income', limit: number): string[] => {
  const counts = new Map<string, number>();
  for (const t of transactions) {
    if (t.transferId || t.type !== kind || isUncategorized(t.category)) continue;
    counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([c]) => c);
};

/* -------------------------------------------------------- split and combine */

export interface SplitPart { amount: string; category: string; description: string }
export type Plan = { ok: true; save: Transaction[]; remove: string[] } | { ok: false; error: string };

/** Two equal parts to start from. */
export const defaultSplitParts = (tx: Transaction): SplitPart[] => {
  const half = round2(Math.abs(tx.amount) / 2);
  const rest = round2(Math.abs(tx.amount) - half);
  return [
    { amount: half.toFixed(2), category: tx.category, description: `${tx.description || tx.merchant || 'Transaction'} (part 1)` },
    { amount: rest.toFixed(2), category: tx.category, description: `${tx.description || tx.merchant || 'Transaction'} (part 2)` },
  ];
};

/** What is left of a transaction after its parts. Zero means fully allocated. */
export const splitRemaining = (tx: Transaction, parts: SplitPart[]) =>
  round2(Math.abs(tx.amount) - parts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0));

/** Marks `tx` as a split parent and creates its parts. Re-splitting replaces the existing parts. */
export const planSplit = (tx: Transaction, parts: SplitPart[], existingParts: Transaction[], newId: () => string): Plan => {
  if (parts.length < 2) return { ok: false, error: 'A split needs at least two parts' };
  if (parts.some(p => !(parseFloat(p.amount) > 0))) return { ok: false, error: 'Every part needs an amount' };
  if (Math.abs(splitRemaining(tx, parts)) > 0.01) return { ok: false, error: 'The parts must add up to the original amount' };
  const sign = tx.amount >= 0 ? 1 : -1;
  const children: Transaction[] = parts.map((p, i) => ({
    ...tx,
    id: `split-${tx.id}-${i}-${newId()}`,
    parentTransactionId: tx.id,
    isSplitParent: false,
    isCombinedParent: false,
    amount: sign * round2(parseFloat(p.amount) || 0),
    category: p.category || tx.category,
    description: p.description.trim() || `${tx.description} (part ${i + 1})`,
  }));
  return { ok: true, save: [{ ...tx, isSplitParent: true }, ...children], remove: existingParts.map(t => t.id) };
};

export const planUnsplit = (parent: Transaction, parts: Transaction[]): Plan =>
  parent.isSplitParent ? { ok: true, save: [{ ...parent, isSplitParent: false }], remove: parts.map(t => t.id) } : { ok: false, error: 'This transaction is not split' };

/** Rows that can be combined: two or more ordinary transactions, none a transfer, part of another group or a parent. */
export const canCombineRows = (rows: TxRow[]) => rows.length >= 2 && rows.every(r => r.kind !== 'transfer' && !r.split && !r.combined);

export interface CombineFields { description: string; category: string; date: string; accountId: string }

export const combineDefaults = (txs: Transaction[]): CombineFields => {
  const dates = txs.map(t => t.date.slice(0, 10)).sort();
  return {
    description: txs.length > 1 ? `Combined: ${txs[0].description || txs[0].merchant || 'Transaction'} & others` : txs[0]?.description ?? '',
    category: txs[0]?.category ?? '',
    date: dates[dates.length - 1] ?? '',
    accountId: txs[0]?.accountId ?? '',
  };
};

export const planCombine = (txs: Transaction[], fields: CombineFields, accounts: Account[], newId: () => string): Plan => {
  if (txs.length < 2) return { ok: false, error: 'Choose at least two transactions' };
  if (!fields.description.trim()) return { ok: false, error: 'Enter a description' };
  const account = accounts.find(a => a.id === fields.accountId);
  if (!account) return { ok: false, error: 'Choose an account' };
  const total = round2(txs.reduce((sum, t) => sum + (t.amount || 0), 0));
  const parentId = `combined-parent-${newId()}`;
  const parent: Transaction = {
    id: parentId, accountId: account.id, date: fields.date, description: fields.description.trim(), amount: total,
    category: fields.category || txs[0].category || 'General', type: total >= 0 ? 'income' : 'expense', currency: txs[0].currency,
    isCombinedParent: true, isSplitParent: false,
  };
  return { ok: true, save: [parent, ...txs.map(t => ({ ...t, parentTransactionId: parentId, isCombinedParent: false }))], remove: [] };
};

export const planUncombine = (parent: Transaction, parts: Transaction[]): Plan =>
  parent.isCombinedParent
    ? { ok: true, save: parts.map(t => ({ ...t, parentTransactionId: undefined })), remove: [parent.id] }
    : { ok: false, error: 'This transaction is not combined' };

/* --------------------------------------------------------------- bulk edit */

export interface BulkFields {
  date?: string;
  accountId?: string;
  description?: string;
  merchant?: string;
  /** A category and the kind it belongs to; changes the type (and sign), and turns a transfer into an ordinary transaction. */
  category?: { name: string; classification: 'income' | 'expense' };
  tagIds?: string[];
  tagMode?: 'replace' | 'add';
  /** `null` clears the location. */
  location?: LocationDraft | null;
}

/** Applies fields to the transactions behind `rows`. Transfers keep their accounts; split and combined parents are edited as one. */
export const planBulkEdit = (rows: TxRow[], transactions: Transaction[], f: BulkFields): Plan => {
  if (Object.values(f).every(v => v === undefined)) return { ok: false, error: 'Nothing to change' };
  const byId = new Map(transactions.map(t => [t.id, t]));
  const changed = new Map<string, Transaction>();
  const remove = new Set<string>();
  const apply = (t: Transaction, transfer: boolean): Transaction => {
    const u: Transaction = { ...t };
    if (f.date) u.date = f.date;
    if (f.description !== undefined) u.description = f.description;
    if (f.merchant !== undefined) u.merchant = f.merchant || undefined;
    if (f.tagIds) u.tagIds = f.tagMode === 'add' ? [...new Set([...(t.tagIds ?? []), ...f.tagIds])] : f.tagIds;
    if (f.location !== undefined) Object.assign(u, f.location === null ? locationFields(emptyLocation()) : locationFields(f.location));
    if (f.accountId && !transfer) u.accountId = f.accountId;
    return u;
  };
  for (const row of rows) {
    const legs = row.txIds.map(id => byId.get(id)).filter((t): t is Transaction => !!t);
    if (row.kind === 'transfer') {
      if (f.category) {
        const keepLeg = legs.find(t => (t.amount >= 0) === (f.category!.classification === 'income')) ?? legs[0];
        if (!keepLeg) continue;
        const u = apply(keepLeg, false);
        u.transferId = undefined;
        u.category = f.category.name;
        u.type = f.category.classification;
        u.amount = f.category.classification === 'income' ? round2(Math.abs(keepLeg.amount)) : -round2(Math.abs(keepLeg.amount));
        changed.set(u.id, u);
        legs.filter(t => t.id !== keepLeg.id).forEach(t => remove.add(t.id));
      } else {
        legs.forEach(t => changed.set(t.id, apply(t, true)));
      }
      continue;
    }
    const t = legs[0];
    if (!t) continue;
    const u = apply(t, false);
    if (f.category) {
      u.category = f.category.name;
      u.type = f.category.classification;
      u.amount = f.category.classification === 'income' ? round2(Math.abs(t.amount)) : -round2(Math.abs(t.amount));
    }
    changed.set(u.id, u);
  }
  if (!changed.size && !remove.size) return { ok: false, error: 'Nothing to change' };
  return { ok: true, save: [...changed.values()], remove: [...remove] };
};

/* --------------------------------------------------------------- recurring */

export interface RecurringDraft {
  kind: TxKind;
  accountId: string;
  toAccountId: string;
  amount: string;
  description: string;
  merchant: string;
  category: string;
  frequency: RecurrenceFrequency;
  interval: string;
  startDate: string;
  endDate: string;
  /** Day of the month for monthly and yearly repeats; blank follows the start date. */
  dueDay: string;
  weekend: WeekendAdjustment;
}

export const FREQUENCIES: { value: RecurrenceFrequency; label: string; unit: string }[] = [
  { value: 'daily', label: 'Daily', unit: 'day' },
  { value: 'weekly', label: 'Weekly', unit: 'week' },
  { value: 'biweekly', label: 'Every two weeks', unit: 'fortnight' },
  { value: 'monthly', label: 'Monthly', unit: 'month' },
  { value: 'yearly', label: 'Yearly', unit: 'year' },
];

/** A recurring draft from a stored transaction, starting today and repeating monthly. */
export const recurringDraftFromRow = (row: TxRow, today: Date): RecurringDraft => ({
  kind: row.kind, accountId: row.accountId, toAccountId: row.toAccountId ?? '', amount: String(Math.abs(row.amount)),
  description: row.detail ?? row.description ?? '', merchant: row.merchant ?? '', category: row.kind === 'transfer' ? 'Transfer' : row.category,
  frequency: 'monthly', interval: '1', startDate: iso(today), endDate: '', dueDay: '', weekend: 'on',
});

const parseIso = (v: string) => { const [y, m, d] = v.slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };

/** The first due date: the start date, moved to the chosen day of the month (next month if that day has passed). */
export const firstDueDate = (startDate: string, frequency: RecurrenceFrequency, dueDay: string): string => {
  const start = parseIso(startDate);
  const day = parseInt(dueDay, 10);
  if ((frequency === 'monthly' || frequency === 'yearly') && day >= 1 && day <= 31) {
    const next = new Date(start);
    next.setDate(day);
    if (next < start) next.setMonth(next.getMonth() + 1);
    return iso(next);
  }
  return iso(start);
};

export type RecurringPlan = { ok: true; data: Omit<RecurringTransaction, 'id'> & { id?: string } } | { ok: false; error: string };

export const planRecurring = (d: RecurringDraft, accounts: Account[]): RecurringPlan => {
  const amount = round2(parseFloat(d.amount) || 0);
  const interval = parseInt(d.interval, 10);
  if (!(amount > 0)) return { ok: false, error: 'Enter an amount' };
  if (!(interval >= 1)) return { ok: false, error: 'Repeat every 1 or more' };
  if (!d.startDate) return { ok: false, error: 'Choose a start date' };
  if (d.endDate && d.endDate < d.startDate) return { ok: false, error: 'The end date is before the start date' };
  const from = accounts.find(a => a.id === d.accountId);
  if (!from) return { ok: false, error: 'Choose an account' };
  if (d.kind === 'transfer' && !accounts.some(a => a.id === d.toAccountId && a.id !== d.accountId)) return { ok: false, error: 'Choose two different accounts' };
  if (d.kind !== 'transfer' && !d.category.trim()) return { ok: false, error: 'Choose a category' };
  const monthly = d.frequency === 'monthly' || d.frequency === 'yearly';
  const day = parseInt(d.dueDay, 10);
  return {
    ok: true,
    data: {
      accountId: from.id,
      toAccountId: d.kind === 'transfer' ? d.toAccountId : undefined,
      description: d.description.trim() || d.merchant.trim() || 'Recurring transaction',
      merchant: d.merchant.trim() || undefined,
      amount,
      category: d.kind === 'transfer' ? 'Transfer' : d.category.trim(),
      type: d.kind,
      currency: from.currency,
      frequency: d.frequency,
      frequencyInterval: d.frequency === 'daily' ? 1 : interval,
      startDate: d.startDate,
      endDate: d.endDate || undefined,
      nextDueDate: firstDueDate(d.startDate, d.frequency, d.dueDay),
      dueDateOfMonth: monthly && day >= 1 && day <= 31 ? day : undefined,
      weekendAdjustment: d.weekend,
    },
  };
};

/* --------------------------------------------------------------- overview */

type Convert = (amount: number, currency: Currency) => number;

const countsAsSpend = (r: TxRow) => r.kind === 'expense' && !r.adjustment;
const countsAsIncome = (r: TxRow) => r.kind === 'income' && !r.adjustment;

/** What was spent on each day of the week (Monday first), with how many transactions. Transfers and adjustments are not spending. */
export const spendByWeekday = (rows: TxRow[], convert: Convert): { total: number; count: number }[] => {
  const days = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const r of rows) {
    if (!countsAsSpend(r)) continue;
    const d = days[weekdayOf(r.date)];
    d.total += -convert(r.amount, r.currency);
    d.count += 1;
  }
  return days.map(d => ({ total: round2(d.total), count: d.count }));
};

/** A "nice" chart maximum at or above `value`: 1, 2, 2.5, 5 or 10 times a power of ten. */
export const niceMax = (value: number): number => {
  if (!(value > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
};

export interface PlaceCluster { key: string; label: string; lat: number; lng: number; count: number; spent: number }

/** Transactions with coordinates, grouped by place (the average position of the group). */
export const placeClusters = (rows: TxRow[], convert: Convert): PlaceCluster[] => {
  const map = new Map<string, { label: string; lat: number; lng: number; n: number; count: number; spent: number }>();
  for (const r of rows) {
    if (r.lat === undefined || r.lng === undefined || !r.placeKey) continue;
    const g = map.get(r.placeKey) ?? { label: r.city || `Near ${r.lat.toFixed(2)}, ${r.lng.toFixed(2)}`, lat: 0, lng: 0, n: 0, count: 0, spent: 0 };
    g.lat += r.lat; g.lng += r.lng; g.n += 1; g.count += 1;
    if (countsAsSpend(r)) g.spent += -convert(r.amount, r.currency);
    map.set(r.placeKey, g);
  }
  return [...map.entries()].map(([key, g]) => ({ key, label: g.label, lat: g.lat / g.n, lng: g.lng / g.n, count: g.count, spent: round2(g.spent) })).sort((a, b) => b.count - a.count);
};

/** Every merchant on a set of rows with how many transactions, most used first (for the Merchant filter). */
export const merchantOptions = (rows: TxRow[]): { name: string; count: number }[] => {
  const map = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    if (!r.merchant || r.kind === 'transfer') continue;
    const key = r.merchant.toLowerCase();
    const g = map.get(key) ?? { name: r.merchant, count: 0 };
    g.count += 1;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** Every place used by a set of rows, with how many transactions, most used first (for the Locations filter). */
export const placeOptions = (rows: TxRow[]): { key: string; label: string; count: number }[] => {
  const map = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    if (!r.placeKey) continue;
    const g = map.get(r.placeKey) ?? { label: r.city || `Near ${(r.lat ?? 0).toFixed(2)}, ${(r.lng ?? 0).toFixed(2)}`, count: 0 };
    g.count += 1;
    map.set(r.placeKey, g);
  }
  return [...map.entries()].map(([key, g]) => ({ key, ...g })).sort((a, b) => b.count - a.count);
};

const DAY = 86_400_000;
const utcDay = (v: string) => { const [y, m, d] = v.slice(0, 10).split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1); };
const isoFromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The range of the same length that ends the day before `range` starts. `undefined` for an open range. */
export const previousRange = (range: { from?: string; to?: string }): { from: string; to: string } | undefined => {
  if (!range.from || !range.to) return undefined;
  const days = Math.round((utcDay(range.to) - utcDay(range.from)) / DAY) + 1;
  const prevTo = utcDay(range.from) - DAY;
  return { from: isoFromUtc(prevTo - (days - 1) * DAY), to: isoFromUtc(prevTo) };
};

/** Percentage change from `prev` to `cur`, one decimal; `null` when there is nothing to compare with. */
export const pctChange = (cur: number, prev: number): number | null =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

/** Spending or income in `buckets` equal slices of a period, for a sparkline. */
export const bucketSeries = (rows: TxRow[], kind: 'spent' | 'income', range: { from?: string; to?: string }, convert: Convert, buckets = 16): number[] => {
  const dates = rows.map(r => r.date).sort();
  const from = range.from ?? dates[0];
  const to = range.to ?? dates[dates.length - 1];
  const out = Array.from({ length: buckets }, () => 0);
  if (!from || !to) return out;
  const start = utcDay(from);
  const span = Math.max(1, Math.round((utcDay(to) - start) / DAY) + 1);
  for (const r of rows) {
    if (kind === 'spent' ? !countsAsSpend(r) : !countsAsIncome(r)) continue;
    const offset = Math.round((utcDay(r.date) - start) / DAY);
    if (offset < 0 || offset >= span) continue;
    out[Math.min(buckets - 1, Math.floor((offset / span) * buckets))] += Math.abs(convert(r.amount, r.currency));
  }
  return out.map(round2);
};

/** A smooth SVG path through the values, scaled into `width` × `height` with `pad` around it. */
export const sparkPath = (values: number[], width: number, height: number, pad = 2): string => {
  if (values.length < 2) return '';
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), height - pad - ((v - min) / range) * (height - pad * 2)] as const);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
};

/** The category with the most spending, and its share of all spending. */
export const topCategory = (rows: TxRow[], convert: Convert): { name: string; total: number; share: number } | null => {
  const totals = new Map<string, number>();
  let all = 0;
  for (const r of rows) {
    if (!countsAsSpend(r) || r.uncategorized) continue;
    const v = -convert(r.amount, r.currency);
    totals.set(r.category, (totals.get(r.category) ?? 0) + v);
    all += v;
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && all > 0 ? { name: top[0], total: round2(top[1]), share: Math.round((top[1] / all) * 100) } : null;
};

/** Account types that make up the "total balance" on the Transactions page: cash and what is owed on cards. */
export const BALANCE_TYPES = ['Checking', 'Savings', 'Credit Card'] as const;

export const balanceAccounts = (accounts: Account[]) => accounts.filter(a => a.status !== 'closed' && (BALANCE_TYPES as readonly string[]).includes(a.type));

/** The total of `accounts` (all of them, or just `selectedIds`) in the display currency. */
export const totalBalance = (accounts: Account[], selectedIds: string[], convert: Convert): { total: number; count: number } => {
  const used = selectedIds.length ? accounts.filter(a => selectedIds.includes(a.id)) : accounts;
  return { total: round2(used.reduce((sum, a) => sum + convert(a.balance, a.currency), 0)), count: used.length };
};

/* ------------------------------------------------------------ the four KPIs (classic parity) */

export type MetricId = 'count' | 'income' | 'expense' | 'net';

/** Total transactions, income, expenses (transfers and adjustments are neither) and net cash flow of the rows. */
export const kpiTotals = (rows: TxRow[], convert: Convert) => {
  const { spent, income } = periodTotals(rows, convert);
  return { count: rows.length, income, expense: spent, net: round2(income - spent) };
};

/**
 * Daily values for the metric chart: `days` days ending on `end`, with the same number of days before them to compare with.
 * Each day has one value per segment: counts by kind, the three biggest categories and the rest, or the net.
 */
export const metricSeries = (rows: TxRow[], metric: MetricId, end: string, days: number, convert: Convert): { segments: string[]; points: { date: string; parts: number[] }[] } => {
  const endDay = utcDay(end);
  const first = endDay - (days * 2 - 1) * DAY;
  const dates = Array.from({ length: days * 2 }, (_, i) => isoFromUtc(first + i * DAY));
  const index = new Map(dates.map((d, i) => [d, i]));
  const inWindow = rows.filter(r => index.has(r.date));

  let segments: string[];
  let pick: (r: TxRow) => [number, number] | null; // [segment, value]
  if (metric === 'count') {
    segments = ['Expenses', 'Income', 'Transfers'];
    pick = r => [r.kind === 'transfer' ? 2 : r.kind === 'income' ? 1 : 0, 1];
  } else if (metric === 'net') {
    segments = ['Net cash flow'];
    pick = r => (countsAsIncome(r) || countsAsSpend(r) ? [0, convert(r.amount, r.currency)] : null);
  } else {
    const wanted = metric === 'income' ? countsAsIncome : countsAsSpend;
    // As in the totals: a refund (a positive expense) takes away from spending, so values keep their sign.
    const sign = metric === 'income' ? 1 : -1;
    const byCategory = new Map<string, number>();
    for (const r of inWindow) if (wanted(r)) byCategory.set(r.category || 'Uncategorized', (byCategory.get(r.category || 'Uncategorized') ?? 0) + sign * convert(r.amount, r.currency));
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
    segments = byCategory.size > 3 ? [...top, 'Other'] : top.length ? top : [metric === 'income' ? 'Income' : 'Expenses'];
    pick = r => {
      if (!wanted(r)) return null;
      const at = top.indexOf(r.category || 'Uncategorized');
      return [at === -1 ? (byCategory.size > 3 ? top.length : 0) : at, sign * convert(r.amount, r.currency)];
    };
  }

  const points = dates.map(date => ({ date, parts: segments.map(() => 0) }));
  for (const r of inWindow) {
    const hit = pick(r);
    if (hit) points[index.get(r.date)!].parts[hit[0]] += hit[1];
  }
  for (const p of points) p.parts = p.parts.map(round2);
  return { segments, points };
};

export interface SparkPoint {
  day: string;
  date: string;
  value: number;
}

/**
 * Cumulative daily series for the overview sparklines: income, expense, and net over the period.
 */
export const kpiSparkSeries = (
  rows: TxRow[],
  from: string | undefined,
  to: string | undefined,
  convert: Convert
): { income: SparkPoint[]; expense: SparkPoint[]; net: SparkPoint[] } => {
  let startDate: string;
  let endDate: string;

  if (from && to) {
    startDate = from;
    endDate = to;
  } else if (rows.length > 0) {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    startDate = sorted[0].date;
    endDate = sorted[sorted.length - 1].date;
  } else {
    const today = iso(new Date());
    startDate = today;
    endDate = today;
  }

  const start = utcDay(startDate);
  const end = Math.max(start, utcDay(endDate));
  const totalDays = Math.max(1, Math.round((end - start) / DAY) + 1);

  const byDate = new Map<string, { income: number; expense: number; net: number }>();
  for (const r of rows) {
    let b = byDate.get(r.date);
    if (!b) {
      b = { income: 0, expense: 0, net: 0 };
      byDate.set(r.date, b);
    }
    if (countsAsSpend(r)) {
      const amt = -convert(r.amount, r.currency);
      b.expense += amt;
      b.net -= amt;
    } else if (countsAsIncome(r)) {
      const amt = convert(r.amount, r.currency);
      b.income += amt;
      b.net += amt;
    }
  }

  const step = totalDays > 60 ? Math.ceil(totalDays / 45) : 1;

  let cumIncome = 0;
  let cumExpense = 0;
  let cumNet = 0;

  const income: SparkPoint[] = [];
  const expense: SparkPoint[] = [];
  const net: SparkPoint[] = [];

  for (let i = 0; i < totalDays; i++) {
    const curUtc = start + i * DAY;
    const curIso = isoFromUtc(curUtc);
    const b = byDate.get(curIso);
    if (b) {
      cumIncome += b.income;
      cumExpense += b.expense;
      cumNet += b.net;
    }

    if (i % step === 0 || i === totalDays - 1) {
      const dt = new Date(`${curIso}T12:00:00Z`);
      const dayLabel = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const incVal = round2(cumIncome);
      const expVal = round2(cumExpense);
      const netVal = round2(cumNet);

      income.push({ day: dayLabel, date: curIso, value: incVal });
      expense.push({ day: dayLabel, date: curIso, value: expVal });
      net.push({ day: dayLabel, date: curIso, value: netVal });
    }
  }

  if (income.length === 1) {
    income.unshift({ ...income[0] });
    expense.unshift({ ...expense[0] });
    net.unshift({ ...net[0] });
  }

  return { income, expense, net };
};
