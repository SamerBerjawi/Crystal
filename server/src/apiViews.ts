/*
 * What the read-only API returns. Pure functions over a user's data blob, like alertRules.ts: defensive reads,
 * nothing is thrown for a malformed item, and nothing here can write. Amounts are converted to the main currency
 * with the rates saved in preferences; an amount with no rate is left out of totals and reported as unconverted.
 */

type Json = Record<string, any>;

const list = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []);
const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DEBT = new Set(['Credit Card', 'Loan', 'Other Liabilities']);

export const converter = (data: Json) => {
    const prefs: Json = data.preferences && typeof data.preferences === 'object' ? data.preferences : {};
    const main = String(prefs.currency || 'EUR').toUpperCase();
    const rates: Json = { ...(prefs.conversionRates ?? {}), ...(prefs.manualRates ?? {}) };
    const rate = (code: string) => (code === 'EUR' ? 1 : (num(rates[code]) ?? 0) > 0 ? num(rates[code])! : null);
    const unconverted = new Set<string>();
    const toMain = (amount: number, currency: unknown): number => {
        const from = String(currency || main).toUpperCase();
        if (from === main) return amount;
        const a = rate(from), b = rate(main);
        if (!a || !b) { unconverted.add(from); return 0; }
        return (amount * a) / b;
    };
    return { main, toMain, unconverted: () => [...unconverted].sort() };
};

const isSpend = (tx: Json) => tx.type === 'expense' && !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment && !tx.isMarketAdjustment;

export const summaryView = (data: Json, now = new Date()) => {
    const { main, toMain, unconverted } = converter(data);
    const accounts = list(data.accounts).filter(a => a.status !== 'closed');
    let assets = 0, debts = 0;
    const rows = accounts.map(a => {
        const balance = num(a.balance) ?? 0;
        const value = toMain(balance, a.currency);
        if (DEBT.has(String(a.type))) debts += Math.abs(value); else assets += value;
        return { id: String(a.id), name: String(a.name ?? ''), type: String(a.type ?? ''), currency: String(a.currency || main), balance: round2(balance), balanceInMain: round2(DEBT.has(String(a.type)) ? -Math.abs(value) : value) };
    });

    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const spend = list(data.transactions).filter(tx => isSpend(tx) && typeof tx.date === 'string' && tx.date.startsWith(month));
    const parentOf = (name: string): string => {
        const find = (nodes: Json[], parent: string | null): string | null => {
            for (const node of nodes) {
                const top = parent ?? String(node.name);
                if (node.name === name) return top;
                const hit = find(list(node.subCategories), top);
                if (hit) return hit;
            }
            return null;
        };
        return find(list(data.expenseCategories), null) ?? name;
    };
    const spentBy = new Map<string, number>();
    spend.forEach(tx => { const key = parentOf(String(tx.category)); spentBy.set(key, (spentBy.get(key) ?? 0) + Math.abs(toMain(num(tx.amount) ?? 0, tx.currency))); });
    const budgets = list(data.budgets).map(b => {
        const limit = toMain(num(b.amount) ?? 0, b.currency);
        const spent = spentBy.get(String(b.categoryName)) ?? 0;
        return { category: String(b.categoryName), limit: round2(limit), spent: round2(spent), used: limit > 0 ? round2(spent / limit) : null };
    });

    return {
        currency: main,
        asOf: isoOf(now),
        netWorth: round2(assets - debts),
        assets: round2(assets),
        debts: round2(debts),
        accounts: rows,
        budgets: { month, items: budgets },
        unconvertedCurrencies: unconverted(),
    };
};

export interface TransactionQuery { from?: string; to?: string; category?: string; accountId?: string; type?: string; limit?: number; offset?: number }

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Newest first. Transfers and adjustments are included but flagged, so the reader can decide. */
export const transactionsView = (data: Json, query: TransactionQuery) => {
    const limit = Math.min(500, Math.max(1, Math.floor(query.limit ?? 100)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));
    const from = query.from && DAY.test(query.from) ? query.from : null;
    const to = query.to && DAY.test(query.to) ? query.to : null;
    const rows = list(data.transactions)
        .filter(tx => typeof tx.date === 'string')
        .filter(tx => !from || tx.date.slice(0, 10) >= from)
        .filter(tx => !to || tx.date.slice(0, 10) <= to)
        .filter(tx => !query.category || String(tx.category) === query.category)
        .filter(tx => !query.accountId || String(tx.accountId) === query.accountId)
        .filter(tx => !query.type || tx.type === query.type)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return {
        total: rows.length,
        limit,
        offset,
        items: rows.slice(offset, offset + limit).map(tx => ({
            id: String(tx.id),
            date: String(tx.date).slice(0, 10),
            description: String(tx.description ?? ''),
            merchant: tx.merchant ? String(tx.merchant) : null,
            amount: num(tx.amount) ?? 0,
            currency: String(tx.currency || 'EUR'),
            type: String(tx.type ?? ''),
            category: String(tx.category ?? ''),
            accountId: String(tx.accountId ?? ''),
            isTransfer: Boolean(tx.transferId),
            isAdjustment: Boolean(tx.isBalanceAdjustment || tx.isMarketAdjustment),
        })),
    };
};

