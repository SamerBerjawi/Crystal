import test from 'node:test';
import assert from 'node:assert/strict';
import { cumulativeSpend, dailyBalanceHistory, interestAlong, monthlyEquivalent, monthlyFlows, payoffPath, recentStatementPeriods, rentRoll, splitByLabel, statementPeriodFor, toggleVacantMonth, valueTrendPerYear } from '../../utils/accountPagesModel';

const today = new Date(2026, 10, 6); // 6 Nov 2026

test('recurring amounts become monthly figures', () => {
  assert.equal(monthlyEquivalent(1200, 'yearly'), 100);
  assert.equal(monthlyEquivalent(100, 'weekly'), 433.33);
  assert.equal(monthlyEquivalent(undefined), 0);
});

test('daily history walks back from today and ignores future amounts', () => {
  const points = dailyBalanceHistory(100, [{ date: '2026-11-06', amount: 20 }, { date: '2026-11-05', amount: -50 }, { date: '2026-12-01', amount: 999 }], 3, today);
  assert.deepEqual(points.map(p => p.value), [130, 80, 100]);
});

test('monthly flows split in and out per month', () => {
  const flows = monthlyFlows([{ date: '2026-11-02', amount: 500 }, { date: '2026-11-03', amount: -120 }, { date: '2026-10-10', amount: -30 }], 2, today);
  assert.deepEqual(flows.map(f => [f.month, f.in, f.out, f.net]), [['2026-10', 0, 30, -30], ['2026-11', 500, 120, 380]]);
});

test('labels beyond the limit fold into Other', () => {
  const split = splitByLabel([{ label: 'a', amount: -5 }, { label: 'b', amount: -4 }, { label: 'c', amount: -3 }, { label: 'a', amount: -1 }], 2);
  assert.deepEqual(split, [{ label: 'a', value: 6 }, { label: 'Other', value: 7 }]);
});

test('a statement period runs from the opening day to the day before the next, due after it closes', () => {
  const period = statementPeriodFor(today, 15, 10);
  assert.equal(period.start.toDateString(), new Date(2026, 9, 15).toDateString());
  assert.equal(period.end.toDateString(), new Date(2026, 10, 14).toDateString());
  assert.equal(period.due.toDateString(), new Date(2026, 11, 10).toDateString());
  const periods = recentStatementPeriods(15, 10, 3, today);
  assert.equal(periods[2].start.toDateString(), new Date(2026, 7, 15).toDateString());
});

test('cumulative spend counts only charges, up to a day', () => {
  const pace = cumulativeSpend([{ date: '2026-11-01', amount: -10 }, { date: '2026-11-02', amount: 50 }, { date: '2026-11-03', amount: -5 }], { start: new Date(2026, 10, 1), end: new Date(2026, 10, 30) }, new Date(2026, 10, 3));
  assert.deepEqual(pace, [10, 10, 15]);
});

test('paying extra ends sooner and costs less interest', () => {
  const plain = payoffPath(10000, 5, 300);
  const extra = payoffPath(10000, 5, 300, 100);
  assert.ok(extra.length < plain.length);
  assert.ok(interestAlong(10000, 5, 300, 100) < interestAlong(10000, 5, 300));
  assert.equal(payoffPath(10000, 50, 10).length, 1); // a payment below the interest never pays off
});

test('rent roll expects nothing in an empty month and counts occupancy', () => {
  const roll = rentRoll(
    { rentalIncomeAmount: 1000, rentalIncomeFrequency: 'monthly', vacantMonths: ['2026-10'], purchaseDate: '2026-09-01' },
    [{ date: '2026-09-03', amount: 1000 }, { date: '2026-11-02', amount: 950 }],
    12,
    today,
  );
  assert.deepEqual(roll.months.map(m => [m.month, m.expected, m.received, m.vacant]), [['2026-09', 1000, 1000, false], ['2026-10', 0, 0, true], ['2026-11', 1000, 950, false]]);
  assert.equal(roll.occupancy, 66.7);
  assert.equal(roll.received, 1950);
  assert.equal(roll.expected, 2000);
});

test('toggling a month adds or removes it, sorted', () => {
  assert.deepEqual(toggleVacantMonth(['2026-03'], '2026-01'), ['2026-01', '2026-03']);
  assert.deepEqual(toggleVacantMonth(['2026-01', '2026-03'], '2026-01'), ['2026-03']);
});

test('value trend is the yearly slope of the valuations', () => {
  assert.equal(valueTrendPerYear([{ date: '2024-01-01', price: 20000 }]), null);
  const slope = valueTrendPerYear([{ date: '2024-01-01', price: 20000 }, { date: '2026-01-01', price: 16000 }])!;
  assert.ok(Math.abs(slope + 2000) < 5);
});

import { computeAmortizationTrajectory, hubGroupOf, moneyMap, netWorthHistory, valuedAssetAt } from '../../utils/accountPagesModel';
import type { Account, ScheduledPayment, Transaction } from '../../types';

const a = (id: string, type: Account['type'], p: Partial<Account> = {}): Account => ({ id, name: id, type, balance: 0, currency: 'EUR', ...p });
const t = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), accountId: 'main', date: '2026-10-10', description: '', amount: 0, category: '', type: 'expense', currency: 'EUR', ...p });

