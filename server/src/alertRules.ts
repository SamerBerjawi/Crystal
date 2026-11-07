/*
 * Alert rules. Pure functions over a user's data blob: no database, no network, no clock except the one passed in.
 * The scheduler (alerts.ts) runs them for every user, drops what was already sent, and delivers the rest.
 *
 * The blob is untyped JSON here, so every read is defensive: a missing or malformed field skips that item, it never
 * throws. Amounts are only compared in the currency they were recorded in, because the server has no exchange rates.
 */

export type AlertKind = 'consent' | 'budget' | 'duplicate' | 'lowBalance' | 'priceHike';

export interface AlertRules {
    consent: boolean;
    budget: boolean;
    /** Share of a monthly budget, 0 to 1, that raises the first warning. Passing 100% always raises one more. */
    budgetThreshold: number;
    duplicate: boolean;
    lowBalance: boolean;
    /** Warn when a checking account is projected to drop below this, in the account's own currency. */
    lowBalanceFloor: number;
    lowBalanceDays: number;
    priceHike: boolean;
}

export const DEFAULT_RULES: AlertRules = {
    consent: true,
    budget: true,
    budgetThreshold: 0.8,
    duplicate: true,
    lowBalance: true,
    lowBalanceFloor: 0,
    lowBalanceDays: 7,
    priceHike: true,
};

export interface AlertCandidate {
    /** Stable for the same event, so an alert is sent once. */
    key: string;
    kind: AlertKind;
    title: string;
    message: string;
    priority: 'default' | 'high';
}

type Json = Record<string, any>;

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (iso: unknown): Date | null => {
    if (typeof iso !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []);
const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount); } catch { return `${amount.toFixed(2)} ${currency}`; }
};
const labelOf = (tx: Json) => String(tx.merchant || tx.description || 'a payment').trim();

/** Real spending: not a transfer, a split or combined parent, or a balance adjustment. */
const isSpend = (tx: Json) =>
    tx.type === 'expense' && !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment && !tx.isMarketAdjustment;

/** The bank sessions that end soon. Staged at 14, 7 and 1 days, like the in-app banner. */
const consentAlerts = (data: Json, now: Date): AlertCandidate[] =>
    list(data.enableBankingConnections).flatMap(connection => {
        const ends = typeof connection.sessionExpiresAt === 'string' ? new Date(connection.sessionExpiresAt).getTime() : NaN;
        if (!Number.isFinite(ends) || connection.status === 'disconnected') return [];
        const daysLeft = Math.ceil((ends - now.getTime()) / DAY_MS);
        const stage = daysLeft <= 0 ? 'expired' : daysLeft <= 1 ? 'last-day' : daysLeft <= 7 ? 'week' : daysLeft <= 14 ? 'fortnight' : null;
        if (!stage) return [];
        const bank = String(connection.selectedBank || 'Your bank');
        const message = stage === 'expired' ? `${bank} access has ended. Reconnect to keep syncing.`
            : stage === 'last-day' ? `${bank} access ends within a day. Renew it now to avoid a gap.`
            : `${bank} access ends in ${daysLeft} days. Renew it to keep syncing.`;
        return [{ key: `consent:${connection.id}:${stage}`, kind: 'consent' as const, title: 'Bank connection', message, priority: stage === 'week' || stage === 'fortnight' ? 'default' as const : 'high' as const }];
    });

const descendantNames = (categories: Json[], name: string): Set<string> => {
    const out = new Set<string>([name]);
    const visit = (nodes: Json[]): boolean => nodes.some(node => {
        if (node.name === name) {
            const collect = (n: Json) => { out.add(String(n.name)); list(n.subCategories).forEach(collect); };
            collect(node);
            return true;
        }
        return visit(list(node.subCategories));
    });
    visit(categories);
    return out;
};

/** Monthly budgets that reached the threshold, and again once they are used up. */
const budgetAlerts = (data: Json, now: Date, rules: AlertRules): AlertCandidate[] => {
    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const categories = list(data.expenseCategories);
    const transactions = list(data.transactions).filter(tx => isSpend(tx) && typeof tx.date === 'string' && tx.date.startsWith(month));
    return list(data.budgets).flatMap(budget => {
        const limit = num(budget.amount);
        if (!limit || limit <= 0) return [];
        const currency = String(budget.currency || '');
        const names = descendantNames(categories, String(budget.categoryName));
        const spent = transactions
            .filter(tx => names.has(String(tx.category)) && String(tx.currency || currency) === currency)
            .reduce((sum, tx) => sum + Math.abs(num(tx.amount) ?? 0), 0);
        const used = spent / limit;
        const label = String(budget.categoryName);
        const out: AlertCandidate[] = [];
        if (used >= 1) {
            out.push({ key: `budget:${budget.id}:${month}:100`, kind: 'budget', title: 'Budget used up', message: `${label}: ${money(spent, currency)} spent of ${money(limit, currency)} this month.`, priority: 'high' });
        } else if (used >= rules.budgetThreshold) {
            out.push({ key: `budget:${budget.id}:${month}:${Math.round(rules.budgetThreshold * 100)}`, kind: 'budget', title: 'Budget almost used', message: `${label}: ${Math.round(used * 100)}% used, ${money(limit - spent, currency)} left this month.`, priority: 'default' });
        }
        return out;
    });
};

