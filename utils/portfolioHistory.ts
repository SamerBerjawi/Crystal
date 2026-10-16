import { Account, InvestmentTransaction, PriceHistoryEntry, Transaction, Warrant } from '../types';

export interface HistoryHolding {
    symbol: string;
    type: 'Standard' | 'Warrant';
    quantity: number;
    currentPrice: number;
}

export interface PortfolioHistoryArgs {
    holdings: HistoryHolding[];
    warrants: Warrant[];
    investmentTransactions: InvestmentTransaction[];
    /** true for the "all" segment: every transaction contributes a date, not only those of the matching holdings. */
    allSegments: boolean;
    /** Sorted (oldest first) price log for a symbol/ISIN. */
    priceHistoryFor: (symbol: string) => PriceHistoryEntry[];
    prices: Record<string, number | null>;
    nonSymbolAccounts: Account[];
    transactionsByAccount: Record<string, Transaction[]>;
    toEur: (amount: number, currency: Account['currency']) => number;
    currentValuation: number;
    /** YYYY-MM-DD */
    today: string;
}

/** Calendar day of any date string ("2026-01-05", "2026-01-05T10:00:00Z", "2026-01-05 10:00:00"). */
export const dayOf = (value: string): string => String(value || '').slice(0, 10);

const byDay = (a: { date: string }, b: { date: string }) => dayOf(a.date).localeCompare(dayOf(b.date));

/**
 * Portfolio valuation (EUR) on every date where something changed, ending with today's valuation.
 * All comparisons are on calendar days so mixed formats ("2026-01-05" vs a timestamp) cannot disagree.
 */
export function buildPortfolioHistory(args: PortfolioHistoryArgs): { date: string; price: number }[] {
    const {
        holdings, warrants, investmentTransactions, allSegments, priceHistoryFor, prices,
        nonSymbolAccounts, transactionsByAccount, toEur, currentValuation, today,
    } = args;

    const matchingSymbols = new Set(holdings.map(h => h.symbol));
    const dateSet = new Set<string>();

    holdings.forEach(h => priceHistoryFor(h.symbol).forEach(e => dateSet.add(dayOf(e.date))));
    warrants.forEach(w => {
        priceHistoryFor(w.isin).forEach(e => dateSet.add(dayOf(e.date)));
        if (w.grantDate) dateSet.add(dayOf(w.grantDate));
    });
    investmentTransactions.forEach(tx => {
        if (allSegments || matchingSymbols.has(tx.symbol)) dateSet.add(dayOf(tx.date));
    });
    nonSymbolAccounts.forEach(acc => {
        (acc.priceHistory || []).forEach(e => { if (e?.date) dateSet.add(dayOf(e.date)); });
        (transactionsByAccount[acc.id] || []).forEach(tx => { if (tx?.date) dateSet.add(dayOf(tx.date)); });
    });

    if (dateSet.size === 0) {
        return currentValuation > 0 ? [{ date: today, price: Number(currentValuation.toFixed(2)) }] : [];
    }

    const allDates = Array.from(dateSet).sort();

    const history = allDates.map(date => {
        let total = 0;

        holdings.forEach(h => {
            if (h.type === 'Warrant') return;
            const log = priceHistoryFor(h.symbol);
            const past = log.filter(e => dayOf(e.date) <= date);
            const symbolTxs = investmentTransactions.filter(t => t.symbol === h.symbol);
            const txsUpToDate = symbolTxs.filter(t => dayOf(t.date) <= date).sort(byDay);

            let priceOnDate = h.currentPrice;
            if (past.length > 0) priceOnDate = past[past.length - 1].price;
            else if (txsUpToDate.length > 0) priceOnDate = txsUpToDate[txsUpToDate.length - 1].price;
            else if (log.length > 0) priceOnDate = log[0].price;

            let qtyOnDate = h.quantity;
            if (symbolTxs.length > 0) {
                qtyOnDate = txsUpToDate.reduce((q, tx) => {
                    const amount = Number(tx.quantity) || 0;
                    return tx.type?.toLowerCase() === 'buy' ? q + amount : Math.max(0, q - amount);
                }, 0);
            }
            if (qtyOnDate <= 0.000001) return;
            total += qtyOnDate * priceOnDate;
        });

        warrants.forEach(w => {
            // A grant is worth nothing to the portfolio before it was granted.
            if (w.grantDate && dayOf(w.grantDate) > date) return;
            const log = priceHistoryFor(w.isin);
            const latest = log.length > 0 ? log[log.length - 1].price : w.grantPrice;
            const current = prices[w.isin] && prices[w.isin]! > 0 ? prices[w.isin]! : latest;
            const past = log.filter(e => dayOf(e.date) <= date);
            total += (w.quantity || 0) * (past.length > 0 ? past[past.length - 1].price : current);
        });

        nonSymbolAccounts.forEach(acc => {
            if (acc.priceHistory && acc.priceHistory.length > 0) {
                const sorted = [...acc.priceHistory].sort(byDay);
                const past = sorted.filter(e => dayOf(e.date) <= date);
                const p = past.length > 0 ? past[past.length - 1].price : sorted[0].price;
                total += toEur(p, acc.currency);
                return;
            }
            const accTxs = transactionsByAccount[acc.id] || [];
            if (accTxs.length === 0) {
                total += toEur(acc.balance, acc.currency);
                return;
            }
            // Transaction amounts are signed (expenses are negative): undo the ones that happen after `date`.
            const futureNet = accTxs.filter(t => dayOf(t.date) > date).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            total += toEur(Math.max(0, acc.balance - futureNet), acc.currency);
        });

        return { date, price: Number(total.toFixed(2)) };
    });

    const last = history[history.length - 1];
    if (last.date !== today) history.push({ date: today, price: Number(currentValuation.toFixed(2)) });
    else last.price = Number(currentValuation.toFixed(2));
    return history;
}
