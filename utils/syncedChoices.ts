import { AppPreferences, FinancialGoal } from '../types';
import { normalizeMatcherConfig } from './matcherConfig';

type Storage = Pick<globalThis.Storage, 'getItem' | 'removeItem'>;

const readList = (storage: Storage, key: string): string[] | null => {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null');
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readObject = (storage: Storage, key: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const LIST_CHOICES: { key: string; field: 'ignoredSubscriptions' | 'ignoredBillMatches' | 'dismissedBillNotifications' }[] = [
  { key: 'ignored-subscriptions', field: 'ignoredSubscriptions' },
  { key: 'synced_bill_ignored_matches', field: 'ignoredBillMatches' },
  { key: 'crystal_dismissed_bill_notifications', field: 'dismissedBillNotifications' },
];

const GOALS_KEY = 'crystal_active_goal_ids';
const KNOWN_GOALS_KEY = 'crystal_known_goal_ids';
const MATCHER_KEYS = ['synced_matcher_config_v2', 'synced_matcher_config_v1'];

/**
 * These choices used to stay in one browser (S-002). Moves whatever this browser holds into preferences and clears it.
 * Lists join what other devices already saved. For the rest, a value already in preferences wins.
 */
export const moveLocalChoices = (preferences: AppPreferences, storage: Storage): { preferences: AppPreferences; hasChanged: boolean } => {
  const next = { ...preferences };
  let hasChanged = false;

  LIST_CHOICES.forEach(({ key, field }) => {
    const local = readList(storage, key);
    if (storage.getItem(key) !== null) storage.removeItem(key);
    if (!local?.length) return;
    next[field] = [...new Set([...(preferences[field] ?? []), ...local])];
    hasChanged = true;
  });

  const localGoals = readList(storage, GOALS_KEY);
  const localKnown = readList(storage, KNOWN_GOALS_KEY);
  [GOALS_KEY, KNOWN_GOALS_KEY].forEach(key => storage.removeItem(key));
  if (localGoals && preferences.activeGoalIds === undefined) {
    next.activeGoalIds = localGoals;
    next.knownGoalIds = localKnown ?? localGoals;
    hasChanged = true;
  }

  const localMatcher = MATCHER_KEYS.map(key => readObject(storage, key)).find(Boolean);
  MATCHER_KEYS.forEach(key => storage.removeItem(key));
  if (localMatcher && !preferences.matcherConfig) {
    next.matcherConfig = normalizeMatcherConfig(localMatcher);
    hasChanged = true;
  }

  return { preferences: next, hasChanged };
};

/**
 * Which goals count in the forecast once the list of goals changes: drops deleted and disabled goals, and adds new ones.
 * The first time, every enabled goal counts.
 */
export const reconcileActiveGoals = (goals: FinancialGoal[], active: string[] | undefined, known: string[] | undefined) => {
  const enabled = goals.filter(goal => !goal.disabled).map(goal => goal.id);
  const goalIds = goals.map(goal => goal.id);
  if (active === undefined) return { activeGoalIds: enabled, knownGoalIds: goalIds };

  const seen = new Set(known ?? []);
  const kept = active.filter(id => enabled.includes(id));
  const added = enabled.filter(id => !seen.has(id));
  return { activeGoalIds: [...new Set([...kept, ...added])], knownGoalIds: goalIds };
};