/** The same amount to the same payee on one account within two days, neither tied to a recurring series. */
const duplicateAlerts = (data: Json, now: Date): AlertCandidate[] => {
    const since = isoOf(new Date(now.getTime() - 3 * DAY_MS));
    const recent = list(data.transactions).filter(tx => isSpend(tx) && !tx.recurringSourceId && typeof tx.date === 'string' && tx.date >= since);
    const out: AlertCandidate[] = [];
    const seen = new Set<string>();
    recent.forEach((a, i) => {
        recent.slice(i + 1).forEach(b => {
            const amountA = num(a.amount), amountB = num(b.amount);
            if (amountA === null || amountA !== amountB || a.accountId !== b.accountId || labelOf(a).toLowerCase() !== labelOf(b).toLowerCase()) return;
            const gap = Math.abs((dateOf(a.date)?.getTime() ?? 0) - (dateOf(b.date)?.getTime() ?? 0)) / DAY_MS;
            if (gap > 2) return;
            const key = `dup:${[String(a.id), String(b.id)].sort().join(':')}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ key, kind: 'duplicate', title: 'Possible duplicate charge', message: `${labelOf(a)} charged ${money(Math.abs(amountA), String(a.currency || 'EUR'))} twice (${a.date}${a.date === b.date ? '' : ` and ${b.date}`}).`, priority: 'high' });
        });
    });
    return out;
};

/** Recurring payments whose last real charge is higher than the amount the series expects. */
const priceHikeAlerts = (data: Json): AlertCandidate[] => {
    const latest = new Map<string, Json>();
    list(data.transactions).filter(tx => tx.recurringSourceId && isSpend(tx)).forEach(tx => {
        const current = latest.get(String(tx.recurringSourceId));
        if (!current || String(tx.date) > String(current.date)) latest.set(String(tx.recurringSourceId), tx);
    });
    return list(data.recurringTransactions).flatMap(series => {
        if (series.type !== 'expense' || series.pausedAt || series.isSynthetic) return [];
        const charge = latest.get(String(series.id));
        const expected = num(series.amount), charged = charge ? Math.abs(num(charge.amount) ?? 0) : 0;
        if (!charge || !expected || charged - expected < 0.5 || charged < expected * 1.02) return [];
        const currency = String(series.currency || charge.currency || 'EUR');
        return [{ key: `price:${series.id}:${charge.id}`, kind: 'priceHike' as const, title: 'Price went up', message: `${labelOf(series)} charged ${money(charged, currency)}, up from ${money(expected, currency)}.`, priority: 'default' as const }];
    });
};

const STEP: Record<string, (d: Date, n: number) => Date> = {
    daily: (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n),
    weekly: (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n),
    biweekly: (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14 * n),
    monthly: (d, n) => new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), 28)),
    yearly: (d, n) => new Date(d.getFullYear() + n, d.getMonth(), Math.min(d.getDate(), 28)),
};

/** Dates a series falls due in (from, to], starting at its next due date. */
export const occurrencesBetween = (series: Json, from: Date, to: Date): Date[] => {
    const step = STEP[String(series.frequency)];
    const first = dateOf(series.nextDueDate);
    if (!step || !first) return [];
    const interval = Math.max(1, num(series.frequencyInterval) ?? 1);
    const end = dateOf(series.endDate);
    const out: Date[] = [];
    for (let i = 0; i < 400; i++) {
        const day = step(first, i * interval);
        if (day > to || (end && day > end)) break;
        if (day > from) out.push(day);
    }
    return out;
};

/** Checking accounts that the next few days of scheduled payments would take below the floor. */
const lowBalanceAlerts = (data: Json, now: Date, rules: AlertRules): AlertCandidate[] => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + rules.lowBalanceDays);
    const series = list(data.recurringTransactions).filter(s => !s.pausedAt && !s.isSkipped && !s.isSynthetic);
    return list(data.accounts).flatMap(account => {
        const balance = num(account.balance);
        if (account.type !== 'Checking' || account.status === 'closed' || balance === null) return [];
        const currency = String(account.currency || 'EUR');
        const moves: { day: Date; delta: number }[] = [];
        series.forEach(s => {
            const amount = num(s.amount);
            if (amount === null || String(s.currency || currency) !== currency) return;
            const delta = s.type === 'income' && s.accountId === account.id ? amount
                : s.type === 'expense' && s.accountId === account.id ? -amount
                : s.type === 'transfer' && s.accountId === account.id ? -amount
                : s.type === 'transfer' && s.toAccountId === account.id ? amount : 0;
            if (delta === 0) return;
            occurrencesBetween(s, today, horizon).forEach(day => moves.push({ day, delta }));
        });
        moves.sort((a, b) => a.day.getTime() - b.day.getTime());
        let running = balance;
        for (const move of moves) {
            running += move.delta;
            if (running < rules.lowBalanceFloor) {
                return [{
                    key: `low:${account.id}:${isoOf(move.day)}`,
                    kind: 'lowBalance' as const,
                    title: 'Low balance ahead',
                    message: `${account.name} is projected to reach ${money(running, currency)} on ${isoOf(move.day)}, below ${money(rules.lowBalanceFloor, currency)}.`,
                    priority: 'high' as const,
                }];
            }
        }
        return [];
    });
};

export const evaluateAlerts = (data: Json, rules: AlertRules, now: Date): AlertCandidate[] => [
    ...(rules.consent ? consentAlerts(data, now) : []),
    ...(rules.budget ? budgetAlerts(data, now, rules) : []),
    ...(rules.duplicate ? duplicateAlerts(data, now) : []),
    ...(rules.lowBalance ? lowBalanceAlerts(data, now, rules) : []),
    ...(rules.priceHike ? priceHikeAlerts(data) : []),
];
