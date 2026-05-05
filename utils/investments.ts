import { BRAND_COLORS } from '../constants';
import { Account, HoldingDistribution, HoldingSummary, HoldingsOverview, InvestmentSubType, InvestmentTransaction, Warrant } from '../types';
import { parseLocalDate } from '../utils';

const getTypeLabel = (holding: HoldingSummary) =>
    holding.type === 'Warrant' ? 'Warrants' : (holding.subType || 'Other');

export const buildHoldingsOverview = (
    investmentAccounts: Account[],
    investmentTransactions: InvestmentTransaction[],
    warrants: Warrant[],
    prices: Record<string, number | null>
): HoldingsOverview => {
    const holdingsMap: Record<string, HoldingSummary> = {};

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

            if (tx.type === 'buy') {
                holding.quantity += q;
                holding.totalCost += q * p;
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
                subType: 'Other',
                warrantId: w.id
            };
        }

        const holding = holdingsMap[w.isin];
        holding.type = 'Warrant';
        holding.quantity += w.quantity;
        holding.totalCost += w.quantity * w.grantPrice;
        holding.warrantId = w.id;
    });

    Object.values(holdingsMap).forEach(h => {
        const price = prices[h.symbol] ?? 0;
        h.currentPrice = price;
        h.currentValue = h.quantity * price;
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
        investedCapital,
        grantedCapital,
        distributionData,
        typeBreakdown
    };
};

export const formatHoldingType = (subType?: InvestmentSubType) => {
    switch (subType) {
        case 'ETF':
            return 'Exchange Traded Fund';
        case 'Crypto':
            return 'Cryptocurrency';
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
