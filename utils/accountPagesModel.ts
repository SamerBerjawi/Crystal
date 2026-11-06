import type { Account, RecurrenceFrequency, ScheduledPayment, Transaction } from '../types';
import { safeAdd, safeRound } from '../utils';

/**
 * Pure figures for the per-type account pages (docs/redesign/12-account-pages.md). Amounts arrive already in the
 * account's currency (callers convert), so every function here is plain arithmetic on dates and numbers.
 */

export interface DatedAmount {
  date: string; // YYYY-MM-DD
  amount: number; // in the account's currency, signed as it moves the balance
}

const pad = (value: number) => String(value).padStart(2, '0');
export const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const isoMonth = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const parseDay = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
};

/** The last `count` months, oldest first, as YYYY-MM, ending with the month of `today`. */
export function lastMonths(count: number, today = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => isoMonth(new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1)));
}

/** A recurring amount as a monthly figure. */
export function monthlyEquivalent(amount: number | undefined, frequency: RecurrenceFrequency | undefined = 'monthly'): number {
  if (!amount) return 0;
  const perYear: Record<RecurrenceFrequency, number> = { daily: 365, weekly: 52, biweekly: 26, monthly: 12, yearly: 1 };
  return safeRound((amount * (perYear[frequency] ?? 12)) / 12, 2);
}

/**
 * The balance at the end of each day from `days - 1` days ago to today, walked back from today's balance.
 * Future-dated amounts are ignored.
 */
export function dailyBalanceHistory(todayBalance: number, amounts: DatedAmount[], days: number, today = new Date()): { date: Date; value: number }[] {
  const end = startOfDay(today);
  const todayIso = isoDay(end);
  const byDay = new Map<string, number>();
  amounts.forEach(item => {
    if (item.date > todayIso) return;
    byDay.set(item.date, safeAdd(byDay.get(item.date) || 0, item.amount));
  });
  const points: { date: Date; value: number }[] = [];
  let running = todayBalance;
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - offset);
    points.push({ date: day, value: safeRound(running, 2) });
    running = safeRound(running - (byDay.get(isoDay(day)) || 0), 2);
  }
  return points.reverse();
}

/** Balance at the end of each of the last `months` months (the current month ends today). */
export function monthlyBalanceHistory(todayBalance: number, amounts: DatedAmount[], months: number, today = new Date()): { month: string; date: Date; value: number }[] {
  const todayIso = isoDay(today);
  const keys = lastMonths(months, today);
  const sorted = amounts.filter(item => item.date <= todayIso);
  return keys.map((month, index) => {
    const [y, m] = month.split('-').map(Number);
    const isLast = index === keys.length - 1;
    const endDay = isLast ? todayIso : isoDay(new Date(y, m, 0));
    const moved = sorted.reduce((sum, item) => (item.date > endDay ? safeAdd(sum, item.amount) : sum), 0);
    return { month, date: isLast ? startOfDay(today) : new Date(y, m, 0), value: safeRound(todayBalance - moved, 2) };
  });
}

export interface MonthFlow {
  month: string;
  name: string;
  in: number;
  out: number;
  net: number;
}

/** Money in and out per month for the last `months` months. `out` is positive. */
export function monthlyFlows(amounts: DatedAmount[], months: number, today = new Date()): MonthFlow[] {
  const keys = lastMonths(months, today);
  const rows = new Map(keys.map(month => [month, { in: 0, out: 0 }]));
  amounts.forEach(item => {
    const row = rows.get(item.date.slice(0, 7));
    if (!row) return;
    if (item.amount >= 0) row.in = safeAdd(row.in, item.amount);
    else row.out = safeAdd(row.out, -item.amount);
  });
  return keys.map(month => {
    const row = rows.get(month)!;
    return { month, name: monthLabel(month), in: safeRound(row.in, 2), out: safeRound(row.out, 2), net: safeRound(row.in - row.out, 2) };
  });
}

/** Totals by label, largest first, with the rest folded into "Other" after `limit`. */
export function splitByLabel(items: { label: string; amount: number }[], limit = 6): { label: string; value: number }[] {
  const sums = new Map<string, number>();
  items.forEach(item => sums.set(item.label, safeAdd(sums.get(item.label) || 0, Math.abs(item.amount))));
  const sorted = Array.from(sums.entries()).map(([label, value]) => ({ label, value: safeRound(value, 2) })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit - 1).reduce((sum, item) => safeAdd(sum, item.value), 0);
  return [...sorted.slice(0, limit - 1), { label: 'Other', value: safeRound(rest, 2) }];
}

