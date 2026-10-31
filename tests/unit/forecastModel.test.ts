import test from 'node:test';
import assert from 'node:assert/strict';
import type { Account, BillPayment, FinancialGoal, RecurringTransaction } from '../../types';
import { buildOccurrences, iso, makeConverter, moveFuture, moveSeries } from '../../utils/scheduleModel';
import {
  chartSeries, daysBelow, forecastBubbles, horizonSummary, moveSuggestion, rangeEnd, rangeFromDuration, type ForecastDay, type ForecastEvent, drivers, goalMovements, horizonEnd, lowestPoint, lowestPoints, projectBalances, type Assumptions,
} from '../../utils/forecastModel';
import {
  accountCoverage, goalTree, monthlyTargets, moveGoal, planGoal, projectGoal, summaryRings, emptyGoalDraft,
} from '../../utils/goalsModel';

/* Forecast and goals models. */

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day); };
const TODAY = d('2026-10-29');

const accounts: Account[] = [
  { id: 'chk', name: 'Checking', type: 'Checking', balance: 1000, currency: 'EUR' },
  { id: 'sav', name: 'Savings', type: 'Savings', balance: 5000, currency: 'EUR' },
];
const eur = makeConverter('EUR', { EUR: 1, USD: 0.5 });
const series = (over: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 'rt', accountId: 'chk', description: 'Rent', amount: 500, type: 'expense', currency: 'EUR', frequency: 'monthly',
  startDate: '2026-01-01', nextDueDate: '2026-11-01', weekendAdjustment: 'on', ...over,
});
const goal = (over: Partial<FinancialGoal>): FinancialGoal => ({
  id: 'g', name: 'Car', type: 'one-time', goalCategory: 'savings', transactionType: 'expense', amount: 1200, currentAmount: 0, currency: 'EUR', ...over,
});

const project = (opts: { recurring?: RecurringTransaction[]; bills?: BillPayment[]; goals?: FinancialGoal[]; active?: string[]; end?: string; selected?: string[]; assumptions?: Assumptions } = {}) => {
  const end = d(opts.end ?? '2027-03-31');
  const occurrences = buildOccurrences({
    recurring: opts.recurring ?? [], overrides: [], bills: opts.bills ?? [], accounts, transactions: [], from: TODAY, to: end, today: TODAY, includeSynthetic: false,
  });
  const selected = accounts.filter(a => (opts.selected ?? ['chk']).includes(a.id));
  return projectBalances({
    accounts: selected, startBalances: { chk: 1000, sav: 5000 }, occurrences, goals: opts.goals ?? [], activeGoalIds: opts.active ?? ['g'],
    today: TODAY, end, convert: eur, assumptions: opts.assumptions,
  });
};
const on = (p: ReturnType<typeof project>, date: string) => p.days.find(x => x.date === date)!.total;

test('the projection starts from today\'s balances and applies payments on their day', () => {
  const p = project({ recurring: [series({})] });
  assert.equal(p.start, 1000);
  assert.equal(on(p, '2026-10-31'), 1000);
  assert.equal(on(p, '2026-11-01'), 500);
  assert.equal(on(p, '2026-12-01'), 0);
});

test('an overdue unpaid bill lands on today (E-02)', () => {
  const bills: BillPayment[] = [{ id: 'b', description: 'Tax', amount: -200, type: 'payment', currency: 'EUR', dueDate: '2026-09-01', status: 'unpaid', accountId: 'chk' }];
  const p = project({ bills });
  assert.equal(p.days[0].total, 800);
  assert.equal(p.days[0].events[0].overdue, true);
});

test('a one-time goal with contributions is not counted twice (E-03)', () => {
  const g = goal({ date: '2027-02-15', monthlyContribution: 300, dueDateOfMonth: 1 });
  const moves = goalMovements(g, TODAY, d('2027-03-31'));
  assert.deepEqual(moves.map(m => `${m.date}:${m.amount}:${m.kind}`), ['2026-11-01:300:contribution', '2026-12-01:300:contribution', '2027-01-01:300:contribution', '2027-02-01:300:contribution']);
  const p = project({ goals: [g] });
  assert.equal(on(p, '2027-03-31'), 1000 - 1200);
});

