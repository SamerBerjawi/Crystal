import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSpendTrends } from '../../utils/merchantTrends';
import { normalizeMerchantKey } from '../../utils/brandfetch';
import { convertToEur } from '../../utils';

const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

// The previous implementation: one scan of every transaction per entity.
const naive = (entities: any[], txs: any[], accounts: any[], showAdj: boolean) => {
  const out: Record<string, number[]> = {};
  for (const e of entities) {
    const sums = Array(6).fill(0);
    if (e.type === 'Merchant') {
      txs.forEach(t => {
        if (!showAdj && t.isBalanceAdjustment) return;
        if (!t.merchant) return;
        if (normalizeMerchantKey(t.merchant) === e.logoKey) {
          const i = months.indexOf(t.date.slice(0, 7));
          if (i !== -1) sums[i] += Math.abs(convertToEur(t.amount, t.currency));
        }
      });
    } else {
      const ids = new Set(accounts.filter(a => a.financialInstitution && normalizeMerchantKey(a.financialInstitution) === e.logoKey).map(a => a.id));
      txs.forEach(t => {
        if (!showAdj && t.isBalanceAdjustment) return;
        if (ids.has(t.accountId)) {
          const i = months.indexOf(t.date.slice(0, 7));
          if (i !== -1) sums[i] += Math.abs(convertToEur(t.amount, t.currency));
        }
      });
    }
    out[e.id] = sums;
  }
  return out;
};

test('single-pass trends equal the per-entity scan on a mixed ledger', () => {
  const accounts: any[] = [
    { id: 'a1', financialInstitution: 'Crystal Bank' }, { id: 'a2', financialInstitution: 'crystal bank ' }, { id: 'a3' },
  ];
  const txs: any[] = [];
  for (let i = 0; i < 400; i++) {
    txs.push({
      id: 't' + i, accountId: ['a1', 'a2', 'a3'][i % 3], date: `2026-0${(i % 7) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
      amount: ((i * 37) % 200) - 100, currency: i % 5 === 0 ? 'USD' : 'EUR', merchant: i % 4 === 0 ? undefined : `Shop ${i % 6}`,
      isBalanceAdjustment: i % 11 === 0,
    });
  }
  const entities = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'm' + i, type: 'Merchant', logoKey: normalizeMerchantKey(`Shop ${i}`)! })),
    { id: 'inst', type: 'Institution', logoKey: normalizeMerchantKey('Crystal Bank')! },
    { id: 'none', type: 'Merchant', logoKey: 'nobody' },
  ];
  for (const showAdj of [false, true]) {
    const fast = computeSpendTrends(entities, txs, accounts, months, showAdj);
    const slow = naive(entities, txs, accounts, showAdj);
    assert.deepEqual(Object.keys(fast), Object.keys(slow));
    for (const id of Object.keys(slow)) {
      // Summation order differs between the two (per-account totals vs ledger order), so compare to the cent.
      fast[id].forEach((v, i) => assert.ok(Math.abs(v - slow[id][i]) < 1e-6, `${id}[${i}] ${v} vs ${slow[id][i]}`));
    }
    assert.ok(Object.values(slow).some(a => a.some(v => v > 0)), 'fixture must produce non-zero data');
  }
});

test('10,000 transactions x 600 merchants completes quickly', () => {
  const txs: any[] = Array.from({ length: 10_000 }, (_, i) => ({ id: 't' + i, accountId: 'a', date: '2026-03-10', amount: -5, currency: 'EUR', merchant: 'M' + (i % 600) }));
  const entities = Array.from({ length: 600 }, (_, i) => ({ id: 'e' + i, type: 'Merchant', logoKey: normalizeMerchantKey('M' + i)! }));
  const t0 = performance.now();
  const r = computeSpendTrends(entities, txs, [], months, true);
  const ms = performance.now() - t0;
  assert.ok(r.e0[2] > 0);
  assert.ok(ms < 500, `took ${ms.toFixed(0)} ms`);
});
