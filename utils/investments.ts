import { BRAND_COLORS } from '../constants';
import { Account, Currency, HoldingDistribution, HoldingSummary, HoldingsOverview, InvestmentSubType, InvestmentTransaction, PriceHistoryEntry, Warrant } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';

const getTypeLabel = (holding: HoldingSummary) =>
    holding.type === 'Warrant' ? 'Warrants' : (holding.subType || 'Other');

export interface HoldingsOptions {
    /** The currency a holding's prices are in. EUR when left out. */
    currencyOf?: (symbol: string) => Currency;
    toEur?: (amount: number, currency: Currency) => number;
}

/** Everything held, once. `currentValue` and `totalCost` are in EUR, and `currentPrice` in the holding's own currency. */
export const buildHoldingsOverview = (
    investmentAccounts: Account[],
    investmentTransactions: InvestmentTransaction[],
    warrants: Warrant[],
    prices: Record<string, number | null>,
    options: HoldingsOptions = {}
): HoldingsOverview => {
    const currencyOf = options.currencyOf ?? (() => 'EUR' as Currency);
    const toEur = options.toEur ?? ((amount: number) => amount);
    const holdingsMap: Record<string, HoldingSummary> = {};
    const lastTradePrice: Record<string, number> = {};

    investmentAccounts.forEach(acc => {
        if (acc.symbol) {
            holdingsMap[acc.symbol] = {
                symbol: acc.symbol,
                name: acc.name,
                quantity: 0,
                totalCost: 0,
                currentValue: acc.balance,
                currentPrice: 0,
                type: 'Standard',
                subType: acc.subType
            };
        }
    });

    warrants.forEach(w => {
        if (!holdingsMap[w.isin]) {
            holdingsMap[w.isin] = {
                symbol: w.isin,
                name: w.name,
                quantity: 0,
                totalCost: 0,
                currentValue: 0,
                currentPrice: 0,
                type: 'Warrant',
                subType: 'Warrant',
                warrantId: w.id
            };
        }

        const holding = holdingsMap[w.isin];
        holding.type = 'Warrant';
        holding.quantity += w.quantity;
        holding.totalCost += toEur(w.quantity * w.grantPrice, currencyOf(w.isin));
        holding.warrantId = w.id;
    });

    [...investmentTransactions]
        .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime())
        .forEach(tx => {
            if (!holdingsMap[tx.symbol]) {
                holdingsMap[tx.symbol] = {
                    symbol: tx.symbol,
                    name: tx.symbol, // Use symbol as name if account not found
                    quantity: 0,
                    totalCost: 0,
                    currentValue: 0,
                    currentPrice: 0,
                    type: 'Standard',
                    subType: 'Stock'
                };
            }
            const holding = holdingsMap[tx.symbol];
            
            const q = Number(tx.quantity) || 0;
            const p = Number(tx.price) || 0;
            if (p > 0) {
                const txCurr = tx.currency ?? currencyOf(tx.symbol);
                const holdCurr = currencyOf(tx.symbol);
                const holdRate = Math.max(toEur(1, holdCurr), 1e-9);
                lastTradePrice[tx.symbol] = txCurr === holdCurr ? p : toEur(p, txCurr) / holdRate;
            }

            if (tx.type?.toLowerCase() === 'buy') {
                holding.quantity += q;
                holding.totalCost += toEur(q * p, tx.currency ?? currencyOf(tx.symbol));
            } else {
                const avgCost = holding.quantity > 0 ? holding.totalCost / holding.quantity : 0;
                holding.totalCost -= q * avgCost;
                holding.quantity -= q;
                if (holding.quantity < 0.000001) {
                    holding.quantity = 0;
                    holding.totalCost = 0;
                } else if (holding.totalCost < 0) {
                    holding.totalCost = 0;
                }
            }
        });

    Object.values(holdingsMap).forEach(h => {
        const quoted = prices[h.symbol];
        let price = typeof quoted === 'number' && Number.isFinite(quoted) && quoted > 0 ? quoted : 0;
        if (price === 0 && h.quantity > 0) {
            // No live or manual price: use the last trade price, else the average cost, instead of valuing the
            // position at zero (which showed as a -100% loss). The row is flagged so the UI can say so.
            price = lastTradePrice[h.symbol] ?? (h.totalCost > 0 ? h.totalCost / h.quantity / Math.max(toEur(1, currencyOf(h.symbol)), 1e-9) : 0);
            h.priceUnavailable = true;
        }
        h.currency = currencyOf(h.symbol);
        h.currentPrice = price;
        h.currentValue = toEur(h.quantity * price, h.currency);
        h.remainingQuantity = h.quantity;
    });

    const holdings = Object.values(holdingsMap);
    const filteredHoldings = holdings.filter(h => h.quantity > 0.000001 || h.type === 'Warrant');
    const totalValue = filteredHoldings.reduce((sum, h) => sum + h.currentValue, 0);

    let investedCapital = 0;
    let grantedCapital = 0;

    filteredHoldings.forEach(h => {
        if (h.type === 'Warrant') {
            grantedCapital += h.totalCost;
        } else {
            investedCapital += h.totalCost;
        }
    });

    const totalCostBasis = investedCapital + grantedCapital;
    const unpriced = filteredHoldings.filter(h => h.priceUnavailable);
    const unpricedCostBasis = unpriced.reduce((sum, h) => sum + h.totalCost, 0);
    const unpricedValue = unpriced.reduce((sum, h) => sum + h.currentValue, 0);

    const distributionData: HoldingDistribution[] = filteredHoldings
        .map((holding, index) => {
            const color = BRAND_COLORS[index % BRAND_COLORS.length];
            holding.color = color;
            return {
                name: holding.symbol,
                value: holding.currentValue,
                color
            };
        })
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value);

    const typeDataRaw: Record<string, number> = {};
    filteredHoldings.forEach(h => {
        const typeLabel = getTypeLabel(h);
        typeDataRaw[typeLabel] = (typeDataRaw[typeLabel] || 0) + h.currentValue;
    });

    const typeBreakdown: HoldingDistribution[] = Object.entries(typeDataRaw)
        .map(([name, value], idx) => ({
            name,
            value,
            color: ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][idx % 5]
        }))
        .sort((a, b) => b.value - a.value);

    return {
        holdings,
        totalValue,
        totalCostBasis,
        unpricedCostBasis,
        unpricedValue,
        investedCapital,
        grantedCapital,
        distributionData,
        typeBreakdown
    };
};

