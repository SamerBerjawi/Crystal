/**
 * Three-way merge of one persisted slice, used when a save loses a race with another device.
 *
 *   base   - the value both devices started from (what this device last loaded/saved)
 *   mine   - this device's current value
 *   theirs - the value now on the server
 *
 * Lists of `{ id }` objects merge per item (adds, deletes and edits from both sides survive); plain objects
 * merge per field; anything else (numbers, strings, plain lists) falls back to this device's value.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const getItemKey = (v: unknown): string | null => {
  if (!isPlainObject(v)) return null;
  // Composite key: Warrants / warrantHoldings (isin + grantDate)
  if (typeof v.isin === 'string' && typeof v.grantDate === 'string') {
    return `warrant::${v.isin}::${v.grantDate}`;
  }
  // Composite key: Budgets ((categoryId || categoryName || category) + period)
  if (
    typeof v.period === 'string' &&
    (typeof v.categoryId === 'string' || typeof v.categoryName === 'string' || typeof v.category === 'string')
  ) {
    const categoryKey = String(v.categoryId || v.categoryName || v.category);
    return `budget::${categoryKey}::${v.period}`;
  }
  // Composite key: Category / Regex categorization rules (pattern + category)
  if (typeof v.pattern === 'string' && typeof v.category === 'string') {
    return `rule::${v.pattern}::${v.category}`;
  }
  // Composite key: Recurring transaction occurrence overrides (recurringTransactionId + originalDate)
  if (typeof v.recurringTransactionId === 'string' && typeof v.originalDate === 'string') {
    return `${v.recurringTransactionId}::${v.originalDate}`;
  }
  // Composite key: Price history entries (date + numeric price)
  if (typeof v.date === 'string' && typeof v.price === 'number') {
    return v.date;
  }
  // Composite key: RuleRunBackup entries in ruleExecutionHistory (batchId || id || timestamp)
  if (typeof v.timestamp === 'string' && Array.isArray(v.transactions)) {
    return `backup::${String(v.batchId || v.id || v.timestamp)}`;
  }
  if (typeof v.id === 'string' && v.id.length > 0) return v.id;
  return null;
};
const hasMergeKey = (v: unknown): v is Record<string, unknown> => getItemKey(v) !== null;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === 'string');
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function threeWayMerge(base: unknown, mine: unknown, theirs: unknown): unknown {
  if (same(mine, base)) return theirs;      // nothing changed here
  if (same(theirs, base)) return mine;      // nothing changed there
  if (same(mine, theirs)) return mine;

  const baseList = base == null ? [] : base;
  if (Array.isArray(mine) && Array.isArray(theirs) && Array.isArray(baseList)
      && mine.length + theirs.length > 0
      && mine.every(hasMergeKey) && theirs.every(hasMergeKey) && baseList.every(hasMergeKey)) {
    return mergeByKey(baseList as Record<string, unknown>[], mine as Record<string, unknown>[], theirs as Record<string, unknown>[]);
  }

  if (isStringArray(mine) && isStringArray(theirs) && isStringArray(baseList)) {
    return mergeStringOrder(baseList, mine, theirs);
  }

  if (isPlainObject(mine) && isPlainObject(theirs) && (base == null || isPlainObject(base))) {
    const b = (base ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const merged = threeWayMerge(b[key], mine[key], theirs[key]);
      if (merged !== undefined) out[key] = merged;
    }
    return out;
  }

  return mine;
}

/**
 * Three-way merges a full or partial `FinancialData` snapshot across all specified slice keys
 * (or the union of keys in `mine` and `theirs` when `keys` is omitted).
 * Used during HTTP 409 Conflict resolution so concurrent edits across devices/tabs merge cleanly.
 */
export function mergeFinancialData<T extends Record<string, unknown>>(
  base: Partial<T> | undefined | null,
  mine: Partial<T>,
  theirs: Partial<T> | undefined | null,
  keys?: readonly (keyof T | string)[],
): Partial<T> {
  const baseObj = (base ?? {}) as Record<string, unknown>;
  const theirsObj = (theirs ?? {}) as Record<string, unknown>;
  const mineObj = mine as Record<string, unknown>;
  const sliceKeys = keys ?? Array.from(new Set([...Object.keys(mineObj), ...Object.keys(theirsObj)]));
  const merged: Record<string, unknown> = { ...mineObj };

  for (const key of sliceKeys) {
    const k = String(key);
    if (!(k in mineObj) && !(k in theirsObj)) continue;
    if (!(k in mineObj)) {
      merged[k] = theirsObj[k];
      continue;
    }
    if (!(k in theirsObj)) {
      merged[k] = mineObj[k];
      continue;
    }
    merged[k] = threeWayMerge(baseObj[k], mineObj[k], theirsObj[k]);
  }

  return merged as Partial<T>;
}

/**
 * Merges ordered string-ID lists (accountOrder, taskOrder, goalOrder):
 * keeps `mine` ordering, drops IDs removed by `theirs` (present in `base` but not `theirs`),
 * and appends any new IDs added in `theirs` that aren't already in `mine`.
 */