// --- Credit cards ---

export interface StatementPeriod {
  start: Date;
  end: Date;
  due: Date;
}

/** The statement period that contains `day`, for a card whose statement opens on `startDay` and is due on `dueDay`. */
export function statementPeriodFor(day: Date, startDay: number, dueDay: number): StatementPeriod {
  const d = startOfDay(day);
  const opensThisMonth = new Date(d.getFullYear(), d.getMonth(), Math.min(startDay, daysIn(d.getFullYear(), d.getMonth())));
  const start = d >= opensThisMonth ? opensThisMonth : new Date(d.getFullYear(), d.getMonth() - 1, Math.min(startDay, daysIn(d.getFullYear(), d.getMonth() - 1)));
  const nextOpen = new Date(start.getFullYear(), start.getMonth() + 1, Math.min(startDay, daysIn(start.getFullYear(), start.getMonth() + 1)));
  const end = new Date(nextOpen.getFullYear(), nextOpen.getMonth(), nextOpen.getDate() - 1);
  let due = new Date(end.getFullYear(), end.getMonth(), Math.min(dueDay, daysIn(end.getFullYear(), end.getMonth())));
  if (due <= end) due = new Date(end.getFullYear(), end.getMonth() + 1, Math.min(dueDay, daysIn(end.getFullYear(), end.getMonth() + 1)));
  return { start, end, due };
}

const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** The current period and the `count - 1` before it, newest first. */
export function recentStatementPeriods(startDay: number, dueDay: number, count: number, today = new Date()): StatementPeriod[] {
  const periods: StatementPeriod[] = [];
  let cursor = startOfDay(today);
  for (let index = 0; index < count; index++) {
    const period = statementPeriodFor(cursor, startDay, dueDay);
    periods.push(period);
    cursor = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() - 1);
  }
  return periods;
}

/** Spending (positive) accumulated by day of a period, for pace lines. Index 0 is the first day. */
export function cumulativeSpend(spend: DatedAmount[], period: Pick<StatementPeriod, 'start' | 'end'>, upTo?: Date): number[] {
  const length = Math.round((startOfDay(period.end).getTime() - startOfDay(period.start).getTime()) / 86_400_000) + 1;
  const limit = upTo ? Math.min(length, Math.round((startOfDay(upTo).getTime() - startOfDay(period.start).getTime()) / 86_400_000) + 1) : length;
  const perDay = new Array(length).fill(0);
  spend.forEach(item => {
    const index = Math.round((parseDay(item.date).getTime() - startOfDay(period.start).getTime()) / 86_400_000);
    if (index >= 0 && index < length && item.amount < 0) perDay[index] = safeAdd(perDay[index], -item.amount);
  });
  const out: number[] = [];
  let running = 0;
  for (let index = 0; index < Math.max(0, limit); index++) {
    running = safeAdd(running, perDay[index]);
    out.push(safeRound(running, 2));
  }
  return out;
}

// --- Loans ---

/** Principal and interest per calendar year of a schedule, and the balance left at each year's end. */
export function amortizationByYear(schedule: ScheduledPayment[]): { year: string; principal: number; interest: number; balance: number }[] {
  const years = new Map<string, { principal: number; interest: number; balance: number }>();
  schedule.forEach(payment => {
    const year = payment.date.slice(0, 4);
    const row = years.get(year) ?? { principal: 0, interest: 0, balance: 0 };
    row.principal = safeAdd(row.principal, payment.principal);
    row.interest = safeAdd(row.interest, payment.interest);
    row.balance = payment.outstandingBalance;
    years.set(year, row);
  });
  return Array.from(years.entries()).map(([year, row]) => ({ year, principal: safeRound(row.principal, 2), interest: safeRound(row.interest, 2), balance: safeRound(row.balance, 2) }));
}

/**
 * The remaining balance month by month if `extra` is added to every payment and `lumpSum` is paid today.
 * Stops when the balance reaches zero or after 600 months.
 */
