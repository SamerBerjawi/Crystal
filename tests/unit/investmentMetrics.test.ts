import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPerformance, xirr } from '../../utils/investmentMetrics';
import type { HoldingSummary, InvestmentTransaction } from '../../types';

const near = (a: number | null, b: number, tol = 1e-4) => assert.ok(a !== null && Math.abs(a - b) < tol, `${a} vs ${b}`);
const TODAY = new Date(2026, 0, 1);
const trade = (id: string, symbol: string, type: 'buy' | 'sell', quantity: number, price: number, date: string): InvestmentTransaction => ({ id, symbol, name: symbol, quantity, price, date, type });
const holding = (symbol: string, quantity: number, currentValue: number, over: Partial<HoldingSummary> = {}): HoldingSummary =>
  ({ symbol, name: symbol, quantity, totalCost: 0, currentValue, currentPrice: quantity ? currentValue / quantity : 0, type: 'Standard', subType: 'Stock', currency: 'EUR', ...over });

test('xirr: 1000 becomes 1100 in a year is 10%, and 1210 in two years is 10% too', () => {
  near(xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1100 }]), 0.1);
  near(xirr([{ date: '2024-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1210 }]), 0.1, 2e-3);
});

test('xirr: several deposits, checked by plugging the rate back in', () => {
  const flows = [{ date: '2024-01-01', amount: -1000 }, { date: '2024-07-01', amount: -500 }, { date: '2025-03-01', amount: -250 }, { date: '2026-01-01', amount: 2100 }];
  const r = xirr(flows)!;
  const t0 = new Date(2024, 0, 1).getTime();
  const sum = flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, (new Date(f.date + 'T00:00:00').getTime() - t0) / 86400000 / 365), 0);
  assert.ok(Math.abs(sum) < 1e-4, `${sum}`);
});

test('xirr: a loss is negative, and one-sided flows have no rate', () => {
  near(xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 800 }]), -0.2);
  assert.equal(xirr([{ date: '2025-01-01', amount: -1000 }]), null);
  assert.equal(xirr([]), null);
});

test('a holding bought for 1000 and now worth 1200 a year later earned 20%', () => {
  const p = buildPerformance({ trades: [trade('1', 'AAA', 'buy', 10, 100, '2025-01-01')], holdings: [holding('AAA', 10, 1200)], today: TODAY });
  const h = p.holdings[0];
  assert.equal(h.gain, 200);
  near(h.gainPct, 0.2);
  near(h.xirr, 0.2);
  assert.equal(h.reliable, true);
  near(p.portfolio.xirr, 0.2);
  assert.equal(p.contributions.net, 1000);
  assert.equal(p.contributions.growth, 200);
});

test('a partial sale counts as money back, and a closed position still has a result', () => {
  const trades = [trade('1', 'AAA', 'buy', 10, 100, '2025-01-01'), trade('2', 'AAA', 'sell', 5, 120, '2025-07-01'), trade('3', 'BBB', 'buy', 4, 50, '2025-02-01'), trade('4', 'BBB', 'sell', 4, 75, '2025-09-01')];
  const p = buildPerformance({ trades, holdings: [holding('AAA', 5, 650), holding('BBB', 0, 0)], today: TODAY });
  const a = p.holdings.find(h => h.symbol === 'AAA')!;
  assert.equal(a.proceeds, 600);
  assert.equal(a.gain, 600 + 650 - 1000);
  const b = p.holdings.find(h => h.symbol === 'BBB')!;
  assert.equal(b.open, false);
  assert.equal(b.gain, 100);
  assert.equal(p.portfolio.gain, 250 + 100);
  assert.equal(p.contributions.net, 1200 - 900);
});

test('a short history has a figure but is not called reliable', () => {
  const p = buildPerformance({ trades: [trade('1', 'AAA', 'buy', 10, 100, '2025-12-15')], holdings: [holding('AAA', 10, 1100)], today: TODAY });
  assert.ok(p.holdings[0].xirr !== null);
  assert.equal(p.holdings[0].reliable, false);
});

test('a holding with no live price is left out of the return', () => {
  const p = buildPerformance({
    trades: [trade('1', 'AAA', 'buy', 10, 100, '2025-01-01'), trade('2', 'ZZZ', 'buy', 10, 100, '2025-01-01')],
    holdings: [holding('AAA', 10, 1200), holding('ZZZ', 10, 1000, { priceUnavailable: true })], today: TODAY,
  });
  assert.equal(p.holdings.find(h => h.symbol === 'ZZZ')!.xirr, null);
  assert.equal(p.portfolio.excluded, 1);
  assert.equal(p.portfolio.invested, 1000);
  near(p.portfolio.xirr, 0.2);
});

test('currency conversion uses the rate given', () => {
  const t: InvestmentTransaction = { ...trade('1', 'USA', 'buy', 10, 100, '2025-01-01'), currency: 'USD' };
  const p = buildPerformance({ trades: [t], holdings: [holding('USA', 10, 1000, { currency: 'USD' })], today: TODAY, toEur: (a, c) => (c === 'USD' ? a * 0.5 : a), currencyOf: () => 'USD' });
  assert.equal(p.holdings[0].invested, 500);
  assert.equal(p.holdings[0].gain, 500);
});

test('concentration: shares, effective holdings, level and currencies', () => {
  const even = buildPerformance({ trades: [], holdings: [holding('A', 1, 250), holding('B', 1, 250), holding('C', 1, 250), holding('D', 1, 250)], today: TODAY }).concentration;
  assert.equal(even.level, 'balanced');
  near(even.effectiveHoldings, 4, 1e-9);
  const lopsided = buildPerformance({ trades: [], holdings: [holding('A', 1, 800), holding('B', 1, 100, { currency: 'USD' }), holding('C', 1, 100)], today: TODAY }).concentration;
  assert.equal(lopsided.level, 'very concentrated');
  assert.equal(lopsided.top?.symbol, 'A');
  near(lopsided.top3Share, 1, 1e-9);
  assert.deepEqual(lopsided.currencies.map(c => c.currency), ['EUR', 'USD']);
  near(lopsided.currencies[0].share, 0.9, 1e-9);
  assert.equal(buildPerformance({ trades: [], holdings: [holding('A', 1, 100)], today: TODAY }).concentration.level, 'single');
});