export type InvestmentSegment = 'all' | 'Stock' | 'ETF' | 'Crypto' | 'Warrant' | 'Spare Change' | 'Pension Fund' | 'Other';
export type SegmentName = Exclude<InvestmentSegment, 'all'>;
export const SEGMENT_NAMES: SegmentName[] = ['Stock', 'ETF', 'Crypto', 'Warrant', 'Spare Change', 'Pension Fund', 'Other'];

export const segmentOf = (holding: Pick<HoldingSummary, 'type' | 'subType'>): SegmentName => {
    if (holding.type === 'Warrant') return 'Warrant';
    return SEGMENT_NAMES.includes(holding.subType as SegmentName) ? holding.subType as SegmentName : 'Other';
};

export const holdingsInSegment = <T extends HoldingSummary>(holdings: T[], segment: InvestmentSegment) =>
    (segment === 'all' ? holdings : holdings.filter(holding => segmentOf(holding) === segment));

export interface SegmentFigures { value: number; cost: number; unpricedValue: number; unpricedCost: number }

/**
 * The portfolio split by segment (DEF-01): one overview, each position in exactly one segment, plus accounts valued
 * by balance. `all` is the sum, so a position can never be counted twice.
 */
export const portfolioBySegment = (
    overview: HoldingsOverview,
    accounts: Account[],
    toEur: (amount: number, currency: Currency) => number
): Record<InvestmentSegment, SegmentFigures> => {
    const empty = (): SegmentFigures => ({ value: 0, cost: 0, unpricedValue: 0, unpricedCost: 0 });
    const figures = Object.fromEntries(['all', ...SEGMENT_NAMES].map(name => [name, empty()])) as Record<InvestmentSegment, SegmentFigures>;
    const add = (segment: SegmentName, value: number, cost: number, unpriced: boolean) => {
        for (const entry of [figures[segment], figures.all]) {
            entry.value += value;
            entry.cost += cost;
            if (unpriced) {
                entry.unpricedValue += value;
                entry.unpricedCost += cost;
            }
        }
    };
    const positionedSymbols = new Set(
        overview.holdings
            .filter(holding => holding.quantity > 0.000001 || holding.type === 'Warrant')
            .map(holding => holding.symbol)
    );
    overview.holdings
        .filter(holding => holding.quantity > 0.000001 || holding.type === 'Warrant')
        .forEach(holding => add(segmentOf(holding), holding.currentValue, holding.totalCost, !!holding.priceUnavailable));
    accounts.filter(account => !account.symbol || (!positionedSymbols.has(account.symbol) && account.balance > 0)).forEach(account => {
        const value = toEur(account.balance, account.currency);
        const cost = toEur(account.purchasePrice && account.purchasePrice > 0 ? account.purchasePrice : account.balance, account.currency);
        add(segmentOf({ type: 'Standard', subType: account.subType }), value, cost, false);
    });
    return figures;
};