function mergeStringOrder(base: string[], mine: string[], theirs: string[]): string[] {
  const baseSet = new Set(base);
  const theirsSet = new Set(theirs);
  const deletedInTheirs = new Set(base.filter(id => !theirsSet.has(id)));
  const deletedInMine = new Set(base.filter(id => !mine.includes(id)));

  const keptFromMine = mine.filter(id => !deletedInTheirs.has(id));
  const keptSet = new Set(keptFromMine);

  for (const id of theirs) {
    if (!keptSet.has(id) && !deletedInMine.has(id) && !baseSet.has(id)) {
      keptFromMine.push(id);
      keptSet.add(id);
    }
  }
  return keptFromMine;
}

function mergeByKey(base: Record<string, unknown>[], mine: Record<string, unknown>[], theirs: Record<string, unknown>[]) {
  const keyOf = (item: Record<string, unknown>) => getItemKey(item)!;
  const baseByKey = new Map(base.map(item => [keyOf(item), item]));
  const mineByKey = new Map(mine.map(item => [keyOf(item), item]));
  const theirsKeys = new Set(theirs.map(item => keyOf(item)));
  const result: Record<string, unknown>[] = [];

  for (const theirItem of theirs) {
    const key = keyOf(theirItem);
    const baseItem = baseByKey.get(key);
    const myItem = mineByKey.get(key);
    if (baseItem && !myItem) continue;                                  // I deleted it
    if (myItem && !same(myItem, baseItem)) {                            // I added or edited it
      result.push(baseItem ? threeWayMerge(baseItem, myItem, theirItem) as Record<string, unknown> : myItem);
    } else {
      result.push(theirItem);                                           // untouched here
    }
  }

  for (const myItem of mine) {                                          // my additions that they don't have
    const key = keyOf(myItem);
    if (theirsKeys.has(key)) continue;
    const baseItem = baseByKey.get(key);
    if (!baseItem || !same(myItem, baseItem)) result.push(myItem);      // new here, or edited here though deleted there
  }
  return result;
}

export interface EntityDelta<T = Record<string, unknown>> {
  upserts: T[];
  deletedIds: string[];
}

/**
 * Computes a compact `{ upserts, deletedIds }` delta between `base` and `current` for large `{ id: string }` arrays
 * (default threshold: `base.length >= 100`, max delta size: `maxDeltaItems = 250`).
 * Returns `null` when full-slice replacement is preferable (small array, no changes, or bulk import/delete).
 */
export function computeArrayDelta<T extends { id: string }>(
  base: T[] | undefined,
  current: T[] | undefined,
  maxDeltaItems = 250,
  minBaseLength = 100,
): EntityDelta<T> | null {
  if (!Array.isArray(base) || !Array.isArray(current) || base.length < minBaseLength) return null;

  const baseById = new Map<string, T>();
  for (const item of base) {
    if (!item || typeof item.id !== 'string') return null;
    baseById.set(item.id, item);
  }

  const seenIds = new Set<string>();
  const upserts: T[] = [];

  for (const item of current) {
    if (!item || typeof item.id !== 'string') return null;
    seenIds.add(item.id);
    const prev = baseById.get(item.id);
    if (prev === undefined || (prev !== item && !same(prev, item))) {
      upserts.push(item);
      if (upserts.length > maxDeltaItems) return null;
    }
  }

  const deletedIds: string[] = [];
  for (const id of baseById.keys()) {
    if (!seenIds.has(id)) {
      deletedIds.push(id);
      if (upserts.length + deletedIds.length > maxDeltaItems) return null;
    }
  }

  if (upserts.length === 0 && deletedIds.length === 0) return null;
  return { upserts, deletedIds };
}

/**
 * Applies an `{ upserts, deletedIds }` delta to a stored array of `{ id: string }` entities in O(N) time.
 */
export function applyArrayDelta<T extends { id: string }>(
  stored: T[] | undefined,
  delta: { upserts?: T[]; deletedIds?: string[] },
): T[] {
  const list = Array.isArray(stored) ? stored : [];
  const deletedSet = new Set(delta.deletedIds ?? []);
  const upserts = Array.isArray(delta.upserts) ? delta.upserts : [];
  const upsertById = new Map<string, T>();
  for (const item of upserts) {
    if (item && typeof item.id === 'string') upsertById.set(item.id, item);
  }

  const appliedIds = new Set<string>();
  const result: T[] = [];

  for (const item of list) {
    if (!item || typeof item.id !== 'string') continue;
    if (deletedSet.has(item.id)) continue;
    const replacement = upsertById.get(item.id);
    if (replacement !== undefined) {
      result.push(replacement);
      appliedIds.add(item.id);
    } else {
      result.push(item);
    }
  }

  for (const item of upserts) {
    if (item && typeof item.id === 'string' && !appliedIds.has(item.id) && !deletedSet.has(item.id)) {
      result.push(item);
      appliedIds.add(item.id);
    }
  }

  return result;
}