export function payoffPath(balance: number, annualRatePercent: number, monthlyPayment: number, extra = 0, lumpSum = 0): number[] {
  const rate = annualRatePercent / 100 / 12;
  let left = Math.max(0, balance - lumpSum);
  const path = [safeRound(left, 2)];
  const pay = monthlyPayment + extra;
  if (pay <= 0) return path;
  for (let month = 0; month < 600 && left > 0.005; month++) {
    const interest = left * rate;
    if (pay <= interest) break; // never pays off
    left = Math.max(0, left + interest - pay);
    path.push(safeRound(left, 2));
  }
  return path;
}

/** Total interest along a payoff path. */
export function interestAlong(balance: number, annualRatePercent: number, monthlyPayment: number, extra = 0, lumpSum = 0): number {
  const rate = annualRatePercent / 100 / 12;
  let left = Math.max(0, balance - lumpSum);
  let total = 0;
  const pay = monthlyPayment + extra;
  for (let month = 0; month < 600 && left > 0.005 && pay > left * rate; month++) {
    const interest = left * rate;
    total += interest;
    left = Math.max(0, left + interest - pay);
  }
  return safeRound(total, 2);
}

// --- Property ---

export interface RentMonth {
  month: string;
  name: string;
  expected: number;
  received: number;
  vacant: boolean;
}

export interface RentRoll {
  months: RentMonth[];
  /** Share of the months shown that were let, 0 to 100. Months before the property was bought don't count. */
  occupancy: number;
  received: number;
  expected: number;
  vacantCount: number;
}

/**
 * Rent month by month. Rent received is income marked for this property (`assetId`), in the property's currency.
 * A vacant month expects nothing. Months before the purchase date are left out.
 */
export function rentRoll(account: Pick<Account, 'rentalIncomeAmount' | 'rentalIncomeFrequency' | 'vacantMonths' | 'purchaseDate'>, rentIncome: DatedAmount[], months = 12, today = new Date()): RentRoll {
  const monthly = monthlyEquivalent(account.rentalIncomeAmount, account.rentalIncomeFrequency);
  const vacant = new Set(account.vacantMonths || []);
  const bought = account.purchaseDate ? account.purchaseDate.slice(0, 7) : '';
  const keys = lastMonths(months, today).filter(month => !bought || month >= bought);
  const received = new Map<string, number>();
  rentIncome.forEach(item => {
    if (item.amount > 0) received.set(item.date.slice(0, 7), safeAdd(received.get(item.date.slice(0, 7)) || 0, item.amount));
  });
  const rows = keys.map(month => ({
    month,
    name: monthLabel(month),
    vacant: vacant.has(month),
    expected: vacant.has(month) ? 0 : monthly,
    received: safeRound(received.get(month) || 0, 2),
  }));
  const vacantCount = rows.filter(row => row.vacant).length;
  return {
    months: rows,
    occupancy: rows.length ? safeRound(((rows.length - vacantCount) / rows.length) * 100, 1) : 0,
    received: safeRound(rows.reduce((sum, row) => safeAdd(sum, row.received), 0), 2),
    expected: safeRound(rows.reduce((sum, row) => safeAdd(sum, row.expected), 0), 2),
    vacantCount,
  };
}

/** Marks a month empty, or let again. Keeps the list sorted and free of repeats. */
export function toggleVacantMonth(vacantMonths: string[] | undefined, month: string): string[] {
  const set = new Set(vacantMonths || []);
  if (set.has(month)) set.delete(month);
  else set.add(month);
  return Array.from(set).sort();
}

/** The yearly running costs stored on a property. */
export function yearlyOwnershipCosts(account: Account): { label: string; yearly: number }[] {
  return [
    { label: 'Property tax', yearly: safeRound(account.propertyTaxAmount || 0, 2) },
    { label: 'Insurance', yearly: safeRound(monthlyEquivalent(account.insuranceAmount, account.insuranceFrequency) * 12, 2) },
    { label: 'HOA and service fees', yearly: safeRound(monthlyEquivalent(account.hoaFeeAmount, account.hoaFeeFrequency) * 12, 2) },
  ].filter(item => item.yearly > 0);
}

// --- Valuations ---

/** A straight line through the valuations, as value change per year. Null with fewer than two. */
export function valueTrendPerYear(history: { date: string; price: number }[]): number | null {
  if (history.length < 2) return null;
  const points = history.map(item => ({ x: parseDay(item.date).getTime() / (365.25 * 86_400_000), y: item.price }));
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const varX = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (varX === 0) return null;
  const slope = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / varX;
  return safeRound(slope, 2);
}