test('a goal\'s remainder lands on its date when contributions do not reach it', () => {
  const moves = goalMovements(goal({ date: '2026-12-15', monthlyContribution: 300, dueDateOfMonth: 1 }), TODAY, d('2027-03-31'));
  assert.deepEqual(moves.map(m => `${m.date}:${m.amount}:${m.kind}`), ['2026-11-01:300:contribution', '2026-12-01:300:contribution', '2026-12-15:600:target']);
});

test('weekly goals contribute weekly (F-10)', () => {
  const moves = goalMovements(goal({ type: 'recurring', frequency: 'weekly', monthlyContribution: 50, amount: 200, startDate: '2026-11-02' }), TODAY, d('2027-03-31'));
  assert.deepEqual(moves.map(m => m.date), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
});

test('saving into the same account changes nothing; into another selected account it moves (F-08)', () => {
  const same = project({ goals: [goal({ date: '2026-12-01', paymentAccountId: 'chk', destinationAccountId: 'chk' })], selected: ['chk'] });
  assert.equal(on(same, '2027-01-01'), 1000);
  const moved = project({ goals: [goal({ date: '2026-12-01', paymentAccountId: 'chk', destinationAccountId: 'sav' })], selected: ['chk', 'sav'] });
  assert.equal(on(moved, '2027-01-01'), 6000 + 0); // savings APY not set: the money only moves
  assert.equal(moved.days.find(x => x.date === '2026-12-01')!.byAccount.sav, 6200);
});

test('goals switched off are not projected', () => {
  const p = project({ goals: [goal({ date: '2026-12-01' })], active: [] });
  assert.equal(on(p, '2027-01-01'), 1000);
});

test('each period shows its real minimum (E-05)', () => {
  const p = project({ recurring: [series({ amount: 100 })], end: '2027-12-31' });
  const lows = lowestPoints(p.days, TODAY);
  assert.equal(lows[0].label, 'This month');
  assert.equal(lows[0].value, 1000);
  assert.equal(lows[1].value, 700); // Nov–Jan: after three payments
  assert.equal(lows[3].value, 1000 - 1200); // Nov 2026 – Oct 2027: twelve payments
  assert.equal(lowestPoint(p.days)?.value, 1000 - 1400);
});

test('scenario: +10 % income and inflation', () => {
  const base = project({ recurring: [series({ type: 'income', amount: 1000 })] });
  const up = project({ recurring: [series({ type: 'income', amount: 1000 })], assumptions: { incomeChange: 10, marketReturn: 0, inflation: 0 } });
  assert.equal(on(up, '2026-11-01') - on(base, '2026-11-01'), 100);
  const inflated = project({ recurring: [series({ amount: 1000, nextDueDate: '2027-10-29' })], end: '2027-10-31', assumptions: { incomeChange: 0, marketReturn: 0, inflation: 10 } });
  assert.ok(Math.abs(on(inflated, '2027-10-30') - (1000 - 1100)) < 1);
});

test('horizons', () => {
  assert.equal(horizonEnd('2Y', TODAY).getFullYear(), 2028);
  assert.equal(horizonEnd('EOY', TODAY).getMonth(), 11);
  assert.equal(horizonEnd('3M', d('2026-11-30')).getDate(), 28); // 30 Nov + 3 months → 28 Feb
});

test('history and projection meet at today', () => {
  const p = project({ recurring: [series({})] });
  const history = [{ date: '2026-10-27', value: 900 }, { date: '2026-10-28', value: 950 }, { date: '2026-10-29', value: 1000 }];
  const { points, todayIndex } = chartSeries(history, p);
  assert.equal(todayIndex, 2);
  assert.equal(points[todayIndex].iso, '2026-10-29');
  assert.equal(points[todayIndex].balance, 1000);
});

test('drivers group a series over the horizon; days below a cushion', () => {
  const p = project({ recurring: [series({}), series({ id: 'pay', type: 'income', amount: 2000, description: 'Salary', nextDueDate: '2026-11-25' })] });
  const list = drivers(p.events);
  assert.equal(list[0].label, 'Salary');
  assert.equal(list[0].total, 10000);
  assert.equal(list[1].total, -2500);
  assert.equal(daysBelow(p.days, 600).first, '2026-11-01');
});

test('a goal is projected from its own saved amount, not an account balance (F-05)', () => {
  const g = goal({ amount: 1000, currentAmount: 400, monthlyContribution: 200, dueDateOfMonth: 1, date: '2027-02-01', paymentAccountId: 'sav' });
  const p = projectGoal(g, TODAY);
  assert.equal(p.projectedDate, '2027-01-01');
  assert.equal(p.status, 'on-track');
  assert.equal(projectGoal({ ...g, date: '2026-12-01' }, TODAY).status, 'at-risk');
  assert.equal(projectGoal({ ...g, monthlyContribution: 0 }, TODAY).status, 'no-plan');
  assert.equal(projectGoal({ ...g, currentAmount: 1000 }, TODAY).status, 'done');
});

test('rings convert and never mix kinds (F-06, F-07)', () => {
  const rings = summaryRings([
    goal({ id: 'a', amount: 1000, currentAmount: 500 }),
    goal({ id: 'b', amount: 200, currentAmount: 100, currency: 'USD' }),
    goal({ id: 'c', goalCategory: 'income', transactionType: 'income', amount: 10000, currentAmount: 10000 }),
  ], eur);
  assert.equal(rings[0].target, 1100);
  assert.equal(rings[0].saved, 550);
  assert.equal(rings[2].pct, 100);
});

test('an account that cannot cover its savings goals is flagged', () => {
  const p = project({ selected: ['sav'] });
  const cover = accountCoverage([goal({ amount: 8000, paymentAccountId: 'sav', date: '2027-01-01' })], p.days, { sav: 5000 }, eur);
  assert.equal(cover.length, 1);
  assert.equal(cover[0].projected, 5000);
});

test('monthly targets by month and by account', () => {
  const goals = [goal({ id: 'g', date: '2026-12-15', paymentAccountId: 'chk' }), goal({ id: 'h', type: 'recurring', monthlyContribution: 100, frequency: 'weekly', paymentAccountId: 'sav', amount: 5000 })];
  const byMonth = monthlyTargets(goals, ['g', 'h'], id => (id === 'chk' ? 'Checking' : 'Savings'), TODAY, eur, 'month');
  assert.equal(byMonth.find(t => t.key === '2026-12')?.savings, 1200 + 433.33);
  const byAccount = monthlyTargets(goals, ['g', 'h'], id => (id === 'chk' ? 'Checking' : 'Savings'), TODAY, eur, 'account');
  assert.equal(byAccount.find(t => t.label === 'Checking')?.savings, 1200);
});

test('goal order moves and the goal form', () => {
  const tree = goalTree([goal({ id: 'a' }), goal({ id: 'b' }), goal({ id: 'c', parentId: 'a' })], ['b', 'a']);
  assert.deepEqual(tree.map(n => n.goal.id), ['b', 'a']);
  assert.equal(tree[1].children.length, 1);
  assert.deepEqual(moveGoal(tree, 'a', -1), ['a', 'b']);
  const draft = emptyGoalDraft('EUR', TODAY);
  assert.equal(planGoal(draft).ok, false);
  const ok = planGoal({ ...draft, name: 'Trip', amount: '1.500,00' });
  assert.ok(ok.ok && ok.goal.amount === 1500 && ok.goal.type === 'one-time');
  assert.equal(planGoal({ ...draft, name: 'Pension', amount: '10', timing: 'ongoing' }).ok, false);
  const bucket = planGoal({ ...draft, name: 'Holidays', category: 'bucket' });
  assert.ok(bucket.ok && bucket.goal.isBucket && bucket.goal.amount === 0);
});

/* The Forecast page. */

const event = (over: Partial<ForecastEvent>): ForecastEvent => ({
  key: 'k', date: '2026-11-02', dueDate: '2026-11-02', kind: 'recurring', seriesKey: 's', description: 'Rent', amount: -500,
  legs: [], native: { amount: -500, currency: 'EUR' }, overdue: false, balanceAfter: 0, ...over,
});
const days = (totals: [string, number][]): ForecastDay[] => totals.map(([date, total]) => ({ date, total, byAccount: {}, net: 0, events: [] }));

test('ranges cover days and months, and the saved period maps onto them', () => {
  assert.equal(iso(rangeEnd('30', TODAY)), '2026-11-28');
  assert.equal(iso(rangeEnd('6M', TODAY)), '2027-04-29');
  assert.equal(iso(rangeEnd('EOY', TODAY)), '2026-12-31');
  assert.equal(rangeFromDuration('3M'), '90');
  assert.equal(rangeFromDuration('EOY'), 'EOY');
  assert.equal(rangeFromDuration(undefined), '1Y');
});

test('bubbles sit in lanes, and only bills and recurring items can move', () => {
  const bubbles = forecastBubbles([
    event({ key: 'a' }),
    event({ key: 'b', amount: 800 }),
    event({ key: 'c', kind: 'loan' }),
    event({ key: 'd', amount: 0 }),
    event({ key: 'e', occurrence: { isReadOnly: true } as ForecastEvent['occurrence'] }),
  ], false, TODAY);
  assert.deepEqual(bubbles.map(b => [b.key, b.lane, b.isMovable]), [['a', 'out', true], ['b', 'in', true], ['c', 'fixed', false], ['e', 'out', false]]);
});

test('long ranges group bubbles by lane and week, and those cannot be dragged', () => {
  const bubbles = forecastBubbles([event({ key: 'a', date: '2026-11-01' }), event({ key: 'b', date: '2026-11-03', amount: -100 }), event({ key: 'c', date: '2026-11-20' })], true, TODAY);
  assert.equal(bubbles.length, 2);
  assert.equal(bubbles[0].amount, 600);
  assert.equal(bubbles[0].label, '2 items');
  assert.equal(bubbles[0].isMovable, false);
  assert.equal(bubbles[1].label, 'Rent');
});

test('the summary adds what comes in and goes out, and counts days under the buffer', () => {
  const projection = { start: 100, startByAccount: {}, days: days([['2026-10-29', 100], ['2026-10-30', 40], ['2026-10-31', 90]]), events: [event({ amount: 50 }), event({ amount: -60 })] };
  const summary = horizonSummary(projection, 50);
  assert.equal(summary.today, 100);
  assert.equal(summary.expectedIn, 50);
  assert.equal(summary.goingOut, -60);
  assert.equal(summary.end, 90);
  assert.deepEqual(summary.lowest, { value: 40, date: '2026-10-30' });
  assert.equal(summary.below.count, 1);
});

test('a dip under the buffer suggests moving the largest movable payment past the next income', () => {
  const rent = event({ key: 'rent', date: '2026-11-01', amount: -500 });
  const loan = event({ key: 'loan', date: '2026-11-01', amount: -900, kind: 'loan' });
  const pay = event({ key: 'pay', date: '2026-11-05', amount: 2000, kind: 'recurring' });
  const projection = { start: 100, startByAccount: {}, days: days([['2026-11-01', -10], ['2026-11-05', 1990]]), events: [loan, rent, pay] };
  assert.deepEqual(moveSuggestion(projection, 0), { event: rent, toDate: '2026-11-06' });
  assert.equal(moveSuggestion(projection, -100), null);
});

test('moving a series shifts it, and moving the future splits it', () => {
  const rt = series({ dueDateOfMonth: 1 });
  const moved = moveSeries(rt, '2026-11-01', '2026-11-04');
  assert.equal(moved.nextDueDate, '2026-11-04');
  assert.equal(moved.dueDateOfMonth, 4);
  const { ended, started } = moveFuture(rt, '2026-12-01', '2026-12-04');
  assert.equal(ended.endDate, '2026-11-30');
  assert.equal(started.startDate, '2026-12-04');
  assert.equal(started.nextDueDate, '2026-12-04');
  assert.equal('id' in started, false);
});