/** Holdings from the buy and sell history, at cost. Live prices are not on the server. */
export const investmentsView = (data: Json) => {
    const { main, toMain, unconverted } = converter(data);
    const bySymbol = new Map<string, { name: string; quantity: number; cost: number; currency: string }>();
    list(data.investmentTransactions).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(t => {
        const symbol = String(t.symbol ?? '');
        const quantity = num(t.quantity), price = num(t.price);
        if (!symbol || quantity === null || price === null) return;
        const entry = bySymbol.get(symbol) ?? { name: String(t.name ?? symbol), quantity: 0, cost: 0, currency: String(t.currency || 'EUR') };
        if (t.type === 'sell') {
            const avg = entry.quantity > 0 ? entry.cost / entry.quantity : 0;
            entry.cost -= avg * Math.min(quantity, entry.quantity);
            entry.quantity -= quantity;
        } else { entry.quantity += quantity; entry.cost += quantity * price; }
        bySymbol.set(symbol, entry);
    });
    const holdings = [...bySymbol.entries()].filter(([, h]) => h.quantity > 1e-9).map(([symbol, h]) => ({
        symbol, name: h.name, quantity: round2(h.quantity), costBasis: round2(h.cost), currency: h.currency, costBasisInMain: round2(toMain(h.cost, h.currency)),
    }));
    return { currency: main, valuation: 'cost', holdings, totalCostBasis: round2(holdings.reduce((s, h) => s + h.costBasisInMain, 0)), unconvertedCurrencies: unconverted() };
};

export const planningView = (data: Json) => {
    const { main, toMain, unconverted } = converter(data);
    return {
        currency: main,
        goals: list(data.financialGoals).map(g => ({
            id: String(g.id), name: String(g.name ?? ''), target: num(g.amount) ?? 0, saved: num(g.currentAmount) ?? 0, currency: String(g.currency || main), date: g.date ? String(g.date) : null,
        })),
        recurring: list(data.recurringTransactions).filter(r => !r.isSynthetic).map(r => ({
            id: String(r.id), description: String(r.merchant || r.description || ''), type: String(r.type ?? ''), amount: num(r.amount) ?? 0, currency: String(r.currency || main),
            amountInMain: round2(toMain(num(r.amount) ?? 0, r.currency)), frequency: String(r.frequency ?? ''), nextDueDate: r.nextDueDate ? String(r.nextDueDate).slice(0, 10) : null, paused: Boolean(r.pausedAt),
        })),
        bills: list(data.billsAndPayments).map(b => ({ id: String(b.id), description: String(b.description ?? ''), amount: num(b.amount) ?? 0, currency: String(b.currency || main), dueDate: b.dueDate ? String(b.dueDate).slice(0, 10) : null, status: String(b.status ?? '') })),
        unconvertedCurrencies: unconverted(),
    };
};

const inRange = (tx: Json, from: string | null, to: string | null) => { const d = String(tx.date).slice(0, 10); return (!from || d >= from) && (!to || d <= to); };
const validDay = (v?: string) => (v && DAY.test(v) ? v : null);

/** Where spending went, rolled up to each top-level category, in the main currency. */
export const spendingByCategoryView = (data: Json, query: { from?: string; to?: string }) => {
    const { main, toMain, unconverted } = converter(data);
    const from = validDay(query.from), to = validDay(query.to);
    const topOf = (name: string): string => {
        const find = (nodes: Json[], top: string | null): string | null => {
            for (const node of nodes) {
                const t = top ?? String(node.name);
                if (node.name === name) return t;
                const hit = find(list(node.subCategories), t);
                if (hit) return hit;
            }
            return null;
        };
        return find(list(data.expenseCategories), null) ?? (name || 'Uncategorized');
    };
    const sums = new Map<string, { total: number; count: number }>();
    list(data.transactions).filter(tx => typeof tx.date === 'string' && isSpend(tx) && inRange(tx, from, to)).forEach(tx => {
        const key = topOf(String(tx.category ?? ''));
        const entry = sums.get(key) ?? { total: 0, count: 0 };
        entry.total += Math.abs(toMain(num(tx.amount) ?? 0, tx.currency));
        entry.count += 1;
        sums.set(key, entry);
    });
    const rows = [...sums.entries()].map(([category, v]) => ({ category, total: round2(v.total), count: v.count })).sort((a, b) => b.total - a.total);
    return { currency: main, from, to, total: round2(rows.reduce((s, r) => s + r.total, 0)), categories: rows, unconvertedCurrencies: unconverted() };
};

/** Merchants matching a search, with how often and how much. */
export const merchantsView = (data: Json, query: { query?: string; from?: string; to?: string; limit?: number }) => {
    const { main, toMain, unconverted } = converter(data);
    const from = validDay(query.from), to = validDay(query.to);
    const needle = (query.query ?? '').trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
    const sums = new Map<string, { total: number; count: number; last: string }>();
    list(data.transactions).filter(tx => typeof tx.date === 'string' && isSpend(tx) && inRange(tx, from, to)).forEach(tx => {
        const name = String(tx.merchant || tx.description || '').trim();
        if (!name || (needle && !name.toLowerCase().includes(needle))) return;
        const entry = sums.get(name) ?? { total: 0, count: 0, last: '' };
        entry.total += Math.abs(toMain(num(tx.amount) ?? 0, tx.currency));
        entry.count += 1;
        entry.last = entry.last > String(tx.date).slice(0, 10) ? entry.last : String(tx.date).slice(0, 10);
        sums.set(name, entry);
    });
    const rows = [...sums.entries()].map(([merchant, v]) => ({ merchant, total: round2(v.total), count: v.count, lastDate: v.last })).sort((a, b) => b.total - a.total);
    return { currency: main, matches: rows.length, merchants: rows.slice(0, limit), unconvertedCurrencies: unconverted() };
};
