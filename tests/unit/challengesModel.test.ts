import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Budget, FinancialGoal, Prediction, Transaction, UserStats } from '../../types';
import { budgetMastery, challengeBadges, challengeMetrics, debtsAndGoals, healthScore, personalRecords, predictionState, predictionValue, resolvePredictions, sprintProgress, updateActivityStreak, type ChallengeMetrics } from '../../utils/challengesModel';

const account = (extra: Partial<Account>) => ({ id: 'a', name: 'Main', type: 'Checking', balance: 1000, currency: 'EUR', ...extra }) as Account;
const tx = (date: string, amount: number, category = 'Restaurants', extra: Partial<Transaction> = {}) => ({ id: `${date}${category}${amount}`, date, amount, currency: 'EUR', category, description: 'x', type: amount < 0 ? 'expense' : 'income', accountId: 'a', ...extra }) as Transaction;
const metrics = (extra: Partial<ChallengeMetrics>) => ({ totalDebt: 0, netWorth: 0, creditUtilization: 0, savingsRate: 0, budgetVariance: 1, spendingByCategory: {}, liquidityRatio: 0, totalInvestments: 0, accountTypes: 0, ...extra });

test('the health score weighs four factors up to 100', () => {
  const best = healthScore(metrics({ savingsRate: 0.5, liquidityRatio: 6, accountTypes: 5 }));
  assert.equal(best.score, 100);
  assert.equal(best.rank, 'Wealth Tycoon');
  const low = healthScore(metrics({ savingsRate: 0, liquidityRatio: 1, totalDebt: 30000, accountTypes: 1 }));
  assert.equal(low.score, 15);
  assert.equal(low.rank, 'Financial Novice');
});

test('metrics read this month and count subcategories under their parent', () => {
  const categories = [{ id: 'f', name: 'Food', subCategories: [{ id: 'r', name: 'Restaurants', subCategories: [] }] }] as never;
  const result = challengeMetrics([account({})], [tx('2026-10-05', -40), tx('2026-10-06', 200, 'Salary'), tx('2026-09-05', -999)], [], categories, new Date(2026, 9, 20));
  assert.equal(result.spendingByCategory.Food, 40);
  assert.equal(result.savingsRate, 0.8);
});

test('accounts left out of analytics stay out of spending', () => {
  const result = challengeMetrics([account({ includeInAnalytics: false })], [tx('2026-10-05', -40)], [], [], new Date(2026, 9, 20));
  assert.deepEqual(result.spendingByCategory, {});
});

test('budget levels rise as less of the limit is used, and over budget has no level', () => {
  const budgets = [{ categoryName: 'A', amount: 100 }, { categoryName: 'B', amount: 100 }, { categoryName: 'C', amount: 0 }] as Budget[];
  const rows = budgetMastery(budgets, { A: 40, B: 120 });
  assert.deepEqual(rows.map(row => [row.categoryName, row.level, row.title]), [['A', 4, 'Master'], ['B', 0, 'Over budget'], ['C', 0, 'No limit set']]);
});

test('debts with nothing owed are left out, and funded goals too', () => {
  const accounts = [account({ id: 'c', name: 'Card', type: 'Credit Card', balance: -500, creditLimit: 2000 }), account({ id: 'd', name: 'Paid card', type: 'Credit Card', balance: 0 })];
  const goals = [{ id: 'g', name: 'Trip', amount: 100, currentAmount: 40 }, { id: 'h', name: 'Done', amount: 100, currentAmount: 100 }] as FinancialGoal[];
  const { debts, savings } = debtsAndGoals(accounts, [], goals, {});
  assert.deepEqual(debts.map(debt => [debt.name, debt.total, debt.remaining]), [['Card', 2000, 500]]);
  assert.deepEqual(savings.map(goal => [goal.name, goal.remaining]), [['Trip', 60]]);
});

test('records drop the Today row when today is the high', () => {
  const history = [{ date: 'now', value: 90 }, ...Array.from({ length: 11 }, () => ({ date: 'x', value: 80 })), { date: 'October 2025', value: 50 }];
  const record = personalRecords(100, history);
  assert.equal(record.isNewRecord, true);
  assert.deepEqual(record.rows.map(row => row.label), ['All-time high', 'A year ago']);
  assert.equal(record.rows[1].changePct, 100);
  assert.deepEqual(personalRecords(50, [{ date: 'x', value: 80 }]).rows[1], { label: 'Today', detail: 'From the high', value: 50, changePct: -37.5 });
});

test('a sprint counts categories by their words, not one exact name', () => {
  const [sprint] = sprintProgress([{ id: 'dining_detox', startDate: '2026-10-01' }], [account({})], [tx('2026-10-02', -20, 'Restaurants')], new Date(2026, 9, 3));
  assert.equal(sprint.status, 'failed');
  assert.equal(sprint.spent, 20);
});

