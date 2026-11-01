import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FinancialGoal } from '../../types';
import { completionChanges, goalCardView, monthlyNeed, planLine } from '../../utils/goalsModel';

const today = new Date(2026, 0, 15);
const goal = (over: Partial<FinancialGoal>): FinancialGoal => ({
  id: 'g', name: 'Goal', type: 'one-time', goalCategory: 'savings', transactionType: 'expense', amount: 1000, currentAmount: 0, currency: 'EUR', ...over,
});
const line = (g: FinancialGoal) => planLine(g, goalCardView(g, [], today), today);

test('a goal with nothing saved is not reached, whatever an account holds', () => {
  const view = goalCardView(goal({ paymentAccountId: 'rich', date: '2026-06-01' }), [], today);
  assert.equal(view.status, 'no-plan');
  assert.equal(view.done, false);
});

test('a bucket adds up its items, with their latest date and worst status', () => {
  const items = [
    goal({ id: 'a', amount: 100, currentAmount: 100, date: '2026-02-01' }),
    goal({ id: 'b', amount: 200, currentAmount: 50, date: '2026-05-01', monthlyContribution: 10 }),
  ];
  const view = goalCardView(goal({ isBucket: true, amount: 0 }), items, today);
  assert.equal(view.target, 300);
  assert.equal(view.saved, 150);
  assert.equal(view.pct, 50);
  assert.equal(view.date, '2026-05-01');
  assert.equal(view.status, 'off-track');
  assert.equal(view.done, false);
});

test('an empty bucket has no plan, and a finished one is done', () => {
  assert.equal(goalCardView(goal({ isBucket: true, amount: 0 }), [], today).status, 'no-plan');
  assert.equal(goalCardView(goal({ isBucket: true, amount: 0 }), [goal({ currentAmount: 1000 })], today).done, true);
});

test('the plan line covers each case', () => {
  assert.equal(line(goal({ currentAmount: 1000 })).kind, 'done');
  assert.equal(line(goal({ date: '2025-11-01' })).kind, 'late');
  const none = line(goal({ date: '2026-11-15' }));
  assert.equal(none.kind, 'no-plan');
  assert.ok(none.kind === 'no-plan' && none.need && none.need > 90 && none.need < 110);
  assert.deepEqual(line(goal({ date: '2026-12-31', monthlyContribution: 200 })), { kind: 'on-pace', monthly: 200, date: '2026-12-31' });
  assert.equal(line(goal({ date: '2026-03-01', monthlyContribution: 50 })).kind, 'short');
  assert.equal(line(goal({ type: 'recurring', frequency: 'monthly', monthlyContribution: 50 })).kind, 'ongoing');
});

test('a recurring goal with an end date works out what it really needs', () => {
  const short = line(goal({ type: 'recurring', frequency: 'monthly', endDate: '2026-04-15', monthlyContribution: 50 }));
  assert.equal(short.kind, 'short');
  assert.ok(short.kind === 'short' && short.need > 300 && short.need < 350);
});

test('monthly need adds contributions and needed amounts, and skips buckets, finished and switched-off goals', () => {
  const goals = [
    goal({ type: 'recurring', frequency: 'yearly', monthlyContribution: 120 }),
    goal({ monthlyContribution: 25 }),
    goal({ isBucket: true }),
    goal({ disabled: true, monthlyContribution: 50 }),
    goal({ completed: true, monthlyContribution: 50 }),
  ];
  assert.equal(monthlyNeed(goals, today), 35);
});

test('ticking a bucket ticks its items, and the last item ticks its bucket', () => {
  const bucket = goal({ id: 'b', isBucket: true, amount: 0 });
  const first = goal({ id: 'x', parentId: 'b' });
  const second = goal({ id: 'y', parentId: 'b', completed: true });
  assert.deepEqual(completionChanges(bucket, [bucket, first, second]).map(item => [item.id, item.completed]), [['b', true], ['x', true], ['y', true]]);
  assert.deepEqual(completionChanges(first, [bucket, first, second]).map(item => [item.id, item.completed]), [['x', true], ['b', true]]);
  assert.deepEqual(completionChanges(second, [bucket, first, second]).map(item => [item.id, item.completed]), [['y', false], ['b', false]]);
});
