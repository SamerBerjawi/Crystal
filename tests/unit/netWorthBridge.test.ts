import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeBars, bridgeHeadline, buildNetWorthBridge } from '../../utils/netWorthBridge';
import { setMainCurrency } from '../../utils';
import type { Transaction } from '../../types';

setMainCurrency('EUR');
const TODAY = new Date(2026, 10, 12);
const tx = (id: string, date: string, type: 'income' | 'expense', amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, accountId: 'a', date, description: id, amount: type === 'expense' ? -amount : amount, category: 'Food', type, currency: 'EUR', ...extra,
});
const base = { selectedAccountIds: ['a'], today: TODAY, netWorth: 10000 };

test('start and end add up to the steps', () => {
  const rows = [tx('1', '2026-11-02', 'income', 3000), tx('2', '2026-11-05', 'expense', 400), tx('3', '2026-10-20', 'expense', 100)];
  const b = buildNetWorthBridge({ ...base, transactions: rows, start: new Date(2026, 10, 1), end: TODAY });
  assert.equal(b.endValue, 10000);
  assert.equal(b.change, 2600);
  assert.equal(b.startValue, 7400);
  assert.equal(b.steps.find(s => s.kind === 'income')?.amount, 3000);
  assert.equal(b.steps.find(s => s.kind === 'spending')?.amount, -400);
});

test('a period in the past ends at the net worth of that day', () => {
  const rows = [tx('1', '2026-10-10', 'income', 500), tx('2', '2026-11-05', 'expense', 400)];
  const b = buildNetWorthBridge({ ...base, transactions: rows, start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) });
  assert.equal(b.endValue, 10400);
  assert.equal(b.startValue, 9900);
});

test('future transactions do not count', () => {
  const rows = [tx('1', '2026-11-20', 'expense', 700), tx('2', '2026-11-03', 'income', 100)];
  const b = buildNetWorthBridge({ ...base, transactions: rows, start: new Date(2026, 10, 1), end: new Date(2026, 10, 30) });
  assert.equal(b.end, '2026-11-12');
  assert.equal(b.endValue, 10700);
  assert.equal(b.startValue, 10600);
});

test('transfers inside the selection cancel, outside ones show as a step', () => {
  const rows = [
    tx('1', '2026-11-02', 'expense', 200, { transferId: 't1' }),
    tx('2', '2026-11-02', 'income', 200, { accountId: 'b', transferId: 't1' }),
    tx('3', '2026-11-03', 'expense', 300, { transferId: 't2' }),
    tx('4', '2026-11-03', 'income', 300, { accountId: 'x', transferId: 't2' }),
  ];
  const b = buildNetWorthBridge({ ...base, selectedAccountIds: ['a', 'b'], transactions: rows, start: new Date(2026, 10, 1), end: TODAY });
  const t = b.steps.find(s => s.kind === 'transfers');
  assert.equal(t?.amount, -300);
  assert.equal(t?.count, 1);
});

test('market gains and corrections get their own steps', () => {
  const rows = [tx('1', '2026-11-02', 'income', 250, { isMarketAdjustment: true }), tx('2', '2026-11-03', 'expense', 50, { isBalanceAdjustment: true })];
  const b = buildNetWorthBridge({ ...base, transactions: rows, start: new Date(2026, 10, 1), end: TODAY });
  assert.equal(b.steps.find(s => s.kind === 'market')?.amount, 250);
  assert.equal(b.steps.find(s => s.kind === 'corrections')?.amount, -50);
  assert.equal(b.steps.find(s => s.kind === 'income')?.amount, 0);
});

test('details keep the biggest and fold the rest', () => {
  const cats = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const rows = cats.map((c, i) => tx(c, '2026-11-02', 'expense', (i + 1) * 10, { category: c }));
  const b = buildNetWorthBridge({ ...base, transactions: rows, start: new Date(2026, 10, 1), end: TODAY });
  const spend = b.steps.find(s => s.kind === 'spending')!;
  assert.equal(spend.details.length, 5);
  assert.equal(spend.details[0].label, 'G');
  assert.equal(spend.details[4].label, 'Everything else');
  assert.equal(spend.details.reduce((s, d) => s + d.amount, 0), spend.amount);
});

test('headline names the biggest mover, bars chain', () => {
  const rows = [tx('1', '2026-11-02', 'income', 3000), tx('2', '2026-11-05', 'expense', 400)];
  const b = buildNetWorthBridge({ ...base, transactions: rows, start: new Date(2026, 10, 1), end: TODAY });
  assert.deepEqual(bridgeHeadline(b).direction, 'up');
  assert.equal(bridgeHeadline(b).driver?.kind, 'income');
  const { bars } = bridgeBars(b);
  assert.equal(bars[0].from, b.startValue);
  assert.equal(bars[bars.length - 1].to, b.endValue);
});
