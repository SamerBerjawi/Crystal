import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHoldingsOverview } from '../../utils/investments';

const account: any = { id: 'a', name: 'Broker', type: 'Investment', symbol: 'VWCE', balance: 0, currency: 'EUR', subType: 'ETF' };
const buy = (symbol: string, quantity: number, price: number, date = '2026-01-10'): any => ({ id: `${symbol}-${date}`, accountId: 'a', symbol, type: 'buy', quantity, price, date });

test('a holding without a price falls back to its last trade price, not zero', () => {
    const o = buildHoldingsOverview([account], [buy('VWCE', 25, 100, '2026-01-01'), buy('VWCE', 0, 0)], [], {});
    const h = o.holdings.find(x => x.symbol === 'VWCE')!;
    assert.equal(h.priceUnavailable, true);
    assert.equal(h.currentPrice, 100);
    assert.equal(h.currentValue, 2500);
});
test('unpriced holdings are reported separately so they can be excluded from gain/loss', () => {
    const o = buildHoldingsOverview([account], [buy('VWCE', 10, 50)], [], {});
    assert.equal(o.unpricedCostBasis, 500);
    assert.equal(o.unpricedValue, 500);
});
test('a quoted holding uses the quote and is not flagged', () => {
    const o = buildHoldingsOverview([account], [buy('VWCE', 10, 50)], [], { VWCE: 60 });
    const h = o.holdings[0];
    assert.equal(h.priceUnavailable, undefined);
    assert.equal(h.currentValue, 600);
    assert.equal(o.unpricedCostBasis, 0);
});
test('a null quote counts as unknown, not as a price of zero', () => {
    const o = buildHoldingsOverview([account], [buy('VWCE', 10, 50)], [], { VWCE: null });
    assert.equal(o.holdings[0].currentValue, 500);
});
