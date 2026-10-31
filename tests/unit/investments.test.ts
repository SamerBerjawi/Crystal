import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuote } from '../../src/services/twelveDataService';
import { buildHoldingsOverview, historyWindow, holdingsInSegment, mergedPriceLog, portfolioBySegment, realizedGains } from '../../utils/investments';

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

/* DEF-01: traded positions must count once, not once per segment. */

const fund: any = { id: 'f', name: 'World ETF', type: 'Investment', symbol: 'WRLD', balance: 0, currency: 'EUR', subType: 'ETF' };
const stock: any = { id: 's', name: 'Acme', type: 'Investment', symbol: 'ACME', balance: 0, currency: 'EUR', subType: 'Stock' };
const pension: any = { id: 'p', name: 'Pension', type: 'Investment', balance: 5000, currency: 'EUR', subType: 'Pension Fund' };
const eur = (amount: number) => amount;

test('DEF-01: each position counts once, and All equals the sum of its segments', () => {
    const accounts = [fund, stock, pension];
    const trades = [buy('WRLD', 10, 100), buy('ACME', 5, 20)];
    const overview = buildHoldingsOverview(accounts, trades, [], { WRLD: 110, ACME: 30 });
    const segments = portfolioBySegment(overview, accounts, eur);
    assert.equal(segments.ETF.value, 1100);
    assert.equal(segments.Stock.value, 150);
    assert.equal(segments['Pension Fund'].value, 5000);
    assert.equal(segments.Crypto.value, 0);
    assert.equal(segments.all.value, 6250);
    assert.equal(segments.all.cost, 1100 + 5000 + 0);
    assert.equal(segments.ETF.cost, 1000);
});

test('DEF-01: a segment lists only its own holdings', () => {
    const overview = buildHoldingsOverview([fund, stock], [buy('WRLD', 1, 1), buy('ACME', 1, 1)], [], {});
    assert.deepEqual(holdingsInSegment(overview.holdings, 'ETF').map(h => h.symbol), ['WRLD']);
    assert.equal(holdingsInSegment(overview.holdings, 'all').length, 2);
});

test('DEF-01: grants sit in Warrants, and sold units leave the value', () => {
    const grant: any = { id: 'w', isin: 'XS1', name: 'Grant', grantDate: '2026-01-01', quantity: 10, grantPrice: 5 };
    const sale: any = { id: 'x', symbol: 'XS1', name: 'Grant', quantity: 4, price: 8, date: '2026-02-01', type: 'sell' };
    const overview = buildHoldingsOverview([], [sale], [grant], { XS1: 10 });
    const segments = portfolioBySegment(overview, [], eur);
    assert.equal(segments.Warrant.value, 60);
    assert.equal(segments.all.value, 60);
});

test('DEF-04: a USD trade and quote are valued in EUR at the rate, and a EUR holding is untouched', () => {
    const toEur = (amount: number, currency: string) => (currency === 'USD' ? amount * 0.5 : amount);
    const trade = { ...buy('AAPL', 10, 100), currency: 'USD' };
    const overview = buildHoldingsOverview([], [trade, buy('WRLD', 2, 50)], [], { AAPL: 120, WRLD: 60 }, {
        currencyOf: symbol => (symbol === 'AAPL' ? 'USD' : 'EUR'),
        toEur,
    });
    const apple = overview.holdings.find(h => h.symbol === 'AAPL')!;
    assert.equal(apple.currency, 'USD');
    assert.equal(apple.currentPrice, 120);
    assert.equal(apple.currentValue, 600);
    assert.equal(apple.totalCost, 500);
    assert.equal(overview.holdings.find(h => h.symbol === 'WRLD')!.currentValue, 120);
});

test('realised gains: sells measure against the average cost, grants included', () => {
    const grant: any = { id: 'w', isin: 'XS1', name: 'Grant', grantDate: '2026-01-01', quantity: 10, grantPrice: 5 };
    const trades = [buy('ACME', 10, 10, '2026-01-01'), { ...buy('ACME', 5, 12, '2026-02-01'), type: 'sell', id: 'a' }, { ...buy('ACME', 5, 8, '2026-03-01'), type: 'sell', id: 'b' }, { ...buy('XS1', 2, 8, '2026-02-01'), type: 'sell', id: 'c' }];
    const result = realizedGains(trades as any, [grant]);
    assert.equal(result.total, 10 - 10 + 6);
    assert.equal(result.wins, 2);
    assert.equal(result.losses, 1);
    assert.equal(result.biggestWin?.symbol, 'ACME');
    assert.equal(result.biggestLoss?.gain, -10);
    assert.equal(result.sales.length, 3);
});

test('DEF-04: a quote keeps its currency, and one with none is refused rather than guessed', () => {
    const supported = ['EUR', 'USD'];
    assert.deepEqual(parseQuote({ close: '120.5', currency: 'USD', exchange: 'NASDAQ' }, supported), { price: 120.5, currency: 'USD', exchange: 'NASDAQ' });
    assert.equal(parseQuote({ close: '60000', currency_quote: 'EUR' }, supported).currency, 'EUR');
    assert.throws(() => parseQuote({ close: '100' }, supported), /unknown currency/);
    assert.throws(() => parseQuote({ close: '100', currency: 'JPY' }, supported), /JPY/);
    assert.throws(() => parseQuote({ status: 'error', message: 'Not found' }, supported), /Not found/);
});

test('a chart window keeps its range and measures the change across it', () => {
    const history = [{ date: '2026-01-01', price: 100 }, { date: '2026-03-01', price: 120 }, { date: '2026-03-20', price: 150 }];
    const month = historyWindow(history, 30, new Date(2026, 2, 25));
    assert.equal(month.points.length, 3);
    assert.equal(month.points[0].price, 100);
    assert.equal(month.change, 50);
    assert.equal(month.changePct, 50);
    assert.equal(historyWindow(history, null, new Date(2026, 2, 25)).points.length, 3);
});

test('price logs merge by date, with the later log winning', () => {
    const merged = mergedPriceLog([{ date: '2026-02-01', price: 1 }, { date: '2026-01-01', price: 2 }], [{ date: '2026-02-01', price: 3 }], undefined);
    assert.deepEqual(merged, [{ date: '2026-01-01', price: 2 }, { date: '2026-02-01', price: 3 }]);
});