/** Months between two days, rounded down. */
export function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0));
}

/** Converts each transaction once, into the account's currency. */
export const toDatedAmounts = (transactions: Transaction[], convert: (tx: Transaction) => number): DatedAmount[] =>
  transactions.map(tx => ({ date: tx.date, amount: convert(tx) }));

// --- All accounts ---

export type HubGroup = 'Cash' | 'Savings' | 'Cards' | 'Investments' | 'Property' | 'Vehicles' | 'Other assets' | 'Loans' | 'Other debts';

export const HUB_GROUPS: { id: HubGroup; tab: 'accounts' | 'cards' | 'loans' | 'assets' | null; liability: boolean }[] = [
  { id: 'Cash', tab: 'accounts', liability: false },
  { id: 'Savings', tab: 'accounts', liability: false },
  { id: 'Cards', tab: 'cards', liability: true },
  { id: 'Investments', tab: null, liability: false },
  { id: 'Property', tab: 'assets', liability: false },
  { id: 'Vehicles', tab: 'assets', liability: false },
  { id: 'Other assets', tab: 'assets', liability: false },
  { id: 'Loans', tab: 'loans', liability: true },
  { id: 'Other debts', tab: 'loans', liability: true },
];

export function hubGroupOf(account: Pick<Account, 'type' | 'otherSubType'>): HubGroup {
  switch (account.type) {
    case 'Checking': return 'Cash';
    case 'Savings': return 'Savings';
    case 'Credit Card': return 'Cards';
    case 'Investment': return 'Investments';
    case 'Property': return 'Property';
    case 'Vehicle': return 'Vehicles';
    case 'Loan': return 'Loans';
    case 'Lending': return 'Other assets';
    case 'Other Liabilities': return 'Other debts';
    default: return account.otherSubType === 'Cash' ? 'Cash' : 'Other assets';
  }
}

/** A valued asset's worth on a day: the last valuation by then, else the price paid once bought, else nothing before it. */
export function valuedAssetAt(account: Pick<Account, 'balance' | 'priceHistory' | 'purchaseDate' | 'purchasePrice'>, isoDate: string): number {
  const known = (account.priceHistory || []).filter(item => item.date <= isoDate).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (known) return known.price;
  if (account.purchaseDate && isoDate < account.purchaseDate) return 0;
  if (account.purchasePrice && (!account.priceHistory || account.priceHistory.length === 0 || account.priceHistory.every(item => item.date > isoDate))) return account.purchasePrice;
  return account.balance;
}

/**
 * Assets, debts and net worth at the end of each of the last `months` months, in one currency. Property and
 * vehicles follow their valuations; everything else walks back from today's balance through its transactions.
 */
export function netWorthHistory(
  items: { account: Account; todayBalance: number; amounts: DatedAmount[] }[],
  months: number,
  toMain: (value: number, account: Account) => number,
  today = new Date(),
): { month: string; date: Date; assets: number; debts: number; net: number }[] {
  const keys = lastMonths(months, today);
  const series = items.map(item => {
    const valued = item.account.type === 'Property' || item.account.type === 'Vehicle';
    if (valued) {
      return keys.map((month, index) => {
        const [y, m] = month.split('-').map(Number);
        const end = index === keys.length - 1 ? isoDay(today) : isoDay(new Date(y, m, 0));
        return index === keys.length - 1 ? item.todayBalance : valuedAssetAt(item.account, end);
      });
    }
    return monthlyBalanceHistory(item.todayBalance, item.amounts, months, today).map(point => point.value);
  });
  return keys.map((month, index) => {
    let assets = 0;
    let debts = 0;
    items.forEach((item, itemIndex) => {
      const value = toMain(series[itemIndex][index] ?? 0, item.account);
      if (value >= 0) assets = safeAdd(assets, value);
      else debts = safeAdd(debts, -value);
    });
    const [y, m] = month.split('-').map(Number);
    return { month, date: index === keys.length - 1 ? startOfDay(today) : new Date(y, m, 0), assets: safeRound(assets, 2), debts: safeRound(debts, 2), net: safeRound(assets - debts, 2) };
  });
}

export interface MoneyMap {
  nodes: { name: string; category: 'source' | 'landing' | 'outcome'; color: string; accountId?: string }[];
  links: { source: number; target: number; value: number }[];
  total: number;
}