export interface RealizedSale { id: string; symbol: string; date: string; quantity: number; buyPrice: number; sellPrice: number; gain: number; gainPercent: number }
export interface RealizedGains { sales: RealizedSale[]; total: number; wins: number; losses: number; biggestWin?: RealizedSale; biggestLoss?: RealizedSale }

/** Closed trades against the average cost so far. Grants count as buys at their grant price. */
export const realizedGains = (
    transactions: InvestmentTransaction[],
    warrants: Warrant[] = [],
    toEur: (amount: number, currency: Currency) => number = amount => amount,
    currencyOf: (symbol: string) => Currency = () => 'EUR' as Currency,
): RealizedGains => {
    const events = [
        ...warrants.map(w => ({ id: w.id, symbol: w.isin, date: w.grantDate, quantity: Number(w.quantity) || 0, price: Number(w.grantPrice) || 0, type: 'buy', currency: currencyOf(w.isin) })),
        ...transactions.map(tx => ({ ...tx, quantity: Number(tx.quantity) || 0, price: Number(tx.price) || 0, currency: tx.currency ?? currencyOf(tx.symbol) })),
    ].filter(event => event.symbol).sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

    const positions: Record<string, { quantity: number; average: number }> = {};
    const sales: RealizedSale[] = [];
    events.forEach(event => {
        const symbol = event.symbol.toUpperCase();
        const position = (positions[symbol] ||= { quantity: 0, average: 0 });
        const priceEur = toEur(event.price, event.currency);
        if (event.type?.toLowerCase() === 'buy') {
            const total = position.quantity * position.average + event.quantity * priceEur;
            position.quantity += event.quantity;
            position.average = position.quantity > 0 ? total / position.quantity : 0;
        } else {
            const gain = event.quantity * (priceEur - position.average);
            sales.push({
                id: event.id, symbol, date: event.date, quantity: event.quantity, buyPrice: position.average, sellPrice: priceEur, gain,
                gainPercent: position.average > 0 ? ((priceEur - position.average) / position.average) * 100 : 0,
            });
            position.quantity = Math.max(0, position.quantity - event.quantity);
        }
    });

    const wins = sales.filter(sale => sale.gain >= 0);
    const losses = sales.filter(sale => sale.gain < 0);
    return {
        sales: [...sales].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
        total: sales.reduce((sum, sale) => sum + sale.gain, 0),
        wins: wins.length,
        losses: losses.length,
        biggestWin: wins.reduce<RealizedSale | undefined>((best, sale) => (!best || sale.gain > best.gain ? sale : best), undefined),
        biggestLoss: losses.reduce<RealizedSale | undefined>((worst, sale) => (!worst || sale.gain < worst.gain ? sale : worst), undefined),
    };
};

export const formatHoldingType = (subType?: InvestmentSubType) => {
    switch (subType) {
        case 'ETF':
            return 'Exchange Traded Fund';
        case 'Crypto':
            return 'Cryptocurrency';
        case 'Warrant':
            return 'Warrant';
        case 'Pension Fund':
            return 'Pension Fund';
        case 'Spare Change':
            return 'Round-up Savings';
        case 'Other':
            return 'Other Asset';
        default:
            return 'Stock';
    }
};

/** Below this many logged prices, candles would just be noise (D-011). */
export const CANDLE_MIN_POINTS = 20;

/** A chart window, oldest first, with the change across it. The last value before the window starts it, so a quiet stretch stays a flat line. */
export const historyWindow = (history: { date: string; price: number }[], days: number | null, today: Date) => {
    const from = days === null ? '' : toLocalISOString(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
    const inside = history.filter(point => point.date.slice(0, 10) >= from);
    const before = history[history.length - inside.length - 1];
    const startsLate = !!before && inside[0]?.date.slice(0, 10) !== from;
    const points = startsLate ? [{ date: from, price: before.price }, ...inside] : inside;
    const first = points[0]?.price ?? 0;
    const last = points[points.length - 1]?.price ?? 0;
    return { points, change: last - first, changePct: first > 0 ? ((last - first) / first) * 100 : 0 };
};

/** Prices for a symbol from both logs, oldest first. Later entries for a date win. */
export const mergedPriceLog = (...logs: (PriceHistoryEntry[] | undefined)[]) => {
    const byDate = new Map<string, number>();
    logs.forEach(log => (log ?? []).forEach(entry => { if (entry?.date && typeof entry.price === 'number') byDate.set(entry.date, entry.price); }));
    return [...byDate.entries()].map(([date, price]) => ({ date, price })).sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)));
};
