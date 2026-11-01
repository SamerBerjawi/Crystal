import test from 'node:test';
import assert from 'node:assert/strict';
import { AppPreferences, FinancialGoal } from '../../types';
import { normalizeMatcherConfig } from '../../utils/matcherConfig';
import { moveLocalChoices, reconcileActiveGoals } from '../../utils/syncedChoices';

const storageWith = (values: Record<string, string>) => ({
  values,
  getItem: (key: string) => values[key] ?? null,
  removeItem: (key: string) => { delete values[key]; },
});
const prefs = (extra: Partial<AppPreferences> = {}) => ({ currency: 'EUR', ...extra }) as AppPreferences;
const goal = (id: string, disabled = false) => ({ id, disabled }) as FinancialGoal;

test('local lists join what other devices saved, and leave this browser', () => {
  const storage = storageWith({ 'ignored-subscriptions': '["a","b"]', crystal_dismissed_bill_notifications: '["n"]' });
  const { preferences, hasChanged } = moveLocalChoices(prefs({ ignoredSubscriptions: ['b', 'c'] }), storage);
  assert.ok(hasChanged);
  assert.deepEqual(preferences.ignoredSubscriptions, ['b', 'c', 'a']);
  assert.deepEqual(preferences.dismissedBillNotifications, ['n']);
  assert.deepEqual(storage.values, {});
});

test('nothing local means nothing changes', () => {
  const start = prefs();
  const { preferences, hasChanged } = moveLocalChoices(start, storageWith({}));
  assert.equal(hasChanged, false);
  assert.deepEqual(preferences, start);
});

test('a saved goal choice or matcher setting beats this browser', () => {
  const storage = storageWith({ crystal_active_goal_ids: '["old"]', synced_matcher_config_v2: '{"lookbackDays":90}' });
  const { preferences, hasChanged } = moveLocalChoices(prefs({ activeGoalIds: ['kept'], matcherConfig: normalizeMatcherConfig({ lookbackDays: 20 }) }), storage);
  assert.equal(hasChanged, false);
  assert.deepEqual(preferences.activeGoalIds, ['kept']);
  assert.equal(preferences.matcherConfig?.lookbackDays, 20);
  assert.deepEqual(storage.values, {});
});

test('the matcher moves across, and the older key still works', () => {
  assert.equal(moveLocalChoices(prefs(), storageWith({ synced_matcher_config_v2: '{"lookbackDays":90}' })).preferences.matcherConfig?.lookbackDays, 90);
  assert.equal(moveLocalChoices(prefs(), storageWith({ synced_matcher_config_v1: '{"lookbackDays":60}' })).preferences.matcherConfig?.lookbackDays, 60);
});

test('a broken local value is cleared and ignored', () => {
  const storage = storageWith({ 'ignored-subscriptions': '{oops' });
  assert.equal(moveLocalChoices(prefs(), storage).hasChanged, false);
  assert.deepEqual(storage.values, {});
});

test('matcher values below the minimums are lifted', () => {
  const config = normalizeMatcherConfig({ lookbackDays: 3, dateVarianceDays: 1, amountVariancePercent: 5 });
  assert.equal(config.lookbackDays, 30);
  assert.equal(config.dateVarianceDays, 4);
  assert.equal(config.amountVariancePercent, 5);
});

test('the first time, every enabled goal counts', () => {
  assert.deepEqual(reconcileActiveGoals([goal('a'), goal('b', true)], undefined, undefined), { activeGoalIds: ['a'], knownGoalIds: ['a', 'b'] });
});

test('a goal you turned off stays off, and a new goal comes on', () => {
  const result = reconcileActiveGoals([goal('a'), goal('b'), goal('new')], ['a'], ['a', 'b']);
  assert.deepEqual(result.activeGoalIds, ['a', 'new']);
  assert.deepEqual(result.knownGoalIds, ['a', 'b', 'new']);
});

test('deleted and disabled goals drop out', () => {
  assert.deepEqual(reconcileActiveGoals([goal('a', true)], ['a', 'gone'], ['a', 'gone']).activeGoalIds, []);
});