/**
 * How money moved between accounts since `since`: income into accounts, net transfers from cash accounts to the
 * rest (cards, loans, savings, investments), and spending out of each. Edges only run income → cash → other →
 * spending, so the graph never loops.
 */
export function moneyMap(accounts: Account[], transactions: Transaction[], since: string, toMain: (tx: Transaction) => number, colorOf: (account: Account) => string): MoneyMap {
  const byId = new Map(accounts.map(account => [account.id, account]));
  const isCash = (account: Account) => account.type === 'Checking' || (account.type === 'Other Assets' && account.otherSubType === 'Cash');
  const income = new Map<string, number>();
  const spend = new Map<string, number>();
  const moves = new Map<string, number>(); // "from|to" → amount, from a cash account to a non-cash one
  const transferPairs = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    if (tx.date < since || tx.isSplitParent || tx.isCombinedParent || tx.isBalanceAdjustment || tx.isMarketAdjustment || !byId.has(tx.accountId)) return;
    if (tx.transferId) {
      const list = transferPairs.get(tx.transferId);
      if (list) list.push(tx);
      else transferPairs.set(tx.transferId, [tx]);
      return;
    }
    const value = toMain(tx);
    if (value > 0) income.set(tx.accountId, safeAdd(income.get(tx.accountId) || 0, value));
    else if (value < 0) spend.set(tx.accountId, safeAdd(spend.get(tx.accountId) || 0, -value));
  });
  transferPairs.forEach(pair => {
    const out = pair.find(tx => tx.amount < 0);
    const into = pair.find(tx => tx.amount > 0);
    if (!out || !into) return;
    const from = byId.get(out.accountId);
    const to = byId.get(into.accountId);
    if (!from || !to || from.id === to.id) return;
    const value = Math.abs(toMain(out));
    if (isCash(from) && !isCash(to)) moves.set(`${from.id}|${to.id}`, safeAdd(moves.get(`${from.id}|${to.id}`) || 0, value));
    else if (!isCash(from) && isCash(to)) moves.set(`${to.id}|${from.id}`, safeAdd(moves.get(`${to.id}|${from.id}`) || 0, -value));
  });

  const nodes: MoneyMap['nodes'] = [];
  const links: MoneyMap['links'] = [];
  const index = new Map<string, number>();
  const node = (key: string, name: string, category: MoneyMap['nodes'][number]['category'], color: string, accountId?: string) => {
    if (!index.has(key)) {
      index.set(key, nodes.length);
      nodes.push({ name, category, color, accountId });
    }
    return index.get(key)!;
  };
  const link = (source: number, target: number, value: number) => {
    if (value >= 1) links.push({ source, target, value: safeRound(value, 2) });
  };
  let total = 0;
  income.forEach((value, id) => {
    const account = byId.get(id)!;
    link(node('income', 'Income', 'source', 'var(--money-in)'), node(`acc:${id}`, account.name, isCash(account) ? 'landing' : 'outcome', colorOf(account), id), value);
    total = safeAdd(total, value);
  });
  moves.forEach((value, key) => {
    if (value <= 0) return;
    const [fromId, toId] = key.split('|');
    const from = byId.get(fromId)!;
    const to = byId.get(toId)!;
    link(node(`acc:${fromId}`, from.name, 'landing', colorOf(from), fromId), node(`acc:${toId}`, to.name, 'outcome', colorOf(to), toId), value);
  });
  spend.forEach((value, id) => {
    const account = byId.get(id)!;
    link(node(`acc:${id}`, account.name, isCash(account) ? 'landing' : 'outcome', colorOf(account), id), node('spending', 'Spending', 'outcome', 'var(--money-out)'), value);
  });
  // Drop accounts whose only flows were too small to draw.
  const used = new Set(links.flatMap(item => [item.source, item.target]));
  const keep = nodes.map((_, i) => used.has(i));
  const remap = new Map<number, number>();
  const kept: MoneyMap['nodes'] = [];
  nodes.forEach((item, i) => { if (keep[i]) { remap.set(i, kept.length); kept.push(item); } });
  return { nodes: kept, links: links.map(item => ({ ...item, source: remap.get(item.source)!, target: remap.get(item.target)! })), total: safeRound(total, 2) };
}