test('accounts fall into hub groups', () => {
  assert.equal(hubGroupOf(a('x', 'Other Assets', { otherSubType: 'Cash' })), 'Cash');
  assert.equal(hubGroupOf(a('x', 'Lending')), 'Other assets');
  assert.equal(hubGroupOf(a('x', 'Other Liabilities')), 'Other debts');
});

test('a valued asset is worth nothing before it was bought, then its price, then its valuations', () => {
  const home = a('home', 'Property', { balance: 320000, purchaseDate: '2025-01-01', purchasePrice: 300000, priceHistory: [{ date: '2026-01-01', price: 310000 }] });
  assert.equal(valuedAssetAt(home, '2024-06-01'), 0);
  assert.equal(valuedAssetAt(home, '2025-06-01'), 300000);
  assert.equal(valuedAssetAt(home, '2026-06-01'), 310000);
});

test('net worth history splits assets and debts and ends at today', () => {
  const rows = netWorthHistory(
    [
      { account: a('main', 'Checking'), todayBalance: 1000, amounts: [{ date: '2026-11-02', amount: 200 }] },
      { account: a('card', 'Credit Card'), todayBalance: -300, amounts: [] },
    ],
    2,
    value => value,
    today,
  );
  assert.deepEqual(rows.map(r => [r.month, r.assets, r.debts, r.net]), [['2026-10', 800, 300, 500], ['2026-11', 1000, 300, 700]]);
});

test('the money map runs income to cash, cash to the rest, and everything to spending', () => {
  const accounts = [a('main', 'Checking'), a('save', 'Savings'), a('card', 'Credit Card')];
  const txs = [
    t({ accountId: 'main', amount: 3000, type: 'income' }),
    t({ accountId: 'main', amount: -500, transferId: 'x1' }), t({ accountId: 'save', amount: 500, type: 'income', transferId: 'x1' }),
    t({ accountId: 'save', amount: -100, transferId: 'x2' }), t({ accountId: 'main', amount: 100, type: 'income', transferId: 'x2' }),
    t({ accountId: 'card', amount: -80 }),
    t({ accountId: 'main', amount: -40, date: '2020-01-01' }),
  ];
  const map = moneyMap(accounts, txs, '2026-01-01', tx => tx.amount, () => 'var(--chart-1)');
  const named = map.links.map(l => [map.nodes[l.source].name, map.nodes[l.target].name, l.value]);
  assert.deepEqual(named, [['Income', 'main', 3000], ['main', 'save', 400], ['card', 'Spending', 80]]);
  assert.equal(map.total, 3000);
});

test('computeAmortizationTrajectory calculates cumulative P&I, overpayment savings, and equity milestones', () => {
  // 12-month stylized mortgage schedule where payment #4 flips principal >= interest and LTV drops below 80%
  const principal = 100000;
  const assetValue = 110000; // Initial LTV 90.9% (> 80%)
  const schedule: ScheduledPayment[] = [
    { paymentNumber: 1, date: '2026-01-01', totalPayment: 1000, principal: 400, interest: 600, outstandingBalance: 99600, status: 'Paid' },
    { paymentNumber: 2, date: '2026-02-01', totalPayment: 1000, principal: 450, interest: 550, outstandingBalance: 92000, status: 'Paid' },
    { paymentNumber: 3, date: '2026-03-01', totalPayment: 1000, principal: 510, interest: 490, outstandingBalance: 87500, status: 'Upcoming' }, // <= 80% of 110k (88k)
    { paymentNumber: 4, date: '2026-04-01', totalPayment: 1000, principal: 40000, interest: 300, outstandingBalance: 47500, status: 'Upcoming' }, // <= 50% principal
    { paymentNumber: 5, date: '2026-05-01', totalPayment: 47600, principal: 47500, interest: 100, outstandingBalance: 0, status: 'Upcoming' },
  ];

  const traj = computeAmortizationTrajectory({
    schedule,
    principal,
    rate: 5,
    monthlyPayment: 1000,
    loanStartDate: '2025-12-01',
    extraMonthly: 500,
    assetValue,
    today: new Date(2026, 1, 15),
  });

  assert.equal(traj.points.length, 6);
  assert.equal(traj.points[0].balance, 100000);
  assert.equal(traj.points[2].cumulativePrincipal, 850);
  assert.equal(traj.points[2].cumulativeInterest, 1150);
  assert.equal(traj.todayIndex, 2);
  assert.ok(traj.points[2].fasterBalance !== undefined);

  const ids = traj.milestones.map(m => m.id);
  assert.ok(ids.includes('tipping_point'));
  assert.ok(ids.includes('ltv_80'));
  assert.ok(ids.includes('halfway'));
  assert.ok(ids.includes('payoff'));
  assert.equal(traj.milestones.find(m => m.id === 'tipping_point')?.paymentNumber, 3);
  assert.equal(traj.milestones.find(m => m.id === 'ltv_80')?.paymentNumber, 3);
  assert.equal(traj.milestones.find(m => m.id === 'halfway')?.paymentNumber, 4);
  assert.equal(traj.years.length, 1);
  assert.equal(traj.years[0].cumulativePrincipal, traj.totalPrincipal);
});