test('a sprint ignores other categories and completes when time runs out', () => {
  const [sprint] = sprintProgress([{ id: 'dining_detox', startDate: '2026-10-01' }], [account({})], [tx('2026-10-02', -20, 'Rent')], new Date(2026, 9, 9));
  assert.equal(sprint.status, 'completed');
  assert.equal(sprint.daysLeft, 0);
});

test('impulse control fails on one large payment only', () => {
  const run = (amount: number) => sprintProgress([{ id: 'impulse_control', startDate: '2026-10-01' }], [account({})], [tx('2026-10-02', amount)], new Date(2026, 9, 3))[0].status;
  assert.equal(run(-30), 'active');
  assert.equal(run(-60), 'failed');
});

const prediction = (extra: Partial<Prediction>) => ({ id: 'p', type: 'spending_cap', targetName: 'Restaurants', targetAmount: 50, startDate: '2026-10-01', endDate: '2026-10-10', status: 'active', ...extra }) as Prediction;

test('a spending cap stops counting at its end date', () => {
  const context = { accounts: [account({})], transactions: [tx('2026-10-05', -30), tx('2026-10-20', -30)], prices: {} };
  const [result] = resolvePredictions([prediction({})], context, '2026-10-25');
  assert.equal(result.finalAmount, 30);
  assert.equal(result.status, 'won');
});

test('predictions wait until the end date has passed', () => {
  assert.equal(resolvePredictions([prediction({})], { accounts: [], transactions: [], prices: {} }, '2026-10-10').length, 0);
});

test('a price target waits for a price, then compares it', () => {
  const target = prediction({ type: 'price_target', targetId: 'BTC', targetName: 'BTC', targetAmount: 100 });
  assert.equal(resolvePredictions([target], { accounts: [], transactions: [], prices: { BTC: null } }, '2026-11-01').length, 0);
  assert.equal(resolvePredictions([target], { accounts: [], transactions: [], prices: { BTC: 120 } }, '2026-11-01')[0].status, 'won');
});

test('a net worth goal reads the same value on the card and in the result', () => {
  const target = prediction({ type: 'net_worth_goal', targetId: undefined, targetName: 'Total Net Worth', targetAmount: 500 });
  const context = { accounts: [account({})], transactions: [], prices: {} };
  assert.equal(resolvePredictions([target], context, '2026-11-01')[0].finalAmount, predictionValue(target, context));
});

test('making a prediction earns Forecaster before any result', () => {
  const badges = challengeBadges({ accounts: [], budgets: [], goals: [], metrics: metrics({}), memberships: [], bills: [], recurring: [], investmentTransactions: [], stats: { currentStreak: 0, longestStreak: 0, lastLogDate: '' } as UserStats, predictions: [prediction({})], now: new Date(2026, 9, 1) });
  assert.equal(badges.find(badge => badge.id === 'forecaster')!.unlocked, true);
  assert.ok(badges.every(badge => badge.progress >= 0 && badge.progress <= 100));
});

test('a prediction reads differently for a cap and a goal', () => {
  assert.equal(predictionState(prediction({ targetAmount: 100 }), 90).label, 'At risk');
  assert.equal(predictionState(prediction({ targetAmount: 100 }), 120).label, 'Over the limit');
  assert.equal(predictionState(prediction({ type: 'net_worth_goal', targetAmount: 100 }), 90).label, 'Close');
  assert.equal(predictionState(prediction({ type: 'net_worth_goal', targetAmount: 100 }), 120).label, 'Goal met');
  assert.equal(predictionState(prediction({ status: 'won' }), 0).label, 'Won');
});

test('updateActivityStreak increments on consecutive days and resets after a gap', () => {
  const initial: UserStats = { currentStreak: 3, longestStreak: 5, lastLogDate: '2026-10-10' };
  const sameDay = updateActivityStreak(initial, '2026-10-10');
  assert.equal(sameDay.currentStreak, 3);

  const nextDay = updateActivityStreak(initial, '2026-10-11');
  assert.equal(nextDay.currentStreak, 4);
  assert.equal(nextDay.longestStreak, 5);
  assert.equal(nextDay.lastLogDate, '2026-10-11');

  const newRecord = updateActivityStreak({ currentStreak: 5, longestStreak: 5, lastLogDate: '2026-10-11' }, '2026-10-12');
  assert.equal(newRecord.currentStreak, 6);
  assert.equal(newRecord.longestStreak, 6);

  const afterGap = updateActivityStreak(newRecord, '2026-10-15');
  assert.equal(afterGap.currentStreak, 1);
  assert.equal(afterGap.longestStreak, 6);
});
