import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioHistory, dayOf } from '../../utils/portfolioHistory';

const base = {
    warrants: [], investmentTransactions: [], allSegments: true, priceHistoryFor: () => [], prices: {},
    nonSymbolAccounts: [], transactionsByAccount: {}, toEur: (n: number) => n, currentValuation: 0, today: '2026-10-16',
    holdings: [],
} as any;

test('dayOf normalises timestamps and plain dates to the same calendar day', () => {
    assert.equal(dayOf('2026-01-05T10:00:00Z'), '2026-01-05');
    assert.equal(dayOf('2026-01-05 10:00:00'), '2026-01-05');
    assert.equal(dayOf('2026-01-05'), '2026-01-05');
});

test('a non-symbol account is rebuilt from SIGNED transaction amounts (expenses are negative)', () => {
    const acc: any = { id: 'a', balance: 1000, currency: 'EUR' };
    const txs: any = { a: [
        { date: '2026-03-01', amount: -200 },   // expense after the checkpoint
        { date: '2026-02-01', amount: 500 },    // income before it
    ] };
    const h = buildPortfolioHistory({ ...base, nonSymbolAccounts: [acc], transactionsByAccount: txs, currentValuation: 1000 });
    const on = (d: string) => h.find(e => e.date === d)!.price;
    // Before the March expense the account held 1000 - (-200) = 1200, not 800.
    assert.equal(on('2026-02-01'), 1200);
    assert.equal(on('2026-03-01'), 1000);
});

test('a warrant is not counted before its grant date', () => {
    const w: any = { id: 'w', isin: 'W1', grantDate: '2026-06-01', quantity: 10, grantPrice: 5 };
    const tx: any = { id: 't', symbol: 'X', quantity: 1, price: 100, date: '2026-01-10', type: 'buy' };
    const holding: any = { symbol: 'X', type: 'Standard', quantity: 1, currentPrice: 100 };
    const h = buildPortfolioHistory({ ...base, warrants: [w], holdings: [holding], investmentTransactions: [tx], currentValuation: 150 });
    assert.equal(h.find(e => e.date === '2026-01-10')!.price, 100);
    assert.equal(h.find(e => e.date === '2026-06-01')!.price, 150);
});

test('mixed date formats in price logs and trades compare by calendar day', () => {
    const tx: any = { id: 't', symbol: 'X', quantity: 2, price: 10, date: '2026-04-01', type: 'buy' };
    const holding: any = { symbol: 'X', type: 'Standard', quantity: 2, currentPrice: 30 };
    const log = [{ date: '2026-04-01T09:30:00.000Z', price: 20 }];
    const h = buildPortfolioHistory({ ...base, holdings: [holding], investmentTransactions: [tx], priceHistoryFor: () => log, currentValuation: 60 });
    // Same calendar day: the log price applies (2 x 20), not the trade price.
    assert.equal(h.find(e => e.date === '2026-04-01')!.price, 40);
    assert.equal(h.length, 2); // one entry for 2026-04-01 (not one per format) + today
});

test('ends with today at the current valuation', () => {
    const h = buildPortfolioHistory({ ...base, currentValuation: 123.456, nonSymbolAccounts: [{ id: 'a', balance: 5, currency: 'EUR', priceHistory: [{ date: '2026-01-01', price: 5 }] } as any] });
    assert.deepEqual(h[h.length - 1], { date: '2026-10-16', price: 123.46 });
});
